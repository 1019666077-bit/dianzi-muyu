const { writeWhenPrivacy } = require("./localWrite");

const PREFS_KEY = "dianzi-muyu-prefs";

let cachedPrefs = null;

function defaultPrefs() {
  return { vibrateOn: true };
}

function loadPrefs() {
  if (cachedPrefs && typeof cachedPrefs === "object") {
    return cachedPrefs;
  }
  try {
    const o = wx.getStorageSync(PREFS_KEY);
    if (o && typeof o === "object") {
      cachedPrefs = {
        vibrateOn: o.vibrateOn !== false,
      };
      return cachedPrefs;
    }
  } catch (e) {}
  cachedPrefs = defaultPrefs();
  return cachedPrefs;
}

function savePrefs(prefs) {
  cachedPrefs = prefs && typeof prefs === "object" ? prefs : defaultPrefs();
  const snapshot = {
    vibrateOn: cachedPrefs.vibrateOn !== false,
  };
  cachedPrefs = snapshot;
  const write = () => {
    try {
      wx.setStorageSync(PREFS_KEY, snapshot);
    } catch (e) {}
  };
  let app = null;
  try {
    if (typeof getApp === "function") app = getApp();
  } catch (e) {
    app = null;
  }
  writeWhenPrivacy(app, write);
}

function isVibrateOn() {
  return loadPrefs().vibrateOn !== false;
}

function setVibrateOn(on) {
  const p = loadPrefs();
  p.vibrateOn = !!on;
  savePrefs(p);
  return p;
}

// TODO: 音效总开关（本轮不做）

module.exports = { PREFS_KEY, loadPrefs, savePrefs, isVibrateOn, setVibrateOn };
