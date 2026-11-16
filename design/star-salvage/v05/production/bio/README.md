# v0.5 生物奇物原生素材

| 奇物 | 占格 | 原生画面 | 可辨识特征 |
| --- | --- | --- | --- |
| 回声孵囊 `echo_brood_capsule` | square4，2×2 | 48×48 | 闭合矿质壳、环状青光呼吸孔、内部晶粒 |
| 吸舱幼体 `hull_clinger` | ell3，左上/左下/右下 | 48×48 | 六个短桨肢、圆形腹盘、反光鳞、弯曲身体 |

每格24原生像素，沿用v0.4共享37色和左上光源。形体由原始生成候选整理至原生网格。幼体沿身体弯折重排网格，矿壳边缘的逐像素补色记录在 `processing/`。每个占格至少70%实物覆盖，外缘及凹边保留1px透明，所有空格RGBA0，四向旋转均有校验。

主代理初审保留孵囊，幼体完成一次针对六肢和吸盘的原生精修。`native-refinement.json` 保存391处像素替换及原值，`hull-clinger-refinement.png` 展示前后实际原生画面。三对短桨肢使用深内轮廓、浅鳞面和珊瑚端部，腹盘使用连续圆唇和凹面。该次精修的alpha轮廓逐像素一致。

`raw/` 保留两次独立内置 `image_gen` 的原始图。`prompts/requests.json` 保留完整提示词、参考角色和缓存来源。`native1x/` 保存正式原生PNG，`editable/` 保存材质分层ORA。运行导出写入 `prototypes/salvage-route-demo/assets/v05/`，使用2x/4x最近邻整数放大。

```bash
python3 design/star-salvage/v05/production/bio/render_bio.py
```

脚本重建原生图、分层工程、导出、加工记录、SHA清单、mask验证和接触总览。`manifest.json` 的审核状态绑定原生SHA。工程验证与主代理内部视觉审查已通过，`rootInternalReviewed` 为true。实际运行映射、用户视觉及真实手机仍待确认。

完整48×48原生图缩到24×24缩略图时，六肢数量和小晶粒细节会减少，主要保留外形、青环和腹盘。`bio-scale-review.png` 提供实际24px采样对照。货舱完整展示使用48×48原生源或整数放大，手机可读性由实际运行验收。

本轮为静态货物素材，像素鳞面和发光孔已经画入当前图。运行时呼吸、肢体活动与交互演出由整合阶段决定。
