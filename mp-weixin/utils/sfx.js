/**
 * Short SFX pool for tap feedback.
 * Do not create InnerAudioContext per tap — decode/create is the slow path on device.
 * play() must stay off stop()+seek(); reset to 0 happens onEnded, not on the tap frame.
 */
const POOL_SIZE = 2;

function createCtx() {
  try {
    const a = wx.createInnerAudioContext({ useWebAudioImplement: true });
    if (a) return a;
  } catch (e) {}
  return wx.createInnerAudioContext();
}

function armReset(a) {
  const reset = () => {
    try {
      if (a.currentTime) a.seek(0);
    } catch (e) {}
  };
  try {
    if (typeof a.onEnded === "function") a.onEnded(reset);
  } catch (e) {}
  try {
    if (typeof a.onStop === "function") a.onStop(reset);
  } catch (e) {}
}

function createPool(srcMap) {
  const pools = {};
  const idx = {};
  Object.keys(srcMap || {}).forEach((k) => {
    pools[k] = [];
    idx[k] = 0;
    const src = srcMap[k];
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = createCtx();
      a.obeyMuteSwitch = false;
      a.src = src;
      armReset(a);
      pools[k].push(a);
    }
  });
  return { pools, idx };
}

function play(state, kind) {
  if (!state || !state.pools) return;
  const pool = state.pools[kind];
  if (!pool || !pool.length) return;
  let pick = -1;
  for (let n = 0; n < pool.length; n++) {
    const i = (state.idx[kind] + n) % pool.length;
    if (pool[i].paused !== false) {
      pick = i;
      break;
    }
  }
  if (pick < 0) pick = state.idx[kind] % pool.length;
  state.idx[kind] = pick + 1;
  const a = pool[pick];
  try {
    a.play();
  } catch (e) {
    try {
      a.play();
    } catch (e2) {}
  }
}

function destroy(state) {
  if (!state || !state.pools) return;
  Object.keys(state.pools).forEach((k) => {
    (state.pools[k] || []).forEach((a) => {
      try {
        a.destroy();
      } catch (e) {}
    });
  });
  state.pools = {};
}

module.exports = { POOL_SIZE, createPool, play, destroy };
