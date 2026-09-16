# 对标「功德木鱼」功能方案

> 依据：`tools/GROK-REFERENCE-FEATURES.md`、竞品主界面 / 「功德数据」页截图。  
> 核实代码：`mp-weixin/pages/index/*`、`app.js`、`utils/ad.js`、`config/launch.js`、`app.json`。  
> 原则：**三 Tab（木鱼 / 念珠 / 颂钵）+ 精修分层皮肤是差异化，不删不换抄。**  
> 本文只做方案。不 git commit。不改主界面代码。`pages/stats` 骨架标为可选，本轮不落地。

---

## 0. 代码核实结论（与任务书对照）

任务书里的「现状」表经代码核对 **全部成立**，并补充如下。

| 项 | 代码事实 |
|----|----------|
| 存储键 | `dianzi-muyu-v1`（`loadState` / `save`） |
| 总功德 | `state.total`，顶栏 `.merit-pill` 展示 |
| 分模式计数 | `state.muyu` / `beads` / `bowl` 每次 `bump()` 同步 +1，**UI 未展示** |
| 浮字 | `floatText()` 文案固定「功德 +1」，`left` 随机 30–70%，非敲击点固定金色 `+1` |
| 自动敲 | 看激励视频后 `autoUntil = now + 5min`，550ms 定时器按当前 Tab 敲；按钮在底部工具栏，进行中 `disabled` |
| 邀请 | `open-type="share"`，`onShareAppMessage` 标题「电子木鱼」 |
| 数据页 / 重置 | **无页面、无入口、无字段** |
| 布局 | 自定义顶栏 + 舞台 + 三按钮工具栏 + 邀请 + 状态行 + **底栏三 Tab** |
| 背景 | `bg-zen.webp` + veil，非佛像剪影 |
| 隐私写盘 | `app.whenPrivacy`：未同意则 `save()` 不写 storage |
| 广告 | `IS_TOURIST` 或 `REWARDED_AD_UNIT_ID === ""` 时 toast「开发版：已跳过广告」并直接发奖 |
| 路由 | `app.json` 仅 `pages/index/index` |

当前 `state` 形状：

```js
{
  total, muyu, beads, bowl,
  skins: { muyu, beads, bowl },
  unlockedSkins: string[],
  autoUntil: number   // 毫秒时间戳，0 表示未授权
}
```

---

## 1. 功能差距矩阵

图例：**已有** = 行为可用；**部分** = 有能力但形态不同；**缺失** = 无入口/无数据。  
优先级：P0 影响对标核心体验；P1 体验完整度；P2 锦上添花。  
「适合 v1.0」指 **当前已可提审的版本**（三 Tab + 精修 + 隐私 + 广告跳过），不是「必须立刻做完才能上线」。

| 参考功能 | 现状 | 差距说明 | 建议优先级 | 适合 v1.0 上线？ |
|----------|------|----------|------------|------------------|
| 标题「功德木鱼」 | 部分 | 我们是「电子木鱼 / 静心小玩具 · 原创」，刻意差异化，**不改名抄竞品** | — | 是（保持现状） |
| 大尺寸木鱼 + 槌 | 已有 | 精修分层（body/shade/spec/ground/rim）比竞品更强 | — | 是 |
| 暗色氛围背景 | 已有 | `bg-zen.webp`，**不抄佛像/烟雾竞品图**（版权 + 审核） | P2 | 是（保持现状） |
| 敲击浮字 +1 | 部分 | 有「功德 +1」随机位；竞品是敲击处金色数字 `+1` | P1 | 是（可后改） |
| 顶栏功德数字 | 部分 | 只展示 **总功德**；无本次/今日 | P0 | 是（ pill 可先不动） |
| 右侧竖栏 · 数据 | 缺失 | 无统计页、无入口 | P0 | 否（放 v1.1） |
| 右侧竖栏 · 重置 | 缺失 | 无确认弹窗、无清空逻辑 | P0 | 否（放 v1.1） |
| 右侧竖栏 · 自动 | 部分 | 有自动敲，但是 **底部「视频·自动敲」限时 5 分钟**，非右侧 toggle | P0 | 是（现广告路径可上线） |
| 底部邀请好友 | 已有 | 金属渐变按钮 + `open-type="share"` | P2 | 是 |
| 功德数据页 | 缺失 | 无 `pages/stats` | P0 | 否（放 v1.1） |
| 本次功德 | 缺失 | 无会话计数；冷启动也无法区分 | P0 | 否 |
| 今日功德 | 缺失 | 无自然日字段、无日切 | P0 | 否 |
| 昨日功德 | 缺失 | 无快照 | P0 | 否 |
| 总功德 | 已有 | 口径正确（历史累加），但未与日切解耦 | P0 | 是 |
| 三 Tab 木鱼/念珠/颂钵 | 已有（我方优势） | 竞品无。**必须保留** | — | 是 |
| 精修皮肤商城 | 已有（我方优势） | 竞品无。木鱼经典 3 + 精修 3，念珠/颂钵各 3 | — | 是 |
| 视频解锁皮肤 | 已有 | `grantSkin` 解锁当前模式下一档付费皮肤 | — | 是 |
| 分模式计数展示 | 部分 | 数据已记，UI 未露。数据页可作差异化附录 | P1 | 否（随数据页） |
| 木鱼专注模式（藏 Tab） | 缺失 | 可选，对标「纯木鱼」观感但不删能力 | P2 | 否（v1.2） |
| 自动免费慢敲 | 缺失 | 现仅广告快敲 | P1 | 否（v1.1 融合） |

**v1.0 上线建议**：以当前工程提审即可。缺口集中在「数据页 + 日切 + 重置 + 自动形态」，做成 **v1.1**，不要堵第一版。

---

## 2. 设计原则（落地约束）

1. **差异化保留**：底栏三 Tab 与精修皮肤不删除、不降级为「只有木鱼」。右侧快捷栏是 **叠加**，不是替换。
2. **统计口径**：三种模式敲击 **共用同一功德池**（与现 `total++` 一致）。数据页主列表对标竞品四行；其下用「分模式累计」作为我们多出来的信息，不拆成三套今日/昨日。
3. **重置范围**：主按钮默认只清 **本次**；清 **总/今日/昨日** 必须二次确认。皮肤与解锁列表永不随重置丢失。
4. **自动敲融合**：参考品是免费 toggle；我们已是「看视频换 5 分钟快敲」。推荐 **免费慢敲 toggle + 看视频升快敲**，两边都要能随时关掉。
5. **包体**：不引入 Three.js / 3D；统计页纯 2D 列表；主舞台继续用现有 premium 分层 WebP。
6. **合规**：重置走确认弹窗；自动仍走 `utils/ad.js` 发快敲奖励；隐私写盘逻辑不绕开；不使用佛像/宗教类目素材。

---

## 3. 实施方案（按模块）

### 3.1 存储 schema 与日切

**产品行为**

- **本次**：自本次小程序进程启动（`App.onLaunch`）起累计，或用户点「重置本次」后从 0 再计。前后台切换（`onHide` / `onShow`）**不清空**。
- **今日**：本地自然日 0 点起累计（不用 UTC）。
- **昨日**：上一自然日结束时的今日值；若隔了 ≥2 天才打开，昨日显示 **0**（不能把更早的今日误当成昨天）。
- **总**：历史总和，与现 `total` 同口径，三种模式共享。

**建议字段（仍写同一键 `dianzi-muyu-v1`，加 `schemaVersion` 做迁移）**

```js
{
  schemaVersion: 2,

  // —— 功德（共用池）——
  total: 0,              // 总
  sessionMerit: 0,       // 本次
  todayDate: "2026-09-15", // 本地 YYYY-MM-DD
  todayMerit: 0,         // 今日
  yesterdayMerit: 0,     // 昨日快照

  // —— 分模式（仅展示，不参与日切主列表）——
  muyu: 0, beads: 0, bowl: 0,

  // —— 皮肤 / 自动（现有）——
  skins: { muyu, beads, bowl },
  unlockedSkins: [],
  autoUntil: 0,          // 快敲到期时间戳

  // —— v1.1 自动融合（可选）——
  slowAutoOn: false      // 免费慢敲，不跨冷启动持久化也可；若持久化需在 onLaunch 关掉以免误敲
}
```

**迁移（旧包无日切字段）**

- `total` / 分模式 / 皮肤 / `autoUntil` 原样保留。
- `sessionMerit = 0`，`todayMerit = 0`，`yesterdayMerit = 0`，`todayDate = 今天`。
- **不要**用旧 `total` 去填今日（无法还原「今天敲了多少」）。

**日切伪代码（`onLaunch`、`index.onShow`、每次 `bump` 前都跑）**

```js
function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a, b) { // a/b 为 YYYY-MM-DD
  const parse = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(b) - parse(a)) / 86400000);
}

function rollover(state) {
  const today = localDateKey();
  if (!state.todayDate) {
    state.todayDate = today;
    state.todayMerit = state.todayMerit || 0;
    state.yesterdayMerit = state.yesterdayMerit || 0;
    return;
  }
  if (state.todayDate === today) return;

  const diff = daysBetween(state.todayDate, today);
  state.yesterdayMerit = diff === 1 ? state.todayMerit : 0;
  state.todayMerit = 0;
  state.todayDate = today;
}
```

**`bump(kind)` 新口径**

```js
rollover(this.state);
this.state.total += 1;
this.state.sessionMerit += 1;
this.state.todayMerit += 1;
this.state[kind] += 1;
this.save();
```

**会话起点**

- 在 `App.onLaunch` 把 `sessionMerit` 置 0 并 `save`（需已过隐私门）。
- 页面 `onLoad` 只读取，不再二次清零（避免热重载以外的重复清空；以 App 生命周期为准）。
- 若隐私未同意：内存里仍可加本次/今日，但不落盘（与现 `save` 行为一致）。

**隐私文案**：`PRIVACY.md` 现已覆盖「功德计数」。v1.1 落地后补一句「含本次/今日/昨日/总及分模式累计，均仅存本机」。

---

### 3.2 功德数据页

**产品行为**

对标竞品：黑底浅字列表，顶栏返回，四行主数据。我们多一块「分模式」，强化三 Tab 价值，避免用户以为只有木鱼在计数。

建议展示：

```
← 功德数据

本次功德          12
今日功德         128
昨日功德          56
总功德         1024

—— 分模式累计 ——
木鱼             800
念珠             150
颂钵              74
```

数字用顶栏同款金色 `#e8c56a`。昨日为只读，无「补记」。不在此页放广告、不放皮肤入口。

**页面 / route**

- 新增 `pages/stats/stats`（`js` / `wxml` / `wxss` / `json`）。
- `app.json`：`pages` 数组把 stats 放在 index 之后：`["pages/index/index", "pages/stats/stats"]`。
- `stats.json`：`navigationStyle: "custom"`，与主页一致；自绘返回（`wx.navigateBack`）。
- 进入：`wx.navigateTo({ url: "/pages/stats/stats" })`。
- `onShow` 再读一次 storage 并 `rollover`，避免主页挂着跨天后数据页仍是旧今日。

**数据读取**

统计页不要复制一份 `state` 逻辑。建议抽 `mp-weixin/utils/merit.js`（v1.1 实施时）：

- `loadMeritState()` / `saveMeritState()`
- `rollover(state)`
- `formatMerit(n)`（千分位可选，v1.2）

index 的 `loadState`/`save`/`bump` 改为调用同一模块，避免两页日切不一致。

**UI**

- 背景 `#0d0a06`，不用佛像。
- 行高舒适，四主行字号大于分模式。
- 无图表、无分享截图（P2 以后再说）。

**与 P0 合规**

- 只读本地缓存，不新增权限。
- 拒绝隐私协议时：页面仍展示内存/默认 0，并沿用现有 toast「进度将不保存」。

---

### 3.3 重置

**产品定义（推荐）**

| 动作 | 清什么 | 不清什么 | 确认 |
|------|--------|----------|------|
| 主路径「重置」 | 仅 `sessionMerit = 0` | 今日/昨日/总、分模式、皮肤、自动 | 一次 `wx.showModal`：「将本次功德清零，今日与总计不受影响」 |
| 数据页底部「清空全部功德」 | `sessionMerit/todayMerit/yesterdayMerit/total/muyu/beads/bowl = 0`，`todayDate = 今天` | `skins`、`unlockedSkins`、`autoUntil` | **两次**：第一次说明不可恢复；第二次输入或再次确认 |

**不推荐**：一键清总却叫「重置」（竞品截图未标明范围，我们必须写清楚）。  
**不推荐**：重置时关自动/锁皮肤（用户会觉得被惩罚）。

主界面重置入口：v1.1 可先放在数据页顶部按钮或主页状态行旁小字「重置本次」；v1.2 再放到右栏循环箭头。

伪代码：

```js
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
}
```

---

### 3.4 自动：toggle vs 广告

**现状**：底部「视频 · 自动敲」→ `watchRewarded` → `grantAuto` 5 分钟 / 550ms；到期 `clearAuto`。游客或空广告位直接成功。进行中按钮 `disabled`，**不能中途关掉**（只能等 5 分钟）。这是体验债。

**参考品**：右侧槌 icon，纯 toggle。

**推荐融合（v1.1 就做，不必等右栏）**

| 档位 | 间隔 | 如何打开 | 如何关闭 | 是否持久 |
|------|------|----------|----------|----------|
| 关 | — | — | — | — |
| **慢敲（免费）** | 1200ms | 点「自动」toggle | 再点同一入口 | 不跨 `onLaunch`；`onShow` 可恢复本进程内状态 |
| **快敲（广告）** | 550ms（现有） | 看完激励视频，时限 5 分钟 | 随时可关；关后剩余时间可作废或冻结到下次再开（推荐 **作废**，规则简单） | `autoUntil` 仍可写盘，但用户手动关闭则清 0 |

交互建议：

1. 自动入口默认 = **免费慢敲开关**（对标竞品「一键自动」）。
2. 慢敲开启后，状态行：`自动慢敲中 · 点此看视频加速`；点加速才走 `utils/ad.js`。
3. 快敲中状态行保持现有倒计时；入口高亮，再点 → `showModal`「关闭自动敲击？」→ `clearAuto` + `autoUntil = 0`。
4. 底部「视频 · 自动敲」v1.1 **保留**（广告变现入口清晰）；若已在快敲则改为「关闭自动」或 disabled+倒计时。v1.2 收到右栏后，底部此钮可改成次要或只留「视频 · 皮肤」。
5. **不推荐**纯免费无限快敲：与现广告设计冲突，且易被判诱导无节制挂机。
6. **不推荐**自动只走广告、没有 toggle 关：竞品预期是可控开关；我们必须能关。

合规：

- 快敲奖励继续只在 `watchRewarded.onSuccess`（看完）发放。
- `IS_TOURIST` / 空 `REWARDED_AD_UNIT_ID` 仍走「开发版：已跳过广告」——提审前若不开流量主，快敲等于免费，需在提审说明里接受，或临时关掉快敲只留慢敲。
- 自动敲当前 Tab（木鱼/念珠/颂钵）的行为 **保持**，这是差异化。

---

### 3.5 右侧竖栏 UI × 三 Tab 融合

**不要做的事**

- 不要用右栏替换底栏 Tab。
- 不要为了「更像竞品」去掉皮肤按钮。
- 不要把右栏做到胶囊菜单下方重叠（`statusPad` 已按菜单按钮避让，右栏 top 需 ≥ `statusPad + 8`）。

**推荐信息架构**

```
[顶栏 品牌 | 功德 pill]
[舞台：道具居中]
              [右栏悬浮]
              数据
              重置
              自动
[工具栏：皮肤 | 视频自动 | 视频皮肤]   ← v1.1 保留，v1.2 可精简
[邀请好友]
[木鱼 | 念珠 | 颂钵]                   ← 永不移除
```

右栏样式：竖排 3 个 44px 热区，图标 + 12px 字，半透明底，不挡槌挥击（木鱼槌在右上，右栏应 **垂直居中偏下**，避开 `.muyu-mallet`）。念珠轨道偏左，右栏更安全；颂钵槌也在右侧，同样避开舞台右上。

v1.1 无右栏时的等价入口（保证功能先于视觉）：

- 顶栏 pill **可点** → 数据页。
- 数据页内重置。
- 底部已有自动按钮，按 §3.4 改成可关的 toggle。

v1.2 再加右栏，pill 仍可点击（双入口可接受）。

**浮字（v1.2）**

- 主路径仍「功德 +1」文案（品牌感）；可加轻量金色 `+1` 在敲击热点（木鱼 `flash-muyu` 坐标附近）。
- 不必做成完全随机满屏。

**专注模式（v1.2 可选）**

- 长按木鱼 Tab 或设置项：「专注木鱼」隐藏念珠/颂钵 Tab，右栏仍在。
- 默认关闭。不是默认形态。

---

### 3.6 与现有广告 / 启动 / 隐私模块的衔接

| 模块 | 现状 | v1.1 改动面 |
|------|------|-------------|
| `config/launch.js` | `IS_TOURIST`、`REWARDED_AD_UNIT_ID: ""` | 不必改。自动快敲仍读这两项 |
| `utils/ad.js` | 未初始化真广告则跳过并发奖；看完才 `onSuccess` | 不必改 API。index 增加「关自动」路径，不经过广告 |
| `app.js` | 隐私门 + `whenPrivacy` | `onLaunch` 增加 `sessionMerit = 0`（同意后再写盘） |
| `index.save` | 未同意不写盘 | 日切字段同样受门控 |

---

### 3.7 包体与性能

- 统计页零新图，列表即可。
- 右栏用 text / 简单 SVG data-uri，或现有金色描边按钮，不引入 icon 字体包。
- 日切是几次字符串比较，不要每 tick 写 storage；`bump` 已有 `save`，`autoTick` 500ms **不要**每次 `setStorageSync`。
- 精修木鱼维持分层 2D，禁止 Three.js。

---

## 4. 分期路线图

### 4.1 当前 = v1.0（已具备，可提审）

三 Tab + 精修皮肤 + 本地总功德 + 激励视频解锁（或开发跳过）+ 5 分钟快敲 + 分享 + 隐私门。  
**不做**数据页也能上线。

### 4.2 v1.1 最小对标（建议下一迭代）

目标：功德口径对齐竞品，入口先用现有顶栏/底栏，不动大布局。

- [ ] `utils/merit.js`：schema v2、rollover、迁移
- [ ] `bump` 写入本次/今日/总
- [ ] `App.onLaunch` 清本次
- [ ] `pages/stats/stats`：四行 + 分模式 + 返回
- [ ] 顶栏 pill 点击进入数据页（右栏以后再加）
- [ ] 重置本次（Modal 一次）；数据页「清空全部」二次确认
- [ ] 自动：**可关闭**；免费慢敲 toggle + 视频快敲 5 分钟（仍走 `ad.js`）
- [ ] 更新 `PRIVACY.md` 功德字段说明
- [ ] `app.json` 注册 stats

刻意不做：右栏、浮字改版、专注模式、换背景。

### 4.3 v1.2 体验

- [ ] 舞台右侧竖栏：数据 / 重置 / 自动（避让胶囊与槌）
- [ ] 浮字改为敲击点附近金色 `+1`（可保留「功德」字样）
- [ ] 可选「专注木鱼」隐藏 Tab
- [ ] 工具栏精简：皮肤保留；视频自动若已上右栏则降级或合并
- [ ] 数据页千分位、空状态文案

### 4.4 明确不做

- 不把标题改成竞品名「功德木鱼」。
- 不删除念珠/颂钵，不把皮肤做成可有可无。
- 不换佛像剪影背景（版权 + 宗教审核风险），除非产品明确提供自有授权氛围图。
- 不上 Three.js、不上排行榜/云同步（隐私声明将升级为收集用户数据）。
- 不把自动快敲改成无广告永久开启（与流量主设计冲突）。

---

## 5. 可选骨架（本轮不落地，实施 v1.1 时再建）

仅作路径备忘，**不要在本任务改 `index` 大布局**。

```
mp-weixin/pages/stats/stats.json   navigationStyle: custom
mp-weixin/pages/stats/stats.wxml   返回 + 四行 list + 分模式
mp-weixin/pages/stats/stats.wxss   黑底金字，对齐 index 色板
mp-weixin/pages/stats/stats.js     onShow → merit.load + rollover → setData
mp-weixin/utils/merit.js           纯函数，index / stats / app 共用
```

`app.json` 增加 `"pages/stats/stats"`。index 仅加 `openStats`（pill `bindtap`），其余 UI 不动。

---

## 6. 质量检查清单（当前 App，v1.0 回归）

对标功能未做之前，下列 **已实现项必须保持不回归**。

### 6.1 三模式与交互

- [ ] 底栏三 Tab 切换木鱼 / 念珠 / 颂钵，hint 文案跟随
- [ ] 木鱼点击：槌挥击、body 缩放、闪光；90ms 节流
- [ ] 精修木鱼：ground / shade / spec / rim / mallet 分层；`premium` 透视与 `bodyHitPremium`
- [ ] 念珠：下滑累计、`BEAD_COMMIT` 松手提交、自动敲走 `autoCommitBead` 而非直接 `onTap`
- [ ] 颂钵：槌挥击、涟漪、黄铜 `bowlFlip`
- [ ] 三套音效 `innerAudio` + 轻震动；静音开关忽略（`obeyMuteSwitch = false`）
- [ ] 浮字出现并在 ~1s 内消失，不挡住点击（`pointer-events: none`）

### 6.2 皮肤

- [ ] 木鱼：樟木/花梨免费；紫檀、精修·紫檀需解锁
- [ ] 精修·樟木 / 精修·花梨免费且 `premium: true`
- [ ] 念珠檀木/青玉免费，紫檀锁定；颂钵黄铜/鎏金免费，乌金锁定
- [ ] 皮肤 sheet 分组：木鱼「经典 / 精修」；选中描边；锁定「需解锁」
- [ ] 看视频解锁当前模式 **下一档未解锁** 皮肤；全解锁时 toast
- [ ] 解锁状态写入 `unlockedSkins`，免费列表与 `FREE_UNLOCKS` 合并去重

### 6.3 功德与存储

- [ ] `bump` 同时 `total++` 与对应模式 ++
- [ ] 顶栏 pill 显示 `total`
- [ ] 隐私未同意不 `setStorageSync`；同意后可写
- [ ] 卸载/清缓存后进度消失（与隐私稿一致）

### 6.4 自动敲与广告

- [ ] `initRewardedAd` 在 `onLoad` 调用
- [ ] 游客 AppID 或空广告位：toast「开发版：已跳过广告」并发奖
- [ ] 真广告：未看完 →「需看完视频才能领取」，不发奖
- [ ] 自动 5 分钟、550ms、状态行倒计时 `m:ss`
- [ ] `onShow` 若未过期则恢复定时器
- [ ] `onUnload` `clearAuto` + destroy audio
- [ ] 进行中自动按钮 disabled（v1.1 应改为可关闭，届时更新本条）

### 6.5 启动 / 合规 / 包体

- [ ] `navigationStyle: custom`，`statusPad` 避让胶囊
- [ ] `__usePrivacyCheck__: true`；`PRIVACY.md` 可粘贴后台
- [ ] 不申请定位/相册/麦克风等
- [ ] `launch.js` 不写 AppSecret；AppID 来自 `getAccountInfoSync`
- [ ] 分享卡片能打开 `/pages/index/index`
- [ ] 无 Three.js；精修 WebP 仍走 `/assets/skins/premium/`
- [ ] 类目按 `LAUNCH.md`：工具/效率或文娱/休闲，避免宗教类目
- [ ] 邀请按钮 `open-type="share"` 在开发者工具可点

### 6.6 已知债（v1.1 一并修更好）

- [ ] 自动进行中无法手动停止
- [ ] 跨自然日打开时 `total` 不会分成今日/昨日（用户无感知，但数据页上线前必须日切正确）
- [ ] README 仍写 Web 原型「1.5s 假广告」，与小程序 `ad.js` 不一致，文档易误导
- [ ] 主界面无重置，误触连点只能靠心理预期，不能清「本次」

---

## 7. 建议决策（写入产品备忘）

| 议题 | 决定 |
|------|------|
| 功德池 | 三模式共用 `total` / 今日 / 本次 |
| 分模式 | 只作成数据页附录，不单独做「木鱼今日」 |
| 重置默认 | 只清本次；清总走数据页二次确认 |
| 自动 | 免费慢敲 toggle + 广告快敲 5 分钟；必须能关 |
| 右栏 | v1.2；v1.1 用 pill 进数据页 |
| 标题/背景 | 保持「电子木鱼」与 `bg-zen`，不抄竞品 |
| 差异化 | 三 Tab + 精修皮肤为默认形态，专注模式仅可选 |

---

## 8. 实施顺序（给下一任开发）

1. 抽 `utils/merit.js` + 迁移，单测日切：同日 / 隔 1 天 / 隔 N 天 / 缺字段。  
2. 改 `bump` 与 `App.onLaunch` 会话。  
3. 建 `pages/stats`，pill 跳转。  
4. 重置 Modal。  
5. 自动可关 + 慢敲档位。  
6. 回归 §6 清单（尤其精修分层、念珠手势、广告跳过）。  
7. v1.2 再动右栏与浮字。
