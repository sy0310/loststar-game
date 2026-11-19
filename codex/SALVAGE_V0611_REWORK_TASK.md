# Codex 返修任务｜v0.6.11：保留上手提速，修复整局被打穿

仓库 `sy0310/loststar-game`，继续在分支 `codex/v0611-first-minute`（Draft PR #3）上提交。

**只在本分支提交。不合并，不打包上传 TapTap、微信或 APK，不提审，不发布。**

## 0. 先读

1. `AGENTS.md`。
2. 本文件全文。它是本轮返修唯一的需求来源。
3. 原任务书 `codex/SALVAGE_V0611_FIRST_MINUTE_TASK.md`。它的第 3 节硬约束继续全部有效；本文只修改其中的目标数字，并新增下面的要求。
4. PR #3 上 Claude 的验收评论。
5. 两个验收脚本：
   - `prototypes/salvage-survivor-demo/tests/first-minute.cjs`，已由 Claude 更新为目标 v2。
   - `prototypes/salvage-survivor-demo/tests/full-run-guardrails.cjs`，新增的整局护栏。

## 1. 为什么返修

第一轮实现（`cc2812c`）按原任务书全部完成：

- 首分钟脚本 `failures none`，Claude 独立复跑结果一致。
- 模型、浏览器、微信测试全部通过。
- 旧存档续玩与改动前的代码逐帧一致。
- 没有删测试，也没有改验收脚本。

问题出在原任务书本身：它只约束了前 3 分钟。经验改为全数回收后，而原有数值是按"大部分经验捡不到"设计的，结果整局被打穿。

**整局模拟**（`simulate.cjs`，躲避型移动，5 种选卡策略 × 6 个种子 = 每组 30 局）：

| 指标 | v0.6.10（改动前） | v0.6.11 第一轮 | 返修目标 |
|---|---|---|---|
| 新手 15 分钟通关率 | 0% | 96.7% | 10%–35% |
| 新手存活中位数 | 352 秒 | 900 秒（全程） | 360–720 秒 |
| 新手 5 分钟时等级 | 2 | 27 | 12–20 |
| 满级老玩家通关率 | 53.3% | 100% | 50%–90% |

"新手"指没有任何永久强化；"满级老玩家"指船体、主炮各 3 级，三条工程各 6 级。

**首分钟**（`first-minute.cjs` 目标 v2，3 局中位数）：

| 指标 | 乱走 | 躲避 | 目标 v2 |
|---|---|---|---|
| 第一次升级 | 4.1 秒 | 4.0 秒 | ≤ 8 秒 / ≤ 15 秒 |
| 前 20 秒选卡次数 | 3 | 4 | ≤ 3 |
| 60 秒时等级 | 8 | 8 | 5–7 级 |
| 20 秒时屏幕内敌机 | 4 | — | ≥ 6 |
| 30 秒时屏幕内敌机 | 4 | — | ≥ 6 |
| 存活 | 126.9 秒 | 180 秒 | ≥ 90 秒 / 180 秒 |

第一轮代码在目标 v2 下有 5 项不达标：乱走的 60 秒等级、20 秒和 30 秒屏幕内敌机；躲避的前 20 秒选卡次数和 60 秒等级。屏幕内敌机只对乱走考核。

**流程问题**：第一轮本地运行 `build:wechat` 时，覆盖了微信开发者工具的导入目录 `releases/wechat-minigame`，现在是 `0.6.11-wx.1`。这个目录是给微信送审用的，不能再写。

## 2. 目标

保留第一轮的全部成果：

- 第一次升级 ≤ 8 秒，新手活过 90 秒，首局零件够买首档。
- 首页、卡面、结算提示、启动兜底、旧局兼容。

调整或新增以下目标：

1. 前 20 秒最多 3 次选卡；两种玩家在 60 秒时都是 5–7 级。
2. 20 秒和 30 秒时，屏幕内的敌机都 ≥ 6 架。
3. 整局护栏全部达标（见第 1 节表格最后一列）。

## 3. 新增硬约束

1. **原任务书第 3 节全部继续有效**：旧局不变、新数值集中放、不联网、不加内容、三端同步、不改历史证据、保留接口、TDD、不加阻塞引导。
2. **不得修改验收工具**：`tests/first-minute.cjs`、`tests/full-run-guardrails.cjs`、`tests/simulate.cjs`、`tests/capture-v065.cjs`。如果认为某个目标不合理，在 PR 评论里说明理由并保留未达标的结果。
3. **不得再写 `releases/wechat-minigame`**。微信测试按 R5 导出到 `releases/wechat-minigame-test`。
4. **数值只动 `onboarding` 段**。调参只改 `balance.js`（及其来源 `design/star-salvage/v0611/BALANCE_V0611.json`）里的 `onboarding` 段。新增的字段同样只作用于 `onboardingVersion === 1` 的新局，旧局曲线、刷怪和掉落不变。

## 4. 改动清单

### R1. 经验回收只在开局窗口生效

- 新增 `onboarding.recall.until`，建议 120 秒。
- 窗口之后不再自动回收；`expiryGuard` 也只在窗口内生效。窗口之后，晶体照旧规则到期消失，但保留 96 的拾取半径和磁场加成。
- 窗口边界要有模型测试覆盖。

### R2. 中后期升级曲线

二选一或组合，以整局护栏达标为准，并在 DELIVERY 写明理由：

- 新增 `onboarding.levelXPLateScale`，作用于 10 级及以上（建议从 1.2 开始试）。
- 降低窗口之后的晶体经验值（新增字段，例如 `onboarding.lateXPValueScale`）。

不得改动旧局曲线和 `assault.levelXP`。

### R3. 首分钟节奏

调整 `firstLevelXP` 和 `levelXPScale` 的前几项，使前 20 秒 ≤ 3 次选卡、60 秒时 5–7 级，同时第一次升级仍 ≤ 8 秒。

### R4. 开局兵潮之后的密度

- 新增 `onboarding.followUp` 段（例如 `{ "until": 120, "extraCount": 1, "intervalScale": 0.8 }`）。
- 18–120 秒内，在 onboarding 局里提高刷怪量，使 20 秒和 30 秒时屏幕内敌机 ≥ 6，同时 wanderer 存活仍 ≥ 90 秒。
- 不得把敌机改成不移动，也不要只刷在屏幕边缘、长时间不进场。

### R5. 微信输出目录可配置

- `wechat/build.py` 增加 `--output` 参数，默认值不变。
- `wechat/test.cjs` 和 `wechat/browser.cjs` 支持环境变量 `SURVIVOR_WECHAT_DIR`，默认值不变。
- 本轮所有微信测试都导出到 `releases/wechat-minigame-test`。

### R6. 测试

- 更新 `tests/onboarding.test.cjs`，覆盖 R1–R4：
  - 回收窗口结束后恢复旧拾取行为；
  - 后期曲线缩放只作用于新局；
  - `followUp` 只在 onboarding 局的窗口内生效。
- 保留"旧局种子 413 逐帧一致"测试。

## 5. 验收（全部必须通过）

1. 首分钟：

   ```bash
   node prototypes/salvage-survivor-demo/serve.cjs --port 4472
   SURVIVOR_URL=http://127.0.0.1:4472/ FIRST_MINUTE_ENFORCE=1 \
     FIRST_MINUTE_OUT=releases/first-minute/v0611-rework \
     node prototypes/salvage-survivor-demo/tests/first-minute.cjs
   ```

   输出 `failures none`。

2. 整局护栏：

   ```bash
   FULL_RUN_ENFORCE=1 FULL_RUN_OUT=releases/full-run/v0611-rework \
     node prototypes/salvage-survivor-demo/tests/full-run-guardrails.cjs
   ```

   默认 6 个种子，约 6–15 分钟，输出 `failures none`。调参时可以先用 `FULL_RUN_SEEDS=3` 快速迭代，最终结果必须用默认 6 个种子。

3. 回归测试：
   - 模型测试：`npm --prefix prototypes/salvage-survivor-demo test`
   - 完整浏览器测试：`test:browser`，Chromium 和 WebKit × 360 和 390
   - 微信：导出到 `releases/wechat-minigame-test` 后运行
   - 国际版语言测试

4. 上面列出的验收工具文件，`git diff` 必须为空。

## 6. 交付

1. 在 `design/star-salvage/v0611/DELIVERY.md` 追加"返修"一节，写清：
   - 最终 `onboarding` 数值，以及调参理由；
   - 两个脚本在 v0.6.10、`cc2812c` 和返修后三个版本上的对比；
   - 各项测试命令及结果；
   - 未验证事项。
2. 更新 `design/star-salvage/v0611/after/` 下的截图，补上 20 秒和 30 秒的画面。
3. 提交按阶段拆分：`test:` → `feat:` → `docs:`。推送后在 PR #3 回复两个脚本的完整输出和测试结果。

## 7. 不在本轮范围

- 商店页、进化预览、新武器、新敌人、新 Boss、排行榜、成就、分享、任何联网功能。
- 打包、上传 TapTap 或 APK，提审或发布。
- 恢复 `releases/wechat-minigame`。这个目录由用户自己决定从哪个送审版本重新导出。
