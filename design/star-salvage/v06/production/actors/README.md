# v0.6 演员原生像素源

七张原图由内置 imagegen 生成。完整提示与原始输出保存在 prompts.json 和 originals 目录。依据用户最新确认，视觉以 PR 详细说明中的紫灰、暖金、冰蓝科幻方向制作。

## 原生规格

| 角色 | 原生尺寸 | 默认显示 | 识别结构 |
|---|---|---|---|
| player | 24×24 | 48×48 | 灰白回收船、冰蓝舱盖、双后喷口 |
| skimmer | 24×24 | 48×48 | 叉形鼻部、尖翼、珊瑚红识别灯 |
| wisp | 24×24 | 48×48 | 开口月环、悬浮红色传感器 |
| ranger | 24×24 | 48×48 | 双炮管、暖金炮口、方形炮台 |
| tank | 32×32 | 64×64 | 四角矿钳、厚甲、红色炉口 |
| elite | 36×36 | 72×72 | 马蹄形关节翼、暴露反应堆 |
| boss | 48×48 | 96×96 | 四武器臂、大型核心、双后舱 |

原始生成图经统一裁边、像素格化和限色，native 目录保存原生 PNG。OpenRaster 按护甲、暖金结构、能量与光学部件拆为三个可编辑图层。2× 和 4× 运行素材使用最近邻整数输出。生成大图与后制素材的来源分别保留。

## 审核返修

主审核实际查看首版 native-contact 后，要求提高 skimmer 金属棱与识别灯、ranger 双炮口的辨识度。native-edits.json 逐像素记录这些编辑，export.py 可重复应用，既有身份、尺寸和配色保留。

player 喷口锚点由原生像素核验。两个暗喷口中心位于 8.5／21.5 与 14.5／21.5，向下的实际出焰口位于 8.5／23 与 14.5／23。图像中心为 12／12，所有坐标均为原生像素。绘制尾焰时将身体和锚点应用相同的旋转与缩放。

## 复现

```bash
python3 design/star-salvage/v06/production/actors/export.py
python3 design/star-salvage/v06/production/actors/verify.py
```

manifest.json 记录源文件、原生图、ORA 与运行图的字节数和 SHA256。verification.json 记录实际校验。native-contact.png 同时展示放大像素与默认 2× 显示尺寸。

用户视觉与真实手机表现待审。
