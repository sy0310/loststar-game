# 0.4 像素素材制作提示词与技术验收（美术源文件待实际制作）

> 这不是生产素材本体。最终请以用户认可的 `salvage_v04_approved_full.png` 为视觉引用，按统一像素格在独立图层重新绘制；禁止抠取概念海报上的“场景+文字+按钮”作运行大图。概念图中的中文、数字和UI位置不是 sprite 的一部分。

## 固定风格标签（每一张都带上）

`cohesive medium-density pixel art, single consistent logical pixel grid, clean hard-edged 1x pixel clusters, restrained sci-fi industrial detail, violet/navy deep space harbor, purple gray metal, warm amber windows and signal lights, soft turquoise accents, clean silhouette, consistent upper-left light direction, original design, legible at 390px phone width, no anti-aliased gradients in sprite pixels, no watermark, no baked UI labels, no photo-realism, no copy of existing game's assets`

视觉参考 SHA256 `16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0`。完整板图是**风格/构图参考**，不能因为“风格接近”就称与原图相同。

## 港口静态背景｜`harbor_bg`

**绘制画布**：192×320原生像素，RGBA或RGB；导出384×640 @2x、768×1280 @4x。

> 竖屏宇宙港湾，正中一座中等复杂度的空间站码头主楼，橙金灯照亮中央机库，左侧停机平台和护栏，右侧适量工业仓储箱，背景深紫夜空和一颗柔和紫色大行星。低频水面反射可以静态绘制。保持大块体积和可辨认门、窗、天线、台阶，而不是随机噪点像素。留出飞船停靠台的空白和上方资源HUD安全区。**不画飞船、不画UI悬浮按钮、不画中文**；背景便于在360/390宽自然裁切。

验收：主楼占视觉中心，不被四圆按钮遮死；背景透视统一；不靠动画增质感；要有机库、码头护栏和船台的真实空间层次。

## 前景遮挡层｜`harbor_front`

> 与上述港口背景同透视与像素尺度，仅绘制码头前侧护栏/引导灯/少量近景货箱的透明前景层。不要夹带背景、飞船或UI。前景只用于合理遮挡与层次，不能遮住关键按钮。

## 四类飞船｜`ship_starter, ship_cargo, ship_scout, ship_heavy`

**每款独立96×48原生像素透明sprite，导出192×96 @2x / 384×192 @4x。统一面向右前的轻等距视角、同一光照/基线，不允许每一款飞船采用不同像素颗粒。**

- `ship_starter`：白灰船壳、橙金条纹，两扇青色驾驶舱窗、短机翼、侧面起落架；民用改装小型拾荒船，适合初始停机坪。
- `ship_cargo`：明显更长更宽，机身侧外挂标准化货舱箱/运输吊架，尾部双引擎；从剪影就能看出“装得多”。
- `ship_scout`：机头流线更尖、探测圆盘/天线、机腹紧凑，蓝青传感器窗口；从轮廓能看出“跑得远、探测”。
- `ship_heavy`：加强支架/多段舱体/外部护板，工业工程船厚实稳定；若游戏暂未开放，标记UI“不在售”，仍可作为设计参考。

验收：分别缩成60×30CSS像素仍能辨认不同；不能只靠换色。每艘船与 dock 透视方向一致，透明像素边界无灰边/背景抠图残留；换船后 HOME 实际显示新船图。

## 八件货物｜`item_*`

**每件24×24原生像素透明图，2×/4×导出。** 具象物件材质、少量2–3色阴影、统一外轮廓；贴在货舱 4×4格面板里时仍可辨认。不要把`shapeMask`轮廓图当成物品实际外观。

- `item_metal_crate` 金属箱：银紫箱体、两个铆钉、暖黄警示条。
- `item_energy_battery` 能源电池：窄高蓝灰电池、有金色电极、青色能源窗。
- `item_nav_chip` 导航芯片：扁平方形电路板、金色引脚、中心紫青运算晶片。
- `item_broken_engine` 损坏引擎件：轮毂、金属环、断裂的气管与褐红油痕。
- `item_medkit` 医疗箱：紧凑浅灰箱，红/珊瑚色医疗标记、提手。
- `item_fuel_can` 备用燃料罐：橙红罐身、盖口、滴状标记、少量磨损。
- `item_sample` 观测样本：短玻璃舱内的小紫晶簇、青色基座，避免魔法奇幻过头。
- `item_toolbox` 维修工具箱：蓝灰工具箱、橙色卡扣和小扳手符号。

新物品类型要稳定`itemId`和`spriteId`。旧版本物品需要不剧透的兼容视觉映射，但保留 UID/name/value/shape/来源。

## UI 图标与控件

四个圆形入口不烘焙在背景中：货舱（微缩箱体/格网）、商店（小棚顶）、飞船（明确机身剪影）、任务（剪贴板）；建议24×24像素图标和≥44CSS px 点击区，中文标签真实文本。底部暖金 **出发** 是唯一主按钮；仅次一级面板用“返回”。商店补满/改装/购船/接任务按可读的实际价格与状态生成交互。

## 制作与交付要求

- 人工/生成后统一做1x逐像素清理、边缘/透明/颜色和透视校正；如果生成器无法精确控制像素尺度，**重新按网格绘制**，不得简单声明图片像素风便已满足要求。
- 1x源文件优先保留可编辑工程（.ase/.kra/.ora 之一），2x/4x 仅整数最近邻导出；运行 PNG/WEBP 必须真正通过浏览器解码。
- 附每张素材原1x尺寸/导出尺寸/透明与否/用途/许可证/文件SHA；在PR里对照概念源图逐项复审。
- 优先做 `harbor_bg`+初始船+四悬浮按钮的完整 HOME 视觉切片，**玩家看过再继续扩写全部装饰**；但原本的游戏规则与存档测试仍必须跑。
