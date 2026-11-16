# v0.4.2 原生货物：identity-a

仅覆盖本轮已存在的六个 `itemId × shapeId` 组合；不新增几何、面积、售价、掉落或存档规则。

| 组合 | 原生尺寸 | 实体识别点 |
| --- | --- | --- |
| broken_engine × line2 | 48×24 | 单涡轮、冷却管、散热槽 |
| broken_engine × rect8 | 96×48 | 双涡轮、跨机壳冷却管、宽散热器 |
| broken_engine × tee4 | 72×48 | 连续T形冷却机壳、上臂散热、下部排气 |
| nav_chip × line2 | 48×24 | 青绿线路板、紫色导航处理器、金触点 |
| nav_chip × ell5 | 72×72 | 整体L形导航天线PCB、连续线路和导体 |
| medkit × line2 | 48×24 | 浅色医疗匣、珊瑚色十字、铜卡扣 |

## 来源和加工

每件分别调用一次内置 `image_gen`，完整提示词与参考角色在 `prompts/requests.json`；`raw/` 保留未修改生成候选。生成候选是高分辨率参考，不宣称为24px原生源。

`render_identity.py` 将新物体材质整理至24原生像素/格，使用v0.4共享37色、二值alpha。T形和L形按整个连通物体的结构边界重排网格，未按格重复贴图。几何alpha严格复用现有v0.4.1对应轮廓，旧图RGB未进入新图；空白格像素全部为RGBA0。边界补色来源与逐像素改动记录保存在 `processing/`。

`native1x/` 为正式原生源，`editable/` 为材质分层ORA；运行素材位于 `prototypes/salvage-route-demo/assets/v042/`，只使用2x/4x最近邻整数导出。没有覆盖旧素材。

## 重复生成与验证

```bash
python3 design/star-salvage/v042/production/identity-a/render_identity.py
```

生成 `manifest.json`（原始候选、源、ORA、加工记录与导出SHA）、`validation.json`（四旋转mask、透明、连通、颜色与逐格覆盖）和 `identity-a-contact.png`（仅审核总览）。ORA使用固定ZIP时间，重复生成的manifest字节一致。

工程资产检查与主代理内部视觉审核分别记录；用户视觉、真实手机与实际货舱接入不能由这些资产检查代替。主代理已查看总览并内部通过，`review.json`绑定批准的原生源SHA；素材冻结，不再添加高光或装饰。实际运行映射与触控由主代理验证，用户/真机未验收。
