# 失物星球 · LOSTSTAR

竖屏 H5 · 精细像素 / 分层 2.5D 微缩球体 / 放置探索与怪诞收藏。

> 你的飞船会自动探索怪诞星球，每次回来都带回一些完全搞不懂用途的宇宙奇物。

当前交付：**退货箱星 / 退件平原动态可玩样板**。原始设计文件 20/20 已校验导入，源美术与实际运行证据已提交。分支 `codex/v0.1-vertical-slice`；[Draft PR #2](https://github.com/sy0310/loststar-game/pull/2)，不合并、不部署。

## 本地运行

需要 Node.js 22.12+、npm、Python 3；录屏另外需要 ffmpeg/ffprobe。

```bash
npm ci
npm run dev
# http://127.0.0.1:5173
```

生产预览：

```bash
npm run build
npm run preview -- --port 4173
# http://127.0.0.1:4173
```

无需后端、账号、密钥或真实广告。使用当前浏览器的 localStorage 保存；初始化后自动探索，页面切换不中断模拟。体验数值：首个发现约 12 秒，雷达约 60 秒收到异常、90 秒锁定、120 秒揭晓；升级会改变速度。离线初始结算上限 2 小时。

## 验证与证据

```bash
python3 scripts/validate_design_assets.py
npm run test:coverage
npx playwright install chromium webkit
npm run test:e2e
# 或：npm run check
```

浏览器测试：360×800、390×844、1440×1000 Chromium，390×844 WebKit。覆盖未知雷达、收集与展出、升级、刷新保存和离线防重复领取。引擎覆盖率单独统计，不把渲染代码算作已覆盖。

生产预览运行后，另开终端录制/测量：

```bash
npm run capture
npm run report
```

- [实际运行视频](artifacts/expedition-12s.mp4)
- [四种遮挡、概念图对照与差异](docs/09_VISUAL_REVIEW.md)
- [浏览器视觉审核页](artifacts/visual-review.html)：开发服务器下访问 `http://127.0.0.1:5173/artifacts/visual-review.html`。
- [资源与性能实测](docs/10_PERFORMANCE.md)、[原始 JSON](artifacts/performance.json)
- [验收状态与未完成项](docs/06_ACCEPTANCE.md)

上述性能为 M2 Pro 桌面浏览器实测，**未测手机真机**。截图只是视觉证据，新的美术完成度仍待用户审核。

## 源码结构

```text
src/content/       Planet / Region / Discovery 定义，首星与后续发现模块
src/game/engine.ts 自动探索、雷达状态、升级、存档验证、离线结算
src/render/        分层渲染、球面预设路径、轨道、动画与深度排序
src/main.ts        DOM 页面、图鉴/基地、弹层、存档事务与标签页同步
src/icons.ts       原创线性 UI 图标与奇物符号
assets/src/        原始透明 PNG 与内置 image_gen 完整提示词
assets/runtime/    导出的运行时 WebP
scripts/           原件导入/验证、生产素材导出、录屏/测量、生成报告
tests/             引擎规则与 Playwright 用户流程
artifacts/         实际录屏、四种遮挡截图、浏览器截图与原始测量
design/reference/  原始设计 PNG/MP4、README 和离线 HTML，不进入构建
```

`npm run assets:export` 从已提交的源 PNG 确定性导出运行时资源。使用内置 image_gen 重制的素材没有硬抠原概念图；当前源为 PNG、提示词和程序动画，非手工 Aseprite 工程。详见 [美术来源](assets/README.md)。

## 本阶段范围

- 可玩退件平原：完整闭合球体、前后轨道、机器人自动探索/扫描/拾取/卸货、拆封鼠、3 件奇物、1 个事件、图鉴、基地展柜、四种升级与离线归航。
- 新手只知道退货箱星；所有未知名称、数量、位置和剪影都不提前显示。
- 雷达可以揭晓并记录下一颗星球，但其远征生态尚未制作。其他内容按独立模块补齐，不用换色场景冒充完成。
- 当前只含一个可玩区域。多区域推进、后续生态、手工多朝向帧、稀有短演出、真机验证与最终数值平衡仍待下一阶段。

产品与设计规范见 [docs/00_DECISIONS.md](docs/00_DECISIONS.md)、[设计说明](design/README.md)、[实施简报](codex/IMPLEMENTATION_BRIEF.md)。
