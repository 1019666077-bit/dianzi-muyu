# 电子木鱼 · 原创玩具原型

纯前端可玩原型：木鱼 / 念珠 / 颂钵 三模式，点击积功德、Web Audio 音效、皮肤切换、模拟激励视频解锁。  
**完全原创实现**，未使用任何第三方商业产品的代码、素材或品牌名。

## 如何打开

### 方式一：本地静态服务（推荐）

```bash
cd dianzi-muyu
python3 -m http.server 8848
```

浏览器打开：<http://127.0.0.1:8848/>  
建议用手机模式（DevTools → 390×844）或真机访问同局域网地址。

### 方式二：直接打开文件

用浏览器打开 `index.html` 即可。部分浏览器对 `file://` 下的 AudioContext 有限制，首次点击后会解锁声音。

### 方式三：微信小程序（mp-weixin）

用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本仓库的 **`mp-weixin/`** 目录（不要选仓库根）。命令行也可：

```bat
"D:\微信web开发者工具\cli.bat" auto --project "C:\Users\MOON\Desktop\dianzi-muyu\mp-weixin" --trust-project
```

小程序页含木鱼 / 念珠 / 颂钵、分层精修皮肤、模拟激励视频解锁。素材在 `mp-weixin/assets/`。

## 功能一览

| 功能 | 说明 |
|------|------|
| 三模式 Tab | 木鱼 / 念珠 / 颂钵 |
| 点击交互 | 缩放动画 + 浮动「功德+1」等文案 |
| 音效 | Web Audio 合成（无外部音频资源） |
| 计数持久化 | `localStorage` / 小程序 `wx.storage` 键 `dianzi-muyu-v1` |
| 皮肤 | 木鱼：樟木 / 花梨 / 紫檀 + **精修·樟木 / 花梨 / 紫檀**（分层 WebP）；念珠、颂钵各三套。精修·紫檀与经典紫檀需广告解锁 |
| 模拟广告 | 「看广告解锁」→ 1.5s 后「广告结束」→ 解锁 5 分钟自动敲 **或** 下一档未解锁皮肤 |

精修木鱼用 `assets/skins/muyu-premium-*-ai.png` 对齐轮廓后导出分层 WebP（body / shade / spec / ground / rim / mallet）。重建：`python tools/build_premium_muyu.py`。经典皮肤导出：`python tools/export_mp_skins.py`。

精修木鱼用 `assets/skins/muyu-premium-*-ai.png` 对齐轮廓后导出分层 WebP（body / shade / spec / ground / rim / mallet）。重建：`python tools/build_premium_muyu.py`。经典皮肤导出：`python tools/export_mp_skins.py`。

## 什么是 Mock，什么以后接真流量主

| 当前（Mock） | 以后接真·流量主 / 广告 SDK |
|--------------|---------------------------|
| 按钮触发本地 `setTimeout(1500)` 假装播完 | 接入微信小程序激励视频 / App 广告联盟 SDK |
| 解锁标记写在 `localStorage` | 服务端校验广告完成回调后再发奖励 |
| 无真实曝光、无收益 | 需账号、审核、广告位 ID、合规隐私政策 |
| 自动敲 5 分钟本地计时 | 可改为服务端发放时长 / 道具 |

本仓库仅作产品体验与交互验证，**不含**广告 SDK、后端或 PHP。

## 目录结构

```
dianzi-muyu/
  index.html    # Web 单文件原型（含精修预览）
  README.md
  .gitignore
  assets/       # 透明底道具图 + 禅寺背景 + 精修 PNG
  mp-weixin/    # 微信小程序：开发者工具打开此目录
    assets/skins/premium/  # 精修分层 WebP（≤200KB）
  tools/
    build_premium_muyu.py  # 精修分层构建
    export_mp_skins.py     # 经典皮肤 PNG→WebP
  shots/        # 可选截图
```

## 建议仓库名

- `dianzi-muyu`（推荐）
- 或 `electronic-muyu`

Owner 示例：`1019666077-bit`

## 许可

原型代码可按项目需要自行约定；请勿将本 README 中的说明误认为对任何第三方品牌的授权或关联。

## 截图

- `shots/01-muyu.png` — 木鱼模式
- `shots/02-beads.png` — 念珠模式（`?tab=beads`）
