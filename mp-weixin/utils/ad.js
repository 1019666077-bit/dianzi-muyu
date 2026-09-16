const launch = require("../config/launch");

let videoAd = null;
let inited = false;

function canUseRealAd(adUnitId) {
  const unit = adUnitId || launch.REWARDED_AD_UNIT_ID;
  return !launch.IS_TOURIST && !!unit;
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

  if (!videoAd) {
    wx.showToast({ title: "开发版：已跳过广告", icon: "none" });
    if (typeof onSuccess === "function") onSuccess();
    return;
  }

  const fail = (title) => {
    wx.showToast({ title: title || "广告暂时无法播放", icon: "none" });
    if (typeof onFail === "function") onFail();
  };

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
};
