# 运行时美术来源与制作

所有运行时美术为本项目原创重制，不从概念拼版硬抠、不复制第三方游戏。

| 源 | 制作与用途 | 输出 |
| --- | --- | --- |
| `src/generated/parcel-globe.png` | 内置 image_gen 生成，透明闭合球体，地形/纸箱材质；不含角色和大仓库 | `runtime/parcel-globe.webp` |
| `src/generated/units-sheet.png` | 内置 image_gen 生成，透明 2×2 独立机器人/飞船/仓库/拆封鼠 | 四个透明 WebP |
| `src/generated/station.png` | 内置 image_gen 生成，空展柜与基地背景 | `runtime/station.webp` |
| `../src/render/scene.ts` | 本项目自绘/程序动画：机器人腿部切片、拾取姿态、扫描束、拾取物、喷焰、旗帜、光点、投影、星空 | 浏览器独立渲染层 |
| `../src/icons.ts` | 本项目原创线性 UI 图标与奇物符号 | SVG DOM |

生成使用内置工具，无外部下载/第三方素材授权依赖。源 PNG、完整提示词 `src/generation-prompts.json`、导出脚本与全部动画源码均保留。AI 生成资产需用户视觉复审，不声明排他著作权。

导出：`node scripts/export_assets.mjs`。脚本先按象限分出生产精灵，再裁去透明留白，以最近邻统一输出分辨率并保留 alpha。不会修改原始设计图。

这里的源为透明原始 PNG + 提示词 + 程序动画代码，**没有手工 Aseprite 分层源工程**。机器人使用上身与两条腿的可重用切片变换，尚非逐朝向的手工全套帧；拆封鼠使用小幅姿态、拆箱纸屑循环。基地美术独立重制，保留已认可的紫蓝空间、暖灯与收藏柜方向，具体新构图待审核。

设计参考另存于 `design/reference/`，不进入 Vite 构建。不要将其移到 public。
