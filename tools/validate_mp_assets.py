"""Check mp-weixin skin/sfx paths referenced in index.js exist."""
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mp-weixin")
JS = os.path.join(ROOT, "pages", "index", "index.js")
text = open(JS, encoding="utf-8").read()
webps = re.findall(r'"(?:premium/)?[^"]+\.webp"', text)
webps = [w.strip('"') for w in webps]
missing = []
for p in webps:
    if p.startswith("/"):
        fp = os.path.join(ROOT, p.lstrip("/").replace("/", os.sep))
    else:
        fp = os.path.join(ROOT, "assets", "skins", p.replace("/", os.sep))
    if not os.path.isfile(fp):
        missing.append(p)
for sfx in ("muyu.wav", "beads.wav", "bowl.wav"):
    if not os.path.isfile(os.path.join(ROOT, "assets", "sfx", sfx)):
        missing.append("sfx/" + sfx)
if not os.path.isfile(os.path.join(ROOT, "assets", "bg-zen.webp")):
    missing.append("bg-zen.webp")
share_cover = os.path.join(ROOT, "assets", "share-cover.webp")
if not os.path.isfile(share_cover):
    missing.append("share-cover.webp")
else:
    cover_kb = os.path.getsize(share_cover) / 1024.0
    print("share-cover.webp KB:", round(cover_kb, 1))
    if cover_kb > 128:
        missing.append("share-cover.webp>128KB")
size = 0
for dp, _, fs in os.walk(ROOT):
    for f in fs:
        size += os.path.getsize(os.path.join(dp, f))
print("missing:", missing or "none")
print("mp-weixin total MB:", round(size / 1024 / 1024, 2))
