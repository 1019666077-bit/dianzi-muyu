# Grok：剩余任务清单（Phase 1 收尾）

> 仓库：`C:\Users\MOON\Desktop\dianzi-muyu`  
> **不要** git commit。颂钵/念珠/默认三木鱼单图逻辑勿回归破坏。

## 已完成（勿重复）

- mp-weixin 原生页、背景、槌/念珠/颂钵修复
- Premium v3 樟木（AI body + 分层 + rim + 槌）`premium-test` → 显示名 **精修·樟木**
- **精修·花梨** `premium-jade`、**精修·紫檀** `premium-inkgold`（程序化 body，约 60KB+34KB）
- `tools/build_premium_muyu.py` 支持 `--wood amber|jade|inkgold`

---

## 待办（本任务全部完成）

### R1 — 花梨/紫檀 premium 质量对齐樟木（P0）

- 目标：木纹与 3D 观感尽量接近 **精修·樟木**（用户已满意樟木）。
- 手段（任选组合）：
  - 生成/放置 `assets/skins/muyu-premium-jade-ai.png`、`muyu-premium-inkgold-ai.png`（mask 对齐各自 `muyu-jade.png` / `muyu-inkgold.png`）
  - 扩展 `build_premium_muyu.py` 读取各 wood 的 ai 路径；跑 `--wood jade --wood inkgold`
- 若 AI 不可用：加强 procedural（grain、mouth、紫檀暗度），并在交付说明差距。

### R2 — 包体与目录（P0）

- `mp-weixin/assets/skins/test/` 全部 premium WebP **合计 ≤ 200KB**（理想 ≤180KB）；单 wood ≤70KB body cap。
- 可选：迁到 `mp-weixin/assets/skins/premium/` 并改 `SKINS` 路径（若迁，必须改全引用 + 无 404）。

### R3 — 皮肤 UX（P1）

- 木鱼皮肤页 **6 项**不挤乱：分组或标签（如「经典 / 精修」小字），或 2 行布局优化（`index.wxml/wxss`）。
- `premium-test` id 可保留（兼容存档）；显示名保持 **精修·***。
- **精修·紫檀**解锁：与 `inkgold` 一致（`free: false`）；`grantSkin` 解锁时优先未解锁的 premium/普通均可，逻辑清晰。

### R4 — `tools/export_mp_skins.py`（P1）

- 从 `assets/skins/*.png` 批量导出 `mp-weixin/assets/skins/*.webp`（800 宽或项目惯例）。
- 文档注释：与 `build_premium_muyu.py` 分工。

### R5 — Web `index.html` premium 预览（P1，可选但建议做）

- 木鱼 SKINS 增加与 mp 对应的 **精修·** 三套（可仅 amber 分层 demo，或三套都加）。
- 复用 mp 的 layered 思路或简化为「精修 body 单图 + CSS 阴影」，便于浏览器对比。
- 不破坏现有三经典皮肤。

### R6 — 文档（P2）

- 更新 `README.md`：mp-weixin 打开方式、精修皮肤说明（简短）。
- 本文件末尾 Grok 写 **Done** 表。

### R7 — 验收

```bat
"D:\微信web开发者工具\cli.bat" auto --project "C:\Users\MOON\Desktop\dianzi-muyu\mp-weixin" --trust-project
```

---

## 禁止

- 删默认 `muyu-amber.webp` 等
- three.js / WebGL 大包
- git commit

---

## Done（Grok）

| ID | 结果 |
|----|------|
| R1 | 花梨/紫檀改走 AI body（`muyu-premium-jade-ai.png` / `muyu-premium-inkgold-ai.png`）对齐各自轮廓，轻 grain + 3D 层；不再走会压黑的 procedural。观感接近精修·樟木。IoU 1.0。 |
| R2 | 迁到 `mp-weixin/assets/skins/premium/`；合计 **168 KB**（≤180 理想 / ≤200 硬顶）。body 52.7 / 42.2 / 31.8 KB（cap 70）。旧 `test/` 已清。 |
| R3 | 木鱼皮肤页「经典 / 精修」分组；`premium-test` 保留，显示名精修·*；精修·紫檀 `free: false`；`grantSkin` 解锁当前模式第一档未解锁（经典或精修）。 |
| R4 | 新增 `tools/export_mp_skins.py`（经典 PNG→WebP 800 宽）；注释写明与 `build_premium_muyu.py` 分工。 |
| R5 | `index.html` 增加三套精修（PNG body + CSS 3D 阴影），经典三套未改。 |
| R6 | README 补充 mp-weixin 打开方式与精修说明。 |
| R7 | `cli.bat auto --trust-project` → `√ auto`（touristappid）。 |

未 git commit。颂钵/念珠/默认三木鱼单图仍在 `mp-weixin/assets/skins/*.webp`。
