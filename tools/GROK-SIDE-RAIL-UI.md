# Grok 任务书：主界面右侧竖栏 + 功德 UI 精修

> **参考图**：用户提供的右侧三钮截图（数据 / 重置 / 自动）。  
> **范围**：仅 `mp-weixin/pages/index/*`、`mp-weixin/pages/stats/*` 的 WXML/WXSS；**不改** `index.js` 业务逻辑（bindtap 名保持不变）。  
> **不要** git commit。不要动 `tools/` 以外的大包资源目录（可新增 `mp-weixin/assets/ui/` 小图标）。

---

## 1. 目标

把当前「emoji + 细条按钮」的 `.side-rail` 做成与参考图一致的 **禅意金边方卡竖栏**，并与全页 `#0d0a06` / `#e8c56a` 色板统一。顺带轻量 polish：**功德 pill**、**+1 浮字**、**功德数据页**列表样式。

---

## 2. 参考视觉（必须对齐）

| 元素 | 描述 |
|------|------|
| 容器 | 舞台右侧，垂直居中略偏下（`top: 56%–60%`），不挡木鱼槌右上挥击 |
| 单钮外形 | **近方形**圆角卡片（约 52×56rpx 量级，或 48px 宽），**细金边** `1px rgba(201,162,39,.45)`，底 `rgba(8,6,4,.72)` 或透明黑 |
| 间距 | 三钮间距 12–14px |
| 数据 | 上图：小型 **柱状图**（绿/粉/蓝三根），非 emoji 📊 |
| 重置 | **线型白色↻** 圆箭头，2px 描边风格，非字符 ↺ |
| 自动 | **木桩/短木** 小插画（棕褐），与木鱼主题一致，非 emoji 🪵 |
| 文案 | 图标下 **「数据」「重置」「自动」**，11px，`#f5e6c8` 或略灰，active 时 `#e8c56a` |
| active | 自动开启（慢敲或快敲）时：金边加亮 + 极淡金底，**不要**整钮填饱和色 |

---

## 3. 实现约束（微信小程序）

1. **图标**：优先 `mp-weixin/assets/ui/rail-data.png`（或 `.webp`）等 **≤3KB/张**；或用 **inline SVG → base64** 的 `<image src="data:image/svg+xml;...">`（注意 URL encode）。禁止引入 iconfont 包。
2. **WXML**：保留现有结构类名与事件：
   - `openStats` / `onRailResetSession` / `onRailAuto`
   - `class="rail-item {{autoOn || slowAutoOn ? 'active' : ''}}"` 仅第三个
3. **触控**：热区 ≥ 44×44px；`:active` 微缩放 0.97 + 透明度即可。
4. **安全区**：右栏 `right: 10px`；若与胶囊冲突，用 `max(right, env(safe-area-inset-right))` 思路（可用 `padding-right` on `.phone` 已有则只微调）。
5. **stats 页**：黑底列表行加 **左标签右数字** 对齐、分隔线 `rgba(232,197,106,.12)`、总功德行略强调；返回钮与 index 顶栏风格一致。**不改** stats.js。

---

## 4. 交付清单

- [ ] `index.wxml`：三钮改为 image 图标 + label（或 background 图标）
- [ ] `index.wxss`：`.side-rail` / `.rail-item` / `.rail-ico` / `.rail-label` 重绘
- [x] 可选：`mp-weixin/assets/ui/rail-data.webp` / `rail-reset.webp` / `rail-auto.webp`
- [ ] `stats.wxss`（+ 必要时 `stats.wxml` 仅 class）：数据页更像参考「功德数据」黑金列表
- [ ] 轻调 `.merit-pill`、`.float-txt`（+1 更亮、字重、阴影）——小改即可
- [ ] 文末 **自检**：DevTools 编译无报错；`python tools/validate_mp_assets.py` 若新增 ui 资源需在 index 外单独存在，脚本可仍只扫 index.js skins（ui 不强制进 validate）

---

## 5. 禁止

- 不改三 Tab、不改 toolbar 四个按钮逻辑、不删邀请好友。
- 不把标题改成「功德木鱼」。
- 不加 Three.js、不加新 npm。

---

## 6. Grok 回复格式

1. 改了哪些文件（列表）  
2. 与参考图的 3 点对照（方卡 / 图标 / 间距）  
3. 已知妥协（如 SVG 与截图像素差 1–2px）  
4. 建议用户真机看的 2 条（右栏不挡槌、自动 active 态）
