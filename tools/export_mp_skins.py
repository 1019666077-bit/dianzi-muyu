"""Export classic skins: assets/skins/*.png → mp-weixin/assets/skins/*.webp

Does **not** write 精修 layered WebP. Those are produced by
``tools/build_premium_muyu.py`` into ``mp-weixin/assets/skins/premium/``.

Classic export (this file):
    python tools/export_mp_skins.py
    → mp-weixin/assets/skins/muyu-amber.webp, bead-*.webp, bowl-*.webp, …

Premium layers:
    python tools/build_premium_muyu.py
    → mp-weixin/assets/skins/premium/muyu-premium-*.webp

Width: 800px (or native if already smaller). Quality steps down to fit.
"""
from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "skins")
DST_DIR = os.path.join(ROOT, "mp-weixin", "assets", "skins")
MAX_W = 800
QUALITY0 = 84
QMIN = 64

# Explicit classic set — skip premium AI/body, cushions, and stray composites.
CLASSIC = [
    "muyu-amber.png",
    "muyu-jade.png",
    "muyu-inkgold.png",
    "muyu-mallet-amber.png",
    "muyu-mallet-jade.png",
    "muyu-mallet-inkgold.png",
    "bead-wood.png",
    "bead-jade.png",
    "bead-rosewood.png",
    "bowl-brass.png",
    "bowl-gold.png",
    "bowl-iron.png",
    "bowl-mallet-brass.png",
    "bowl-mallet-gold.png",
    "bowl-mallet-iron.png",
]


def fit_width(im: Image.Image, max_w: int = MAX_W) -> Image.Image:
    if im.width <= max_w:
        return im
    h = max(1, int(round(im.height * (max_w / im.width))))
    return im.resize((max_w, h), Image.Resampling.LANCZOS)


def save_webp(im: Image.Image, path: str, quality: int) -> None:
    im.save(path, "WEBP", quality=quality, method=6)


def export_one(src_name: str) -> None:
    src = os.path.join(SRC_DIR, src_name)
    if not os.path.isfile(src):
        print("skip missing", src_name, file=sys.stderr)
        return
    dst_name = os.path.splitext(src_name)[0] + ".webp"
    dst = os.path.join(DST_DIR, dst_name)
    im = Image.open(src).convert("RGBA")
    im = fit_width(im)
    os.makedirs(DST_DIR, exist_ok=True)
    q = QUALITY0
    while q >= QMIN:
        save_webp(im, dst, q)
        kb = os.path.getsize(dst) / 1024.0
        if kb <= 90:
            break
        q -= 4
    print(f"  {dst_name:28s} {os.path.getsize(dst)/1024:6.1f} KB  q={q}  {im.width}x{im.height}")


def main() -> None:
    os.makedirs(DST_DIR, exist_ok=True)
    print("classic skins →", DST_DIR)
    for name in CLASSIC:
        export_one(name)


if __name__ == "__main__":
    main()
