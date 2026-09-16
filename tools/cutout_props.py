"""Cut instrument silhouettes from studio PNGs (GrabCut + defringe)."""
import os
import subprocess
import sys

import cv2
import numpy as np

ROOT = r"C:\Users\MOON\Desktop\dianzi-muyu"
ASSETS = os.path.join(ROOT, "assets")


def restore(name):
    data = subprocess.check_output(["git", "show", f"HEAD:assets/{name}"], cwd=ROOT)
    with open(os.path.join(ASSETS, name), "wb") as f:
        f.write(data)
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def filled_largest(mask):
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = np.zeros_like(mask)
    if not cnts:
        return out
    cv2.drawContours(out, [max(cnts, key=cv2.contourArea)], -1, 255, thickness=-1)
    return out


def smooth_alpha(mask, sigma=1.1):
    return cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma)


def unpremultiply_from_black(bgra):
    """Remove black-studio bleed from semi-transparent edge pixels."""
    im = bgra.astype(np.float32)
    a = im[:, :, 3:4] / 255.0
    a_safe = np.maximum(a, 0.04)
    rgb = im[:, :, :3]
    rgb_clean = np.clip(rgb / a_safe, 0, 255)
    edge = (im[:, :, 3] > 6) & (im[:, :, 3] < 250)
    rgb_out = np.where(edge[..., None], rgb_clean, rgb)
    return np.dstack([rgb_out, im[:, :, 3]]).astype(np.uint8)


def finalize_rgba(bgr, alpha, path, pad=10, sigma=1.05, erode=1):
    hard = (alpha > 12).astype(np.uint8)
    ys, xs = np.where(hard)
    if len(xs) == 0:
        return None
    h, w = bgr.shape[:2]
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(w, int(xs.max()) + pad + 1)
    y1 = min(h, int(ys.max()) + pad + 1)
    crop = bgr[y0:y1, x0:x1]
    a_crop = alpha[y0:y1, x0:x1]
    out = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
    out[:, :, 3] = np.clip(a_crop, 0, 255).astype(np.uint8)
    out = unpremultiply_from_black(out)
    hard2 = (out[:, :, 3] > 40).astype(np.uint8) * 255
    if erode:
        hard2 = cv2.erode(
            hard2, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), erode
        )
    soft = smooth_alpha(hard2, sigma)
    out[:, :, 3] = np.clip(soft, 0, 255).astype(np.uint8)
    out[out[:, :, 3] < 6] = 0
    cv2.imwrite(path, out)
    print("wrote", os.path.basename(path), out.shape[:2])
    return out


def grabcut_seeded(bgr, rect, bg_zones=(), iters=7):
    h, w = bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    for zone in bg_zones:
        y0, y1, x0, x1 = zone
        mask[y0:y1, x0:x1] = cv2.GC_BGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, rect, bgd, fgd, iters, cv2.GC_INIT_WITH_RECT)
    return np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)


def extract_muyu_fish(bgr):
    fish = grabcut_seeded(
        bgr,
        (60, 60, 820, 540),
        bg_zones=[(0, bgr.shape[0], 920, bgr.shape[1]), (480, bgr.shape[0], 680, 920)],
        iters=7,
    )
    fish = cv2.morphologyEx(
        fish, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)), 2
    )
    fish = cv2.morphologyEx(
        fish, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    )
    fish = filled_largest(fish)
    finalize_rgba(bgr, smooth_alpha(fish, 1.25), os.path.join(ASSETS, "muyu.png"), pad=12, sigma=1.0)


def foreground(bgr):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, fg = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    k = np.ones((5, 5), np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=1)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return cv2.GaussianBlur(fg, (5, 5), 0)


def components(fg, min_area=800):
    hard = (fg > 40).astype(np.uint8) * 255
    n, lab, st, _ = cv2.connectedComponentsWithStats(hard, 8)
    blobs = []
    for i in range(1, n):
        area = int(st[i, cv2.CC_STAT_AREA])
        if area < min_area:
            continue
        x, y, bw, bh = (
            int(st[i, cv2.CC_STAT_LEFT]),
            int(st[i, cv2.CC_STAT_TOP]),
            int(st[i, cv2.CC_STAT_WIDTH]),
            int(st[i, cv2.CC_STAT_HEIGHT]),
        )
        blobs.append((area, x, y, bw, bh, (lab == i).astype(np.uint8) * 255))
    blobs.sort(reverse=True)
    return blobs


def extract_muyu_mallet(bgr):
    """Otsu blob #2 is the horizontal stick; GrabCut alone grabs fish tail."""
    blobs = components(foreground(bgr), 1200)
    if len(blobs) < 2:
        return
    fish = blobs[0][5]
    mallet = blobs[1][5]
    fish_d = cv2.dilate(fish, np.ones((17, 17), np.uint8))
    mallet = cv2.bitwise_and(mallet, cv2.bitwise_not(fish_d))
    mallet = filled_largest(mallet)
    mallet = cv2.dilate(mallet, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)
    finalize_rgba(
        bgr,
        smooth_alpha(mallet, 0.95),
        os.path.join(ASSETS, "muyu-mallet.png"),
        pad=8,
        sigma=0.75,
        erode=0,
    )


def smooth_stick_envelope(mask):
    """Flatten table-grain noise into a clean cylinder silhouette."""
    hard = (mask > 40).astype(np.uint8)
    ys, xs = np.where(hard)
    if len(xs) == 0:
        return mask
    x0, x1 = int(xs.min()), int(xs.max())
    top, bot = [], []
    for x in range(x0, x1 + 1):
        col = np.where(hard[:, x])[0]
        if len(col):
            top.append(col.min())
            bot.append(col.max())
        else:
            top.append(top[-1] if top else 0)
            bot.append(bot[-1] if bot else hard.shape[0] - 1)
    k = np.ones(11, np.float32) / 11
    top = np.convolve(np.array(top, np.float32), k, mode="same")
    bot = np.convolve(np.array(bot, np.float32), k, mode="same")
    out = np.zeros_like(mask, np.uint8)
    for i, x in enumerate(range(x0, x1 + 1)):
        y0 = max(0, int(top[i]))
        y1 = min(hard.shape[0] - 1, int(bot[i]))
        out[y0 : y1 + 1, x] = 255
    return out


def stick_mask_from_crop(crop_bgr):
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    wood = cv2.inRange(hsv, (8, 90, 28), (16, 180, 58))
    wood = cv2.morphologyEx(
        wood, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 11)), 2
    )
    return smooth_stick_envelope(filled_largest(wood))


def write_bowl_mallet(bgr):
    """Crop the horizontal table stick first so table grain stays out of alpha."""
    x0, y0, x1, y1 = 702, 606, 1183, 672
    crop = bgr[y0:y1, x0:x1].copy()
    alpha = stick_mask_from_crop(crop)
    stick_path = os.path.join(ASSETS, "bowl-mallet.png")
    finalize_rgba(crop, smooth_alpha(alpha, 0.85), stick_path, pad=8, sigma=0.7, erode=0)
    stick_im = cv2.imread(stick_path, cv2.IMREAD_UNCHANGED)
    if stick_im is not None:
        cv2.imwrite(stick_path, cv2.rotate(stick_im, cv2.ROTATE_90_COUNTERCLOCKWISE))
        print("rotated", os.path.basename(stick_path), "to vertical")


def extract_bowl_and_stick(bgr):
    h, w = bgr.shape[:2]
    bowl = grabcut_seeded(bgr, (330, 210, 680, 370), bg_zones=[(0, h, 905, w)], iters=6)
    bowl = cv2.morphologyEx(
        bowl, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    )
    bowl = filled_largest(bowl)

    finalize_rgba(bgr, smooth_alpha(bowl, 1.15), os.path.join(ASSETS, "bowl.png"), pad=10, sigma=0.95)
    write_bowl_mallet(bgr)


def extract_muyu(bgr):
    extract_muyu_fish(bgr)
    extract_muyu_mallet(bgr)


def main():
    extract_muyu(restore("muyu.png"))
    extract_bowl_and_stick(restore("bowl.png"))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "bowl":
        extract_bowl_and_stick(restore("bowl.png"))
    elif len(sys.argv) > 1 and sys.argv[1] == "muyu":
        extract_muyu(restore("muyu.png"))
    else:
        main()
