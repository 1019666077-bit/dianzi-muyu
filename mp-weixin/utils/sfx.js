/**
 * Rapid-tap SFX pool (InnerAudio).
 *
 * iOS 连点断音: 单实例 stop()+seek(0)+play()，seek 未完成就 play → 静音，
 * 或下一击 stop 把上一击掐掉。
 *
 * Rules:
 * - Prewarm the muyu pool at create (do not create 5 ctx on the first 连点).
 * - Tap path: never stop(), never seek().
 * - onEnded: mark idle and seek(0) so the next reuse can play() from 0.
 * - Prefer an idle slot whose playhead is already ~0.
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
    const a = wx.createInnerAudioContext({ useWebAudioImplement: false });
    if (a) return a;
  } catch (e) {}
  return wx.createInnerAudioContext();
}

function armInner(a, kind) {
  a._busy = false;
  a._token = 0;
  a._kind = kind;
  const onFree = () => {
    a._busy = false;
    try {
      if (a.currentTime) a.seek(0);
    } catch (e) {}
  };
  try {
    if (typeof a.onEnded === "function") a.onEnded(onFree);
  } catch (e) {}
  try {
    if (typeof a.onError === "function") a.onError(onFree);
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

function playhead(a) {
  return typeof a.currentTime === "number" ? a.currentTime : 0;
}

function pickSlot(pool, startAt) {
  const n = pool.length;
  for (let i = 0; i < n; i++) {
    const j = (startAt + i) % n;
    if (!pool[j]._busy && playhead(pool[j]) <= 0.02) return j;
  }
  for (let i = 0; i < n; i++) {
    const j = (startAt + i) % n;
    if (!pool[j]._busy) return j;
  }
  return startAt % n;
}

function playInnerSlot(a, kind) {
  a._token += 1;
  markBusy(a, kind);
  try {
    a.play();
  } catch (e) {
    try {
      a.play();
    } catch (e2) {}
  }
}

function playInner(state, kind) {
  makeInnerKind(state, kind);
  const pool = state.inner.pools[kind];
  if (!pool || !pool.length) return;
  const startAt = state.inner.idx[kind] % pool.length;
  const pick = pickSlot(pool, startAt);
  state.inner.idx[kind] = pick + 1;
  playInnerSlot(pool[pick], kind);
}

function createPool(srcMap) {
  const state = { srcMap: srcMap || {}, inner: null };
  makeInnerKind(state, "muyu");
  return state;
}

function play(state, kind) {
  if (!state) return;
  playInner(state, kind);
}

function onShow() {}

function onHide() {}

function destroy(state) {
  if (!state || !state.inner || !state.inner.pools) return;
  Object.keys(state.inner.pools).forEach((k) => {
    (state.inner.pools[k] || []).forEach((a) => {
      try {
        a.destroy();
      } catch (e) {}
    });
  });
  state.inner = null;
}

module.exports = {
  INNER_POOL,
  BUSY_MS,
  createPool,
  play,
  pickSlot,
  onShow,
  onHide,
  destroy,
};
