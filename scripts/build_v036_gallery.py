from pathlib import Path
from html import escape
import json

root = Path(__file__).resolve().parents[1]
output = root / 'artifacts/v036'
report = json.loads((output / 'evidence.json').read_text())
parts = ['''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>失物星球 V0.3.6 动作样板审核</title>
<style>body{margin:0;background:#171324;color:#efdfc9;font:15px/1.7 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:28px 20px}h1{font-size:26px}h2{margin-top:38px;color:#e0b37f}a{color:#d7beec}p{max-width:850px}.concepts{display:grid;grid-template-columns:1fr 1fr;gap:18px}.concepts img{width:100%;height:auto}.media{display:flex;overflow-x:auto;gap:14px;padding:10px 0}.media figure{margin:0;flex:0 0 260px}.media img,.media video{display:block;width:260px;height:auto;border:1px solid #745558}.media figcaption{font-size:12px;margin-top:7px;color:#b8a6be}code{color:#ebc28c}@media(max-width:700px){.concepts{grid-template-columns:1fr}.media figure{flex-basis:230px}.media img,.media video{width:230px}}</style>
<main><h1>失物星球 · V0.3.6 动作样板</h1>
<p>本轮按最新PR收敛为一处星雾和一件收据。概念原图与实际Canvas画面分别展示，动作样板使用隔离内存数据。手机亮度、触感和锁屏恢复由TapTap扫码复核。</p>''']
parts.append(f'<p>运行源码 <code>{escape(report["sourceCommit"])}</code>。全部视频使用正常时间，来自桌面浏览器原生触控仿真。</p>')
parts.append('''<h2>已认可概念原图</h2><div class="concepts">
<a href="../../design/v036/reference/失物星球探索流程概念图.png"><img src="../../design/v036/reference/失物星球探索流程概念图.png" alt="已认可的探索流程概念原图"></a>
<a href="../../design/v036/reference/失物星球_奇物修复展陈方案.png"><img src="../../design/v036/reference/失物星球_奇物修复展陈方案.png" alt="已认可的奇物修复展陈概念原图"></a></div>
<p>保留紫蓝与暖金、紫粉圆卷雾、原物材质、局部扫描与真实工具接触。球体沿用现有完整退货箱星，收据保留原卷纸身份、RET-031与空签栏，周边装饰和演出数量作了收敛。</p>''')
for case in report['cases']:
    name = escape(case['name'])
    parts.append(f'<h2>{name}</h2><div class="media">')
    video = escape(case['video']['file'])
    parts.append(f'<figure><video controls playsinline preload="metadata" src="{video}"></video><figcaption>连续实录 {case["video"]["seconds"]:.2f} 秒</figcaption></figure>')
    for frame in case['frames']:
        file = escape(frame['file'])
        phase = escape(frame['state']['study']['phase'])
        parts.append(f'<figure><a href="{file}"><img loading="lazy" src="{file}" alt="{name} {phase}"></a><figcaption>{phase} · 工作时间 {frame["seconds"]:.2f} 秒</figcaption></figure>')
    parts.append('</div>')
parts.append('''<h2>复现与审核记录</h2><p><a href="evidence.json">完整阶段、触控和存档访问记录</a> · <a href="performance.json">独占绘制采样</a> · <a href="../../docs/31_V036_ISOLATED_VISUAL_SAMPLES.md">实施、验收与待审范围</a></p></main></html>''')
(output / 'index.html').write_text('\n'.join(parts))
print(output / 'index.html')
