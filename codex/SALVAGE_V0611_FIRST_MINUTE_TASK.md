# Codex 执行任务｜v0.6.11 首分钟体验：10 秒上手，60 秒成型

仓库 `sy0310/loststar-game`。工作分支 `codex/v0611-first-minute`，基于 `codex/v0.1-vertical-slice` 的 `1a9ca1a`。对应 Draft PR：本分支合入 `codex/v0.1-vertical-slice`。

**只在本分支提交。不合并，不打包上传 TapTap、微信或 APK，不提审，不发布。**

## 0. 先读

1. `AGENTS.md`。
2. 本文件全文。它是本任务唯一的需求来源。
3. `prototypes/salvage-survivor-demo/README.md`，以及 `src/game.js`、`src/balance.js`、`src/persistence.js`、`src/art.js`、`index.html`。
4. 规则门控的先例：v0.6.10 的 `repairScalingVersion`（`src/game.js` 约 168–180、292、787、5141 行）和 `tests/scaled-repair.test.cjs`。
5. 验收脚本 `prototypes/salvage-survivor-demo/tests/first-minute.cjs`（本 PR 已提交）。
6. 基线证据 `design/star-salvage/v0611/baseline/`。

下文行号对应 `1a9ca1a` 的 `prototypes/salvage-survivor-demo/src/game.js`，仅供定位。

## 1. 为什么做

TapTap 公开页上线 5 天，热度 1、关注 2、0 评价，试玩转化为 0。商店页另开 PR 处理。本 PR 只解决"有人点进来也留不住"。

当前新局在 390×844、全新存档、真实时间下的表现。源码 HEAD 等于线上 TapTap 包 480638 加三处兼容修复。

| 指标（3 局中位数） | wanderer（新手式乱走） | dodger（熟练躲避） |
|---|---|---|
| 第一次升级 | 31.1 秒（29.3–39.6 秒） | 2 局在 180 秒内一次都没升级，另 1 局在 67.8 秒 |
| 60 秒时等级 | 已被击毁 | 1 级 |
| 180 秒时等级 | — | 1 级 |
| 存活 | 44.8 秒（39.9–48.9 秒） | 180 秒 |
| 10 秒时场上敌机 | 3 | 3 |
| 20 秒累计击落 | 13 | 13 |
| 首局带回零件 | 16（最便宜永久升级要 400） | 63 |

验收脚本在当前源码上共 13 项不达标，完整输出见 `design/star-salvage/v0611/baseline/summary.json`。首页和启动检查也都没过：首页显示"开发自测"，标题是"星海生存"；禁用 IndexedDB 时无法开局；素材加载失败时只显示英文报错和"重试保存"。开发源码首页的版本号显示为 `develop`，所以"无提交哈希"在源码上能过，但线上包显示的是 `ea26e29`。

数据由验收脚本在桌面 Chromium 无头模式下跑出，不是手机实测。dodger 使用仓库 `tests/capture-v065.cjs` 里的 `steer` 避险算法。

根因都能在代码里找到：

| 问题 | 位置 | 现值 |
|---|---|---|
| 第一级经验太高 | `balance.js` `firstLevelXP` | 100。普通敌机掉 8 点，需约 13 次击落 |
| 经验拾取范围小，且会消失 | `balance.js` `pickup.baseExperienceRadius`；击落掉落约 1446–1462 行 | 半径 36 像素，晶体 30 秒后消失 |
| 敌机多在远处被击落 | 主炮射程 465，自动瞄准最近敌机 | 晶体落在远处，躲得越好越捡不到 |
| 开局冷清 | 刷怪约 2240–2259 行 | 前 12 秒每次只刷 1 架；32 HP 要打两发 |
| 前期掉血快 | `damageShip` 约 1564 行；碰撞约 4396 行 | 碰撞 6 点，新手式乱走约每秒掉 2 点 |
| 卡面信息过密 | `renderUpgrades` 约 683–880 行 | 每张卡都写"双满级进化 · A x/5 ＋ B y/5 · 精英战利品中抽取" |
| 首页像测试包 | `index.html`；`showStart` 约 5591 行 | 显示"失物号 · 开发自测 / 星海生存 / v0.6.10 · 提交哈希"。商店名是《失物号：星海突进》，微信版已用"星海突进" |
| 第一局后无成长 | `balance.js` `permanentCosts` | 首档 400 和 500，新手首局只带回约 35 零件 |
| 启动失败时玩家看不懂、也救不回来 | `initialize` 约 5695 行；`retrySaving` 约 5678 行；`persistence.js` `create` | 74 张图或 IndexedDB 任一失败，"开始一局"不可点，底部只显示英文原始报错（如 `The source image cannot be decoded.`）和"重试保存"按钮。点它其实会重跑初始化，但文案让人以为是存档问题；IndexedDB 不可用时重试也无效。微信版在未就绪时已把这个按钮显示为"重新加载"（`wechat/ui.js` 第 280 行） |

## 2. 目标

玩家视角：

1. 开局 10 秒内满屏有敌机可打，能连续击落，并完成第一次三选一。
2. 前 60 秒有 4–7 次选卡。每张卡一眼能看懂"它是什么、升了有什么用"。
3. 不会躲的新手也能活过 90 秒；会躲的玩家照样稳定升级。
4. 第一局结束后，"下一局，会更强"当场兑现：零件够买一项永久升级。
5. 任何设备都能开局。素材或存档出问题时，玩家能自救，或不存档直接玩。

量化验收由验收脚本判定，取 3 局中位数。`FIRST_MINUTE_ENFORCE=1` 时必须输出 `failures none`：

| 指标 | wanderer（新手式乱走） | dodger（熟练躲避） |
|---|---|---|
| 第一次升级 | ≤ 8 秒 | ≤ 15 秒 |
| 60 秒时等级 | 5–8 级 | ≥ 4 级 |
| 180 秒时等级 | — | ≥ 7 级 |
| 存活 | ≥ 90 秒 | 180 秒时仍存活 |
| 10 秒时场上敌机 | ≥ 6 | — |
| 20 秒累计击落 | ≥ 15 | — |
| 首局带回零件 ≥ 最便宜一档永久升级 | 是 | — |

另外三项检查：

- 首页没有"开发自测"、没有提交哈希，标题含"星海突进"。
- 禁用 IndexedDB 时仍能开局。
- 首张飞船图第一次加载失败时出现"重新加载"按钮，点击后能开局。

## 3. 硬约束

1. **旧局不变。** 新的战斗和成长行为只对新开局生效，用 `g.rules.onboardingVersion === 1` 门控，与 `repairScalingVersion` 同一模式。v0.6.10 及更早保存的在途局没有这个字段，续玩时的经验、拾取、刷怪、伤害和随机数消耗顺序必须与现在完全一致。
2. **新数值集中放。** 全部放进 `balance.js` 新增的 `onboarding` 段。不要修改 `firstLevelXP`、`pickup.baseExperienceRadius`、`assault.levelXP`、`assault.waves` 等现有字段，旧局还要用。`permanentCosts` 例外，见 G。
3. **不联网。** 不加任何统计或埋点（平台隐私声明为"不收集个人信息"），不加广告、付费、社交或排行榜。
4. **不加内容。** 不新增武器、敌人、Boss、美术素材或音乐。精英 70 秒、Boss 130 秒的时间点不变。
5. **三端共用源码。** H5、微信、国际版共用 `src/`：
   - 新增或改动的中文界面文字，同步加进 `international/en.tsv`。
   - `international/build.py` 第 59 行按原 `<title>` 做精确替换，标题改了要同步改这里。
   - `wechat/ui.js` 已自绘"星海突进／失物号"，保持一致。如果它读取了本次改动的元素，同步调整。
   - 本轮只交付 H5 源码。可以在本地导出微信和国际版做测试，但不上传。
6. **不改历史证据。** 不修改 `design/star-salvage/v0610/` 及更早版本目录，也不修改 `artifacts/` 下的历史文件，CI 会对它们做摘要校验。测试报告写到 `releases/`，不要覆盖 `artifacts/survivor-global/*.json` 等已提交证据。
7. **保留验收脚本依赖的接口：**
   - `window.SurvivorDemo.ready()`、`window.SurvivorDemo.state()`、`window.SurvivorBalance`
   - `#startBtn`、`[data-pick]`、`#saveStatus`、`#start h1`
   - `tests/capture-v065.cjs` 导出的 `steer` 和 `inputDirections`
8. **先写失败测试，再实现（TDD）。** 不得删除或跳过现有测试来换取通过。
9. **不加阻塞式引导。** 开局提示只能用不挡操作的文字（`#footHint`、toast）。不要新增需要点击才能关闭的弹层、教程页或确认框，它们会拖慢前 10 秒。

## 4. 改动清单

### A. 规则门控与版本

- `resetWorld()` 的 `rules` 增加 `onboardingVersion: 1`。
- 新增 `const onboardingRun = (game = g) => runRules(game).onboardingVersion === 1;`。
- 规则快照校验（约 5141–5155 行）：`onboardingVersion` 只允许缺省或 `1`，为 `1` 时必须是 `combatVersion 8`，否则拒绝并保留原数据。
- `window.SurvivorQA` 增加 `legacyV0610()`：删除 `g.rules.onboardingVersion`，设 `g.xpNext = B.firstLevelXP`，用来在测试里模拟 v0.6.10 在途局。
- 版本号统一改为 `0.6.11`：`balance.js` 的 `version`、`prototypes/salvage-survivor-demo/package.json` 的 `version`，以及 `index.html` 里的 `window.SurvivorBuild`。

### B. 经验节奏（仅 onboarding 局）

在 `balance.js` 新增以下段落。数值是建议起点，可以在 `onboarding` 段内调参：

```json
"onboarding": {
  "version": 1,
  "firstLevelXP": 30,
  "levelXPScale": [0.7, 0.7, 0.7, 0.7, 0.76, 0.82, 0.88, 0.94],
  "experienceRadius": 96,
  "magnetPerLevel": 40,
  "recall": { "earlyUntil": 60, "earlyAfter": 1.2, "lateAfter": 8, "expiryGuard": 2 },
  "opening": { "until": 18, "interval": 0.8, "count": 2, "pool": ["skimmer"], "hpScale": 0.6, "streamSeconds": 3 },
  "damageRamp": { "start": 0.5, "fullAt": 120 },
  "hintSeconds": 8
}
```

1. **第一级**：onboarding 局 `xpNext` 的初值用 `onboarding.firstLevelXP`。
2. **升级曲线**：`levelXP(level)`（约 421 行）在 onboarding 局返回 `round(原 assault 曲线值 × scale)`。2–9 级的 `scale` 取 `levelXPScale[level - 2]`，10 级起为 1。按建议值，2→3 级约 60，5→6 级约 118，9→10 级约 277，之后与原曲线相同，不会出现断崖。
3. **拾取半径**：onboarding 局里，`pickupRadius("xp")` 的基础值改用 `experienceRadius`，"回收磁场"被动每级系数改用 `magnetPerLevel`。旋刃进化、回收天线等其他加成照旧，零件和修理包的拾取半径不变。
4. **经验回收**：onboarding 局的经验晶体存在超过 `recallAfter` 秒后，自动设为 `magnetized` 飞向飞船。`g.time < recall.earlyUntil` 时 `recallAfter = earlyAfter`，之后为 `lateAfter`。晶体剩余寿命 ≤ `expiryGuard` 秒时强制回收，不再无声消失。
   - 存在时间优先用现有 `pickup.t` 推算（击落掉落的初值为 30），避免改动快照结构。如果要新增字段，必须同步快照校验并补往返测试。
   - 旧局晶体到期照旧消失。

### C. 开局兵潮（仅 onboarding 局）

1. `0 ≤ g.time < opening.until` 期间，主刷怪逻辑（约 2240 行）每 `opening.interval` 秒刷 `opening.count` 架，类型只从 `opening.pool` 里取。
2. 这些敌机的 HP 乘以 `opening.hpScale`。要保证 18 秒内任何时刻的实际 HP 都 ≤ 1 级主炮单发伤害，也就是一发击落。当前单发伤害是 `15 + 1×9 = 24`，不含永久"主炮校准"加成。
3. 每 `streamSeconds` 秒内的敌机从同一侧进场，排成一串，然后换一侧。不要改变旧局的随机数消耗顺序。
4. `opening.until` 之后，回到现有刷怪表和间隔公式。18–30 秒每次刷怪数量保持 ≥ 2，中间不要出现空档。
5. 开局兵潮不改变精英、Boss 和奇遇的出现时间。

### D. 前期伤害（仅 onboarding 局）

- 在 `damageShip()` 里统一乘一个前期系数：`t < fullAt` 时为 `start + (1 - start) × t / fullAt`，之后为 1。碰撞、敌弹、雷区、爆炸全部适用。
- 护盾、无敌帧，以及 `assaultCombat` 300 秒后的伤害增幅都不改，照旧叠加。

### E. 卡面与术语（所有局的界面）

1. 普通武器卡和配件卡只保留四样：类型、名称、一句效果、`Lv a → b`。
2. "双满级进化 · A x/5 ＋ B y/5 · 精英战利品中抽取"改成一行：武器卡写 `进化搭档：配件名 y/5`，配件卡写 `进化搭档：武器名 x/5`。不超过 14 个汉字，数字和符号不计。
3. 升级页副标题（约 858 行，普通升级分支）改为 `武器和搭档都满5级后，击败精英可进化`。
4. 玩家还没有任何进化武器时，隐藏升级页底部的 `fusionGuide`。
5. 统一术语：
   - HUD 装备行标签（约 3392 行）：`武装`/`增强` → `武器`/`配件`。
   - 卡片类型：`主动武器`/`辅助配件` → `武器`/`配件`。
   - 升级页底部：`主动 x/6（9种） · 增强 y/6（8种）` → `武器 x/6 · 配件 y/6`。
6. 进化卡、融合卡、精英战利品卡和修补卡的信息量保持不变。
7. 在 360×800 下，普通卡不超过 4 行文字，没有横向溢出，点击区域不缩小。

### F. 首页与开局提示

1. `index.html`：
   - `<title>` 改为 `失物号：星海突进`。
   - `.subtitle` 从 `失物号 · 开发自测` 改为 `失物号`。
   - `h1` 从 `星海生存` 改为 `星海突进`。
   - `.intro-copy` 改为 `拖动飞船躲避，武器自动开火。<br>击落敌机掉落经验，三选一越打越强。`
   - `.run-promise` 三项改为 `15分钟生存`、`9种武器`、`进化与融合`。
2. `showStart()`：`#buildStamp` 只显示 `v0.6.11`，不显示提交哈希。哈希可以留在暂停页小字或 `?qa=1` 模式，但首页不能出现。
3. `#recordText`：`profile.runs === 0` 时显示 `第一次出航`，之后保持现有格式。
4. onboarding 局开局的前 `hintSeconds` 秒，`#footHint` 显示 `拖动躲避 · 经验会自动飞回`，之后恢复原提示。

### G. 第一局后的成长

1. 调整 `permanentCosts`：
   - `hull` 从 `[400, 1000, 1800]` 改为 `[60, 1000, 1800]`。
   - `gun` 从 `[500, 1200, 2100]` 改为 `[90, 1200, 2100]`。
   - 已购等级和余额不变。`tests/polish.test.cjs` 第 97–98 行的价格断言按新值更新，并在 DELIVERY 写明这是有意变更。
2. 在结果页"下一局，会更强"下方加一行：零件够买时显示 `零件够了：可以强化 船体加固`，同时高亮对应按钮；不够时显示 `还差 N 零件可强化`。整备页做同样提示。
3. 验收标准：wanderer 首局带回零件的中位数 ≥ 最便宜一档。达不到时先调首档价格，不要靠提高零件掉落。

### H. 启动兜底

1. **素材加载失败**：`window.SurvivorArt.load()` 失败时，底部状态栏改为中文提示 `素材没加载完整，点重新加载再试一次`，按钮显示 `重新加载`。
   - 可以直接复用 `#retrySaveBtn`：未就绪（`ready === false`）时显示 `重新加载`，就绪后恢复 `重试保存`，与微信版一致。现有 `retrySaving()` 在 `storage` 为空时已经会重跑 `initialize()`。
   - 按钮必须是 `<button>`，能被 `getByRole('button', { name: /重新加载/ })` 找到。
   - 点击后重新执行素材加载和后续初始化，成功后"开始一局"可用。`art.js` 的 `load()` 可以重复调用。
   - 原始英文报错不再直接展示给玩家，可以放进按钮的 `title` 或 QA 日志。
2. **存档不可用**：`indexedDB` 不存在、打开出错或被阻止时，`SurvivorPersistence.create()` 退回内存存储。
   - 内存存储实现与 `SurvivorNativeStorage` 相同的 `transaction(change, validateRecord, initialProfile)` 约定，返回对象带 `volatile: true`。
   - `initialize()` 里设 `ready = true`，`#saveStatus` 显示 `本机存档不可用 · 本次进度不会保存`。
   - 内存模式下，开局、升级、结算、购买照常工作。
3. IndexedDB 可用时绝不走内存模式，不覆盖、不清理现有档。QA 库继续用 `.qa` 后缀。

### I. 调参顺序

验收脚本某项不达标时，只在 `onboarding` 段内调整，按下表顺序先动第一个参数：

| 不达标 | 先调 | 再调 | 不要做 |
|---|---|---|---|
| 第一次升级太晚 | `firstLevelXP` | `recall.earlyAfter` | 去掉回收延迟、让晶体瞬间到账 |
| 60 秒等级超过 8 | `levelXPScale` 前几项 | `firstLevelXP` | 减少开局兵潮 |
| 60 秒等级不足 | `levelXPScale` 前几项 | `opening.interval` | 提高晶体经验值 |
| wanderer 存活不足 90 秒 | `damageRamp.start` | `opening.count` | 取消碰撞伤害、加无敌时间 |
| 10 秒敌机太少或 20 秒击落太少 | `opening.interval` | `opening.count` | 把开局敌机改成不移动 |
| dodger 180 秒等级不足 | `recall.lateAfter` | `levelXPScale` 后几项 | 改 dodger 策略 |
| 首局零件买不起首档 | `permanentCosts` 首档 | — | 提高零件掉落 |

任何一局出现页面报错，脚本会记为无效局并判定失败，需要修复报错，不能忽略。

## 5. 测试

1. **新增模型测试**：新建 `tests/onboarding.test.cjs`，加入 `package.json` 的 `test` 脚本。写法仿照 `tests/scaled-repair.test.cjs`，用 `model-harness.cjs` 的 `createModel()` 和 `SurvivorQA.startModel(seed)`。至少覆盖：
   - 新局 `onboardingVersion === 1`；调用 `legacyV0610()` 后，固定种子前 30 秒的 `xp`、敌机数量和船体轨迹与 v0.6.10 规则一致。
   - 第一级经验 30；2–9 级按表缩放；10 级起与原曲线相同。
   - 经验拾取半径 96，磁场每级 +40；旧局仍为 36 和 +55。
   - 回收：60 秒内存在 1.2 秒后回收，之后 8 秒；剩余寿命 ≤ 2 秒时强制回收；旧局到期消失。
   - 开局兵潮：0–18 秒只刷 skimmer，HP ≤ 24；18 秒后恢复原刷怪池。
   - 前期伤害系数在 0、60、120、300 秒分别为 0.5、0.75、1、1；旧局恒为 1。
   - onboarding 局存档快照往返后，规则和晶体状态一致；非法的 `onboardingVersion` 会被拒绝。
   - 新首档价格下购买成功、余额正确；已购等级的档案读取不变。
2. **现有模型测试**：`npm --prefix prototypes/salvage-survivor-demo test` 必须全部通过。如果旧断言因为新局默认开启 onboarding 而失败，优先改成在 `legacyV0610()` 下验证旧规则。确实需要改断言的，在 DELIVERY 里逐条写明理由。
3. **浏览器测试**：新增 `tests/browser/v0611.spec.cjs`，覆盖首页文字、普通卡行数与无溢出（360 和 390 两种宽度），以及两条启动兜底。

   ```bash
   node prototypes/salvage-survivor-demo/serve.cjs --port 4398
   SURVIVOR_URL=http://127.0.0.1:4398/ npm --prefix prototypes/salvage-survivor-demo run test:browser
   ```

   Chromium 和 WebKit × 360 和 390，全部通过。
4. **微信和国际版**：都只在本地验证，不上传。
   - 微信：`npm --prefix prototypes/salvage-survivor-demo run build:wechat`，然后 `npm --prefix prototypes/salvage-survivor-demo run test:wechat`，两步都通过。
   - 国际版：按 `international/README.md` 的 "Browser regression" 步骤导出并运行语言测试，只跑浏览器部分，不需要 Android 模拟器。报告输出到 `releases/`。
5. **首分钟验收脚本**：

   ```bash
   node prototypes/salvage-survivor-demo/serve.cjs --port 4472
   SURVIVOR_URL=http://127.0.0.1:4472/ FIRST_MINUTE_ENFORCE=1 \
     FIRST_MINUTE_OUT=releases/first-minute/v0611 \
     node prototypes/salvage-survivor-demo/tests/first-minute.cjs
   ```

   必须输出 `failures none`。**不得修改脚本中的 `TARGETS`、两种玩家策略、`FIRST_MINUTE_CAP` 默认值或判定逻辑。** 如果认为某个目标不合理，在 PR 评论里说明理由并保留未达标的结果，不要改脚本。

## 6. 交付

1. 新建 `design/star-salvage/v0611/DELIVERY.md`，写清：
   - 改动摘要和最终 `onboarding` 数值；与建议值不同的，写明原因。
   - 每条测试命令及其结果。
   - 验收脚本的前后对比表。基线见 `design/star-salvage/v0611/baseline/summary.json`。
   - 旧局兼容说明，以及因此修改的既有测试清单。
   - 未完成或未验证的事项。真机手感、听感和发热必须列为未验证。
2. 前后对比截图（390×844）放在 `design/star-salvage/v0611/after/`，包括：首页、第一次升级卡面、10／30／60 秒战斗、结果页（零件够买时）、两种启动兜底。可以直接用验收脚本输出的截图。
3. 提交按阶段拆分：`test:`（失败测试）→ `feat:`（规则与数值）→ `feat:`（卡面、首页、结果页）→ `feat:`（启动兜底）→ `docs:`（DELIVERY 与截图）。推送到 `codex/v0611-first-minute`，更新本 Draft PR 的说明，附上验收脚本输出。
4. 按惯例在 README 顶部加一节 v0.6.11 状态，注明"未上传、未提审"。

## 7. 不在本 PR 范围

- 商店页：分类、标签、推荐语、截图、横版宣传片和 PC 平台，另开 PR 处理。
- 进化预览、新武器、新敌人、新 Boss，以及排行榜、成就、分享和任何联网功能。
- 打包，上传 TapTap、微信或 APK，提审或发布。

## 8. 完成前自检

- [ ] 新局带 `onboardingVersion: 1`；旧在途局的规则和随机数顺序不变，并有测试覆盖。
- [ ] 所有新数值都在 `balance.js` 的 `onboarding` 段；除 `permanentCosts` 外，旧字段未改。
- [ ] 模型、浏览器、微信、国际版测试全部通过，没有删除或跳过任何测试。
- [ ] 验收脚本输出 `failures none`，脚本本身未修改。
- [ ] 首页、卡面、结果页和启动兜底的截图齐全。
- [ ] `en.tsv` 和 `international/build.py` 的标题替换已同步。
- [ ] 没有联网、没有加埋点、没有改历史证据，也没有上传或发布。
- [ ] DELIVERY 写清最终数值、测试结果和未验证事项。
