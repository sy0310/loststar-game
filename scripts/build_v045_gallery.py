#!/usr/bin/env python3
"""Small V045 A review index. Real approved originals, actual package evidence.

No capture/build/browser is launched. Refuse to relabel historical V044 frames
as current, or to generate a current-source index before all actual reports.
"""
import hashlib
import html
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("RENEWAL_OUTPUT", ROOT / "artifacts/v045-a-exploration")).resolve()
assert OUT.is_relative_to((ROOT / "artifacts/v045-a-exploration").resolve()), "Write only this V045 artifact batch"
MODES = ("screens", "night", "collection", "assist", "museum", "cases")
IDS = ("receipt", "tape", "nested", "stamp", "cosmic-parcel", "bell")
NAMES = ("退货收据", "道歉胶带", "套娃包裹", "昨日邮戳", "收件人：宇宙", "无人签收铃")
STAGES = ("found", "clean", "stabilized")
STAGE_NAMES = ("刚获得", "清理后", "升级完成")
BASELINE_SOURCE = "7074cff043a239771acae1f0b7133db1225f797a"
BASELINE_ZIP = "0df17916b640f7e28226f61b40279efb313e05810a57565ef493e17d28fc9349"
APPROVED = ROOT / "design/v045_a_simplified_exploration"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def relative(path):
    return os.path.relpath(path, OUT).replace(os.sep, "/")


def esc(value):
    return html.escape(str(value), quote=True)


def evidence(file):
    resolved = (OUT / file).resolve()
    assert resolved.is_relative_to(OUT) and resolved.is_file(), f"Missing/unsafe current evidence: {file}"
    return resolved


metadata = read_json(ROOT / "releases/taptap/package-info-fusion.json")
assert metadata["version"] == "0.4.5", "Freeze the actual V045 package before building its review index"
source, zip_sha = metadata["sourceCommit"], metadata["sha256"]
archive = (ROOT / metadata["archive"]).read_bytes()
assert len(archive) == metadata["bytes"] and sha(archive) == zip_sha
reports, report_hashes = {}, {}
for mode in MODES:
    path = OUT / f"{mode}-evidence.json"
    raw = path.read_bytes()
    report = json.loads(raw)
    assert report["mode"] == mode and report["version"] == "0.4.5"
    assert report["sourceCommit"] == source and report["zipSha256"] == zip_sha and report["sourceClean"] is True
    assert report["complete"] and not report["errors"] and report["clockOverrides"] is False
    assert report["physicalPhone"] is False and all(case["complete"] for case in report["cases"])
    assert all(not case.get("errors") for case in report["cases"])
    assert report["initialGuard"]["runtimeTreeHash"] == report["finalGuard"]["runtimeTreeHash"]
    reports[mode] = report
    report_hashes[f"{mode}-evidence.json"] = sha(raw)
assert len(reports["screens"]["materials"]) == 18
assert len({item["rgbaSha256"] for item in reports["screens"]["materials"]}) == 18
assert len(reports["collection"]["cases"]) == 6 and len(reports["collection"]["videos"]) == 6
assert len(reports["night"]["videos"]) == len(reports["assist"]["videos"]) == 1
assert len(reports["museum"]["cases"]) == len(reports["museum"]["videos"]) == 3
assert len(reports["cases"]["cases"]) == len(reports["cases"]["videos"]) == 1

media = []
for mode, report in reports.items():
    for kind in ("screenshots", "materials", "videos"):
        for item in report[kind]:
            raw = evidence(item["file"]).read_bytes()
            assert sha(raw) == item["sha256"] and len(raw) == item["bytes"], item["file"]
            if kind == "videos":
                assert item["speed"] == 1 and item["audioRecorded"] is False
            media.append({"file": item["file"], "kind": kind, "mode": mode, "sha256": item["sha256"], "bytes": item["bytes"]})

manifest = read_json(APPROVED / "manifest.json")
assert len(manifest["images"]) == 4
for item in manifest["images"]:
    raw = (ROOT / item["path"]).read_bytes()
    assert len(raw) == item["bytes"] and sha(raw) == item["sha256"], "Approved reference original changed"

baseline_root = ROOT / "artifacts/v044-execution-art"
baseline_report = read_json(baseline_root / "current-art-comparison.json")
assert baseline_report["sourceCommit"] == BASELINE_SOURCE and baseline_report["zipSha256"] == BASELINE_ZIP
old_home = next(item for item in baseline_report["screenshots"] if item["scene"] == "explore" and item["engine"] == "chromium" and item["width"] == 390)
old_file = baseline_root / old_home["file"]
assert sha(old_file.read_bytes()) == old_home["sha256"]
new_home = next(item for item in reports["screens"]["screenshots"] if item["kind"] == "home" and item["engine"] == "chromium" and item["width"] == 390)
comparisons = []
for scene, title, reference in (("explore", "探索首页", 1), ("workbench-stamp", "邮戳工作台 · 清理后", 3), ("collection", "收藏室", 3)):
    before = next(item for item in baseline_report["screenshots"] if item["scene"] == scene and item["engine"] == "chromium" and item["width"] == 390)
    before_file = baseline_root / before["file"]
    assert before["sourceCommit"] == BASELINE_SOURCE and before["zipSha256"] == BASELINE_ZIP and sha(before_file.read_bytes()) == before["sha256"]
    if scene == "workbench-stamp":
        current_case = next(item for item in reports["screens"]["cases"] if item.get("kind") == "curio-state" and item["id"] == "stamp" and item["stage"] == "clean")
        current = next(item for item in reports["screens"]["screenshots"] if item["file"] == current_case["file"])
    else:
        current = next(item for item in reports["screens"]["screenshots"] if item["kind"] == ("home" if scene == "explore" else "collection") and item["engine"] == "chromium" and item["width"] == 390)
    comparisons.append({"scene": scene, "title": title, "reference": manifest["images"][reference]["path"],
                        "historicalFile": relative(before_file), "historicalSha256": before["sha256"], "historicalState": before.get("actualSave"),
                        "currentFile": current["file"], "currentSha256": current["sha256"]})


def figure(file, caption, class_name=""):
    assert (OUT / file).resolve().is_file(), file
    return (f'<figure class="{esc(class_name)}"><a href="{esc(file)}"><img loading="lazy" decoding="async" src="{esc(file)}" '
            f'alt="{esc(caption)}"></a><figcaption>{esc(caption)}</figcaption></figure>')


def film(item, caption):
    return (f'<figure class="film"><video controls playsinline preload="metadata" src="{esc(item["file"])}"></video>'
            f'<figcaption>{esc(caption)} · {item["durationSeconds"]:.2f}秒，真实连续1倍；无音频记录</figcaption></figure>')


def fold(title, content):
    return f'<details><summary>{esc(title)}</summary>{content}</details>'


def font(size):
    for file in ("/System/Library/Fonts/STHeiti Light.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(file).is_file():
            return ImageFont.truetype(file, size)
    return ImageFont.load_default()


materials = reports["screens"]["materials"]
overview = Image.new("RGB", (2416, 1446), "#29183c")
draw = ImageDraw.Draw(overview)
draw.text((16, 10), f"V045 A / {source[:7]} · 六物18态完整实际PNG · 非手机截图", fill="#f3dfbe", font=font(25))
selected = []
for column, id in enumerate(IDS):
    x = 16 + column * 400
    draw.text((x, 54), NAMES[column], fill="#8ad9e0", font=font(23))
    for row, stage in enumerate(STAGES):
        item = next(item for item in materials if item["id"] == id and item["stage"] == stage)
        assert item["differingBytes"] == 0 and item["rgbaSha256"] == item["expectedRgbaSha256"]
        y = 92 + row * 438
        draw.text((x, y), STAGE_NAMES[row], fill="#f3dfbe", font=font(21))
        with Image.open(evidence(item["file"])) as image:
            assert image.size == (384, 384)
            rgba = image.convert("RGBA")
            overview.paste(rgba, (x, y + 36), rgba)
        selected.append({"id": id, "stage": stage, "file": item["file"], "sha256": item["sha256"]})
derived = OUT / "derivedframes"
derived.mkdir(parents=True, exist_ok=True)
overview_file = "derivedframes/whole-state-overview.png"
overview.save(OUT / overview_file)
overview_record = {"sourceCommit": source, "zipSha256": zip_sha, "file": overview_file,
                   "sha256": sha((OUT / overview_file).read_bytes()), "inputs": selected,
                   "method": "Uncropped whole 384px actual exports; native size alpha composition on actual bench background, labels outside object-image squares"}
(derived / "overview-index.json").write_text(json.dumps(overview_record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

roles = ("A方向：自动探索、发现期待、探索/收藏/基地三入口", "首页：安全留白、完整星球、一个真实目标与可感知助力",
         "昼夜：同球白天→黄昏→夜间发现→清晨回看，统一事件流", "收藏：六物18完整图，三态简明，修好后突出代表互动")
role_links = "".join(f'<li><a href="{esc(relative(ROOT / item["path"]))}">{index + 1:02d} · {esc(roles[index])}</a></li>' for index, item in enumerate(manifest["images"]))
originals = fold("四张批准PNG原图（完整查看，不裁切作运行界面）", '<div class="grid">' + "".join(figure(relative(ROOT / item["path"]), roles[index], "concept") for index, item in enumerate(manifest["images"])) + "</div>")
threeway = fold("三重点场景 · 完整批准参考／历史V044／本轮A版", '<p>原图完整展示，不裁海报。历史图固定归7074；邮戳对照均为清理后。首页及收藏为各报告真实档案的UI对照，物理态可能不同，不宣称同一进度或重绘。</p>' + ''.join(
    f'<h3>{esc(item["title"])}</h3><div class="grid">' + figure(relative(ROOT / item["reference"]), "批准概念原PNG · 完整参考，非运行界面", "concept")
    + figure(item["historicalFile"], "历史V044 / 7074cff · 实际390×844") + figure(item["currentFile"], f'本轮A / {source[:7]} · 实际390×844') + '</div>' for item in comparisons))
night = reports["night"]["cases"][0]
first_collection = next(item for item in reports["collection"]["cases"] if item["id"] == "receipt")
representatives = '<div class="grid">' + film(reports["night"]["videos"][0], "同一颗退货箱星，完整自然昼夜与探索手记") + film(first_collection["video"], "收藏点击→工作台→真实三态→两次免费展示→回收藏") + "</div>"
route_rows = [
    ("观察／巡逻／夜间结果／回看多入口", "探索首页唯一事件入口 #fusion-observe → 同一探索手记；昼夜标签随真实时间变化", "night-evidence.json"),
    ("首页设备／零件用途／设置／独立星图堆叠", "收拢到基地内必要管理；首页保留单目标与专用助力", "screens-evidence.json"),
    ("复杂工作台解释与多套动作并排", "原 clean/repair 顺序和原价；完成后只突出本物件代表互动", "collection-evidence.json"),
    ("把连点当直接奖励", "专用助力按钮仍只增加有界真实工作，三档可见，入账跟随实际作业", "assist-evidence.json"),
]
route_table = '<table><thead><tr><th>旧呈现</th><th>V045 A实际核对入口</th><th>原始证据</th></tr></thead><tbody>' + "".join(f'<tr><td>{esc(old)}</td><td>{esc(new)}</td><td><a href="{esc(file)}">查看</a></td></tr>' for old, new, file in route_rows) + '</tbody></table>'
extras = []
for mode, report in reports.items():
    content = '<div class="grid">' + "".join(film(item, item["file"]) for item in report["videos"]) + "</div>"
    content += '<div class="grid">' + "".join(figure(item["file"], item["name"]) for item in report["screenshots"]) + "</div>"
    content += f'<p><a href="{mode}-evidence.json">完整报告：真实夹具、来源、状态、权益、账本与时间</a></p>'
    extras.append(fold(f'{mode} · {len(report["screenshots"])}张实际页面／{len(report["videos"])}段原生影片', content))
extras.append(fold("18张完整透明PNG逐一查看", '<div class="grid">' + "".join(figure(item["file"], f'{item["id"]} · {item["stage"]} · 实际完整384导出') for item in materials) + "</div>"))
source_details = fold("完整来源、历史边界与保留规则", f'<p>当前运行源码 <code>{source}</code><br>ZIP <code>{zip_sha}</code></p>'
                      f'<p>历史比较源码 <code>{BASELINE_SOURCE}</code><br>历史ZIP <code>{BASELINE_ZIP}</code>。旧首页保持7074归属，不贴新SHA。</p>'
                      '<p>保留v037当前档、余额、收藏、设备、本体研究、展柜0–3、安保、施工、证据/雾种子与源备份；不新增货币、体力、固定未知星球格或强迫连点。概念中的示例数值不作为规则。</p>')
page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>V045 A · 简单探索与发现 · 待用户/真机验收</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#211232;color:#f3dfbe;font:16px/1.65 system-ui,sans-serif}}main{{width:100%;max-width:1200px;margin:auto;padding:18px;min-width:0}}a{{color:#8ad9e0}}h1{{font-size:25px;line-height:1.4}}h2{{font-size:21px;margin-top:28px}}p,code,li,td,th,figcaption,summary{{overflow-wrap:anywhere}}code,figcaption{{font-size:12px}}.notice{{padding:13px;border:2px solid #c99960;background:#3c254b}}figure{{margin:0 0 14px;min-width:0;max-width:100%}}img,video{{display:block;width:100%;height:auto;max-width:100%;background:#29183c}}img{{image-rendering:pixelated}}.concept img{{image-rendering:auto}}figcaption{{padding:7px 0}}.grid,.pair{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px;align-items:start}}.film{{max-width:390px;justify-self:center}}video{{max-height:660px;object-fit:contain}}details{{margin:12px 0;padding:0 10px 10px;border:1px solid #77546c;min-width:0}}summary{{cursor:pointer;padding:12px 0;font-weight:600}}table{{width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px}}td,th{{text-align:left;vertical-align:top;border:1px solid #77546c;padding:8px}}
@media(max-width:650px){{main{{padding:12px}}h1{{font-size:23px}}table,thead,tbody,tr,td,th{{display:block;width:100%}}thead{{display:none}}tr{{margin-bottom:10px}}}}
</style></head><body><main><h1>V045 A · 简单探索，新奇发现，温柔回归</h1>
<p class="notice">待用户/真机验收。工程与像素一致检查不替代美术和手机观感通过。</p>
<p>实际固定包 <code>{source[:7]}</code> · <a href="screens-evidence.json">运行来源与入口</a> · <a href="{esc(relative(APPROVED / 'README.md'))}">批准方向与职责</a></p>
<h2>四张批准图各负责什么</h2><ol>{role_links}</ol>{originals}
<h2>同尺寸实际首页 · 历史V044／本轮A版</h2><div class="pair">{figure(relative(old_file), '历史V0.4.4 / 7074cff · 实际390×844，保留原来源')}{figure(new_home['file'], f'V0.4.5 / {source[:7]} · 实际390×844')}</div>
{threeway}
<h2>同一颗星球的夜间与收藏</h2>{representatives}
<h2>六件18态 · 完整图片保留</h2>{figure(overview_file, '来自本轮固定包的18张完整384导出，非手机页面；点击原尺寸查看。')}
<h2>入口怎样合并</h2>{route_table}
<h2>仍待确认</h2><p>用户视觉、真实手机触控、安全区、锁屏恢复和发热待新包实机复审。影片不含音频，不能作为可听效果证明。截图中的目标、进度、零件与清晨结果来自实际档案；不以概念宝石、体力或示例进度造规则。</p>
{source_details}<h2>详细实际证据（按需展开）</h2>{''.join(extras)}
<p>固定审核入口：<a href="verification.json">实际工程验证</a> · <a href="proof.json">固定包证明</a> · <a href="review-status.json">逐项内部审核原件</a> · <a href="taptap-self-test.json">开发自测回读</a>。这些链接不参与图库报告清单，缺少时仍待补齐，不自动宣称通过。</p>
<p>仅退货箱星／退件平原。继续Draft PR，不合并、不提审、不正式发布。18图完整选择规则与已认可的主动展示分别保留。</p></main></body></html>'''
(OUT / "index.html").write_text(page, encoding="utf-8")
for file, digest in report_hashes.items():
    assert sha((OUT / file).read_bytes()) == digest, f"Capture report changed during index compilation: {file}"
status = {"version": "0.4.5", "sourceCommit": source, "zipSha256": zip_sha, "sourceClean": True,
          "status": "pending_user_and_phone_acceptance", "visualApprovalInferred": False, "physicalPhone": False,
          "reportSha256": report_hashes, "approvedOriginals": manifest["images"], "completeStates": 18, "overview": overview_record,
          "baseline": {"sourceCommit": BASELINE_SOURCE, "zipSha256": BASELINE_ZIP, "file": relative(old_file), "sha256": old_home["sha256"], "historicalOnly": True},
          "prioritySceneComparisons": comparisons,
          "representativeVideos": [reports["night"]["videos"][0]["file"], first_collection["video"]["file"]],
          "entryMergeTable": [{"before": old, "current": new, "report": file} for old, new, file in route_rows],
          "counts": {"screenshots": sum(len(report["screenshots"]) for report in reports.values()), "completePngs": 18,
                     "naturalVideos": sum(len(report["videos"]) for report in reports.values())}, "media": media, "errors": []}
(OUT / "gallery-status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceCommit": source, "zipSha256": zip_sha, "index": str(OUT / "index.html"), **status["counts"]}, ensure_ascii=False))
