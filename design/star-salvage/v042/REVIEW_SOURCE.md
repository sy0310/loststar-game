# PR #2 · 0.4.2 返修依据

原 Review：https://github.com/sy0310/loststar-game/pull/2#pullrequestreview-5835133388

用户本轮已授权依该 Review 修改。以下原文保留，不将建议或待真机项伪称已复现缺陷。

## 0.4.1 交付复核｜工程记录确认、视觉及真实手机仍待用户验收（COMMENT）

基线：运行源码 `754113a`，交付 HEAD `cde948f`，TapTap 开发自测 `458136`。已读取 `design/star-salvage/v041/DELIVERY.md`、`VISUAL_REVIEW.md`、`BALANCE_V041.json`，以及当前源代码；直接查看了 GitHub 保存的 [真实Mac升级页](https://github.com/sy0310/loststar-game/blob/cde948f/artifacts/salvage-ship-v041/delivery/mac-fleet.jpg)、[HOME](https://github.com/sy0310/loststar-game/blob/cde948f/artifacts/salvage-ship-v041/developer/capture/home-390.png)、[升级QA对照](https://github.com/sy0310/loststar-game/blob/cde948f/artifacts/salvage-ship-v041/developer/comparison/after-fleet.png)、[实际拼图货舱](https://github.com/sy0310/loststar-game/blob/cde948f/artifacts/salvage-ship-v041/developer/comparison/after-cargo.png)。

**确认可保留**：原港口构图及四个浮动入口保持；基础船油箱/耐久/货舱升级在当前船卡首屏可见；新载货形状确实是连续整件（包括L/长条），不是每格复制一个小图标；事件正文与小图标的实现已接入。模型126项、浏览器108项、真实本机存档schema5→6完整UI导出前后和两轮CI记录均有交付依据；本次为复核仓库既有证据，**不是我重新运行全部测试**。最新HEAD对应 PR 工作流查询显示 success。PR继续Draft。

**建议下一轮手机交互核对的3处，不把推测写作已复现BUG：**

1. **升级按钮可操作态**：真实Mac原档零件454，油箱升级300、耐久升级350可以购买，扩容600不可；但截图中三张卡按钮均为近似深灰样式，能点/不能点的视觉差异偏弱。建议真机对比并使可购CTA明确高亮，禁用态清晰区分，保留真实价格和二次确认。
2. **飞船页长度/分组**：当前船的3张升级卡在顶部是正确方向，下方“更换/购买飞船”仍为纵向长列表；请在390和360手机上看升级之后是否需要频繁滚屏。优先保留当前船首屏、其余船型二级区，不为了压屏牺牲价格/属性可读性。
3. **同形不同物**：`src/cargo-art.js` 目前对单格按 `itemId` 找图，但多数多格货按 `shapeId` 找 `cargo_<shapeId>@2x.png`，即不同货名只要占格形状相同便共用一张外观。**这不破坏“物件轮廓与几何占格一致”，但还不等于“每种货物有可识别的具体外观”。** 请把“是否影响物品辨识和收集惊喜”列为玩家视觉验收；若用户觉得单调，可在相同mask中做按itemId区分的多套皮肤，仍保持整数像素和旋转一致，不要退回格内重复箱子。

**待最终验收**：真实TapTap WebView触控/安全区、锁屏恢复、长时间发热、15项新增图标/实体素材的美观和“想不想再玩一趟”的趣味。现阶段不合并、不提审、不发布、不清档；这条Review不表示用户视觉通过。
