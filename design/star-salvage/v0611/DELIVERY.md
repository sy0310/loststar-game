# v0.6.11 首分钟与整局平衡

[本轮返修结果与三版对照](#返修)

## 第一轮交付

运行源码 `7b6dbae76435c987011ce7e7511736437a47e067`。沿用原 H5、微信 Canvas 和国际版的同一战斗控制器。首发目标、输入策略和判定由 PR 原版 [first-minute.cjs](https://github.com/sy0310/loststar-game/blob/cc2812c/prototypes/salvage-survivor-demo/tests/first-minute.cjs) 固定。未上传、未提审，当前供开发复审。

## 首次出航的实测变化

| 指标 | 新手乱走 · 改前 | 新手乱走 · 改后 | 熟练躲避 · 改前 | 熟练躲避 · 改后 |
|---|---:|---:|---:|---:|
| 首次升级（秒） | 31.1 | 4.1 | 180 秒内无升级 | 4.1 |
| 60 秒等级¹ | 0 | 8 | 1 | 7 |
| 180 秒等级¹ | 0 | 0 | 1 | 15 |
| 存活（秒，上限 180） | 44.8 | 116.0 | 180 | 180 |
| 10 秒场上敌机 | 3 | 9 | 3 | 9 |
| 20 秒累计击落 | 13 | 44 | 13 | 35 |
| 结束时零件 | 16 | 243 | 63 | 213 |
| 最便宜的永久升级 | 400 | 60 | 400 | 60 |

¹ 验收脚本在该时点前已战败的局记 0。每种策略 3 个全新档，390×844 CSS 像素、DPR 2、桌面 Chromium、真实时间。中位数保留一位小数。完整逐局记录见[改前](baseline/summary.json)和[改后](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/summary.json)。

| 画面 | 改前 | 改后 |
|---|---|---|
| 首页 | [旧首页](baseline/home.png) | [星海突进](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/home.png) |
| 首次三选一 | [旧卡面](baseline/wanderer-first-upgrade.png) | [效果与进化搭档](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/wanderer-first-upgrade.png) |
| 10 / 30 / 60 秒 | [10 秒](baseline/wanderer-10s.png) · [30 秒](baseline/wanderer-30s.png) · 新手样本未活到 60 秒 | [10 秒](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/wanderer-10s.png) · [30 秒](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/wanderer-30s.png) · [60 秒](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/wanderer-60s.png) |
| 结算 | [旧结算](baseline/wanderer-end.png) | [可买的船体强化](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/result-affordable.png) |
| 图片失败 | [旧报错](baseline/startup-image-failure.png) | [中文重载](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/startup-image-failure.png) |
| 存储不可用 | [旧启动状态](baseline/startup-no-storage.png) | [可临时游玩](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/after/startup-no-storage.png) |

结算图单独取自普通入口：该局实际游玩 48 秒攒到 60 零件，从暂停页主动结算，显示可买船体强化。其余改后截图取自验收脚本。

## 规则和界面

- 新开局保存 `onboardingVersion: 1`，仅与战斗版本 8 搭配。缺省字段的在途档沿用原有首级门槛、经验曲线、拾取、伤害、刷怪和 RNG。旧武器、余额和已购等级随原记录恢复。
- 首次升级需 30 经验，2～9 级依次乘 0.86、0.86、0.86、0.86、0.86、0.88、0.92、0.96；10 级起恢复原曲线。晶体拾取半径 96，磁场每级 +40。前 60 秒晶体满 1.2 秒回飞，之后满 8 秒回飞，剩余 2 秒保护至抵达。零件与维修包沿用原拾取逻辑。
- 前 18 秒每 0.8 秒刷 2 架 skimmer，血量乘 0.6，从同侧成串入场，每 3 秒换侧。随后恢复原刷怪表。伤害从 0.30 倍线性增至 120 秒的全伤，精英和守卫时间点沿用原表。
- 15 个固定种子的补充模型试跑在建议参数下有 5 局不足 90 秒，3 局在首分钟到达 9 级。因此降低起始伤害系数、提高早期经验倍率。验收脚本与晶体价值沿用原值。最终参数见[可编辑数值表](https://github.com/sy0310/loststar-game/blob/cc2812c/design/star-salvage/v0611/BALANCE_V0611.json)。
- 开局提示在前 8 秒说明躲避与经验回飞。首页显示“第一次出航”和版本号。升级卡显示类型、名称、效果、等级及一行搭档进度。首次进化前收起融合提示。
- 船体、主炮首档分别 60、90 零件。整备和结算按实际余额及已购等级提示最便宜的下一档，足额时高亮可买按钮。
- 图片加载失败可点击“重新加载”。IndexedDB 缺失、打不开或被阻塞时，本页在内存中执行相同的开局、升级、结算及购买事务，并持续提示进度不会保存。已成功打开的数据库继续按原事务读写，损坏档保留原数据。

## 验证记录

从仓库根目录启动 `node prototypes/salvage-survivor-demo/serve.cjs --port 4472`。下表命令中 `G=prototypes/salvage-survivor-demo`，`OUT="$PWD/releases/first-minute"`。国际版先导出，然后用 `node "$G/serve.cjs" --root "$OUT/international/web" --port 4473` 提供本地 HTTP。

| 命令 | 结果 |
|---|---|
| `SURVIVOR_URL=http://127.0.0.1:4472/ FIRST_MINUTE_ENFORCE=1 FIRST_MINUTE_OUT="$OUT/v0611" node "$G/tests/first-minute.cjs"` | 6 局有效，`failures none` |
| `SURVIVOR_MODEL_OUT="$OUT/model.json" npm --prefix "$G" test` | 118 组既有模型和 5 组新规则通过 |
| `SURVIVOR_URL=http://127.0.0.1:4472/ SURVIVOR_REPORT="$OUT/browser.json" npm --prefix "$G" run test:browser` | Chromium、WebKit × 360、390，392 项通过 |
| `npm --prefix "$G" run build:wechat && npm --prefix "$G" run test:wechat` | 74 图，360 和 390 两种竖屏入口、触控、续玩、结算、损坏存档保护及重试通过 |
| `python3 "$G/international/build.py" --freeze --output "$OUT/international/web"` | 87 文件、445 词条，已提交运行源码 |
| `SURVIVOR_GLOBAL_URL=http://127.0.0.1:4473/ SURVIVOR_REPORT="$OUT/locale.json" npx playwright test --config "$G/international/playwright.config.cjs"` | 20 项语言回归通过 |
| `SURVIVOR_URL=http://127.0.0.1:4473/ SURVIVOR_REPORT="$OUT/global-storage.json" npm --prefix "$G" run test:browser -- storage.spec.cjs` | 国际版 60 项存档回归通过 |
| `SURVIVOR_MIGRATION_PORT=4474 SURVIVOR_MIGRATION_OUT="$OUT/migration.json" node "$G/tests/upgrade-save.cjs"` | 两引擎从 v0.6.2～v0.6.10 九个实际旧包同源续玩，共 18 次迁移通过 |
| `python3 "$G/sync_runtime.py" --check` | 可编辑数值表与运行脚本一致，74 原生素材映射通过 |

### 既有测试的调整

- `polish.test.cjs`、`browser/storage.spec.cjs`、`browser/v068.spec.cjs`、`international/tests/locale.spec.cjs` 按 60/90 的新首档价检查显示和扣款。高档价格、去重、并发购买及失败回滚断言保留。
- `draft.test.cjs`、`browser/v062.spec.cjs`、`browser/v069.spec.cjs` 在构造旧档时显式移除新规则；槽位文案按任务书更新。新测试另核对原种子 413 前 30 秒六个节点的 RNG、经验、机数与船体。
- `wechat/test.cjs` 检查玩家可读的中文素材提示，并继续执行真实按钮重载、解码和开局。迁移测试 `upgrade-save.cjs` 校验新版本以及旧局缺省、新局带标记。
- 原始设计参考按清单核验 20/20，本轮复用已有运行素材。

手机触控手感、真机混音听感、发热及真人留存转化待实机与用户复审。本轮没有平台提审、商店资料改动或正式发布。

## 返修

本轮运行源码 `bf01f6e`。首分钟脚本按评审提交 `061eaae` 的目标 v2 原样复跑。等级 0 表示到达时点前已战败。整局脚本为 60 局固定种子模拟。两份最终报告均为 `failures none`。

| 首分钟 v2，每种策略 3 局的中位数 | v0.6.10 | 第一轮 cc2812c | 本轮 |
|---|---:|---:|---:|
| 首次选卡（秒）（乱走 / 躲避） | 33.6 / 未升级 | 4.1 / 4.0 | 4.0 / 5.1 |
| 前 20 秒选卡次数（乱走 / 躲避） | 0 / 0 | 3 / 4 | 3 / 2 |
| 60 秒等级（乱走 / 躲避） | 0 / 1 | 8 / 8 | 7 / 6 |
| 存活（秒，上限 180）（乱走 / 躲避） | 50.5 / 180 | 126.9 / 180 | 125.6 / 180 |
| 180 秒等级（乱走 / 躲避） | 0 / 1 | 0 / 16 | 0 / 9 |
| 10 秒全场敌机（乱走 / 躲避） | 2 / 2 | 9 / 7 | 13 / 16 |
| 20 秒屏内敌机（乱走 / 躲避） | 7 / 7 | 4 / 3 | 11 / 14 |
| 30 秒屏内敌机（乱走 / 躲避） | 21 / 7 | 4 / 6 | 34 / 11 |
| 20 秒击落（乱走 / 躲避） | 15 / 13 | 44 / 45 | 58 / 42 |
| 结束时零件（乱走 / 躲避） | 33 / 60 | 339 / 355 | 383 / 126 |

| 15 分钟模型，5 种选卡策略 × 6 个固定种子 | v0.6.10 | 第一轮 cc2812c | 本轮 |
|---|---:|---:|---:|
| 新手通关率 | 0.0% | 96.7% | 13.3% |
| 新手存活中位数（秒） | 352.3 | 900 | 454.4 |
| 新手 5 分钟等级 | 2 | 27 | 13 |
| 满永久通关率 | 53.3% | 100.0% | 76.7% |

[首分钟完整记录](after/summary.json) · [整局护栏](after/guardrails.json) · [旧版按目标 v2 实跑](acceptance/first-minute-v2-v0610.json) · [20 秒画面](after/wanderer-20s.png) · [30 秒画面](after/wanderer-30s.png) · [结算提示](after/result-affordable.png)

### 最终数值

```json
{
  "version": 1,
  "firstLevelXP": 48,
  "levelXPScale": [
    1.72,
    1.6,
    1.3,
    1.6,
    1.85,
    2.2,
    2.0,
    1.85
  ],
  "experienceRadius": 96,
  "magnetPerLevel": 40,
  "recall": {
    "earlyUntil": 60,
    "earlyAfter": 1.2,
    "lateAfter": 8,
    "expiryGuard": 2,
    "until": 180
  },
  "opening": {
    "until": 18,
    "interval": 0.58,
    "count": 2,
    "pool": [
      "skimmer"
    ],
    "hpScale": 0.6,
    "streamSeconds": 3
  },
  "damageRamp": {
    "start": 0.1,
    "fullAt": 200
  },
  "hintSeconds": 8,
  "levelXPLateScale": 1.7,
  "followUp": {
    "until": 120,
    "extraCount": 1,
    "intervalScale": 0.8,
    "targetEnemies": 18,
    "maxBatch": 8
  }
}
```

开局保留快速首选，提高连续几级的经验门槛，给玩家留出体验刚拿到的武器的时间。18～120 秒每波多增援一架，间隔为原来的 0.8 倍；存活敌机偏少时向 18 架补充，每批最多 8 架。试跑的乱走存活中位数曾为 89.4 秒，因此降低开局伤害，200 秒恢复全伤。自动吸附与临期保活在回收窗口结束时停止触发，仍可通过距离、磁场和天线吸引经验。150 秒窗口试跑的新手 5 分钟等级中位数为 11，因此最终采用 180 秒窗口。上一组参数在躲避实跑中首分钟仅达 4 级；虽然目标 v2 的脚本对躲避组下限是 4，任务书要求两种策略均为 5～7。因此首级调整到 48，同时降低 3～4 级门槛，重新跑两套验收并单独核对两组等级。10 级起经验门槛乘 1.7，晶体面值保留。模型测试覆盖窗口边界、老局费用与种子 413 的随机序列。微信回归导出到独立目录，送审目录在本轮前后文件清单与内容摘要一致。

### 验证命令

从仓库根目录执行，`G=prototypes/salvage-survivor-demo`，`F="$PWD/releases/first-minute/v0611-rework"`，`R="$PWD/releases/full-run/v0611-rework"`。H5 由 `node "$G/serve.cjs" --port 4472` 提供。国际版由同一服务的 `--root "$R/intl/web" --port 4476` 提供。

| 命令 | 结果 |
|---|---|
| `SURVIVOR_URL=http://127.0.0.1:4472/ FIRST_MINUTE_ENFORCE=1 FIRST_MINUTE_OUT="$F" node "$G/tests/first-minute.cjs"` | 6 局，`failures none` |
| `FULL_RUN_ENFORCE=1 FULL_RUN_OUT="$R" node "$G/tests/full-run-guardrails.cjs"` | 默认 6 种子，两组各 30 局，`failures none` |
| `SURVIVOR_MODEL_OUT="$R/model.json" npm --prefix "$G" test` | 118 个原有模型用例、6 个 onboarding 用例通过 |
| `SURVIVOR_URL=http://127.0.0.1:4472/ SURVIVOR_REPORT="$R/browser.json" npm --prefix "$G" run test:browser` | 392 项通过，Chromium / WebKit × 两种竖屏 |
| `python3 "$G/wechat/build.py" --output "$PWD/releases/wechat-minigame-test"` | 本地专用测试包导出，74 张运行图 |
| `SURVIVOR_WECHAT_DIR="$PWD/releases/wechat-minigame-test" npm --prefix "$G" run test:wechat` | 360 和 390 竖屏、恢复及坏档保护通过 |
| `SURVIVOR_WECHAT_DIR="$PWD/releases/wechat-minigame-test" SURVIVOR_WECHAT_REPORT_DIR="$R/wx-graphics" node "$G/wechat/browser.cjs"` | 两引擎 × 两种尺寸的图形回归通过 |
| `python3 "$G/international/build.py" --freeze --output "$R/intl/web"`，然后 `SURVIVOR_GLOBAL_URL=http://127.0.0.1:4476/ SURVIVOR_REPORT="$R/locale.json" npx playwright test --config "$G/international/playwright.config.cjs"` | 20 项语言回归通过 |

20 秒截图与结算截图取自另一局普通入口实跑，其余截图来自本轮首分钟脚本。手感、听感、发热、真人通关率和实际留存仍待真机复审。未上传、未提审、未发布。

## TapTap 双端备包

第二轮独立复审通过，用户试玩国内开发自测包 520084 后确认本版体验。两端后台均已回读，当前更新草稿均为 `V-20261120`。

| 渠道 | 草稿中的版本 | 上传与校验 |
|---|---|---|
| 国内 H5 | 0.6.11，包体 520084 | 草稿主包已从 480638 切换为用户试玩的包。后台仍将 V-20261114 列为线上版本。 |
| 国际 Android | 0.6.11-global.1，版本号 2 | APK 构建自 `4aacb50`，共 6,391,823 字节。与线上版本号 1 的包名和签名证书一致，87 个内置资源的摘要均与构建清单匹配。刷新后台并读取草稿后，APK 页显示本次上传为版本号 2，上一版为 1。 |

国际 APK 的 SHA-256 为 `ecb2d7de57b8a94e30ceaf6c4e102179ab8f0caaf6fc5d162ac2f4bc3835a5a2`。商店页文案和素材留待后续更新，两端都停在草稿阶段，尚未提审或发布。
