# V0.3.7 首星实际游玩版

用户已查看并认可V0.3.6星雾和收据动态样板。本轮将两者接入退货箱星的实际探索、收藏和基地流程。

## 新周目

按本次重新开始的要求，首次开局采用120零件、初始设备、空收藏与白天。刷新、切页和再次打开继续当前周目。

当前周目使用 `loststar.fusion.firstplanet.v037`。旧 `loststar.fusion.v1`、`loststar.fusion.review.v035` 和原始localStorage保持原值，可访问来源在新周目首写事务中备份。IndexedDB保存原结构值及可序列化快照，localStorage保存原字符串。加载失败、来源缺失和已备份有各自状态。TapTap各版本若使用不同来源，当前页面只能访问同源存储。

## 实际接入

- 星雾使用认可样板的独立前、体积、轮廓层，以及接触阴影和地表反光。三处对应真实土样、居民栖台和旧分拣区，位置固定于现有实体，种子决定雾形变体。真实探索工作推进揭露，刷新与离线保持结果。
- 点击传递局部暖光反馈，沿用有界助力队列、实际拾取和卸货入账。自动探索可独立完成。
- 收据经历免费松土取出、40零件清理、120零件修补、真实现场线索对照及免费试验。刷毛接触后才清污，双处纤维补片保留原纸破缘和文字。缺失签名保持待证。
- 基地与详情共享纸面、泥层和补片。首次直接进入基地也等待认可材质，加载失败可重试。其余五件使用各自接触点、纹理污层、工具动作、修补和独立试验。
- 物理整理、本体能力和展柜工程分别保存。收据与胶带I/II作用于实际核验和分拣施工，六件藏品各有活动及短句冷幽默。
- 首星保留6件奇物、3位居民、3个事件，以及同画面白天、黄昏、夜间安保、晨间维修、设备、科研、建设和离线归航。

## 画面审查与证据

[统一审核页](../artifacts/first-planet/index.html)包含360×800、390×844 Chromium和390×844 WebKit的实际运行截图，以及认可原图对照。

- [约90秒新档连续实录](../artifacts/first-planet/fresh-exploration-restoration-90s.mp4)展示首次雾区工作、发现土样、真实取出、刷洗、等待实际收入、修补和试验。
- [约310秒完整昼夜](../artifacts/first-planet/full-day-night-310s.mp4)从空收藏白天开始，保持自然时间经历黄昏、入侵、飞船与机器人处置和晨间维修。
- [35秒基地整理](../artifacts/first-planet/base-robot-sorting-35s.mp4)单独展示机器人跨展柜观察、取放和返回。
- [五件奇物清洗修补](../artifacts/first-planet/five-curios-cleaning-repair.mp4)逐件展示真实触控付费、接触面清理、加固与状态变化。
- [六件奇物及基地整理](../artifacts/first-planet/six-curios-base-interactions.mp4)包含独立近景、免费试验和机器人整理。
- [截图与夹具审计](../artifacts/first-planet/screens-evidence.json)说明完整收藏和展柜0–3级由加速真实模型赚取、领取及付费生成。它们属于审阅状态，实际试玩从空收藏开始。

视频按自然时间录制，未加速浏览器时钟。截图与录像均来自桌面浏览器移动触控仿真。真实手机的触控、锁屏恢复、亮度与发热由新TapTap自测包继续审核。

## 经济

[完整经济表](../artifacts/first-planet/economy.md)覆盖新手、关联27,049旧源的新周目、保留27,049和50,000的兼容旧档。每组包含挂机与有界助力下0、5、15、30、60、120分钟，并另测8、24、72小时离线。

| 分钟 | 挂机累计毛收入 | 挂机自愿消费 | 挂机实付维修 | 挂机余额 | 助力余额 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 | 120 | 120 |
| 5 | 249 | 300 | 18 | 51 | 72 |
| 15 | 995 | 968 | 54 | 93 | 127 |
| 30 | 2621 | 2548 | 108 | 85 | 107 |
| 60 | 6214 | 6008 | 198 | 128 | 372 |
| 120 | 13400 | 12948 | 342 | 230 | 714 |

表格消费由已披露的自动选项策略产生。整理、修复、设备、本体能力、实际分拣、观察、展柜和建设各有真实效果。12项检查核对余额恒等式、实际报价、防重复收费、防双领、证据、雾、权益与离线上限。

满配27,049兼容旧档可购买的本体能力、分拣支线、三项观察和工程共消费14,970，120分钟后余额36,343。首星有限成长完成后仍有盈余，长期消费吸引力继续由实际游玩审核。新周目未借用旧源余额。

## 复现

```bash
npm ci
npm run check
npm run simulate:firstplanet
npm run package:fusion
python3 -m http.server 4221 --bind 127.0.0.1 --directory releases/taptap/loststar-fusion
```

另开终端执行以下命令。打包目录在录像及测量期间保持固定。

```bash
npm run capture:firstplanet -- fresh
npm run capture:firstplanet -- cycle
npm run capture:firstplanet -- screens
npm run capture:firstplanet -- base
npm run capture:firstplanet -- curio-care
npm run measure:firstplanet
node scripts/smoke_firstplanet_package.mjs
python3 scripts/build_firstplanet_gallery.py
```

子目录包烟测默认使用4218端口的 `releases/taptap` 静态服务。可通过 `FIRSTPLANET_PACKAGE_URL` 指定实际子目录入口。

## 本轮验证

运行源码为 `b7f7326dbbadccbe60627a7e954a834be7275fa0`。`npm run check`通过20/20原件校验、43文件277项单测、五类生产构建和378项浏览器流程，零失败、零跳过、零重试通过项。最终子目录包另有6组真实购买与刷新烟测。

声明的覆盖范围为引擎、模型和几何模块，语句97.05%、分支95.81%、函数99.11%、行99.42%。完整UI和渲染依据截图、交互流程、连续录像和实际绘制诊断验证。

[验证摘要](../artifacts/first-planet/verification.json) · [完整check日志](../artifacts/first-planet/check.log) · [浏览器结果](../artifacts/first-planet/e2e-results.json)

Linux CI首轮在三项WebKit流程达到30秒测试时限。两个存档测试现采用跨时间后验证真实落盘，完整多步整理流程采用60秒时限。32项针对性浏览器回归通过，最终整套CI见PR Checks。实际运行包的游戏源码与素材树记录在验证摘要中。

### 资源与性能

最终H5 ZIP为4,962,137字节，展开5,224,900字节、86个文件。其中79张运行时WebP共4,781,592字节，全部源图按宽×高×4估算31,341,360字节。该总量属于源图解码估算，实际同时存活量、Canvas复制及GPU占用另计。

Apple M2 Pro桌面主机，390×844、DPR2、触控仿真，单浏览器单页面，1.5秒预热后采样10秒，测量期间无录屏和其他自动化流程。以下为实际绘制间隔。

| 引擎 | 画面 | 绘制间隔中位数 | P95 |
| --- | --- | ---: | ---: |
| Chromium | 首屏星雾 | 16.7 ms | 17.4 ms |
| Chromium | 六柜基地 | 16.7 ms | 17.6 ms |
| Chromium | 基地减少动态 | 33.4 ms | 34.2 ms |
| Chromium | 收据工作台 | 16.7 ms | 16.7 ms |
| Chromium | 胶带近景 | 16.7 ms | 16.8 ms |
| WebKit | 首屏星雾 | 17.0 ms | 17.0 ms |
| WebKit | 六柜基地 | 17.0 ms | 32.0 ms |
| WebKit | 基地减少动态 | 33.0 ms | 50.0 ms |
| WebKit | 收据工作台 | 17.0 ms | 30.0 ms |
| WebKit | 胶带近景 | 17.0 ms | 33.0 ms |

Chromium粗粒度JS堆采样最大18.2MB，WebKit未提供该接口。该值排除贴图、GPU与浏览器进程内存。WebKit计时粒度会让小于1ms的绘制耗时显示为0。减少动态使用约30fps保留必要动作。

[原始性能结果](../artifacts/first-planet/performance.json) · [逐图资源数据](../artifacts/first-planet/resources.json) · [最终包信息](../artifacts/first-planet/package-info.json)

### TapTap 开发自测

新版本 **435439 / v0.3.7 / b7f7326** 已上传并由远端列表回读核对。包名 `loststar-0.3.7-b7f7326-fusion-h5.zip`，竖屏，ZIP SHA256为 `ad81669a7e7535bf785215ae349713bf716c0364217f2bdf4845eae5c618a470`。

开发自测二维码经会话交付，远端状态 `is_releasing=false`，主包槽位保持原状态。源码与证据继续在Draft PR #2提交。

[脱敏上传核验](../artifacts/first-planet/taptap-self-test.json) · [Draft PR #2](https://github.com/sy0310/loststar-game/pull/2)

## 当前边界

- 三处雾使用现有真实锚点与持久化雾形变体。星球地形保持统一实体位置。
- 收据整理台采用已校准的基础罩，基地及展柜工程近景呈现购买的0–3级结构。
- 本体I/II能力目前覆盖收据与胶带，其余四件已有物理整理及独立试验。
- 浏览器测量覆盖桌面主机。完整GPU内存、真实TapTap WebView长期负载与热表现仍待实机结果。
