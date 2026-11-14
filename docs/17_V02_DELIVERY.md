# V0.2 首星收藏、星图、夜守与成长交付

后续复审已完成V0.2.1同源夜守修订，最新自测为424300 / e9c5ce6，见 [当前复审交付](18_PR2_NIGHT_MODEL_REVIEW.md)。本页保留0.2.0基线实录与数据。

基于 [PR #2 V0.2 Review](https://github.com/sy0310/loststar-game/pull/2#pullrequestreview-5747236403)。工作分支 `codex/v0.1-vertical-slice`，维持 Draft；未合并、未正式发布，也未量产后续星球。

运行源码/录像/自测包：`eee74ae685d683be79aad2630a519827f5983f39`，版本0.2.0。随后提交的文档与媒体不改变此包的游戏源码。TapTap 开发自测 **424044**，H5 package150915，包体 **2,636,121字节**，SHA256 `1e9bbaec66b58591fe8423cbed51bfae3d18691803f2ae482ff14196660e0d59`。后台列表已复核，未绑定主包、未提审、未发布。自测二维码保留在本机 `releases/taptap/self-test-424044-v02.png`，不放入公开仓库。

## 1. 失物收藏室

先制作独立实际渲染预览并提供截图/动画，再接入正式基地。初稿发现前排高舱遮挡后排铭牌，随后重制前排台座位置，拉开两排空间；全部原始生成源和提示词保留。

六件奇物分别使用高玻璃罩、螺口罐、六角生态柜、圆柱真空舱、封存舱和黄铜钟罩。每个容器按后壁/内部阴影/独立奇物/前玻璃与反光/独立铭牌顺序绘制。没有把含奇物的整张背景晃动冒充生命感。铭牌用短名保持390px可读，完整名称通过可访问按钮与放大详情提供。

| 奇物 | 免费循环动作 |
|---|---|
| 未购买的退货收据 | 纸卷轻摆，极小票据颗粒 |
| 自动道歉的胶带 | 卷身轻转，松开的胶带尾轻摇 |
| 无限套娃包裹 | 内箱升起、微型套层循环 |
| 只会盖昨天的邮戳 | 轻轻起落，旧印记浮现 |
| 收件人：宇宙 | 包裹微摆，细环绕过小星尘 |
| 无人签收铃 | 钟身轻摆，低频椭圆声纹 |

三位居民各有独立生态观察区：拆封鼠的废旧分拣台、箱寄居蟹的纸层小屋、标签鸟的邮签枝。背景与角色分离，角色分别散步、慢移、栖息轻动；有玻璃前反光与独立说明。未知居民保持空环境，不显示未取得的角色。

基础容器、生态观察、全部待机循环、放大与试验免费。高级展柜升级提供柔光底座、星尘内景、彩色轮廓与珍藏铭牌；居民升级增加暖灯与纸植。点击六个实际容器或居民可打开已有固定底部试验台，所有互动不重复发奖励。基地原认可画面继续保留，缩略展品也改成玻璃前后层。

源码：`src/render/museum.ts`、`src/museum.css`、`src/main.ts`。源素材见 `assets/src/generated/*v02.png`；正式纹理为 `assets/runtime/case-*.webp`、`museum-room-v02.webp`、`habitat-*-v02.webp`。`exhibition-lab.html` 为无正式存档写入的独立美术预览，不放入TapTap包。

证据：[新收藏室](../artifacts/v02/museum-390.png)、[鼠](../artifacts/v02/habitat-mouse-390.png)、[蟹](../artifacts/v02/habitat-hermit-390.png)、[鸟](../artifacts/v02/habitat-tagbird-390.png)、[放大试验](../artifacts/v02/museum-experiment-390.png)、[21秒真实互动](../artifacts/v02/museum-live.mp4)、[旧左/新右8秒实际动画对照](../artifacts/v02/museum-before-after-8s.mp4)。旧版实录来自0.1.1/b4c0d20，完整藏品为测试快照；未虚构旧版动画。

## 2. 星图与真实未知扫描

接收器自动经历90秒采样：45秒前搜索，45–72秒异常，72–90秒定位核对。若没有具备真实场景及完整小生态的候选模块，只显示“回波太弱，尚不能确认坐标”，12秒后继续自动采样。不会先预选星球身份、画固定问号、填数量或展示未发现轮廓。

`StarChart.records` 独立永久保存成功发现的ID、坐标、区域和时间；坐标只在成功定位回调内生成。没有六节点上限。已发现旧航路迁移后仍保留；尚未完成的历史航路只可查看记录，远征禁用，不借用首星图像伪造外形。跨标签恢复后星图与图鉴即时同步。

`readyPlanet` 要求模块明确可玩、区域非空、所有区域有已登记的场景主题实现、奇物/生物/事件内容齐备，才允许成为真实定位目标。独立合成测试模块验证了成功定位前无身份、成功后永久入图。生产内容仍只有退件平原达到此门槛，第二颗没有虚假远征入口。本轮没有制作第二星球换色场景。

源码：`src/game/star-chart.ts`、`src/game/radar.ts`、`src/render/star-map.ts`；现有 `Planet/Region` 模块结构保留。后续扩展需提交独立场景、美术和完整生态后登记主题适配器，不是向描述数组添加一个名字就开放。

证据：[星图](../artifacts/v02/star-map-390.png)、[异常](../artifacts/v02/star-anomaly-390.png)、[核对](../artifacts/v02/star-locating-390.png)、[弱回波](../artifacts/v02/star-unconfirmed-390.png)、[自动重试](../artifacts/v02/star-retry-390.png)、[106秒真实连续采样](../artifacts/v02/stellar-listening-live-106s.mp4)。

## 3. 可进出夜间守护

基地进入“夜间守护试玩”，随时返回收件站，正式日常循环保持默认关闭。两个已发现奇物槽，道歉胶带实际减速、签收铃实际短暂停顿；空槽也有机器人与飞船基础照看。一种异常退件影子、一个夜间事件、每夜三位依次来访，不做复杂塔防。

标准白天4分钟/夜晚1分钟，黄昏渐暗、站灯亮起、飞船巡灯、机器人递封条，天亮自动写值班簿。正式工坊装置等级只读带入实验；当夜固定配置和强度，下一夜应用调整。离线最多12小时自动结算，重复恢复不重记，不损失收藏。另有明确标记的示例收藏与短演示节奏，均不发正式零件或收藏。

详细方案比较、数值与隔离规则见 [夜守设计及实现](15_NIGHT_GUARD_PROTOTYPE.md)。源码为 `src/prototype/*` 与 `src/render/guard-scene.ts`，正式包内 `night-lab.html` 与 `index.html` 共用相对资源，支持往返。实验存储键独立于正式存档。

证据：[白天](../artifacts/v02/guard-day-390.png)、[黄昏](../artifacts/v02/guard-dusk-390.png)、[夜晚](../artifacts/v02/guard-night-390.png)、[晨间](../artifacts/v02/guard-dawn-390.png)、[完整80秒连续录像](../artifacts/v02/night-watch-live-80s.mp4)。录像起点使用白天结束前14秒的独立测试快照，随后按标准速度真实经历完整夜晚；录像中没有时钟快进。

## 4. 零件成长与经济

先运行接入前候选模拟，再写入实际购买模型，并用正式 `buyGrowth` 重跑。同一组0/5/15/30/60/120分钟、三种成长策略与旧余额场景的细表见 [经济平衡](16_V02_ECONOMY.md)、[候选原始数据](../artifacts/v02/economy-candidate.json)、[正式模型结果](../artifacts/v02/economy-final.json)。两版主动收入/消费一致；研究增加采样和离线承载，不叠加主动收益倍率。

原设备成本保持不变，积极升级约20.5分钟满级。新增19条成长路径、46次有限购买，总价36710零件；基础陈列完全免费。展柜、生态、灯光、泊位、守护装置、深空接收、飞船勘探和4项装饰均有实际视觉或玩法效果。余额、旧等级、图鉴、归航货物全部保留。高余额老玩家可以较快完成，未靠清零、维护费或无限涨价延长进度。

正式购买核对预期等级，过期操作不重复扣款；写入失败不重新执行消费。源码 `src/game/growth.ts`。证据：[展柜工坊](../artifacts/v02/workshop-cases-390.png)、[购买反馈](../artifacts/v02/workshop-purchased-390.png)、[升级后展柜](../artifacts/v02/museum-upgraded-390.png)、[真实购买录屏](../artifacts/v02/workshop-upgrade-live.mp4)。

## 验证、资源与性能

- `npm run check`：原始设计资源20/20、41项单元测试、76项浏览器流程全部通过。覆盖360×800、390×844、1440×1000 Chromium及WebKit、两组移动触控仿真。包括未知信息、持续雷达、六展品触控、存档迁移、跨标签同步、离线防重复、真实升级与守护隔离。
- `src/game/**` 与夜守纯模型的行/函数覆盖100%，语句97.91%、分支96.83%；这是选定逻辑模块覆盖率，不代表所有Canvas/UI都有100%覆盖。
- `eee74ae` 的 [PR CI 41581512675](https://github.com/sy0310/loststar-game/actions/runs/41581512675) 与 [push CI 41581505200](https://github.com/sy0310/loststar-game/actions/runs/41581505200) 均成功。此前Linux WebKit的220ms短演出截图偶发错过播放窗口，已改为受控时间点取帧；真实墙钟连续动画另由录屏独立验证。
- TapTap实际归档50文件，2,636,121字节，全部解压后2,730,379字节，含两份HTML。42张WebP；纹理RGBA8理论合计23,208,192字节（22.13MiB），不是实测GPU占用。
- 连续录像和性能测量分别进行，性能窗口未使用测试时钟。收藏室按约20Hz绘制：6秒窗口112–115次绘制。浏览器rAF中位/P95：Chromium390为16.7/16.7ms，360为16.7/16.8ms，桌面为16.7/16.7ms；WebKit390为17/18ms。rAF调度不等于Canvas绘制耗时或手机帧率。
- 录制与性能探针页面异常0；包内子目录“基地→收藏室→基地→夜守→基地”在Chromium/WebKit验证无404或页面异常。原始 [recordings.json](../artifacts/v02/recordings.json)、[package-browser-check.json](../artifacts/v02/package-browser-check.json)、[测试摘要](../artifacts/v02/validation.json) 可查。

所有本轮390×844截图和视频来自桌面浏览器移动触控仿真，**不是手机实拍/真机性能认证**。P0版本423778的三项修复已获用户手机反馈“三项目前都正常”；不能把这个结论扩展为V0.2四模块真机通过。新版424044交付用户扫码复审，尚缺手机型号/系统/WebView性能、长时间发热和真实弱网证据。

## 已知限制与下一轮

1. V0.2视觉完成度、夜间手机亮度与两槽趣味性仍待用户实机审核，不自行宣称主观验收通过。
2. 夜守是可关闭实验，收益只在实验日志；是否加入日常循环、正式奖励与长期参数需审核后决定。
3. 第二星球尚无完整独立运行场景，因此不开放；本轮完成的是星图机制、持久记录和内容门槛。
4. 展品循环采用分层程序动画，不是手绘逐帧骨骼；没有Aseprite工程，保留原始生成PNG、提示词、导出脚本与正式WebP。
5. 大量已知星球时的地图平移/聚合交互仍属后续体验优化，数据结构无固定六节点限制。高余额玩家买完有限项目后不设置强制继续消费。

## 复现

```bash
npm ci
npm run check
npm run simulate:economy
npm run assets:export:v02
npm run build
npm run preview -- --port 4173
# 另一终端，需 ffmpeg / ffprobe
node scripts/capture_v02.mjs --rehearse
node scripts/capture_v02.mjs
npm run package:taptap
```

本轮统一审核页：[artifacts/v02/index.html](../artifacts/v02/index.html)。普通开发服务器可直接打开 `/artifacts/v02/index.html`；截图、录像和原始测试数据不进入H5游戏发行包。
