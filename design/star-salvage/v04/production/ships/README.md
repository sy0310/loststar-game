# 四船像素制作源

唯一视觉基准：`../../concepts/salvage_v04_approved_full.png`，SHA256 `16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0`。该图仅作风格/轮廓参考，没有抠取任何船体或海报区域。

四船各独立调用内置 `image_gen.imagegen`，透明高分辨率制作候选保留为`*-generated.png`，完整提示词与输入引用在`*-prompt.json`。工具不暴露模型版本，因此不编造型号。生成候选不是原生96×48交付，也不直接用于运行。

真正交付为每艘独立`@1x.png`（96×48）：以透明覆盖和材质块重建到原生网格，逐像素分配共享palette，不使用抖动；按`*-native-edits.json`在原生网格重绘驾驶窗、箱门结构、细天线和起落架。四船共用左上光、机头朝左、脚底y42。具体尺寸/调色/编辑与导出代码在`export_ships.py`。

每艘可编辑`.ora`含96×48的船壳/着陆架、舷窗、暖色标记三个独立材质层，准确合成最终PNG。2x与4x PNG只从1x整倍最近邻导出，分别在`../../../../../prototypes/salvage-route-demo/assets/v04/`。不会从概念图“暴力抠图”或逐船单纯换色。

- starter：短民用机身、双青色舷窗、暖金斜带、单主发动机。
- cargo：明显更长的双箱式货舱、箱门竖肋、双后发动机、三处起落架。
- scout：长尖低船首、小型探测碟、细天线、紧凑船腹。
- heavy：较短厚实的工程船壳、外部金属护框与管路、加粗起落架；是否出售由模型/UI决定，素材存在不代表已开放。

运行`python3 design/star-salvage/v04/production/ships/export_ships.py ship_starter ship_cargo ship_scout ship_heavy`可重建导出；随后运行同目录`validate_ships.py`检查原生尺寸、二值Alpha、共享调色板、边距、NN倍率及ORA逐像素合成。`ships-native-overview.png`为源图4x审阅联系表，不进入玩家运行资产。

来源为本项目新生成并清理的原创辅助美术，不含第三方游戏素材。当前只支持内部方向复核；实际主屏接地/遮挡与浏览器解码由集成后验证，用户美术与真机验收另列。
