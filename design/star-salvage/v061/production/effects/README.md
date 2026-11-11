# v0.6.1 光学与引力武装素材

本轮为新增内容，原v0.6武器素材的129份原生图、ORA、运行图及manifest通过只读哈希保护。新素材保持24px像素体系、紫灰机械、暖金机构、冰蓝能量，沿用既有24色色板。

## 资产

7枚24×24图标覆盖prism、gravity、refraction、singularity、kaleidoscope、collapse与eventhorizon。棱镜采用三面晶体、双轴金属支架与底座，引力锚包含内环刻度及紫蓝旋涡，坍缩星核以暗核和四片向内碎棱继承环状机械身份。其他图标使用独立的双晶体、透镜、六镜片阵列和交叉轨道轮廓。

4套透明六帧VFX由内置imagegen生成原始3×2图集，原图与完整prompt保存在generated目录。原生处理在每格内保留高alpha的像素核心，再映射到共同色板、清理成二值alpha。运行2×和4×均为无插值NEAREST输出。接触、展开、碎散和收束阶段分别使用不同帧，亮白限制在原点附近的小区域。

| ID | 原生单帧 | 帧数 | 时长 | 锚点 |
|---|---|---:|---:|---|
| rail_muzzle | 24×24 | 6 | 180ms | [12,17] |
| gravity_burst | 48×48 | 6 | 480ms | [24,24] |
| evolution_corona | 48×48 | 6 | 580ms | [24,24] |
| fusion_nova | 48×48 | 6 | 600ms | [24,24] |

rail_muzzle的originAnchor为[12,17]，emissionDirection为[0,-1]。将原点贴在炮口，并采用同一武器朝向。其他VFX以中心锚点对齐实际碰撞、吸聚或进化位置。帧时长为非匀速列表，完整durationMs和bounds在manifest中。

## 文件与预览

- source保存11项原生PNG与可编辑ORA，每个VFX动画帧为独立图层。
- prototypes/salvage-survivor-demo/assets/v061保存22份2×／4×运行PNG。
- manifest.json记录原生尺寸、帧坐标、锚点、时长与所有文件SHA256。
- icons@4x.png和animations-review.png提供实际原生像素放大预览。
- before-after@8x.png、review-before和revision-review.json保存三项材质精修，以及已批准的kaleidoscope边距修正。
- legacy-baseline.json保存原v0.6接受版本的129份只读哈希。

## 可执行验证

```bash
python3 design/star-salvage/v061/production/effects/export.py
python3 design/star-salvage/v061/production/effects/verify.py
```

校验包括11项原生源、7图标、24个互不重复的VFX帧、完整透明边距、色板、亮白占比、ORA重建、精确2×／4×和旧素材哈希。实际战场映射、攻击效果、组合强度与手机可读性由集成回归验证。
