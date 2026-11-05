"""Build a compact V0.3.9 gallery from actual capture reports; no media synthesis."""
from pathlib import Path
from html import escape
import json

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts' / 'v039-feedback'
out.mkdir(parents=True, exist_ok=True)
reports = {}
for name in ('screens', 'assist', 'treatment'):
    file = out / f'{name}-evidence.json'
    if file.exists():
        reports[name] = json.loads(file.read_text())
package_file = out / 'package-info.json'
package = json.loads(package_file.read_text()) if package_file.exists() else {}
commits = {report['sourceCommit'] for report in reports.values()}
if len(commits) > 1 or commits and package.get('sourceCommit') not in commits:
    raise ValueError('Evidence reports and package metadata must share one source commit')

used = set()
def figure(file, caption, material=False):
    if not (out / file).is_file():
        raise FileNotFoundError(file)
    used.add(file)
    cls = 'material' if material else 'page'
    return f'<figure class="{cls}"><a href="{escape(file)}"><img loading="lazy" src="{escape(file)}" alt="{escape(caption)}"></a><figcaption>{escape(caption)}</figcaption></figure>'

def movie(item):
    file = item['file']
    if not (out / file).is_file():
        raise FileNotFoundError(file)
    caption = item.get('caption', '390×844 · 三轮原生触屏助力，36秒自然墙钟、1倍速度')
    return f'<figure class="movie"><video controls preload="metadata" playsinline src="{escape(file)}"></video><figcaption>{escape(caption)}</figcaption></figure>'

screen_cases = reports.get('screens', {}).get('cases', [])
assist_cases = reports.get('assist', {}).get('cases', [])
treatment_cases = reports.get('treatment', {}).get('cases', [])
assist_videos = reports.get('assist', {}).get('videos', [])
all_screens = [item for report in reports.values() for item in report.get('screenshots', [])]
all_materials = [item for report in reports.values() for item in report.get('materials', [])]
all_videos = [item for report in reports.values() for item in report.get('videos', [])]
errors = [error for report in reports.values() for error in report.get('errors', [])]
assist = assist_cases[0] if assist_cases else None
state_names = {'found': '发现 · 未整理', 'clean': '已清理', 'stabilized': '已修补／展示'}
item_names = {'receipt': '退货收据', 'tape': '道歉胶带', 'bell': '闹铃'}

treatment_sections = []
for case in treatment_cases:
    label = item_names.get(case['id'], case['id'])
    working_frames = []
    charges = []
    for step in case.get('steps', []):
        action_label = '清理' if step['kind'] == 'clean' else '修复'
        working_frames.append(figure(step['ongoingFile'], f'{label} · {action_label}进行中 · 实际工具接触以原始Canvas诊断为准'))
        working_frames.append(figure(step['completeFile'], f'{label} · {action_label}实际完成'))
        charges.append(f'{action_label}报价{step["quoted"]}，收入／维修调和后实付{step["ledger"]["charged"]}')
    recording = movie(case['video']) if case.get('video') else '<p>该件完整录像待采集。</p>'
    paid = case.get('ledger', {}).get('charged', '待核对')
    free = case.get('trial', {}).get('free', False)
    treatment_sections.append(f'<h3>{escape(label)}</h3>{recording}<p>{escape("；".join(charges))}。全程实付{paid}零件；免费试验{"未收费" if free else "待核对"}。</p>'
                              + '<div class="frames">' + ''.join(working_frames) + '</div>')

world = []
for period, label in [('day', '白天'), ('night', '夜间')]:
    case = next((item for item in screen_cases if item.get('kind') == 'world-field'
                 and item.get('engine') == 'chromium' and item.get('width') == 390 and item.get('period') == period), None)
    if case:
        world.append('<div class="pair">' + figure(case['mainFile'], f'{label}主场景 · 抽屉收起')
                     + figure(case['fieldFile'], f'{label} · {case["drawerTitle"]}，读取同一世界画面') + '</div>')

materials = []
for item_id, label in item_names.items():
    cards = []
    for stage, stage_label in state_names.items():
        case = next((item for item in screen_cases if item.get('kind') == 'material'
                     and item.get('engine') == 'chromium' and item.get('width') == 390
                     and item.get('id') == item_id and item.get('stage') == stage), None)
        if case:
            cards.append('<article>' + figure(case['pageFile'], f'{label} · {stage_label} · 390×844实际工作台')
                         + figure(case['materialFile'], f'{label} · {stage_label} · 只读API透明材质原PNG', True) + '</article>')
    if cards:
        materials.append(f'<h3>{escape(label)}</h3><div class="states">' + ''.join(cards) + '</div>')

trace_rows = ''
if assist:
    first, last = assist['trace'][0], assist['trace'][-1]
    trace_rows = f'''<dl><div><dt>接受点按</dt><dd>{last['accepted'] - first['accepted']}</dd></div>
<div><dt>实际应用助力</dt><dd>{last['applied'] - first['applied']:.0f} ms</dd></div>
<div><dt>真实到货</dt><dd>{last['cycles'] - first['cycles']}</dd></div>
<div><dt>毛收入增量</dt><dd>{last['grossIncome'] - first['grossIncome']}</dd></div>
<div><dt>实际可见档位</dt><dd>{escape(' / '.join(map(str, assist['tiersObserved'])))}</dd></div>
<div><dt>自然回落至0</dt><dd>{'已观测' if assist['naturalDecayObserved'] else '未观测'}</dd></div></dl>'''

key_frames = [item for item in all_screens if item.get('kind') == 'video-frame']
key_html = '<div class="frames">' + ''.join(figure(item['file'], item['name'] + ' · 连续实录帧') for item in key_frames) + '</div>' if key_frames else ''
remaining = [(item['file'], item.get('name', item['file']), False) for item in all_screens if item['file'] not in used]
remaining += [(item['file'], item['file'], True) for item in all_materials if item['file'] not in used]
seen = set()
remaining = [item for item in remaining if not (item[0] in seen or seen.add(item[0]))]
status = f'证据报告记录{len(errors)}项待查错误。' if errors else '报告未记录采集错误。' if reports else '尚未采集运行时媒体。'
links = ' · '.join(f'<a href="{name}-evidence.json">{name}原始报告</a>' for name in reports)

content = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>失物星球 V0.3.9 · 实际画面审核</title><style>
:root{{color-scheme:dark;background:#181421;color:#ede3d4;font:16px/1.65 system-ui,sans-serif}}body{{max-width:1180px;margin:auto;padding:24px}}
h1,h2,h3{{color:#ebc992;line-height:1.35}}h2{{margin-top:48px}}p{{max-width:940px}}a{{color:#bcd8d0}}code{{overflow-wrap:anywhere}}
.note{{background:#292132;border-left:3px solid #ab89a1;padding:13px 18px}}.pair,.states,.frames{{display:grid;gap:18px;grid-template-columns:repeat(2,minmax(0,1fr))}}
.states{{grid-template-columns:repeat(3,minmax(0,1fr))}}.frames{{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}}article{{min-width:0}}
figure{{margin:0 0 18px;padding:10px;background:#282130;border:1px solid #675465;min-width:0}}img{{display:block;width:100%;height:auto}}figcaption{{font-size:13px;color:#c7beb8;padding:9px 2px 0}}
.material img{{image-rendering:pixelated;object-fit:contain;height:220px;background:repeating-conic-gradient(#332b3b 0 25%,#514357 0 50%) 0/20px 20px}}
.movie video{{display:block;width:100%;max-height:844px;background:#100d18}}.movie{{max-width:480px}}dl{{display:flex;flex-wrap:wrap;gap:16px}}dl>div{{min-width:130px;background:#282130;padding:12px}}dt{{font-size:12px;color:#c7beb8}}dd{{margin:6px 0 0;font-weight:600}}summary{{cursor:pointer;color:#ebc992}}.error{{color:#f3b5a7}}
@media(max-width:680px){{body{{padding:14px}}.states{{grid-template-columns:1fr}}.pair{{grid-template-columns:1fr 1fr}}}}
</style><h1>V0.3.9 实际画面审核</h1>
<p>运行源码 <code>{escape(package.get('sourceCommit', '待打包'))}</code>。本轮审核三档助力动作、独立现场／巡逻抽屉，以及收据、胶带、闹铃的三种物理状态。</p>
<p class="note">以下均为桌面浏览器触控仿真。物件审阅档由普通模型实际发现、赚取和付费生成，能力等级为0，完整行为和账本留在报告中；它们不是新玩家初始画面。连续录像使用自然墙钟和真实触屏输入。采集仅使用独立临时浏览器上下文，沿用v037档案格式，未读取、清空或替换用户个人浏览器存档。真实手机观感仍待用户复测。</p>
<p>{escape(status)} {links} · <a href="package-info.json">固定包信息</a> · <a href="http://127.0.0.1:4225/">本机运行包</a> · <a href="https://github.com/sy0310/loststar-game/pull/2">Draft PR #2</a></p>
<h2>助力 · 低、中、高与自然回落</h2><p>强度来自实际接受的点按，行走前倾、扫描摆幅和步态由实绘诊断记录。应用工作和到货收入分别读取真实档案；视觉强度不直接发放奖励。关键帧从这段实录抽取，采集时没有用截图打断点击。</p>
{''.join(movie(item) for item in assist_videos) or '<p>连续录像待采集。</p>'}{trace_rows}{key_html}
<h2>同一世界 · 主场景与独立信息抽屉</h2><p>390×844同尺寸对照。抽屉近景来自正在运行的同一世界Canvas；报告记录世界、抽屉、控制区域的实际边界和交叠面积。夜景来自普通模型的真实夜间档案，已完成的揭晓保持不变。</p>{''.join(world) or '<p>世界／抽屉对照待采集。</p>'}
<h2>三件物品 · 三种实际物理状态</h2><p>优先展示390×844 Chromium。每列为一个完整实际工作台，下方是只读materialSnapshot导出的原始透明PNG；棋盘格仅用于浏览器展示透明度，未写入图片。收据256×256，胶带和闹铃192×192。</p>
{''.join(materials) or '<p>工作台与透明材质待采集。</p>'}
<h2>清理→修复→免费试验 · 自然连续作业</h2><p>各件从当前时间的真实已发现档案开始；收据已取出，无需重复挖掘。按真实持久动作的开始、结束与物理状态等待完成。费用采用当前生产界面的现有规则报价，并用实际钱包、毛收入和自动维修支出逐段调和；收据另核对逐笔交易ID。胶带、闹铃的免费试验是现有界面动画，不虚构持久作业。各段时长按墙钟实测，视频只裁去加载前段，保持1倍速度。</p>
{''.join(treatment_sections) or '<p>三件自然作业录像待采集。</p>'}
<h2>完整索引</h2><p>已登记{len(all_screens)}张实际页面／实录帧和{len(all_materials)}张透明材质。完整覆盖以原始报告为准；采集和布局检查不等同于用户视觉验收。</p>
<details><summary>展开其余{len(remaining)}张</summary><div class="frames">{''.join(figure(file, caption, material) for file, caption, material in remaining)}</div></details>
{('<details class="error"><summary>采集错误</summary><pre>' + escape(json.dumps(errors, ensure_ascii=False, indent=2)) + '</pre></details>') if errors else ''}
</html>\n'''
(out / 'index.html').write_text(content)
print(f'Built V039 gallery: {len(all_screens)} pages/frames, {len(all_materials)} materials, {len(all_videos)} videos; {len(errors)} capture errors')
