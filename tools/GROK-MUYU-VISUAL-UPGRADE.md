# Grok 任务书：木鱼形象优化（精致真实 · 伪 3D / 测试先行）

> **给谁**：Grok（执行型模型 + 如需出图可用图像能力）  
> **仓库**：`C:\Users\MOON\Desktop\dianzi-muyu`  
> **用户诉求**：微信开发者工具里木鱼「建模感」不够；皮肤要**精致、真实**，最好有 **3D 效果**；**先做一个小测试**看效果再铺开。  
> **不要**：git commit；不要动颂钵/念珠逻辑（除非测试页独立）；不要接广告/SDK；AppID 保持 `touristappid`。

---

## 1. 现状（Grok 须先自己打开看）

| 项 | 说明 |
|----|------|
| 渲染 | 单张 `<image class="prop-img">` + 槌 wrap，`.stage-muyu` 300×240px |
| 皮肤 | `muyu-amber / jade / inkgold`（樟木 / 花梨 / 紫檀），WebP 在 `mp-weixin/assets/skins/` |
| Web 源图 | `assets/skins/muyu-*.png` 约 1024×768 RGBA；小程序约 **800×600** WebP ~47KB |
| 动效 | `bodyHit` 缩放、槌 `muyuTap`、`.hit-flash` |
| 局限 | 小程序无 DOM filter 全套；**多层 `<image>` + WXSS transform** 比 WebGL 稳；单图解码建议 **≤2048 边长、注意包体** |

**问题方向（供 Grok 验证，可补充）：** 平、像抠图贴纸；缺地面接触影；木纹高光弱；敲击时缺体积感（没有「厚木块」阴影变化）。

**参考**：同仓库 `index.html` 木鱼舞台、`assets/ref-clip/` 若有参考帧可看光影方向（勿整包拷进 mp）。

---

## 2. 目标（测试版 vs 终版）

### 测试版（Phase 0，本任务必做）

- 仅 **一种木**（建议 **樟木 `amber`**）做 **Premium 测试皮**。
- 在微信开发者工具里能 **一键或切皮肤看到** 与现皮 **A/B 对比**。
- 肉眼：更有 **立体木块感**（侧缘暗、顶面亮、嘴部内凹），底下有 **接触阴影**；轻点时有 **体积反馈**（略压扁 + 高光闪 + 阴影加深）。
- **不要求** 真 WebGL；允许 **2.5D 分层 + perspective**。

### 终版（Phase 1+，本任务仅写 TODO，除非 Phase 0 很快完成）

- 三套木 + 配套槌统一光影方向；Web 同步 PNG（可选）；mp WebP 压缩。

---

## 3. 推荐技术路线（Grok 按优先级选，Phase 0 用 A 或 A+B）

### 路线 A — 2.5D 分层（**Phase 0 首选**）

在 `stage-muyu` 内由底到顶：

1. **ground-shadow** — 椭圆软阴影 PNG（或纯 WXSS `radial-gradient` 圆，小程序里 gradient 在 view 上可用）
2. **body** — 主木鱼 RGBA（精修纹理）
3. **body-shade** — 同轮廓、边缘暗部 multiply 感（**低 opacity 叠图**，~0.35–0.5）
4. **body-spec** — 同轮廓、高光（~0.15–0.25 opacity，可选）
5. **mallet** — 与现逻辑兼容的槌图（测试可先沿用 `muyu-mallet-amber.webp`）

舞台容器：

```css
.stage-muyu.premium {
  perspective: 900px;
  transform-style: preserve-3d;
}
.stage-muyu.premium .instrument-body {
  transform: rotateX(6deg); /* 轻微俯视，像放在桌上 */
}
```

敲击时：`bodyHit` 增加 `rotateX` 微变 + `scale(0.97)`，阴影层略放大变淡。

**素材命名（测试）** — 放入 `mp-weixin/assets/skins/test/`：

- `muyu-premium-body.webp`
- `muyu-premium-shade.webp`（可省略若一张里 baked 好）
- `muyu-premium-spec.webp`（可选）
- `muyu-premium-ground.webp`（可选）

### 路线 B — 精修单图 + 舞台光影（改动最小）

- 只换一张 **烘焙好明暗** 的 body WebP（侧光 45°、嘴内阴影、木孔细节）。
- WXSS 加 **ground shadow view** + `perspective` 仅容器。
- 适合快速对比「只换皮 vs 分层」。

### 路线 C — Canvas 伪 3D（**仅独立测试页**，勿默认上线）

- 新建 `pages/muyu-lab/index`（需在 `app.json` 注册），用 **type="2d" canvas** 绘制木鱼轮廓 + 简单 Phong/法线贴图若 Grok 能生成 normal map。
- 包体与维护成本高；**Phase 0 仅在 A 不满意时做 1 页 lab**。

### 路线 D — 真 3D（Blender → 序列帧 / 小视频）

- 超出 Phase 0；在文档末尾记为 Future。

---

## 4. Phase 0 实施任务（Grok 执行清单）

### Task 0.1 — 测试开关（必做）

任选一种，**要能在开发者工具里切换**：

- **方案 1**：皮肤列表加一项 `premium-test`（仅开发用，`SKINS.muyu` 临时 push，`free: true`，name「测试·精修樟木」）；或  
- **方案 2**：`index.js` `data.muyuPremiumTest: true` + 顶部临时 `switch`（仅 `#ifdef` 不行，用注释说明上线前删）；或  
- **方案 3**：独立页 `pages/muyu-lab/index` 只显示木鱼舞台。

**推荐方案 1**，与现有 `applySkin('muyu', id)` 一致。

### Task 0.2 — 素材（必做）

Grok 用 **图像生成 / 修图** 或 Python（`tools/cutout_wood_skins.py` 仅当源是品红幕 PNG）产出：

**硬约束**

- **轮廓与现 `muyu-amber` 一致**（同一角度、开口朝向、比例）；换皮后槌位置、`.flash-muyu` 仍合理。
- **透明底 RGBA** → 导出 WebP 到 `mp-weixin/assets/skins/test/`。
- 单文件建议 **宽 ≤1024**，WebP 质量 ~82，单张 **<120KB**（测试可略大，三件叠层合计 **<300KB**）。
- 光影：**主光左上或左前上**（与背景 `bg-zen.webp` 暖色一致）；**禁止** 品红溢色、硬锯齿。

**出图 Prompt 模板（Grok 可改词）**

> Top-down 3/4 view wooden Chinese temple muyu (wooden fish percussion block), single object centered, **realistic camphor wood grain**, carved mouth slot with **deep interior shadow**, smooth polished edges with subtle specular, studio quality, **soft ground contact shadow baked or separate**, transparent background, no mallet, no text, game asset, consistent with reference silhouette.

配套槌（可选 Phase 0）：同木材、同光照的 `muyu-premium-mallet.webp`。

### Task 0.3 — WXML/WXSS（必做）

- 当 `currentSkin === 'premium-test'`（或等价 flag）时：
  - 给 `.stage-muyu` 加 class `premium`
  - 渲染分层结构（见路线 A）；默认皮肤 **保持现 WXML 单图**，避免回归。
- 调整 `.prop-img` / 分层 image 的 `mode="aspectFit"`，父盒仍 `.instrument-body` inset 与现一致。
- **不要破坏** 已修好的槌 wrap（50px 高、`muyuTap` 方向）。

### Task 0.4 — 动效增强（建议）

- `bodyHit`：premium 模式下多 40–60ms 阴影层动画。
- 可选：嘴部 `hit-flash` 略移向开口中心（仅 premium）。

### Task 0.5 — 自测与交付（必做）

```bat
"D:\微信web开发者工具\cli.bat" auto --project "C:\Users\MOON\Desktop\dianzi-muyu\mp-weixin" --trust-project
```

**交付给父 Agent / 用户：**

1. Phase 0 前后对比说明（文字 + 若在 IDE 截图更好）  
2. 新增/修改文件列表  
3. 包体增量（test 目录总 KB）  
4. A/B 切换步骤（例如：木鱼皮肤 → 选「测试·精修樟木」）  
5. Phase 1 建议（是否值得上三层 / 是否换 Canvas）

---

## 5. 验收标准（Phase 0）

- [ ] 默认樟木皮与 **测试皮** 可切换，颂钵/念珠无回归  
- [ ] 测试皮：可见 **木纹细节 + 嘴内暗部 + 地面影** 至少满足其二；整体 **不像 flat 贴纸**  
- [ ] 有 **轻微 3D 透视**（rotateX 或等效）且敲击时 **有体积反馈**  
- [ ] 槌动画仍为 **从上往下**  
- [ ] CLI 编译通过；无 image 404  

---

## 6. 禁止 / 范围

| 禁止 | 原因 |
|------|------|
| 整包替换所有皮肤而不做测试 id | 用户要求先测试 |
| 引入大型 three.js/miniprogram-3d 依赖 | 包体与审核风险 |
| 修改 `index.html` 除非同步 Web 预览（可选，非必须） |
| 删除旧 `muyu-*.webp` | 保留 A/B |

---

## 7. Phase 1  backlog（Grok 只记录，Phase 0 通过后再做）

- 花梨、紫檀 premium 三套 + 槌  
- 统一导出脚本：`tools/export_mp_skins.py`（PNG→WebP resize）  
- Web `index.html` 可选 premium 皮肤  
- 若 2.5D 成功：考虑嘴部 **微位移** 帧动画（2–3 帧 WebP 或 CSS）

---

## 8. 给 Grok 的一行 Prompt（Phase 0 仅测樟木）

```
请阅读 tools/GROK-MUYU-VISUAL-UPGRADE.md，只做 Phase 0（Task 0.1–0.5）：为 mp-weixin 增加「测试·精修樟木」premium 木鱼（2.5D 分层或精修单图+地面影+perspective），素材放 mp-weixin/assets/skins/test/，与现 amber 皮 A/B 可切换。精致真实、伪 3D 效果优先。不要 git commit。完成后 cli auto 编译并写清切换步骤与包体增量。
```

---

## 9. 父 Agent 复核项（给 Cursor 主会话）

- Diff 是否仅 mp + test 资源  
- 默认皮肤 regression：木鱼/槌/计数  
- 对比 `assets/skins/muyu-amber.png` 与 test 轮廓（可用 PIL alpha bbox 差分，允许 ±5%）  
