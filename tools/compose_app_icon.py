"""Compose WeChat app icon from in-game muyu layers (no mesh clipping)."""
from __future__ import annotations

import os
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..", "mp-weixin", "assets")
OUT = os.path.join(ROOT, "branding")
SIZE = 512
BG = (13, 10, 6)


def load_rgba(path: str) -> Image.Image:
    return Image.open(path).convert("RGBA")


def scale(im: Image.Image, factor: float) -> Image.Image:
    w = max(1, int(im.width * factor))
    h = max(1, int(im.height * factor))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def alpha_bbox(im: Image.Image):
    return im.getbbox()


def rects_overlap(a, b) -> bool:
    if not a or not b:
        return False
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return not (ax2 < bx1 or ax1 > bx2 or ay2 < by1 or ay1 > by2)


def compose(include_mallet: bool) -> Image.Image:
    # Body + ground only — shade/spec are screen-space overlays and ghost on flat icons.
    layer_paths = [
        "skins/premium/muyu-premium-ground.webp",
        "skins/premium/muyu-premium-body.webp",
    ]
    layers = [load_rgba(os.path.join(ROOT, p)) for p in layer_paths]
    factor = 380 / layers[1].width
    layers = [scale(x, factor) for x in layers]

    ox = (SIZE - layers[1].width) // 2
    oy = int(SIZE * 0.52 - layers[1].height // 2)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for im in layers:
        canvas.alpha_composite(im, (ox, oy))

    fish_bb = alpha_bbox(canvas)

    if include_mallet and fish_bb:
        mallet = load_rgba(os.path.join(ROOT, "skins/premium/muyu-premium-mallet.webp"))
        mallet = scale(mallet, 0.55)
        mallet = mallet.rotate(-25, expand=True, resample=Image.Resampling.BICUBIC)
        fx1, fy1, fx2, fy2 = fish_bb
        mx = int(fx2 - mallet.width * 0.2)
        my = int(fy1 - mallet.height * 0.62)
        mb = mallet.getbbox() or (0, 0, mallet.width, mallet.height)
        for _ in range(40):
            placed = (mx + mb[0], my + mb[1], mx + mb[2], my + mb[3])
            if not rects_overlap(placed, fish_bb):
                break
            my -= 8
            mx += 6
        canvas.alpha_composite(mallet, (mx, my))

    out = Image.new("RGB", (SIZE, SIZE), BG)
    out.paste(canvas, (0, 0), canvas)
    return out


def from_share_cover() -> Image.Image:
    cover = load_rgba(os.path.join(ROOT, "share-cover.webp"))
    w, h = cover.size
    side = min(w, h - 80)
    left = (w - side) // 2
    top = 10
    crop = cover.crop((left, top, left + side, top + side))
    crop = crop.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    out = Image.new("RGB", (SIZE, SIZE), BG)
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = crop.getpixel((x, y))
            if a == 0:
                out.putpixel((x, y), BG)
                continue
            if r < 12 and g < 12 and b < 12:
                out.putpixel((x, y), BG)
                continue
            t = a / 255.0
            out.putpixel(
                (x, y),
                (
                    int(BG[0] * (1 - t) + r * t),
                    int(BG[1] * (1 - t) + g * t),
                    int(BG[2] * (1 - t) + b * t),
                ),
            )
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    icon_layers = compose(include_mallet=False)
    icon512 = from_share_cover()
    path512 = os.path.join(OUT, "app-icon-512.png")
    path144 = os.path.join(OUT, "app-icon-144.png")
    path_layers = os.path.join(OUT, "app-icon-512-layers.png")
    icon512.save(path512, "PNG", optimize=True)
    icon_layers.save(path_layers, "PNG", optimize=True)
    small = icon512.resize((144, 144), Image.Resampling.LANCZOS)
    small = small.filter(ImageFilter.UnsharpMask(radius=0.8, percent=90, threshold=2))
    small.save(path144, "PNG", optimize=True)
    print("wrote", path512, os.path.getsize(path512))
    print("wrote", path144, os.path.getsize(path144))
    print("wrote", path_layers, os.path.getsize(path_layers))


if __name__ == "__main__":
    main()
