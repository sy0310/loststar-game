# 运行时美术来源与制作

所有运行时美术为本项目原创重制，不从概念拼版硬抠、不复制第三方游戏。

| 源 | 制作与用途 | 输出 |
| --- | --- | --- |
| `src/generated/parcel-globe.png` | 内置 image_gen 生成，透明闭合球体，地形/纸箱材质；不含角色和大仓库 | `runtime/parcel-globe.webp` |
| `src/generated/units-sheet.png` | 内置 image_gen 生成，透明 2×2 独立机器人/飞船/仓库/拆封鼠 | 四个透明 WebP |
| `src/generated/items-sheet.png` | 内置 image_gen 生成，透明 2×2 收据/胶带/套娃包裹/事件信封 | 四个透明 WebP |
| `src/generated/station.png` | 内置 image_gen 生成，空展柜与基地背景 | `runtime/station.webp` |
| `../src/render/scene.ts` | 本项目自绘/程序动画：机器人腿部切片、拾取姿态、扫描束、拾取物、喷焰、旗帜、光点、投影、星空 | 浏览器独立渲染层 |
| `../src/icons.ts` | 本项目原创线性 UI 图标与奇物符号 | SVG DOM |

生成使用内置工具，无外部下载/第三方素材授权依赖。源 PNG、完整提示词 `src/generation-prompts.json`、导出脚本与全部动画源码均保留。AI 生成资产需用户视觉复审，不声明排他著作权。

导出：`node scripts/export_assets.mjs`。脚本先按象限分出生产精灵，再裁去透明留白，以最近邻统一输出分辨率并保留 alpha。不会修改原始设计图。

这里的源为透明原始 PNG + 提示词 + 程序动画代码，**没有手工 Aseprite 分层源工程**。机器人使用上身与两条腿的可重用切片变换，尚非逐朝向的手工全套帧；拆封鼠使用小幅姿态、拆箱纸屑循环。基地美术独立重制，保留已认可的紫蓝空间、暖灯与收藏柜方向，具体新构图待审核。

设计参考另存于 `design/reference/`，不进入 Vite 构建。不要将其移到 public。

## 首星打磨新增（2026-11-02）

| 可修改源 | 输出与作用 |
| --- | --- |
| `src/generated/robot-actions-v2.png` | 4×2 八姿势原图；保留单元留白对齐成 `runtime/robot-actions-v2.webp`，不逐帧随意裁剪锚点 |
| `src/generated/parcel-ecology-v2.png` | 箱寄居蟹、标签鸟、收件人宇宙包裹、邮戳 |
| `src/generated/parcel-props-v2.png` | 分拣机、签收铃、夜班机、空白地址信 |
| `src/generated/equipment-v2.png` | 雷达、扫描仪、回收装置、货舱四种设备像素图 |

均使用内置 image_gen；机器人以本项目旧机器人透明精灵为编辑目标保持身份，其他为新制独立透明图集。完整提示词见 `src/phase1-generation-prompts.json` 和 `src/equipment-generation-prompt.json`。源文件、旧版参考与旧版运行时原图均保留。导出脚本使用标准图像处理做分格、最近邻缩放和压缩；程序动画另见 `src/render/`。当前仍没有手工 Aseprite 工程，不把 AI 图集宣称为手工逐帧定稿。

## PR #2 Phase 1.5

- `src/generated/ship-directions-v3.png`：基于原飞船编辑的四向透明图集，运行时按象限对齐为 `ship-directions-v3.webp`。保留舷侧、船首、另一舷侧、船尾视角，不用整张图倒转代替方向。
- `src/generated/robot-empty-v3.png`：基于原八姿势图集去掉手内固化包裹，保留空手抓取/携带/递交姿态。`robot-empty-v3.webp` 固定 160px 单元；包裹位置由独立运动数据与 Canvas 层绘制。
- 完整内置 image_gen 提示词：`src/phase1-5-generation-prompts.json`。旧源与旧图集保留；没有手工 Aseprite 工程。
- 声音源：`../src/ui/audio.ts` 的原创振荡器/包络短音效；无第三方音源。`../artifacts/phase1-5/audio/` 是通过同一代码离线渲染的 WAV 审听样本。

## V0.2 收藏室与夜守素材

内置 image_gen 独立制作 `glass-a/b/c-v02.png`（每张两种容器、上排后壁、下排前玻璃），`museum-room-v02.png` 初稿与 `museum-room-spaced-v02.png` 调整后空房间，`habitats-v02.png` 三个不含居民的环境、`invader-v02.png` 一种纸影的四姿态。原始PNG和完整提示词 `v02-generation-prompts.json`、`v02-followup-prompts.json` 均保留；没有手工Aseprite工程。

运行 `npm run assets:export:v02`：标准分格、最近邻缩放、WebP导出；容器前后层保持相同单元坐标，藏品/居民由独立图像及运行时代码绘制。12张玻璃层、1房间、3生态背景、1入侵者图集作为正式运行纹理；不从设计参考拼版取材。`v02-metadata.json` 记录容器来源单元。主游戏不打包概念PNG、审核截图或录像。


## V0.3 安保/损伤/维修样板

没有重画另一颗球体或拿参考拼版投产。警戒灯复用本项目原创 `equipment-radar.webp`，隔离设施复用 `sorter.webp` 的机壳/底座，并以独立Canvas闸栏、警戒引导光、状态短签实现工作层。咔哒、飞船和纸影仍用原透明图集；损伤裂纹、撞击碎屑、护板补片和焊接火花是 `src/render/guard-scene.ts` 的程序层，由同源实际事件/维修记录驱动。没有新增第三方素材、战斗页面或黑底整图替换；现有源PNG/完整提示词保留。
