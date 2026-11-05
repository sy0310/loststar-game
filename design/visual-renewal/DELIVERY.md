# V0.4.0 首星整体翻新交付

> 用户实际试玩439256后要求返修收据造型、展示互动入口和控件像素密度。本文保留该包的真实历史证据，不是用户美术认可；最新执行范围见 [USER_REVIEW_V040.md](USER_REVIEW_V040.md)。

运行源码 **f1397e268b4dec43a241833da077b08104451c8e**；开发自测 **439256 / v0.4.0**。继续 [Draft PR #2](https://github.com/sy0310/loststar-game/pull/2)，不合并、不提审、不正式发布。保留`loststar.fusion.firstplanet.v037`，只翻新首星的美术与交互，没有第二星完整远征、新货币或新战斗系统。

[设计／旧版／新版实际画面、全部录像和多尺寸矩阵](../../artifacts/visual-renewal/index.html) · [六物18态](../../artifacts/visual-renewal/materials-overview.html) · [逐项覆盖表](VISUAL_COVERAGE.md) · [验证原值](../../artifacts/visual-renewal/verification.json)

本机固定玩家包：`http://127.0.0.1:4227/loststar-fusion/`。画廊是只读证据页；夹具浏览器不打开或清除个人存档。媒体基于冻结运行源码，采集脚本后来补了HUD就绪等待与真实分类点击，不改运行包。测试通过与内部复审都不等于用户美术验收。

## 原始设计PNG交接

真实ZIP：`/Users/shuhuayu/Downloads/loststar_visual_renewal_pack.zip`。按指定导入器读取实际路径后，再不带source校验3/3。导入提交 **48efa5212385273bf4a4f618c9ed88702f1303f1**；远端原字节回读证明 **c271cd1572614ac3b425a9263b2c4cee9c7c05d2**。三张均1448×1086，没有重采样、LFS指针或Base64代替。

| Repo原图路径 | 字节数 | SHA256 |
|---|---:|---|
| [approved/01_pixel_art_production_baseline.png](approved/01_pixel_art_production_baseline.png) | 2625343 | `333b3cc34c5fca72f53c5ced6885c0420b919dadaee50c0747abcd011b27e0a0` |
| [approved/02_first_planet_exploration.png](approved/02_first_planet_exploration.png) | 2469519 | `8fd0bac5562e6888b39c8e6edd18834406207a6a25dcc85d7006f46866326bca` |
| [approved/03_curio_restoration_and_collection.png](approved/03_curio_restoration_and_collection.png) | 2521156 | `8c794b51d80c43e5a0552c03ea578ba2c944fb7cc693de0bb7b6f14a14754bee` |

原板仅作参考。正式独立源在`assets/source/visual-renewal/`，运行图在`assets/runtime/visual-renewal/`；[美术规格](ART_SPEC.md)、[分层注册及哈希](ASSET_REGISTRY.json)、[世界接触点](WORLD_PRODUCTION.md)保留。原V01的README/离线浏览页及20份PNG/MP4未删除。

## 完成范围与动作

探索、完整球体和纸箱地貌、收件站、唯一分拣机、安保灯架、机器人/飞船、区域星雾、同屏昼夜、观察/巡逻、独立整理台、六物全三态、收藏室/六柜/铭牌、基地/图鉴/工坊/科研/安保/维修/星图/归航/设置均使用同一新紫铜美术。新室内背景不烘焙藏品与角色。玻璃前后层、真实脚点、承托与短距离取放共用一套渲染，不再首页/收藏室两套表现。

十八态从同一固定本体和连续机构输出。清理只擦独立材质覆层，不擦本体；修复机构与工具尖端同源，箱盖两端固定后铰链。六件0能力都有各自局部idle，减少动态保留必要工作和显式单次试验。原两个本体研究及真实P03/P30/签收线索继续生效，不给其他四件强塞付费新能力。

| 奇物 | 实际三态与处理 | 免费冷幽默 | 原始录像 |
|---|---|---|---|
| 收据 | 纸污/折角、卷根与缺角→擦去浅旧指印→连续压稳两个纸边；原缺签不变 | 订单没下，退货先到 | [自然处理影片](../../artifacts/visual-renewal/treatment-receipt-natural.mp4) |
| 道歉胶带 | 粘灰纸纤维/乱卷断头→刷去纤维→对轴、压顺胶尾 | 对不起，又粘人了 | [自然处理影片](../../artifacts/visual-renewal/treatment-tape-natural.mp4) |
| 套娃包裹 | 卡缝纸屑/歪盖、箱角错位→清理缝隙→盖铰链与内层导向归位 | 拆到最后，还是第一层 | [自然处理影片](../../artifacts/visual-renewal/treatment-nested-natural.mp4) |
| 昨日邮戳 | 残墨/歪柄卡轴→露出原日期轮→校正柄轴与轴环 | 今天的事，昨天再办 | [自然处理影片](../../artifacts/visual-renewal/treatment-stamp-natural.mp4) |
| 收件人：宇宙 | 浅灰原签/松带翘签→清理表面→张紧封带、固定原签 | 远处回敲了两下 | [自然处理影片](../../artifacts/visual-renewal/treatment-cosmic-parcel-natural.mp4) |
| 无人签收铃 | 铜绿/松固定件、低卡顶杆→清理氧化→紧固与顶杆复位 | 你一转身，它就上班 | [自然处理影片](../../artifacts/visual-renewal/treatment-bell-natural.mp4) |

实付总额依次160、130、190、225、280、155；均为原两次清理/修复价格，录像账本已经调和探索收入和晨修，六次免费试验实付0、不发额外奖励。收据未签收事实未由修纸补造。

## 真实媒体与内部复审

共7份采集报告、82份独立上下文记录、223项图像记录（211页截图、6视频原帧、6原生画布裁片）、54次透明PNG只读导出及11段自然连续视频。正式18态PNG另有不可变副本。所有报告source相同、无JS/HTTP/布局采集错误，连续录像没有改时钟或倍速。

- [36秒三档助力与星雾](../../artifacts/visual-renewal/assist-three-tiers-36s.mp4)：9次有效输入、5400ms实际工作，0/1/2/3档和回落，三次完整拿取/卸货，120→144；三雾从未解到揭晓。星雾复用此实录，不冒充第12段独立录像。
- [70秒跨柜取放](../../artifacts/visual-renewal/museum-two-cabinets-70s.mp4)：轨迹访问六柜，走到位再观察、托起、检查、放回、松手与返回；真实前后玻璃/手部顺序。
- [0→3柜体升级安装](../../artifacts/visual-renewal/case-0-to-3-installation.mp4)：真实160/480/1100付款，灯座铭牌、专属装置、独立典藏舱及1.8秒安装；既有等级不重收费。
- [7.129秒出土](../../artifacts/visual-renewal/receipt-excavation-natural.mp4)：松土、固定纸边翻出、夹持与承托、前岸遮挡，净费用0。
- [312秒同屏完整昼夜](../../artifacts/visual-renewal/complete-daynight-312s.mp4)：自动白天→黄昏→追踪/设施/飞船/收容→清晨修复；可从3分55秒看夜间。真实2位收容、1位抵站、完整度100→94→100，修6点实付18。最后4秒渐亮可见于连续抽帧，不以4秒间隔合页的亮度差误认瞬切。

初候选ed37动态未过而未上传；纸面半透明/双影、外盖贴片和拉伸袖套均经真实彩排退回。返修与内部批判见[迭代记录](REVIEW_ITERATIONS.md)，最终复审[原始登记](../../artifacts/visual-renewal/review-status.json)只表示可交用户审核。

## 工程、旧档和经济

本源码`npm run check`：20/20原设计资源、56文件344单测、五类构建、454浏览器流程通过；本批3/3原图另校验通过。覆盖360×800、390×844、桌面及Chromium/WebKit原生触控仿真。两个源码CI均success：[PR](https://github.com/sy0310/loststar-game/actions/runs/42089750492)、[Push](https://github.com/sy0310/loststar-game/actions/runs/42089731596)。最终证据提交的CI另见PR当前状态。

相对子目录的实际ZIP再做6组新/旧档检查，全部通过。v037当前27049测试余额、全部已购整理/展柜/本体/设备/安保/项目/科研/雾种子/来源备份逐字段保留；刷新与多标签不二次扣款、离线归航不双领，坏源锁写和失败重试保留。新手夹具不覆盖旧玩家。15个业务/账本/时钟/雾持久化模块与51d682c逐字节一致，[模型校验](../../artifacts/visual-renewal/model-invariants.json)。

经济重新运行48个0/5/15/30/60/120分钟时点、12个8/24/72小时离线情形，负余额、报价/账目、重收费、虚构签收、雾重置、旧权益、直接点击发币和双领检查全部0。不是新价格方案；[平衡表及策略](ECONOMY_VALIDATION.md)、[原始JSON](../../artifacts/visual-renewal/economy.json)、[CSV](../../artifacts/visual-renewal/economy.csv)保留。现有有限消费不声称能无限消耗老玩家积蓄。

## 资源和实测性能

ZIP **9430895B**；解压 **9749709B / 169文件**；SHA256 `0cc48e3150bd70a32e2f3f28cbc84b32ed0385865385486e9c188d6d374b5254`。162张实际打包WebP共9179594B；原始参考PNG和独立18态PNG不塞进玩家ZIP。生产注册表同时含PNG/WebP因此其17817909B不是下载包大小。

Apple M2 Pro / macOS arm64，390×844、DPR2，两个引擎每场景热身1.5秒、单页独立采样10秒、无录屏。以下是实际Canvas绘制间隔与CPU调用时间，不是GPU完成时间，也不代表手机60fps。

| 引擎 | 场景 | 样本 | 中位ms | P95 ms | 平均绘制ms |
|---|---|---:|---:|---:|---:|
| chromium | explore | 600 | 16.7 | 17.4 | 3.39 |
| chromium | field | 600 | 16.7 | 17.5 | 3.31 |
| chromium | collection | 601 | 16.7 | 17.1 | 2.64 |
| chromium | receipt | 600 | 16.7 | 16.7 | 1.39 |
| chromium | tape | 601 | 16.7 | 16.8 | 1.16 |
| chromium | bell | 600 | 16.7 | 16.8 | 0.82 |
| webkit | explore | 601 | 17.0 | 17.0 | 1.27 |
| webkit | field | 601 | 17.0 | 17.0 | 1.19 |
| webkit | collection | 601 | 17.0 | 18.0 | 1.02 |
| webkit | receipt | 597 | 17.0 | 18.0 | 0.52 |
| webkit | tape | 461 | 17.0 | 33.0 | 0.41 |
| webkit | bell | 601 | 17.0 | 18.0 | 0.45 |

Chromium JS堆返回粗粒度10000000B读数，可能隐私量化，不能当真实内存峰值；WebKit不提供该读数。所有打包图像宽×高×4合计71788524B仅是RGBA像素容量，不代表同时解码或实际驻留。Canvas、解码器缓冲、GPU复制、总进程内存、手机发热未测。[性能原值](../../artifacts/visual-renewal/performance.json) · [资源清单](../../artifacts/visual-renewal/resource-inventory.json)

## 重复验证与自测

```bash
python3 design/visual-renewal/import_reference_pngs.py
npm run check
npm run package:fusion
python3 scripts/verify_renewal_models.py
# 将该ZIP解压到固定父目录并启动HTTP服务，URL指向loststar-fusion/子目录
python3 scripts/run_visual_renewal_evidence.py --url http://127.0.0.1:4227/loststar-fusion/ --measure
npx vite build --ssr scripts/simulate_visual_renewal.ts --outDir releases/renewal-economy
node releases/renewal-economy/simulate_visual_renewal.js
python3 scripts/build_visual_renewal_gallery.py
```

TapTap仅开发自测，版本ID **439256**，对应运行SHA **f1397e268b4dec43a241833da077b08104451c8e**。回读和主包前后核对见[taptap-self-test.json](../../artifacts/visual-renewal/taptap-self-test.json)；扫码PNG通过本机交付，不把私人测试入口写进公开Repo。

## 尚未完成与下一步

- 本机无可调试物理手机。新包手机触控、TapTap WebView、锁屏、系统减少动态、弱网、低端GPU及长期发热未测；桌面隐藏恢复不叫手机锁屏通过。
- 用户最终美术/手感审核待扫码。细缝星光和顶杆小动作的手机辨识、高档助力绕到仓库背后时的反馈强度，均留实际观感判断。
- 大包裹检查时会短暂遮住咔哒眼面，未来可微调侧托姿势。无音轨录像不能验证音效。

本轮任务范围的实现、素材和浏览器证据齐备；不自动宣称首星视觉定稿或整个游戏完成，不进入第二星球量产。
