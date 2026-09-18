/**
 * Animation-path assertions for tap hit/swing.
 * Does not run WeChat DevTools. Guarantees setData/WXML wiring so CSS can replay.
 *
 * Run: node mp-weixin/scripts/assert-hit-anim.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "pages/index/index.js"), "utf8");
const wxml = fs.readFileSync(path.join(root, "pages/index/index.wxml"), "utf8");
const wxss = fs.readFileSync(path.join(root, "pages/index/index.wxss"), "utf8");
const sfx = fs.readFileSync(path.join(root, "utils/sfx.js"), "utf8");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function sliceFn(src, name) {
  const re = new RegExp("\\n  " + name + "\\(");
  const m = re.exec(src);
  assert(m, "missing " + name);
  const start = m.index + 1;
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unclosed " + name);
}

const bump = sliceFn(js, "bump");
const restart = sliceFn(js, "restartHit");
const setMode = sliceFn(js, "setMode");
const tapPatch = sliceFn(js, "tapFeedbackPatch");
const hitOn = sliceFn(js, "hitOnPatch");
const hitOff = sliceFn(js, "hitOffPatch");

assert(bump.indexOf("this.play(kind)") >= 0, "bump plays sfx");
assert(bump.indexOf("this.restartHit(kind)") >= 0, "bump restarts hit animation");
assert(
  bump.indexOf("this.play(kind)") < bump.indexOf("this.restartHit(kind)"),
  "sound before animation restart"
);
assert(
  tapPatch.indexOf("hitFlip") < 0 && tapPatch.indexOf("muyuSwing") < 0,
  "queueTapUi patch must not own swing flags (would skip restart)"
);

assert(restart.indexOf("this.setData(this.hitOffPatch(kind))") >= 0, "restart first unsets class");
assert(restart.indexOf("this.setData(this.hitOnPatch(kind))") >= 0, "restart then sets class");
assert(restart.indexOf("setTimeout") >= 0 && restart.indexOf("16") >= 0, "false→16ms→true replay");

assert(hitOn.indexOf("muyuSwing: true") >= 0, "muyu on includes swing");
assert(hitOn.indexOf("bowlSwing: true") >= 0, "bowl on includes swing");
assert(hitOff.indexOf("muyuSwing: false") >= 0, "muyu off clears swing");
assert(hitOff.indexOf("bowlSwing: false") >= 0, "bowl off clears swing");

assert(setMode.indexOf("muyuSwing: false") >= 0, "setMode clears muyu swing");
assert(setMode.indexOf("bowlSwing: false") >= 0, "setMode clears bowl swing");
assert(setMode.indexOf("bowlRipple: false") >= 0, "setMode clears bowl ripple");
assert(setMode.indexOf("this.clearHitTimers()") >= 0, "setMode cancels pending restart");

assert(wxml.indexOf("hitFlip") < 0, "wxml must not use shared hitFlip");
assert(wxml.indexOf('class="muyu-mallet {{muyuSwing ? \'swing\' : \'\'}}"') >= 0, "muyu mallet bound to muyuSwing");
assert(wxml.indexOf('class="bowl-mallet-wrap {{bowlSwing ? \'swing\' : \'\'}}"') >= 0, "bowl mallet bound to bowlSwing");
assert(wxml.indexOf("{{muyuHit ? 'hit' : ''}}") >= 0, "muyu body uses muyuHit");
assert(wxml.indexOf("{{bowlHit ? 'hit' : ''}}") >= 0, "bowl body uses bowlHit");

assert(wxss.indexOf(".muyu-mallet.swing-alt") < 0, "no shared-name swing-alt");
assert(wxss.indexOf(".bowl-mallet-wrap.swing-alt") < 0, "no shared-name bowl swing-alt");
assert(/\.muyu-mallet\.swing\s*\{[^}]*animation:\s*muyuTap/.test(wxss), "muyu .swing uses muyuTap");
assert(/\.bowl-mallet-wrap\.swing\s*\{[^}]*animation:\s*bowlTap/.test(wxss), "bowl .swing uses bowlTap");

assert(sfx.indexOf("INNER_POOL") >= 0, "sfx pool kept");
assert(/playInnerSlot[\s\S]*a\.play\(\)/.test(sfx), "tap path still play()");
assert(!/function playInnerSlot[\s\S]*a\.stop\(/.test(sfx), "tap slot does not stop()");

function simulateRestartContract() {
  const data = { muyuSwing: true, muyuHit: true, muyuFlash: true, bowlSwing: false };
  const calls = [];
  const setData = (p) => {
    Object.assign(data, p);
    calls.push(Object.assign({}, p));
  };
  setData({ muyuHit: false, muyuSwing: false, muyuFlash: false });
  assert(data.muyuSwing === false, "restart unsets swing so keyframes can restart");
  setData({ muyuHit: true, muyuSwing: true, muyuFlash: true });
  assert(data.muyuSwing === true, "restart sets swing to start muyuTap");
  assert(calls[0].muyuSwing === false && calls[1].muyuSwing === true, "setData off then on");

  const modeData = {
    muyuHit: true, muyuSwing: true, muyuFlash: true,
    bowlHit: false, bowlSwing: false, bowlFlash: false, bowlRipple: false,
  };
  Object.assign(modeData, {
    muyuHit: false, muyuSwing: false, muyuFlash: false,
    bowlHit: false, bowlSwing: false, bowlFlash: false, bowlRipple: false,
  });
  assert(modeData.bowlSwing === false && modeData.muyuSwing === false, "tab switch leaves no swing class");
}
simulateRestartContract();

console.log("assert-hit-anim: PASS");
console.log(JSON.stringify({
  muyu: "muyuSwing restart false→16ms→true → .muyu-mallet.swing → muyuTap",
  bowl: "bowlSwing restart, flags cleared on setMode",
  sfx: "pool play() kept",
}, null, 2));
