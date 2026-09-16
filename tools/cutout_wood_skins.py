"""Chroma-key magenta studio shots of wooden muyu props to RGBA PNGs."""
from __future__ import annotations

import os

import cv2
import numpy as np
from PIL import Image

SRC = r"C:\Users\MOON\.cursor\projects\c-Users-MOON-Desktop-dianzi-muyu\assets"
DST = r"C:\Users\MOON\Desktop\dianzi-muyu\assets\skins"
QA = r"C:\Users\MOON\Desktop\dianzi-muyu\tools\_qa_wood"


def magenta_mask(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.float32)
    g = rgb[:, :, 1].astype(np.float32)
    b = rgb[:, :, 2].astype(np.float32)
    chroma = np.minimum(r, b) - g
    # Magenta / hot-pink: G is the lowest channel and clearly below R/B.
    mag = (chroma > 22) & (g < 170) & (r > 70)
    # Extra catch for rose studio fill (high R, mid B, low G).
    rose = (r > 160) & (b > 70) & (g < 110) & ((r - g) > 45) & ((b - g) > 8)
    return mag | rose


def flood_bg(mask_bg: np.ndarray) -> np.ndarray:
    h, w = mask_bg.shape
    flood = np.zeros((h + 2, w + 2), np.uint8)
    seed = (mask_bg.astype(np.uint8) * 255)
    # Grow from image borders only so the black mouth stays.
    border = np.zeros_like(seed)
    border[0, :] = 255
    border[-1, :] = 255
    border[:, 0] = 255
    border[:, -1] = 255
    start = cv2.bitwise_and(seed, border)
    ys, xs = np.where(start > 0)
    out = np.zeros_like(seed)
    if len(xs) == 0:
        return mask_bg
    ff_in = seed.copy()
    for x, y in zip(xs[:: max(1, len(xs) // 40)], ys[:: max(1, len(ys) // 40)]):
        if ff_in[y, x] == 0:
            continue
        cv2.floodFill(ff_in, flood, (int(x), int(y)), 128, 0, 0, flags=4)
    out = (flood[1:-1, 1:-1] > 0) | (ff_in == 128)
    # Keep original magenta classification for non-border islands that are clearly bg.
    return out | mask_bg


def despill(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    out = rgb.astype(np.float32)
    r, g, b = out[:, :, 0], out[:, :, 1], out[:, :, 2]
    excess = np.minimum(r, b) - g
    edge = (alpha > 8) & (alpha < 250) & (excess > 0)
    w = np.clip(excess / 80.0, 0, 1) * edge.astype(np.float32)
    out[:, :, 0] = r - excess * 0.75 * w
    out[:, :, 2] = b - excess * 0.85 * w
    # Pull remaining pink toward local wood (raise G slightly on edges).
    pink = (alpha > 20) & ((np.minimum(out[:, :, 0], out[:, :, 2]) - out[:, :, 1]) > 12)
    out[:, :, 1] = np.where(pink, np.minimum(out[:, :, 1] + 18, (out[:, :, 0] + out[:, :, 2]) * 0.45), out[:, :, 1])
    return np.clip(out, 0, 255)


def extract(path: str) -> np.ndarray:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3]
    bg = magenta_mask(rgb)
    bg = flood_bg(bg)
    fg = ~bg
    # Close small holes in wood, keep mouth (large dark cavity connected? mouth is black not magenta)
    fg_u8 = fg.astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg_u8 = cv2.morphologyEx(fg_u8, cv2.MORPH_CLOSE, k, iterations=1)
    # Soft alpha
    dist = cv2.distanceTransform((fg_u8 > 0).astype(np.uint8), cv2.DIST_L2, 5)
    alpha = np.clip(dist * 180.0, 0, 255)
    alpha = np.where(fg_u8 > 0, np.maximum(alpha, 40), 0)
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), 0.7)
    # Shrink one pixel to drop magenta fringe
    er = cv2.erode((alpha > 20).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)
    alpha = np.where(er > 0, alpha, alpha * 0.15)
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), 0.45)
    rgb2 = despill(rgb, alpha)
    r, g, b = rgb2[:, :, 0], rgb2[:, :, 1], rgb2[:, :, 2]
    pink = (np.minimum(r, b) - g) > 10
    # Drop leftover chroma fringe; keep solid wood.
    alpha = np.where(pink & (alpha < 200), 0, alpha)
    b = np.where((b > g) & (alpha > 0), g, b)
    rgb2[:, :, 2] = b
    rgba = np.dstack([rgb2, alpha])
    rgba[alpha < 8] = 0
    return rgba.astype(np.uint8)


def bbox(alpha: np.ndarray, pad: int):
    ys, xs = np.where(alpha > 12)
    h, w = alpha.shape
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(w, int(xs.max()) + pad + 1)
    y1 = min(h, int(ys.max()) + pad + 1)
    return x0, y0, x1, y1


def place_on_canvas(rgba: np.ndarray, tw: int, th: int, pad_ratio: float = 0.045) -> np.ndarray:
    a = rgba[:, :, 3]
    x0, y0, x1, y1 = bbox(a, pad=2)
    crop = rgba[y0:y1, x0:x1]
    ch, cw = crop.shape[:2]
    margin_x = int(tw * pad_ratio)
    margin_y = int(th * pad_ratio)
    fit_w = tw - margin_x * 2
    fit_h = th - margin_y * 2
    scale = min(fit_w / cw, fit_h / ch)
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    resized = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA)
    canvas = np.zeros((th, tw, 4), np.uint8)
    ox = (tw - nw) // 2
    oy = (th - nh) // 2
    canvas[oy : oy + nh, ox : ox + nw] = resized
    return canvas


def mean_rgb(rgba: np.ndarray) -> np.ndarray:
    a = rgba[:, :, 3] > 80
    return rgba[:, :, :3][a].mean(axis=0).astype(np.float32)


def tint_towards(src: np.ndarray, target_mean: np.ndarray, amount: float) -> np.ndarray:
    cur = mean_rgb(src)
    ratio = np.clip(target_mean / np.maximum(cur, 1.0), 0.55, 1.85)
    out = src.astype(np.float32)
    out[:, :, :3] *= 1.0 + (ratio - 1.0) * amount
    out[:, :, :3] = np.clip(out[:, :, :3], 0, 255)
    out[:, :, 3] = src[:, :, 3]
    return out.astype(np.uint8)


def darken_keep_grain(src: np.ndarray, mul: float) -> np.ndarray:
    out = src.astype(np.float32)
    rgb = out[:, :, :3]
    # Preserve relative grain: scale toward a slightly redder dark wood.
    rgb *= mul
    out[:, :, :3] = np.clip(rgb, 0, 255)
    return out.astype(np.uint8)


def overlay_alphas(paths, out_path):
    ims = [np.array(Image.open(p)) for p in paths]
    h = max(im.shape[0] for im in ims)
    w = max(im.shape[1] for im in ims)
    canvas = np.zeros((h, w, 3), np.uint8)
    colors = [(255, 80, 80), (80, 220, 80), (80, 140, 255)]
    for im, col in zip(ims, colors):
        a = im[:, :, 3]
        yy = (h - im.shape[0]) // 2
        xx = (w - im.shape[1]) // 2
        m = a > 40
        region = canvas[yy : yy + im.shape[0], xx : xx + im.shape[1]]
        region[m] = np.clip(region[m].astype(np.int16) + np.array(col), 0, 255).astype(np.uint8)
    Image.fromarray(canvas).save(out_path)


def main():
    os.makedirs(DST, exist_ok=True)
    os.makedirs(QA, exist_ok=True)

    fish_names = ["muyu-amber.png", "muyu-jade.png", "muyu-inkgold.png"]
    mallet_names = ["muyu-mallet-amber.png", "muyu-mallet-jade.png", "muyu-mallet-inkgold.png"]

    fishes = {}
    for name in fish_names:
        rgba = extract(os.path.join(SRC, name))
        if name == "muyu-inkgold.png":
            rgba = darken_keep_grain(rgba, 0.78)
        canvas = place_on_canvas(rgba, 2048, 1536, pad_ratio=0.05)
        fishes[name] = canvas
        Image.fromarray(canvas).save(os.path.join(DST, name), "PNG")
        print(name, canvas.shape[:2], "opaque", int((canvas[:, :, 3] > 12).mean() * 1000) / 10, "%")

    mallets = {}
    fish_means = {
        "muyu-mallet-amber.png": mean_rgb(fishes["muyu-amber.png"]),
        "muyu-mallet-jade.png": mean_rgb(fishes["muyu-jade.png"]),
        "muyu-mallet-inkgold.png": mean_rgb(fishes["muyu-inkgold.png"]),
    }
    for name in mallet_names:
        rgba = extract(os.path.join(SRC, name))
        if name == "muyu-mallet-inkgold.png":
            rgba = darken_keep_grain(rgba, 0.78)
        rgba = tint_towards(rgba, fish_means[name], 0.55)
        canvas = place_on_canvas(rgba, 2048, 512, pad_ratio=0.06)
        mallets[name] = canvas
        Image.fromarray(canvas).save(os.path.join(DST, name), "PNG")
        print(name, canvas.shape[:2], "opaque", int((canvas[:, :, 3] > 12).mean() * 1000) / 10, "%")

    overlay_alphas([os.path.join(DST, n) for n in fish_names], os.path.join(QA, "overlay-fish.png"))
    overlay_alphas([os.path.join(DST, n) for n in mallet_names], os.path.join(QA, "overlay-mallet.png"))

    # Magenta leftover check
    for name in fish_names + mallet_names:
        im = np.array(Image.open(os.path.join(DST, name)))
        r, g, b, a = [im[:, :, i].astype(np.float32) for i in range(4)]
        leftover = (a > 20) & ((np.minimum(r, b) - g) > 40)
        print(name, "magenta-ish px", int(leftover.sum()), "size", os.path.getsize(os.path.join(DST, name)))


if __name__ == "__main__":
    main()
