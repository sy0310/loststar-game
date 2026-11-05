#!/usr/bin/env python3
"""Build the renewal review gallery from saved evidence; never synthesize media or touch saves.

Missing/partially-written reports are listed as pending. Only files present on disk are
embedded. SHA mismatches remain visible warnings rather than masquerading as current evidence.
"""
from pathlib import Path
from html import escape
import json
import hashlib
import re
import struct
import subprocess
import argparse

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts' / 'visual-renewal', help='Evidence directory; defaults to the current renewal candidate')
OUT = parser.parse_args().output.resolve()
try:
    OUT.relative_to(ROOT)
except ValueError:
    parser.error('Evidence directory must be within this repository')
OUT.mkdir(parents=True, exist_ok=True)
MODES = ('screens', 'assist', 'treatment', 'pages', 'life', 'cases', 'excavation')
NAMES = {'screens': '三态／星雾／抽屉截图', 'assist': '连续助力', 'treatment': '六件处理与试验', 'pages': '全页面', 'life': '完整昼夜', 'cases': '收藏取放与展柜安装', 'excavation': '收据出土'}
for extra in sorted(OUT.glob('*-evidence.json')):
    mode = extra.name.removesuffix('-evidence.json')
    if mode not in MODES:
        MODES += (mode,)
        NAMES[mode] = {'fog': '星雾连续揭晓', 'residents': '居民与扩展页面'}.get(mode, mode)
ITEMS = {'receipt': '未购买的退货收据', 'tape': '道歉胶带', 'nested': '无限套娃包裹', 'stamp': '昨日邮戳', 'cosmic-parcel': '收件人：宇宙', 'bell': '无人签收铃'}
STATES = {'found': 'A 发现态', 'clean': 'B 整理态', 'stabilized': 'C 展示完成态'}
issues, pending, used = [], [], set()

def esc(value):
    return escape(str(value), quote=True)

def load(path, label=None):
    if not path.is_file():
        if label:
            pending.append(f'{label}：尚未生成 {path.name}')
        return None
    try:
        result = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(result, dict):
            raise ValueError('expected JSON object')
        return result
    except (OSError, ValueError) as error:
        pending.append(f'{label or path.name}：报告尚未完整写入或不可读（{error}）')
        return None

package = load(OUT / 'package-info.json', '固定包元数据') or {}
source = package.get('sourceCommit', '')
version = package.get('version', '待打包')
reports = {}
for mode in MODES:
    report = load(OUT / f'{mode}-evidence.json', NAMES[mode])
    if report is not None:
        reports[mode] = report
        if source and report.get('sourceCommit') != source:
            issues.append(f'{mode} 证据源码 {report.get("sourceCommit", "缺失")} 与固定包 {source} 不一致；不可作为当前版本通过证据。')
        if report.get('sourceClean') is False:
            issues.append(f'{mode} 记录了未冻结的源码。')
        issues.extend(f'{mode}: {error}' for error in report.get('errors', []))

# Mismatched or dirty reports remain linked as historical diagnostics, but their
# media must never be embedded in the current candidate's runtime evidence.
all_reports = reports
reports = {}
for mode, report in all_reports.items():
    identity_ok = bool(source and report.get('sourceCommit') == source and report.get('sourceClean') is not False)
    zip_ok = not report.get('zipSha256') or report['zipSha256'] == package.get('sha256')
    if identity_ok and zip_ok:
        reports[mode] = report
    else:
        pending.append(f'{NAMES[mode]}：源码／包体身份未对齐，旧媒体已从当前画廊排除')
        if not zip_ok:
            issues.append(f'{mode} ZIP SHA256与固定包不一致。')

# Optional explicit gate can be supplied after a new internal visual review.
review = load(OUT / 'review-status.json') or {}
review_status = review.get('status', 'pending') if review.get('sourceCommit') == source else 'pending'
review_file = ROOT / 'design/visual-renewal/REVIEW_ITERATIONS.md'
if review_file.is_file() and source:
    for heading in re.findall(r'^## .*$', review_file.read_text(encoding='utf-8'), re.M):
        if source[:7] in heading and any(word in heading for word in ('不上传', '未通过', '拒绝')):
            review_status = 'rejected'
if review_status in ('rejected', 'needs_revision'):
    review_banner = '<p class="rejected"><strong>本候选动态审核未通过，不可上传或交付为已完成版本。</strong>本页仅保留该候选的实测诊断，工程测试绿灯不覆盖视觉问题。新候选需要重新冻结源码、采集与审核。</p>'
elif review_status in ('internal_review_passed', 'passed'):
    review_banner = '<p class="note">已登记本源码的内部画面复审结果；最终美术验收及真实手机体验仍由用户审核，不能由此推定手机通过。</p>'
else:
    review_banner = '<p class="pending">本候选的内部视觉审核结果尚未登记。媒体和测试正在逐项核对，不能据此宣布可交付。</p>'

supplemental = {}
for name in ('verification', 'performance', 'package-smoke', 'model-invariants', 'economy', 'taptap-self-test'):
    value = load(OUT / f'{name}.json', name)
    if value is not None:
        supplemental[name] = value
        if source and value.get('sourceCommit') and value['sourceCommit'] != source:
            issues.append(f'{name}.json 源码为 {value["sourceCommit"]}，与固定包不同；该记录保留其原始来源，不能改称本轮新测。')

def local(file):
    """Resolve evidence and repository links, while disallowing arbitrary absolute paths."""
    if not isinstance(file, str) or not file or Path(file).is_absolute() or '://' in file:
        return None
    target = (OUT / file).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return None
    return target if target.is_file() and target.stat().st_size > 0 else None

def wait(label):
    pending.append(label)
    return f'<p class="pending">待补：{esc(label)}</p>'

def figure(file, caption, material=False):
    if not local(file):
        pending.append(f'媒体缺失：{file or caption}')
        return wait(caption)
    used.add(file)
    return f'<figure class="{"material" if material else "page"}"><a href="{esc(file)}"><img loading="lazy" src="{esc(file)}" alt="{esc(caption)}"></a><figcaption>{esc(caption)}</figcaption></figure>'

def valid_movie(item):
    target = local(item.get('file'))
    if not target:
        return False
    with target.open('rb') as handle:
        header = handle.read(12)
    if header[4:8] != b'ftyp':
        return False
    recorded_size = item.get('probe', {}).get('format', {}).get('size')
    try:
        return recorded_size is None or int(recorded_size) == target.stat().st_size
    except (TypeError, ValueError):
        return False

def movie(item, label=None):
    file = item.get('file')
    if not valid_movie(item):
        pending.append(f'连续录像缺失、尚未写完或与probe字节数不符：{file or label}')
        return wait(label or file or '连续录像')
    duration = item.get('durationSeconds')
    caption = label or item.get('caption') or file
    if isinstance(duration, (int, float)):
        caption += f' · {duration:.1f}秒'
    caption += ' · 桌面触控仿真，非真机录像'
    return f'<figure class="movie"><video controls playsinline preload="none" src="{esc(file)}"></video><figcaption>{esc(caption)}</figcaption><a href="{esc(file)}">打开原始MP4</a></figure>'

all_screens = [x for report in reports.values() for x in report.get('screenshots', [])]
all_materials = [x for report in reports.values() for x in report.get('materials', [])]
video_map = {}
for mode, report in reports.items():
    for video in report.get('videos', []):
        if video.get('file'):
            video_map[video['file']] = {**video, '_mode': mode}
all_videos = list(video_map.values())

def find_screen(fragment, mode=None, width=390, engine='chromium'):
    data = reports.get(mode, {}).get('screenshots', []) if mode else all_screens
    return next((x for x in data if x.get('width') == width and x.get('engine') == engine and fragment in x.get('name', '')), None)

def screen_or_wait(item, caption):
    return figure(item['file'], caption) if item else wait(caption)

# Full original files are references, never represented as production screenshots.
reference_manifest = load(ROOT / 'design/visual-renewal/ASSET_MANIFEST.json', '原始PNG清单') or {}
reference_import = load(ROOT / 'design/visual-renewal/IMPORT_VERIFICATION.json', '原图远端回读记录') or {}
reference_rows, reference_previews = [], []
reference_count, reference_remote_count = 0, 0
for entry in reference_manifest.get('files', []):
    name = entry.get('file', '')
    file = '../../design/visual-renewal/approved/' + name
    target = local(file)
    raw = target.read_bytes() if target else b''
    size_ok = len(raw) >= 24 and raw[:8] == b'\x89PNG\r\n\x1a\n'
    dimensions = struct.unpack('>II', raw[16:24]) if size_ok else (0, 0)
    digest = hashlib.sha256(raw).hexdigest() if raw else ''
    valid = size_ok and len(raw) == entry.get('bytes') and dimensions == (entry.get('width'), entry.get('height')) and digest == entry.get('sha256')
    remote = next((item for item in reference_import.get('files', []) if item.get('file') == name), {})
    remote_ok = valid and remote.get('verified') is True and remote.get('sha256') == digest and remote.get('bytes') == len(raw)
    reference_count += int(valid)
    reference_remote_count += int(remote_ok)
    if not valid:
        pending.append(f'原图校验未通过：{name}')
    reference_rows.append(f'<tr><td><a href="{esc(file)}">design/visual-renewal/approved/{esc(name)}</a></td><td>{len(raw)}</td><td>{dimensions[0]}×{dimensions[1]}</td><td><code>{esc(digest or "缺失")}</code></td><td>{"一致" if valid else "未通过"} / {"已回读" if remote_ok else "待核对"}</td></tr>')
    if valid:
        reference_previews.append(figure(file, entry.get('purpose', name) + ' · 原始PNG，非运行图层'))
reference_html = f'<p>原始PNG本地逐字节校验 {reference_count}/3；远端交接回读记录与本地字节一致 {reference_remote_count}/3。已推送原图提交 <code>{esc(reference_import.get("import_commit", "待登记"))}</code>。回读时间 {esc(reference_import.get("verified_at", "待登记"))}，本脚本不重新声称执行网络回读。</p><div class="wide"><table><tr><th>Repo路径</th><th>字节</th><th>尺寸</th><th>SHA256</th><th>本地／远端记录</th></tr>{"".join(reference_rows)}</table></div><details><summary>查看三张完整原始设计板</summary>{"".join(reference_previews)}</details>'
comparisons = []
old_files = {'world': '../v039-feedback/screens/chromium-390-day-world.png', 'workbench': '../v039-feedback/screens/chromium-390-receipt-stabilized.png', 'museum': '../first-planet/screens/chromium-390-base.png'}
for key, title, board, new in [
    ('world', '首星探索', '02_first_planet_exploration.png', find_screen('day-world', 'screens') or find_screen('390-explore', 'pages')),
    ('workbench', '整理工作台', '03_curio_restoration_and_collection.png', find_screen('390-receipt-stabilized', 'screens')),
    ('museum', '收藏室与基地', '03_curio_restoration_and_collection.png', find_screen('390-collection', 'pages') or find_screen('390-base', 'pages')),
]:
    board_file = '../../design/visual-renewal/approved/' + board
    old_caption = '旧版实际画面 · 历史V0.3.7收藏室，非本轮源码' if key == 'museum' else '旧版实际画面 · V0.3.9 / 51d682c'
    comparisons.append(f'<h3>{title}</h3>' + figure(board_file, '已确认原始设计板 · 风格与分层参考，含示意规则，不是运行截图') + '<div class="pair">' + figure(old_files[key], old_caption) + screen_or_wait(new, f'新版{title} · 390×844实际运行') + '</div>')

# Bind formal PNGs to the frozen Git tree. Reading a newly edited working-tree
# image while labeling it with an old package SHA would be false evidence.
def frozen_asset(file):
    target = local(file)
    if not target or not re.fullmatch(r'[0-9a-f]{40,64}', source or ''):
        return None
    rel = target.relative_to(ROOT).as_posix()
    blob = subprocess.run(['git', 'cat-file', 'blob', f'{source}:{rel}'], cwd=ROOT, capture_output=True)
    if blob.returncode or hashlib.sha256(blob.stdout).digest() != hashlib.sha256(target.read_bytes()).digest():
        pending.append(f'正式素材尚未与固定包源码绑定：{rel}')
        return None
    raw = blob.stdout
    if raw[:8] != b'\x89PNG\r\n\x1a\n' or len(raw) < 24 or struct.unpack('>II', raw[16:24]) != (384, 384):
        issues.append(f'正式状态PNG尺寸／签名异常：{rel}')
        return None
    # Preserve identical bytes in this candidate's evidence directory so a later
    # working-tree art iteration cannot silently replace an older gallery's PNGs.
    snapshot = f'materials/frozen-{source[:12]}-{target.name}'
    destination = OUT / snapshot
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file() and destination.read_bytes() != raw:
        issues.append(f'拒绝覆盖不同的同源码状态证据：{snapshot}')
        return None
    if not destination.exists():
        destination.write_bytes(raw)
    return snapshot

# Independent full PNG states are not runtime screenshots; each cell records that provenance.
sheet_rows, state_count = [], 0
for item_id, label in ITEMS.items():
    cells = []
    for state, state_label in STATES.items():
        file = f'../../assets/runtime/visual-renewal/curios/{item_id}-{state}.png'
        bound = frozen_asset(file)
        if bound:
            state_count += 1
        cells.append('<article><h3>' + esc(state_label) + '</h3>' + (figure(bound, f'{label} · {state_label} · 384×384正式透明状态素材，与当前包SHA字节一致', True) if bound else wait(f'{label} {state_label}：正式PNG尚未与当前固定源码对齐')) + '</article>')
    sheet_rows.append(f'<section><h2>{esc(label)}</h2><div class="states">{"".join(cells)}</div></section>')

material_cases = reports.get('screens', {}).get('cases', [])
materials_html = []
for item_id, label in ITEMS.items():
    columns = []
    for state, state_label in STATES.items():
        case = next((x for x in material_cases if x.get('kind') == 'material' and x.get('engine') == 'chromium' and x.get('width') == 390 and x.get('id') == item_id and x.get('stage') == state), None)
        columns.append('<article>' + (figure(case['pageFile'], f'{label} · {state_label} · 390×844工作台') + figure(case['materialFile'], '同状态只读导出的原始透明PNG', True) if case else wait(f'{label} {state_label} 实际页面及只读导出')) + '</article>')
    materials_html.append(f'<details><summary>{esc(label)} · 三态实际工作台</summary><div class="states">{"".join(columns)}</div></details>')

world_cases = [x for x in material_cases if x.get('kind') == 'world-field' and x.get('engine') == 'chromium' and x.get('width') == 390]
world_html = ''.join('<h3>' + esc({'unrevealed': '星雾未解', 'partial': '星雾半解', 'day': '揭晓后的白天', 'night': '同屏夜巡'}.get(case.get('period'), case.get('period'))) + '</h3><div class="pair">' + figure(case.get('mainFile'), '主场景：完整球体与简短状态') + figure(case.get('fieldFile'), '独立信息抽屉：' + case.get('drawerTitle', '现场观察')) + '</div>' for case in world_cases)

video_groups = [
    ('助力三档与自然回落', lambda v: 'assist' in v['file'] or v['_mode'] == 'assist'),
    ('区域星雾揭晓', lambda v: 'fog' in v['file'] or v['_mode'] == 'fog'),
    ('六件清理、修复与免费冷幽默试验', lambda v: 'treatment-' in v['file'] or v['_mode'] == 'treatment'),
    ('跨柜整理与真实取放', lambda v: 'museum-' in v['file']),
    ('0→3级实际购买与安装', lambda v: 'installation' in v['file']),
    ('同屏完整昼夜、异常与晨修', lambda v: 'daynight' in v['file'] or v['_mode'] == 'life'),
    ('收据松土、承托与出土', lambda v: 'excavation' in v['file'] or v['_mode'] == 'excavation'),
]
video_html = []
for title, predicate in video_groups:
    group = [video for video in all_videos if predicate(video)]
    video_html.append(f'<h3>{esc(title)}</h3><div class="videos">' + (''.join(movie(video) for video in group) if group else wait(title + '的独立连续MP4及对应报告')) + '</div>')
extra_videos = [video for video in all_videos if not any(predicate(video) for _, predicate in video_groups)]
if extra_videos:
    video_html.append('<h3>其他已登记连续实录</h3><div class="videos">' + ''.join(movie(video) for video in extra_videos) + '</div>')

ledger_html = []
for case in reports.get('treatment', {}).get('cases', []):
    rows = []
    for step in case.get('steps', []):
        rows.append(f'<tr><td>{esc(step.get("kind"))}</td><td>{esc(step.get("quoted", "未登记"))}</td><td>{esc(step.get("ledger", {}).get("charged", "未登记"))}</td></tr>')
    trial = case.get('trial', {})
    ledger_html.append(f'<h3>{esc(ITEMS.get(case.get("id"), case.get("id")))}</h3><table><tr><th>动作</th><th>报价</th><th>收入／维修调和后实付</th></tr>{"".join(rows)}</table><p>免费试验防收费检查：{esc(trial.get("free", "未登记"))}。完整逐步账本见treatment报告。</p>')

page_html = '<div class="frames">' + ''.join(figure(x['file'], f'{x.get("engine")} · {x.get("width")}×{x.get("height")} · {x.get("name")}') for x in reports.get('pages', {}).get('screenshots', [])) + '</div>'

# Evidence completeness is separate from implementation and test status. A small
# pile of screenshots must not silently become an "all reachable pages" claim.
viewports = [('chromium', 360, 800), ('chromium', 390, 844), ('webkit', 390, 844), ('chromium', 1440, 1000)]
page_names = {'explore': '探索主界面', 'collection': '收藏／图鉴', 'base': '基地', 'equipment': '设备', 'map': '星图／雷达', 'wallet': '零件用途', 'settings': '设置', 'build': '建设／展柜', 'research': '科研调查', 'station': '站务／维修', 'security': '展开安保配置', 'sorting': '旧分拣区详情', 'project-evidence-bench': '已购证据台工程', 'project-habitat-window': '已购生态窗工程', 'project-archive': '已购档案室工程', 'night-replay': '真实夜班回放', 'detail-mouse': '拆封鼠生态详情', 'detail-hermit': '箱寄居蟹生态详情', 'detail-tagbird': '标签鸟生态详情', 'detail-night-shift': '夜班事件详情'}
coverage_rows, coverage_missing = [], []
for route, label in page_names.items():
    cells = []
    for engine, width, height in viewports:
        shot = next((x for x in all_screens if x.get('engine') == engine and x.get('width') == width and x.get('height') == height and x.get('name') == f'{engine}-{width}-{route}' and local(x.get('file'))), None)
        cells.append(f'<td><a href="{esc(shot["file"])}">已采集</a></td>' if shot else '<td class="missing">待补</td>')
        if not shot:
            coverage_missing.append(f'{label} · {engine} {width}×{height}')
    coverage_rows.append(f'<tr><td>{esc(label)}</td>{"".join(cells)}</tr>')
coverage_html = '<div class="wide"><table><tr><th>可达页面</th>' + ''.join(f'<th>{engine}<br>{width}×{height}</th>' for engine, width, height in viewports) + '</tr>' + ''.join(coverage_rows) + '</table></div>'
special_surfaces = [
    ('三居民独立生态／互动近景', all(any(item_id in x.get('name', '') and local(x.get('file')) for x in all_screens) for item_id in ('mouse', 'hermit', 'tagbird'))),
    ('工程与旧分拣机详情', any(any(word in x.get('name', '') for word in ('sorting', 'project')) and local(x.get('file')) for x in all_screens)),
    ('历史记录／回放', any(any(word in x.get('name', '') for word in ('record', 'replay')) and local(x.get('file')) for x in all_screens)),
    ('离线归航结算', any(x.get('kind') == 'return' and local(x.get('file')) for x in all_screens)),
    ('六柜各自玻璃近景', all(any(item_id in x.get('name', '') and any(word in x.get('name', '') for word in ('case', 'cabinet', 'glass')) and local(x.get('file')) for x in all_screens) for item_id in ITEMS)),
]
for label, found in special_surfaces:
    coverage_html += f'<p>{esc(label)}：{"已有对应采集文件，具体画面待审" if found else "待补同源码截图／证据"}。</p>'
    if not found:
        coverage_missing.append(label)
pending.extend('画面覆盖：' + label for label in coverage_missing)

financial_html = []
for case in reports.get('cases', {}).get('cases', []):
    if case.get('kind') == 'paid-case-installation':
        rows = []
        for upgrade in case.get('upgrades', []):
            rows.append(f'<tr><td>{esc(upgrade.get("expected"))}→{esc(upgrade.get("expected", -1) + 1)}</td><td>{esc(upgrade.get("label", "报价未登记"))}</td><td>{esc(upgrade.get("ledger", {}).get("charged", "未登记"))}</td></tr>')
        financial_html.append('<h3>展柜实际购买</h3><p>只是审阅档的主动购买，不向旧档重复收费。钱包净变动与探索收入、维修分别调和。</p><table><tr><th>等级</th><th>当时报价按钮</th><th>实付零件</th></tr>' + ''.join(rows) + '</table>')
for case in reports.get('life', {}).get('cases', []):
    if case.get('kind') == 'complete-daynight':
        trace = case.get('trace', [])
        repair = trace[-1].get('repairSpent', 0) - trace[0].get('repairSpent', 0) if trace else '未登记'
        integrity = [point['integrity'] for point in trace if isinstance(point.get('integrity'), (int, float))]
        periods = '→'.join(case.get('periods', []))
        financial_html.append(f'<h3>同屏夜间与晨修</h3><p>报告实际阶段 {esc(periods or "未登记")}；完整度最低 {esc(min(integrity) if integrity else "未登记")}，末帧 {esc(integrity[-1] if integrity else "未登记")}；维修累计实付增量 {esc(repair)} 零件。是否重复扣款另见离线／刷新模型与最终包回归，不能由一轮录像推定。</p>')
if not financial_html:
    financial_html.append(wait('展柜购买、夜间损伤与晨修费用摘要'))

trial_rows = []
for item_id, label in ITEMS.items():
    case = next((x for x in reports.get('treatment', {}).get('cases', []) if x.get('id') == item_id), {})
    trial = case.get('trial', {})
    complete = case.get('complete') is True
    free = trial.get('free')
    no_repeat = case.get('noRepeatPayment')
    trial_rows.append(f'<tr><td>{esc(label)}</td><td>{"已完整记录" if complete else "待补"}</td><td>{esc(free if free is not None else "未登记")}</td><td>{esc(no_repeat if no_repeat is not None else "未登记")}</td></tr>')
    if not complete or free is not True or no_repeat is not True:
        pending.append(f'逐件处理／免费试验／防重收费证据：{label}')
trial_html = '<table><tr><th>奇物</th><th>完整处理</th><th>试验免费检查</th><th>防重付检查</th></tr>' + ''.join(trial_rows) + '</table>'

report_rows = []
for mode in MODES:
    report = all_reports.get(mode)
    if not report:
        status = '待采集／报告未完整写入'
    elif mode not in reports:
        status = '源码／包体未对齐或工作树不洁净，旧媒体已排除'
    elif report.get('errors'):
        status = f'已记录 {len(report["errors"])} 项错误，待处理'
    else:
        status = f'报告已生成，{len(report.get("screenshots", []))}图 / {len(report.get("videos", []))}视频；视觉状态另列'
    report_rows.append(f'<tr><td>{esc(NAMES[mode])}</td><td>{esc(status)}</td><td>' + (f'<a href="{mode}-evidence.json">原始JSON</a>' if report else '待补') + '</td></tr>')

checks = []
def current_supplement(name):
    value = supplemental.get(name)
    if value and source and value.get('sourceCommit') == source:
        return value
    if value:
        pending.append(f'{name}：仅保留历史／未绑定源码的原始报告链接，未嵌入本候选结果')
    return None

verification = current_supplement('verification')
if verification:
    check = verification.get('localCheck', {})
    checks.append('<p>本地检查记录：' + esc(json.dumps(check, ensure_ascii=False)) + '。是否通过以原始报告状态和完整日志为准。</p>')
else:
    checks.append(wait('本轮验证摘要，不能据媒体存在推断测试通过'))
performance = current_supplement('performance')
if performance:
    rows = []
    for case in performance.get('cases', []):
        actual = case.get('actualPaint', {})
        rows.append(f'<tr><td>{esc(case.get("engine"))}</td><td>{esc(case.get("view"))}</td><td>{esc(actual.get("samples", "未登记"))}</td><td>{esc(actual.get("medianMs", "未登记"))}</td><td>{esc(actual.get("p95Ms", "未登记"))}</td><td>{esc(case.get("meanDrawMs", "未登记"))}</td><td>{esc(case.get("heap", {}).get("maximumBytes", "未登记"))}</td></tr>')
        issues.extend(f'performance {case.get("engine")}/{case.get("view")}: {error}' for error in case.get('errors', []))
    checks.append('<p>报告设备：' + esc(json.dumps(performance.get('host', {}), ensure_ascii=False)) + '；方法：' + esc(json.dumps(performance.get('method', {}), ensure_ascii=False)) + '。</p><p>以下为桌面实际绘制间隔；JS堆不包含解码图像、GPU或进程总内存，不代表手机性能。</p><div class="wide"><table><tr><th>引擎</th><th>场景</th><th>样本</th><th>中位数ms</th><th>P95 ms</th><th>平均绘制ms</th><th>JS堆峰值B</th></tr>' + ''.join(rows) + '</table></div>')
self_test = current_supplement('taptap-self-test')
if self_test:
    checks.append(f'<p>开发自测记录：版本ID <strong>{esc(self_test.get("h5VersionId", "未登记"))}</strong>，运行源码 <code>{esc(self_test.get("sourceCommit", "未登记"))}</code>。上传状态详见原始记录；真实手机仍需单独复测。</p>')
else:
    checks.append(wait('本源码的TapTap开发自测版本ID、远端回读与运行SHA'))
checks.append('<table><tr><th>实际手机验证</th><th>当前状态</th></tr><tr><td>真实触控／TapTap WebView</td><td>未实测；桌面触控仿真另见浏览器结果</td></tr><tr><td>真实锁屏、系统减少动态、后台返回</td><td>手机未实测；浏览器隐藏／恢复不能替代锁屏</td></tr><tr><td>低端GPU、长期发热与弱网</td><td>未实测；没有以桌面M2结果代替</td></tr></table>')
links = []
for file, title in [('verification.json', '验证摘要'), ('check.log', '完整检查日志'), ('e2e-results.json', '浏览器回归结果'), ('package-smoke.json', '最终包存档检查'), ('model-invariants.json', '模型不变校验'), ('economy.json', '经济模拟'), ('economy.csv', '经济CSV'), ('offline.csv', '离线CSV'), ('performance.json', '性能原值'), ('taptap-self-test.json', '开发自测上传回读'), ('review-status.json', '本候选内部视觉复审'), ('package-info.json', '固定包元数据'), ('night-review-contact-sheet.png', '夜间连续片段帧图'), ('museum-review-contact-sheet.png', '收藏取放连续片段帧图'), ('../../design/visual-renewal/ART_SPEC.md', '统一美术规范'), ('../../design/visual-renewal/ASSET_REGISTRY.json', '素材注册与hash'), ('../../design/visual-renewal/VISUAL_COVERAGE.md', '全页面覆盖表'), ('../../design/visual-renewal/IMPORT_VERIFICATION.json', '三张原图远端校验'), ('../../design/visual-renewal/REVIEW_ITERATIONS.md', '被拒候选与迭代原因'), ('../../design/visual-renewal/ECONOMY_VALIDATION.md', '经济一致性说明')]:
    if local(file):
        links.append(f'<a href="{esc(file)}">{esc(title)}</a>')

remaining = [item for item in all_screens if item.get('file') not in used]
remaining_html = '<div class="frames">' + ''.join(figure(x['file'], x.get('caption', x.get('name', x['file']))) for x in remaining) + '</div>'
ledger_section = ''.join(ledger_html) or wait('六物处理报告及逐笔账本')
world_section = world_html or wait('三阶段星雾及同屏抽屉截图')
pages_section = page_html if reports.get('pages') else wait('全页面截图报告')
css = '''
:root{color-scheme:dark;background:#170e28;color:#eadbc4;font:15px/1.65 system-ui,sans-serif}body{max-width:1220px;margin:auto;padding:24px}h1,h2,h3{color:#f2c77f;line-height:1.4}h1{font-size:29px}h2{margin-top:42px}h3{font-size:18px}a{color:#b9dce8}code{overflow-wrap:anywhere}p{max-width:1020px}.note{background:#2b1b40;border-left:3px solid #dc9c60;padding:14px 18px}.rejected{background:#4d1f31;border:2px solid #ef9688;padding:16px;color:#ffd7bd}.pending{color:#e8c085;background:#382642;padding:10px 14px}.warnings,.missing{color:#ffb2a0}.wide{overflow-x:auto}.pair,.states,.frames,.videos{display:grid;gap:16px;grid-template-columns:repeat(2,minmax(0,1fr))}.states{grid-template-columns:repeat(3,minmax(0,1fr))}.frames{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}figure{margin:0 0 18px;padding:10px;background:#281a3b;border:1px solid #785474;min-width:0}img{display:block;width:100%;height:auto}figcaption{font-size:12px;color:#c8b7ce;padding:8px 1px 0}.material img{height:240px;object-fit:contain;image-rendering:pixelated;background:repeating-conic-gradient(#332540 0 25%,#574063 0 50%) 0/20px 20px}.movie video{width:100%;max-height:800px;display:block;background:#0e0916}.movie{max-width:480px}article{min-width:0}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;vertical-align:top;padding:9px;border-bottom:1px solid #64415d}summary{cursor:pointer;color:#efc68d;padding:11px;background:#291a3b;margin:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.links{display:flex;gap:8px 20px;flex-wrap:wrap}nav{display:flex;gap:8px 18px;flex-wrap:wrap}nav a{padding:7px 0}@media(max-width:680px){body{padding:14px}.states,.videos{grid-template-columns:1fr}.pair{gap:8px}.material img{height:260px}h1{font-size:24px}}
'''
header = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style>'''
sheet = header + f'<title>六件奇物18态 · 生产贴图对照</title><h1>六件奇物 · 18张正式状态图</h1><p>固定包源码 <code>{esc(source or "待登记")}</code>。{review_banner}这是独立正式透明素材，不是页面截图或处理录像；运行时只读导出与实际工作台在主审核页另列。原始PNG逐件同角度、同画布384×384，棋盘格只在网页中显示，不写入PNG。已找到 {state_count}/18 张。</p><p><a href="index.html">返回运行审核页</a></p>' + ''.join(sheet_rows) + '</html>\n'
(OUT / 'materials-overview.html').write_text(sheet, encoding='utf-8')

pending = list(dict.fromkeys(pending))
media_count = sum(1 for x in all_screens if local(x.get('file')))
video_count = sum(1 for x in all_videos if valid_movie(x))
issue_html = '<div class="warnings"><h2>待查记录</h2><ul>' + ''.join(f'<li>{esc(x)}</li>' for x in dict.fromkeys(issues)) + '</ul></div>' if issues else '<p>当前已读取报告未登记采集错误；这不等于视觉验收通过。</p>'
pending_html = '<details open><summary>尚未完成的报告／媒体（' + str(len(pending)) + '）</summary><ul>' + ''.join(f'<li>{esc(x)}</li>' for x in pending) + '</ul></details>' if pending else '<p>上述报告引用的媒体均已在本地找到；完成范围仍以覆盖表与用户视觉审核为准。</p>'
content = header + f'''<title>失物星球 {esc(version)} · 首星整体翻新审核</title>
<h1>首星整体翻新 · {esc(version)} 实际运行审核</h1>{review_banner}
<p>运行源码 <code>{esc(source or '固定包源码尚未登记')}</code> · <a href="https://github.com/sy0310/loststar-game/pull/2">Draft PR #2</a> · <a href="{esc(next(iter(reports.values()), {}).get('base', 'http://127.0.0.1:4226/'))}">本机固定运行包</a></p>
<p class="note">这是首星整体翻新的开发审核包，目标覆盖六件奇物及全部可达页面；实际完成范围见下方覆盖缺口，非此前三件局部样板。以下截图和连续录像来自桌面Chromium/WebKit触控仿真与独立审阅档，<strong>不是实际手机截图或手机录像</strong>。展示／升级使用普通探索、离线归航赚取与实际付款生成的隔离审阅档，不是新手初始画面，完整夹具及费用留在报告中。截图可使用未来档案时刻固定状态；连续视频依各报告的真实墙钟记录、1倍速度。未打开、清除或覆盖用户个人浏览器存档，继续使用v037格式。测试通过不等于美术通过；手机触控、锁屏恢复、低端GPU与长时发热仍待真实手机审核。不合并、不提审、不正式发布。</p>
<nav><a href="#compare">设计／旧版／新版</a><a href="#materials">六物18态</a><a href="#movies">连续动画</a><a href="#world">球体与抽屉</a><a href="#pages">全页面</a><a href="#checks">验证与包体</a></nav>
<p>当前报告引用且本地存在：{media_count} 张页面／实录帧／画布裁片、{len(all_materials)} 项透明材质记录、{video_count} 段连续录像。未生成的文件不以占位图补齐。</p>
<table><tr><th>采集模块</th><th>实际状态</th><th>来源</th></tr>{''.join(report_rows)}</table>{issue_html}{pending_html}
<h2>三张原始PNG · 已推送来源</h2>{reference_html}
<h2 id="compare">设计稿／旧版／新版</h2><p>设计板整张原图保留，不裁为运行素材。旧版画面明确标注历史版本；进度、柜级及视角可能不同，不能将对比本身当作同档数值验证。</p>{''.join(comparisons)}
<h2 id="materials">六件奇物 · 完整18态</h2><p><a href="materials-overview.html">打开六物18态正式PNG联系表（{state_count}/18）</a>。下方实际工作台仅使用当前采集报告，不用素材图冒充运行截图。</p>{''.join(materials_html)}
<h2 id="movies">七类连续动画审核位</h2><p>每类只显示报告中已登记且确实存在的MP4；尚未产出的类别保持待补。六物完整处理录像包含清理、修复与免费表演，不拆成截图视频或计作额外独立录制。</p>{''.join(video_html)}
<h2>真实处理与收费账本</h2>{trial_html}{ledger_section}{''.join(financial_html)}
<h2 id="world">同一球体 · 星雾与观察／巡逻抽屉</h2>{world_section}
<h2 id="pages">可达页面 · 多尺寸与两引擎</h2><p>优先核对390×844，另含360×800、桌面及WebKit；截图只证明当时实际画面，完整交互回归另见浏览器结果和覆盖表。“已采集”不等于美术通过。</p>{coverage_html}{pages_section}
<h2 id="checks">验证、性能与开发自测</h2><p>包体：{esc(package.get('bytes', '待登记'))} 字节；解压后 {esc(package.get('uncompressedBytes', '待登记'))} 字节；{esc(package.get('files', '待登记'))} 个文件。ZIP SHA256 <code>{esc(package.get('sha256', '待登记'))}</code>。</p>{''.join(checks)}<div class="links">{' '.join(links)}</div>
<h2>完整截图索引</h2><details><summary>其余已登记的{len(remaining)}张页面／实录帧／画布裁片</summary>{remaining_html}</details>
</html>\n'''
(OUT / 'index.html').write_text(content, encoding='utf-8')
summary = {'gallery': str(OUT / 'index.html'), 'sourceCommit': source, 'internalVisualReview': review_status, 'reports': len(reports), 'excludedReports': [name for name in all_reports if name not in reports], 'screensOnDisk': media_count, 'statePngsBoundToSource': state_count, 'videosOnDisk': video_count, 'referencePngs': reference_count, 'referenceRemoteRecords': reference_remote_count, 'coverageMissing': coverage_missing, 'pending': list(dict.fromkeys(pending)), 'issues': list(dict.fromkeys(issues)), 'physicalPhone': False}
(OUT / 'gallery-status.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: len(value) if key in ('pending', 'issues', 'coverageMissing') else value for key, value in summary.items()}, ensure_ascii=False))
