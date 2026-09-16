"""Check mp-weixin skin/sfx paths exist and will pack into upload."""
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mp-weixin")
JS = os.path.join(ROOT, "pages", "index", "index.js")
ASSETS_JS = os.path.join(ROOT, "config", "assets.js")
PACK_WXML = os.path.join(ROOT, "pages", "pack-keep", "pack-keep.wxml")
APP_JSON = os.path.join(ROOT, "app.json")
CFG = os.path.join(ROOT, "project.config.json")
PRIVATE_CFG = os.path.join(ROOT, "project.private.config.json")
PAGE_EXTS = (".js", ".wxml", ".wxss", ".json")

PATH_RE = re.compile(r"""["'](/assets/[^"']+)["']""")
WXML_SRC_RE = re.compile(r"""\ssrc=["'](/assets/[^"']+)["']""")
CONCAT_RE = re.compile(r"""["']/assets/[^"']*["']\s*\+""")


def fail(msg):
    print("FAIL:", msg)
    return 1


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def iter_source_files():
    for dp, _, fs in os.walk(ROOT):
        if os.path.basename(dp) in ("scripts", "branding"):
            continue
        for name in fs:
            if name.endswith(PAGE_EXTS) or name.endswith(".wxss"):
                yield os.path.join(dp, name)


def collect_declared_paths():
    found = []
    for fp in iter_source_files():
        text = open(fp, encoding="utf-8").read()
        for m in PATH_RE.findall(text):
            found.append((m, os.path.relpath(fp, ROOT)))
    return found


def main():
    rc = 0
    missing = []

    cfg = load_json(CFG)
    setting = cfg.get("setting") or {}
    if setting.get("ignoreUploadUnusedFiles") is not False:
        rc = fail("project.config.json setting.ignoreUploadUnusedFiles must be false")
    if setting.get("ignoreDevUnusedFiles") is not False:
        rc = fail("project.config.json setting.ignoreDevUnusedFiles must be false")

    private_cfg = load_json(PRIVATE_CFG) if os.path.isfile(PRIVATE_CFG) else {}
    private_setting = private_cfg.get("setting") or {}
    if private_setting.get("ignoreUploadUnusedFiles") is True:
        rc = fail("project.private.config.json must not re-enable ignoreUploadUnusedFiles")

    pack = cfg.get("packOptions") or {}
    includes = {(x.get("type"), x.get("value")) for x in pack.get("include") or []}
    for need in (
        ("folder", "assets"),
        ("folder", "assets/skins"),
        ("folder", "assets/sfx"),
        ("folder", "assets/ui"),
        ("file", "assets/bg-zen.jpg"),
        ("file", "assets/share-cover.jpg"),
    ):
        if need not in includes:
            rc = fail("packOptions.include missing %s:%s" % need)

    app = load_json(APP_JSON)
    pages = app.get("pages") or []
    if "pages/pack-keep/pack-keep" not in pages:
        rc = fail("app.json must register pages/pack-keep/pack-keep for static packer refs")

    js = open(JS, encoding="utf-8").read()
    assets_js = open(ASSETS_JS, encoding="utf-8").read()
    pack_wxml = open(PACK_WXML, encoding="utf-8").read() if os.path.isfile(PACK_WXML) else ""
    if "function asset(" in js or CONCAT_RE.search(js) or CONCAT_RE.search(assets_js):
        rc = fail("dynamic /assets/ path concatenation is not allowed (upload packer drops files)")
    if ".webp" in js or ".webp" in assets_js:
        rc = fail("runtime code still references .webp (use png/jpg)")

    manifest_paths = PATH_RE.findall(assets_js)
    static_srcs = set(WXML_SRC_RE.findall(pack_wxml))
    for p in manifest_paths:
        if p not in static_srcs:
            rc = fail("pack-keep.wxml missing static src %s" % p)

    declared = collect_declared_paths()
    if not declared:
        rc = fail("no /assets/ paths found in mp-weixin source")

    seen = set()
    for rel_url, src in declared:
        if rel_url in seen:
            continue
        seen.add(rel_url)
        if rel_url.endswith(".webp"):
            rc = fail("webp reference in %s: %s" % (src, rel_url))
        fp = os.path.join(ROOT, rel_url.lstrip("/").replace("/", os.sep))
        if not os.path.isfile(fp):
            missing.append("%s (from %s)" % (rel_url, src))

    share = os.path.join(ROOT, "assets", "share-cover.jpg")
    if os.path.isfile(share):
        cover_kb = os.path.getsize(share) / 1024.0
        print("share-cover.jpg KB:", round(cover_kb, 1))
        if cover_kb > 128:
            missing.append("share-cover.jpg>128KB")
    else:
        missing.append("share-cover.jpg")

    packed_size = 0
    for dp, _, fs in os.walk(ROOT):
        rel = os.path.relpath(dp, ROOT)
        if rel.startswith("assets" + os.sep + "branding") or rel.startswith("scripts"):
            continue
        for f in fs:
            if f.endswith(".md") or f.endswith(".webp"):
                continue
            packed_size += os.path.getsize(os.path.join(dp, f))

    if missing:
        rc = fail("missing: " + ", ".join(missing))
    else:
        print("missing: none")
        print("declared local assets:", len(seen))
        print("pack-keep static srcs:", len(static_srcs))
    print("mp-weixin packed estimate MB:", round(packed_size / 1024 / 1024, 2))
    if packed_size > 2 * 1024 * 1024:
        rc = fail("packed estimate exceeds 2MB main-package limit")
    return rc


if __name__ == "__main__":
    sys.exit(main())
