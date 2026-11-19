# v0.6.11 验收证据

Claude 对 Codex 两轮实现的验收记录。所有结果都来自桌面无头浏览器或模型模拟，不代表手机实测或真人手感。

## 第二轮：返修 `bf01f6e`

2026-11-19 复核。结论：**通过，可以进入真机试玩。**

| 文件 | 内容 |
|---|---|
| `first-minute-v2-bf01f6e-claude-rerun.json` | 目标 v2 独立复跑，`failures none`。乱走 4.4 秒首次升级，60 秒时 5 级，存活 130 秒；躲避 60 秒时 6 级 |
| `full-run-bf01f6e-claude-rerun.json` | 整局护栏独立复跑，`failures none`。新手通关率 13.3%，存活中位数 454 秒，5 分钟时 13 级；老玩家通关率 76.7% |
| `first-minute-v2-v0610.json` | Codex 提交的 v0.6.10 在目标 v2 下的结果，作为对照 |

另外核对过的项目：

- 四个验收工具与评审提交 `061eaae` 完全相同。
- 旧存档兼容：种子 413、7、91 各跑 200 秒，期间自动选卡，经过 70 秒精英和 130 秒 Boss。改动前的代码与新代码调用 `legacyV0610()` 后的 40 个采样点全部一致。
- 模型测试 121 + 6 项、浏览器测试 224 项（含 combat，Chromium 和 WebKit × 360 和 390）、微信适配测试（独立测试包 `releases/wechat-minigame-test`）全部通过。`releases/wechat-minigame` 本轮没有被改动。
- CI：push 那次 5 项全部通过；pull_request 那次只有 "Salvage route" 失败在安装浏览器这一步，与代码无关。

## 第一轮：`cc2812c`

2026-11-19 验收。结论：实现符合原任务书，但整局平衡被打穿，需要按 `codex/SALVAGE_V0611_REWORK_TASK.md` 返修。

### 文件

| 文件 | 内容 |
|---|---|
| `first-minute-v1-cc2812c-claude-rerun.json` | 用原版首分钟脚本（目标 v1）独立复跑 `cc2812c`，`failures none` |
| `first-minute-v2-cc2812c.json` | 用目标 v2 跑 `cc2812c`，5 项不达标 |
| `full-run-v0610.json` | 整局护栏评估 v0.6.10（`1a9ca1a` 源码），新手通关率 0% |
| `full-run-cc2812c.json` | 整局护栏评估 `cc2812c`，新手通关率 96.7% |

整局评估的输入来自 `tests/simulate.cjs`：躲避型移动（`SURVIVOR_MOVEMENT=adaptive`），5 种选卡策略，每种 6 个种子，永久强化分 0 档和 3 档，每组 30 局。模型使用固定种子，结果可复现；原始报告较大（0.8 MB 和 2.9 MB），没有提交，可用下面的命令重新生成：

```bash
SURVIVOR_MOVEMENT=adaptive SURVIVOR_SEEDS=6 \
  SURVIVOR_SIM_OUT=releases/full-run/<name>/simulation.json \
  node prototypes/salvage-survivor-demo/tests/simulate.cjs
FULL_RUN_REPORT=releases/full-run/<name>/simulation.json \
  node prototypes/salvage-survivor-demo/tests/full-run-guardrails.cjs
```

### 另外核对过的项目

- 旧存档兼容：用改动前的代码对种子 7、91、413、2026 各跑 60 秒，与新代码调用 `legacyV0610()` 后的结果逐帧一致，包括随机数序列。
- 模型测试 121 + 5 项、改动相关的浏览器测试 152 项（Chromium 和 WebKit × 360 和 390）、微信适配测试，全部通过。
- 验收脚本、避险算法和历史证据都没有被修改；代码里没有联网或埋点调用。
- 当时 CI 的失败全部发生在 `npx playwright install --with-deps chromium webkit` 这一步，超过 5 分钟被终止，没有执行任何测试，与代码无关。
