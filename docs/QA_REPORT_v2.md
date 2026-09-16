# 电子木鱼 · 二轮体验 QA（v2）

- **仓库**：`1019666077-bit/dianzi-muyu`
- **分支 / PR**：`cursor/fix-ad-grant-quota-copy-147d` / [#1](https://github.com/1019666077-bit/dianzi-muyu/pull/1)
- **核验提交**：`ca7cc398f84ec71acb11de6e4eff141ad6a65213`（其上还有 `54710ac` 的 P0/P1）
- **日期**：2026-09-16
- **范围**：以 `mp-weixin/` 为正式产品；Web `index.html` 仅作遗留原型备注
- **角色**：第一次打开的中文用户 + 挑刺审核员

## 验证范围与方法（未发明指标）

| 项 | 结果 |
| --- | --- |
| 微信开发者工具 / 模拟器 / 真机 | **本环境不可用**（Linux Cloud Agent，无 DevTools、无 `cli.bat`、无微信运行时）。**没有**在微信里点过木鱼/念珠/颂钵。 |
| 静态走查 | 读完 `app.js`、`pages/index/*`、`pages/stats/*`、`utils/ad.js`、`utils/merit.js`、`config/launch.js`、隐私/上线文档、WXML/WXSS、资源配置 |
| Node 逻辑自测 | `/tmp/qa_v2_logic.js` 加载真实模块 + mock `wx`：**27/27 通过**（fail-closed 发奖、剩余次数文案、取消不误开慢敲、resetAllMerit、隐私写门、urlCheck、beadBusy 现状） |
| 资源 | `python3 tools/validate_mp_assets.py`：皮肤/音效/`share-cover.webp` **missing: none**；`mp-weixin` 合计 **0.83 MB**；`share-cover.webp` **18.5 KB** |
| Web 浏览器点玩 | 未作为本轮验收；`shots/*.png` 仍是旧 Web 界面，不能代表当前小程序 |

结论里的「可点 / 会 toast」均来自代码路径与上述 Node 复现，**不是**模拟器录屏。

---

### 总结（体验分1–10、相对上一版是否可提审）

**体验分：7 / 10**（核心三模式玩具能讲清；变现入口在当前配置下是死胡同；后台自动敲未停。）

**相对上一版**：明显更好。上一轮 P0「空广告位 / 游客号直接发奖」已封死；P1「用过 1 次就说今日快敲已结束」已按剩余次数改文案；侧栏取消不再误开慢敲。本轮核到 **P2 已合入**（隐私旁路写入、清空功德清 streak/`autoUntil`、念珠 `beadBusy`、`urlCheck: true`），不是「仍待合入」。

**是否可提审：还不行。** 代码侧广告 fail-closed 已可对审核员诚实说明「未配置不发奖」，但仓库仍是 `touristappid`、视频按钮对真实用户是空点、进统计页不停自动敲与音效、隐私稿未覆盖全部本地键。建议先做提审 checklist，再上传体验版，**不要**把当前游客工程直接提审。

---

### 已验证修复（P0/P1，及已合入的P2）

核验提交 `ca7cc39`（含 `54710ac`）。下列均在 Node 自测或静态对照中确认，**不是**凭 PR 描述相信。

#### P0-2 空广告位 / 游客号 fail-closed（确认会拒发奖）

`mp-weixin/utils/ad.js` `resolveRewardedGrant` / `watchRewarded`；开关在 `mp-weixin/config/launch.js`：

| 条件 | 策略 | 是否调用 `onSuccess` / `grantAuto` / `grantSkin` |
| --- | --- | --- |
| 正式 AppID + 非空广告位 | `play` | 仅 `res.isEnded` 才发奖（未在真广告 SDK 上跑，只读代码） |
| 正式 AppID + 空/空白广告位 | `refuse` toast「广告未配置」 | **否** |
| 游客号（`touristappid` 或空 AppID） | `refuse` toast「当前为开发游客号，无法验证广告」 | **否** |
| 游客号且 `ALLOW_DEV_AD_SKIP === true` | `skip` toast「开发版：已跳过广告」 | 是（当前仓库该开关为 **false**） |

当前仓库：`REWARDED_AD_UNIT_ID === ""`，`ALLOW_DEV_AD_SKIP === false`。Node 里 `watchRewarded`：**`onSuccess` 0 次、`onFail` 1 次、未调用 `wx.createRewardedVideoAd`**；`pages/index/index.js` 的 `showAd("auto"|"skin")` 后 `autoUntil` / `unlockedSkins` / `adGrantAutoCount` 均不变。

中途关掉真广告走 `需看完视频才能领取`，同样不发奖（代码路径，未播真视频）。

#### P1-1 快敲文案按剩余次数（cap = 2）

`pages/index/index.js` `updateAutoStatus`：`remainingFast = 2 - adGrantAutoCount`。

- 用过 0 次：闲时「轻点解压 · 数据仅存本机」（**不会**说已结束）
- 用过 1 次：闲时「今日还可快敲 1 次 · 看视频续 5 分钟 · 慢敲仍可用」；慢敲中同步「今日还可快敲 1 次」
- 用过 2 次：才出现「今日快敲已结束…」

Node 已断言「用过 1 次」文案不含「已结束」。

#### P1/P2-3 侧栏「取消」只关弹窗

`onRailAuto` 在快敲进行中：`cancelText: "取消"`，`success` **仅** `res.confirm` 时 `stopFastAuto()`。Node：点取消后 `slowAutoOn` 与 `autoUntil` 不变；点确认只清 `autoUntil`，慢敲开关保持。

底部「视频·快敲」关闭确认同样只在 `confirm` 时停快敲。

#### P2-1 隐私旁路写入（已合入）

- `app.js` 新增 `whenPrivacyWrite`；`recordScene` 写入 `dianzi-muyu-scene-stats` 走该门。
- `index.js` `maybeShowMyMiniProgramHint` 写 `dianzi-muyu-hints` 走 `whenPrivacyWrite`。
- 功德 `save()` 仍走原 `whenPrivacy`。
- Node：`privacyAgreed === false` 时上述写盘函数不执行。

拒绝协议后内存仍可涨计数（可玩、杀进程丢失）——这是既有降级，不是本轮回退。

#### P2-2 `resetAllMerit` / `autoUntil`（已合入）

`utils/merit.js` `resetAllMerit` 现清：本次/今日/昨日/总分模式、`streakDays`/`streakLastDate`/冻结、`autoUntil`。**故意不清**广告日配额与皮肤解锁。

`pages/stats/stats.js` 文案已写明连续天数与停止自动敲；确认后 `notifyIndexAfterFullReset` → 首页 `onMeritFullyReset` 关慢敲、停定时器。Node 已覆盖字段与首页停表。

#### P2-4 念珠 `beadBusy`（已合入，有残留竞态见下）

`autoCommitBead` 在 busy / 拖动 / 掉落中 **return**（不再在拖动中强制 `commitBead`）；拖动手势会置 `beadBusy`。互斥主体成立。残留问题见 P2-新。

#### P2-5 `urlCheck: true`（已合入）

`project.config.json` 与 `project.private.config.json` 均为 `urlCheck: true`。工程无 `wx.request` / 上传下载。`LAUNCH.md` 已注明。

#### 顺带（文案合规，相对 Web 遗留）

`mp-weixin` 的 wxml/js **没有**用户可见的「模拟广告 / 本地演示 / 非商业」。浮层是「+1」而非「+1 功德」。Web `index.html` 仍有「原作原型」和 1.5s「广告播放中…」假片，**不要**当提审包。

---

### 仍存/新发现问题（P0–P3，含复现、期望、实际、文件位置）

本轮 **没有新的代码级 P0**（免费领奖漏洞已关）。提审仍被 **运营项**挡住：未填正式 AppID。

#### P1-1 未配置激励视频时，「视频·」入口仍可点，像坏掉的功能

- **复现**：当前 `touristappid` + 空 `REWARDED_AD_UNIT_ID`；第一次用户点底部「视频·快敲」或「视频·皮肤」，或点锁定皮肤。
- **期望**：不能播就不要承诺「视频」——隐藏/禁用，或改成「即将开放」；至少用用户能懂的说明。
- **实际**：按钮照常；toast「当前为开发游客号，无法验证广告」或正式号空位时「广告未配置」。**确认不发奖**，但文案像开发者日志。锁定皮肤点击会关皮肤板并立刻 `showAd("skin")`，无二次确认。
- **位置**：`pages/index/index.wxml` 工具栏；`pages/index/index.js` `onAdAuto` / `onAdSkin` / `pickSkin`；`utils/ad.js` refuse toast。
- **审核含义**：不再「假看完就发奖」，但仍可能被问「视频在哪」。`REVIEW.md` 已写未配置应提示且不解锁——对审核员友好，对用户不友好。

#### P1-2 离开首页不停自动敲和音效（P0/P1 修复未覆盖，亦无回归修复）

- **复现（代码）**：开「自动敲」或快敲 → 点顶栏/侧栏进「功德数据」。首页无 `onHide`；`onUnload` 才会 `clearAutoTimers` / `destroy` 音频。统计页是 `navigateTo`，首页仍在栈里。
- **期望**：进入后台、来电、打开统计页时暂停定时器与 `InnerAudio`；回来再续。
- **实际**：550ms / 1200ms `setInterval` 继续 `onTapMuyu` / `autoCommitBead` / `play()`；`obeyMuteSwitch = false`，系统静音也可能出声。统计页数字会跟着跳。
- **位置**：`pages/index/index.js`（有 `onShow`/`onUnload`，**无 `onHide`**）；`pages/stats/stats.js`。

#### P1-3 隐私稿与真实本地键、以及「以后接广告」不一致

- **复现**：对照 `PRIVACY.md` 与实际 `setStorageSync` 键、字段。
- **期望**：指引覆盖所有本地项；若上线激励视频，须声明腾讯广告为第三方。
- **实际**：稿只写功德、皮肤、自动敲剩余时间。未写连续天数/冻结、广告日配额、`dianzi-muyu-hints`、`dianzi-muyu-scene-stats`。当前空广告位不会 `createRewardedVideoAd`，「无第三方」**暂时**成立；一旦填 `adunit-` 即不成立。
- **位置**：`mp-weixin/PRIVACY.md`；写入点 `utils/merit.js`、`app.js` `recordScene`、`index.js` hint。

#### P2-新-1 念珠 `onBeadEnd` 在无 drag 时清掉 `beadBusy`（P2-4 引入的竞态）

- **复现（Node 已打出该行为）**：`autoCommitBead` 置 `beadBusy = true` 后 80ms 才 `commitBead`；其间手指 touchstart 被 busy 挡掉（不建 `beadDrag`），但 `catchtouchend` 仍进 `onBeadEnd`，`!beadDrag` 分支把 `beadBusy` 设回 `false`。未完成的 timeout 仍会 `commitBead`，随后自动敲或手势可再进。
- **期望**：无 `beadDrag` 的 end/cancel **不要**抢 auto 的 busy；只在自己发起的拖动结束时释放。
- **实际**：busy 被提前清掉。未在真机上量「会双计多少次」，故标 P2 而非 P1。
- **位置**：`pages/index/index.js` `onBeadEnd`、`autoCommitBead`；`index.wxml` 念珠 `catchtouchend` / `catchtouchcancel`。

#### P2-新-2 看视频过程中切 Tab，皮肤奖发给「当时模式」；切到已满解锁则白看

- **复现**：`showAd("skin")` 只把 `pendingAd = "skin"`；`grantSkin` 用 **当时** `data.mode` 的 `firstLockedSkin()`。若广告开始后切到已解锁完的模式，函数在 `recordGrantSkin` **之前** return，不扣配额也不给原模式皮肤。
- **期望**：锁定开始时的 mode+皮肤；失败也不要让用户觉得「看了没给」。
- **位置**：`pages/index/index.js` `showAd` / `finishAd` / `grantSkin` / `setMode`。

#### P2-3 首页「重置」清的是本次功德，但首页不展示本次

- **复现**：侧栏「重置」→ 确认 → toast「已重置本次」。顶栏仍是「今日 / 总」。
- **期望**：要么展示本次，要么文案改成用户看得到的量。
- **位置**：`index.wxml` 侧栏；`index.js` `onRailResetSession`；本次只在 `pages/stats/stats.wxml`。

#### P2-4 首次：木鱼/颂钵是点按，念珠必须下滑；轻点无声无 +1

- **复现**：hint「往下滑 · 拨过一颗」；`onBeadEnd` 仅当 `acc >= 28` 才计数，轻点 `acc=0` 只播放掉落动画。
- **期望**：轻点也拨一颗，或更强的引导（动画手势）。
- **位置**：`index.js` `onBeadStart/Move/End`；`HINTS.beads`。

#### P2-5 工具栏四按钮 + 醒目「邀请好友」；侧栏与底部两套「自动」

- **复现**：`toolbar` 四个 11px `nowrap` 按钮（皮肤 / 自动敲 / 视频·快敲 / 视频·皮肤）+ 金属渐变邀请按钮比主操作更大。侧栏「自动」在非快敲时直接 `onToggleSlowAuto`，无说明。
- **期望**：自动/视频层级清晰；邀请不要压过主操作。未在真机量是否换行/误触，不写像素结论。
- **位置**：`index.wxml`、`index.wxss` `.toolbar` `.btn` `.invite-btn` `.side-rail`。

#### P2-6 性能风险（定性，无 FPS 数字）

单次木鱼：`bump`（计数 setData + 浮字 setData）+ 三次 `restart()`（各约 3 次 setData）+ 1s 后清浮字；快敲间隔 **550ms** 再叠一层。念珠自动另有 80ms+200ms 的 `beadOffset` setData。颂钵 `bowl.wav` **185 KB**，每次 `stop/seek/play` 且快敲会切断余音。未测低端机掉帧，列为风险而非实测卡顿。
- **位置**：`index.js` `bump` / `restart` / `restartAutoLoop`；`assets/sfx/bowl.wav`。

#### P2-7 其它体验 / 合规毛边

| 问题 | 位置 |
| --- | --- |
| 每次敲 `vibrateShort`，无震动/静音开关；`obeyMuteSwitch = false` | `index.js` `bump` / `onLoad` 音频 |
| 第一次有效敲弹出「添加到我的小程序」，打断节奏（可接受但偏打扰） | `maybeShowMyMiniProgramHint` |
| 连续天数月冻结对用户不可见 | `merit.updateStreak` vs 统计页只显示「已连续 N 天」 |
| `getPrivacySetting` **fail** 或旧基础库缺 API 时 `finish(true)`，等于默认同意并写盘 | `app.js` `initPrivacy` |
| 清空全部功德**不清**当日广告次数，文案未提；用满 2 次后再清空，状态仍可能「今日快敲已结束」 | `resetAllMerit`、`updateAutoStatus` |
| README 仍写 Web 模拟广告、精修/经典双线，与小程序现状不符 | 仓库根 `README.md`（用户装小程序看不到，开发者会看错） |

#### P3

- `data.isTourist` 未绑定 WXML，游客无角标（`index.js` / `index.wxml`）。
- `index.wxss` 残留 `.ad-box` / `.spinner`（WXML 已无模拟广告层）。
- 资源文件名 `jade` / `inkgold` vs 展示名「花梨」「紫檀」：图本身是红木/暗木，**展示名与观感大致匹配**，主要是文件名历史包袱。
- 底 Tab 用 emoji，安卓微信字体不一致风险。
- 长 toast（配额用尽整句）可能被微信截断，未在真机看截断长度。
- 无 `onShareTimeline`。
- `scripts/upload.ps1`、README 仍写本机 Windows 路径。
- 念珠下滑在 `acc` 跨 64 后又在 end 时 `acc>=28` 可能多计一次（原有边界，未真机复现）。
- 模式不写进 storage，冷启动总是木鱼。

#### 遗留 Web `index.html`（不提审）

仍是单页原型：标题「电子木鱼 · 原作原型」；`AD_MS = 1500` 假广告层「广告播放中…」；无统计页 / 无隐私门 / 无 fail-closed。`shots/01-muyu.png`、`02-beads.png` 是这套旧 UI（「原创玩具原型 · 非商业」「看广告解锁」），**不要**当小程序截图。与小程序存储键同为 `dianzi-muyu-v1`，但小程序不是 web-view，一般不会串数据。

---

### 提审前 checklist

**本环境未跑微信开发者工具。下列需在 Windows/macOS 开发者工具 + 真机勾选。**

#### 必须（否则不要点上传提审）

- [ ] `project.private.config.json` 改为正式 `wx********`（**不要**把正式 AppID / AppSecret 推进 git）。工具栏应显示正式号而非游客。
- [ ] 微信公众平台已发布「用户隐私保护指引」（以更新后的 `PRIVACY.md` 为准），类目选工具-效率或文娱-休闲，避免宗教法事承诺。
- [ ] `config/launch.js` 里 `ALLOW_DEV_AD_SKIP` 保持 **false**（当前已是 false，上传前再看一眼）。
- [ ] 激励视频二选一，不要留「写着视频、什么也播不了」：
  - **A.** 未开通流量主：对用户隐藏/禁用「视频·快敲」「视频·皮肤」，锁定皮肤不要直接拉广告；或
  - **B.** 已开通：填入真实 `adunit-`，真机看完才发奖、中途退出不发奖。
- [ ] 开发者工具 / 真机确认：游客或空广告位路径 **不会** 解锁快敲或紫檀/紫檀珠/乌金（本轮 Node 已证逻辑；真机仍要点一次）。
- [ ] 冷启动：隐私同意/拒绝各走一遍；拒绝后杀进程，功德不应残留。
- [ ] 三模式各玩一轮（木鱼点、念珠下滑、颂钵点），音画、+1、今日/总计数。
- [ ] 杀进程重进：今日/总/皮肤还在（同意隐私的前提下）。
- [ ] 统计页：重置本次 / 清空全部（两次确认）后，首页今日/总与自动敲状态符合文案；连续天数在「清空全部」后为 0。

#### 强烈建议（否则体验分到不了可上线）

- [ ] 给首页加 `onHide`：停自动敲定时器、停/暂停音频；`onShow` 再按 `autoUntil` / 慢敲开关恢复。
- [ ] 修念珠：无 `beadDrag` 的 `onBeadEnd` 不要清 `beadBusy`。
- [ ] 看皮肤视频前记下 mode，结束时按开始时的皮肤发奖。
- [ ] 更新 `PRIVACY.md`：streak、配额、hints、scene-stats；若选方案 B 则声明腾讯广告。
- [ ] 真机看 iPhone SE / 安卓小屏四按钮是否挤成两行或误触。
- [ ] 系统静音开关打开时是否仍出声（当前 `obeyMuteSwitch = false`）。
- [ ] 用 `REVIEW.md` 的测试路径写上传备注；包体积约 0.83 MB，一般不必再砍图。

#### 不要做

- [ ] 不要把 Web `index.html` 打进小程序或当审核截图。
- [ ] 不要为了「好点」把 `ALLOW_DEV_AD_SKIP` 改回 true 去提审。
- [ ] 不要在仓库提交真实 `adunit` 密钥类配置以外的 Secret（广告位 ID 本身可进配置，但 AppSecret 不行）。

---

## 附录：第一次用户剧本（按代码推演，非模拟器）

1. **冷启动**：自定义导航；顶栏「电子木鱼 / 静心小玩具 · 原创」，今日 0、总 0，状态「轻点解压 · 数据仅存本机」。若后台已配隐私指引，先过系统隐私窗；拒绝则 toast「未同意隐私协议，进度将不保存」。
2. **点木鱼**：槌动画、+1、轻震、木鱼音；第一次有效敲可能弹出「添加到我的小程序」。
3. **切念珠**：必须下滑才计数；只点一下可能完全没功德。
4. **切颂钵**：点按敲钵沿。
5. **皮肤**：每模式两套免费 + 一套「需解锁」。点锁 = 直接走广告逻辑 → 当前配置下 toast 拒发奖，皮肤仍锁。
6. **自动敲**：底部可免费慢敲；「视频·快敲」当前配置失败且不进入 5 分钟。侧栏「自动」在非快敲时会直接开关慢敲，和底部重复。
7. **数据**：可见本次/今日/昨日/总、分模式、连续天数；首页点「重置」用户可能觉得「没清掉」。

以上与 P0/P1 修复不冲突：拒发奖、剩余次数文案、取消不误开慢敲，在逻辑层已成立。
