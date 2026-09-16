const launch = require("../../config/launch");
const { initRewardedAd, watchRewarded } = require("../../utils/ad");
const merit = require("../../utils/merit");

const AUTO_MS = 5 * 60 * 1000;
const FAST_AUTO_INTERVAL = 550;
const SLOW_AUTO_INTERVAL = 1200;
const STATUS_IDLE = "轻点解压 · 数据仅存本机";
const VISIBLE_BEADS = 6;
const BEAD_PX = 64;
const BEAD_COMMIT = 28;

const MODE_NAMES = { muyu: "木鱼", beads: "念珠", bowl: "颂钵" };
const HINTS = {
  muyu: "轻点木鱼 · 槌从右上敲下去",
  beads: "往下滑 · 拨过一颗",
  bowl: "轻点颂钵 · 槌敲钵沿",
};
const SKINS = {
  muyu: [
    {
      id: "amber",
      name: "樟木",
      free: true,
      premium: true,
      body: "premium/muyu-premium-body.webp",
      shade: "premium/muyu-premium-shade.webp",
      spec: "premium/muyu-premium-spec.webp",
      ground: "premium/muyu-premium-ground.webp",
      rim: "premium/muyu-premium-rim.webp",
      mallet: "premium/muyu-premium-mallet.webp",
    },
    {
      id: "jade",
      name: "花梨",
      free: true,
      premium: true,
      body: "premium/muyu-premium-jade-body.webp",
      shade: "premium/muyu-premium-jade-shade.webp",
      spec: "premium/muyu-premium-jade-spec.webp",
      ground: "premium/muyu-premium-jade-ground.webp",
      rim: "premium/muyu-premium-jade-rim.webp",
      mallet: "premium/muyu-premium-jade-mallet.webp",
    },
    {
      id: "inkgold",
      name: "紫檀",
      free: false,
      premium: true,
      body: "premium/muyu-premium-inkgold-body.webp",
      shade: "premium/muyu-premium-inkgold-shade.webp",
      spec: "premium/muyu-premium-inkgold-spec.webp",
      ground: "premium/muyu-premium-inkgold-ground.webp",
      rim: "premium/muyu-premium-inkgold-rim.webp",
      mallet: "premium/muyu-premium-inkgold-mallet.webp",
    },
  ],
  beads: [
    { id: "wood", name: "檀木", free: true, bead: "bead-wood.webp" },
    { id: "jade", name: "青玉", free: true, bead: "bead-jade.webp" },
    { id: "rosewood", name: "紫檀", free: false, bead: "bead-rosewood.webp" },
  ],
  bowl: [
    { id: "brass", name: "黄铜", free: true, body: "bowl-brass.webp", mallet: "bowl-mallet-brass.webp" },
    { id: "gold", name: "鎏金", free: true, body: "bowl-gold.webp", mallet: "bowl-mallet-gold.webp" },
    { id: "iron", name: "乌金", free: false, body: "bowl-iron.webp", mallet: "bowl-mallet-iron.webp" },
  ],
};
const FREE_UNLOCKS = ["muyu-amber", "muyu-jade", "beads-wood", "beads-jade", "bowl-brass", "bowl-gold"];

function asset(file) {
  return "/assets/skins/" + file;
}

const MUYU_LEGACY_ID = {
  "premium-test": "amber",
  "premium-jade": "jade",
  "premium-inkgold": "inkgold",
};

function normalizeSkinId(kind, id) {
  if (kind === "muyu" && MUYU_LEGACY_ID[id]) return MUYU_LEGACY_ID[id];
  return id;
}

function findSkin(kind, id) {
  const list = SKINS[kind] || [];
  const sid = normalizeSkinId(kind, id);
  return list.find((x) => x.id === sid) || list[0];
}

function makeBeads() {
  const arr = [];
  for (let i = 0; i < VISIBLE_BEADS + 2; i++) {
    arr.push({ id: i, rotate: (i * 41) % 360 });
  }
  return arr;
}

Page({
  data: {
    mode: "muyu",
    modeName: "木鱼",
    hint: HINTS.muyu,
    todayMerit: 0,
    total: 0,
    status: STATUS_IDLE,
    autoOn: false,
    slowAutoOn: false,
    fastAutoOn: false,
    muyuBody: asset("premium/muyu-premium-body.webp"),
    muyuMallet: asset("premium/muyu-premium-mallet.webp"),
    muyuShade: asset("premium/muyu-premium-shade.webp"),
    muyuSpec: asset("premium/muyu-premium-spec.webp"),
    muyuGround: asset("premium/muyu-premium-ground.webp"),
    muyuRim: asset("premium/muyu-premium-rim.webp"),
    bowlBody: asset("bowl-brass.webp"),
    bowlMallet: asset("bowl-mallet-brass.webp"),
    bowlFlip: true,
    beadSrc: asset("bead-wood.webp"),
    beads: makeBeads(),
    beadOffset: 0,
    beadDropping: false,
    floats: [],
    skinShow: false,
    skinList: [],
    skinGroups: [],
    currentSkin: "amber",
    isTourist: launch.IS_TOURIST,
    bodyHit: false,
    muyuSwing: false,
    muyuFlash: false,
    bowlSwing: false,
    bowlFlash: false,
    bowlRipple: false,
    statusPad: 48,
  },

  onLoad() {
    this.initSafeArea();
    initRewardedAd();
    this.state = merit.getState(getApp(), FREE_UNLOCKS);
    if (merit.rollover(this.state)) this.save();
    const app = getApp();
    if (app.globalData.freshLaunch) {
      merit.resetSession(this.state);
      app.globalData.freshLaunch = false;
      this.save();
    }
    this.slowAutoOn = false;
    this.floatId = 0;
    this.lastTapAt = 0;
    this.beadBusy = false;
    this.pendingAd = null;
    this.autoTimer = null;
    this.autoTick = null;
    this.beadDrag = null;
    this.audios = {};
    ["muyu", "beads", "bowl"].forEach((k) => {
      const a = wx.createInnerAudioContext();
      a.obeyMuteSwitch = false;
      a.src = "/assets/sfx/" + k + ".wav";
      this.audios[k] = a;
    });
    this.applyAllSkins();
    this.syncMeritUI();
    this.restartAutoLoop();
  },

  onShow() {
    this.state = merit.getState(getApp(), FREE_UNLOCKS);
    if (merit.rollover(this.state)) this.save();
    this.syncMeritUI();
    this.restartAutoLoop();
  },

  initSafeArea() {
    try {
      const menu = wx.getMenuButtonBoundingClientRect();
      const pad = menu.bottom + 8;
      if (pad > 20 && pad < 120) this.setData({ statusPad: pad });
    } catch (e) {}
  },

  onUnload() {
    this.slowAutoOn = false;
    this.clearAutoTimers();
    Object.keys(this.audios || {}).forEach((k) => {
      try { this.audios[k].destroy(); } catch (e) {}
    });
  },

  onShareAppMessage() {
    const n = (this.state && this.state.todayMerit) || 0;
    return {
      title: "今日敲击 " + n + " 次 · 电子木鱼",
      path: "/pages/index/index",
      imageUrl: "/assets/share-cover.webp",
    };
  },

  syncMeritUI() {
    this.setData({ todayMerit: this.state.todayMerit, total: this.state.total });
  },

  openStats() {
    wx.navigateTo({ url: "/pages/stats/stats" });
  },

  onRailResetSession() {
    wx.showModal({
      title: "重置本次功德",
      content: "将本次功德清零，今日与总计不受影响。",
      confirmColor: "#c9a227",
      success: (res) => {
        if (!res.confirm) return;
        merit.resetSession(this.state);
        this.save();
        wx.showToast({ title: "已重置本次", icon: "none" });
      },
    });
  },

  onRailAuto() {
    if (this.autoRemaining() > 0) {
      wx.showModal({
        title: "自动敲",
        content: "当前为视频快敲。可关闭快敲，或使用底部「自动敲」开启免费慢敲。",
        confirmText: "关闭快敲",
        cancelText: "慢敲开关",
        confirmColor: "#c9a227",
        success: (res) => {
          if (res.confirm) this.stopFastAuto();
          else this.onToggleSlowAuto();
        },
      });
      return;
    }
    this.onToggleSlowAuto();
  },

  save() {
    const app = getApp();
    const write = () => merit.saveToStorage(this.state);
    if (app && typeof app.whenPrivacy === "function") {
      app.whenPrivacy((agreed) => {
        if (agreed) write();
      });
      return;
    }
    write();
  },

  isUnlocked(kind, id) {
    const s = findSkin(kind, id);
    if (!s) return false;
    if (s.free) return true;
    return this.state.unlockedSkins.indexOf(kind + "-" + id) >= 0;
  },

  applySkin(kind, id) {
    const s = findSkin(kind, id);
    if (!s) return;
    this.state.skins[kind] = s.id;
    const patch = {};
    if (kind === "muyu") {
      patch.muyuBody = asset(s.body);
      patch.muyuMallet = asset(s.mallet);
      patch.muyuShade = s.shade ? asset(s.shade) : "";
      patch.muyuSpec = s.spec ? asset(s.spec) : "";
      patch.muyuGround = s.ground ? asset(s.ground) : "";
      patch.muyuRim = s.rim ? asset(s.rim) : "";
    } else if (kind === "beads") {
      patch.beadSrc = asset(s.bead);
    } else if (kind === "bowl") {
      patch.bowlBody = asset(s.body);
      patch.bowlMallet = asset(s.mallet);
      patch.bowlFlip = s.id === "brass";
    }
    this.save();
    this.setData(patch);
    this.renderSkinGrid();
  },

  applyAllSkins() {
    this.applySkin("muyu", this.state.skins.muyu);
    this.applySkin("beads", this.state.skins.beads);
    this.applySkin("bowl", this.state.skins.bowl);
  },

  play(kind) {
    const a = this.audios[kind];
    if (!a) return;
    try {
      a.stop();
      a.seek(0);
      a.play();
    } catch (e) {
      try { a.play(); } catch (e2) {}
    }
  },

  bump(kind) {
    merit.recordTap(this.state, kind);
    this.save();
    this.syncMeritUI();
    this.floatText();
    this.play(kind);
    wx.vibrateShort({ type: "light" });
    this.maybeShowMyMiniProgramHint();
  },

  maybeShowMyMiniProgramHint() {
    if (this.state.todayMerit !== 1 && this.state.total !== 1) return;
    let shown = false;
    try {
      const o = wx.getStorageSync("dianzi-muyu-hints") || {};
      shown = !!o.myMiniProgramShown;
    } catch (e) {
      shown = false;
    }
    if (shown) return;
    wx.showModal({
      title: "方便下次找到",
      content: "点击右上角 ··· → 添加到我的小程序，可从下拉任务栏快速打开。",
      confirmColor: "#c9a227",
      complete: () => {
        try {
          wx.setStorageSync("dianzi-muyu-hints", { myMiniProgramShown: true });
        } catch (e) {}
      },
    });
  },

  floatText() {
    const id = ++this.floatId;
    const mode = this.data.mode;
    let left = 48;
    let top = 38;
    if (mode === "muyu") {
      left = 44 + Math.random() * 10;
      top = 26 + Math.random() * 6;
    } else if (mode === "bowl") {
      left = 42 + Math.random() * 12;
      top = 32;
    } else {
      left = 38 + Math.random() * 16;
      top = 40;
    }
    const floats = this.data.floats.concat([{ id, text: "+1", left, top }]);
    this.setData({ floats });
    setTimeout(() => {
      this.setData({ floats: this.data.floats.filter((x) => x.id !== id) });
    }, 1000);
  },

  restart(flag, ms) {
    this.setData({ [flag]: false });
    setTimeout(() => {
      this.setData({ [flag]: true });
      setTimeout(() => this.setData({ [flag]: false }), ms);
    }, 16);
  },

  onTapMuyu() {
    const now = Date.now();
    if (now - this.lastTapAt < 90) return;
    this.lastTapAt = now;
    this.bump("muyu");
    this.restart("bodyHit", 320);
    this.restart("muyuSwing", 260);
    this.restart("muyuFlash", 380);
  },

  onTapBowl() {
    const now = Date.now();
    if (now - this.lastTapAt < 90) return;
    this.lastTapAt = now;
    this.bump("bowl");
    this.restart("bodyHit", 320);
    this.restart("bowlSwing", 320);
    this.restart("bowlFlash", 420);
    this.restart("bowlRipple", 840);
  },

  commitBead() {
    const beads = this.data.beads.slice();
    const last = beads.pop();
    last.rotate = Math.floor(Math.random() * 360);
    beads.unshift(last);
    this.setData({ beads });
    this.bump("beads");
  },

  autoCommitBead() {
    if (this.beadDrag || this.data.beadDropping) {
      this.commitBead();
      return;
    }
    this.setData({ beadDropping: true, beadOffset: BEAD_PX * 0.5 });
    setTimeout(() => {
      this.commitBead();
      this.setData({ beadOffset: 0 });
      setTimeout(() => this.setData({ beadDropping: false }), 200);
    }, 80);
  },

  touchPoint(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    return t || null;
  },

  onBeadStart(e) {
    if (this.beadBusy) return;
    const t = this.touchPoint(e);
    if (!t) return;
    this.beadDrag = { y: t.clientY, acc: 0 };
  },

  onBeadMove(e) {
    if (!this.beadDrag) return;
    const t = this.touchPoint(e);
    if (!t) return;
    const dy = t.clientY - this.beadDrag.y;
    this.beadDrag.y = t.clientY;
    if (dy > 0) this.beadDrag.acc += dy;
    else this.beadDrag.acc = Math.max(0, this.beadDrag.acc + dy * 0.25);
    while (this.beadDrag.acc >= BEAD_PX) {
      this.beadDrag.acc -= BEAD_PX;
      this.commitBead();
    }
    this.setData({ beadOffset: this.beadDrag.acc, beadDropping: false });
  },

  onBeadEnd() {
    if (!this.beadDrag) return;
    if (this.beadDrag.acc >= BEAD_COMMIT) this.commitBead();
    this.beadDrag = null;
    this.setData({ beadDropping: true, beadOffset: 0 });
    setTimeout(() => this.setData({ beadDropping: false }), 200);
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.tab;
    this.setData({
      mode,
      modeName: MODE_NAMES[mode],
      hint: HINTS[mode],
      skinShow: false,
    });
    this.renderSkinGrid();
  },

  renderSkinGrid() {
    const mode = this.data.mode;
    const list = (SKINS[mode] || []).map((s) => ({
      id: s.id,
      name: s.name,
      unlocked: this.isUnlocked(mode, s.id),
      thumb: asset(s.body || s.bead || s.mallet),
    }));
    const groups = [{ gid: "all", label: "", items: list }];
    this.setData({
      skinList: list,
      skinGroups: groups,
      currentSkin: this.state.skins[mode],
    });
  },

  openSkin() {
    this.renderSkinGrid();
    this.setData({ skinShow: true });
  },
  closeSkin() { this.setData({ skinShow: false }); },
  noop() {},

  firstLockedSkin() {
    const mode = this.data.mode;
    return (SKINS[mode] || []).find((s) => !this.isUnlocked(mode, s.id));
  },

  pickSkin(e) {
    const id = e.currentTarget.dataset.id;
    const mode = this.data.mode;
    if (!this.isUnlocked(mode, id)) {
      this.setData({ skinShow: false });
      this.showAd("skin");
      return;
    }
    this.applySkin(mode, id);
  },

  onToggleSlowAuto() {
    this.slowAutoOn = !this.slowAutoOn;
    this.restartAutoLoop();
  },

  onAdAuto() {
    if (this.autoRemaining() > 0) {
      wx.showModal({
        title: "关闭快敲？",
        content: "将停止视频解锁的 5 分钟快敲；若已开启「自动敲」慢敲，会继续以较慢节奏敲击。",
        confirmText: "关闭快敲",
        confirmColor: "#c9a227",
        success: (res) => {
          if (res.confirm) this.stopFastAuto();
        },
      });
      return;
    }
    this.showAd("auto");
  },
  onAdSkin() {
    if (!this.firstLockedSkin()) {
      wx.showToast({ title: "当前模式皮肤已全部解锁", icon: "none" });
      return;
    }
    this.showAd("skin");
  },

  showAd(reward) {
    if (reward === "auto" && !merit.canGrantAuto(this.state)) {
      this.save();
      wx.showToast({
        title: "今日快敲次数已用完（2/2），明天再来；慢敲仍免费",
        icon: "none",
        duration: 2500,
      });
      return;
    }
    if (reward === "skin" && !merit.canGrantSkin(this.state)) {
      this.save();
      wx.showToast({
        title: "今日皮肤视频次数已用完（3/3），明天再来",
        icon: "none",
        duration: 2500,
      });
      return;
    }
    this.save();
    this.pendingAd = reward;
    watchRewarded({
      onSuccess: () => this.finishAd(),
      onFail: () => {
        this.pendingAd = null;
      },
    });
  },

  finishAd() {
    if (this.pendingAd === "auto") this.grantAuto();
    else if (this.pendingAd === "skin") this.grantSkin();
    this.pendingAd = null;
  },

  grantAuto() {
    merit.recordGrantAuto(this.state);
    this.state.autoUntil = Date.now() + AUTO_MS;
    this.save();
    this.restartAutoLoop();
  },

  stopFastAuto() {
    this.state.autoUntil = 0;
    this.save();
    this.restartAutoLoop();
  },

  grantSkin() {
    const mode = this.data.mode;
    const pick = this.firstLockedSkin();
    if (!pick) {
      wx.showToast({ title: "当前模式皮肤已全部解锁", icon: "none" });
      return;
    }
    merit.recordGrantSkin(this.state);
    if (!this.isUnlocked(mode, pick.id)) {
      this.state.unlockedSkins.push(mode + "-" + pick.id);
    }
    this.applySkin(mode, pick.id);
  },

  autoRemaining() {
    return Math.max(0, this.state.autoUntil - Date.now());
  },

  updateAutoStatus() {
    const left = this.autoRemaining();
    const fast = left > 0;
    if (fast) {
      const sec = Math.ceil(left / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      this.setData({
        autoOn: true,
        fastAutoOn: true,
        slowAutoOn: this.slowAutoOn,
        status: "视频快敲中 · 剩余 " + m + ":" + String(s).padStart(2, "0"),
      });
    } else if (this.slowAutoOn) {
      this.setData({
        autoOn: true,
        fastAutoOn: false,
        slowAutoOn: true,
        status: "自动慢敲中 · 可点「视频·快敲」加速",
      });
    } else {
      merit.normalizeAdQuota(this.state);
      const usedFastToday = (this.state.adGrantAutoCount || 0) > 0;
      this.setData({
        autoOn: false,
        fastAutoOn: false,
        slowAutoOn: false,
        status: usedFastToday
          ? "今日快敲已结束 · 明天可再看视频续 5 分钟 · 慢敲仍可用"
          : STATUS_IDLE,
      });
    }
  },

  restartAutoLoop() {
    this.clearAutoTimers();
    const fast = this.autoRemaining() > 0;
    if (!fast && !this.slowAutoOn) {
      this.updateAutoStatus();
      return;
    }
    const ms = fast ? FAST_AUTO_INTERVAL : SLOW_AUTO_INTERVAL;
    this.autoTimer = setInterval(() => {
      const mode = this.data.mode;
      if (mode === "muyu") this.onTapMuyu();
      else if (mode === "bowl") this.onTapBowl();
      else this.autoCommitBead();
    }, ms);
    if (fast) {
      this.autoTick = setInterval(() => {
        if (this.autoRemaining() <= 0) this.restartAutoLoop();
        else this.updateAutoStatus();
      }, 500);
    }
    this.updateAutoStatus();
  },

  clearAutoTimers() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    if (this.autoTick) {
      clearInterval(this.autoTick);
      this.autoTick = null;
    }
  },
});
