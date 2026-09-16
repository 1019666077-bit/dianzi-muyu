# 电子木鱼 · 上线说明

以 `mp-weixin/` 为小程序工程。未配置正式 AppID 时，`project.config.json` 默认 `touristappid`，仅供本机编译，不能真机调试或提审。

## 0. 还没有 AppID？先注册（约 10–30 分钟）

1. 浏览器打开 [微信公众平台](https://mp.weixin.qq.com/)，用管理员微信扫码登录。
2. 右上角 **立即注册** → 选择 **小程序**（不要选公众号）。
3. 按页面填写：
   - **邮箱**（未绑过公众号/小程序）→ 收邮件激活
   - **主体类型**：个人可注册（功能受限但够本玩具）；企业/个体户可选更多能力
   - **管理员**微信扫码、实名
   - **小程序信息**：名称如「电子木鱼」或「静心木鱼」（名称需唯一，可先试）
   - **服务类目**：建议 **工具 → 效率** 或 **文娱 → 休闲**（与「减压玩具」一致，避免选宗教类目）
   - **介绍**：例：「木鱼、念珠、颂钵轻互动，数据仅存本机。」
4. 注册成功后：**开发 → 开发管理 → 开发设置** 复制 **AppID（wx 开头）**。
5. 回到本仓库，编辑 `project.private.config.json`：

   ```json
   "appid": "wx你的AppID"
   ```

6. 微信开发者工具 **重新打开** 本项目（已在本机 `cli open` 过则点编译即可），标题栏应显示你的 AppID 而非游客。
7. 继续下面 **§1 隐私**、**§2 上传**。

个人主体注意：流量主/激励视频可能需企业或达标后才开；未开通前保持 `REWARDED_AD_UNIT_ID` 为空。空广告位 **不会** 发奖（fail-closed），视频解锁入口会 toast「广告未配置」。

## 1. 填入 AppID

1. 在[微信公众平台](https://mp.weixin.qq.com/)注册小程序，复制 `wx` 开头的 AppID。不要把 AppSecret 写入本仓库。
2. 用微信开发者工具打开本目录。
3. 编辑 `project.private.config.json`，将 `appid` 改成你的正式 AppID。开发者工具会用该文件覆盖 `project.config.json`。
4. **提审前必须改 private 的 appid。** 仓库只保留 `touristappid` 占位，不要把正式 AppID 提交进 git。

运行时 `config/launch.js` 通过 `wx.getAccountInfoSync()` 读取当前 AppID。`appid` 缺失或为 `touristappid` 时 `IS_TOURIST === true`。

## 2. 激励视频广告位（P0-2：空广告位不发奖）

1. 小程序完成微信认证后，在 MP 后台开通流量主。
2. 创建激励视频广告位，得到 `adunit-` 开头的广告位 ID。
3. 填入 `config/launch.js` 的 `REWARDED_AD_UNIT_ID`（不要把密钥写进仓库）。
4. **发奖策略（fail-closed，见 `utils/ad.js` `watchRewarded`）**：
   - 正式 AppID + 已填广告位：走 `wx.createRewardedVideoAd`，看完才发奖。
   - 正式 AppID + 空广告位：toast「广告未配置」，**不**调用 `onSuccess`，无免费 `grantAuto` / `grantSkin`。
   - 游客号 / 未配置真实 AppID：toast「当前为开发游客号，无法验证广告」，**不**发奖。
   - 仅当 `ALLOW_DEV_AD_SKIP === true`（默认 **false**）且为游客号：toast「开发版：已跳过广告」并发奖。提审/上传必须保持 false。
5. 填写广告位后，开发者工具里播放可能失败，代码会 toast；请用真机验证。

## 3. 隐私指引

把 `PRIVACY.md` 的内容复制到 MP 后台「设置 → 服务内容声明 → 用户隐私保护指引」。本小程序不申请定位、相册等权限。

## 4. 上传与体验版

1. 开发者工具 → 上传，填写版本号与备注。
2. MP 后台 → 版本管理 → 选为体验版，添加体验者。
3. 提审前核对：`project.private.config.json` 已改为正式 AppID、隐私指引已发布、若要用视频解锁则已填广告位 ID；`ALLOW_DEV_AD_SKIP` 为 false。
