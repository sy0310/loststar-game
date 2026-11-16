"""Build the V0.3.8 review page from measured package evidence."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts/v038-feedback'
reports = {name: json.loads((out / f'{name}-evidence.json').read_text()) for name in ('screens', 'compare', 'world')}
performance = json.loads((out / 'performance.json').read_text())
package = json.loads((out / 'package-info.json').read_text())
upload = json.loads((out / 'taptap-self-test.json').read_text())
e = html.escape

def figure(file, caption):
    if not (out / file).is_file():
        raise FileNotFoundError(file)
    return f'<figure><a href="{e(file)}"><img loading="lazy" src="{e(file)}" alt="{e(caption)}"></a><figcaption>{e(caption)}</figcaption></figure>'

def video(file, caption):
    if not (out / file).is_file():
        raise FileNotFoundError(file)
    return f'<figure class="movie"><video controls preload="metadata" playsinline src="{e(file)}"></video><figcaption>{e(caption)}</figcaption></figure>'

used = set()
def frames(items):
    result = []
    for name, caption in items:
        file = f'screens/{name}.png'
        used.add(file)
        result.append(figure(file, caption))
    return '<div class="frames">' + ''.join(result) + '</div>'

comparisons = []
for case in reports['compare']['cases']:
    for measurement in case['measurements']:
        trace = measurement['trace']
        first, last = trace[0], trace[-1]
        comparisons.append({
            'pair': case['name'], 'source': measurement['source'], 'input': measurement['input'],
            'accepted': last['accepted'] - first['accepted'], 'appliedWorkMs': round(last['applied'] - first['applied']),
            'pendingWorkMs': round(last['pending']), 'cycles': last['cycles'] - first['cycles'],
            'grossIncome': last['grossIncome'] - first['grossIncome'], 'balance': last['balance'],
            'firstDiscoveryMs': measurement['firstDiscoveryMs'], 'uniqueRewards': measurement['uniqueRewards'],
        })
(out / 'comparison-summary.json').write_text(json.dumps(comparisons, ensure_ascii=False, indent=2) + '\n')
rows = ''.join(f'<tr><td>{e(c["pair"])}</td><td>{e(c["source"])} / {e(c["input"])}</td>'
               f'<td>{c["accepted"]}</td><td>{c["appliedWorkMs"]} ms</td><td>{c["cycles"]}</td>'
               f'<td>{c["grossIncome"]}</td><td>{c["firstDiscoveryMs"] / 1000:g} s</td></tr>' for c in comparisons)
perf_rows = ''.join(f'<tr><td>{e(c["engine"])}</td><td>{e(c["view"])}</td>'
                    f'<td>{c["scene"]["medianFrameMs"]:.1f} ms</td><td>{c["scene"]["p95FrameMs"]:.1f} ms</td></tr>'
                    for c in performance['cases'])

content = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>失物星球 V0.3.8 · 实际返修审核</title>
<style>
:root{{color-scheme:dark;background:#171320;color:#f0e6d0;font:16px/1.7 system-ui,sans-serif}}
body{{max-width:1160px;margin:auto;padding:24px}}h1,h2{{line-height:1.3;color:#f7d49b}}h2{{margin-top:56px}}
a{{color:#c2d8d4}}p{{max-width:900px}}code{{word-break:break-all}}nav{{display:flex;flex-wrap:wrap;gap:16px}}
.frames{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}}figure{{margin:0;padding:10px;background:#272031;border:1px solid #6b5563}}img{{width:100%;height:auto;display:block}}figcaption{{font-size:13px;color:#d0c4b9;padding:8px 2px}}
.movie{{margin:20px 0}}video{{display:block;width:100%;max-height:850px;background:#12101c}}
table{{border-collapse:collapse;width:100%;font-size:14px}}th,td{{padding:10px;text-align:left;border-bottom:1px solid #6b5563}}.scroll{{overflow:auto}}summary{{cursor:pointer;color:#e4c490}}.note{{border-left:3px solid #aa879d;padding:10px 18px;background:#241d2d}}
</style>
<h1>V0.3.8 远征反馈返修</h1>
<p>运行源码 <code>{e(package['sourceCommit'])}</code> · TapTap 开发自测 <strong>{upload['h5VersionId']}</strong>。
沿用V0.3.7当前周目、收藏、设备、雾种子与已付费权益。本轮仅处理机器人助力、区域星雾和重复分拣设施。</p>
<nav><a href="http://127.0.0.1:4224/">运行已上传包</a><a href="https://github.com/sy0310/loststar-game/pull/2">Draft PR #2</a><a href="../../docs/34_V038_EXPEDITION_FEEDBACK_REPAIR.md">完整记录</a></nav>
<p class="note">以下来自桌面浏览器360×800／390×844触控仿真。录像采用自然墙钟，没有加速浏览器时间。审阅状态由真实模型赚取、发现和购买后生成，未打开或清除用户浏览器档案。真实TapTap手机蓝闪、亮度、触控与后台恢复仍需扫码复测。</p>
<h2>1 · 助力收到、实际加快、真实入账</h2>
<p>点按后眼灯与手部短促应答；实际助力被消费时，步频、路径与扫描摆扫共同加快。拾取、搬运、卸货保留完整动作。左右画面分别独立运行，最终视频只做起点对齐与并排。</p>
{video('new-idle-assist-390-30s.mp4', '390×844 · 同档30秒：左挂机，右助力。实际点击15次，应用9秒工作；2趟／3趟到货。')}
{video('new-idle-assist-360-30s.mp4', '360×800 · 同档30秒：左挂机，右助力。未增加奖励或改变助力上限。')}
{video('old-new-assist-390-30s.mp4', '同档30秒：左旧版b7f7326，右新版2fdbebe。相同输入、3趟到货、24零件，首发现均为9秒。')}
<div class="scroll"><table><thead><tr><th>对照</th><th>版本／输入</th><th>接受</th><th>消费工作</th><th>到货</th><th>毛收入</th><th>首发现</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>到货依据存档cycle递增记录，输入特效本身不发奖。<a href="compare-evidence.json">逐100ms原始轨迹及实际绘制诊断</a> · <a href="comparison-summary.json">摘要</a></p>
<h2>2 · 星雾成为区域，继续原有探索进度</h2>
<p>旧宽94／122／220，新宽156／196／274逻辑像素；三处实际锚点、种子、显露时间保持不变。阴影、反光、轮廓、开孔和点击遮罩同步调整，球体边缘使用原支持遮罩。</p>
{frames([
 ('chromium-390-unrevealed-legacy','390 · 原尺度，未揭晓'),('chromium-390-unrevealed-regional','390 · 区域尺度，未揭晓'),
 ('chromium-390-partial-legacy','390 · 原尺度，部分揭晓'),('chromium-390-partial-regional','390 · 区域尺度，部分揭晓'),
 ('chromium-360-unrevealed-regional','360 · 区域尺度，未揭晓'),('chromium-360-partial-regional','360 · 区域尺度，部分揭晓'),
 ('chromium-390-revealed-regional','390 · 全揭晓，真实地表实体'),('chromium-390-night-regional','390 · 同档自然夜景，之前的揭晓仍保留')])}
{video('surface-dissolve-45s.mp4', '45秒自然挂机：同一初始档案，三处星雾随真实探索工作消散，刷新继续。')}
<h2>3 · 一座收件站、一台任务分拣机、一处安保灯架</h2>
<p>原球体底图只有地貌、纸箱、管线与后缘雷达。重复来自基础层旧机和融合层任务机。保留410、315的同一任务机；568、294原位改为细安保灯架。灯头与夜间光源共用559、208。白天不再显示夜巡收容匣。</p>
{frames([('old-revealed-machines-390','旧版组合：基础机与任务机同时出现'),('new-revealed-machines-390','新版组合：任务机、细灯架、单一机器人'),
 ('chromium-390-sorting-jammed','同一任务机 · 卡纸'),('chromium-390-sorting-building','同一任务机 · 实际付费施工'),('chromium-390-sorting-cleared','同一任务机 · 完工')])}
<details><summary>展开原始来源隔离图</summary><p>下图仅在旧版审查上下文阻止指定贴图的drawImage，其他阴影和特效可继续存在。它们用于定位来源，不代表玩家最终画面。</p>
{frames([('old-source-isolation-legacy-sorter-390','只关闭基础旧机贴图'),('old-source-isolation-layered-sorter-390','只关闭融合任务机贴图'),('old-source-isolation-robot-390','只关闭机器人图集')])}
<p><a href="../../assets/runtime/parcel-globe.webp">原始运行时球图</a> · <a href="screens-evidence.json">来源命中、被阻止次数、任务与账本</a></p></details>
<h2>4 · 夜间仍有真实巡守和清晨结算</h2>
<p>保留夜巡使用的时间轴与收容匣。夜间点击仅关注事件，不增加白天助力或直接奖励。视频从第一夜第6秒开始，自然运行至清晨；此前三处揭晓来自同一档案，未伪造“未探索夜景”。</p>
{video('night-morning-70s.mp4','70秒连续夜间→清晨：巡守、安保灯与飞船参与，清晨结算，随后原档刷新。')}
<h2>5 · 测试与性能</h2>
<p>20/20真实原件、47文件298项单测、五种生产构建、394项浏览器流程通过。另有6组最终包新玩家／已有付费档案烟测。已有余额、收藏、能力、分拣权益、雾种子和源备份继续保留。</p>
<p>Apple M2 Pro，390×844，DPR2，单浏览器单页面，无录屏；预热1.5秒，采样10秒。下表为实际绘制间隔，不能代表手机性能。</p>
<table><thead><tr><th>引擎</th><th>场景</th><th>中位数</th><th>P95</th></tr></thead><tbody>{perf_rows}</tbody></table>
<p>ZIP {package['bytes']:,} 字节，展开{package['uncompressedBytes']:,}字节／{package['files']}文件。新增机器人复合Canvas仅复用一个256×224透明缓冲，点击时按版本重读Alpha。GPU与贴图常驻内存未测。</p>
<nav><a href="verification.json">验证摘要</a><a href="check.log">完整本地日志</a><a href="e2e-results.json">394项浏览器结果</a><a href="package-smoke.json">最终包烟测</a><a href="performance.json">性能原值</a><a href="package-info.json">包信息</a><a href="taptap-self-test.json">脱敏上传核验</a><a href="world-evidence.json">连续世界与刷新结果</a></nav>
'''
all_screens = [item for report in reports.values() for item in report['screenshots']]
remaining = [item for item in all_screens if item['file'] not in used]
content += f'<h2>完整截图索引</h2><details><summary>其余{len(remaining)}张（总计{len(all_screens)}张）</summary><div class="frames">'
content += ''.join(figure(item['file'], item['file'].removeprefix('screens/')) for item in remaining)
content += '</div></details></html>\n'
(out / 'index.html').write_text(content)
print(f'Gallery built: {len(all_screens)} screenshots, 5 videos, {len(comparisons)} measured comparisons')
