# 失物星球 · LOSTSTAR

竖屏 H5 · 精细像素 / 分层 2.5D 微缩球体 / 放置探索与怪诞收藏。

> 你的飞船会自动探索怪诞星球，每次回来都带回一些完全搞不懂用途的宇宙奇物。

**当前只做第一阶段：退货箱星 / 退件平原质量基准打磨。** 6 件奇物、3 种居民、3 个事件，连续绕轨与自主探索，三类发现演出，图鉴、基地、工坊和离线归航。后续星球完整远征冻结，先由用户审核首星。

工作分支 `codex/v0.1-vertical-slice`，[Draft PR #2](https://github.com/sy0310/loststar-game/pull/2)。不合并、不部署。原始设计 PNG/MP4 20/20 已真实导入并校验；运行时素材均独立制作。

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

使用当前浏览器 localStorage。旧切片存档会迁移，保留资金、升级、收藏与历史坐标；当前界面只提供已可玩的航路。存储写满时保留已读进度并提示，不能把失败的写入当作已持久保存。

## 本轮交付

- [本轮审核页](artifacts/phase1/index.html)：开发服务器下打开 `http://127.0.0.1:5173/artifacts/phase1/index.html`。
- [42 秒真实连续运行](artifacts/phase1/expedition-42s.mp4)，含三轮轨道与两次实际发现；[12 秒同源节选](artifacts/phase1/expedition-12s.mp4)。
- 精确 390×844：[远征](artifacts/phase1/390-expedition.png)、[雷达](artifacts/phase1/390-radar.png)、[图鉴](artifacts/phase1/390-collection.png)、[基地](artifacts/phase1/390-base.png)、[工坊](artifacts/phase1/390-workshop.png)，另有对应 @2x 版本。
- [内容、演出与已知优化项](docs/11_FIRST_PLANET_POLISH.md)、[验收状态](docs/06_ACCEPTANCE.md)、[视觉差异](docs/09_VISUAL_REVIEW.md)。
- [实测性能与资源](docs/10_PERFORMANCE.md)、[原始 JSON](artifacts/phase1/performance.json)。**桌面浏览器测量，不代表手机真机认证。**
- [运行时美术源与内置 image_gen 提示词](assets/README.md)。没有从概念拼版硬抠角色，也不把 AI 图集称为手工逐帧定稿。

当前证据以 `artifacts/phase1/` 为准，根目录原来的中文页面图和 12 秒视频为上一轮历史版本。

## 验证与复现

```bash
python3 scripts/validate_design_assets.py
npx playwright install chromium webkit
npm run check
```

18 项引擎/运动/存储测试、32 项浏览器流程。覆盖 360×800、390×844、1440×1000 Chromium 与 390×844 WebKit，包括真实发现演出、首星完整图鉴、展柜、升级、迁移、存储故障、离线上限/防双领和导航安全区。

生产预览启动后，另一个终端重新录制、截图和实测：

```bash
npm run capture
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

`npm run assets:export` 从已提交源图确定性导出。当前源为透明 PNG、提示词及动画代码，没有手工 Aseprite 工程。发现音效通过 `loststar:sound-cue` 预留结构，目前不接音轨或外部 SDK。

最终主观视觉、手部接触、最小辅助文字、真实手机性能与长期节奏仍待审核。阶段二只有在用户确认首星标准后开始。
