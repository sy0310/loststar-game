# 微信小游戏 v0.6.10

当前修复候选为 `0.6.10-wx.2`，处理审核截图的飞船素材加载失败与首页触摸兼容问题。微信导出清单使用代码包根目录路径和`-2x.png`文件名，显式将assets纳入打包。启动失败时提供可触摸的“重新加载”。菜单命中采用倒序循环，波次读取采用兼容的末项访问。原生入口和图形回归在拒绝`./`图片路径、删除`Array.prototype.findLast`与`Array.prototype.at`的适配测试环境中运行。此测试覆盖受限能力组合，具体小米11客户端仍需实机复测。

AppID 为 `wx69a4de5574460d86`。导入目录为仓库下的 `releases/wechat-minigame`，开发者工具选择小游戏模式。

在仓库根目录运行本地回归，测试包与截图分别写入独立目录：

```bash
export SURVIVOR_WECHAT_DIR="$PWD/releases/wechat-minigame-test"
export SURVIVOR_WECHAT_REPORT_DIR="$PWD/releases/wechat-graphics-test"
npm --prefix prototypes/salvage-survivor-demo run build:wechat -- --output "$SURVIVOR_WECHAT_DIR"
npm --prefix prototypes/salvage-survivor-demo run test:wechat
node prototypes/salvage-survivor-demo/wechat/browser.cjs
```

构建依赖仓库现有 Node/Playwright Chromium、Python 3 和 ffmpeg。导出器复用现有 `game.js`、平衡表、74 张运行 PNG 与两首已批准音乐。原合成器离线生成 22 种音效的普通与进化版本。音乐使用两个独立分包。

已提交运行源码后，可给构建命令追加 `-- --freeze`，检查干净的来源并生成带文件摘要的 `build-info.json`。

微信入口用 Canvas 重绘菜单与 HUD，沿用控制器的实际文字、选择、费用与回调。长菜单支持拖动滚动。触摸取消、切后台和内存警告释放控制输入并暂停。声音设置沿用原保存键。

微信存档使用独立 `loststar.survivor.demo.v06.wechat.v1` 键。整个账本一次写入，包含修订号、结算回执、武装、随机种子与在途快照。Set 类型经过显式编码，贯穿弹命中集合可随续局恢复。写入失败保留前一份账本，界面可重试。

浏览器 IndexedDB 与微信设备各自保存进度。当前构建没有跨平台存档导入功能。

`test.cjs` 在 360×800、390×844 运行导出的同一入口，通过微信回调适配器检查菜单、滚动、触控、后台暂停、续局、结算、保存失败与坏档保留。图形与微信 API 的真实兼容性需在开发者工具和手机验证。

开发者工具上传进入开发版本。发行审核、账号资料和手机验收状态需另行核实。
