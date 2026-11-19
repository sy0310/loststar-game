# v0.6.11 首分钟基线

v0.6.11 改动前的对照数据，供 Codex 实现后对比，也供之后验收。

- **采集日期**：2026-11-19。
- **代码**：`1a9ca1a` 的 `prototypes/salvage-survivor-demo`，用 `serve.cjs` 在本机提供。它和线上 TapTap 包 480638（`ea26e29`）只差三处兼容修复。
- **环境**：桌面 Chromium 无头模式，390×844，DPR 2，开启触控，全新存档，真实时间。**不是手机实测。**
- **命令**：

  ```bash
  node prototypes/salvage-survivor-demo/serve.cjs --port 4472
  SURVIVOR_URL=http://127.0.0.1:4472/ \
    node prototypes/salvage-survivor-demo/tests/first-minute.cjs
  ```

## 结果（3 局中位数）

| 指标 | wanderer（新手式乱走） | dodger（熟练躲避） | 目标 |
|---|---|---|---|
| 第一次升级 | 31.1 秒 | 2 局在 180 秒内没升级，1 局 67.8 秒 | ≤ 8 秒 / ≤ 15 秒 |
| 60 秒时等级 | 已被击毁 | 1 级 | 5–8 级 / ≥ 4 级 |
| 180 秒时等级 | — | 1 级 | — / ≥ 7 级 |
| 存活 | 44.8 秒 | 180 秒 | ≥ 90 秒 / 180 秒 |
| 10 秒时场上敌机 | 3 | 3 | ≥ 6 / — |
| 20 秒累计击落 | 13 | 13 | ≥ 15 / — |
| 首局带回零件 | 16（最便宜升级 400） | 63 | 够买一项 / — |

首页和启动检查：

| 检查 | 结果 |
|---|---|
| 首页没有"开发自测" | 不通过 |
| 标题含"星海突进" | 不通过，显示"星海生存" |
| 首页没有提交哈希 | 源码显示 `develop`，通过；线上包显示 `ea26e29` |
| 禁用 IndexedDB 仍能开局 | 不通过，底部只显示 `Cannot read properties of undefined (reading 'open')` |
| 素材首次加载失败后能"重新加载" | 不通过，只显示 `The source image cannot be decoded.` 和"重试保存" |

验收脚本共报告 13 项不达标。

## 文件

| 文件 | 内容 |
|---|---|
| `summary.json` | 验收脚本完整输出，含每局升级时间、里程碑和结算 |
| `home.png` | 首页 |
| `wanderer-10s.png`、`wanderer-30s.png` | 新手式乱走第 10、30 秒 |
| `wanderer-first-upgrade.png` | 第一次升级卡面 |
| `wanderer-end.png` | 被击毁后的结果页 |
| `dodger-60s.png`、`dodger-end.png` | 熟练躲避第 60 秒仍是 1 级，以及 180 秒时的画面 |
| `startup-no-storage.png` | 禁用 IndexedDB 时的首页 |
| `startup-image-failure.png` | 素材首次加载失败时的首页 |
| `live-ea26e29-first-minutes.jpg` | 早先用临时脚本对线上包做的探索性试玩拼图。口径和 `summary.json` 不同，只作直观参考 |
