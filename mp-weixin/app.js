const merit = require("./utils/merit");

function getWeekId() {
  const x = new Date();
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(x.getFullYear(), x.getMonth(), x.getDate() + diff);
  return merit.localDateKey(monday);
}

App({
  globalData: {
    privacyReady: false,
    privacyAgreed: false,
    freshLaunch: true,
    meritState: null,
  },

  onLaunch(options) {
    this._privacyWaiters = [];
    this.globalData.freshLaunch = true;
    this._launchScene = options && options.scene;
    this.recordScene(this._launchScene);
    this.initPrivacy();
  },

  onShow(options) {
    const scene = options && options.scene;
    if (this._launchScene != null && scene === this._launchScene) {
      this._launchScene = null;
      return;
    }
    this.recordScene(scene);
  },

  recordScene(scene) {
    if (scene == null) return;
    this.whenPrivacyWrite(() => {
      const key = "dianzi-muyu-scene-stats";
      const o = wx.getStorageSync(key) || { w: "", counts: {} };
      const week = getWeekId();
      if (o.w !== week) {
        o.w = week;
        o.counts = {};
      }
      const s = String(scene);
      if (s === "1089") o.counts.s1089 = (o.counts.s1089 || 0) + 1;
      else if (s === "1036") o.counts.s1036 = (o.counts.s1036 || 0) + 1;
      else if (s === "1053") o.counts.s1053 = (o.counts.s1053 || 0) + 1;
      else o.counts.other = (o.counts.other || 0) + 1;
      wx.setStorageSync(key, o);
    });
  },

  whenPrivacy(cb) {
    if (typeof cb !== "function") return;
    if (this.globalData.privacyReady) {
      cb(!!this.globalData.privacyAgreed);
      return;
    }
    this._privacyWaiters = this._privacyWaiters || [];
    this._privacyWaiters.push(cb);
  },

  whenPrivacyWrite(fn) {
    this.whenPrivacy((agreed) => {
      if (!agreed || typeof fn !== "function") return;
      try {
        fn();
      } catch (e) {}
    });
  },

  _finishPrivacy(agreed) {
    this.globalData.privacyAgreed = !!agreed;
    this.globalData.privacyReady = true;
    const list = this._privacyWaiters || [];
    this._privacyWaiters = [];
    list.forEach((fn) => {
      try {
        fn(!!agreed);
      } catch (e) {}
    });
  },

  initPrivacy() {
    const finish = (agreed, toast) => {
      this._finishPrivacy(agreed);
      if (toast) {
        wx.showToast({ title: toast, icon: "none" });
      }
    };

    if (typeof wx.getPrivacySetting !== "function") {
      finish(true);
      return;
    }

    wx.getPrivacySetting({
      success: (res) => {
        if (!res.needAuthorization) {
          finish(true);
          return;
        }
        if (typeof wx.requirePrivacyAuthorize !== "function") {
          finish(true);
          return;
        }
        wx.requirePrivacyAuthorize({
          success: () => finish(true),
          fail: () => finish(false, "未同意隐私协议，进度将不保存"),
        });
      },
      fail: () => finish(true),
    });
  },
});
