# v0.4.2 货物身份 B 组

仅制作现有五个物品／占格组合，不扩展物品、航路、经济或存档模型。

| 物品 | 形状 | 原生尺寸 | 可辨识结构 |
| --- | --- | --- | --- |
| energy_battery | line2 | 48×24 | 受保护的黄色能源芯、粗铜导线和终端 |
| energy_battery | ell3 | 48×48 | 竖向黄芯与弯形铜母线连成完整 L 装置 |
| energy_battery | line3 | 72×24 | 长时差能源芯、中央支架、连续铜导轨 |
| sample | ell3 | 48×48 | 玻璃观察窗与相连的记录机构 |
| sample | line3 | 72×24 | 航行日志记录匣、长玻璃窗、发光记录轨；不是化学瓶 |

每件是一张完整实体图片，外轮廓就是占格。没有抽象格框后贴中央图标，也没有逐格复制箱子。所有相邻占格处保持物理连通；空格透明。

## 来源与制作

- 使用内置 `image_gen` 分别生成五件原创候选，逐件提示词和原始高分辨率 PNG 均保留。
- 唯一风格基准为 v0.4 已批准概念板，仅参考材质、光源和配色，没有从概念板裁剪素材。
- `*-generated.png` 是制作研究稿，不声称其原生尺寸或轮廓已符合货舱网格。
- `export_identity.py` 将完整候选注册到现有占格几何，修整整个实体的外周，落实 24px／格、共享 37 色范围、二值 alpha。L 装置仅对单一原稿的凹角进行单调坐标注册，没有复制独立格内物件。
- `*-reconstruction.json` 记录原尺寸、原稿边界、转角注册及轮廓补全像素。
- `*-native-edits.json` 是可重复的原生精修层；本版无需额外装饰覆盖，保留空数组。
- `@1x.png` 为正式原生源，`.ora` 提供玻璃／记录轨、能源／铜导线、整体金属壳三个可编辑材质层，重合成与原生源逐像素一致。
- 运行素材在 `prototypes/salvage-route-demo/assets/v042/`，2x／4x 为整数最近邻导出。

## 重建与检查

在仓库根目录运行：

```sh
python3 design/star-salvage/v042/production/identity-b/export_identity.py
python3 design/star-salvage/v042/production/identity-b/validate_identity.py
python3 design/star-salvage/v042/production/identity-b/review_identity.py
```

`identity-b-validation.json` 覆盖 5 件 × 4 方向，共 20 次旋转：占格内实体 alpha 超过 70%、非占格 alpha 为 0、单连通体、跨格连续、限定色板、二值透明、2x／4x 及 ORA 精确一致。

`identity-b-reproducibility.json` 记录连续两次重建的 20 个原生 PNG／ORA／运行 PNG 文件 SHA256 完全相同。

`identity-b-overview.png` 与 `identity-b-rotations.png` 是内部审图接触表。主审核已实际查看并认可五件的结构及类别区别，本版冻结，不再扩量或加光。**用户美术与真实手机效果仍待审核。** 工程校验不代替美术或玩法验收。

此美术子任务没有修改公共代码、旧素材、Git、服务或玩家存档。浏览器整合、包体与真机验证由主任务执行。
