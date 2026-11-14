# 港口两层生产素材（用户最终美术待审）

素材由内置 image_gen 分别生成，原始生成结果在 raw/。不是从认可概念板截取、去掉文字或抠图。

- 背景：以完整认可板作风格/构图参考，独立生成无船/无UI背景。原始生成候选约971×1619；实际尺寸以PNG为准。
- 前景：以本轮新背景作透视/调色参考，单独生成真实透明的底部护栏、导灯和小货箱。原始候选有细碎低alpha噪点，清理时已删除。
- `normalize_harbor.py`：原始生成候选经BOX采样归一到192×320的可编辑1x源、共享palette无抖动量化；背景校正5个导灯高光点；前景阈值清理为二值alpha、上方280行/CTA中央留空，右护栏平移8逻辑像素避免灯头被安全区截断。没有从概念板读取任意运行像素。
- 所有2x/4x都从最终1x源以NEAREST整数放大；不是各自再次生图。1x图与ORA的mergedimage相同。
- 运行PNG在`prototypes/salvage-route-demo/assets/v04/`；source/保存1x PNG和可编辑ORA；ORA是独立像素层的可编辑工程，不假称原始生成器提供了建筑分层。

逻辑坐标：独立96×48船建议位于x22/y222（基线270）；前景全部在y293之后，船脚及x40–152主CTA安全区透明。港口2x为384×640，360宽可居中裁左右12CSSpx，390宽可留少量边缘背景。渲染器应等比裁切而非拉伸船/建筑。

背景与前景没有烘焙交互文字、按钮、数字；墙上的环状符号仅为站体装饰。真实HUD/四悬浮入口/出发由HTML负责。parent已对背景给出内部方向通过，不代表用户或真机签收。

生产资源复核：
```sh
python3 design/star-salvage/v04/production/harbor/normalize_harbor.py
node design/star-salvage/v04/production/harbor/verify-harbor-browser.cjs
python3 design/star-salvage/v04/production/harbor/write_manifest.py
```

实际两浏览器独立HTTP读图12项（两个图层×1x/2x/4x×Chromium/WebKit）已通过，并用PNG SHA绑定结果；这是资源解码检查，不代表游戏界面或真实手机验收。
