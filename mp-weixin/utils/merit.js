const STORAGE_KEY = "dianzi-muyu-v1";
const SCHEMA_VERSION = 3;
const AD_AUTO_DAILY_MAX = 2;
const AD_SKIN_DAILY_MAX = 3;

function localDateKey(d) {
  const x = d || new Date();
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function monthKey(d) {
  return localDateKey(d).slice(0, 7);
}

function daysBetween(a, b) {
  const parse = (s) => {
    const p = s.split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  };
  return Math.round((parse(b) - parse(a)) / 86400000);
}

function rollover(state) {
  const today = localDateKey();
  if (!state.todayDate) {
    state.todayDate = today;
    state.todayMerit = state.todayMerit || 0;
    state.yesterdayMerit = state.yesterdayMerit || 0;
    return false;
  }
  if (state.todayDate === today) return false;
  const diff = daysBetween(state.todayDate, today);
  state.yesterdayMerit = diff === 1 ? state.todayMerit : 0;
  state.todayMerit = 0;
  state.todayDate = today;
  return true;
}

function applyV3Defaults(state, raw) {
  const src = raw || {};
  state.streakDays = typeof src.streakDays === "number" ? src.streakDays : 0;
  state.streakLastDate = typeof src.streakLastDate === "string" ? src.streakLastDate : "";
  state.streakFreezeMonth = typeof src.streakFreezeMonth === "string" ? src.streakFreezeMonth : "";
  state.streakFreezeUsed = !!src.streakFreezeUsed;
  state.adQuotaDate = typeof src.adQuotaDate === "string" && src.adQuotaDate ? src.adQuotaDate : localDateKey();
  state.adGrantAutoCount = typeof src.adGrantAutoCount === "number" ? src.adGrantAutoCount : 0;
  state.adGrantSkinCount = typeof src.adGrantSkinCount === "number" ? src.adGrantSkinCount : 0;
}

function defaultState() {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    total: 0,
    sessionMerit: 0,
    todayDate: localDateKey(),
    todayMerit: 0,
    yesterdayMerit: 0,
    muyu: 0,
    beads: 0,
    bowl: 0,
    skins: { muyu: "amber", beads: "wood", bowl: "brass" },
    unlockedSkins: [],
    autoUntil: 0,
  };
  applyV3Defaults(state, null);
  return state;
}

function migrate(raw, freeUnlocks) {
  if (!raw || typeof raw !== "object") {
    const s = defaultState();
    s.unlockedSkins = freeUnlocks.slice();
    return s;
  }
  const unlocked = Array.isArray(raw.unlockedSkins) ? raw.unlockedSkins : [];
  const state = {
    schemaVersion: SCHEMA_VERSION,
    total: raw.total || 0,
    sessionMerit: typeof raw.sessionMerit === "number" ? raw.sessionMerit : 0,
    todayDate: raw.todayDate || localDateKey(),
    todayMerit: typeof raw.todayMerit === "number" ? raw.todayMerit : 0,
    yesterdayMerit: typeof raw.yesterdayMerit === "number" ? raw.yesterdayMerit : 0,
    muyu: raw.muyu || 0,
    beads: raw.beads || 0,
    bowl: raw.bowl || 0,
    skins: {
      muyu: (raw.skins && raw.skins.muyu) || "amber",
      beads: (raw.skins && raw.skins.beads) || "wood",
      bowl: (raw.skins && raw.skins.bowl) || "brass",
    },
    unlockedSkins: Array.from(
      new Set(
        freeUnlocks.concat(unlocked).map((k) => {
          if (k === "muyu-premium-test") return "muyu-amber";
          if (k === "muyu-premium-jade") return "muyu-jade";
          if (k === "muyu-premium-inkgold") return "muyu-inkgold";
          return k;
        })
      )
    ),
    autoUntil: raw.autoUntil || 0,
  };
  applyV3Defaults(state, raw);
  const muyuLegacy = {
    "premium-test": "amber",
    "premium-jade": "jade",
    "premium-inkgold": "inkgold",
  };
  if (muyuLegacy[state.skins.muyu]) state.skins.muyu = muyuLegacy[state.skins.muyu];
  if (!raw.schemaVersion || raw.schemaVersion < SCHEMA_VERSION) {
    if (typeof raw.sessionMerit !== "number") state.sessionMerit = 0;
    if (typeof raw.todayMerit !== "number") state.todayMerit = 0;
    if (typeof raw.yesterdayMerit !== "number") state.yesterdayMerit = 0;
    if (!raw.todayDate) state.todayDate = localDateKey();
    applyV3Defaults(state, raw);
    state.schemaVersion = SCHEMA_VERSION;
  }
  rollover(state);
  return state;
}

function loadFromStorage(freeUnlocks) {
  try {
    const o = wx.getStorageSync(STORAGE_KEY);
    return migrate(o, freeUnlocks);
  } catch (e) {
    const s = defaultState();
    s.unlockedSkins = freeUnlocks.slice();
    return s;
  }
}

/** Single in-memory state for index + stats (page stack keeps index alive). */
function getState(app, freeUnlocks) {
  if (!app || !app.globalData) return loadFromStorage(freeUnlocks);
  if (!app.globalData.meritState) {
    app.globalData.meritState = loadFromStorage(freeUnlocks);
  }
  return app.globalData.meritState;
}

function saveToStorage(state) {
  try {
    wx.setStorageSync(STORAGE_KEY, state);
  } catch (e) {}
}

function updateStreak(state) {
  const today = localDateKey();
  if (!state.streakLastDate) {
    state.streakDays = 1;
    state.streakLastDate = today;
    return;
  }
  if (state.streakLastDate === today) return;
  const diff = daysBetween(state.streakLastDate, today);
  if (diff === 1) {
    state.streakDays = Math.max(1, (state.streakDays || 0) + 1);
    state.streakLastDate = today;
    return;
  }
  if (diff === 2) {
    const month = monthKey();
    if (state.streakFreezeMonth !== month) {
      state.streakFreezeUsed = false;
      state.streakFreezeMonth = month;
    }
    if (!state.streakFreezeUsed) {
      state.streakFreezeUsed = true;
      state.streakDays = Math.max(1, (state.streakDays || 0) + 1);
      state.streakLastDate = today;
      return;
    }
  }
  state.streakDays = 1;
  state.streakLastDate = today;
}

function recordTap(state, kind) {
  rollover(state);
  state.total += 1;
  state.sessionMerit += 1;
  state.todayMerit += 1;
  state[kind] = (state[kind] || 0) + 1;
  updateStreak(state);
}

function resetSession(state) {
  state.sessionMerit = 0;
}

function resetAllMerit(state) {
  state.sessionMerit = 0;
  state.todayMerit = 0;
  state.yesterdayMerit = 0;
  state.total = 0;
  state.muyu = 0;
  state.beads = 0;
  state.bowl = 0;
  state.todayDate = localDateKey();
  state.autoUntil = 0;
  state.streakDays = 0;
  state.streakLastDate = "";
  state.streakFreezeUsed = false;
  state.streakFreezeMonth = "";
}

/**
 * 用于 stats 页展示。逻辑 mirror updateStreak 的「是否仍算连续」，
 * 但不在未敲击 today 时把 streakLastDate 推进到 today。
 */
function streakDisplayDays(state) {
  if (!state) return 0;
  const today = localDateKey();
  if (!state.streakLastDate) return 0;
  const diff = daysBetween(state.streakLastDate, today);
  if (state.streakLastDate === today) return Math.max(0, state.streakDays || 0);
  if (diff === 1) return Math.max(0, state.streakDays || 0); // 昨天敲过，今天还没敲，仍显示 N
  if (diff === 2) {
    const month = monthKey();
    const freezeOk =
      state.streakFreezeMonth === month && !state.streakFreezeUsed;
    if (freezeOk) return Math.max(0, state.streakDays || 0);
  }
  if (diff >= 2) return 0; // 已断连（含 diff===2 且冻结已用）
  return Math.max(0, state.streakDays || 0);
}

function normalizeAdQuota(state) {
  const today = localDateKey();
  if (state.adQuotaDate !== today) {
    state.adQuotaDate = today;
    state.adGrantAutoCount = 0;
    state.adGrantSkinCount = 0;
  }
}

function canGrantAuto(state) {
  normalizeAdQuota(state);
  return state.adGrantAutoCount < AD_AUTO_DAILY_MAX;
}

function canGrantSkin(state) {
  normalizeAdQuota(state);
  return state.adGrantSkinCount < AD_SKIN_DAILY_MAX;
}

function recordGrantAuto(state) {
  normalizeAdQuota(state);
  state.adGrantAutoCount += 1;
}

function recordGrantSkin(state) {
  normalizeAdQuota(state);
  state.adGrantSkinCount += 1;
}

module.exports = {
  STORAGE_KEY,
  SCHEMA_VERSION,
  AD_AUTO_DAILY_MAX,
  AD_SKIN_DAILY_MAX,
  localDateKey,
  monthKey,
  daysBetween,
  rollover,
  migrate,
  loadFromStorage,
  getState,
  saveToStorage,
  updateStreak,
  recordTap,
  resetSession,
  resetAllMerit,
  streakDisplayDays,
  normalizeAdQuota,
  canGrantAuto,
  canGrantSkin,
  recordGrantAuto,
  recordGrantSkin,
};
