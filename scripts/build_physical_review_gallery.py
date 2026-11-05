#!/usr/bin/env python3
"""Read source-bound records; never treat successful tests as visual approval."""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/v042-physical-review'
names = ['screens', 'pages', 'treatment', 'museum-physical', 'mechanisms-physical']
reports = {name: json.loads((OUT / f'{name}-evidence.json').read_text()) for name in names}
package = reports['screens']['package']
source = package['sourceCommit']
assert package['version'] == '0.4.2'
for name, report in reports.items():
    assert report['sourceCommit'] == source and report['zipSha256'] == package['sha256'], name
    assert report['sourceClean'] and not report['physicalPhone'] and not report['errors'], name
    assert not any(case.get('errors') for case in report['cases']), name

def esc(value):
    return html.escape(str(value), quote=True)

def figure(file, caption):
    assert (OUT / file).is_file(), file
    return f'<figure><a href="{esc(file)}"><img loading="lazy" src="{esc(file)}" alt="{esc(caption)}"></a><figcaption>{esc(caption)}</figcaption></figure>'

historical = json.loads((ROOT / 'artifacts/v041-receipt-review/pages-evidence.json').read_text())
assert historical['sourceCommit'] == '240e067fd43fcec201de0ec889e739dd7e8ab684'
old = next(s for s in historical['screenshots'] if s['name'] == 'chromium-390-base')
(OUT / 'screens/museum-439336-historical.png').write_bytes((ROOT / 'artifacts/v041-receipt-review' / old['file']).read_bytes())
current = next(s for s in reports['pages']['screenshots'] if s['name'] == 'chromium-390-base')
comparison = figure('screens/museum-439336-historical.png', '439336 / 240e067 · 历史实际画面，用户要求返修') + figure(current['file'], f'{source[:7]} · 本版实际390×844')
sections = []
videos = []
for name, title in [('museum-physical', '收藏室真实通道与连续取放'), ('mechanisms-physical', '连续胶带与铃的接触机构'), ('treatment', '六件自然清理、修补与具体互动'), ('screens', '实际三态与观察抽屉'), ('pages', '可达页面与控件回归')]:
    report = reports[name]
    media = []
    for item in report['videos']:
        raw = (OUT / item['file']).read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        if 'sha256' in item:
            assert item['sha256'] == sha
        assert item['speed'] == 1
        videos.append({'file': item['file'], 'bytes': len(raw), 'sha256': sha, 'durationSeconds': item['durationSeconds']})
        media.append(f'<figure><video controls playsinline preload="metadata" src="{esc(item["file"])}"></video><figcaption>{esc(item["file"])} · {item["durationSeconds"]:.2f}s · 自然连续1倍</figcaption></figure>')
    shots = ''.join(figure(s['file'], s.get('caption', s['name'])) for s in report['screenshots'])
    sections.append(f'<h2>{title}</h2><div class="grid">{"".join(media)}</div><details><summary>实际截图（{len(report["screenshots"])}）</summary><div class="grid">{shots}</div></details><p><a href="{name}-evidence.json">夹具来源、逐帧时间与账本</a></p>')
status = json.loads((OUT / 'review-status.json').read_text())
assert status['sourceCommit'] == source
status_line = '内部逐帧审核完成，等待用户新包视觉复审。' if status['status'] == 'internal_reviewed_user_pending' else '内部审核进行中，尚未形成用户验收结论。'
page = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>展柜与机构返修 V0.4.2</title>
<style>body{{margin:0;background:#211232;color:#f3dfbe;font:16px/1.7 system-ui,sans-serif}}main{{max-width:1200px;margin:auto;padding:20px}}a{{color:#8ad9e0}}h1{{font-size:25px}}h2{{font-size:21px;border-top:1px solid #9b745b;padding-top:18px}}.notice{{padding:16px;border:2px solid #c99960;background:#3c254b}}.grid{{display:flex;flex-wrap:wrap;gap:15px}}figure{{margin:0 0 16px;width:min(100%,360px)}}figure img,figure video{{display:block;width:100%;height:auto;background:#170f25}}figure img{{image-rendering:pixelated}}video{{max-height:680px}}figcaption,code{{font-size:13px;overflow-wrap:anywhere}}summary{{padding:12px;cursor:pointer}}@media(max-width:500px){{main{{padding:12px}}}}</style>
<main><h1>展柜空间、连续胶带与铃铛接触 · V0.4.2</h1><p class="notice">{status_line}<br>439336已被真实手机反馈要求返修。本页新证据来自同一固定运行包；触控为桌面仿真，没有冒充物理手机或宣布最终美术通过。</p>
<p>运行源码 <code>{source}</code>；ZIP SHA256 <code>{package['sha256']}</code>；继续 <code>loststar.fusion.firstplanet.v037</code> 当前档。</p>
<p>本轮只改展柜空间与物件机制。经济、真实工作时钟、永久收藏与已购权益继续原模型；没有新收费或第二星球。</p>
<h2>旧版与新版实际房间</h2><div class="grid">{comparison}</div>
<p>柜体实体、通道、完整机器人轮廓、托盘、握点和前后层共用登记。门在自己的顶罩内收拢，机器人在侧前服务；物件先离开柜沿再取出。胶带只有一条有真实出口的带；铃只有独立帽杆运动，壳体和孔圈固定，触底后才发出声波。</p>
{''.join(sections)}
<h2>验证与限制</h2><p><a href="verification.json">构建／测试／固定包</a> · <a href="performance.json">两引擎实际绘制测量</a> · <a href="model-invariants.json">业务字节不变证明</a> · <a href="review-status.json">人工逐帧审核记录</a> · <a href="taptap-self-test.json">新TapTap自测版本</a></p>
<p>桌面性能不代表真实手机。TapTap视觉、实际锁屏恢复、发热和低端WebView仍须用户实机复审。旧版<a href="../v041-receipt-review/">V0.4.1证据</a>保留原SHA与用户返修状态，不拿旧影片充当新证明。PR #2保持Draft，不合并、不提审、不正式发布。</p></main></html>'''
(OUT / 'index.html').write_text(page)
(OUT / 'gallery-status.json').write_text(json.dumps({'sourceCommit': source, 'version': package['version'], 'zipSha256': package['sha256'], 'status': status['status'], 'physicalPhone': False, 'screenshots': sum(len(r['screenshots']) for r in reports.values()), 'materials': len(reports['screens']['materials']), 'videos': videos, 'reports': names}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'source': source, 'videos': len(videos)}))
