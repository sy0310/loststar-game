# UI参考适配 · 统一主题与整图轻整理（待审）

执行最新[Review任务书](../../design/v045_a_simplified_exploration/TIANDAO_UI_REFERENCE_ADAPTATION.md)，当前只交内存隔离样板；全可达入口统一，不覆盖正式444057/06cb11f玩家包，不读写正式IDB。

```sh
npx vite --config prototypes/ref-ui/vite.config.ts --port 4261
npx tsc --noEmit -p prototypes/ref-ui/tsconfig.json
npx playwright test --config prototypes/ref-ui/playwright.config.ts
python3 scripts/package_ref_ui.py
# 固定源码后，从ZIP解压目录启动服务再采集
python3 -m http.server 4262 --bind 127.0.0.1 --directory releases/ref-ui-static
node scripts/capture_ref_ui_unified.mjs
```

唯一候选`?profile=fresh`；不再提供旧浅色look皮肤。`owned`普通模型赚取/购买的已购档；`restoration`原模型赚到足够六物整理的零件；`facilities`原模型赚钱并购买三种可选设施；`return`真实普通模型离线20分钟；`night/repeat-night/morning`预走283/583/302秒；`conclusion`真实完成纸路和三个原有研究。夹具只在开场前构造，录像均自然时钟。`__REFUI_INITIAL__`只供内存测试注入，不导入玩家源档。

`theme.css`为唯一八色token；公共组件用于全部导航、短卡、详情、设施、设置与失败/处理中。Vite仅在样板内把旧Fusion CSS去皮肤后放入legacy层，保留布局；不叠!important，也不改历史审核页。正式融合时把这套组件归回原UI，不长期并行维护两套。

六物详情`light-treatment.ts`读原18完整图：真实发现直接A，点击按原费用/时长处理，前图保持静止，原模型提交后换B/C，显示各自短句和一次550ms落稳。关闭/后台完成不重播，减少动态直接换图。未来态预览只读；图片失败禁扣款并可显式重试。C后保留原代表免费互动，铃按压触底/回弹和胶带机构继续。旧原生科研预览使用`simple-material.ts`适配安静整图，不能漏回旧土盘/刷洗。

`receipt-compat.ts`对真实拥有且仍buried的收据调用原免费取出开始/完成一次，免除旧免费6.2秒等待，记录actionId/豁免秒数/前后余额。无新发现、奖励、证据、能力、款项或时钟推进；原付费进行中任务完全保留。此适配仅内存样板，不执行正式存档迁移。

原`src`、全部美术、业务/存档模块保持原字节。内存controller不导入store，不打开IDB、不写偏好；刷新只重建示例，绝不是玩家存档行为。旧448028/sample.3已被Review退修，历史媒体保留，不沿用其成绩。

[本轮固定包审核页](../../artifacts/ref-ui-unified/index.html)。正式集成/用户视觉/真机仍待确认；真机刘海宿主/触控/锁屏/声音/长期发热未测。继续Draft，不合并、不正式发布、不开发第二星球。
