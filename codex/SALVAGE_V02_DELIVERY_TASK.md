# 给本机 Codex：交付已验证的星海拾荒 0.2.0

## 本次要完成什么

用户已确认本轮流程：**把更新传到 Repo，交本机 Codex 继续上传 TapTap 开发自测，并替换本机试玩。**

现在功能实现已完成。继续同一个 `sy0310/loststar-game` 仓库、`codex/v0.1-vertical-slice` 分支和 Draft PR #2，执行本文件的交付步骤。不要重新实现货舱/地图，也不要因旧总指令重新启动主星球或全面美术开发。本任务针对 `prototypes/salvage-route-demo/` 的独立航线 Demo。

本文件是接续任务，**不代表 TapTap 或用户 Mac 已更新**。编写时实际读回的仍是 TapTap 453037 / 本机 b317c8a。本次聊天的浏览器下载权限步骤未获授权，因此改由用户指定的本机 Codex 从 Repo 取得包并完成交付；不可把旧号码重写成新包成功证据。

## 唯一要交付的包

| 项目 | 固定值 |
|---|---|
| 运行源码 | `b26455ada31fe1ab780905cdb1c26f1387c082bb` |
| 文件 | `artifacts/salvage-route-upgrade/loststar-salvage-b26455a.zip` |
| 字节数 | `79992` |
| 文件数 | `13` |
| SHA256 | `7a612f63aae18beea7aa3e9e4a8edee68e1cee439e9868cb8cfad55f0c2375f7` |
| ZIP 内入口 | `loststar-salvage/index.html` |
| 页面版本 | `0.2.0 · b26455a` |
| 存档库 | `lostcargo.route-demo.v1`，schema2安全迁移到schema3 |
| 待替换本机地址 | `http://127.0.0.1:4283/loststar-salvage/` |

必须使用上面的已冻结 ZIP。最新仓库提交还包含文档、测试及证据，不应重新构建后拿另一个 ZIP 冒充这份验证结果。若确实修了运行代码，需要重新提交、冻结、验证并更新所有包绑定。

先读 `AGENTS.md`、`design/star-salvage/UPGRADE_DELIVERY.md` 和 `artifacts/salvage-route-upgrade/verification.json`。功能约束见 `design/star-salvage/CARGO_GRID_ROUTE_MAP_ICON_HANDOFF.md`；开发证据可能含剧透，不向用户展示隐藏事件/最优路线。

## 1. 拉取、核验，保留现有工作

先检查当前目录、分支和未提交改动。已有仓库使用 `git fetch origin`，在安全的工作树中检出远端最新 `codex/v0.1-vertical-slice`。不要 `reset --hard`、强推或覆盖用户文件；当前工作树有其他任务时使用独立 worktree。核实远端包含上述运行提交及本任务文件。

在检出目录用系统 Python 校验并解包。下面只会新建独立目录，目录已存在时先人工检查，不自动删除旧目录：

```sh
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile
import hashlib

archive = Path('artifacts/salvage-route-upgrade/loststar-salvage-b26455a.zip')
data = archive.read_bytes()
assert len(data) == 79992, '包大小不符'
assert hashlib.sha256(data).hexdigest() == '7a612f63aae18beea7aa3e9e4a8edee68e1cee439e9868cb8cfad55f0c2375f7', '包摘要不符'
destination = Path('releases/salvage-v02-b26455a').resolve()
assert not destination.exists(), '目标目录已存在，请先核实，不要覆盖'
with ZipFile(archive) as z:
    members = z.infolist()
    assert len(members) == 13
    for item in members:
        target = (destination / item.filename).resolve()
        assert target.is_relative_to(destination), '非法解包路径'
        assert not item.is_dir(), '包结构不符'
    z.extractall(destination)
assert (destination / 'loststar-salvage/index.html').is_file()
print('固定包核验通过，解包目录：', destination)
PY
```

若环境 Python 低于3.9，使用等价的安全路径校验。不要从旧 dist 或不明下载目录选择同名前缀文件。

## 2. 上传 TapTap 开发自测并回读

目标：遇亭工作室 / 失物星球，游戏ID `1022667`；已观察到的包体管理页：

`https://developer.taptap.cn/v3/512759/app/1022667/store/packages`

优先使用本机已有、已授权的官方 TapTap 工具或登录会话。若使用浏览器，遵循其文件选择和权限流程，不提取会话凭证、不绕过审批。用户已要求本轮开发自测更新；如遇验证码、重新登录或必须签署的新条款，保留可继续的现场并说明具体阻碍。

- 新上传上述原样 ZIP，使用竖屏，最低支持库沿用旧包 `2.4.0`；不要改全局 H5 基础配置或其他游戏设置。
- 上传完成后读回**新的版本ID**、原始文件名、文件大小/显示大小、屏幕方向和更新时间；保存回执与截图。若平台只显示舍入大小，明确记录显示值，不能声称核验了平台未提供的精确字节/摘要。
- 打开该版本的“自测”，保留可用二维码或平台实际提供的测试链接。验证打开的是新包。平台没有提供远端ZIP哈希时，不写“远端哈希相同”。
- 不绑定正式主包、不提交审核、不正式发布，不修改旧游戏资料或删除历史包。
- 453037是历史旧包，保留它；新号未知前不得填写伪造的号码。

## 3. 替换用户 Mac 的同一 HTTP 试玩入口

要在**用户 Mac**完成这一步，不是另一个容器的127.0.0.1。确认已有 `4283` 监听进程和真实服务目录后再操作，例如先用 `lsof -nP -iTCP:4283 -sTCP:LISTEN` 和该PID的启动命令查明归属。若端口属于其他任务，不终止它，先报告冲突。

1. 保留旧服务目录作为回退；记录启动方式。如果原试玩有存档，先用游戏“规则/存档”导出原档，并保留旧文件，不清理浏览器数据。
2. 将服务切换到上面安全解包的父目录 `releases/salvage-v02-b26455a`。沿用主机 `127.0.0.1`、端口 `4283` 和路径 `/loststar-salvage/`，这样原浏览器来源不变。
3. 只停止已确认属于本 Demo 的旧服务进程，按原长期运行方式启动新服务；不要宽泛 `pkill` 所有 Python/Node 进程。等价的前台启动命令如下，实际执行时使用能在任务结束后继续运行的方式并保留日志：

```sh
python3 -m http.server 4283 --bind 127.0.0.1 --directory releases/salvage-v02-b26455a
```

4. `curl --fail http://127.0.0.1:4283/loststar-salvage/` 确认HTTP可达。在用户原先试玩的同一浏览器/应用内页面刷新，实际看到页脚 `0.2.0 · b26455a`。
5. 检查已有余额、债务、燃料、耐久、货物与当前航点延续；schema2迁移保留原始封装备份。不能通过新浏览器的新档来假装验证了原档续玩。也不能为了截图替玩家出航、消费、卖货或重开档。

切换来源或浏览器不会自动共享 IndexedDB。如果原页面在另一个浏览器/应用内，回到那个页面核验；需要跨来源转档时走明确的导出/确认导入流程。

## 4. 核验用户能看到的变化

在隔离测试档中检查，再回到用户原档入口：

- 货舱4×4：至少两种形状；点选→旋转→点格放置和拖动均有效，确认排布后刷新仍保留；正常自己保存不误报外部更新。
- 航路独立页：港口、已走线、船位、两个下一站候选和返航线；点候选不扣油，确认才启航。
- 燃料、耐久、零件、货舱以及事件/行动/结果都有同一套SVG图标和文字；手机尺寸无横向溢出。
- 原档继续、同来源重开、存储报错时原档保护。浏览器模拟不替代物理手机锁屏、系统文件面板、发热与趣味验收。

本包已有24场景×2引擎×2尺寸共96次HTTP检查、70项模型检查、600次脚本安全航行，以及同包自然两趟和独立QA操作录像。先核对现有证据；没有代码变更时不必为交付再次大范围重跑无关旧游戏测试。部署后针对真实入口做上面的检查即可。若门禁有实际失败，说明并修复，不改成跳过。

## 5. 回写同一 Repo 与最终回复

将平台回执、新版本ID、自测入口/二维码、用户Mac真实服务目录/入口与观察版本、旧档迁移结果及必要截图写入 `artifacts/salvage-route-upgrade/`。不要把账号凭证或私人存档提交到公开仓库。

更新 `verification.json` 的 platform/localDelivery 状态、`design/star-salvage/UPGRADE_DELIVERY.md`、`acceptance.salvageUpgradeDelivery` 和对应 `SALVAGE2-DELIVERY` 行，再运行 `node scripts/render_execution_coverage.mjs --write` / `--check`。如实保留手机/素材/趣味待验项，保留旧208项和本轮12项，不另造平行完成表。

提交并推送到原工作分支，更新 Draft PR #2（不合并）。最终给用户：可点击的本机试玩入口、新TapTap自测版本/二维码、运行源码b26455a、交付证据提交、实际验证结果与未测项。只有观察到新页面和平台回读后，才写“试玩已更新”。
