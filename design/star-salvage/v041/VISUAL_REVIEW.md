# 0.4.1 内部对照复核（不是用户／手机验收）

基准仍为v04已确认完整PNG，SHA256 `16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0`。旧14项原生资源没有重画；新增素材与其37色、上左光源、24原生像素每格及整数nearest保持一致。生图候选、几何归整和可编辑源各自留存，不声称原候选天然就满足严密占格。

先独立制作并审核新增图标、矩形和L／T三组素材，再集成。静态审查记录保留在`production/ui-internal-review/`，其输入标注未冻结。最终进一步对照用户反馈原文和固定包754113a实际截图／连续片段，不能用早先静态审查替代本包检查。

| 对照 | 看到了什么 | 内部结论 |
|---|---|---|
| [旧飞船页](../../../artifacts/salvage-ship-v041/developer/comparison/before-fleet.png) / [新飞船页](../../../artifacts/salvage-ship-v041/developer/comparison/after-fleet.png) | 百分比术语移至实际例子；三升级首屏，价格与当前／最终容量直接可见；移除重复现役卡 | 通过本轮可读性方向，仍需用户看懂程度复测 |
| [旧货舱](../../../artifacts/salvage-ship-v041/developer/comparison/before-cargo.png) / [新货舱](../../../artifacts/salvage-ship-v041/developer/comparison/after-cargo.png) | 同3件UID、10格、同位置，旧小图标／色框改为连续实体。L空位确实可用，旋转整件同步，三格是一件 | 工程轮廓与视觉体量对应；没有新增箱子数量 |
| [HOME](../../../artifacts/salvage-ship-v041/developer/capture/home-390.png) | 新商店是立体供给亭，任务为立体终端；色彩、颗粒与货舱／飞船相邻一致，港口和主船维持原构图 | 保留方向，不加装饰或额外系统 |
| [事件正文](../../../artifacts/salvage-ship-v041/developer/capture/natural-open-event-record.png) | 标题、完整短正文及实际选择同屏；不需再展开现场记录，返航预算仍在底部 | 本轮默认展开实现清晰 |
| [实际Mac升级页](../../../artifacts/salvage-ship-v041/delivery/mac-fleet.jpg) | 原档454余额，三入口可见，0.4.1版本已由UI核对；未为截图替用户买升级 | 实际存档与页面一致 |

连续录像复核：工程QA片段10秒处可见L整体已转90°、空格留空，与周边两件物体不重叠；随后确认保存、购入探测船、来回换装、刷新，原船资源保留。自然首趟正文直接呈现，未将QA跳转伪装为自然游玩。原WebM与MP4并存，无剪辑、无速度调整。

包体129848→195637字节，增加65789；运行PNG58348→118176字节。单次本机冷导航样本：Chromium load36.5→25.2ms，WebKit40→41ms。仅两次不同环境下的原始样本，**不能据此宣称性能提升或真机流畅**。详见`artifacts/salvage-ship-v041/developer/performance-comparison.json`；未真测手机FPS、锁屏或发热。

已完成本轮工程和内部素材／运行图复核。尚未完成用户对15项新增美术、真实手机触控与趣味签收；这些是明确待审，不是省略实现项。旧大件封装有较大连续面，若实机认为机械辨识度不够，可在保持轮廓与价值的前提下再精修，不能恢复格内重复箱子。
