# v0.4.1 整体异形回收物

本组专门修复“抽象占格轮廓中贴一个箱子”的呈现：**整个异形金属物件本身就是占格外形**。每格24原生像素，1x尺寸为各mask的bbox×24，最大96×96。并未更改任何规则、存档、UID、收费、服务或应用代码。

8件资产分别独立调用内置`image_gen.imagegen`。输入的认可概念板只供材质/配色；独立`*-silhouette-guide.png`仅为形状约束导引，不是运行图或方块占位。高分辨率`*-generated.png`与完整`*-prompt.json`保存，**不声称生成候选已精确按格绘制**。

生产过程由`export_shaped.py`明确记录：将各独立整体机械件制作候选转为24px/格原生材质、共享palette、修复真实物件Alpha与外周实体倒角；按`*-native-edits.json`手工清理结构。没有在逻辑格之间画线或重复放小箱子。legacy12候选本体较窄，因此原生图重建宽运输壳裙边和连续密封条，避免只用近透明黑色填充骗取面积。重建信息在`*-reconstruction.json`，可复查原图与最终源差异。

- ell3/ell4/ell5：一整件L形导管机壳，金色流道跨过相邻格连续弯折。
- tee4：完整T形发动机总成，横向机壳与下方服务颈同一实体。
- ell7：上方宽散热壳与左下服务尾部直接连接的一件残壳。
- legacy12：大一体运输壳，宽上盖与左裙边、内凹密封条。
- legacy16：一件大型完整运输壳，单一不对称检修盖与固定铰链。
- line4：独立生成的完整长导轨；未复用或拉长旧line3贴图。

每件提供`@1x.png`、3材质层可编辑`.ora`和运行`@2x/@4x.png`。透明之外RGBA为0，实体Alpha仅255；仅整体外周（含内凹边）留1px安全间隔。相邻逻辑格的真实材质连续相接，没有格子之间的透明缝。实际占格Alpha为87.8%–100%，未占格为0；几何测试不能代替“看起来是否是实体”的视觉审核。

`validate_shaped.py`校验8件×4旋转、每占格Alpha>70%、空格Alpha0、单一连通实体、每条相邻格接缝至少20px连续、共享palette、整数NN导出及ORA逐像素合成。所有缩放只从1x最近邻导出。`shaped-overview.png`是仅供内部审图的2x联系表，不是运行海报。

重建：
```
python3 design/star-salvage/v041/production/footprints-shaped/export_shaped.py ell3 ell4 tee4 ell5 ell7 legacy12 legacy16 line4
python3 design/star-salvage/v041/production/footprints-shaped/validate_shaped.py
```

素材为本项目新生成并原生修整的原创辅助美术，没有概念图抠取或第三方游戏资产。8件整体轮廓的联系表已获主智能体内部方向认可；legacy12作为旧大型运输壳保留当前平整裙边，不再加饰。实际UI/旋转仍须集成复核，用户与真机未验收。
