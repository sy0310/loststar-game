#!/usr/bin/env python3
"""Build the source-frozen fusion review gallery from real capture receipts."""
from pathlib import Path
from html import escape
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/fusion'
def read(name): return json.loads((OUT/name).read_text())
recordings=read('recordings.json'); comparison=read('comparison.json'); validation=read('validation.json')
source=recordings['sourceCommit']
assert source==comparison['sourceCommit']==validation['sourceCommit']
assert not recordings['errors'] and not comparison['errors']
labels={
 'exploration-upgrade-live.mp4':'新手实际出货、助力与升级',
 'receipt-restoration-live.mp4':'同一收据：出土、清理、修补与真实线索',
 'night-basic-live.mp4':'基础安保：三次来访、损伤与清晨维修',
 'night-strong-live.mp4':'完善安保：同一星球的实际处置',
 'day-night-cycle-live.mp4':'完整昼夜310秒 · 1倍墙钟',
 'museum-projects-live.mp4':'基地机器人连续整理、六件近景与三个工程',
 'case-upgrades-live.mp4':'真实购买六柜升级与免费前后对照',
 'archive-replay-live.mp4':'原配置、原回执的60秒夜班归档回放',
 'curio-tape-live.mp4':'道歉胶带：清理、修补与试验',
 'curio-nested-live.mp4':'套娃包裹：清理、修补与试验',
 'curio-stamp-live.mp4':'昨天邮戳：清理、修补与试验',
 'curio-cosmic-parcel-live.mp4':'收件人：宇宙：清理、修补与试验',
 'curio-bell-live.mp4':'无人签收铃：清理、修补与试验',
}
parts=['''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>失物星球 · 融合版审核</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#141020;color:#f5ead6}body{max-width:1200px;margin:auto;padding:28px 20px}h1{font-size:27px}h2{margin-top:44px;color:#edc879}p{line-height:1.7;color:#c7bed2}a{color:#eac674}nav{display:flex;flex-wrap:wrap;gap:14px;padding:16px 0;border-block:1px solid #54415b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(265px,1fr));gap:20px}.card{background:#21192d;border:1px solid #59445f;padding:12px;border-radius:6px}video{max-height:630px;width:100%;background:#090713}img{display:block;width:100%;height:auto}figcaption{line-height:1.5;margin:8px 0}small{color:#b5a6be}table{border-collapse:collapse;font-size:13px;width:100%}th,td{padding:9px;border:1px solid #54415b;text-align:left}details{margin-top:20px}summary{cursor:pointer;padding:14px;background:#302239}.overflow{overflow:auto}.badge{display:inline-block;padding:5px 9px;background:#443349;color:#f2cb7c}.meta{font-size:13px}figure{margin:0}button{font:inherit}
</style><h1>失物星球 · 简洁探索融合版</h1>''']
parts.append(f'<p class="meta">V0.3.4 · 运行源码 <code>{source}</code><br>移动浏览器触控仿真 · 实际生产压缩包 · Draft PR #2</p>')
parts.append('<p>探索／收藏／基地已经接成真实可玩的循环。下方视频以1倍墙钟连续录制，配置状态与新手画面分开注明。真实TapTap手机触控、锁屏、亮度和发热仍待扫码审核。</p><nav><a href="#videos">连续动画</a><a href="#screens">竖屏截图</a><a href="#comparison">挂机／主动</a><a href="#checks">验证与经济</a><a href="http://127.0.0.1:4207/">本机可玩预览</a><a href="https://github.com/sy0310/loststar-game/blob/codex/v0.1-vertical-slice/docs/28_V034_FUSION_DELIVERY.md">完整交付说明</a></nav>')
parts.append('<h2 id="videos">连续动画 · 同一生产包</h2><div class="grid">')
for item in recordings['videos']:
 file=item['file']; context=next(e for e in recordings['entries'] if e['name']==item['context'])
 desc='全新存档，无预置权益' if context['fixture']=='fresh new player' else f'受控配置：{context["fixture"]}，详情见录制回执'
 parts.append(f'<figure class="card"><video controls playsinline preload="none" src="{escape(file)}"></video><figcaption>{escape(labels[file])}</figcaption><small>{escape(desc)} · {float(item["probe"]["format"]["duration"]):.2f}秒</small></figure>')
parts.append('</div><h2 id="screens">390×844实际运行截图</h2><div class="grid">')
for file,label in [('390-explore.png','探索首屏'),('390-upgrades-after.png','主升级'),('390-collection.png','收藏与分类'),('390-base.png','基地分层收藏室'),('390-workshop.png','永久建设'),('390-radar.png','星图与真实雷达'),('390-research-active.png','定向调查'),('night-basic-receipt.png','清晨真实损伤与维修'),('project-side-light.png','取证台：侧光比对'),('project-habitat-window.png','居民观察窗'),('archive-replay-25.png','原夜班归档回放'),('cases-paid-tier3.png','六件展柜真实付费结构')]:
 parts.append(f'<figure class="card"><img loading="lazy" src="{file}"><figcaption>{label}</figcaption></figure>')
parts.append('</div><details><summary>六件玻璃藏品近景</summary><div class="grid">')
for id,label in [('receipt','收据'),('tape','胶带'),('nested','套娃'),('stamp','邮戳'),('cosmic-parcel','宇宙包裹'),('bell','签收铃')]:
 parts.append(f'<figure class="card"><img loading="lazy" src="closeup-{id}.png"><figcaption>{label}</figcaption></figure>')
parts.append('</div></details><h2 id="comparison">同初始状态60秒 · 挂机与原生触控</h2><p>左／右顺序如下；初始均为120零件、零工作、零升级。无购买，无加速时钟。输入被系统过滤后按实际工作结算，视频剪除开场等待，数据使用真实引擎时间。</p><div class="grid">')
cn={'idle':'纯挂机','slow':'每10秒1次','burst':'每12.1秒5次','fast':'每秒8次'}
for video in comparison['videos']:
 parts.append(f'<figure class="card"><video controls playsinline preload="none" src="{video["file"]}"></video><figcaption>左：{cn[video["left"]]} ／ 右：{cn[video["right"]]}<br>{video["file"].split("-")[1]}宽竖屏</figcaption></figure>')
parts.append('</div><div class="overflow"><table><tr><th>宽度／输入</th><th>尝试／接受／拒绝</th><th>排入／应用／余量ms</th><th>完成／余额</th><th>首件时间</th></tr>')
for r in sorted(comparison['results'],key=lambda r:(r['width'],r['mode'])):
 parts.append(f'<tr><td>{r["width"]} / {cn[r["mode"]]}</td><td>{r["attempted"]} / {r["accepted"]} / {r["discarded"]}</td><td>{r["enqueued"]} / {r["applied"]} / {r["pending"]}</td><td>{r["cycles"]} / {r["parts"]}</td><td>{r["firstDiscoveryMs"]/1000:.2f}秒</td></tr>')
parts.append('</table></div><h2 id="checks">验证与经济</h2>')
parts.append(f'<p>20/20原始素材 · {validation["unitTests"]}项单元 · {validation["browserTests"]}项浏览器流程 · 四种构建。16路手势回归包含长按、双指、滚动和夜间只聚焦。连续录制与对照均无页面或控制台错误。</p>')
parts.append('<p>160组实际引擎模拟、1440行结果，覆盖新手、27,049旧权益、建设与调查、自动维修开关以及8／24／72小时离线。安全账目通过，长期消费吸引力仍需实玩审核。</p><p><a href="assist-economy.md">点击工作与经济表</a> · <a href="economy.md">统一消费与离线表</a> · <a href="validation.json">总验证回执</a> · <a href="recordings.json">录制原始清单</a> · <a href="comparison.json">同档对照数据</a> · <a href="package-smoke.json">相对路径包回归</a> · <a href="performance.json">桌面性能采样</a> · <a href="taptap-readback.json">TapTap上传读回</a></p>')
parts.append('<details><summary>全部截图与操作阶段</summary><div class="grid">')
for shot in recordings['shots']:
 parts.append(f'<figure class="card"><img loading="lazy" src="{shot["file"]}"><figcaption>{escape(shot["file"])}</figcaption><small>{shot["context"]} · {shot["at"]/1000:.1f}秒</small></figure>')
parts.append('</div></details><p>素材与录像用于首星设计审核，开发自测二维码在本机会话中私密交付。尚未取得本轮手机验收结果，未宣告设计冻结。</p></html>')
(OUT/'index.html').write_text(''.join(parts))
print('gallery generated',source)
