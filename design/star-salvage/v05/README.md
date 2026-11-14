# 星海拾荒 v0.5｜当前唯一开发入口（2026-11-11）

> **当前开发自测为0.5.0 /842dc6a /TapTap465523，待用户与真机验收。** 0.4.2 /94e606f /458870保留回退。运行权威为经过测试的 `ship-holds-approved.json` 与 `BALANCE_V05.json`。历史候选继续保留其草案身份。

## 当前用户确认的产品方向

轻量化太空拾荒小游戏，**“探索奇遇→拼装货物→返港交易→升级飞船”**。保持已认可像素港口HOME、四个悬浮入口、现有三种普通委托、四款飞船和全部既有权益。

本轮新增并一起验收：
1. 12个短奇遇+6个轻彩蛋，重点改变首两站总是重复的抽取模式。
2. **B＋C组合已批准**：四艘船使用连续主舱＋固定侧边/尾部扩舱，实际有效格与现有已购容量一致；Codex可以按权威规格实施与QA，不再等待选型。但旧随手绘制的mask禁止直接拷贝，旧满舱/在途必须无损。
3. 返港可选黑市二级页：普通卖、一次谈价、快速**虚构NPC**拍卖；不做联网和等待时钟。
4. 四件真正有辨识度的原创科幻奇物：回声孵囊、吸舱幼体、折时计量盒、引力折面器。借鉴太空惊悚母题，**不直接使用现有电影角色及其标志性形象**。
5. 港口背景轻量锐度改善作为独立小项，保留当前画风；虫洞返港候选暂不直接改现行费率，留待下一次验证。

## 仅以下资料作为当前计划的阅读顺序

- [当前Codex唯一执行任务](../../../codex/SALVAGE_V05_LIGHT_ENCOUNTERS_TASK.md)
- [12奇遇/6彩蛋与首站去重复](LIGHT_ENCOUNTERS_PLAN.md)
- **[已确认B＋C组合：货舱实现与旧档安全规范](CARGO_BC_APPROVED_SPEC.md)**（当前货舱唯一权威）
- [竞品调研：DREDGE / Backpack Brawl / RE4 的机制](CARGO_REFERENCE_RESEARCH.md)（A/B/C旧选型记录，当前不再等待选择）
- [船形货舱 + 黑市 + 原创电影感奇物（本轮最新补充）](SHIP_HOLDS_MARKET_CURIOS_PLAN.md)
- [轻奇遇候选事件结构](LIGHT_ENCOUNTERS_CANDIDATES.json)
- [四船舱体mask/黑市定价及奇物候选结构](SHIP_HOLDS_MARKET_CANDIDATES.json)
- [彩蛋内部稿：未遇内容不对玩家展示](developer/EASTER_EGGS_INTERNAL.md)

### 历史，不得执行

- `STORY_GATE_ART_PLAN.md` 与 `developer/STORY_EPISODES_DRAFT.md`：旧五章/三章重主线，已标记历史草案。
- `codex/SALVAGE_V05_STORY_GATE_ART_TASK.md`：明确SUPERSEDED；**不得复活章节开发或直接实施8油虫洞**。
- 当前真实自测的工程和美术凭证请看 [0.4.2交付](../v042/DELIVERY.md)，不要把文档计划当作新版本通过。

## 必须先完成的硬门槛

先在隔离QA档把四船异形装箱+旧档安全迁移和黑市售货原子性做对，再用固定种子多趟对照0.4.2经济/事件重复率；用户真实存档不能清档、重新计价、擅换船。保持现有可玩0.4.2用于回退。新TapTap开发自测与Mac同入口更新只可在本轮冻结包和证据全部核验后执行；不能声称真机触控、锁屏或剧情趣味已通过。

本轮源码、原生/分层像素资产、固定ZIP、双引擎证据与平台回执已分别绑定。详见 [开发自测交付](DELIVERY.md)、[实施记录](IMPLEMENTATION.md)、[经济验证](BALANCE_VALIDATION.md)、[内部画面复核](VISUAL_REVIEW.md)。PR继续Draft。
