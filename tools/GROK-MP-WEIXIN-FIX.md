# Grok 修改任务书：微信小程序 `mp-weixin` 对齐 Web 并修复颂钵槌

> **给谁**：Grok（或其它执行型模型）  
> **仓库路径**：`C:\Users\MOON\Desktop\dianzi-muyu`  
> **只改目录**：`mp-weixin/`（除非为拷贝资源必须动 `assets/`，一般不要动 `index.html`）  
> **不要**：git commit、删资源、接真广告 SDK、改 AppID（保持 `touristappid`）

---

## 背景

原生小程序页：`mp-weixin/pages/index/`。Web 参考：`index.html`（本地 `http://127.0.0.1:8848/` 或任意静态服打开）。

**已确认 P0**：微信开发者工具 → 颂钵 Tab → **鼓槌不显示**。钵体、点击音效/动画仍可能有，但槌图层宽度为 0。

**根因（高置信）**：`.bowl-mallet-wrap { width: auto }` + `<image mode="aspectFit">` + CSS `width: auto; height: 100%`。小程序 `image` 在父宽未定时宽度常解析为 **0**（开放社区同类问题）。Web 里 `<img>` 同 CSS 约 **20×104px** 仍可见，小程序不行。

槌素材已在包内：`mp-weixin/assets/skins/bowl-mallet-brass.webp` 等（约 101×512 RGBA）。

---

## 任务清单（按顺序做，做完自测）

### Task 1 — 修复颂钵槌显示（必做，P0）

**目标**：颂钵 Tab 下槌在钵右上方可见，比例与 Web 接近；黄铜皮肤 `bowlFlip` 仍正确（握把在上）。

**推荐实现（二选一，优先 A）**

**A. `heightFix` + 明确父高（推荐）**

1. `index.wxml` 颂钵槌：
   - `mode="aspectFit"` → **`mode="heightFix"`**
   - 可选：给 `<image>` 加 `style="height: 100%;"`（若纯 class 不够）

2. `index.wxss`：
   - `.bowl-mallet-wrap`：保留 `height: 46%`（父 `.stage-bowl` 已 `height: 225px`），去掉靠不住的 `width: auto` / `max-width: 42%`，改为 **`width: 22px`** 或 **`min-width: 20px`**（Web 折算约 20px 宽），`overflow: visible`
   - `.bowl-mallet-img`：`height: 100%`；**不要**只写 `width: auto` 而不配合 `heightFix`
   - 阴影：可与 Web 一致放在 wrap 上 `filter: drop-shadow(...)`（避免某些基础库对 image filter 异常）

3. **动画兼容**：`.bowl-mallet-wrap.swing` 的 `bowlTap` keyframes 在 wrap 上；`.mallet-flip` 在 image 上 `scaleY(-1)`。确认 swing 时 flip 不被冲掉（必要时 flip 包一层 `<view>`）。

**B. 固定 rpx（备选）**

- wrap：`height: 104rpx; width: 20rpx;`（按 300px 舞台等比微调），image `mode="heightFix"` 或 `widthFix` 二选一，以**开发者工具肉眼对齐 Web 截图**为准。

**验收**

- [ ] 开发者工具模拟器：颂钵 → 槌可见，位置在钵右上方，略倾斜
- [ ] 切换黄铜/鎏金/乌金皮肤，槌图切换正常；黄铜仍 flip
- [ ] 点击颂钵：槌 swing、涟漪、闪光、音效、功德 +1
- [ ] 控制台无 `image` 404

---

### Task 2 — 木鱼槌比例对齐 Web（P1）

**参考 Web**（`index.html`）：`.muyu-mallet-img` 为 `width: 66%; height: auto`（小程序里是独立 `<image class="muyu-mallet">`）。

**改** `index.wxss` `.muyu-mallet`：

- 去掉固定 `height: 72px`
- 改为与 Web 一致：`width: 66%; height: auto;`（WXML `mode="widthFix"` 或 `aspectFit` 按小程序文档选能撑开高度的那种）

**验收**：木鱼 Tab 槌大小与 Web 同屏对比无明显「过短/过长」。

---

### Task 3 — 念珠与 Web 一致（P1）

1. `index.js`：`VISIBLE_BEADS` **8 → 6**（与 `index.html` 一致）
2. `index.wxss`：`.bead-track` 增加与 Web 相同的一层阴影：  
   `filter: drop-shadow(0 8px 12px rgba(0,0,0,.35));`
3. 确认 `margin-top: -64px` 仍在；下滑拨珠手感正常

**验收**：可见约 6 颗；阴影层次接近 Web。

---

### Task 4 — 模拟广告弹层 UX（P1）

**现状**：皮肤 sheet 有 `sheet-mask`；广告 sheet **没有**遮罩，无法点空白关闭。

**改** `index.wxml` 广告块，结构与皮肤一致：

```xml
<view class="sheet {{adShow ? 'show' : ''}}">
  <view class="sheet-mask" bindtap="finishAd" wx:if="{{!adBusy}}"></view>
  <!-- 或 bindtap 仅关闭：需与 finishAd 逻辑一致，busy 时不关 -->
  <view class="sheet-card ad-panel" catchtap="noop">...</view>
</view>
```

**逻辑**：`adBusy === true` 时 mask 不响应关闭；结束后可点 mask 关闭（若产品要「必须点领取」，则 mask 仅 `adBusy=false` 时显示且 `finishAd` 与按钮同逻辑）。

**验收**：广告弹出时有半透明全屏遮罩；播放中不能误关；结束后可关。

---

### Task 5 — 自动敲念珠动效（P2，可选但建议）

**现状**：`startAutoIfNeeded` 里念珠分支只调 `commitBead()`，无 `beadOffset` 过渡。

**改**：在 `commitBead(fromAuto)` 或自动敲分支里：

- 短促 `setData({ beadOffset: BEAD_PX * 0.5 })` 再归零，或复用手滑 `beadDropping` 的 200ms transition（勿阻塞 `beadBusy` 逻辑）

**验收**：自动敲时念珠有轻微下滑动画，不卡死手滑。

---

## 不要改 / 不要 scope creep

| 项 | 说明 |
|----|------|
| 背景 | 保持 `<image class="bg-img" src="/assets/bg-zen.webp">`，勿改回 WXSS `background-url` |
| 真广告 | 仍用 1.5s 模拟，勿接 `createRewardedVideoAd` |
| AppID | 保持 `project.config.json` 的 `touristappid` |
| Web 版 | 不同步改 `index.html`，除非用户另说 |
| 坐垫皮肤 | 已废弃，勿加 `bowl-cushion` |

---

## 自测命令（Windows）

```bat
"D:\微信web开发者工具\cli.bat" auto --project "C:\Users\MOON\Desktop\dianzi-muyu\mp-weixin" --trust-project
```

Web 对照（可选）：

```bat
python -m http.server 8848 --directory "C:\Users\MOON\Desktop\dianzi-muyu"
```

浏览器打开 `http://127.0.0.1:8848/index.html` → 颂钵 Tab 截图对比。

---

## 交付物（Grok 完成后应说明）

1. 改了哪些文件、每项 Task 对应 commit 级摘要（用户未要求 commit 则只列文件）
2. Task 1 前后：颂钵截图或描述「槌约 20px 宽、104px 高量级」
3. 未做 Task 5 需写明原因

---

## 给 Grok 的一行 Prompt（可直接复制）

```
请阅读仓库 tools/GROK-MP-WEIXIN-FIX.md，只修改 mp-weixin/，按 Task 1→4 顺序完成；Task 5 有时间再做。重点：颂钵 bowl-mallet 用 heightFix + 父级明确宽高，解决 image 宽度为 0。改完运行 cli auto 编译并在回复里按验收清单勾选说明。不要 git commit。
```
