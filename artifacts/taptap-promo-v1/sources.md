# 素材来源与审看清单

## 已有素材审看

目录盘点见 `source-inventory.json`，抽帧审看见 `review/source-*.jpg`。

| 素材 | 版本／类型 | 有效时间戳与画面 | 本片处理 |
| --- | --- | --- | --- |
| `artifacts/survivor-v0610-active-video/late-loadout-active.mp4` | ea26e29／合法后期实操，59.997秒，780×1688，25fps，实际混音 | 4～16秒紫金电链与精英，约18～22秒随机强化，24～40秒持续走位与清场，48～56秒电链再次出现 | 作为节奏、操作和火力参考，本轮重新录制同期纯音效素材 |
| `artifacts/survivor-v0610/natural-opening-silent.mp4` | ea26e29／普通开局，19.2秒，780×1688，25fps | 0～1秒菜单，约2～10秒基础主炮，12～18秒普通战斗和真实损伤 | 本轮补录持续走位的普通新局 |
| `artifacts/survivor-v069/qa-lightning-live-mix.mp4` | 6bff9f1／QA音画验证，17.4秒，390×844，30fps | 0～3秒基础电弧，4～7秒辅助增强，8～12秒进化，13～17秒融合 | 原脚本含无敌和高血量靶标，归为规则／音效验证资料，本片采用常规伤害补录 |
| `artifacts/survivor-v069/qa-ui-silent.mp4` | 6bff9f1／QA界面，15.8秒 | 约2～8秒选卡／刷新，10～14秒配置验证 | 本片改用自然升级卡与合法已抽战利品的实际点击 |
| `artifacts/survivor-v069/natural-collection-silent.mp4` | 6bff9f1／自然输入，335.16秒 | 30～90秒基础经验收集，150～210秒精英，240秒已升2级，270～330秒持续精英战 | 作为自然路线与节奏参考 |
| `artifacts/survivor-v069/natural-avoidance-silent.mp4` | 6bff9f1／自然避险，243.32秒 | 长时普通操作记录 | 盘点登记 |
| `artifacts/survivor-v0610/qa-repair-combat-silent.mp4` | ea26e29／维修规则QA，27.48秒 | 修补提示与规则展示 | 盘点登记 |

`design/star-salvage/v0610/` 包含当前交付、武器平衡、录制与导出脚本，`wechat-promo-v0610/` 和 `v068/store-media/` 保存宣传插画、字体与色彩参照。本片的封面和战斗镜头均取自实际游戏画面。

## 本轮补录

源码为 `4ba48981fa2b63ed6e26ebc5f658a92cc643a9a5`，取自工作开始时分支最新HEAD。与已上线ea26e29比较，平衡、存档和音频源文件相同，控制器差异为既有兼容写法与续玩按钮恢复。原差异保存在 `gameplay-parity.json`。

桌面Chromium，390×844 CSS视口、DPR2，全新隔离上下文，普通玩家HTTP入口。通过原虚拟摇杆持续发送真实指针输入。录制期间配乐总线为0，实际音效总线单独录制。详细状态、输入、受伤和选卡在 `recording-evidence.json`。

| 录制 | 原始长度 | 准备与实际结果 |
| --- | --- | --- |
| natural | 180秒 | 新局初始主炮与默认属性，自然生成敌人，57.138秒首次升级，实际选择电弧线圈，结束116击落、82船体、2级 |
| evolution | 14秒 | 合法5＋5与随机成功战利品检查点，经普通继续入口点击星链雷网，实际击落82、结束约92.88船体 |
| fusion | 22秒 | 已进化的星链雷网和猎手蜂群，合法随机融合卡，经普通入口点击雷暴蜂群，实际击落218、结束约80.28船体 |
| climax | 45秒 | 雷暴蜂群与星环奇点，加基础主炮／旋刃／导弹，合法QA配装与已过时间检查点，自然敌潮和精英，击落549、结束约81.49船体 |

进阶准备使用现有 `SurvivorQA` 的逐级购买、原随机战利品与快照校验。素材录制页验证 `SurvivorQA` 未暴露，随后由原控制器持续运行。准备阶段保留正常船体、速度、伤害和敌人生成规则，初始无敌计时为0。高级卡75%的随机条件通过普通成功检查点准备，录制脚本保留原选择内容。模型条件测试的强制真假分支单独登记在 `mechanics-verification.json`。

本轮七段精选的路径、原录制时间区间、视频与音轨SHA256均在 `selects.json`。原始四段录制及准备快照保存在本机忽略目录 `releases/taptap-promo-v1-private/`。

## 音频与字体

武器、拾取、进化、融合和爆炸声音来自上述同次录制的游戏输出。配乐来自项目原创的 `SurvivorAudio.renderOffline('music', {seconds:60})`，具体和弦、旋律、鼓点及实现均在 `prototypes/salvage-survivor-demo/src/audio-engine.js`。`music-provenance.json` 绑定源文件摘要。

两首用户提供MP3的原清单将商业授权标记为未独立核实。本片采用项目原创主题。视频、封面和字幕制作过程中使用现有代码、真实画面与本机系统黑体简体字面，字体文件保留在系统目录。

## 再录制

在仓库根目录执行，4472仅用于隔离录制。

```bash
python3 artifacts/taptap-promo-v1/prepare_runtime.py
node prototypes/salvage-survivor-demo/serve.cjs --root releases/taptap-promo-v1-private/runtime --port 4472
```

另开终端先进行各场景7秒预演，再按真实时间录制。

```bash
node artifacts/taptap-promo-v1/render_music.cjs
node artifacts/taptap-promo-v1/capture.cjs --scene=natural --rehearse
node artifacts/taptap-promo-v1/capture.cjs --scene=evolution --rehearse
node artifacts/taptap-promo-v1/capture.cjs --scene=fusion --rehearse
node artifacts/taptap-promo-v1/capture.cjs --scene=climax --rehearse
node artifacts/taptap-promo-v1/capture.cjs --scene=natural
node artifacts/taptap-promo-v1/capture.cjs --scene=evolution
node artifacts/taptap-promo-v1/capture.cjs --scene=fusion
node artifacts/taptap-promo-v1/capture.cjs --scene=climax
python3 artifacts/taptap-promo-v1/export_selects.py
sh artifacts/taptap-promo-v1/render.sh
```

普通新局使用其自然随机路线，重新录制后应核对首次选卡内容及画面。`export_selects.py` 自动取第一次真实升级前后的片段，并要求后期至少20秒连续实际战斗。

公开页面 https://www.taptap.cn/app/1022667 已核对名称、可打开App试玩及5＋5／双进化融合说明，结尾采用用户指定的上线提示。
