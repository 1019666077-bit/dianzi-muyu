# Grok 任务书：体验抛光 Round 3（广告 UX · 清空闭环 · 连击展示 · 隐私旁路 · 念珠互斥 · 振动开关）

> **基线分支**：`cursor/fix-ad-grant-quota-copy-147d`（或已含 `54710ac` 的等效树）  
> **依据**：QA v2（`docs/QA_PLAYTEST_v2.md`）、调研执行版（`tools/IMPROVEMENT-PLAN-DAILY-REVENUE.md`）、Composer 复核结论  
> **产品决策（不变）**  
> - 不做订阅 / 云开发 / P1-B  
> - 激励 **fail-closed** 保持：`ALLOW_DEV_AD_SKIP: false` 为默认  
> - 快敲 **2 次/日**、皮肤视频 **3 次/日**  
>  
> **Git**：除非用户明确要求，**不要** `git commit` / `git push`。  
> **完成后**：运行 `python tools/validate_mp_assets.py`；撰写 **`docs/QA_PLAYTEST_v3.md`**（见 §10）。

---

## 0. 范围边界

| 做（本任务） | 不做 |
| --- | --- |
| 视频按钮「不可用」态 + 用户向文案；`showAd` 前置校验 | 改 `project.config.json` 填正式 AppID（运营） |
| `resetAllMerit` 清 `autoUntil` + streak；通知 index 停快敲 | 插屏广告、排行榜、宗教类目文案 |
| 数据页连击 **只读展示**（不断连误判） | Web 版 `index.html`  parity |
| 隐私门控：hint / 场景统计写入 | 订阅消息 |
| 念珠 `beadBusy` 与自动敲互斥 | 大改 UI 布局 / 换肤系统 |
| 数据页「敲击振动」开关 | 音效总开关（可留 TODO 一行） |
| `PRIVACY.md` 补充本地统计项 | `urlCheck` 强制改 true（仅文档备注） |
| 可选小修：飘字 timer 清理、`grantSkin` 成功 toast | schema v4 |

---

## 1. 新增 `mp-weixin/utils/prefs.js`

**目的**：偏好与功德 schema 分离，不 bump `schemaVersion`。

```javascript
// 建议 API（可微调命名，但行为必须一致）
const PREFS_KEY = "dianzi-muyu-prefs";

function defaultPrefs() {
  return { vibrateOn: true };
}

function loadPrefs() { /* getStorageSync，失败 return defaultPrefs */ }
function savePrefs(prefs) { /* setStorageSync */ }
function isVibrateOn() {
  return loadPrefs().vibrateOn !== false;
}
function setVibrateOn(on) {
  const p = loadPrefs();
  p.vibrateOn = !!on;
  savePrefs(p);
  return p;
}

module.exports = { PREFS_KEY, loadPrefs, savePrefs, isVibrateOn, setVibrateOn };
```

**隐私**：写入 `prefs` 时须走 **`app.whenPrivacy`**（见 §7），与主功德存储一致。

---

## 2. 新增 `mp-weixin/utils/localWrite.js`（或并入 `app.js` 的单一方法）

**目的**：统一「拒绝隐私则不写本地」。

```javascript
/**
 * writeWhenPrivacy(app, fn)
 * fn: () => void，内部执行 setStorageSync
 */
function writeWhenPrivacy(app, fn) {
  if (app && typeof app.whenPrivacy === "function") {
    app.whenPrivacy((agreed) => {
      if (agreed && typeof fn === "function") fn();
    });
    return;
  }
  if (typeof fn === "function") fn();
}
```

**必须改用此路径的写入**：

| Key | 现位置 |
| --- | --- |
| `dianzi-muyu-hints` | `pages/index/index.js` → `maybeShowMyMiniProgramHint` |
| `dianzi-muyu-scene-stats` | `app.js` → `recordScene` |
| `dianzi-muyu-prefs` | `utils/prefs.js` → `savePrefs` |

`merit.saveToStorage` 已在 index/stats 经 `whenPrivacy` 包装，**勿改**其 key 逻辑。

---

## 3. P0 · 激励视频按钮 UX（fail-closed 保留）

### 3.1 `utils/ad.js` — 用户向文案

在 **`resolveRewardedGrant` 不变**（开发/自测仍用原 toast）前提下，新增：

```javascript
/** 给用户看的短文案（无「游客号」「未配置」等开发词） */
function userMessageForPolicy(policy) {
  if (!policy) return "视频暂不可用，敲击与慢敲仍免费";
  if (policy.action === "play") return "";
  if (policy.action === "skip") return policy.toast || "开发版：已跳过广告";
  // refuse
  // 需能区分：游客 vs 正式 AppID 但空 unit —— 用 launch.IS_TOURIST 或 policy 扩展字段
  ...
}
```

推荐实现：让 `currentGrantPolicy()` 返回 `{ action, toast, reason: 'tourist'|'no_unit'|'ok' }`，或 `userMessageForPolicy(isTourist, action)`。

**用户向 copy（定稿，可微调一字）**：

| 条件 | Toast（≤20 字为宜，必要时 2500ms） |
| --- | --- |
| 游客 + refuse | `正式版开放后，可看视频加速` |
| 非游客 + 空 unit + refuse | `视频功能接入中，请稍后再试` |
| 日配额用尽 | **保持现有** index 内文案（已正确） |

导出：`userMessageForPolicy`、`currentGrantPolicy`（若扩展了字段）。

### 3.2 `pages/index/index.js` + `index.wxml`

**数据字段**（`onLoad` / `onShow` 刷新）：

- `rewardAdPlayable`: boolean — `canUseRealAd()`  
- `rewardAdMuted`: boolean — `!rewardAdPlayable`（便于 WXML）

**WXML**（toolbar 两个按钮）：

```xml
<button class="btn {{fastAutoOn ? 'primary' : ''}} {{rewardAdMuted ? 'btn-muted' : ''}}" bindtap="onAdAuto">视频·快敲</button>
<button class="btn {{rewardAdMuted ? 'btn-muted' : ''}}" bindtap="onAdSkin">视频·皮肤</button>
```

**WXSS**：`.btn-muted { opacity: 0.45; }`（或现有 `.btn` 变体，勿破坏 `primary` 对比度）

**点击逻辑**：

1. `onAdAuto` / `onAdSkin`：**最先**检查日配额（现有逻辑保留）。  
2. 若 `!canUseRealAd()`：  
   - `wx.showToast({ title: userMessageForPolicy(...), icon: 'none' })`  
   - **return**，不调用 `showAd` / `watchRewarded`。  
3. `showAd` 内可保留第二道防线（防漏网）。

**验收**：

- 默认游客 + 空 unit：按钮视觉变灰；点击只见用户向 toast，**不见**「游客号」「广告未配置」。  
- Node 自测 `resolveRewardedGrant` **仍 6/6**（勿改 refuse 的 dev toast 字符串，除非单测一并更新）。

---

## 4. P1 · `resetAllMerit` 与首页快敲闭环

### 4.1 `utils/merit.js` → `resetAllMerit`

在现有清零字段基础上 **增加**：

```javascript
state.autoUntil = 0;
state.streakDays = 0;
state.streakLastDate = "";
// streakFreezeUsed / streakFreezeMonth：建议 freeze 也重置，避免「清空后仍像有隐藏连击」
state.streakFreezeUsed = false;
state.streakFreezeMonth = "";
```

**不要**重置：`unlockedSkins`、`skins`、`adGrantAutoCount`、`adGrantSkinCount`、`adQuotaDate`（与 stats 弹窗「皮肤与解锁不受影响」一致；广告配额是否重置 — **不重置**，与 v2 QA 一致）。

### 4.2 `pages/stats/stats.js`

`onResetAll` 成功分支：

```javascript
merit.resetAllMerit(this.state);
this.save(this.state);
this.refresh();
meritNotifyIndexReset(); // 见下
wx.showToast({ title: "已清空", icon: "none" });
```

新增 **`meritNotifyIndexReset`**（可放在 `stats.js` 或 `utils/pageBridge.js`）：

```javascript
function meritNotifyIndexReset() {
  const pages = getCurrentPages();
  for (let i = pages.length - 1; i >= 0; i--) {
    const p = pages[i];
    const route = p.route || "";
    if (route.indexOf("pages/index/index") >= 0) {
      if (typeof p.onExternalMeritReset === "function") p.onExternalMeritReset();
      return;
    }
  }
}
```

### 4.3 `pages/index/index.js` → `onExternalMeritReset`

```javascript
onExternalMeritReset() {
  this.state = merit.getState(getApp(), FREE_UNLOCKS);
  this.slowAutoOn = false; // 清空语义：停止一切自动
  this.clearAutoTimers();
  this.syncMeritUI();
  this.updateAutoStatus();
},
```

**验收**：

1. 开快敲 → 进数据页清空全部 → 回首页：今日/总为 0，**不再自动涨数**。  
2. 连击 banner 在数据页为 0 / 不展示（`streakDays > 0` 才展示）。

### 4.4 更新 `stats.js` 二次确认文案

`onResetAll` 的 content 增加一句：`「连续天数与视频快敲计时也会清零。」`（与实现一致）

---

## 5. P1 · 连击展示（只读，禁止「未敲就加 streak」）

**问题**：`updateStreak` 仅在 `recordTap` 调用；跨日未敲时 UI 可能显示过期连击。

**做法**：在 `merit.js` 新增 **只读** 函数（不修改 state）：

```javascript
/**
 * 用于 stats 页展示。逻辑 mirror updateStreak 的「是否仍算连续」，
 * 但不在未敲击 today 时把 streakLastDate 推进到 today。
 */
function streakDisplayDays(state) {
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
```

`stats.refresh()` 使用 `streakDisplayDays(state)` 写入 `streakDays` 数据字段（可 rename data 为 `streakDisplay` 避免混淆，若 rename 需改 wxml）。

**禁止**：在 stats 页调用 `updateStreak(state)`（会在用户未敲时错误 +1 天）。

**可选 copy**：`diff >= 2` 且 storage 里还有旧 streak 时，banner 隐藏即可，无需额外文案。

---

## 6. P1 · 「我的小程序」引导仅手动敲击

**现况**：`bump()` 内调用 `maybeShowMyMiniProgramHint()`，自动敲也会触发。

**改法**：

1. 从 `bump()` **移除** `maybeShowMyMiniProgramHint()`。  
2. 在 **`onTapMuyu`、`onTapBowl`** 末尾（通过节流后、真正 bump 后）调用 `maybeShowMyMiniProgramHint()`。  
3. **念珠**：在 `commitBead()` 中仅当 `!this._beadFromAuto` 时调用 hint；`autoCommitBead` 路径设 `_beadFromAuto = true` 再 `commitBead`，手动拖动仍走原逻辑不设 flag。  
4. `maybeShowMyMiniProgramHint` 条件保持：`todayMerit === 1 || total === 1`（首次有效敲击）。

---

## 7. P2 · 隐私旁路写入（hint / 场景）

### 7.1 `app.js` → `recordScene`

整段 `wx.setStorageSync` 包进 `writeWhenPrivacy(this, () => { ... })`。

### 7.2 `maybeShowMyMiniProgramHint` → `complete` 回调

`wx.setStorageSync("dianzi-muyu-hints", ...)` 改为 `writeWhenPrivacy(getApp(), () => setStorage...)`。

### 7.3 `PRIVACY.md`

在「开发者处理的信息」增加 bullets：

- 场景打开次数统计（任务栏 / 分享 / 搜一搜等，仅本地计数，用于产品调试）
- 是否展示过「添加到我的小程序」引导（本地标记）
- 是否开启敲击振动（本地偏好）

处理目的补一句：「优化回访提示与使用体验」。

---

## 8. P2 · 念珠 `beadBusy` 互斥

**规则**：

- 用户 **`onBeadStart`**：`this.beadBusy = true`  
- **`onBeadEnd`** / **`onBeadStart` 因 busy  return 前**：`this.beadBusy = false`  
- **`restartAutoLoop`** 的 `setInterval` 回调：若 `this.beadBusy || this.beadDrag` → **跳过本次** auto（木鱼/颂钵/autoCommitBead 同理跳过）  
- **`autoCommitBead`**：若 `beadBusy` return，**不要**强制 commit

**验收**：慢敲/快敲开启时手指拖动念珠，不应出现「拖动 + 自动 commit」交错狂涨。

---

## 9. P2 · 敲击振动开关（数据页）

### 9.1 `stats.wxml`

在「分模式累计」与「重置本次」之间插入：

```xml
<view class="list list-sub prefs-row">
  <view class="row row-switch">
    <text class="label">敲击振动</text>
    <switch checked="{{vibrateOn}}" color="#c9a227" bindchange="onVibrateChange" />
  </view>
</view>
<text class="prefs-hint">关闭后，敲击不再震动（不影响音效）</text>
```

### 9.2 `stats.js`

- `onLoad` / `refresh`：`vibrateOn: prefs.isVibrateOn()`  
- `onVibrateChange(e)`：`prefs.setVibrateOn(e.detail.value)` 经 `writeWhenPrivacy`；更新 data

### 9.3 `index.js` → `bump`

```javascript
const prefs = require("../../utils/prefs");
// ...
if (prefs.isVibrateOn()) {
  wx.vibrateShort({ type: "light" });
}
```

### 9.4 `stats.wxss`

`.row-switch`、`.prefs-hint` 与现有 `.list` 风格一致（字号、边距参考 `.gap-hint`）。

---

## 10. P3 · 小修（时间允许则做）

| 项 | 做法 |
| --- | --- |
| 飘字泄漏 | `floatText` 的 `setTimeout` id 存数组，`onUnload` 里 `clearTimeout` |
| 解锁皮肤反馈 | `grantSkin` 成功 `wx.showToast({ title: '已解锁 '+pick.name, icon:'none' })` |
| 快敲+慢敲 | `onToggleSlowAuto` 在 `fastAutoOn` 时 toast 一句：`快敲进行中，关闭快敲请点「视频·快敲」`（可选） |

---

## 11. 自测（Grok 必须在回复与 QA 文档中逐项 PASS/FAIL）

### 11.1 Node（`mp-weixin` 目录）

```bash
cd mp-weixin
node -e "/* resolveRewardedGrant 6 场景，与 v2 一致 */"
node -e "/* streakDisplayDays：mock state 跨日 diff 0/1/2/3 */"
```

### 11.2 手工 / 代码走查

1. 游客 + 空 unit：视频按钮 muted；用户 toast；无 dev 词  
2. `ALLOW_DEV_AD_SKIP=true` 仅本地：仍为 skip 路径（不改变默认 config）  
3. 快敲中 →  stats 清空 → index 停涨  
4. 自动敲时首敲不弹「我的小程序」；手动首敲弹一次  
5. 拒绝隐私（模拟 `privacyAgreed=false`）：hint / scene / prefs 不写  
6. 振动关：敲击无 `vibrateShort`（grep 仅一处调用）  
7. `python tools/validate_mp_assets.py` → PASS  
8. 日配额 2/2、3/3 拦截文案仍为原样  

---

## 12. Grok 交付格式（回复用户 + 文件）

1. **修改文件列表**（路径 + 一句话）  
2. **未做项**与原因  
3. **`docs/QA_PLAYTEST_v3.md`** 结构：
   - 基线 commit hash  
   - 总结分数表（广告 UX / 清空 / 隐私 / 振动 / 综合）  
   - 自测 checklist 11.x  
   - 相对 v2 的 regression 声明  
4. 自测清单 11.x 逐项 PASS/FAIL  

---

## 13. Composer 复核清单（给用户第二意见，Grok 完成后由 Composer 执行）

Composer 将对照本任务书与 `docs/QA_PLAYTEST_v3.md`：

- [ ] `grep`「游客号」「广告未配置」**不应**出现在用户默认路径（`index` 点击）；`ad.js` dev toast 可保留  
- [ ] `resetAllMerit` 含 `autoUntil` + streak 字段  
- [ ] `getCurrentPages` 桥接存在且 index 实现 `onExternalMeritReset`  
- [ ] stats **未**调用 `updateStreak`  
- [ ] `recordScene` / hints / prefs 经 `writeWhenPrivacy`  
- [ ] `beadBusy` 在 start/end 与 auto 循环中生效  
- [ ] `prefs.js` + stats switch + `bump` 振动门控  
- [ ] `PRIVACY.md` 已更新  
- [ ] Node 自测命令可复现 PASS  

---

## 14. 文件 touch 清单（预期）

| 文件 | 动作 |
| --- | --- |
| `mp-weixin/utils/prefs.js` | 新增 |
| `mp-weixin/utils/localWrite.js` | 新增（或仅 `app.js`） |
| `mp-weixin/utils/ad.js` | 用户向文案 API |
| `mp-weixin/utils/merit.js` | `resetAllMerit` + `streakDisplayDays` |
| `mp-weixin/app.js` | `recordScene` 隐私 |
| `mp-weixin/pages/index/index.js` | 广告态、hint、振动、external reset、beadBusy、float 清理 |
| `mp-weixin/pages/index/index.wxml` | `btn-muted` |
| `mp-weixin/pages/index/index.wxss` | `.btn-muted` |
| `mp-weixin/pages/stats/stats.js` | streak 展示、振动、notify index、文案 |
| `mp-weixin/pages/stats/stats.wxml` | switch |
| `mp-weixin/pages/stats/stats.wxss` | prefs 样式 |
| `mp-weixin/PRIVACY.md` | 补充 |
| `docs/QA_PLAYTEST_v3.md` | Grok 新建 |

**勿改**：`schemaVersion`、订阅、Web `index.html`、正式 AppID 填入。

---

*任务书版本：2026-09-16 · Round 3 polish*
