# 当前0.4：静态像素港口（开发自测待审）

[直接试玩](http://127.0.0.1:4283/loststar-salvage/) · TapTap457635 · 运行ba90efb。四入口货舱/商店/飞船/任务，一键补满、真实购船换装/扩容、主动接委托，原存档迁移保留。[实际交付与二维码](../../design/star-salvage/v04/DELIVERY.md)。无正式发布；下述0.3/0.2为历史基线。

# 失物号：星海拾荒 · 开发自测

独立的航线拾荒 Demo，继续 Draft PR #2。首次建立档案，之后刷新、关页重开和下一趟都会延续。旧版游戏和首章存档保持隔离。

基础操作：**选航点，处理现场，把收获带回港口；卖货、补给和还款由你决定。** 无强制等待、广告、真实支付或离线罚款。

## 0.3.0：手机轻交互与小件货舱

- 常见新货物占1～3小格；普通货舱仍4×4，测绘记录箱改为独立任务槽。原旧货仍保留4/8/12/16格包装与所有权益。
- 货舱的棋盘、横向托盘和固定确认按钮集中显示；短屏或大字只滚内部内容。点已摆货物直接选中，点空格放置，旋转/拖动仍需确认保存。
- 可直接装下的收获先用紧凑确认，不强制翻完整编辑页；冲突时手动取舍。取消与失败不扣资源、不重抽。
- 结果直接去真实航路，归航先看售货/下一趟，详细账本可展开。重复补给保留当前位置。
- 同一存档原子升级至schema4；旧档、工具、余额和已完成结算保留，正式星球与首章存档不接触。

当前 **TapTap开发自测454472 · 0.3.0 · 799a36e**。Mac同入口 [直接试玩](http://127.0.0.1:4283/loststar-salvage/)，该地址只在这台Mac可用；手机请扫[新自测二维码](../../artifacts/salvage-mobile-v03/delivery/taptap-454472.png)。[实际交付与待测](../../design/star-salvage/MOBILE_V03_DELIVERY.md)。

## 历史0.2.0：货舱、航路与图标

- 货舱为可旋转、拖放和点选摆放的 4×4 拼装网格。原 1 格货物对应 4 小格，容量没有额外扩张；面积够也可能因形状无法放下。辅助整理只生成可检查的排布，仍需自己确认。
- 拾取货物先进入装载草稿；确认时才一次结算代价、风险和货物。取消、刷新或未放好的货物不会额外扣费；需要替换旧货时会明确显示放弃清单。
- 底栏仍为四项：航行、航路、货舱、航记。航路页显示实际经过的位置、当前船位、下一站候选及直接返港线；选择候选先看费用，再确认启航。
- 燃料、耐久、零件、货物、事件类型、行动代价和结果使用统一 SVG 图标，并保留文字和数值。
- 旧 schema 2 存档会先原样备份，再在同一事务内迁移到 schema 3；继续使用原 IndexedDB 库名，不换入口或清空档案。

历史0.2包和测试绑定见 [0.2交付记录](../../design/star-salvage/UPGRADE_DELIVERY.md)。历史 TapTap 开发版本号不代表已上传本轮更新，以该记录的实际平台回读为准。

## 本机运行

```sh
npm --prefix prototypes/salvage-route-demo test
npm --prefix prototypes/salvage-route-demo run build
npm --prefix prototypes/salvage-route-demo run preview
```

在运行服务器的电脑打开 <http://127.0.0.1:4281/loststar-salvage/>。这是本机 HTTP 入口，不是手机可访问的公网地址。手机使用交付时的 TapTap 开发自测二维码。不要通过下载 HTML 或 `file://` 测试存档。

存档在浏览器的独立 IndexedDB `lostcargo.route-demo.v1`，库名不随版本变化。设置支持导出、确认导入和存储重试。不同浏览器、网站来源或 TapTap 宿主不会自动共享本地档案，换入口前先导出。存储不可用时页面只读，原档不会自动清空。旧版同名 LocalStorage 仅在首次迁移本 Demo 时检查，原字节留存。

## 开发检查（含剧透，不是试玩前必读）

- [任务与参数](../../design/star-salvage/DEMO_CODEX_HANDOFF.md)
- [开发验证与当前交付](../../design/star-salvage/DEVELOPMENT_VERIFICATION.md)
- [素材来源](../../design/star-salvage/SOURCE_STATUS.json)

```sh
npm --prefix prototypes/salvage-route-demo run simulate
node prototypes/salvage-route-demo/tests/mobile-economy.cjs
npx playwright test --config prototypes/salvage-route-demo/playwright.config.cjs
# 已交付这台Mac上的隔离截图/性能对照（脚本会核对实际版本）：
node prototypes/salvage-route-demo/tests/capture-mobile-layout.cjs
node prototypes/salvage-route-demo/tests/mobile-compatibility.cjs
SALVAGE_BASELINE_URL=http://127.0.0.1:4287/loststar-salvage/ SALVAGE_URL=http://127.0.0.1:4283/loststar-salvage/ node prototypes/salvage-route-demo/tests/mobile-performance.cjs
# 先提交运行源码，再冻结将上传的同一个 ZIP：
python3 prototypes/salvage-route-demo/build.py --freeze
python3 prototypes/salvage-route-demo/verify_package.py releases/salvage-fixed
# 对解包目录启动 HTTP，以 SALVAGE_URL 指向真实 URL 后重跑浏览器用例
```

本轮复用仓库原创飞船像素图和空间后备画面。两张概念原 PNG 与三张概念裁片仍缺失；不表示美术最终验收。真机、TapTap WebView、锁屏、下载/导入文件宿主能力和趣味仍需用户实测。开发自测不绑定主包、不提审、不发布。

素材完整性校验（仅开发依赖，不进入H5包）：`python3 -m pip install -r prototypes/salvage-route-demo/tests/requirements-port-art.txt` 后运行 `npm --prefix prototypes/salvage-route-demo run check:art`。
