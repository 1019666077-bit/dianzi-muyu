const launch = require("../config/launch");

let videoAd = null;
let inited = false;

/**
 * 激励视频发奖策略（纯函数，便于自测）。
 * - 正式 AppID + 非空广告位 → 播真广告
 * - 游客号 + ALLOW_DEV_AD_SKIP === true → 开发跳过并发奖
 * - 其余一律拒绝发奖（fail-closed）
 */
function resolveRewardedGrant(opts) {
  const cfg = opts || {};
  const isTourist = cfg.isTourist === true;
  const unit = String(cfg.adUnitId || "").trim();
  const allowDevAdSkip = cfg.allowDevAdSkip === true;
  if (!isTourist && unit) {
    return { action: "play", reason: "ok" };
  }
  if (isTourist && allowDevAdSkip) {
    return { action: "skip", toast: "开发版：已跳过广告", reason: "ok" };
  }
  if (isTourist) {
    return { action: "refuse", toast: "当前为开发游客号，无法验证广告", reason: "tourist" };
  }
  return { action: "refuse", toast: "广告未配置", reason: "no_unit" };
}

/** 给用户看的短文案（无「游客号」「未配置」等开发词） */
function userMessageForPolicy(policy) {
  if (!policy) return "视频暂不可用，敲击与慢敲仍免费";
  if (policy.action === "play") return "";
  if (policy.action === "skip") return policy.toast || "开发版：已跳过广告";
  if (policy.reason === "tourist") return "正式版开放后，可看视频加速";
  if (policy.reason === "no_unit") return "视频功能接入中，请稍后再试";
  return "视频暂不可用，敲击与慢敲仍免费";
}

function currentGrantPolicy(adUnitId) {
  return resolveRewardedGrant({
    isTourist: launch.IS_TOURIST,
    adUnitId: adUnitId || launch.REWARDED_AD_UNIT_ID,
    allowDevAdSkip: launch.ALLOW_DEV_AD_SKIP === true,
  });
}

function canUseRealAd(adUnitId) {
  return currentGrantPolicy(adUnitId).action === "play";
}

function initRewardedAd(adUnitId) {
  const unit = adUnitId || launch.REWARDED_AD_UNIT_ID;
  videoAd = null;
  inited = true;
  if (!canUseRealAd(unit)) return null;
  if (typeof wx.createRewardedVideoAd !== "function") return null;
  try {
    videoAd = wx.createRewardedVideoAd({ adUnitId: unit });
    if (videoAd.onError) {
      videoAd.onError((err) => {
        console.warn("rewarded ad error", err);
      });
    }
  } catch (e) {
    videoAd = null;
  }
  return videoAd;
}

function watchRewarded(opts) {
  const onSuccess = opts && opts.onSuccess;
  const onFail = opts && opts.onFail;
  if (!inited) initRewardedAd();

  const fail = (title) => {
    wx.showToast({
      title: title || "广告暂时无法播放",
      icon: "none",
      duration: 2500,
    });
    if (typeof onFail === "function") onFail();
  };

  const policy = currentGrantPolicy();
  if (policy.action === "skip") {
    wx.showToast({ title: policy.toast, icon: "none", duration: 2500 });
    if (typeof onSuccess === "function") onSuccess();
    return;
  }
  if (policy.action !== "play") {
    fail(policy.toast);
    return;
  }
  if (!videoAd) {
    fail("广告不可用");
    return;
  }

  const handleClose = (res) => {
    if (videoAd && typeof videoAd.offClose === "function") {
      videoAd.offClose(handleClose);
    }
    if (res && res.isEnded) {
      if (typeof onSuccess === "function") onSuccess();
    } else {
      fail("需看完视频才能领取");
    }
  };

  try {
    if (typeof videoAd.offClose === "function") videoAd.offClose(handleClose);
    videoAd.onClose(handleClose);
    const show = () => videoAd.show();
    Promise.resolve()
      .then(show)
      .catch(() => videoAd.load().then(show))
      .catch(() => {
        if (typeof videoAd.offClose === "function") videoAd.offClose(handleClose);
        fail("广告加载失败");
      });
  } catch (e) {
    fail("广告不可用");
  }
}

module.exports = {
  initRewardedAd,
  watchRewarded,
  canUseRealAd,
  resolveRewardedGrant,
  currentGrantPolicy,
  userMessageForPolicy,
};
