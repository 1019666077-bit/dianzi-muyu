/**
 * 上线配置（不要在此写入 AppSecret）。
 *
 * AppID 以微信开发者工具为准：把正式 wx******** 填进
 * project.private.config.json 的 appid 后，工具会覆盖
 * project.config.json 里的 touristappid。运行时用
 * wx.getAccountInfoSync() 读取，源码不写死正式 AppID。
 */
function readRuntimeAppId() {
  try {
    const acc = wx.getAccountInfoSync();
    const id = acc && acc.miniProgram && acc.miniProgram.appId;
    return typeof id === "string" ? id : "";
  } catch (e) {
    return "";
  }
}

const APP_ID = readRuntimeAppId();
const IS_TOURIST = !APP_ID || APP_ID === "touristappid";

module.exports = {
  APP_ID,
  IS_TOURIST,
  // 流量主开通后填入，例如 'adunit-xxxxxxxx'
  REWARDED_AD_UNIT_ID: "",
};
