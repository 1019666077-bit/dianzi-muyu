# Grok 任务书：P0-A + P1-A 完整实现（无订阅）

> **产品决策（已定）**  
> - 顶栏主数字：**今日功德**；总功德为辅。  
> - **不做** P1-B 订阅消息 / 云开发 / wx.login 服务端。  
> - 激励日上限：**快敲 2 次/日**、**皮肤 3 次/日**（自然日，本地 `YYYY-MM-DD`）。  
>  
> 依据：[`IMPROVEMENT-PLAN-DAILY-REVENUE.md`](./IMPROVEMENT-PLAN-DAILY-REVENUE.md)、[`DAILY-USE-REVENUE-RESEARCH.md`](./DAILY-USE-REVENUE-RESEARCH.md)  
> **不要** git commit。完成后自测 `python tools/validate_mp_assets.py`。

---

## 0. 范围边界

| 做 | 不做 |
| --- | --- |
| schema v3、streak、顶栏今日、数据页缺口、分享、任务栏引导、快敲结束文案、广告日配额、场景值本地统计、分享图资源 | 订阅消息、云函数、改 PRIVACY 增加 openid、插屏、排行榜、宗教文案 |

---

## 1. `utils/merit.js` — schema v3

### 1.1 常量

- `SCHEMA_VERSION = 3`

### 1.2 新字段（写入 defaultState + migrate）

| 字段 | 类型 | 默认 |
| --- | --- | --- |
| `streakDays` | number | 0 |
| `streakLastDate` | string | `""` 或当天（首次 tap 后设） |
| `streakFreezeMonth` | string | `""` 格式 `YYYY-MM` |
| `streakFreezeUsed` | boolean | false |
| `adQuotaDate` | string | `localDateKey()` |
| `adGrantAutoCount` | number | 0 |
| `adGrantSkinCount` | number | 0 |

migrate 从 v2：缺字段补默认；`schemaVersion < 3` 时补全后设 `schemaVersion = 3`。

### 1.3 `rollover(state)` 扩展

日切时（`todayDate` 变更）：

- 已有 yesterday/today 逻辑不变。
- **不要**在日切时清零 streak；streak 只在 `updateStreak` 里因断档变化。

### 1.4 新函数 `updateStreak(state)`

在 `recordTap` 末尾调用（确保 `rollover` 已执行且 `todayMerit >= 1`）。

逻辑：

1. `today = localDateKey()`
2. 若 `!streakLastDate`：`streakDays = 1`，`streakLastDate = today`，return
3. 若 `streakLastDate === today`：return（同一天多次敲不重复加 streak）
4. `diff = daysBetween(streakLastDate, today)`
5. 若 `diff === 1`：`streakDays += 1`（至少从 1 起），`streakLastDate = today`
6. 若 `diff === 2` 且本自然月未用过冻结：  
   - 若 `streakFreezeMonth !== 当前 YYYY-MM`：重置 `streakFreezeUsed = false`，`streakFreezeMonth = 当前月`  
   - 若 `!streakFreezeUsed`：`streakFreezeUsed = true`，`streakDays += 1`，`streakLastDate = today`（视为连续）  
   - 否则走 diff>1 断档：`streakDays = 1`，`streakLastDate = today`
7. 若 `diff > 2`（或未走冻结）：`streakDays = 1`，`streakLastDate = today`

导出：`updateStreak`。

### 1.5 广告配额 `utils/merit.js` 或 `utils/adQuota.js`（二选一，推荐 merit 内聚）

```javascript
function normalizeAdQuota(state) {
  const today = localDateKey();
  if (state.adQuotaDate !== today) {
    state.adQuotaDate = today;
    state.adGrantAutoCount = 0;
    state.adGrantSkinCount = 0;
  }
}
function canGrantAuto(state) { normalizeAdQuota(state); return state.adGrantAutoCount < 2; }
function canGrantSkin(state) { normalizeAdQuota(state); return state.adGrantSkinCount < 3; }
function recordGrantAuto(state) { normalizeAdQuota(state); state.adGrantAutoCount += 1; }
function recordGrantSkin(state) { normalizeAdQuota(state); state.adGrantSkinCount += 1; }
```

上限常量：`AD_AUTO_DAILY_MAX = 2`，`AD_SKIN_DAILY_MAX = 3`。

### 1.6 `resetAllMerit`

不清 streak / adQuota（或只清功德相关；**streak 保留**更符合习惯产品；**adQuota 随日自然重置**）。

---

## 2. `pages/index/index.js` / `wxml` / `wxss`

### 2.1 顶栏 pill

- `data`：`todayMerit: 0`，保留 `total`
- `syncMeritUI()`：`setData({ todayMerit: state.todayMerit, total: state.total })`
- `wxml` 示例结构：

```xml
<view class="merit-pill merit-pill-tap" bindtap="openStats">
  <view class="merit-pill-main">
    <text class="merit-label">今日</text>
    <text class="merit-num">{{todayMerit}}</text>
  </view>
  <text class="merit-sub">总 {{total}}</text>
</view>
```

- `wxss`：主数字大号金色；`merit-sub` 11px 半透明，不挤胶囊区

### 2.2 分享 `onShareAppMessage`

```javascript
onShareAppMessage() {
  const n = (this.state && this.state.todayMerit) || 0;
  return {
    title: "今日敲击 " + n + " 次 · 电子木鱼",
    path: "/pages/index/index",
    imageUrl: "/assets/share-cover.webp",
  };
}
```

### 2.3 分享图 `assets/share-cover.webp`

- 尺寸建议 5:4（微信分享图常用），≤128KB
- 内容：精修木鱼静帧或 `premium/muyu-premium-body.webp` 居中 + 深色底；**无佛像/经文**
- 若无法设计，可从现有 premium body 裁切导出 webp 到 `mp-weixin/assets/share-cover.webp`

### 2.4 首次引导「我的小程序」

- 存储键：`dianzi-muyu-hints` → `{ myMiniProgramShown: true }`（独立 storage，勿污染 merit）
- 在 `bump()` 成功后：若 `todayMerit === 1` 且首次（或 `total === 1` 且未 shown），`wx.showModal` 一次  
- 标题：「方便下次找到」  
- 内容：「点击右上角 ··· → 添加到我的小程序，可从下拉任务栏快速打开。」  
- 用户点确定/取消都设 `myMiniProgramShown = true`

### 2.5 广告配额拦截

在 `showAd(reward)` **开头**：

- `reward === 'auto'` 且 `!merit.canGrantAuto(this.state)` → toast「今日快敲次数已用完（2/2），明天再来；慢敲仍免费」return
- `reward === 'skin'` 且 `!merit.canGrantSkin(this.state)` → toast「今日皮肤视频次数已用完（3/3），明天再来」return

在 `grantAuto()` 成功路径：`merit.recordGrantAuto(this.state)` 再设 autoUntil  
在 `grantSkin()` 成功路径：`merit.recordGrantSkin(this.state)` 再解锁

**开发版跳过广告**（`ad.js` 仍发奖）：同样计入配额，避免测试无限刷。

### 2.6 快敲结束文案

`updateAutoStatus()` 当 `autoRemaining() <= 0` 且曾快敲（可选：仅当用户今日用过 grantAuto）：

- 若 `slowAutoOn`：status 保持慢敲文案  
- 否则：`status: "今日快敲已结束 · 明天可再看视频续 5 分钟 · 慢敲仍可用"`

**禁止**在快敲刚结束时自动 `showAd`。

### 2.7 `onShow` / `bump` 后调用 `syncMeritUI`

stats 返回后今日数字正确。

---

## 3. `pages/stats/stats.js` / `wxml` / `wxss`

### 3.1 连续天数

- `refresh()` 增加 `streakDays` 到 setData
- 在「本次功德」列表**上方**或标题下：

```xml
<view wx:if="{{streakDays > 0}}" class="streak-banner">
  <text>已连续 {{streakDays}} 天</text>
</view>
```

### 3.2 昨日缺口文案

在 `refresh()` 计算：

```javascript
let gapHint = "";
const y = state.yesterdayMerit, t = state.todayMerit;
if (y > 0 && t < y) gapHint = "距昨日还差 " + (y - t);
else if (y > 0 && t >= y) gapHint = "已超昨日 +" + (t - y);
```

`wxml`：`gapHint` 非空时显示 `.gap-hint`（12–13px，淡金）

### 3.3 场景值调试（隐藏）

- `stats.js` `onLoad`：注册 `titleTapCount`
- 连续点击标题「功德数据」5 次 → toggle `showSceneDebug`
- 读 storage `dianzi-muyu-scene-stats`（见 app.js），展示本周 1089/1036/1053/other 次数

样式与现有黑金列表一致。

---

## 4. `app.js` — 场景值累计

```javascript
onLaunch(options) {
  this.recordScene(options && options.scene);
  // existing...
},
onShow(options) {
  this.recordScene(options && options.scene);
},
recordScene(scene) {
  if (scene == null) return;
  try {
    const key = "dianzi-muyu-scene-stats";
    const o = wx.getStorageSync(key) || { w: "", counts: {} };
    const week = getWeekId(); // ISO week or YYYY-Www simple
    if (o.w !== week) { o.w = week; o.counts = {}; }
    const s = String(scene);
    if (s === "1089") o.counts.s1089 = (o.counts.s1089||0)+1;
    else if (s === "1036") o.counts.s1036 = (o.counts.s1036||0)+1;
    else if (s === "1053") o.counts.s1053 = (o.counts.s1053||0)+1;
    else o.counts.other = (o.counts.other||0)+1;
    wx.setStorageSync(key, o);
  } catch (e) {}
}
```

`getWeekId` 可内联：用 `localDateKey` 所在周的周一日期字符串。

---

## 5. 文档更新（小改）

- `tools/IMPROVEMENT-PLAN-DAILY-REVENUE.md` 文末加一句「已实现见 CHANGELOG」**可选**；或新建 `tools/CHANGELOG-DAILY-RETENTION.md` 3 行说明 v3 字段  
- **不要**改 `PRIVACY.md`（无服务端）

---

## 6. 自测清单（Grok 必须在回复里逐项 PASS/FAIL）

1. 敲 1 下 → 顶栏今日 1，总 +1  
2. 改系统日期 +1 天（或 mock rollover）→ 今日 0，昨日正确，streak 逻辑  
3. 连续 3 天有敲 → streak=3  
4. 隔 2 天敲 → 若未用冻结则 streak=1；同月第一次隔 2 天 → 冻结消耗 streak 连续  
5. 同一天 grantAuto 3 次（含开发跳过）→ 第 3 次前 toast 拦截  
6. 同一天 grantSkin 4 次 → 第 4 次拦截  
7. 分享标题含今日次数  
8. share-cover.webp 存在且 validate 通过  
9. index/stats 仍用 `merit.getState`，reset 不破坏 quota 日切  
10. 快敲结束 status 文案正确，无自动 second ad  

---

## 7. Grok 交付格式

1. 修改文件列表  
2. schema v3 字段表  
3. 自测清单结果  
4. 已知妥协（如 share 图简版）
