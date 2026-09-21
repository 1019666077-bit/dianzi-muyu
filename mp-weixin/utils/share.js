/**
 * 好友转发 / 朋友圈卡片文案。
 * 对齐线上名「天天敲木鱼小憩」，带解压 + 敲木鱼语义；不写积福消业等宗教承诺。
 */
const { SHARE } = require("../config/assets");

const INDEX_PATH = "/pages/index/index";

function todayCount(page) {
  if (page && page.state && typeof page.state.todayMerit === "number") {
    return page.state.todayMerit;
  }
  if (page && page.data && typeof page.data.todayMerit === "number") {
    return page.data.todayMerit;
  }
  return 0;
}

function shareTitle(n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count > 0) {
    return "今日敲了 " + count + " 下 · 解压敲木鱼小憩";
  }
  return "敲木鱼解压一下 · 天天敲木鱼小憩";
}

function appMessage(n) {
  return {
    title: shareTitle(n),
    path: INDEX_PATH,
    imageUrl: SHARE,
  };
}

function timeline(n) {
  return {
    title: shareTitle(n),
    query: "",
    imageUrl: SHARE,
  };
}

module.exports = {
  SHARE,
  INDEX_PATH,
  todayCount,
  shareTitle,
  appMessage,
  timeline,
};
