#!/usr/bin/env python3
"""Build one compact reviewer page from actual fixed-package media, never mock game art."""
from pathlib import Path
from html import escape
import json
root=Path('artifacts/ref-ui-unified')
e=json.loads((root/'evidence.json').read_text());edges=json.loads((root/'edge-states.json').read_text());receipt=json.loads((root/'taptap-receipt.json').read_text())
shots=e['screens']+[dict(r,width=r['viewport']['width'],height=r['viewport']['height']) for r in edges['rows']]
by={s['name']:s for s in shots}
by.update({'edge-'+r['name']:dict(r,width=r['viewport']['width'],height=r['viewport']['height']) for r in edges['rows']})
def shot(name,label=None):
 s=by[name];return f'<figure><a href="{s["file"]}"><img loading="lazy" src="{s["file"]}" alt="{escape(name)}"></a><figcaption>{escape(label or name)} · {s["width"]}×{s["height"]}</figcaption></figure>'
def movie(v):return f'<details class="movie"><summary>{escape(v["name"])} · {v["durationSeconds"]:.2f}秒</summary><video controls playsinline preload="metadata" src="{v["file"]}"></video></details>'
key=['chromium-390-fresh-world','chromium-390-night-card','chromium-390-collection','curio-receipt-found','curio-receipt-clean','curio-receipt-stabilized','chromium-390-base','edge-chromium-fresh-equipment','chromium-390-settings']
items={'receipt':'收据','tape':'胶带','nested':'套娃包裹','stamp':'邮戳','cosmic-parcel':'宇宙包裹','bell':'签收铃'}
statewall=''.join(f'<section><h3>{label}</h3><div class="three">'+''.join(shot(f'curio-{item}-{state}',label+' / '+name) for state,name in [('found','刚获得'),('clean','清理后'),('stabilized','升级完成')])+'</div></section>' for item,label in items.items())
pairs=[('探索','chromium-390-candidate-home-fresh.png','chromium-390-fresh-world'),('夜间事件','chromium-390-candidate-event-night.png','chromium-390-night-card'),('物件完成态','chromium-390-candidate-curio-owned.png','curio-receipt-stabilized'),('设备','chromium-390-equipment.png','edge-chromium-fresh-equipment')]
compare=''.join(f'<h3>{title}</h3><div class="two"><figure><img loading="lazy" src="../ref-ui-sample/screens/{old}"><figcaption>上次退修72374bc</figcaption></figure>{shot(new,"本次35b3e46")}</div>' for title,old,new in pairs)
html=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>失物星球 · 统一主题与整图轻整理待审</title><style>
*{{box-sizing:border-box}}body{{max-width:1100px;margin:0 auto;padding:20px;background:#1c1730;color:#f3ebde;font:15px/1.7 system-ui}}a{{color:#e8c57d}}h1{{font-size:24px}}h2{{font-size:19px;margin-top:28px}}h3{{font-size:16px}}code{{overflow-wrap:anywhere}}.wall{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}}.three,.two{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}.two{{grid-template-columns:repeat(2,1fr)}}figure{{margin:0}}img{{display:block;width:100%;height:auto}}figcaption{{font-size:12px;overflow-wrap:anywhere}}details{{margin:14px 0;padding:12px;background:#30283e;border:1px solid #6a5a76;border-radius:8px}}summary{{cursor:pointer;min-height:32px}}video{{display:block;width:100%;max-width:390px;margin:12px auto}}.note{{color:#beafca}}table{{border-collapse:collapse;width:100%}}td,th{{padding:8px;border-bottom:1px solid #6a5a76;text-align:left}}
</style><h1>统一紫灰主题 · 整图轻整理</h1><p><b>开发自测 {receipt['taptapVersion']} / {receipt['version']}，待用户视觉与真机审核。</b><br>这份样板只用内存，刷新重建示例；正式v037档案和主包未改。</p><p>运行源码 <code>{e['sourceCommit']}</code><br>固定ZIP {e['package']['bytes']:,}B / {e['package']['files']}文件，SHA256 <code>{e['package']['sha256']}</code></p><p><a href="../../design/v045_a_simplified_exploration/UI_UNIFIED_DELIVERY.md">短交付说明</a> · <a href="../../design/visual-renewal/VISUAL_COVERAGE.md">原181项权威对照</a> · <a href="independent-review.md">内部复核与边界</a></p>
<h2>先看这九屏</h2><div class="wall">{''.join(shot(n) for n in key)}</div>
<h2>连续过程</h2><p class="note">实际固定包、不快进、无音轨。六件分别来自按原模型赚得足够零件的独立审核快照，未拼成一次新档。点击展开视频。</p>{''.join(movie(v) for v in e['videos'])}
<details><summary>六件奇物 · 18张实际状态页面（原18素材不重画）</summary>{statewall}</details>
<details><summary>上次退修 / 本次实际页面对照</summary><p class="note">历史旧包与新固定包，非同毫秒/同动作/同余额，只比较皮肤和布局，不比较收益。</p>{compare}</details>
<details><summary>全部可达与边界截图 · {len(shots)}张</summary><div class="wall">{''.join(shot(s['name']) for s in shots)}</div></details>
<h2>验证及待测</h2><p>422单测、72样板浏览器流程通过；360×800、390×844、桌面、低屏大字、Chromium/WebKit。旧付费任务、原价、预览隔离、后台完成、去重、失败重试及已购读图能力均覆盖。工程通过不等于美术或真机通过。</p><p>真机刘海/宿主控件、触控、锁屏、声音、长期热度尚未实测；未接正式持久化入口。短测性能与背景房间仍绘制的限制见<a href="performance-summary.md">原始性能范围</a>。</p><p><a href="evidence.json">148图/8片原始记录</a> · <a href="edge-states.json">15个边界截图与账本</a> · <a href="verification.json">完整性复核</a> · <a href="checks/browser-results.json">72流程原报告</a> · <a href="native-media-review.json">8片原生1倍播放记录</a> · <a href="taptap-receipt.json">TapTap回读</a> · <a href="https://github.com/sy0310/loststar-game/pull/2/checks">当前PR检查</a></p></html>'''
(root/'index.html').write_text(html)
print('Compact actual-media gallery:',len(shots),'screens,',len(e['videos']),'films')
