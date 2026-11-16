#!/usr/bin/env python3
"""Compact review of the three requested phone follow-ups, from actual fixed media."""
from pathlib import Path
from html import escape
import json

root = Path('artifacts/ref-ui-followup')
e = json.loads((root / 'evidence.json').read_text())
receipt = json.loads((root / 'taptap-receipt.json').read_text())
shots = {s['name']: s for s in e['screens']}


def shot(name, label=None):
    s = shots[name]
    return f'<figure><a href="{s["file"]}"><img loading="lazy" src="{s["file"]}" alt="{escape(name)}"></a><figcaption>{escape(label or name)}</figcaption></figure>'


items = dict(receipt='收据', tape='胶带', nested='套娃包裹', stamp='邮戳', **{'cosmic-parcel': '宇宙包裹', 'bell': '签收铃'})
states = ''.join(f'<h3>{label}</h3><div class="three">' + ''.join(shot(f'{item}-{state}', label + ' / ' + name) for state, name in [('found', '刚获得'), ('clean', '清理后'), ('stabilized', '升级完成')]) + '</div>' for item, label in items.items())
movies = ''.join(f'<details><summary>{escape(v["name"])} · {v["durationSeconds"]:.2f}秒</summary><video controls playsinline preload="metadata" src="{v["file"]}"></video></details>' for v in e['videos'])
html = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>失物星球 · 手机反馈三项调整</title><style>
*{{box-sizing:border-box}}body{{max-width:1050px;margin:auto;padding:20px;background:#1c1730;color:#f3ebde;font:15px/1.7 system-ui}}a{{color:#e8c57d}}h1{{font-size:24px}}h2{{font-size:19px}}h3{{font-size:16px}}code{{overflow-wrap:anywhere}}.wall{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}}.three{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}figure{{margin:0}}img{{display:block;width:100%}}figcaption{{font-size:12px;overflow-wrap:anywhere}}details{{margin:14px 0;padding:12px;background:#30283e;border:1px solid #6a5a76;border-radius:8px}}summary{{cursor:pointer;min-height:32px}}video{{display:block;width:100%;max-width:390px;margin:12px auto}}.note{{color:#beafca}}
</style><h1>居民观察 · 即点清理 · 单物件大图</h1><p><b>TapTap开发自测 {receipt['taptapVersion']} / {receipt['version']} · 新版待手机复审。</b><br>保留上版已认可方向，仍为内存隔离样板；刷新重建示例，不读写正式v037存档。</p><p>源码 <code>{e['sourceCommit']}</code><br>ZIP {e['package']['bytes']:,}字节 / {e['package']['files']}文件，SHA256 <code>{e['package']['sha256']}</code></p>
<p>收藏室的「居民观察」可查看已发现的三位居民和原生态动作；清理点击即完成，按原价只扣一次；默认详情只留当前物件大图。升级仍保留原费用与耗时，三态原画不变。</p><p><a href="../../design/v045_a_simplified_exploration/UI_PHONE_FOLLOWUP_DELIVERY.md">交付与边界</a> · <a href="../../design/visual-renewal/VISUAL_COVERAGE.md">原181项要求表</a></p>
<h2>这次改动</h2><div class="wall">{''.join(shot(n) for n in ['residents-entry','residents-list','resident-mouse-greeting','receipt-found','receipt-clean','receipt-stabilized'])}</div>
<h2>实际连续过程</h2><p class="note">固定ZIP、自然1倍、无音轨。六物分别来自按原模型赚得资源的审核快照，不是同一新档或收益演示。每片含即时清理、原耗时升级和免费互动；另两片展示居民入口及跨页返回。</p>{movies}
<details><summary>六物18态 · 实际详情页面</summary>{states}</details>
<details><summary>全部41张 · 含360×800、WebKit390×844、未发现居民空态</summary><div class="wall">{''.join(shot(n) for n in shots)}</div></details>
<h2>验证与待测</h2><p>432单测、80项样板浏览器流程通过（360×800、390×844、桌面，Chromium/WebKit；触控为模拟）。新包真机触控、宿主安全区、锁屏返回、音效、发热待扫码测试。工程通过不代表美术或真机通过。尚未开始首星内容扩容。</p><p><a href="verification.json">固定包完整性与原价记录</a> · <a href="checks/browser-results.json">80流程原报告</a> · <a href="native-media-review.json">原生1倍播放记录</a> · <a href="independent-review.md">独立复核与已修复缺陷</a> · <a href="evidence.json">完整原始记录</a> · <a href="taptap-receipt.json">TapTap回读</a> · <a href="../ref-ui-unified/index.html">上一版35b3e46历史主题证据（非本包证明）</a> · <a href="https://github.com/sy0310/loststar-game/pull/2/checks">PR检查</a></p></html>'''
(root / 'index.html').write_text(html)
print('Follow-up actual-media gallery: 41 screens / 8 movies')
