# 电子木鱼 · QA Playtest 报告 v3（Round 3 polish）

> 测试时间：2026-09-16 约 11:15–11:35（用户时区 UTC+8）  
> 测试方式：对照 `tools/GROK-IMPLEMENT-POLISH-ROUND3.md` 静态代码走查 + Node 纯函数自测 + `validate_mp_assets.py`  
> 工程路径：`C:\Users\MOON\Desktop\dianzi-muyu\mp-weixin`  
> 仓库：`github.com/1019666077-bit/dianzi-muyu`  
> **基线 / HEAD（本轮未 commit）**：分支 `cursor/fix-ad-grant-quota-copy-147d`，**`54710acc786904b821cf3ac6f3b167b1980d7156`**（`fix(mp-weixin): fail-closed ads and remaining fast-auto copy`）  
> 对照：`docs/QA_PLAYTEST_v2.md`

约束遵守：未 `git commit` / `git push`；未改 `ALLOW_DEV_AD_SKIP` 默认；未改正式 AppID / schemaVersion / Web `index.html`。

---

## 总结分数

| 维度 | 分数（/10） | 说明 |
|---|---|---|
| 广告 UX（用户向文案 + muted） | **9.0** | 游客/空 unit 按钮变灰；点击走 `userMessageForPolicy`；`resolveRewardedGrant` 仍 6/6；dev toast 字符串未改 |
| 清空闭环 / 连击只读 | **9.0** | `resetAllMerit` 清 `autoUntil` + streak/freeze；`onExternalMeritReset` 停首页自动；stats 用 `streakDisplayDays` |
| 隐私旁路 | **8.5** | hint / scene / prefs 均经 `writeWhenPrivacy`；主功德 key 未改 |
| 振动 / 念珠互斥 | **9.0** | 数据页开关 + `bump` 门控；`beadBusy` 在 start/end 与 auto 循环生效 |
| **综合（相对 v2）** | **8.5 / 10** | Round 3 任务书 P0–P2 已落地，P3 三项已做；提审仍卡游客 AppID + 空广告位（运营，本轮不做） |

**一句话**：本轮把「广告按钮对用户说人话、清空后快敲真停、拒绝隐私不写旁路、念珠与自动互斥、振动可关」补齐；fail-closed 与日配额文案无回归。

---

## 自测 checklist 11.x

### 11.1 Node（`mp-weixin` 目录）

| # | 检查项 | 结果 |
|---|---|---|
| 11.1a | `resolveRewardedGrant` 6 场景（与 v2 一致） | **PASS** `6/6` |
| 11.1b | `streakDisplayDays` mock 跨日 diff 0/1/2/3 | **PASS**（0→5，1→5，2+冻结未用→5，2+冻结已用→0，3→0） |

6 场景明细：

| 输入 | 期望 action / toast | 结果 |
|---|---|---|
| 正式 + `adunit-x` | `play` | PASS |
| 游客 + `allowDevAdSkip: true` | `skip` / `开发版：已跳过广告` | PASS |
| 游客 + 空 unit + skip false | `refuse` / `当前为开发游客号，无法验证广告` | PASS |
| 正式 + 空串 unit | `refuse` / `广告未配置` | PASS |
| 正式 + 空白 unit | `refuse` / `广告未配置` | PASS |
| 游客 + 有 unit + skip false | `refuse` / `当前为开发游客号，无法验证广告` | PASS |

附加（非任务书强制，本轮一并跑过）：`userMessageForPolicy` 游客 refuse → `正式版开放后，可看视频加速`；空 unit refuse → `视频功能接入中，请稍后再试`；不含「游客」「未配置」。`resetAllMerit` 清 streak/`autoUntil` 且保留皮肤与广告配额。`writeWhenPrivacy(agreed=false)` 不执行写入。`ALLOW_DEV_AD_SKIP === false`，`SCHEMA_VERSION === 3`。

### 11.2 手工 / 代码走查

| # | 检查项 | 结果 | 方法 |
|---|---|---|---|
| 1 | 游客 + 空 unit：视频按钮 muted；用户 toast；无 dev 词 | **PASS** | WXML `btn-muted`；`ensureRewardAdPlayable` 用用户向文案；`pages/` 内无「游客号」「广告未配置」 |
| 2 | `ALLOW_DEV_AD_SKIP=true` 仅本地：仍为 skip 路径（不改变默认 config） | **PASS** | 默认 `launch.js` 仍 `false`；Node skip 场景仍发 `skip` + 原 toast；点击 refuse 才拦截，skip/play 仍进 `watchRewarded` |
| 3 | 快敲中 → stats 清空 → index 停涨 | **PASS** | `resetAllMerit` 置 `autoUntil=0`；`meritNotifyIndexReset` → `onExternalMeritReset` 关慢敲并 `clearAutoTimers`。**未**在微信开发者工具真机连点验收 |
| 4 | 自动敲时首敲不弹「我的小程序」；手动首敲弹一次 | **PASS** | 已从 `bump` 移除 hint；手动 `onTapMuyu`/`onTapBowl`/`commitBead` 调用；auto 路径设 `_tapFromAuto` / `_beadFromAuto` |
| 5 | 拒绝隐私：hint / scene / prefs 不写 | **PASS** | `writeWhenPrivacy` 包装三处写入；Node mock `agreed=false` 不写。**未**弹真隐私框联调 |
| 6 | 振动关：敲击无 `vibrateShort` | **PASS** | `grep` 仅 `index.js` 一处，且包在 `prefs.isVibrateOn()` |
| 7 | `python tools/validate_mp_assets.py` | **PASS** | `missing: none`；`share-cover.webp` 18.5KB；包体 0.83MB |
| 8 | 日配额 2/2、3/3 拦截文案仍为原样 | **PASS** | `今日快敲次数已用完（2/2），明天再来；慢敲仍免费` / `今日皮肤视频次数已用完（3/3），明天再来` |

---

## 相对 v2 的 regression 声明

- **无 P0/P1 广告发奖回归**：`resolveRewardedGrant` toast/action 与 v2 一致（仅新增 `reason` 字段）；`watchRewarded` 仍用 policy 原 toast（开发路径）。
- **无 P1-1 快敲剩余次数文案回归**：`updateAutoStatus` 未改配额展示公式。
- **无 schema 回归**：仍为 v3，未 bump。
- v2 仍存的运营债 **未 regress、也未修**（本轮明确不做）：`touristappid`、空 `REWARDED_AD_UNIT_ID`、`urlCheck: false`。
- v2 P2-1 / P2-2 / P2-4 在本轮 **已修**（隐私旁路、清空连击/`autoUntil`、念珠 `beadBusy`）。

---

## 本轮已落地（相对任务书）

| 项 | 状态 |
|---|---|
| §1 `prefs.js` 偏好与功德分离 | 已做 |
| §2 `localWrite.js` + hint/scene/prefs 走隐私 | 已做 |
| §3 激励按钮 muted + 用户向 copy；quota 仍先拦 | 已做 |
| §4 `resetAllMerit` + index 桥接停快敲 | 已做 |
| §5 `streakDisplayDays` 只读；stats 不调 `updateStreak` | 已做 |
| §6 「我的小程序」仅手动敲 | 已做 |
| §7 `PRIVACY.md` 补充本地统计项 | 已做 |
| §8 念珠 `beadBusy` 互斥 | 已做 |
| §9 数据页敲击振动开关 | 已做 |
| §10 P3 飘字 timer / 解锁 toast / 快敲中慢敲提示 | 已做 |

---

## 未做 / 妥协

| 项 | 原因 |
|---|---|
| 微信开发者工具真机/模拟器连点（清空后看数字停涨、拖念珠） | 本轮为代码走查 + Node；建议 Composer/人工在 IDE 再点一遍 |
| 填正式 AppID / 广告位 | 任务书明确不做（运营） |
| `urlCheck: true` | 任务书仅文档备注，强制改 true 不做 |
| 音效总开关 | 按任务书留 TODO 一行于 `prefs.js` |
| Web `index.html` parity / 订阅 / schema v4 | 明确不做 |
| stats 数据字段未改名为 `streakDisplay` | 任务书允许沿用 `streakDays`；wxml 仍 `streakDays > 0` 才展示 banner |
| 振动开关 persistence | `setVibrateOn` 先更新内存再 `writeWhenPrivacy` 落盘，拒绝隐私时当次会话开关仍生效、下次冷启动回默认 |

备注：木鱼/颂钵自动敲也走 `onTapMuyu`/`onTapBowl`，因此除念珠 `_beadFromAuto` 外增加了 `_tapFromAuto`，否则自动首敲仍会弹引导（与「仅手动」产品语义一致）。

---

## 附录：环境

- **测试树**：`cursor/fix-ad-grant-quota-copy-147d` @ `54710acc786904b821cf3ac6f3b167b1980d7156`（工作区有 Round 3 未提交改动）  
- **validate_mp_assets.py**：PASS（`missing: none`，0.83MB）  
- **报告路径**：`C:\Users\MOON\Desktop\dianzi-muyu\docs\QA_PLAYTEST_v3.md`
