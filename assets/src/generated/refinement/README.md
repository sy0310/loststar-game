# V0.3.5 分拣支线原创素材

2026-11-04 使用 OpenAI 内置 `image_gen` 生成。两张 PNG 均是本项目原创新增的素材源，以本仓库已有球体、仓库和分拣设备美术为参考。没有使用其他游戏的图片。生成图并非原生分层精灵，运行时图层由脚本和人工像素注册重新制作。

## sorting-machine-v1.png

原始生成画布为 1254 × 1254 RGBA。生成任务的参考图为本仓库 `parcel-globe` 原始运行美术、`assets/runtime/sorter.webp` 和 `assets/runtime/warehouse.webp`。

本轮生成提示的制作要求留档如下。

```text
Use case: stylized-concept. Create a SINGLE original compact parcel sorting machine on a transparent background. Match the same high-density pixel-art palette and three-quarter camera from above, front-left, as the supplied original parcel-globe, sorter and warehouse references. This is a battered old paper-jam sorter, with an EMPTY roller belt projecting toward the front left, a rear housing on the right, side motor, hinged inspection hatch, thick pipes, bolts and worn orange/brass paint over a dark purple frame. Include only two small cyan lamps. Keep the roller bed empty so boxes and crumpled paper can be independent runtime layers. No readable text, no logos, no loose boxes, no paper jam, no floor, no characters, no globe, no UI. Preserve crisp pixel clusters, material depth, clear mechanical feet and isolated alpha. Rear body art only, the runtime will supply the contact shadow. Not a contact sheet.
```

## paper-jam-v1.png

原始生成画布为 1774 × 887 RGBA。参考图为新机器原图与本项目微缩球体美术。

```text
Create a single original low horizontal pile of crumpled aged packing paper on a transparent background, approximately 2:1 in silhouette. Six to nine large readable folds, ivory and ochre paper, torn edges, curled ends and a few old red-blue airmail edges. Match the exact three-quarter camera from above, front-left, and the crisp high-detail pixel-art palette of the supplied sorting machine and original parcel-globe. This pile is a loose runtime obstruction on the empty rollers, so do not include the machine, floor, any contact sheet, text, numbers, logos or characters. Keep isolated alpha and natural material shading.
```

## 可重复导出

从仓库根目录执行 `node scripts/export_refinement_assets.mjs`。

导出结果位于 `assets/runtime/refinement/`，包括静态后壳、独立前唇、展开的滚轮材质、三片独立帘片和纸堆。`registration.json` 保存源文件与导出文件的 SHA-256、尺寸和像素注册点。运行时逐根滚轮旋转、帘片铰接、纸层剥离，机壳本体保持静止。

机器的 320 × 320 注册画布以 `(116,279)` 为接地点，四个足点为 `(52,259)`、`(116,279)`、`(194,249)` 和 `(259,219)`。运行时148像素宽，接地点映射为同一球体后侧橙色地表 `(410,315)`。每只脚另绘接触阴影。仓库前景继续遮挡左侧近脚，机器人沿原球面路线绕行。

P03 与倒置 P30 由代码根据已取得的真实 `sourceFacts` 绘制。AI 源图没有用于提供游戏记录。未知支线没有图像及点击目标。素材实际合成、阶段行为和手机 WebView 仍以 Draft PR 的运行截图及连续录屏审查为准。
