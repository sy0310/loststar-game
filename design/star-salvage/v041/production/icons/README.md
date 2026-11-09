# v0.4.1 两枚港口入口像素图标

制作范围仅为商店、任务；未改游戏代码或存档，未访问4283，未提交Git。

- 各自通过内置image_gen独立生成一次。`raw/`保留真实生成PNG，完整提示词为`ui_shop.prompt.txt`与`ui_missions.prompt.txt`。
- 唯一方向为v04认可板及当前金属箱/初始船的色彩、体积和光向；参考图没有被裁片作为素材。
- 原始生成PNG是高分辨率候选，不假称原生24px。`normalize-icons.py`对候选alpha≥96求物件边界，等比BOX归一到最长20逻辑像素，再无抖动量化到37色共享palette、二值alpha清理，居中到24×24；产生可编辑1x源图。完全透明像素RGB归零。
- `source/`保留24×24 PNG与ORA可编辑像素层。2x/4x严格由最终1x按NEAREST整数导出，并非再次生成。
- 两件native bbox均为(2,2)-(22,21)，四周至少2px透明边，视觉占比与已有金属箱接近。无圆底板、文字、背景牌或额外围框；任务的边缘是终端实体外壳厚度。
- 运行图仅位于`prototypes/salvage-route-demo/assets/v041/ui_shop@2x.png`、`ui_shop@4x.png`、`ui_missions@2x.png`、`ui_missions@4x.png`。
- `icons-overview@2x.png`为同尺度的已有crate/新商店/新任务对照，`icons-overview-large.png`仅为最近邻放大审核页，不用于游戏。

主审核已确认总览内部方向通过，保留当前版本，不追加光饰；用户美术和真实手机仍未验收。`browser-decode.json`仅证明独立新上下文的Chromium/WebKit通过实际HTTP解码与透明边检查，不代替集成后的HOME观感或触控验证。

复核顺序：
```sh
python3 design/star-salvage/v041/production/icons/normalize-icons.py
node design/star-salvage/v041/production/icons/verify-icons.cjs
python3 design/star-salvage/v041/production/icons/write-manifest.py
```
