# Grok 任务书：P0 上线阻塞项（小程序 mp-weixin）

> **仓库**：`C:\Users\MOON\Desktop\dianzi-muyu`  
> **范围**：以 `mp-weixin/` 为主；`index.html` 仅同步**文案**（去掉「模拟/本地演示」），不接 Web 真广告。  
> **不要** git commit。  
> **用户无法代你注册微信账号**：AppID 用可配置占位 + 文档说明。

---

## P0 清单（必须全部处理）

### P0-1 正式 AppID 配置结构

**问题**：`project.config.json` 固定 `touristappid`，真机/提审不可用。

**做法**：

1. 新增 `mp-weixin/config/launch.js`（或 `utils/launch.js`）导出：
   - `APP_ID`：从 `project.private.config.json` 的 `appid` 读取说明；代码里**不要**写死 secret。
   - `IS_TOURIST`：`appid === 'touristappid'` 或缺失时为 true。
2. 更新 `project.private.config.json` 模板注释：用户填入真实 `wx********` 后，开发者工具以 private 覆盖 appid（保持微信惯例）。
3. 新增 `mp-weixin/LAUNCH.md`（简短）：如何填 AppID、上传、体验版；**不要**写虚假 AppID。
4. `project.config.json`：可保留 `touristappid` 作为默认以便未配置时仍能本地编译；在 LAUNCH.md 说明提审前必须改 private。

**验收**：文档清晰；IS_TOURIST 可在运行时用于 UI（见 P0-4）。

---

### P0-2 广告：去「模拟」+ 可接真激励视频（v1 合规）

**问题**：界面与逻辑写「模拟广告」，提审有虚假宣传风险。

**做法（路线 A + B 骨架，默认合规展示）**：

1. 新建 `mp-weixin/utils/ad.js`（或 `services/rewarded-ad.js`）：
   - `initRewardedAd(adUnitId)` — 仅当 `adUnitId` 非空且非 tourist 时 `wx.createRewardedVideoAd`
   - `watchRewarded({ onSuccess, onFail })` — 成功回调发奖励；失败 toast
   - **无 adUnitId 或 IS_TOURIST**：不弹假 1.5s 计时器；改为：
     - **方案（采用）**：直接 `onSuccess()` 并 `wx.showToast({ title: '开发版：已跳过广告', icon: 'none' })` **或** 隐藏广告按钮（二选一，**推荐开发版跳过并 toast，正式配置 adUnitId 后走真广告**）
   - 删除用户可见文案「模拟」「假广告」。

2. `pages/index/index.js`：`showAd` / `finishAd` 改为调用 `watchRewarded`；移除 `AD_MS` 假播放 UI（或仅 dev 保留极简 loading）。

3. `config/launch.js` 增加：
   ```js
   REWARDED_AD_UNIT_ID: '' // 用户流量主开通后填入，如 'adunit-xxx'
   ```

4. **禁止**：未配置 adUnitId 时仍显示「广告播放中…」假装播完。

**验收**：

- tourist / 空 adUnitId：点「广告 · 自动敲/皮肤」→ 无「模拟」字样；奖励仍可用（开发跳过）或按钮隐藏（若你选隐藏，须在 LAUNCH.md 说明正式版填 adUnitId 后显示）。
- 配置了 adUnitId（可 mock 单元测试注释）：走 `createRewardedVideoAd` 流程（DevTools 可能失败，需 try/catch + 友好 toast）。

---

### P0-3 隐私合规（本地存储）

**问题**：使用 `wx.setStorageSync`，提审需隐私说明。

**做法**：

1. `app.json` 按需增加（2024+ 规范）：
   - `"__usePrivacyCheck__": true`（若基础库支持）
   - 不申请多余权限；无定位、无相册。
2. 若需隐私弹窗：在 `app.js` `onLaunch` 调用 `wx.getPrivacySetting` / `wx.requirePrivacyAuthorize`（按当前微信文档最小实现），用户同意后再写 storage（或首次 `onLoad` 前检查）。
3. `mp-weixin/PRIVACY.md`（给用户复制到后台「用户隐私保护指引」）：
   - 收集项：**仅本地功德计数与解锁状态**（device 本地，不上传）
   - 用途：保存游戏进度
   - 无第三方共享

**验收**：app 启动不报错；拒绝隐私时降级（不崩溃，可提示或只读默认皮肤）。

---

### P0-4 正式产品文案（去内测感）

**替换**（mp-weixin + index.html 同步）：

| 现文案 | 建议 |
|--------|------|
| `原创玩具原型 · 非商业` | `静心小玩具 · 原创` 或 `电子木鱼 · 休闲` |
| `本地演示 · 无真实广告` | `轻点解压 · 数据仅存本机` |
| `激励视频（模拟）` / `模拟广告` | 删除或改为 `观看视频解锁`（仅当 P0-2 有真广告时） |
| `广告 · 自动敲` | 可保留或 `视频 · 自动敲` |

**验收**：全项目（mp + index.html）grep 无「模拟广告」「本地演示」「tourist」用户可见字符串。

---

## 禁止

- 提交真实 adUnitId / AppSecret
- 删除 premium 资源
- 改颂钵/念珠核心交互
- git commit

---

## 自测

```bat
"D:\微信web开发者工具\cli.bat" auto --project "C:\Users\MOON\Desktop\dianzi-muyu\mp-weixin" --trust-project
```

Grep 检查：

```bat
rg "模拟|本地演示|非商业" mp-weixin index.html
```

---

## 交付（回复父 Agent）

1. P0-1～P0-4 逐条 Done/Partial  
2. 用户还需手动做什么（注册 AppID、后台隐私、填 adUnitId）  
3. 改动文件列表  
4. CLI + rg 结果  

---

## 一行 Prompt

```
阅读 tools/GROK-P0-LAUNCH-FIX.md，完成 P0-1～P0-4（mp-weixin 为主，index.html 仅同步文案）。实现 utils/ad.js + config/launch.js，去掉模拟广告 UI，隐私最小合规，写 LAUNCH.md 与 PRIVACY.md。不要 git commit。cli auto 编译并 rg 检查「模拟|本地演示」。
```
