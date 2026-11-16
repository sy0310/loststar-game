# 桌面短测范围

固定新源码 `35b3e467d41000c76b64cb95ba9a70bb83533dcc`，对照旧72374bc独立ZIP。两引擎、四页面、各旧/新10秒，共16个串行窗口。普通模型等价开场，时间戳分别生成，非同档同毫秒；不测真机发热/电耗/GPU。

|引擎/页面|旧RAF P95 ms|新RAF P95 ms|
|---|---:|---:|
|chromium/day|16.8|16.7|
|chromium/night|16.7|16.7|
|chromium/collection|16.8|16.7|
|chromium/detail|16.8|16.8|
|webkit/day|17.0|17.0|
|webkit/night|17.0|17.0|
|webkit/collection|18.0|18.0|
|webkit/detail|18.0|18.0|

RAF只是调度间隔，不等同每帧重画或手机60fps。实际收藏室画布interval P95：Chromium旧17.6/新17.7ms，WebKit旧18/新18ms；无>100ms的窗口内RAF间隔。

已知：轻整理面板打开时，背后收藏室仍按原组件绘制；`ui.museum.active`实际为true。静态整图不需要持续修复重画，但本轮不承诺功耗下降。正式融合需把新组件与原UI活跃调度统一，不能长期保持并行入口。非活动远征画布的启动样本不拿来冒称详情性能。

[完整原始窗口/绘制指标](performance.json)
