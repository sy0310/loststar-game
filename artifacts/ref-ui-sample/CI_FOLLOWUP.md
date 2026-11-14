# CI时钟回归补正（不重打样板包）

源码72374bc的Push CI42388980543已实际通过416单测/五构建/578生产流程/6实包，以及独立样板40项。其PR CI42388988635 attempt1有一个旧生产测试失败：`mobile-360 / execution-entrypoints.spec.ts`的stabilized收藏整图场景，实际577通过/1失败/0重试，后续实包步骤因此跳过；没有把该次改标通过或重跑洗掉历史。

[原失败run](https://github.com/sy0310/loststar-game/actions/runs/42388988635) · [原browser-evidence附件13581477622](https://github.com/sy0310/loststar-game/actions/runs/42388988635/artifacts/13581477622)。实际查看原PNG/trace：已在基地，museum ready=true但frame固定1、curioStates为空，18份完整WebP实际网络请求均200。测试使用pauseAt暂停时钟，切tab后只有现实时间expect.poll，没有推进虚拟rAF；素材解码结束后仍停在前一个首帧。不是以同源码另一条成功代替此失败。

只修`tests/e2e/execution-entrypoints.spec.ts`：在读实际canvas状态的poll中推进50ms测试时钟，使布局/解码后的真实绘制发生。六件物品三态的精确断言、默认5秒断言时限、60秒用例上限和零重试均保持。不直接填dataset，不跳过断言，不改游戏renderer、存档、经济或素材。

受影响A/B/C×四上下文的本地预检12项通过（25.2秒），原JSON和日志在[checks](checks/museum-clock-regression.json)。这是测试补正后的局部预检，不冒称新一轮578全套。后续完整Push/PR结果以当前[PR Checks](https://github.com/sy0310/loststar-game/pull/2/checks)及PR说明的终态链接为准。

测试补正不改变src、素材、prototypes/ref-ui、运行配置或依赖；固定样板仍是72374bc / ZIP87c99d80 / TapTap448028。没有重建、替换或重传包，没有刷新媒体冒充新视觉审核。用户三屏视觉和真实手机仍待确认。
