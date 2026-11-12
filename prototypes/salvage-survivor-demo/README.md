# 《失物号：星海生存》v0.6.5

一指移动，武器自动攻击。拾取晶体，三选一强化，尝试在十五分钟内形成进化武装。

TapTap开发自测474895，固定运行a44c635。本目录承接 cd9559b 原型。主循环、原创像素素材、战斗与独立持久存储在同一个 HTTP 入口运行。4397 独立试玩与4283存档分离。本轮采用[武装体量与敌舰辨识](../../design/star-salvage/v065/README.md)，实际固定包与验证在[本轮交付](../../design/star-salvage/v065/DELIVERY.md)分别登记，先前474770、474099及470518固定交付保留。

## 本机运行

```bash
node prototypes/salvage-survivor-demo/serve.cjs --port 4397
```

打开 <http://127.0.0.1:4397/>。手机按住画面拖动，电脑用 WASD 或方向键。P、Esc、暂停按钮可暂停。升级选项、失焦和后台会停止战斗计时并释放输入。

首次建立独立 IndexedDB `loststar.survivor.demo.v06`。局中约每2秒、暂停和升级时提交快照。继续上局恢复同一世界、敌人、掉落、随机状态与三选一卡片。崩溃可能损失最近一个尚未提交的检查点。结算与强化使用同一事务，跨窗口通过版本号防重复扣发。

只迁移本原型的旧 `loststar.survivor.prototype.v01` 强化档，保留原始备份。旧星球、剧情、航路的数据库与备份均独立保留。新版尚未将旧欠款、四船或货舱权益折算为新数值，旧玩法保留原包回退。

## 可重复验证

先在仓库根目录 `npm ci` 并安装 Playwright 的 Chromium、WebKit。两种引擎缺失时检查失败。

```bash
npm --prefix prototypes/salvage-survivor-demo test
npm --prefix prototypes/salvage-survivor-demo run check:art
python3 prototypes/salvage-survivor-demo/sync_runtime.py --check
npm --prefix prototypes/salvage-survivor-demo run simulate
SURVIVOR_URL=http://127.0.0.1:4397/ npm --prefix prototypes/salvage-survivor-demo run test:browser
```

- 模型测试覆盖旧3＋2存档战斗回归、八种5＋5进化、四种终极融合、低阶联动、八增强实际效果、随机奖励与实体上限。
- HTTP浏览器测试覆盖 Chromium/WebKit × 360×800/390×844、输入、伤害、卡片、存储事务、刷新、故障恢复、跨窗口与旧命名空间隔离。
- 模拟使用160条固定种子策略，报告独立试玩经济与偏差。自然连续录像仅通过键盘和实际可见卡片操作，单独记录。
- `?qa=1` 仅用于明确标注的开发靶场，使用 `.qa` 独立数据库。普通入口无 QA 操作对象。
- `qa_survivor.py` 兼容入口会建立真实HTTP服务并运行两种浏览器，不再注入HTML或跳过缺失引擎。

## 素材与构建

原生 PNG、可编辑 ORA、原始生成图与提示分别保存在 `design/star-salvage/v06/production`、`v061/production`、`v062/production`与`v064/production`。原50项图像及新增5敌机／1银河背板加两型精英与独立折射水晶共59项全部保留，v065新增9项，共68项，使用共同紫灰、暖金、冰蓝像素语言。仓库保留1×/2×/4×，运行包只带2×。

用户已授权按 PR 文字美化飞船、生存画面和武器。缺失的三手机概念板没有被假称入库。新增素材仍待用户视觉审核。

```bash
python3 prototypes/salvage-survivor-demo/build.py --freeze
python3 prototypes/salvage-survivor-demo/verify_package.py releases/survivor-extracted
```

冻结要求相关源码与素材已提交。ZIP内78文件、68 PNG、2首用户提供音乐，校验绑定运行源码SHA、精确文件表和每个文件摘要。原50项图像与新增5敌机／1银河背板、1×/4×和原始生成图保留在仓库，H5包完全本地依赖。

用户已反馈470518方向大体认可。本轮武器和辅助上限各5级，精英／Boss击退后直接升一级，合格进化／融合有75%概率进入三选一。普通武器组合有实际联动，四条终极融合要求两件已进化武器。旧180秒／4+3与既有600秒／6+6在途局继续原规则，新局使用progressionVersion2。

新增 `tests/upgrade-save.cjs` 从已提交470518与474099原ZIP启动真实HTTP，保留27049及满永久强化、旧进化／融合，在同一隔离HTTP源替换新版，分别检查两种旧成长规则、整个原记录和新版900秒下一局。实际Safari、物理手机、锁屏、帧率和用户趣味分别登记，PR #2保持Draft。

## v0.6.4规则与回归

新局使用900秒与战斗版本3。普通敌机恢复2倍原生体量，两位来访者为3倍。普通蜂机和导弹记录发射时位置并直飞，合法5＋5进化后获得追踪。棱镜由独立晶体环绕发射，折射有真实二次命中。蓝／金／紫雷电对应成长阶段，三精英与后段守卫具有不同实际攻击。

旧180／600秒对局继续原规则与完整权益。原4ca726f与f9bf85c包在同源隔离HTTP中分别迁移，四条引擎／版本路径验证完整旧记录和27049零件。模型覆盖70组，浏览器覆盖两引擎两尺寸与普通／TapTap实包。真实手机与趣味等待用户复审。

## v0.6.5

新局规则4，内外武装轨道分离、进化主体放大，独立星舰壁垒和新5精英／4Boss攻击。旧规则2／3继续其原快照。新增9项正式像素资源位于v065/production，原生、ORA、2×／4×与提示完整。80模型、560固定包HTTP、6旧ZIP迁移、普通900秒与QA27分别记录，手机和用户视觉待审。
