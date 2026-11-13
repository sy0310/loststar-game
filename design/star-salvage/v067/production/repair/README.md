# v0.6.7 修复舱正式素材

两项资产均来自本轮内置image_gen生成，完整原始图与逐项提示保存在originals和prompts.json。

- repair_pod为28×24原生机体，紫灰装甲、两侧金色铰链、展开的维修臂、青绿十字及维修灯。朝前方向为上，供船体侧后方挂载使用。
- repairpod为24×24原生HUD图标，折叠工具臂与居中的青绿十字用于辨认维修功能。

native-edits.json记录机体中央十字的原生像素整理，使医疗标识在实际尺寸清晰完整。

export.py按既有素材流程统一原生像素尺度、紫灰金属调色板与二值透明边缘，导出确定的2倍与4倍PNG。native目录的OpenRaster源文件含装甲、黄铜、维修灯三层，合成结果与原生PNG逐字节相等。

geometry.json记录原生中心、维修光源与工具臂端点，端点需随运行时挂载姿态共同转换。图片保留了明确工具臂与维修灯，实际船体修复数值、动作及光束由主实现接入。

运行`python3 design/star-salvage/v067/production/repair/export.py`重新导出，再运行同目录verify.py验证。contact-sheet.png显示6倍近景和实际2倍尺寸。

两项素材的用户视觉与真实手机表现待审核。
