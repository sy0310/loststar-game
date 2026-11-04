#!/usr/bin/env python3
"""Build an offline-reviewable gallery from the actual refinement capture manifests."""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/refinement'
reports = [json.loads(path.read_text()) for path in sorted(OUT.glob('evidence-*.json'))]
if not reports:
    raise SystemExit('Capture evidence first')
sources = {report['sourceCommit'] for report in reports}
if len(sources) != 1:
    raise SystemExit('Mixed source commits in evidence')
source = next(iter(sources))
shots = {entry['file']: entry for report in reports for entry in report['shots']}
videos = {entry['file']: entry for report in reports for entry in report['videos']}
labels = {
    'touch-feedback-390': '点击与真实收获 · 390',
    'touch-feedback-360': '点击与真实收获 · 360',
    'idle-same-save-60s-live': '同档对照 · 挂机60秒',
    'assist-same-save-60s-live': '同档对照 · 点击60秒',
    'museum-robot-six-curios-live': '机器人整理与六件互动',
    'receipt-paid-ability-growth-live': '收据 · 本体能力成长',
    'tape-paid-ability-growth-live': '胶带 · 本体能力成长',
    'receipt-real-field-records-live': '收据 · 两份现场箱标',
    'sorting-discovery-build-work-live': '卡纸支线 · 实际开工作业',
    'sorting-night-defense-morning-resume-live': '夜班处置与清晨续工',
    'complete-day-night-cycle-live': '完整昼夜 · 连续运行',
    'webkit-360-touch-live': 'WebKit触控 · 360',
    'webkit-390-touch-live': 'WebKit触控 · 390',
    'reduced-motion-live': '减少动态 · 机器人整理',
}
sections = []
for file, entry in videos.items():
    label = labels.get(Path(file).stem, Path(file).stem)
    sections.append(f'<article><h3>{html.escape(label)}</h3><video controls playsinline preload="metadata" src="{html.escape(file)}"></video><p>{entry["durationSeconds"]:.1f}秒 · {entry["bytes"]/1024/1024:.2f} MiB</p></article>')
video_html = ''.join(sections)

def image_group(title, filenames):
    images = ''.join(f'<figure><a href="{file}"><img loading="lazy" src="{file}" alt="{html.escape(Path(file).stem)}"></a><figcaption>{html.escape(Path(file).stem)}</figcaption></figure>' for file in filenames if file in shots)
    return f'<section><h2>{title}</h2><div class="shots">{images}</div></section>'

image_html = image_group('主要页面', ['390-explore.png', 'webkit-390-radar.png', '390-collection.png', '390-base.png', '390-upgrades.png', '390-wallet.png'])
image_html += image_group('六件近景', [f'closeup-{id}.png' for id in ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']])
image_html += image_group('同容器 · 真实能力与动作', [f'{id}-ability-{level}.png' for id in ['receipt', 'tape'] for level in range(3)])
image_html += image_group('同一球体 · 卡纸支线', [f'sorting-{phase}.png' for phase in ['discovered', 'survey', 'construction', 'hauling', 'actual-label', 'clearing', 'cleared', 'permanent-refresh']])
image_html += image_group('现场证据与收据', ['receipt-source-labels-world.png', 'receipt-actual-two-records.png', 'receipt-actual-comparison.png'])
image_html += image_group('零件与结果', ['sorting-build-quote.png', 'sorting-compare-ui.png', 'sorting-compared.png', 'sorting-study.png', 'sorting-study-refunded.png', 'sorting-cleared-ui.png'])
image_html += image_group('三项实地观察', [f'sorting-study-{index}-{phase}.png' for index in range(1, 4) for phase in ['scene', 'result']] + ['sorting-free-record-review.png'])
image_html += image_group('夜班与恢复', [f'sorting-night-{at}.png' for at in ['0.5', '8', '19', '32', '47', '54', '65', '76']])
index = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>失物星球 · 首星返修审核</title>
<style>body{{margin:0;background:#171225;color:#efdfc7;font:15px/1.65 system-ui,sans-serif}}main{{max-width:1280px;margin:auto;padding:30px 20px}}h1,h2,h3{{color:#edc889}}h1{{font-size:27px}}h2{{margin-top:42px}}h3{{font-size:16px}}a{{color:#b5dfcd}}.stamp{{font:12px/1.7 monospace;overflow-wrap:anywhere}}.videos,.shots{{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}article,figure{{margin:0;padding:12px;background:#241b32;border:1px solid #72576f}}video{{display:block;width:100%;max-height:660px;background:#100e1c}}img{{display:block;width:100%;height:auto;image-rendering:pixelated}}figcaption,p{{font-size:12px;color:#bfb0c6}}nav{{display:flex;gap:20px;flex-wrap:wrap}}</style>
<main><h1>失物星球 · 首星返修审核</h1><p class="stamp">V0.3.5 · {source}</p><p>真实运行录屏与截图。画面为390×844、360×800桌面触控仿真，TapTap手机效果待扫码审核。配置样本由实际模型指令与工作推进生成，录像期间正常计时。</p><nav><a href="#animation">连续动画</a><a href="economy.md">经济验证</a><a href="performance.json">实际绘制采样</a><a href="economy.json">模型原始数据</a></nav><h2 id="animation">连续动画</h2><div class="videos">{video_html}</div>{image_html}<h2>已知边界</h2><p>本批完成收据、胶带两件本体能力和一个卡纸支线。老档约5分钟完成本批有限内容，长期成长需后续有实际玩法的节点。当前证据来自桌面Chromium/WebKit触控仿真，实机流畅度与触感等待TapTap复测。</p></main></html>'''
(OUT / 'index.html').write_text(index)
print(f'{len(shots)} screenshots, {len(videos)} continuous videos, source {source}')
