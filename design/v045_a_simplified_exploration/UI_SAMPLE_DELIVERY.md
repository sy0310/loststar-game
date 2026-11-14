# UI参考适配：三屏可运行样板，待视觉确认

本轮执行11d0045任务书与2026-11-07最新Review，延续A方案。按任务书第108行，先交三屏和30–45秒自然演示，用户确认后才接正式玩家入口。本次不是再生成概念图，也不是宣称产品已最终完成。

## 看这三屏与一段流程

[一个审核页](../../artifacts/ref-ui-sample/index.html)包含390×844同一快照的原UI/候选对照，也有360、WebKit与桌面。仅调整信息层级和控件材质，星球、居民、房间和六物18完整图继续使用。

- [首页](../../artifacts/ref-ui-sample/screens/chromium-390-candidate-home-fresh.png)：一行调查、一个事件摘要、紧凑助力和轻量设置；保留完整球体与三导航。
- [事件短卡](../../artifacts/ref-ui-sample/screens/chromium-390-candidate-event-night.png)：标记与摘要同一真实事件，一次点开/一次关闭，世界不缩小，不再嵌套手记近景。
- [物品详情](../../artifacts/ref-ui-sample/screens/chromium-390-candidate-curio-owned.png)：浅信息层、明确状态/原价主操作，原整图和代表互动保留。
- [43.00秒主流程](../../artifacts/ref-ui-sample/videos/fresh-discovery-to-cleaning.mp4)：事件开合→助力→真实发现→取出→清理B态→收藏→返回。新档120零件，未为录制补造120升级费。
- [24秒夜访/清晨](../../artifacts/ref-ui-sample/videos/daily-visit-and-morning.mp4)：普通模型预走583秒后自然运行，重复访客标日常，晨间显示对应夜实际照料费。
- [21秒完整整理](../../artifacts/ref-ui-sample/videos/original-price-complete-states.mp4)：普通规则赚得零件的隔离快照，原价40/120、真实提交换整图、一个不收费互动。

三片均原生1倍、无音轨；自然模型预走只用于抵达测试场景，开包后没有加速时间。12对对照的完整初始JSON SHA相同，随后各自自然运行，截图相位/时间不相同；不把动作差异假称为美术修改。31直接页面、11原片PTS抽帧分别登记。播放器三片实际1倍播至结束，不能据此称已完成物理手机或可听音效测试。

## 本轮Review的产品核验

普通模型实际到达纸路cleared及三个既有研究，只能证明纸路连通。候选明确“纸路接通了，夜班原因仍待查”，引用真实留存的传送方向事实，并给出继续探索/留意来访的下一期待；没有新建调查、付费研究或签收事实。未识别访客不露名，演员消失后不留下假现场标记；旧访客不按夜数包装为新秘密。晨间测试对应第1夜实付18零件，反复读卡不再次扣款。

## 源码、隔离与验证

固定样板源码 **72374bc2445008bf0a09e346e7f994c61f687d66**，版本 `0.4.5-ui-sample.3`，ZIP **12,005,489B / 190文件**，SHA256 **87c99d800beeed62b4b8cf3adb0de43f03df18a63dfd8e6f8960eb7f627340dc**。

`prototypes/ref-ui`独立入口复用原mountFusion、Canvas和reducers，正式src、assets/runtime、assets/source三树相对06cb11f原字节未改。样板的存档、费用和文字大小操作仅在内存；31页面/三影片及触控检查探针IDB打开0次、localStorage不变。刷新样板重建审核场景，不冒称保存成功，也不会读取/迁移/重开正式v037档。原正式444057/06cb11f ZIP保持原SHA 2aee2e4531d42873dca4e6a7706ead759e5bc71c7aac9b89d0ff676f676814f2。

- 本机冻结源码：65文件416单测，覆盖率97.05%语句/95.81%分支/99.43%行；40样板端到端，0失败/跳过/flaky/重试。
- 覆盖Chromium360×800、390×844、桌面1440×1000和WebKit390×844；包含事件一次开合、长按/拖动误触隔离、真实助力限流/工作量守恒、原价整理/免费互动、返回/Esc、处理中退出后继续且只付一次、三态预览逐层Back、旧纸路展开/滚动恢复、原价6000归档购买及已购回看/退出、夜班记录同卡、低屏/大字/减少动态/后台恢复。
- [固定包明细](../../artifacts/ref-ui-sample/evidence.json)、[验证摘要](../../artifacts/ref-ui-sample/verification.json)、[40项原始结果](../../artifacts/ref-ui-sample/checks/browser-results.json)、[416单测原始日志](../../artifacts/ref-ui-sample/checks/unit-coverage.log)。全部读图来自固定ZIP解包运行，源码和媒体哈希单独登记。
- 原游戏源码Push CI实际416/五构建/578/6通过；源码PR attempt1有一例冻结时钟首帧断言失败（577/1），保留原失败，已补测试时钟推进。[诊断与未放宽的断言](../../artifacts/ref-ui-sample/CI_FOLLOWUP.md)。仅测试改动，当前完整CI终态见PR Checks；不借旧成绩替代或重打包洗版本。

## 开发自测与交付边界

TapTap开发自测 **448028 / 0.4.5-ui-sample.3 / 72374bc**，12,005,489B与文件名/竖屏已平台回读，未绑定/提审/发布，主包模块前后相同。[脱敏上传回执](../../artifacts/ref-ui-sample/taptap-receipt.json)。447918为已替代的内部旧样板，不用于本次审核；请使用448028新码。平台不返回ZIP checksum，不称已校验远端压缩字节哈希。

隔离包比06正式基线大8,909B，包含审核夹具与对照样式；这只是包体差异，不是FPS或手机内存结论。[独立内部图审](../../artifacts/ref-ui-sample/independent-review.md)重新查看31张页面/11张原片帧并核媒体SHA，意见可交样板，不代用户签收。

## 当前未完成

REFUI-01～07的可运行样板已交，**正式集成仍IN_PROGRESS**；原174项证据继续绑定06正式基线，181项权威表保留原出处。按任务书108行等待三屏视觉确认后再集成，不能把这7项预标正式IMPLEMENTED。

用户视觉和真实TapTap手机的刘海/底部宿主、触控手感、锁屏、系统减少动态、真实声音、弱网/低端GPU/长时温度均未验收；本轮未新增独占性能基准，不把并行测试/录像的节拍当手机FPS，也不继承06桌面P95为新UI成绩。样板内可以切换新档、已购、首次/日常夜访、晨间和真实结论，仅为内存审核场景。

仍只做退货箱星，不合并、不提审、不正式发布。
