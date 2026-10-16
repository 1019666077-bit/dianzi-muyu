/**
 * Share-card copy and wiring. Does not run WeChat DevTools.
 *
 * Run: node mp-weixin/scripts/assert-share.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const share = require("../utils/share");
const indexJs = fs.readFileSync(path.join(root, "pages/index/index.js"), "utf8");
const statsJs = fs.readFileSync(path.join(root, "pages/stats/stats.js"), "utf8");
const packKeepJs = fs.readFileSync(path.join(root, "pages/pack-keep/pack-keep.js"), "utf8");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(typeof share.shareTitle === "function", "shareTitle export");
assert(share.INDEX_PATH === "/pages/index/index", "landing path is index");
assert(share.SHARE === "/assets/share-cover.jpg", "cover stays share-cover.jpg");

const zero = share.shareTitle(0);
const n = share.shareTitle(128);
assert(zero.indexOf("解压") >= 0, "zero title has 解压");
assert(zero.indexOf("敲木鱼") >= 0, "zero title has 敲木鱼");
assert(zero.indexOf("天天敲木鱼") >= 0 || zero.indexOf("小憩") >= 0, "zero title aligns with product name");
assert(zero.indexOf("电子木鱼") < 0, "zero title drops 电子木鱼");
assert(n.indexOf("128") >= 0, "count title keeps today hits");
assert(n.indexOf("解压") >= 0, "count title has 解压");
assert(n.indexOf("敲木鱼") >= 0, "count title has 敲木鱼");
assert(n.indexOf("小憩") >= 0 || n.indexOf("天天敲木鱼") >= 0, "count title aligns with product name");
assert(n.indexOf("电子木鱼") < 0, "count title drops 电子木鱼");

["积福", "消业", "开光", "往生", "法事"].forEach((w) => {
  assert(zero.indexOf(w) < 0 && n.indexOf(w) < 0, "no religious promise: " + w);
});

const card = share.appMessage(7);
assert(card.title === share.shareTitle(7), "app message title");
assert(card.path === share.INDEX_PATH, "app message path");
assert(card.imageUrl === share.SHARE, "app message cover");

const tl = share.timeline(7);
assert(tl.title === share.shareTitle(7), "timeline title matches friend card");
assert(tl.imageUrl === share.SHARE, "timeline cover matches friend card");
assert(tl.query === "", "timeline has no extra query");

assert(indexJs.indexOf("require(\"../../utils/share\")") >= 0, "index uses share util");
assert(/\bonShareAppMessage\s*\(/.test(indexJs), "index has onShareAppMessage");
assert(/\bonShareTimeline\s*\(/.test(indexJs), "index has onShareTimeline");
assert(indexJs.indexOf("今日敲击") < 0, "index dropped old 今日敲击 title");
assert(indexJs.indexOf("电子木鱼") < 0, "index.js no longer hardcodes 电子木鱼");

assert(statsJs.indexOf("require(\"../../utils/share\")") >= 0, "stats uses share util");
assert(/\bonShareAppMessage\s*\(/.test(statsJs), "stats has onShareAppMessage");
assert(!/\bonShareTimeline\s*\(/.test(statsJs), "stats omits onShareTimeline (cannot customize path)");

assert(!/\bonShareAppMessage\s*\(/.test(packKeepJs), "pack-keep is not shareable");
assert(!/\bonShareTimeline\s*\(/.test(packKeepJs), "pack-keep has no timeline share");

assert(share.todayCount({ state: { todayMerit: 9 } }) === 9, "todayCount from state");
assert(share.todayCount({ data: { todayMerit: 3 } }) === 3, "todayCount from data");
assert(share.todayCount({}) === 0, "todayCount fallback");

console.log("assert-share: ok");
console.log("zero:", zero);
console.log("count:", n);
