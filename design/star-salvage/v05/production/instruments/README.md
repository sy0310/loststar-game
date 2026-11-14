# v0.5 机械奇物

| 奇物 | 占格 | 原生尺寸 | 可见识别点 |
| --- | --- | --- | --- |
| 折时计量盒 `time_measure` | line2，2格 | 48×24 | 玻璃内错轴陀螺、金青双色刻度和错位短针、侧面计量机构 |
| 引力折面器 `gravity_faceter` | tee4，4格 | 72×48 | 对称连续金属板、相连金轨、中央悬浮棱片与下方安定机构 |

每格24原生像素，沿用 v0.4 共享37色色板和上左光源。物体的完整外轮廓对应冻结占格。棱片位于连续底板上的暗色观察凹槽，以下方小阴影表达悬浮。

## 制作记录

内置 `image_gen` 为两件各生成一次，保留真实原始高分辨率 PNG 与完整提示词。原图作为制作研究稿保存，正式原生图另存为 `@1x.png`。

`export_instruments.py` 对完整物体注册、共享色板量化及外周精修。`*-native-edits.json` 明确记录计量盒双色短针和折面器棱面的少量原生清理。逐件 `*-reconstruction.json` 记录原尺寸、边界、轮廓补全及占格覆盖。

ORA 包含玻璃／指示、金色机构／刻度、完整金属壳三个可编辑材质层。2x／4x 位于 `prototypes/salvage-route-demo/assets/v05/`，由原生源整数最近邻导出。

## 重建

```sh
python3 design/star-salvage/v05/production/instruments/export_instruments.py
python3 design/star-salvage/v05/production/instruments/validate_instruments.py
python3 design/star-salvage/v05/production/instruments/make_review.py
```

校验覆盖2件的8个旋转状态、真实格数、占格覆盖率、透明空格、单连通体、跨格连续、37色范围、二值透明、整数导出与ORA重合成。

`instruments-reproducibility.json` 保存连续两次重建的8个文件哈希。`instruments-manifest.json` 绑定原图、提示词、原生源、ORA、运行PNG、制作记录、脚本及接触表。

主审核已实际查看总览并通过内部图审。浏览器整合、用户美术和真实手机效果待主任务验证。24px／格下的倾斜环与短针采用有限像素表达，需要在最终手机缩放中复核辨识度。
