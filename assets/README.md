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
