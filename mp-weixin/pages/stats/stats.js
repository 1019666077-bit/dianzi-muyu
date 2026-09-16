const merit = require("../../utils/merit");

const FREE_UNLOCKS = [
  "muyu-amber", "muyu-jade", "beads-wood", "beads-jade", "bowl-brass", "bowl-gold",
];

Page({
  data: {
    statusPad: 48,
    sessionMerit: 0,
    todayMerit: 0,
    yesterdayMerit: 0,
    total: 0,
    muyu: 0,
    beads: 0,
    bowl: 0,
    streakDays: 0,
    gapHint: "",
    showSceneDebug: false,
    sceneWeek: "",
    scene1089: 0,
    scene1036: 0,
    scene1053: 0,
    sceneOther: 0,
  },

  onLoad() {
    this.titleTapCount = 0;
    this.titleTapTimer = null;
    try {
      const menu = wx.getMenuButtonBoundingClientRect();
      const pad = menu.bottom + 8;
      if (pad > 20 && pad < 120) this.setData({ statusPad: pad });
    } catch (e) {}
  },

  onTitleTap() {
    this.titleTapCount = (this.titleTapCount || 0) + 1;
    if (this.titleTapTimer) clearTimeout(this.titleTapTimer);
    this.titleTapTimer = setTimeout(() => {
      this.titleTapCount = 0;
    }, 1600);
    if (this.titleTapCount < 5) return;
    this.titleTapCount = 0;
    const show = !this.data.showSceneDebug;
    const patch = { showSceneDebug: show };
    if (show) {
      try {
        const o = wx.getStorageSync("dianzi-muyu-scene-stats") || { w: "", counts: {} };
        const c = o.counts || {};
        patch.sceneWeek = o.w || "";
        patch.scene1089 = c.s1089 || 0;
        patch.scene1036 = c.s1036 || 0;
        patch.scene1053 = c.s1053 || 0;
        patch.sceneOther = c.other || 0;
      } catch (e) {
        patch.sceneWeek = "";
        patch.scene1089 = 0;
        patch.scene1036 = 0;
        patch.scene1053 = 0;
        patch.sceneOther = 0;
      }
    }
    this.setData(patch);
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const state = merit.getState(getApp(), FREE_UNLOCKS);
    const changed = merit.rollover(state);
    if (changed) this.save(state);
    this.state = state;
    let gapHint = "";
    const y = state.yesterdayMerit;
    const t = state.todayMerit;
    if (y > 0 && t < y) gapHint = "距昨日还差 " + (y - t);
    else if (y > 0 && t >= y) gapHint = "已超昨日 +" + (t - y);
    this.setData({
      sessionMerit: state.sessionMerit,
      todayMerit: state.todayMerit,
      yesterdayMerit: state.yesterdayMerit,
      total: state.total,
      muyu: state.muyu,
      beads: state.beads,
      bowl: state.bowl,
      streakDays: state.streakDays || 0,
      gapHint,
    });
  },

  save(state) {
    const app = getApp();
    const write = () => merit.saveToStorage(state);
    if (app && typeof app.whenPrivacy === "function") {
      app.whenPrivacy((agreed) => {
        if (agreed) write();
      });
      return;
    }
    write();
  },

  goBack() {
    wx.navigateBack();
  },

  onResetSession() {
    wx.showModal({
      title: "重置本次功德",
      content: "将本次功德清零，今日与总计不受影响。",
      confirmColor: "#c9a227",
      success: (res) => {
        if (!res.confirm) return;
        merit.resetSession(this.state);
        this.save(this.state);
        this.setData({ sessionMerit: 0 });
        wx.showToast({ title: "已重置本次", icon: "none" });
      },
    });
  },

  onResetAll() {
    wx.showModal({
      title: "清空全部功德",
      content: "总功德、今日、昨日、分模式累计将全部清零，不可恢复。皮肤与解锁不受影响。",
      confirmText: "继续",
      confirmColor: "#c9a227",
      success: (res) => {
        if (!res.confirm) return;
        wx.showModal({
          title: "再次确认",
          content: "确定清空全部功德数据？",
          confirmText: "清空",
          confirmColor: "#b04030",
          success: (r2) => {
            if (!r2.confirm) return;
            merit.resetAllMerit(this.state);
            this.save(this.state);
            this.refresh();
            wx.showToast({ title: "已清空", icon: "none" });
          },
        });
      },
    });
  },
});
