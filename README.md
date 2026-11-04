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

无需后端、账号、密钥或广告。角色自动探索，页面切换不中断模拟。初次奇物约 12 秒、首位新居民约 36 秒、夜班事件约 3 分钟；不升级时首轮完整档案约 15.4 分钟（4分钟探索/1分钟守护）。雷达勘测首星真实现场，不快速弹出不能前往的世界。货舱初始离线上限 2 小时。

使用当前浏览器 localStorage。旧切片存档会迁移，保留资金、升级、收藏与历史坐标；已发现航路永久保留；未完成内容禁用远征，不伪造外形。存储写满时保留已读进度并提示，不能把失败的写入当作已持久保存。

## V0.3.4 简洁探索融合版（开发自测）

TapTap开发自测 **432215 / 0.3.4 / 59670a6**，4097743字节包体已上传并读回，主包体未绑定。新二维码在本机会话交付；真实手机审核待扫码。

运行源码 **59670a6**。探索／收藏／基地三个入口，轻点助力真实工作，六件奇物整理与分层展柜、三居民作息、同球昼夜安保与晨修、三个真实建设工程和定向调查已经接成可玩的首星循环。

```bash
npm run dev
# http://127.0.0.1:5173/?sample=fusion
npm run build:fusion
npx vite preview --config vite.fusion.config.ts --port 4207
npm run package:fusion
npm run simulate:fusion
npm run capture:fusion
npm run capture:fusion:compare
```

- [交付与存档边界](docs/28_V034_FUSION_DELIVERY.md) · [实际截图与连续动画](artifacts/fusion/index.html) · [完整融合计划](docs/27_V034_SIMPLIFIED_EXPLORATION_FUSION_PLAN.md)。
- 独立IndexedDB档案导入同源旧档的只读副本，保留原余额、升级和收藏；原localStorage档不回写。不同TapTap版本的来源隔离可能影响旧档可见性，当前没有云档。
- 有效点击600ms、滚动12秒最多5次、平滑消费队列；夜间只聚焦事件。新调查提供真实10%增效与实际记录，收据辨识依赖真实现场，支付不填造缺失记录。
- 本地20/20原件、221单元、230浏览器流程、四种构建通过；160组／1440行实际引擎模拟覆盖27,049旧档与长离线，费用与工作无重复。
- 1倍生产包录像、挂机／主动同档对照、正式相对子目录包与桌面性能数值在审核页分别登记；真实TapTap手机与用户视觉审核继续待验。
- 普通入口保留原版本，融合包独立开发自测。首周2026年11月4日至10日按用户审核结果冻结设计。[此前返修证据](artifacts/v034-refine/index.html)对应历史源码8ffad81。

## V0.3.3 居民作息与收据能力（上一轮审核）

- 三居民白天觅纸/搬壳/巡飞，黄昏归巢，夜间蜷睡/缩壳/收翼，清晨苏醒。普通远征作息使用同一持久4/1昼夜时钟。
- 收据研究独立于柜体，可回应好奇心、读取折层、展开三条事项与地址、核对未发生清单。输入增补签收后，实际结果从2项变为1项，纸面展开、印字、折回和出票随结果变化。
- [实际截图与三段录像](artifacts/v033/index.html)、[范围、数据与限制](docs/23_D1_MOTION_REVIEW.md)。源码和包体对应 **0.3.3 / dcf7e64**，保持[Draft PR #2](https://github.com/sy0310/loststar-game/pull/2)。
- **20/20原件、106单元、142浏览器流程及两份构建通过**。收据能力目前为D1样例回执验证，正式研究成长存档接入待样板审核。真实TapTap手机观感待新码复审，展开折痕仍保留为当前候选。

## V0.3.2 D1 本体与动作精修（历史）

按最新Review和手机视觉反馈继续精修收据与夜间处置。美术子智能体负责原图和分层导出，主线程独立审核实际纸面、抓握、光照、门洞和连续动画。

- 收据本体四档材料、压印与金属墨，新增“观察收据”近景。等比纸卷、共享边界的轻弯曲、显影、柜内反光与真实托盘投影共同构成展品。
- 夜巡采用真实手位、三层透明收容匣、独立翼片折叠和原仓库门洞接收，实体共享环境调色和局部灯光。
- [三段新录像、四档近景及原始采样](artifacts/d1-refinement/index.html)、[逐项精修说明与限制](docs/23_D1_MOTION_REVIEW.md)。源码与包体对应 **0.3.2 / e407d31**，旧版对照保留在[0.3.1审核页](artifacts/d1/index.html)。
- **20/20原件、96单元、126浏览器流程、普通版与D1构建通过**。两引擎移动触控仿真和子目录包已验证，真实TapTap手机表现待新码复审。

本地内部样板为 `/?sample=night-d1` 与 `/?sample=receipt-d1`。生产运行 `npm run build:d1` 后使用 `npx vite preview --config vite.d1.config.ts --port 4187`。`npm run package:d1` 生成只读开发自测包，运行时无需读取真实存档。当前Lv0到Lv1纸张差异较克制，姿态过渡仍有细化空间。

## 原 V0.3 可玩样板（普通游戏继续保留）

- [单页规则与方案比较](docs/21_V03_RULES.md)、[完整交付/经济/限制](docs/22_V03_DELIVERY.md)、[实际运行审核页](artifacts/v03/index.html)。
- 原远征4/1昼夜继续；警戒灯、隔离门、咔哒和飞船负责安保，奇物留在收藏柜、用于互动与启发科研。旧守护等级等值转为安保设备，不清零。
- 新增0–100完整度，真正抵站才损伤；清晨按实修点付费，自动默认开、可关闭/手动，余额不足部分修。0完整度仍有80%探索速度，不丢收藏或已购设备。离线按货舱封顶，超时护站不加账单。
- 零件只有真实维修、有限永久工程、自愿定向调查/科研三类用途。计划90/1200/4800固定预算，实际加速探索/采样并带回本地发现或观察，不自动续费，不虚构新星。
- [86秒完整夜防/损伤/修复](artifacts/v03/security-night-damage-repair-86s.mp4)、[24秒关键段](artifacts/v03/impact-dawn-repair-24s.mp4)、[7零件部分维修](artifacts/v03/manual-partial-repair-live.mp4)、[27049旧档科研投入](artifacts/v03/legacy-research-investment-live.mp4)。全部桌面移动触控仿真，真实墙钟视频；不冒充手机。
- [72组真实引擎经济表](artifacts/v03/economy.md)：120/5000/27049/50000，基础/强安保/重损、自动开关、积累/建设/科研、8/24小时离线封顶。新手基础安保首小时毛2160/维修216/净增1944；余额不强制花到零。
- **82单元＋104浏览器流程、20/20原件与源码CI通过**。TapTap开发自测 **428060 / v0.3.0 / 88e2e6b**。真实手机与长期节奏待扫码；保持Draft，不正式发行、不制作其他星球。

## V0.2.3 历史手机反馈修订


- 用户在424659实机确认机器人走动，指出玻璃框与台架未对齐。已逐件注册实际基座/台面/内腔，前反光不再带第二个底座，取放共用同一坐标，前排不遮后排名牌。
- [最新实际审核页](artifacts/p0-alignment/index.html)、[手机反馈逐项响应](docs/20_PHONE_CASE_ALIGNMENT.md)、[32秒真实整理](artifacts/p0-alignment/home-aligned-robot-32s.mp4)、[六件近景与空柜/升级状态](artifacts/p0-alignment/index.html)。截图/录像来自桌面移动触控仿真，校准版尚待新码手机验收。
- 开发自测 **424769 / v0.2.3 / 2d70b6d**，65单元＋94浏览器流程通过。昼夜逻辑不变，[完整310秒原远征实录](artifacts/p0-main/expedition-full-cycle-310s.mp4)明确来自0.2.2，用户仍在挂机观察；没有把旧包反馈当作整体验收。

## V0.2.2 P0重构记录


- [首页/昼夜审核页](artifacts/p0-main/index.html)、[逐项说明与真实手机验收状态](docs/19_P0_HOME_WORLD_REVIEW.md)。
- 首页直接使用同一个分层 `MuseumScene`，六件实际奇物在玻璃内循环，机器人每14秒走向不同展柜观察、取放和整理；进入近景移动同一Canvas，不维护两套首页。
- 原远征自动经历4分钟白天（末12秒黄昏）＋1分钟夜晚＋清晨。双守护槽在远征白天配置，同一球体/机器人/飞船自动守护；无独立夜守入口，旧实验数据不导入正式收藏。
- [首页整理连续30秒](artifacts/p0-main/home-robot-30s.mp4)、[原远征完整310秒](artifacts/p0-main/expedition-full-cycle-310s.mp4)、[六件触控试验](artifacts/p0-main/home-six-experiments.mp4)、[重算经济](artifacts/p0-main/economy-final.md)。录屏按真实墙钟，来自桌面移动触控仿真，不是手机录像。
- 开发自测 **424659 / v0.2.2 / 14cc368**，包体2,230,063字节。61单元＋94浏览器流程通过，运行代码PR/push CI成功；用户新包手机扫码验收仍待反馈。旧收藏、零件、升级与图鉴保留，不合并、不正式发行。

## V0.2.1 历史复审修订


- [夜守复审审核页](artifacts/v02-review/index.html)、[逐项修订/测试/限制](docs/18_PR2_NIGHT_MODEL_REVIEW.md)。
- 同一份确定性模型驱动动画、在线/离线和晨间：空槽/单件/双件/满级分别提前核验0/1/2/3位，全部安全送回，不损失正式收藏。
- [四配置65秒连续对照](artifacts/v02-review/strategy-comparison-live-65s.mp4)、[14组策略表](artifacts/v02-review/strategy-results.md)、[展柜付款后真实近景切换](artifacts/v02-review/growth-closeup-live.mp4)。
- 新开发自测 **424300 / v0.2.1 / e9c5ce6**，56项单元+80项浏览器流程通过；保持夜守独立可选，等待用户扫码复审。

## V0.2 历史交付

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

Phase 1历史五页和连续视频保留在 `artifacts/phase1/`，当前V0.3安保/维修证据以 `artifacts/v03/` 为准；此前基地对齐证据保留在 `artifacts/p0-alignment/`，旧昼夜在 `artifacts/p0-main/`，根目录原来的中文页面图和 12 秒视频为上一轮历史版本。

## 验证与复现

```bash
python3 scripts/validate_design_assets.py
npx playwright install chromium webkit
npm run check
```

106 项引擎/运动/存储/成长/星图/安保维修与科研测试、142 项浏览器流程。覆盖 360×800、390×844、1440×1000 Chromium 与 390×844 WebKit，包括真实发现演出、首星完整图鉴、展柜、升级、迁移、存储故障、离线上限/防双领、导航安全区及D1只读/安装/触控。

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
