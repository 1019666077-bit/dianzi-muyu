# Grok 任务书：木鱼 Premium v3 — 木纹真实 + 3D 立体感（双目标）

> **给谁**：Grok（执行 + 图像生成/修图能力）  
> **仓库**：`C:\Users\MOON\Desktop\dianzi-muyu`  
> **用户诉求**：测试皮「好了一点」，但还要 **木纹更真实** 且 **3D 立体感更强**，两者都要。  
> **前置**：Phase 0 已完成 → 皮肤 `premium-test`「测试·精修樟木」、`mp-weixin/assets/skins/test/`、`tools/build_premium_muyu.py`（程序分层 v2）、`index.wxml/wxss` 的 `.stage-muyu.premium` 多层结构。  
> **关联文档**：`tools/GROK-MUYU-VISUAL-UPGRADE.md`（Phase 0 历史）  
> **不要**：git commit；不要回归颂钵/念珠/默认三皮肤；AppID 保持 `touristappid`。

---

## 1. 双目标定义（验收必须同时满足）

### A. 木纹真实（Texture realism）

| 标准 | 说明 |
|------|------|
| 纹理 | 可见 **连续木纹走向**（非模糊色块、非重复明显 tile）；符合 **樟木** 色温（暖黄棕，非塑料橙） |
| 雕刻 | **鱼嘴开槽** 内暗、有深度；侧面 **圆角棱线** 有 subtle 高光/暗线 |
| 细节 | 允许轻微 **刀痕/毛孔**；禁止 JPEG 块、品红溢色、锯齿白边 |
| 一致性 | 与现 `muyu-amber` **轮廓 IoU ≥ 95%**（同角度、同比例，换肤后槌/闪点仍对齐） |

### B. 3D 立体感（Volume / depth）

| 标准 | 说明 |
|------|------|
| 光照 | **单一主光**：左上或左前上（与 `bg-zen.webp` 暖场一致）；右下 **环境暗** |
| 厚度 | 侧缘 **明显收暗**（不是一圈均匀描边）；顶面 **略亮** |
| 接地 | **接触阴影** 在鱼底，随 `bodyHit` 已有 `shadowHit` 动画联动 |
| 空间 | 舞台保持 **perspective + rotateX/Y**；敲击时 **压扁 + 阴影扩散**（可加强现有 `bodyHitPremium`） |
| 禁止 | 真 WebGL/three 大包；默认皮仍单图 |

**一句话验收**：开发者工具选「测试·精修樟木」，缩略图也能看出 **「一块厚木鱼」**，放大能看到 **真木头纹理**，不是滤镜贴纸。

---

## 2. 现状资产（Grok 先读再改）

```
mp-weixin/pages/index/index.wxml   — premium 四层 image + ground
mp-weixin/pages/index/index.wxss   — .stage-muyu.premium, layer opacity, bodyHitPremium
mp-weixin/pages/index/index.js     — SKINS premium-test, applySkin muyuPremium/shade/spec/ground
mp-weixin/assets/skins/test/       — muyu-premium-{body,shade,spec,ground}.webp (~77KB)
tools/build_premium_muyu.py        — 从 muyu-amber.png 程序生成（可扩展 v3）
assets/skins/muyu-amber.png        — 轮廓与纹理参考
assets/skins/muyu-premium-body.png — 当前 body 源（可覆盖）
```

**v2 局限（供 Grok 改进）：** body 仍偏「原图增强」，木纹不够摄影级；shade/spec 偏程序化，侧缘厚度感不足；槌仍用 `muyu-mallet-amber.webp`，光向不一致。

---

## 3. 推荐实施路线（**双轨并行，Phase v3 全做**）

### 轨道 1 — 高真实木纹（素材主战场）

**优先：AI 重绘 body（推荐）**

1. 以 `muyu-amber.png` 的 **alpha 剪影** 为 mask（Grok 可用 PIL：`alpha>32` 作参考图 overlay）。
2. 图像 Prompt 方向（可改词，保留约束）：

> Photorealistic Chinese temple wooden fish (muyu), **camphor wood**, carved from single block, **visible straight grain and subtle knots**, mouth slot with **deep interior shadow**, soft studio key light from **upper left**, **no mallet**, transparent background, **exact same silhouette and 3/4 angle as reference**, game asset 1024px, ultra sharp wood texture, not plastic, not cartoon.

3. 出图后：**套 mask 裁切**（防止 silhouette 漂移）→ 可选 `tools/build_premium_muyu.py` 只重生 shade/spec/ground。
4. 导出：`assets/skins/muyu-premium-body.png` + `mp-weixin/assets/skins/test/muyu-premium-body.webp`（800×600 或 1024×768，WebP q≈85，单张 body **≤90KB**）。

**备选：摄影/纹理叠加（无 AI 时）**

- 找 CC0 木纹理或 procedural（Perlin + warp）**仅在有 alpha 内** multiply/overlay。
- 在 `build_premium_muyu.py` 增 `v3` 函数：`grain_strength`, `mouth_depth`, `rim_darken` 参数；跑完写 README 注释。

### 轨道 2 — 强化 3D（分层 + 舞台）

在 **不换结构** 前提下增强（可增 1 层，总 WebP **≤120KB**）：

| 层 | v3 增强 |
|----|---------|
| `muyu-premium-shade.webp` | 侧缘 **rim AO** 加宽；右下 **core shadow**；嘴内 **独立暗区** mask |
| `muyu-premium-spec.webp` | 左上 **窄高光条**（棱线）；降低大面积白雾 |
| `muyu-premium-ground.webp` | 椭圆 **contact + 软 penumbra**；与 bbox 底对齐 |
| **可选** `muyu-premium-rim.webp` | 仅边缘 2–4px 暗线，opacity ~0.4（WXML 加一层 + `applySkin` 字段 `rim`） |

**WXSS（按需微调，勿破坏木鱼槌 50px / muyuTap）**

- `perspective: 640–800px`；`rotateX(8–10deg) rotateY(-2–4deg)`
- `.muyu-layer-shade` opacity **0.45–0.58**；`.muyu-layer-spec` **0.25–0.42**（以 DevTools 为准）
- `bodyHitPremium`：阴影 `shadowHit` scale **1.15–1.22**；可给 spec 层 100ms **opacity bump**（需 WXML class 或 JS flag `muyuFlash` 联动）

### 轨道 3 — 配套槌（建议 v3 一并做）

- 新资源：`test/muyu-premium-mallet.webp`（同 wood、同主光）
- `premium-test.mallet` 改为该路径；**长度/原点** 仍适配 `.muyu-mallet` 50px wrap、**从上往下敲**

---

## 4. 任务清单（Grok 按序执行）

| ID | 任务 | 完成标准 |
|----|------|----------|
| **T1** | 读现有 premium 代码与 v2 资源 | 能描述当前不足（木纹/厚度各 1 条） |
| **T2** | 产出 **摄影级 body**（轨道 1） | 通过 mask 对齐；嘴内深；无溢色 |
| **T2b** | 重生 **shade / spec / ground**（脚本或手工） | 与 body 光向一致 |
| **T3** | 可选 rim 层 + WXML/JS 接线 | 侧缘更厚 |
| **T4** | premium 槌图 + SKINS 指向 | 与鱼同光 |
| **T5** | WXSS 微调 perspective / hit | 敲时有体积感 |
| **T6** | 更新 `build_premium_muyu.py`（至少文档注释 v3 入口） | 可重复生成 |
| **T7** | `cli.bat auto` 编译 | 无 404 |
| **T8** | 写 **Before/After** 说明 + test 目录 **总 KB** | 见 §6 |

**仍只动 `premium-test`**，不要把 amber/jade/inkgold 默认皮改成多层（除非用户另说）。

---

## 5. 包体与性能

| 项 | 上限 |
|----|------|
| `mp-weixin/assets/skins/test/` 合计 | **≤120KB**（理想 90–110KB） |
| 单 WebP 边长 | ≤1024 |
| 层数 | ≤5 张 image（含 ground） |

超出则：降 spec 分辨率、body q=80、ground 仅用 CSS 阴影删 webp。

---

## 6. 交付物（Grok 回复父 Agent / 用户）

1. **木纹**：如何达到真实（AI / 纹理 / 脚本参数）  
2. **3D**：哪些层 + 哪些 WXSS 数值  
3. 文件列表与 **test/** 总 KB  
4. 切换步骤：木鱼 → 木鱼皮肤 → **测试·精修樟木**  
5. 与 v2 对比的 **3 条肉眼差异**  
6. CLI 结果  
7. 若 AI 出图失败：降级方案与剩余差距  

---

## 7. 禁止项

- 删除或覆盖 `muyu-amber.webp` 等默认包内皮肤  
- 修改颂钵槌 keyframes / 念珠 `VISIBLE_BEADS+2`  
- 引入 npm 3D 库  
- git commit  

---

## 8. 给 Grok 的一行 Prompt（复制即用）

```
请阅读 tools/GROK-MUYU-PREMIUM-V3.md，完成 v3 全部任务（T1–T8）：在 premium-test 上同时强化「木纹真实」与「3D立体感」——摄影级 body（mask 对齐 muyu-amber 轮廓）+ 重生 shade/spec/ground（可选 rim）+ premium 槌 + WXSS 微调。可改 tools/build_premium_muyu.py 与 mp-weixin/assets/skins/test/。不要 git commit。完成后 cli auto 并写 Before/After 与包体 KB。
```

---

## 9. 父 Agent 复核清单

- [ ] 轮廓未漂（槌、flash-premium 仍合理）  
- [ ] 默认「樟木」单图无变化  
- [ ] 木鱼槌仍上→下  
- [ ] test 目录 ≤120KB  
- [ ] 编译通过  
