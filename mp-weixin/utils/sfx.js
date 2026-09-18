/**
 * Tap SFX: prefer WebAudio one-shots (overlap, no stop/seek).
 * InnerAudio fallback: round-robin pool, never stop() on tap, never seek in onEnded.
 * iOS 连点断音 comes from stop+seek+play races and reusing a still-playing slot.
 */
const INNER_POOL = 5;
const BUSY_MS = { muyu: 280, beads: 180, bowl: 900 };

function setMixOption() {
  if (typeof wx.setInnerAudioOption !== "function") return;
  try {
    wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
  } catch (e) {}
}

function createInnerCtx() {
  try {
    const a = wx.createInnerAudioContext({ useWebAudioImplement: true });
    if (a) return a;
  } catch (e) {}
  return wx.createInnerAudioContext();
}

function createWeb() {
  try {
    if (typeof wx.createWebAudioContext === "function") {
      const ctx = wx.createWebAudioContext();
      if (ctx && typeof ctx.createBufferSource === "function") return ctx;
    }
  } catch (e) {}
  return null;
}

function decodeBuffer(ctx, data, ok, fail) {
  let settled = false;
  const done = (buf) => {
    if (settled) return;
    settled = true;
    if (buf) ok(buf);
    else if (fail) fail();
  };
  const bad = () => {
    if (settled) return;
    settled = true;
    if (fail) fail();
  };
  try {
    const maybe = ctx.decodeAudioData(data, done, bad);
    if (maybe && typeof maybe.then === "function") {
      maybe.then(done).catch(bad);
    }
  } catch (e) {
    bad();
  }
}

function readLocal(filePath, ok, fail) {
  let fs = null;
  try {
    fs = wx.getFileSystemManager();
  } catch (e) {
    fail();
    return;
  }
  fs.readFile({
    filePath,
    success: (res) => {
      if (res && res.data) ok(res.data);
      else fail();
    },
    fail,
  });
}

function loadBuffer(state, kind, src) {
  if (!state.web || !src) return;
  const tryPath = (path, next) => {
    readLocal(
      path,
      (data) => {
        decodeBuffer(
          state.web,
          data,
          (buf) => {
            state.buffers[kind] = buf;
          },
          () => {
            if (next) next();
          }
        );
      },
      () => {
        if (next) next();
      }
    );
  };
  tryPath(src, () => {
    if (src.charAt(0) === "/") tryPath(src.slice(1));
  });
}

function loadAll(state) {
  const map = state.srcMap || {};
  Object.keys(map).forEach((k) => loadBuffer(state, k, map[k]));
}

function resumeWeb(state) {
  const ctx = state && state.web;
  if (!ctx) return;
  try {
    if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
  } catch (e) {}
}

function playWeb(state, kind) {
  const ctx = state.web;
  const buffer = state.buffers[kind];
  if (!ctx || !buffer) return false;
  try {
    resumeWeb(state);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    try {
      src.start(0);
    } catch (e) {
      src.start();
    }
    return true;
  } catch (e) {
    return false;
  }
}

function armInner(a, kind) {
  a._busy = false;
  a._token = 0;
  a._kind = kind;
  const free = () => {
    a._busy = false;
  };
  try {
    if (typeof a.onEnded === "function") a.onEnded(free);
  } catch (e) {}
  try {
    if (typeof a.onError === "function") a.onError(free);
  } catch (e) {}
}

function makeInnerKind(state, kind) {
  if (!state.inner) state.inner = { pools: {}, idx: {} };
  if (state.inner.pools[kind] && state.inner.pools[kind].length) return;
  setMixOption();
  const src = (state.srcMap || {})[kind];
  const list = [];
  for (let i = 0; i < INNER_POOL; i++) {
    const a = createInnerCtx();
    a.obeyMuteSwitch = false;
    a.src = src;
    armInner(a, kind);
    list.push(a);
  }
  state.inner.pools[kind] = list;
  state.inner.idx[kind] = 0;
}

function markBusy(a, kind) {
  a._busy = true;
  const ms = BUSY_MS[kind] || 300;
  const token = a._token;
  setTimeout(() => {
    if (a._token === token) a._busy = false;
  }, ms);
}

function playInnerSlot(a, kind) {
  const wasBusy = !!a._busy;
  const token = ++a._token;
  const t = typeof a.currentTime === "number" ? a.currentTime : 0;
  markBusy(a, kind);
  const start = () => {
    if (a._token !== token) return;
    try {
      a.play();
    } catch (e) {
      try {
        a.play();
      } catch (e2) {}
    }
  };
  // Reuse of a finished clip (playhead at end). Never seek a still-playing slot.
  if (!wasBusy && t > 0.02) {
    let started = false;
    const kick = () => {
      if (started || a._token !== token) return;
      started = true;
      start();
    };
    a._seekKick = kick;
    if (!a._onSeeked && typeof a.onSeeked === "function") {
      a._onSeeked = () => {
        const fn = a._seekKick;
        a._seekKick = null;
        if (fn) fn();
      };
      try {
        a.onSeeked(a._onSeeked);
      } catch (e) {}
    }
    try {
      a.seek(0);
    } catch (e) {
      kick();
      return;
    }
    setTimeout(kick, 20);
    return;
  }
  start();
}

function playInner(state, kind) {
  makeInnerKind(state, kind);
  const pool = state.inner.pools[kind];
  if (!pool || !pool.length) return;
  const n = pool.length;
  const startAt = state.inner.idx[kind] % n;
  let pick = -1;
  for (let i = 0; i < n; i++) {
    const j = (startAt + i) % n;
    if (!pool[j]._busy) {
      pick = j;
      break;
    }
  }
  if (pick < 0) pick = startAt;
  state.inner.idx[kind] = pick + 1;
  playInnerSlot(pool[pick], kind);
}

function createPool(srcMap) {
  const state = {
    srcMap: srcMap || {},
    buffers: {},
    web: createWeb(),
    inner: null,
  };
  if (state.web) loadAll(state);
  else {
    Object.keys(state.srcMap).forEach((k) => makeInnerKind(state, k));
  }
  return state;
}

function play(state, kind) {
  if (!state) return;
  if (playWeb(state, kind)) return;
  playInner(state, kind);
}

function onShow(state) {
  if (!state) return;
  resumeWeb(state);
  try {
    if (state.web && state.web.state === "closed") {
      state.web = createWeb();
      state.buffers = {};
      if (state.web) loadAll(state);
    }
  } catch (e) {}
}

function onHide(state) {
  // Intentionally no suspend(): iOS WeChat often fails to resume short SFX.
  if (!state) return;
}

function destroy(state) {
  if (!state) return;
  if (state.inner && state.inner.pools) {
    Object.keys(state.inner.pools).forEach((k) => {
      (state.inner.pools[k] || []).forEach((a) => {
        try {
          a.destroy();
        } catch (e) {}
      });
    });
  }
  state.inner = null;
  try {
    if (state.web && typeof state.web.close === "function") state.web.close();
  } catch (e) {}
  state.web = null;
  state.buffers = {};
}

module.exports = {
  INNER_POOL,
  createPool,
  play,
  onShow,
  onHide,
  destroy,
};
