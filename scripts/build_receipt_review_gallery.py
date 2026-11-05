#!/usr/bin/env python3
"""Build a source-bound gallery for the focused post-439256 receipt/UI revision."""
import hashlib
import html
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/v041-receipt-review'
MODES = ('screens', 'pages', 'treatment', 'cases', 'reading')
reports = {mode: json.loads((OUT / f'{mode}-evidence.json').read_text()) for mode in MODES}
source = reports['screens']['sourceCommit']
package = reports['screens']['package']
for mode, report in reports.items():
    assert report['sourceCommit'] == source, f'{mode}: different source'
    assert report['zipSha256'] == package['sha256'], f'{mode}: different package'
    assert not report['errors'], f'{mode}: capture errors'
    assert report['sourceClean'] and not report['physicalPhone']
performance = json.loads((OUT / 'performance.json').read_text())
assert performance['sourceCommit'] == source
assert not any(case['errors'] for case in performance['cases'])

def esc(value):
    return html.escape(str(value), quote=True)

def figure(file, caption):
    assert (OUT / file).is_file(), f'Missing {file}'
    return f'<figure><a href="{esc(file)}"><img loading="lazy" src="{esc(file)}" alt="{esc(caption)}"></a><figcaption>{esc(caption)}</figcaption></figure>'

materials = reports['screens']['materials']
comparison = []
page_comparison = []
old_screens = json.loads((ROOT / 'artifacts/visual-renewal/screens-evidence.json').read_text())
assert old_screens['sourceCommit'] == 'f1397e268b4dec43a241833da077b08104451c8e'
for stage in ('found', 'clean', 'stabilized'):
    current = next(item for item in materials if item['id'] == 'receipt' and item['stage'] == stage and item['engine'] == 'chromium' and item['viewportWidth'] == 390)
    file = f'materials/receipt-439256-{stage}.png'
    old = subprocess.check_output(['git', 'show', f'f1397e268b4dec43a241833da077b08104451c8e:assets/runtime/visual-renewal/curios/receipt-{stage}.png'], cwd=ROOT)
    (OUT / file).write_bytes(old)
    comparison.append('<section class="pair">' + figure(file, f'439256 / f1397e2 · {stage} · 用户要求返修') + figure(current['file'], f'{package["version"]} / {source[:7]} · {stage} · 实际材质导出') + '</section>')
    name = f'chromium-390-receipt-{stage}'
    old_shot = next(shot for shot in old_screens['screenshots'] if shot['name'] == name)
    new_shot = next(shot for shot in reports['screens']['screenshots'] if shot['name'] == name)
    copied = f'screens/receipt-439256-{stage}.png'
    (OUT / copied).write_bytes((ROOT / 'artifacts/visual-renewal' / old_shot['file']).read_bytes())
    page_comparison.append('<section class="pair">' + figure(copied, f'439256 / f1397e2 · {stage} · 历史实际390×844') + figure(new_shot['file'], f'{package["version"]} / {source[:7]} · {stage} · 本版实际390×844') + '</section>')

sections = []
for mode, title in [('screens', '实际三态与分层页面'), ('pages', '按钮、选项与全页面'), ('treatment', '连续处理与具体互动'), ('reading', '同张原纸的未研究／Ⅰ／Ⅱ读数'), ('cases', '玻璃柜、取放与原级别安装')]:
    report = reports[mode]
    shots = ''.join(figure(shot['file'], f'{shot["name"]} · {shot.get("engine", "")} · {shot.get("width", "")}×{shot.get("height", "")}') for shot in report['screenshots'])
    videos = ''
    for item in report['videos']:
        file = item['file']
        raw = (OUT / file).read_bytes()
        videos += f'<figure class="video"><video controls preload="metadata" playsinline src="{esc(file)}"></video><figcaption>{esc(file)} · {item["durationSeconds"]:.2f}s · 自然连续1倍速度</figcaption></figure>'
        item['bytes'] = len(raw)
        item['sha256'] = hashlib.sha256(raw).hexdigest()
    sections.append(f'<h2>{title}</h2><div class="grid">{videos}</div><details><summary>展开实际截图（{len(report["screenshots"])}）</summary><div class="grid">{shots}</div></details><p><a href="{mode}-evidence.json">原始账本、夹具、时间及来源</a></p>')

focus_shots = []
for stage in ('found', 'clean', 'stabilized'):
    shot = next(s for s in reports['screens']['screenshots'] if s['name'] == f'chromium-390-receipt-{stage}')
    focus_shots.append(figure(shot['file'], f'390×844 实际运行 · {stage}'))
video_count = sum(len(report['videos']) for report in reports.values())
shot_count = sum(len(report['screenshots']) for report in reports.values())
status_file = OUT / 'review-status.json'
status = json.loads(status_file.read_text()) if status_file.exists() else {'status': 'pending_internal_review'}
status_text = '内部逐帧复审完成，等待用户实机与美术审核。' if status.get('status') == 'internal_reviewed_user_pending' else '内部动态复审进行中，尚未交付用户验收。'
page = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>收据与控件返修审核</title>
<style>body{{margin:0;background:#211232;color:#f3dfbe;font:16px/1.7 system-ui,sans-serif}}main{{max-width:1200px;margin:auto;padding:20px}}a{{color:#8ad9e0}}h1{{font-size:25px}}h2{{font-size:21px;border-top:1px solid #9b745b;padding-top:18px}}.notice{{padding:16px;border:2px solid #c99960;background:#3c254b}}.grid,.pair{{display:flex;flex-wrap:wrap;gap:15px}}figure{{margin:0 0 16px;width:min(100%,360px)}}figure img{{display:block;width:100%;height:auto;image-rendering:pixelated;background:#2c1a43}}.video video{{display:block;width:100%;max-height:650px;background:#170f25}}figcaption{{font-size:13px;overflow-wrap:anywhere}}.pair figure{{width:min(46%,350px)}}code{{overflow-wrap:anywhere}}summary{{padding:12px;cursor:pointer}}@media(max-width:500px){{main{{padding:12px}}.pair figure{{width:100%}}}}</style>
<main><h1>收据与控件返修 · V{esc(package['version'])}</h1><p class="notice">{status_text}<br>439256收据已被用户要求重做。这里展示新的现代单张收据、独立紫夹和归档支架；不是把旧纸拼接后再称完成。全部截图与视频来自下列同一固定包，触控为桌面仿真，未冒充真实手机。</p>
<p>运行源码 <code>{source}</code>；ZIP SHA256 <code>{esc(package['sha256'])}</code>；存档继续 <code>loststar.fusion.firstplanet.v037</code>。</p>
<p>{shot_count}项实际图像记录、{len(materials)}份透明材质导出、{video_count}段自然连续影片。正文与操作标签保持可读；没有新货币、重开或重复收费。</p>
<p>依据：<a href="../../design/visual-renewal/approved/03_curio_restoration_and_collection.png">用户批准原图03（完整原始PNG）</a> · <a href="../../design/visual-renewal/USER_REVIEW_V040.md">返修合同</a> · <a href="../../design/visual-renewal/ASSET_REGISTRY.json">正式素材登记</a></p>
<h2>先看新收据实际运行三态</h2><div class="grid">{''.join(focus_shots)}</div>
<details><summary>展开439256／新版实际390×844页面对照</summary>{''.join(page_comparison)}</details>
<h2>旧版／新版纸面同源导出对照</h2><p>纸面透明图不含玻璃、夹具、归档架或工具；实际场景分层请看上面的运行截图和连续影片。原缺签字段保持空白，修补不会产生新签收记录。</p>{''.join(comparison)}
<h2>互动作用</h2><p>“读出票面、拉出一截、打开一层、盖个邮戳、敲敲箱盖、轻按铃铛”属于整理完成后的展品表演，不消耗零件、不重复发奖；清理修补和真实线索核验仍各有明确操作。</p>
{''.join(sections)}
<h2>验证与边界</h2><p><a href="verification.json">构建／测试／存档结果</a> · <a href="performance.json">本次两引擎桌面移动尺寸测量</a> · <a href="review-status.json">内部画面复审</a> · <a href="taptap-self-test.json">TapTap版本回读</a></p>
<p>世界与昼夜模型未改。本次未重录整轮5分钟昼夜；<a href="../visual-renewal/index.html">f1397e2历史世界、昼夜与助力实录</a>明确保留旧源码，不当作本版新测。手机触感、锁屏及最终美术认可仍由用户新码验收。Draft PR #2，不合并、不提审、不正式发布。</p></main></html>'''
(OUT / 'index.html').write_text(page)
(OUT / 'gallery-status.json').write_text(json.dumps({'sourceCommit': source, 'version': package['version'], 'zipSha256': package['sha256'], 'screenshots': shot_count, 'materials': len(materials), 'videos': video_count, 'status': status['status'], 'reports': list(MODES), 'physicalPhone': False}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'source': source, 'screenshots': shot_count, 'materials': len(materials), 'videos': video_count}))
