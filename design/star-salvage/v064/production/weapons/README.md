# v0.6.4 独立折射水晶

实际战斗复核发现旧 `prism` 图标带有炮台底座，不适合作为船边悬浮晶体。本素材 `prism_crystal` 专供运行时晶体机体，沿用既有 `refraction` 的青蓝与浅紫晶面。

使用内置 imagegen 独立制作完整透明原图。原图保存在 `originals/prism_crystal-generated.png`，完整提示、原始路径和工具信息保存在 `prompts.json`。原生网格为 16×24，2×显示为 32×48，保持小型水晶的实际存在感。

主体只有细长菱形矿物、清楚的青蓝/浅紫分面、白亮核心与少量暖金边。没有底座、炮管、船翼、圆环、文字、尾焰或画入主体的外光晕。正式 PNG 使用既有 v0.6 武器色板和二值透明，原图的低透明外缘在规范化时裁除。

`native/prism_crystal.ora` 具有晶面、核心和金边三个可编辑材料层，其合成与 1× PNG 逐像素相同。2×/4×为最近邻整数导出。清单登记 `kind: effect`，默认单帧，中心与帧锚点均为 `[8,12]`，不参与敌机的受击闪白处理。

```bash
python3 design/star-salvage/v064/production/weapons/export.py
python3 design/star-salvage/v064/production/weapons/verify.py
```

`contact-sheet.png` 显示实际2×与4×尺寸。静态验证不代表实际战斗视觉、用户或真实手机已验收。
