"""Full-size body/mallet layers, polygon-masked so the stick stays intact."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(r"C:\Users\MOON\Desktop\dianzi-muyu\assets")

JOBS = [
    {
        "src": "muyu.png",
        "body": "muyu-body.png",
        "mallet": "muyu-mallet.png",
        "poly": [
            (468, 398),
            (500, 348),
            (620, 308),
            (790, 268),
            (822, 328),
            (808, 392),
            (690, 438),
            (650, 540),
            (530, 552),
            (455, 478),
        ],
    },
    {
        "src": "bowl.png",
        "body": "bowl-body.png",
        "mallet": "bowl-mallet.png",
        "poly": [
            (575, 275),
            (640, 238),
            (915, 280),
            (930, 360),
            (908, 438),
            (720, 412),
            (568, 348),
        ],
    },
]


def run(job):
    im = Image.open(ROOT / job["src"]).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    mask_img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask_img).polygon(job["poly"], fill=255)
    poly = np.array(mask_img)
    keep = (arr[:, :, 3] > 18) & (poly > 0)

    mallet = arr.copy()
    mallet[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
    mallet[mallet[:, :, 3] == 0, :3] = 0
    Image.fromarray(mallet).save(ROOT / job["mallet"])

    # small dilate so AA fringe leaves with the mallet, without biting the instrument
    fade = np.array(Image.fromarray(keep.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
    body = arr.copy()
    body[:, :, 3] = np.where(fade, 0, body[:, :, 3])
    body[body[:, :, 3] == 0, :3] = 0
    Image.fromarray(body).save(ROOT / job["body"])
    print(job["src"], "mallet", int(keep.sum()))


if __name__ == "__main__":
    for job in JOBS:
        run(job)
