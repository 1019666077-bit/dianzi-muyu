"""Rebuild mp-weixin premium muyu layers.

Not the classic-skin exporter — that is ``tools/export_mp_skins.py``
(``assets/skins/*.png`` → ``mp-weixin/assets/skins/*.webp``). This script
only writes layered **精修** WebP under ``mp-weixin/assets/skins/premium/``.

v2 (``python tools/build_premium_muyu.py --v2``)
    Enhance ``muyu-amber.png`` in-place (local contrast + warm tint) and
    emit procedural shade / spec / ground.

v3 (default: ``python tools/build_premium_muyu.py`` or ``--v3``)
    Photoreal AI body mask-aligned to each wood silhouette, then 3D layers:
    shade (wide rim AO + BR core + mouth cavity), spec (narrow UL ridges),
    ground (contact + penumbra), optional rim (2–4px edge), matching mallet.

    AI sources (replace and re-run):
      assets/skins/muyu-premium-body-ai.png
      assets/skins/muyu-premium-jade-ai.png
      assets/skins/muyu-premium-inkgold-ai.png
      assets/skins/muyu-premium-mallet-ai.png  (amber; others use skin PNG)

    Tunables: grain_strength, mouth_depth, rim_darken (see V3 below).
    Pack budget: all ``premium/*.webp`` ≤ 180KB (hard cap 200KB), body ≤ 70KB.
"""
from __future__ import annotations

import argparse
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKINS_DIR = os.path.join(ROOT, "assets", "skins")
SRC_AMBER = os.path.join(SKINS_DIR, "muyu-amber.png")
SRC_AI_BODY = os.path.join(SKINS_DIR, "muyu-premium-body-ai.png")
SRC_AI_MALLET = os.path.join(SKINS_DIR, "muyu-premium-mallet-ai.png")
SRC_MALLET_REF = os.path.join(SKINS_DIR, "muyu-mallet-amber.png")
OUT_DIR = os.path.join(ROOT, "mp-weixin", "assets", "skins", "premium")
OLD_OUT_DIR = os.path.join(ROOT, "mp-weixin", "assets", "skins", "test")
OUT_BODY_PNG = os.path.join(SKINS_DIR, "muyu-premium-body.png")
OUT_MALLET_PNG = os.path.join(SKINS_DIR, "muyu-premium-mallet.png")
OUT_W, OUT_H = 800, 600
MALLET_W, MALLET_H = 800, 200
TOTAL_BUDGET_KB = 180
BODY_CAP_KB = 70

# v3 sculpt parameters (used by shade/spec/rim and procedural fallback body)
V3 = {
    "grain_strength": 0.32,
    "mouth_depth": 0.48,
    "rim_darken": 0.62,
}


def resize_canvas(rgba: np.ndarray, tw: int, th: int) -> np.ndarray:
    h, w = rgba.shape[:2]
    margin_x, margin_y = int(tw * 0.045), int(th * 0.045)
    fit_w, fit_h = tw - margin_x * 2, th - margin_y * 2
    scale = min(fit_w / w, fit_h / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = cv2.resize(rgba, (nw, nh), interpolation=cv2.INTER_AREA)
    canvas = np.zeros((th, tw, 4), np.uint8)
    ox, oy = (tw - nw) // 2, (th - nh) // 2
    canvas[oy : oy + nh, ox : ox + nw] = resized
    return canvas


def flood_foreground(rgb: np.ndarray, thresh: int = 22) -> np.ndarray:
    """Keep dark cavities (mouth) by flooding only the black studio backdrop."""
    h, w = rgb.shape[:2]
    lum = rgb.max(axis=2).astype(np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    acc = np.zeros((h, w), np.uint8)
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)):
        if int(lum[seed[1], seed[0]]) > thresh + 8:
            continue
        mask = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(lum.copy(), mask, seed, 0, loDiff=thresh, upDiff=thresh, flags=flags)
        acc = np.maximum(acc, mask[1:-1, 1:-1])
    return acc == 0


def bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise RuntimeError("empty mask")
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def iou(a: np.ndarray, b: np.ndarray, thr: int = 32) -> float:
    aa, bb = a > thr, b > thr
    inter = np.logical_and(aa, bb).sum()
    union = np.logical_or(aa, bb).sum()
    return float(inter) / float(union) if union else 0.0


def align_rgb_to_mask(src_rgb: np.ndarray, src_fg: np.ndarray, ref_rgba: np.ndarray, boost: float = 1.035) -> np.ndarray:
    """Warp src subject into ref silhouette; output alpha == ref alpha (IoU ~ 1)."""
    ref_a = ref_rgba[:, :, 3]
    ref_fg = ref_a > 32
    rx0, ry0, rx1, ry1 = bbox(ref_fg)
    sx0, sy0, sx1, sy1 = bbox(src_fg)
    crop = src_rgb[sy0 : sy1 + 1, sx0 : sx1 + 1]
    rw, rh = rx1 - rx0 + 1, ry1 - ry0 + 1
    nw, nh = max(1, int(rw * boost)), max(1, int(rh * boost))
    warped = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_CUBIC)
    canvas = np.zeros_like(ref_rgba[:, :, :3])
    ox = rx0 - (nw - rw) // 2
    oy = ry0 - (nh - rh) // 2
    y0, x0 = max(0, oy), max(0, ox)
    y1, x1 = min(ref_a.shape[0], oy + nh), min(ref_a.shape[1], ox + nw)
    sy, sx = y0 - oy, x0 - ox
    patch = warped[sy : sy + (y1 - y0), sx : sx + (x1 - x0)]
    canvas[y0:y1, x0:x1] = patch
    out = np.dstack([canvas, ref_a])
    out[ref_a <= 32] = 0
    return out


def pop_grain(rgb: np.ndarray, alpha: np.ndarray, grain_strength: float, tint: bool = False) -> np.ndarray:
    fg = alpha > 24
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    l, a, b = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]
    blur = cv2.GaussianBlur(l, (0, 0), 1.5)
    l = np.clip(l + (l - blur) * grain_strength, 0, 255)
    if tint:
        a = np.clip(a + 1.5, 0, 255)
        b = np.clip(b + 3.0, 0, 255)
    lab2 = np.dstack([l, a, b]).astype(np.uint8)
    out = cv2.cvtColor(lab2, cv2.COLOR_LAB2RGB)
    out[~fg] = 0
    return out


def deepen_mouth(rgb: np.ndarray, alpha: np.ndarray, ref_rgb: np.ndarray, mouth_depth: float) -> np.ndarray:
    fg = alpha > 24
    dist = cv2.distanceTransform(fg.astype(np.uint8), cv2.DIST_L2, 5)
    g_ai = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    g_ref = cv2.cvtColor(ref_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mouth = fg & (dist > 7) & ((g_ai < 46) | (g_ref < 52))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mouth = cv2.dilate(mouth.astype(np.uint8), k, 1).astype(bool)
    out = rgb.astype(np.float32)
    out[mouth] *= 1.0 - mouth_depth
    return np.clip(out, 0, 255).astype(np.uint8)


def warped_grain_field(h: int, w: int, seed: int = 7) -> np.ndarray:
    rng = np.random.RandomState(seed)
    n = rng.rand(max(16, h // 5), max(16, w // 5)).astype(np.float32)
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    wx = xx + 22.0 * np.sin(yy / 38.0) + 9.0 * np.sin(yy / 17.0)
    wy = yy + 7.0 * np.sin(xx / 52.0)
    return cv2.remap(n, wx, wy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def enhance_body(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """v2 body: local contrast + camphor tint + mouth deepen + UL key."""
    fg = alpha > 24
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    l, a, b = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]
    blur = cv2.GaussianBlur(l, (0, 0), 2.2)
    l = np.clip(l + (l - blur) * 0.45, 0, 255)
    a = np.clip(a + 4, 0, 255)
    b = np.clip(b + 6, 0, 255)
    lab2 = np.dstack([l, a, b]).astype(np.uint8)
    rgb2 = cv2.cvtColor(lab2, cv2.COLOR_LAB2RGB).astype(np.float32)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mouth = fg & (gray < 55)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mouth = cv2.dilate(mouth.astype(np.uint8), k, 1).astype(bool)
    rgb2[mouth] *= 0.55
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    light = np.clip(0.88 + 0.18 * (1 - yy / h) + 0.12 * (1 - xx / w), 0.75, 1.12)
    rgb2 = np.clip(rgb2 * light[:, :, None], 0, 255)
    rgb2[~fg] = 0
    return rgb2.astype(np.uint8)


def enhance_body_v3_procedural(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Fallback if AI body is missing: warped grain inside amber silhouette."""
    base = enhance_body(rgb, alpha).astype(np.float32)
    h, w = alpha.shape
    grain = warped_grain_field(h, w)
    grain = (grain - grain.mean()) / (grain.std() + 1e-6)
    fg = alpha > 24
    base[fg] = np.clip(base[fg] + grain[fg, None] * (18 * V3["grain_strength"]), 0, 255)
    return deepen_mouth(base.astype(np.uint8), alpha, rgb, V3["mouth_depth"])


def build_shade(alpha: np.ndarray) -> np.ndarray:
    fg = (alpha > 20).astype(np.uint8)
    dist = cv2.distanceTransform(fg, cv2.DIST_L2, 5)
    ao = np.clip(1.0 - dist / 28.0, 0, 1)
    ao = cv2.GaussianBlur(ao.astype(np.float32), (0, 0), 1.8)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dir_sh = np.clip(0.35 + 0.65 * (yy / h) * 0.85 + 0.35 * (xx / w) * 0.5, 0, 1)
    strength = np.clip(ao * 0.55 + dir_sh * 0.45, 0, 1)
    strength *= (alpha > 8).astype(np.float32)
    shade_rgb = np.zeros((h, w, 3), np.uint8)
    shade_rgb[:, :, 0] = 28
    shade_rgb[:, :, 1] = 18
    shade_rgb[:, :, 2] = 12
    shade_a = np.clip(strength * 220, 0, 255).astype(np.uint8)
    return np.dstack([shade_rgb, shade_a])


def build_shade_v3(alpha: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    """Smooth volume AO only — no grain in alpha (keeps WebP small)."""
    fg = (alpha > 20).astype(np.uint8)
    dist = cv2.distanceTransform(fg, cv2.DIST_L2, 5)
    ao = np.clip(1.0 - dist / 48.0, 0, 1) ** 1.08
    ao = cv2.GaussianBlur(ao.astype(np.float32), (0, 0), 4.2)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    core = np.clip((yy / h) * 0.82 + (xx / w) * 0.50, 0, 1) ** 1.45
    core = cv2.GaussianBlur(core, (0, 0), 6.0)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mouth = ((gray < 42) & (alpha > 24) & (dist > 8)).astype(np.float32)
    mouth = cv2.GaussianBlur(mouth, (0, 0), 10.0)
    strength = np.clip(
        ao * V3["rim_darken"] * 0.72 + core * 0.34 + mouth * 0.55,
        0,
        1,
    )
    strength *= (alpha > 8).astype(np.float32)
    shade_rgb = np.zeros((h, w, 3), np.uint8)
    shade_rgb[:, :, 0] = 26
    shade_rgb[:, :, 1] = 16
    shade_rgb[:, :, 2] = 10
    shade_a = np.clip(strength * 200, 0, 255).astype(np.uint8)
    shade_rgb[shade_a == 0] = 0
    return np.dstack([shade_rgb, shade_a])


def build_spec(alpha: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    h, w = alpha.shape
    dist = cv2.distanceTransform((alpha > 20).astype(np.uint8), cv2.DIST_L2, 5)
    edge = np.clip(1.0 - dist / 12.0, 0, 1)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    spec_mask = edge * (0.55 + 0.45 * (1 - yy / h)) * (0.7 + 0.3 * (1 - xx / w))
    spec_mask *= (gray > 0.35).astype(np.float32)
    spec_mask = cv2.GaussianBlur(spec_mask.astype(np.float32), (0, 0), 1.2)
    spec_mask *= (alpha > 24).astype(np.float32)
    spec_rgb = np.full((h, w, 3), 255, np.uint8)
    spec_a = np.clip(spec_mask * 180, 0, 255).astype(np.uint8)
    return np.dstack([spec_rgb, spec_a])


def build_spec_v3(alpha: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    """Narrow upper-left highlight band — smooth, not grain-following."""
    h, w = alpha.shape
    dist = cv2.distanceTransform((alpha > 20).astype(np.uint8), cv2.DIST_L2, 5)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Key highlight blob on the dome (upper-left)
    cx, cy = w * 0.38, h * 0.28
    blob = np.exp(-(((xx - cx) / (w * 0.22)) ** 2 + ((yy - cy) / (h * 0.16)) ** 2))
    rim = np.clip(1.0 - dist / 5.5, 0, 1) ** 2.6
    ul = np.clip((1.0 - yy / h) * (1.0 - xx / w * 0.55), 0, 1)
    spec = np.clip(blob * 0.85 + rim * ul * 0.40, 0, 1)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    spec *= (gray > 80).astype(np.float32)
    spec *= (alpha > 24).astype(np.float32)
    spec = cv2.GaussianBlur(spec.astype(np.float32), (0, 0), 3.2)
    spec_rgb = np.full((h, w, 3), 255, np.uint8)
    spec_a = np.clip(spec * 140, 0, 255).astype(np.uint8)
    spec_rgb[spec_a == 0] = 0
    return np.dstack([spec_rgb, spec_a])


def build_ground(alpha: np.ndarray) -> np.ndarray:
    h, w = alpha.shape
    ys, xs = np.where(alpha > 40)
    if len(xs) == 0:
        return np.zeros((h, w, 4), np.uint8)
    cx = int((xs.min() + xs.max()) / 2)
    cy = int(ys.max() - (ys.max() - ys.min()) * 0.08)
    rx = int((xs.max() - xs.min()) * 0.42)
    ry = max(8, int((ys.max() - ys.min()) * 0.06))
    ground = np.zeros((h, w, 4), np.uint8)
    cv2.ellipse(ground, (cx, cy), (rx, ry), 0, 0, 360, (0, 0, 0, 200), -1)
    ground[:, :, 3] = cv2.GaussianBlur(ground[:, :, 3].astype(np.float32), (0, 0), 8).astype(np.uint8)
    return ground


def build_ground_v3(alpha: np.ndarray) -> np.ndarray:
    h, w = alpha.shape
    ys, xs = np.where(alpha > 40)
    if len(xs) == 0:
        return np.zeros((h, w, 4), np.uint8)
    cx = int((xs.min() + xs.max()) / 2)
    cy = int(ys.max() - (ys.max() - ys.min()) * 0.06)
    rw = xs.max() - xs.min()
    rh = ys.max() - ys.min()
    rx = int(rw * 0.44)
    ry = max(7, int(rh * 0.055))
    layer = np.zeros((h, w), np.float32)
    cv2.ellipse(layer, (cx, cy), (rx, ry), 0, 0, 360, 1.0, -1)
    pen = np.zeros((h, w), np.float32)
    cv2.ellipse(pen, (cx, cy + 2), (int(rx * 1.28), int(ry * 1.85)), 0, 0, 360, 0.45, -1)
    a = np.clip(layer * 210 + pen * 140, 0, 255)
    a = cv2.GaussianBlur(a, (0, 0), 7.5)
    ground = np.zeros((h, w, 4), np.uint8)
    ground[:, :, 3] = a.astype(np.uint8)
    return ground


def build_rim_v3(alpha: np.ndarray) -> np.ndarray:
    fg = (alpha > 20).astype(np.uint8)
    dist = cv2.distanceTransform(fg, cv2.DIST_L2, 5)
    rim = np.clip((3.6 - dist) / 3.6, 0, 1) * (dist > 0.15) * (alpha > 20)
    rim = cv2.GaussianBlur(rim.astype(np.float32), (0, 0), 0.55)
    rgba = np.zeros((*alpha.shape, 4), np.uint8)
    rgba[:, :, 0] = 22
    rgba[:, :, 1] = 12
    rgba[:, :, 2] = 8
    rgba[:, :, 3] = np.clip(rim * 210, 0, 255).astype(np.uint8)
    return rgba


def compact_overlay(rgba: np.ndarray, tw: int = 400, th: int = 300, a_steps: int = 16) -> np.ndarray:
    """Downscale + posterize alpha so sparse lighting layers stay tiny."""
    small = cv2.resize(rgba, (tw, th), interpolation=cv2.INTER_AREA)
    a = small[:, :, 3].astype(np.float32)
    a = np.round(a / 255.0 * a_steps) / a_steps * 255.0
    a[a < 10] = 0
    small[:, :, 3] = a.astype(np.uint8)
    small[small[:, :, 3] == 0] = 0
    return small


def save_webp(rgba: np.ndarray, path: str, quality: int = 86) -> None:
    Image.fromarray(rgba).save(path, "WEBP", quality=quality, method=6)


def save_webp_under(rgba: np.ndarray, path: str, max_kb: int, q0: int = 84, qmin: int = 72) -> int:
    q = q0
    while q >= qmin:
        save_webp(rgba, path, quality=q)
        kb = os.path.getsize(path) / 1024.0
        if kb <= max_kb:
            return q
        q -= 4
    return qmin


def load_rgb_ai(path: str) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    return np.array(im)


def build_mallet_v3() -> np.ndarray | None:
    if not os.path.isfile(SRC_AI_MALLET) or not os.path.isfile(SRC_MALLET_REF):
        print("skip mallet: missing AI or ref", file=sys.stderr)
        return None
    ai = load_rgb_ai(SRC_AI_MALLET)
    fg = flood_foreground(ai, thresh=20)
    ref = np.array(Image.open(SRC_MALLET_REF).convert("RGBA"))
    ref_c = resize_canvas(ref, MALLET_W, MALLET_H)
    aligned = align_rgb_to_mask(ai, fg, ref_c, boost=1.02)
    rgb = pop_grain(aligned[:, :, :3], aligned[:, :, 3], grain_strength=0.22)
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    light = np.clip(0.90 + 0.16 * (1 - yy / max(h, 1)) + 0.10 * (1 - xx / max(w, 1)), 0.78, 1.10)
    rgb = np.clip(rgb.astype(np.float32) * light[:, :, None], 0, 255).astype(np.uint8)
    rgb[aligned[:, :, 3] <= 32] = 0
    return np.dstack([rgb, aligned[:, :, 3]])


def build_mallet_from_png(mallet_path: str, darken: float = 1.0) -> np.ndarray:
    """Premium mallet from existing skin PNG (same UL key light as body)."""
    ref = np.array(Image.open(mallet_path).convert("RGBA"))
    canvas = resize_canvas(ref, MALLET_W, MALLET_H)
    rgb = pop_grain(canvas[:, :, :3], canvas[:, :, 3], grain_strength=0.24)
    if darken != 1.0:
        rgb = np.clip(rgb.astype(np.float32) * darken, 0, 255).astype(np.uint8)
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    light = np.clip(0.90 + 0.16 * (1 - yy / max(h, 1)) + 0.10 * (1 - xx / max(w, 1)), 0.78, 1.10)
    rgb = np.clip(rgb.astype(np.float32) * light[:, :, None], 0, 255).astype(np.uint8)
    a = canvas[:, :, 3]
    rgb[a <= 32] = 0
    return np.dstack([rgb, a])


def tint_wood_lab(rgb: np.ndarray, alpha: np.ndarray, a_delta: float, b_delta: float, l_mul: float = 1.0) -> np.ndarray:
    fg = alpha > 24
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    lab[:, :, 0] = np.clip(lab[:, :, 0] * l_mul, 0, 255)
    lab[:, :, 1] = np.clip(lab[:, :, 1] + a_delta, 0, 255)
    lab[:, :, 2] = np.clip(lab[:, :, 2] + b_delta, 0, 255)
    out = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2RGB)
    out[~fg] = 0
    return out


def run_v2() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    im = np.array(Image.open(SRC_AMBER).convert("RGBA"))
    canvas = resize_canvas(im, OUT_W, OUT_H)
    rgb, alpha = canvas[:, :, :3], canvas[:, :, 3]
    body_rgb = enhance_body(rgb, alpha)
    body = np.dstack([body_rgb, alpha])
    paths = {
        "muyu-premium-body.webp": body,
        "muyu-premium-shade.webp": build_shade(alpha),
        "muyu-premium-spec.webp": build_spec(alpha, body_rgb),
        "muyu-premium-ground.webp": build_ground(alpha),
    }
    for name, arr in paths.items():
        p = os.path.join(OUT_DIR, name)
        save_webp(arr, p)
        print(name, round(os.path.getsize(p) / 1024.0, 1), "KB")
    Image.fromarray(body).save(OUT_BODY_PNG, "PNG")
    print("updated", OUT_BODY_PNG)


PREMIUM_WOODS = {
    "amber": {
        "fish": "muyu-amber.png",
        "mallet": "muyu-mallet-amber.png",
        "prefix": "muyu-premium",
        "ai_body": "muyu-premium-body-ai.png",
        "ai_mallet": "muyu-premium-mallet-ai.png",
        "v3": dict(V3),
        "lab": (0, 0, 1.0),
        "mallet_darken": 1.0,
        "ai_pop": 0.16,
        "ai_mouth": 0.10,
        "align_boost": 1.04,
    },
    "jade": {
        "fish": "muyu-jade.png",
        "mallet": "muyu-mallet-jade.png",
        "prefix": "muyu-premium-jade",
        "ai_body": "muyu-premium-jade-ai.png",
        "ai_mallet": None,
        "v3": {**V3, "grain_strength": 0.22, "mouth_depth": 0.18, "rim_darken": 0.58},
        "lab": (0, 0, 1.0),
        "mallet_darken": 1.0,
        "ai_pop": 0.14,
        "ai_mouth": 0.08,
        "align_boost": 1.03,
    },
    "inkgold": {
        "fish": "muyu-inkgold.png",
        "mallet": "muyu-mallet-inkgold.png",
        "prefix": "muyu-premium-inkgold",
        "ai_body": "muyu-premium-inkgold-ai.png",
        "ai_mallet": None,
        "v3": {**V3, "grain_strength": 0.26, "mouth_depth": 0.16, "rim_darken": 0.64},
        "lab": (2, -1, 1.04),
        "mallet_darken": 1.0,
        "ai_pop": 0.18,
        "ai_mouth": 0.08,
        "align_boost": 1.03,
    },
}


def resolve_ai_body(wood: str, cfg: dict, src_fish: str) -> str | None:
    """Prefer dedicated *-ai.png; fall back to the photoreal skin PNG (never crush it)."""
    names = []
    if cfg.get("ai_body"):
        p = cfg["ai_body"]
        names.append(p if os.path.isabs(p) else os.path.join(SKINS_DIR, p))
    if wood == "amber":
        names.append(SRC_AI_BODY)
    else:
        names.append(os.path.join(SKINS_DIR, f"muyu-premium-{wood}-ai.png"))
    names.append(src_fish)
    seen: set[str] = set()
    for p in names:
        ap = os.path.normcase(os.path.abspath(p))
        if ap in seen:
            continue
        seen.add(ap)
        if os.path.isfile(p):
            return p
    return None


def mix_hf_grain(dst_rgb: np.ndarray, donor_rgb: np.ndarray, alpha: np.ndarray, amount: float) -> np.ndarray:
    """Add high-frequency luminance from a donor (amber AI) without shifting hue."""
    if amount <= 0:
        return dst_rgb
    fg = alpha > 24
    dlab = cv2.cvtColor(donor_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    blab = cv2.cvtColor(dst_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    dL = dlab[:, :, 0]
    hf = dL - cv2.GaussianBlur(dL, (0, 0), 1.8)
    blab[:, :, 0] = np.clip(blab[:, :, 0] + hf * amount, 0, 255)
    out = cv2.cvtColor(blab.astype(np.uint8), cv2.COLOR_LAB2RGB)
    out[~fg] = 0
    return out


def run_v3_wood(wood: str) -> None:
    cfg = PREMIUM_WOODS[wood]
    global V3
    V3 = cfg["v3"]
    src_fish = os.path.join(SKINS_DIR, cfg["fish"])
    src_mallet = os.path.join(SKINS_DIR, cfg["mallet"])
    prefix = cfg["prefix"]
    ai_body = resolve_ai_body(wood, cfg, src_fish)

    os.makedirs(OUT_DIR, exist_ok=True)
    fish = np.array(Image.open(src_fish).convert("RGBA"))
    canvas = resize_canvas(fish, OUT_W, OUT_H)
    ref_rgb, alpha = canvas[:, :, :3], canvas[:, :, 3]

    used_ai = False
    if ai_body:
        ai = load_rgb_ai(ai_body)
        fg = flood_foreground(ai, thresh=22)
        aligned = align_rgb_to_mask(ai, fg, canvas, boost=cfg.get("align_boost", 1.04))
        body_rgb = aligned[:, :, :3]
        used_ai = True
        print(f"[{wood}] body: AI {os.path.basename(ai_body)} IoU {round(iou(aligned[:, :, 3], alpha), 4)}")
    else:
        print(f"[{wood}] body: procedural v3")
        body_rgb = enhance_body_v3_procedural(ref_rgb, alpha)

    la, lb, lmul = cfg["lab"]
    if used_ai:
        body_rgb = pop_grain(body_rgb, alpha, cfg.get("ai_pop", 0.16), tint=False)
        body_rgb = deepen_mouth(body_rgb, alpha, ref_rgb, mouth_depth=cfg.get("ai_mouth", 0.10))
        if wood != "amber" and os.path.isfile(SRC_AI_BODY):
            donor = load_rgb_ai(SRC_AI_BODY)
            dfg = flood_foreground(donor, thresh=22)
            d_al = align_rgb_to_mask(donor, dfg, canvas, boost=1.02)
            body_rgb = mix_hf_grain(body_rgb, d_al[:, :, :3], alpha, 0.18 if wood == "jade" else 0.28)
    else:
        body_rgb = pop_grain(body_rgb, alpha, V3["grain_strength"], tint=True)
        body_rgb = deepen_mouth(body_rgb, alpha, ref_rgb, V3["mouth_depth"])
        h, w = body_rgb.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        light = np.clip(0.92 + 0.12 * (1 - yy / h) + 0.08 * (1 - xx / w), 0.80, 1.08)
        body_rgb = np.clip(body_rgb.astype(np.float32) * light[:, :, None], 0, 255).astype(np.uint8)
    if la or lb or lmul != 1.0:
        body_rgb = tint_wood_lab(body_rgb, alpha, la, lb, lmul)
    body_rgb[alpha <= 32] = 0
    body = np.dstack([body_rgb, alpha])

    shade = build_shade_v3(alpha, body_rgb)
    spec = build_spec_v3(alpha, body_rgb)
    ground = build_ground_v3(alpha)
    rim = build_rim_v3(alpha)
    if wood == "amber":
        mallet = build_mallet_v3()
        if mallet is None:
            mallet = build_mallet_from_png(src_mallet, darken=cfg["mallet_darken"])
    else:
        mallet = build_mallet_from_png(src_mallet, darken=cfg["mallet_darken"])

    png_body = OUT_BODY_PNG if prefix == "muyu-premium" else os.path.join(SKINS_DIR, f"{prefix}-body.png")
    Image.fromarray(body).save(png_body, "PNG")
    print("updated", png_body)
    if mallet is not None:
        png_mallet = OUT_MALLET_PNG if prefix == "muyu-premium" else os.path.join(SKINS_DIR, f"{prefix}-mallet.png")
        Image.fromarray(mallet).save(png_mallet, "PNG")
        print("updated", png_mallet)

    def layer(name_suffix: str, arr, q0, cap):
        return (f"{prefix}-{name_suffix}.webp", arr, q0, cap)

    layers = [
        layer("body", body, 82, BODY_CAP_KB),
        layer("shade", compact_overlay(shade, 320, 240), 74, 6),
        layer("spec", compact_overlay(spec, 320, 240), 72, 4),
        layer("ground", compact_overlay(ground, 320, 240), 72, 3),
        layer("rim", compact_overlay(rim, 320, 240, a_steps=10), 72, 2),
    ]
    if mallet is not None:
        layers.append((f"{prefix}-mallet.webp", mallet, 80, 8))

    for name, arr, q0, cap in layers:
        p = os.path.join(OUT_DIR, name)
        q = save_webp_under(arr, p, cap, q0=q0, qmin=58)
        print(f"  {name:36s} {os.path.getsize(p)/1024:6.1f} KB  q={q}")

    total = sum(os.path.getsize(os.path.join(OUT_DIR, n)) for n, *_ in layers)
    print(f"  [{wood}] subtotal {total/1024:.1f} KB")


def premium_webp_total() -> float:
    if not os.path.isdir(OUT_DIR):
        return 0.0
    return sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR) if f.endswith(".webp")) / 1024.0


def enforce_total_budget(max_kb: float = TOTAL_BUDGET_KB) -> None:
    """Recompress largest body WebPs until the premium folder fits."""
    total = premium_webp_total()
    if total <= max_kb:
        return
    bodies = sorted(
        (os.path.join(OUT_DIR, f) for f in os.listdir(OUT_DIR) if f.endswith("-body.webp")),
        key=lambda p: os.path.getsize(p),
        reverse=True,
    )
    for path in bodies:
        total = premium_webp_total()
        if total <= max_kb:
            break
        im = np.array(Image.open(path).convert("RGBA"))
        need = os.path.getsize(path) / 1024.0 - (total - max_kb) - 0.5
        cap = max(28.0, need)
        q = save_webp_under(im, path, cap, q0=70, qmin=48)
        print(f"  budget {os.path.basename(path)} -> {os.path.getsize(path)/1024:.1f} KB q={q}")
    print(f"  after budget {premium_webp_total():.1f} KB (cap {max_kb})")


def clear_old_test_dir() -> None:
    if not os.path.isdir(OLD_OUT_DIR):
        return
    for name in os.listdir(OLD_OUT_DIR):
        if name.endswith(".webp"):
            os.remove(os.path.join(OLD_OUT_DIR, name))
    try:
        os.rmdir(OLD_OUT_DIR)
    except OSError:
        pass
    print("cleared", OLD_OUT_DIR)


def run_v3() -> None:
    for wood in PREMIUM_WOODS:
        run_v3_wood(wood)
    enforce_total_budget()
    clear_old_test_dir()
    print(f"premium/ all webp {premium_webp_total():.1f} KB")


def main() -> None:
    ap = argparse.ArgumentParser(description="Build premium muyu webp layers")
    ap.add_argument("--v2", action="store_true", help="legacy amber-enhance pipeline")
    ap.add_argument("--v3", action="store_true", help="photoreal AI + 3D layers (default)")
    ap.add_argument(
        "--wood",
        choices=list(PREMIUM_WOODS.keys()),
        action="append",
        help="build one wood (repeatable); default all",
    )
    args = ap.parse_args()
    if args.v2:
        run_v2()
        return
    if args.wood:
        for w in args.wood:
            run_v3_wood(w)
        enforce_total_budget()
        clear_old_test_dir()
        print(f"premium/ all webp {premium_webp_total():.1f} KB")
        return
    run_v3()


if __name__ == "__main__":
    main()
