/**
 * Discrete-event simulation of iOS InnerAudio 连点.
 * Not WeChat DevTools / 真机. Models seek delay and stop-chop.
 *
 * Run: node mp-weixin/scripts/sim-rapid-taps.js
 */
const path = require("path");
const sfxPath = path.join(__dirname, "../utils/sfx.js");

function Clock() {
  this.now = 0;
  this.q = [];
}
Clock.prototype.after = function (ms, fn) {
  this.q.push({ t: this.now + ms, fn });
};
Clock.prototype.advance = function (to) {
  while (this.q.length) {
    this.q.sort((a, b) => a.t - b.t);
    if (this.q[0].t > to) break;
    const ev = this.q.shift();
    this.now = ev.t;
    ev.fn();
  }
  this.now = to;
};

function installTimers(clock) {
  global.setTimeout = function (fn, ms) {
    clock.after(ms, fn);
    return 1;
  };
}

function makeCtx(clock, duration) {
  const a = {
    src: "",
    obeyMuteSwitch: false,
    currentTime: 0,
    duration,
    playing: false,
    seekPending: false,
    chopped: 0,
    silentPlay: 0,
    audiblePlay: 0,
    _playGen: 0,
    _onEnded: null,
    stop() {
      if (a.playing) a.chopped += 1;
      a.playing = false;
      a.seekPending = false;
      a._playAfterSeek = false;
    },
    seek(t) {
      a.seekPending = true;
      const to = t;
      clock.after(50, () => {
        if (!a.seekPending) return;
        a.currentTime = to;
        a.seekPending = false;
        if (a._playAfterSeek) {
          a._playAfterSeek = false;
          a.play();
        }
        if (typeof a._onSeeked === "function") a._onSeeked();
      });
    },
    play() {
      if (a.seekPending) {
        a._playAfterSeek = true;
        return;
      }
      if (a.currentTime > 0.02 && a.currentTime >= duration - 0.02) {
        a.silentPlay += 1;
        return;
      }
      if (a.playing) a.chopped += 1;
      a.playing = true;
      a.audiblePlay += 1;
      const gen = ++a._playGen;
      clock.after(Math.round(duration * 1000), () => {
        if (a._playGen !== gen || !a.playing) return;
        a.playing = false;
        a.currentTime = duration;
        if (typeof a._onEnded === "function") a._onEnded();
      });
    },
    onEnded(fn) {
      a._onEnded = fn;
    },
    onError() {},
    onSeeked(fn) {
      a._onSeeked = fn;
    },
    destroy() {},
  };
  return a;
}

function runOld(clock, taps, gap, duration) {
  const created = [];
  global.wx = {
    createInnerAudioContext() {
      const a = makeCtx(clock, duration);
      created.push(a);
      return a;
    },
    setInnerAudioOption() {},
  };
  const a = global.wx.createInnerAudioContext();
  a.src = "/assets/sfx/muyu.wav";
  for (let i = 0; i < taps; i++) {
    clock.advance(i * gap);
    a.stop();
    a.seek(0);
    a.play();
  }
  clock.advance(taps * gap + 800);
  return summarize(created, taps);
}

function runNew(clock, taps, gap, duration) {
  const created = [];
  global.wx = {
    createInnerAudioContext() {
      const a = makeCtx(clock, duration);
      created.push(a);
      return a;
    },
    setInnerAudioOption() {},
  };
  delete require.cache[require.resolve(sfxPath)];
  const sfx = require(sfxPath);
  const atCreate = created.length;
  const st = sfx.createPool({ muyu: "/assets/sfx/muyu.wav" });
  const warmed = created.length;
  for (let i = 0; i < taps; i++) {
    clock.advance(i * gap);
    sfx.play(st, "muyu");
  }
  clock.advance(taps * gap + 800);
  const sum = summarize(created, taps);
  sum.ctxAtCreate = atCreate;
  sum.ctxAfterCreatePool = warmed;
  sum.ctxAfterTaps = created.length;
  sum.poolSize = sfx.INNER_POOL;
  return sum;
}

function summarize(created, taps) {
  let audible = 0;
  let silent = 0;
  let chopped = 0;
  let stops = 0;
  created.forEach((a) => {
    audible += a.audiblePlay;
    silent += a.silentPlay;
    chopped += a.chopped;
  });
  return { taps, audible, silent, chopped, stops, ctx: created.length };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function checkIndexSource() {
  const fs = require("fs");
  const js = fs.readFileSync(path.join(__dirname, "../pages/index/index.js"), "utf8");
  const iPlay = js.indexOf("this.play(kind)");
  const iSave = js.indexOf("this.scheduleSave()");
  const iUi = js.indexOf("this.queueTapUi(kind, extraPatch)");
  const iVib = js.indexOf("this.queueVibrate()");
  assert(iPlay > 0 && iPlay < iSave && iSave < iUi && iUi < iVib, "bump order play → save → ui → vibrate");
  assert(js.indexOf("wx.nextTick") >= 0, "setData coalesced via nextTick");
  assert(js.indexOf("if (now - (this._lastVibrateAt || 0) < 180) return") >= 0, "vibrate throttled");
  assert(js.indexOf("this._saveTimer = setTimeout") >= 0, "save deferred");
  assert(/catchtouchstart="onTapMuyu"/.test(fs.readFileSync(path.join(__dirname, "../pages/index/index.wxml"), "utf8")), "muyu touchstart");
  const wxss = fs.readFileSync(path.join(__dirname, "../pages/index/index.wxss"), "utf8");
  assert(/\.tap-area \{[\s\S]*width:\s*300px/.test(wxss), "tap-area not shrunk");
}

function main() {
  checkIndexSource();

  const taps = 22;
  const gap = 90;
  const duration = 0.22;

  const oldClock = new Clock();
  installTimers(oldClock);
  const oldR = runOld(oldClock, taps, gap, duration);

  const newClock = new Clock();
  installTimers(newClock);
  const newR = runNew(newClock, taps, gap, duration);

  console.log(JSON.stringify({ old: oldR, neu: newR }, null, 2));

  assert(oldR.silent + oldR.chopped > 0, "old path should show chop/silent under 连点");
  assert(newR.ctxAfterCreatePool === newR.poolSize, "muyu pool prewarmed");
  assert(newR.ctxAfterTaps === newR.ctxAfterCreatePool, "no extra ctx during 连点");
  assert(newR.audible === taps, "every tap audible, got " + newR.audible);
  assert(newR.silent === 0, "no silent play(), got " + newR.silent);
  assert(newR.chopped === 0, "no stop-chop, got " + newR.chopped);
  console.log("sim-rapid-taps: PASS");
}

main();
