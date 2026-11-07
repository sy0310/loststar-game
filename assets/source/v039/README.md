# V0.3.9 原创修复材质与工具原片

2026-11-05，内置 `image_gen.imagegen`，透明背景请求。没有调用CLI/API fallback、没有外部游戏素材。既有原创 `assets/runtime/tape.webp` 与 `bell.webp` 仅作为风格、光照和材质参考，原本体保持原像素身份。完整prompt和生成路径见 `prompts.json`。

| 原始PNG | 用途与处理 |
| --- | --- |
| tape-adhesive-fibers-v1.png | 首稿细纤维；192/68px审计过弱，保留返修记录，不选入运行 |
| tape-adhesive-fibers-v2.png | 选定候选：集中灰紫纸纤维团、卷曲纸屑与透明胶残留；只作胶面粘附层 |
| bell-corrosion-v1.png | 选定候选：带孔蚀的黄铜氧化壳；穹顶下沿和轴根分开注册 |
| restoration-tweezers-v1.png | 选定候选：双尖镊子；透明夹口中心为逻辑接触点 |
| restoration-screwdriver-v1.png | 选定候选：细一字螺丝刀；实心刃端为工作点 |

所有原始PNG按生成原字节完整复制，未伪称手绘原画工程或现成atlas。`scripts/export_v039_art_assets.mjs` 保留真实alpha，以源图透明包络裁切、最近邻等比缩小，粘附/锈壳层与原物件alpha相交后注册到192画布，WebP为lossless。工具无独立地面或底影，运行时由同一光照和工具接触模型处理。

胶带灰层同时导出完整、胶尾、固定卷壁三张。消费者使用独立两张时不要再叠完整层，否则会重复加深。收据沿用 `v034` 纸面/原墨遮罩与 `v034-refine` 已有两处纤维层，未再生成完整收据，以免改变原字/破口/签收缺失。

这批图层的选择由美术子代理完成，最终运行渲染和用户视觉审核由主线程进行；素材落盘不等于动态验收。状态方案与审计说明见 `design/v039/ART_STATES.md`。
