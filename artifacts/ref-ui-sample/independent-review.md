# UI隔离样板 sample.3 独立最终复核

复核日期：2026-11-07。

**内部意见：可将当前隔离样板交给用户确认。** 本次限定范围未发现仍需在交样板前修复的明确阻塞；不是用户美术签收，不是正式集成、正式发布或真机通过。任务书要求先三屏样板和自然演示、视觉确认后再整合，此顺序仍然有效。

## 来源与实际范围

- 源码：`72374bc2445008bf0a09e346e7f994c61f687d66`。
- 版本：`0.4.5-ui-sample.3`。
- 固定包：`releases/taptap/loststar-ui-review-72374bc.zip`，12,005,489字节。
- 固定包SHA256：`87c99d800beeed62b4b8cf3adb0de43f03df18a63dfd8e6f8960eb7f627340dc`，本次实际重算匹配。
- 当前证据：`artifacts/ref-ui-sample/evidence.json`，complete=true、errors=[]。31截图、11抽帧、3视频均逐个实际重算SHA256，与各自索引一致。
- 本次用view_image重新逐张打开**当前72374bc的31张screens、11张原片PTS帧，共42图**。不是沿用057d49e或206d74a媒体的亲看声明。完整路径与图哈希在末尾列出。
- 读取了任务书、Review原文、隔离入口/纯投影/内存controller、候选适配器与旧UI相关路由，并核对最终修复差异。对生产基线06cb11f的src、assets、package.json/package-lock、index.html和正式vite.config差异列表为空；本次候选未整合进生产入口和存档。
- 没有启动浏览器、ffmpeg、测试或构建，没有修改代码、媒体、权威registry或HEAD。只写本ignored报告。

## 实际画面判断

### 首页、事件与物品详情

390首页的顶部安静星空仍在，星球名/区域/零件与小设置是一条轻信息栏；长问题收为一行目标。完整球体保持主要视觉面积，机器人、飞船和居民仍在原场景内。事件标记与单条底部摘要同文，紧凑助力和三主导航可辨，未出现新货币、两排系统入口或第二颗星球。与基线相比，目标区和事件条的装饰竞争减弱，原世界和藏品艺术保留。

390夜间基线打开手记后球体明显缩小；候选新短卡覆盖下部但保持同一完整球体尺寸，机器人与来源地点仍能定位。纸影主体、标题、两段短说明和关闭区在实际图中清楚，没有在这条路径堆叠“查看→线索→靠近看看”。卡片遮住部分球体属于展开详情时的临时遮盖，不能误称整球被缩成小图。

收据C态整幅玻璃柜保持完整；主互动“读出票面”和次级“放回收藏室”区分明确。短句“它记住了。你可以忘一会儿。”在390/360/WebKit当前图中均可读，没有原先的屏底裁切问题。A/B/C缩略导航清楚，来历折叠。新原片3s/8s帧分别看到A/B整幅原件的真实工作状态，没有以污层或拼片伪装下一态。此组没有逐件实际操作其余五物，不把收据样例扩大为六物全部重新验收。

### 结论、重复夜访与清晨

当前结论图明确“箱子能沿纸路回到收件站。夜班原因仍待查。”；已有事实是`study/belt-direction`的真实传送方向记录，接下来是继续自动探索、留意灯下。实际证据状态为cleared，且三项study事实全部存在。不能将它解释为已经证明“为什么夜班自己开工”，也未编造新签收事实或新收费调查。

第二夜画面明确“日常来访”“熟悉的访客又来了”，当前卡没有把同内容包装成新秘密。晨间图同屏展示第1夜、3位访客及“收件站照料实付18零件”，对应state.station.lastNight.number=1、spent=18。日常影片16s帧仍为夜末返回，20s帧才显示清晨；未把白天回看、当前清晨和上一夜混为同一时刻。

### 设备与不同尺寸

360、390、WebKit、1440设备图都有“升级设备”、机器人12.0→9.8秒、飞船8→11零件/轮、费用45；数据仍来自原模型报价，候选没有写死新经济数值。浅色内容层、深色正文、主按钮的金色强调相互可辨。

360×800、390×844、WebKit390的首页/事件/收据关键文字与关闭区均可读，未见水平溢出或多余主导航。360的收据短句保留在可见范围，来历仍可继续滚动；WebKit金色焦点轮廓是焦点提示，没有出现新叠印。桌面保持居中竖屏舞台，候选事件卡没有把世界压成原基线缩略图。

这些是桌面渲染画面判断。小纸影在真实手机中的辨识度、晨间维修动作、宿主遮挡和系统手势安全区仍未由这组静帧证明。

## 四组原漏项的收口

| 原问题 | 最终源码与已有回归证据 |
|---|---|
| 夜间按钮/球面/键盘绕回旧手记 | 候选从window capture pointerdown接管普通夜间手势，复用PlanetTapGesture；按钮和Enter/Space进入同短卡；sorting真实付费纸路操作仍分流原处理。新增四上下文断言检查短卡、旧field隐藏、世界尺寸及0助力副作用。 |
| 原drawer/三态preview的浏览器Back | 候选为drawer/preview分层建立history；Back先关preview、再关原详情，关闭调用原fusion-close清理。已有真实断言覆盖处理中Back、只扣一次清理、重开继续、预览Back、设备Back；不以关闭取消已付任务。 |
| 新卡关闭后丢纸路上下文 | 打开新卡前经原field-close同步状态，保存details及主/面板scroll，关闭后经原observe重开恢复；最终焦点使用preventScroll，避免覆盖已恢复位置。已有断言检查展开和面板滚动恢复。 |
| 已购archive/night-shift与回放退出 | 购买仍调用原reduce模型，真实6000仅支付一次；购买/已购进入及night-shift进入同短卡。卡内按钮调用真实上一夜只读回放。实际回放时新marker隐藏，球面/键盘/夜间助力不被候选接管，“回到此刻”走原退出处理。已有四上下文断言覆盖购买→已购→回放→退出、0额外tap和原价一次。 |

另已收紧结论依据：只有精确`study/belt-direction`才显示方向句/引用；未做该研究的cleared阶段只说纸路接通，不再拿任意第一条P03箱标当方向证据。最终源码已确认包含该逻辑。

## 影片与工程证据的边界

当前三段实际影片为43秒、24秒、21秒，1倍、无音轨；来源SHA与11张PTS帧索引已核对。**本独立复核只实际观看所列抽帧，没有连续播放三段完整影片。** 不宣称全片逐帧美术、动作连续性或声音通过。

43秒fresh演示的当前trace有三次有意助力、免费取出、清理实扣40并回到探索；120初始新档没有为演示凭空补到可支付120升级的钱。本片只到B态。另一个普通earned样例真实清理扣40、升级扣120、免费try扣0；3s/8s帧是A/B作业，13s/18s帧回到六柜艺术场景。不能把两条不同夹具拼称同一新档从零到C。

已有检查报告实际记录：65个单元文件、416项单测通过；四上下文40项E2E expected，0 unexpected/skipped/flaky。检查报告含新增路由/Back/滚动/购买原价断言，本次未重跑。各对照页记录IDB open=0、隔离存储未变，支持样板不打开正式DB的实现约束。工程成功不等于用户视觉签收。

## 按任务条款的内部结论

| 条款 | 本次结论 |
|---|---|
| REFUI-01 | 当前三导航/单目标/单摘要/助力/轻设置的样板组织可交用户比较；设置仅本次字号、只读沿用静音，正式设置未集成。 |
| REFUI-02 | 当前尺寸图的深世界+浅信息、完整主体与主次可辨，内部未见交样板阻塞；用户偏好仍待确认。 |
| REFUI-03 | 当前短卡画面可读，原漏路由已在最终源码补齐并有已有回归；不据静帧宣称全片动作体验通过。 |
| REFUI-04 | 本轮收据三态/费用样例、六柜原片帧及原模型复用相符；不是重新逐件验收所有六物互动。 |
| REFUI-05 | 以已有40项回归和原模型trace支持无新增收费/误助力；本次没有新浏览器操作。 |
| REFUI-06 | 两竖屏与WebKit样板可读；有宿主遮挡的物理手机记录仍缺，因此该条不能标整体验收通过。 |
| REFUI-07 | 本次42图实际亲看均属于72374bc/87c99d80；新证据未继承前两源。没有正式集成、用户或手机通过声明。 |

## 仍待用户/设备确认

用户对三屏浅色信息层、标记位置与整段发现体验的视觉选择仍待确认，确认前不整合生产。真实手机的宿主遮挡、纸影/晨修大小、触控、锁屏恢复、声音和较长时间热度未验收。隔离样板刷新会重建内存，不是正式存档持久性测试。上述边界不被内部“可交样板”意见覆盖。

## 本次真正打开的31张截图

以下均在当前`artifacts/ref-ui-sample/`下，源码72374bc、固定包87c99d80；每行哈希已实际核对。

- `screens/chromium-360-baseline-home-fresh.png` — SHA256 `864173c9b09f7aa33523f2855e747500c9b58aea5c4b4e2a449ac440decac934`。
- `screens/chromium-360-candidate-home-fresh.png` — SHA256 `13e1cfcacde03531c183f46c62ab46e38449849eb5dbbcf25878aadd0ed99374`。
- `screens/chromium-360-baseline-event-night.png` — SHA256 `012b8e516f79e54f432bfe5d553d313164af126c114a7d4aab4ae4a7b5a49da2`。
- `screens/chromium-360-candidate-event-night.png` — SHA256 `ee125a1da5dfb0249805862e75373fa4478e719a602c47b37c3d101cc0cad3d9`。
- `screens/chromium-360-baseline-curio-owned.png` — SHA256 `1ecafc93a090c42d0d9e76fd82ec168548ba28c1a1e88c0249187deabef87352`。
- `screens/chromium-360-candidate-curio-owned.png` — SHA256 `1a92e47f71d8a25694253f147fca36b3e76d1cc8f339b679a4760a14868c1056`。
- `screens/chromium-360-equipment.png` — SHA256 `04bdffa5fbe76bbfa18dc5c9f2fc9193b7b7aadf59fc4e4e66f80c376da92874`。
- `screens/chromium-390-baseline-home-fresh.png` — SHA256 `6ed7af8bcca73a9ec2499b5f53993146182630906f32506489ad10f8c0b3afb5`。
- `screens/chromium-390-candidate-home-fresh.png` — SHA256 `77b45e085fe9dc2b235b64308e9ebba37eedea14287fcbb5a7a103e95b447686`。
- `screens/chromium-390-baseline-event-night.png` — SHA256 `6519ff2765239087b3224c70f4518c7e71eeeeb3c022a39cb5b166e77505019f`。
- `screens/chromium-390-candidate-event-night.png` — SHA256 `2b74c7f827ace7d8f117d90cad2e86c8e39dd6e90b313bf18c3d2914478fdb75`。
- `screens/chromium-390-baseline-curio-owned.png` — SHA256 `4877c488ef009b3c16d00fe7f765eb9d41d784800594b16158420f5e6369bf53`。
- `screens/chromium-390-candidate-curio-owned.png` — SHA256 `147d8e1562e32ca2d989a76d8bb6755e4cdb4643008aa9059e1937c06b54d4d7`。
- `screens/chromium-390-equipment.png` — SHA256 `a7132318dfa3d0d74a6bc59327d124624456179c5538aace796282244a5e5e24`。
- `screens/webkit-390-baseline-home-fresh.png` — SHA256 `397670239a82996f1e8c58055333fef097f7454be3c1cd41b90d6920ee84002a`。
- `screens/webkit-390-candidate-home-fresh.png` — SHA256 `f51e9c906e41ade94eeaad46190c35b4cba7597a3df63d121a58ae8ab43bd041`。
- `screens/webkit-390-baseline-event-night.png` — SHA256 `92b5c10e0edbd10fd3d22c29091882c35d8d8fa3541ce58e7a943d4b6acf3032`。
- `screens/webkit-390-candidate-event-night.png` — SHA256 `b5854ccdfdba17cfc591f240af0c1306c36e6df4ba1af84e35e54026b7acc537`。
- `screens/webkit-390-baseline-curio-owned.png` — SHA256 `0cf4755ccef0e9fec58e3fa69a4d1f7236f577a35e8a01693a715cd9592ab961`。
- `screens/webkit-390-candidate-curio-owned.png` — SHA256 `c3f4fdf3d8a52f7d862efd26ca4e3ea8f2f00a6de2a28e4426c6786d8fc73032`。
- `screens/webkit-390-equipment.png` — SHA256 `a520bcd77b300dbd8578fd5eb94a40e8d9c73d4576884e42d13731ae65f0a9dc`。
- `screens/chromium-1440-baseline-home-fresh.png` — SHA256 `d4ba62bc2c9273591f469b53c76cd793b2152593391d4d33e28c01616af12170`。
- `screens/chromium-1440-candidate-home-fresh.png` — SHA256 `f64c8cdaa51dbe163c1d2cb6e066e15b180e23197cc749198a0294921b281b83`。
- `screens/chromium-1440-baseline-event-night.png` — SHA256 `ae7dbf5958e3fce904dba8edd614809b01572449aa54d4fae7f6489abd77b9a2`。
- `screens/chromium-1440-candidate-event-night.png` — SHA256 `c9b727f737671917533c30d94ef887d7ff682e5d3e0be3f5300dedb175530a1d`。
- `screens/chromium-1440-baseline-curio-owned.png` — SHA256 `be45b5ec748a5da767a763ae7be6971771278228704a79faaeb7441a648db410`。
- `screens/chromium-1440-candidate-curio-owned.png` — SHA256 `b2c3ac91383d7f12ed589ed3b7647cb5221fd265064d59d3da5f035e7742dfc1`。
- `screens/chromium-1440-equipment.png` — SHA256 `5e3711e515f38e29b35a27611101eaa3292be67b99500503f5aac1b8c82e447f`。
- `screens/chromium-390-conclusion.png` — SHA256 `c2429eb3178f3df99cfd114510c91d98ce2767d6e5fd1c11a6bb369d0cf2e37d`。
- `screens/chromium-390-repeat-night.png` — SHA256 `b9874cf0e3aa0aeb5db9876055029755dba7d4cc4a4e621edaa1ce7cbb58b865`。
- `screens/chromium-390-morning.png` — SHA256 `2dac3327604e5638dbf5124d408b020323e57ffc08901105bb8452ca063912a1`。

## 本次真正打开的11张原片PTS帧

- `frames/fresh-discovery-to-cleaning-2s.png` — `videos/fresh-discovery-to-cleaning.mp4`，PTS 2s；图SHA256 `020d01914ffd0263de3bc1333327a6d5e2f8f3859838f05f5a80beabcbb23ea2`，原片SHA256 `608bb70f678ee3c04087d32fa9d2f36f9834914c3b09dcc03f1dc4c260c3385b`。
- `frames/fresh-discovery-to-cleaning-15s.png` — `videos/fresh-discovery-to-cleaning.mp4`，PTS 15s；图SHA256 `66460e76e6815b7d931d9735b23a879dff04450b81a544ea0a1511b90a6e81e3`，原片SHA256 `608bb70f678ee3c04087d32fa9d2f36f9834914c3b09dcc03f1dc4c260c3385b`。
- `frames/fresh-discovery-to-cleaning-26s.png` — `videos/fresh-discovery-to-cleaning.mp4`，PTS 26s；图SHA256 `1ee236a5404efa956af80eebe6cb3b4240716d38fe829a1f657f1e6cb3cc604f`，原片SHA256 `608bb70f678ee3c04087d32fa9d2f36f9834914c3b09dcc03f1dc4c260c3385b`。
- `frames/fresh-discovery-to-cleaning-38s.png` — `videos/fresh-discovery-to-cleaning.mp4`，PTS 38s；图SHA256 `c5fb488da37c2e2c9d1654625a8b63d307fed310c3d30e40e4c92c6f9bda4b21`，原片SHA256 `608bb70f678ee3c04087d32fa9d2f36f9834914c3b09dcc03f1dc4c260c3385b`。
- `frames/daily-visit-and-morning-3s.png` — `videos/daily-visit-and-morning.mp4`，PTS 3s；图SHA256 `5aaa8e21af84c3eb5dd837895e9325e4ebf792ef2d5b03674cfca438fc777cea`，原片SHA256 `d8fd01d9b0a61dca159be2a09df682af053692f243f46490805a237969e0051b`。
- `frames/daily-visit-and-morning-16s.png` — `videos/daily-visit-and-morning.mp4`，PTS 16s；图SHA256 `d0d8869427ab6cfff2b37158ee095c8706fe0ae363dbbf748970154852aeb80f`，原片SHA256 `d8fd01d9b0a61dca159be2a09df682af053692f243f46490805a237969e0051b`。
- `frames/daily-visit-and-morning-20s.png` — `videos/daily-visit-and-morning.mp4`，PTS 20s；图SHA256 `7fff53a265cc359c40a84229d97f4565dd0f74124491101380b46c19e9f5e5a3`，原片SHA256 `d8fd01d9b0a61dca159be2a09df682af053692f243f46490805a237969e0051b`。
- `frames/original-price-complete-states-3s.png` — `videos/original-price-complete-states.mp4`，PTS 3s；图SHA256 `82d7c2d25aeacfbb24e8d061ed89450fc2a4d91e3346b2b887db463b52410a26`，原片SHA256 `8b497e515eff004cb73a24179a631f522039eb99a0d46f80e2c0c9324b8d87ee`。
- `frames/original-price-complete-states-8s.png` — `videos/original-price-complete-states.mp4`，PTS 8s；图SHA256 `9297fa75e6f925a8da18a4408e24e299f0ec0c4ae64434557e18504a5c290cd9`，原片SHA256 `8b497e515eff004cb73a24179a631f522039eb99a0d46f80e2c0c9324b8d87ee`。
- `frames/original-price-complete-states-13s.png` — `videos/original-price-complete-states.mp4`，PTS 13s；图SHA256 `c9e050066e8219e8e2fdcadaad00f70c99490bb74c94d666b0d2368900ac578b`，原片SHA256 `8b497e515eff004cb73a24179a631f522039eb99a0d46f80e2c0c9324b8d87ee`。
- `frames/original-price-complete-states-18s.png` — `videos/original-price-complete-states.mp4`，PTS 18s；图SHA256 `423a0f116dd14d0cc1da9eb93e76d1affd27f973e024b0cce972ed534d7ac8ee`，原片SHA256 `8b497e515eff004cb73a24179a631f522039eb99a0d46f80e2c0c9324b8d87ee`。

当前evidence.json SHA256：`f0f6a47708362a6a0cc85f5bd339362a0a350048be7dbdf4c6d14d7e212f3651`。
