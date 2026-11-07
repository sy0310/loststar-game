"""Build a local review gallery from recorded first-planet evidence."""
from pathlib import Path
from html import escape
import json

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts' / 'first-planet'
package = json.loads((out / 'package-info.json').read_text())
images = sorted((out / 'screens').glob('*.png'))

def figure(path):
    return f'<figure><img loading="lazy" src="screens/{escape(path.name)}" alt="{escape(path.stem)}"><figcaption>{escape(path.stem)}</figcaption></figure>'

videos = ''.join(f'<article><h3>{escape(path.stem)}</h3><video controls preload="metadata" playsinline src="{escape(path.name)}"></video></article>' for path in sorted(out.glob('*.mp4')))
reference = ['失物星球探索流程概念图.png', '失物星球_奇物修复展陈方案.png']
concepts = ''.join(f'<figure><img loading="lazy" src="../../design/v036/reference/{escape(name)}" alt="认可概念原图"><figcaption>{escape(name)}</figcaption></figure>' for name in reference)
html = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>失物星球 V0.3.7 首星游玩审核</title>
<style>*{{box-sizing:border-box}}body{{margin:0;background:#171326;color:#eadcba;font:16px/1.65 system-ui,sans-serif}}main{{max-width:1400px;padding:30px;margin:auto}}h1,h2,h3{{line-height:1.25}}h2{{margin-top:46px;border-bottom:1px solid #8f7151;padding-bottom:12px}}p{{max-width:960px}}a{{color:#edd09c}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}}figure,article{{margin:0;padding:12px;background:#292038;border:1px solid #725b67}}figure img{{width:100%;height:auto;display:block}}figcaption{{word-break:break-word;font-size:13px;color:#c7b9ca;margin-top:10px}}video{{width:100%;max-height:730px;background:#100c1b}}.tag{{display:inline-block;border:1px solid #9a7f59;padding:5px 12px;margin:5px 10px 5px 0}}.concepts img{{max-height:720px;object-fit:contain}}code{{overflow-wrap:anywhere}}</style>
<main><h1>失物星球 V0.3.7</h1><p>退货箱星的真实新周目。认可样板已接入探索、整理、收藏和基地。</p><p><span class="tag">v{escape(package['version'])}</span><span class="tag">{escape(package['sourceCommit'][:7])}</span><span class="tag">Draft PR #2</span></p>
<p>新周目从120零件、初始设备和空收藏开始。旧源保持原值并在同源可访问时备份。刷新继续当前周目。</p>
<p>本页是桌面浏览器移动触控仿真证据。首发现与整理90秒、完整昼夜310秒均为自然时间连续实录。六奇物及展柜0–3级使用真实模型加速赚取和付款的审阅夹具，详细审计保存在 screens-evidence.json。它们与实际试玩新档分开。</p>
<p><a href="http://127.0.0.1:4221/">打开新周目游戏</a> · <a href="https://github.com/sy0310/loststar-game/pull/2">Draft PR #2</a> · <a href="economy.md">经济平衡表</a> · <a href="performance.json">浏览器测量</a></p>
<h2>连续动画与交互</h2><div class="grid">{videos}</div>
<h2>实际页面与近景</h2><div class="grid">{''.join(figure(path) for path in images)}</div>
<h2>已认可概念原图</h2><p>运行时使用独立分层素材、原纸网格与玻璃前后层。工具接触、污层和真实费用由当前存档动作驱动。</p><div class="grid concepts">{concepts}</div>
<h2>验证边界</h2><p>当前只有退货箱星。三处雾与已有真实锚点相连，雾形由种子持久化。收据、胶带已有I/II实际能力，其余四件保留物理整理与独立试验。整理台使用已校准基础罩，基地和工程近景呈现购买的展柜等级。完整真机性能、锁屏恢复与视觉验收等待本包扫码复测。</p></main></html>'''
(out / 'index.html').write_text(html)
print(f'Wrote {len(images)} screenshots and {len(list(out.glob("*.mp4")))} videos')
