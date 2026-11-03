# 失物星球 · LOSTSTAR

竖屏 H5 · 精细像素 / 分层 2.5D 微缩球体 / 放置探索与怪诞收藏。

> 你的飞船会自动探索怪诞星球，每次回来都带回一些完全搞不懂用途的宇宙奇物。

**当前只做第一阶段：退货箱星 / 退件平原质量基准打磨。** 6 件奇物、3 种居民、3 个事件，连续绕轨与自主探索，三类发现演出，图鉴、基地、工坊和离线归航。后续星球完整远征冻结，先由用户审核首星。

工作分支 `codex/v0.1-vertical-slice`，[Draft PR #2](https://github.com/sy0310/loststar-game/pull/2)。不合并、不发布正式版。2026-11-02 用户授权的 TapTap 开发自测上传见 [实机试玩记录](docs/13_TAPTAP_SELF_TEST.md)。原始设计 PNG/MP4 20/20 已真实导入并校验；运行时素材均独立制作。

## 本地运行

需要 Node.js 22.12+、npm、Python 3；录屏/媒体核验另需 ffmpeg/ffprobe。

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

无需后端、账号、密钥或广告。角色自动探索，页面切换不中断模拟。初次奇物约 12 秒、首位新居民约 36 秒、夜班事件约 3 分钟；不升级时首轮完整档案约 12.4 分钟。雷达勘测首星真实现场，不快速弹出不能前往的世界。货舱初始离线上限 2 小时。

使用当前浏览器 localStorage。旧切片存档会迁移，保留资金、升级、收藏与历史坐标；已发现航路永久保留；未完成内容禁用远征，不伪造外形。存储写满时保留已读进度并提示，不能把失败的写入当作已持久保存。

## V0.2.1 最新复审修订

- [夜守复审审核页](artifacts/v02-review/index.html)、[逐项修订/测试/限制](docs/18_PR2_NIGHT_MODEL_REVIEW.md)。
- 同一份确定性模型驱动动画、在线/离线和晨间：空槽/单件/双件/满级分别提前核验0/1/2/3位，全部安全送回，不损失正式收藏。
- [四配置65秒连续对照](artifacts/v02-review/strategy-comparison-live-65s.mp4)、[14组策略表](artifacts/v02-review/strategy-results.md)、[展柜付款后真实近景切换](artifacts/v02-review/growth-closeup-live.mp4)。
- 新开发自测 **424300 / v0.2.1 / e9c5ce6**，56项单元+80项浏览器流程通过；保持夜守独立可选，等待用户扫码复审。

## V0.2 本轮交付

- [统一审核页](artifacts/v02/index.html)：实际玻璃收藏室、三个生态区、星际监听、夜守与成长工坊。
- [完整交付及已知限制](docs/17_V02_DELIVERY.md)、[经济模拟与有限成本](docs/16_V02_ECONOMY.md)、[可进出的夜守原型](docs/15_NIGHT_GUARD_PROTOTYPE.md)。
- [收藏室21秒](artifacts/v02/museum-live.mp4)、[旧/新动画对照](artifacts/v02/museum-before-after-8s.mp4)、[完整夜守80秒](artifacts/v02/night-watch-live-80s.mp4)、[真实星际采样106秒](artifacts/v02/stellar-listening-live-106s.mp4)。
- TapTap开发自测 **424044 / v0.2.0 / eee74ae**；旧存档沿用原键，基础展示免费，夜守默认独立可选。新版本仍待用户实机审核。

## Phase 1 历史交付

- [本轮审核页](artifacts/phase1/index.html)：开发服务器下打开 `http://127.0.0.1:5173/artifacts/phase1/index.html`。
- [42 秒真实连续运行](artifacts/phase1/expedition-42s.mp4)，含三轮轨道与两次实际发现；[12 秒同源节选](artifacts/phase1/expedition-12s.mp4)。
- 精确 390×844：[远征](artifacts/phase1/390-expedition.png)、[雷达](artifacts/phase1/390-radar.png)、[图鉴](artifacts/phase1/390-collection.png)、[基地](artifacts/phase1/390-base.png)、[工坊](artifacts/phase1/390-workshop.png)，另有对应 @2x 版本。
- [内容、演出与已知优化项](docs/11_FIRST_PLANET_POLISH.md)、[验收状态](docs/06_ACCEPTANCE.md)、[视觉差异](docs/09_VISUAL_REVIEW.md)。
- [实测性能与资源](docs/10_PERFORMANCE.md)、[原始 JSON](artifacts/phase1/performance.json)。**桌面浏览器测量，不代表手机真机认证。**
- [运行时美术源与内置 image_gen 提示词](assets/README.md)。没有从概念拼版硬抠角色，也不把 AI 图集称为手工逐帧定稿。

Phase 1.5 按 PR #2 审核意见修订：[意见逐项对照与 15/30/60 分钟节奏](docs/12_PR2_REVIEW_RESPONSE.md)、[冷加载/字号/动作放大/音效审核页](artifacts/phase1-5/index.html)。首次默认基地，设置可改为远征；首轮之后自动收录居民联动日记，V0.2 已接通星际连续采样；无可靠定位不会生成新航路。

Phase 1历史五页和连续视频保留在 `artifacts/phase1/`，当前V0.2证据以 `artifacts/v02/` 为准，根目录原来的中文页面图和 12 秒视频为上一轮历史版本。

## 验证与复现

```bash
python3 scripts/validate_design_assets.py
npx playwright install chromium webkit
npm run check
```

56 项引擎/运动/存储/成长/星图/夜守测试、80 项浏览器流程。覆盖 360×800、390×844、1440×1000 Chromium 与 390×844 WebKit，包括真实发现演出、首星完整图鉴、展柜、升级、迁移、存储故障、离线上限/防双领和导航安全区。

生产预览启动后，另一个终端重新录制、截图和实测：

```bash
npm run capture
npm run capture:review
npm run report
```

连续录屏使用真实墙钟，无时间跳转、无种存档、无冻结。后期流程截图使用加速测试时钟，遮挡帧只冻结视觉和 HUD；二者均明确标注，不冒充新玩家初始画面。

## 源码结构

```text
src/content/           首星生态、现场信号、可扩展 Planet/Region/Discovery 配置
src/game/engine.ts     自动探索、里程碑、演出消费、雷达、升级、离线、迁移与校验
src/game/persistence.ts 读写分离，存储故障时只执行一次消费
src/render/            地表曲线路径、连续切线轨道、八姿势角色、深度与灯光
src/ui/                像素素材映射、非阻塞发现演出、独立音效事件接口
src/main.ts            页面、图鉴、展柜、工坊、归航、保存锁与标签页同步
assets/src/            透明原始 PNG 与完整内置 image_gen 提示词
assets/runtime/        导出的 WebP 与对齐的角色动作图集
scripts/               导入/校验、生产素材导出、录屏/测量、报告
tests/                 引擎、路径/轨道、存储故障与 Playwright 用户流程
artifacts/phase1/      当前五页截图、连续录屏、演出/遮挡帧和原始测量
design/reference/      真实原始设计 PNG/MP4、README/HTML，不进入构建
```

`npm run assets:export` 从已提交源图确定性导出。当前源为透明 PNG、提示词及动画代码，没有手工 Aseprite 工程。发现音效通过 `loststar:sound-cue` 接入原创 Web Audio 短音效，默认静音，可在设置显式开启；不接外部音频 SDK。

最终主观视觉、手部接触、最小辅助文字、真实手机性能与长期节奏仍待审核。阶段二只有在用户确认首星标准后开始。

## TapTap 开发测试包

`npm run package:taptap` 构建可部署在子目录的 H5 ZIP，输出在忽略提交的 `releases/taptap/`。当前首星开发测试包已上传 TapTap，自测二维码通过会话交付；不是公开商店发布，PR 仍为 Draft。详见 [上传结果与实机试玩](docs/13_TAPTAP_SELF_TEST.md)。
