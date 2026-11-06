#!/usr/bin/env python3
"""Compact V0.4.4 review index, built only after real frozen-package captures.

Read capture reports and the existing canonical acceptance registry. Write only
this batch's index/status and a labeled overview of complete exported images.
No browser, source assets, original reports, registry updates or video synthesis.
"""
import hashlib
import html
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("RENEWAL_OUTPUT", ROOT / "artifacts/v044-execution-art")).resolve()
assert OUT.is_relative_to((ROOT / "artifacts/v044-execution-art").resolve()), "Write only this V044 artifact batch"
BASELINE = "ff917872227b0f28a452dee1642d9cc8606251db"
BASELINE_ZIP = "2c37adfcd286cf1b1ba8af05bb7b52127d5cdda126f0b3fa098e812d825893f1"
IDS = ("receipt", "tape", "nested", "stamp", "cosmic-parcel", "bell")
NAMES = dict(zip(IDS, ("退货收据", "道歉胶带", "套娃包裹", "昨日邮戳", "收件人：宇宙", "无人签收铃")))
STAGES = ("found", "clean", "stabilized")
STAGE_NAMES = dict(zip(STAGES, ("A · 刚获得", "B · 清理后", "C · 零件升级后")))
CORE_FILES = ("baseline-art-comparison.json", "current-art-comparison.json", "screens-whole-state-evidence.json", "process-whole-state-evidence.json")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def esc(value):
    return html.escape(str(value), quote=True)


def relative(path):
    return os.path.relpath(path, OUT).replace(os.sep, "/")


def evidence_file(file, parent=OUT):
    path = (parent / file).resolve()
    assert path.is_relative_to(OUT) and path.is_file(), f"Missing/unsafe current evidence: {file}"
    return path


def report_source(report):
    runtime = report.get("runtimeSource")
    candidates = (report.get("sourceCommit"), report.get("runtimeSourceSha"),
                  runtime.get("sourceSha") if isinstance(runtime, dict) else runtime)
    return next((value for value in candidates if isinstance(value, str) and len(value) == 40
                 and all(char in "0123456789abcdef" for char in value)), None)


def report_zip(report):
    package, archive = report.get("package"), report.get("archive")
    candidates = (report.get("zipSha256"), package.get("sha256") if isinstance(package, dict) else None,
                  archive.get("sha256") if isinstance(archive, dict) else None)
    return next((value for value in candidates if isinstance(value, str) and len(value) == 64
                 and all(char in "0123456789abcdef" for char in value)), None)


core = {file: read_json(OUT / file) for file in CORE_FILES}
before, current, screens, processes = (core[file] for file in CORE_FILES)
source, zip_sha = current["sourceCommit"], current["zipSha256"]
assert current["version"] == "0.4.4" and source != BASELINE, "No actual new V044 report exists"
assert before["sourceCommit"] == BASELINE and before["zipSha256"] == BASELINE_ZIP
assert before["sourceClean"] is None and before["workingTreeValidated"] is False
for file, report in core.items():
    assert report["complete"] and not report["errors"], file
    assert not report["physicalPhone"] and report["touchEmulation"] and report.get("clockOverrides") is False, file
    assert not any(case.get("errors") or case.get("browserErrors") for case in report["cases"]), file
    if file != CORE_FILES[0]:
        assert report["sourceCommit"] == source and report["zipSha256"] == zip_sha and report["sourceClean"], file
for report in (before, current):
    assert len(report["screenshots"]) == 12 and len(report["cases"]) == 4
    assert all(case["complete"] and case["readOnly"] and case["loadedScripts"] for case in report["cases"])
    assert all(case["servedEntry"]["sha256"] and all(script["sha256"] for script in case["loadedScripts"]) for case in report["cases"])
assert len(screens["materials"]) == 54 and len(processes["videos"]) == 6
for report in (before, current):
    package = report["package"]
    archive = (ROOT / package["archive"]).read_bytes()
    assert len(archive) == package["bytes"] and sha(archive) == package["sha256"], "Actual archive changed"

inputs = {file: sha((OUT / file).read_bytes()) for file in CORE_FILES}
registry_path = ROOT / "design/visual-renewal/ASSET_REGISTRY.json"
registry_raw = registry_path.read_bytes()
acceptance = json.loads(registry_raw)["acceptance"]
assert acceptance["baselineRuntime"] == BASELINE
requirements = acceptance["requirements"]
assert {row["id"] for row in requirements} == set(acceptance["requiredIds"]), "Canonical requirement rows are incomplete"

# Discover detailed reports without promoting an old/unbound report to current.
inventory, media, seen_files = [], [], set()
for path in sorted(OUT.rglob("*.json")):
    # The proof hashes the final index. Keep it and its computed wrapper in the
    # explicit links below, outside this generated inventory to avoid a circular
    # index -> proof -> index dependency. Their current hashes remain in proof/QA.
    if "raw" in path.parts or "derivedframes" in path.parts or path.name in ("gallery-status.json", "gallery-layout.json", "proof.json", "verification.json", "delivery-gate.json"):
        continue
    report = read_json(path)
    if not isinstance(report, dict):
        continue
    actual_source, actual_zip = report_source(report), report_zip(report)
    binding = "current" if actual_source == source and actual_zip == zip_sha else "historical_baseline" if actual_source == BASELINE else "unbound_or_summary"
    inventory.append({"file": relative(path), "sha256": sha(path.read_bytes()), "sourceCommit": actual_source,
                      "zipSha256": actual_zip, "binding": binding, "errors": len(report.get("errors", []))})
    if binding != "current" or report.get("errors") or not report.get("sourceClean", False):
        continue
    for kind in ("screenshots", "materials", "videos"):
        for item in report.get(kind, []):
            file = evidence_file(item["file"], path.parent)
            if str(file) in seen_files:
                continue
            seen_files.add(str(file))
            raw = file.read_bytes()
            assert not item.get("sha256") or sha(raw) == item["sha256"], item["file"]
            assert item.get("bytes", len(raw)) == len(raw), item["file"]
            if kind == "videos":
                assert item["speed"] == 1
            media.append({**item, "file": relative(file), "captureKind": item.get("kind"), "kind": kind,
                          "sha256": sha(raw), "sourceReport": relative(path)})
for item in before["screenshots"]:
    raw = evidence_file(item["file"]).read_bytes()
    assert sha(raw) == item["sha256"] and len(raw) == item["bytes"]


def font(size):
    for path in ("/System/Library/Fonts/STHeiti Light.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


selected = {}
for id in IDS:
    for stage in STAGES:
        item = next(item for item in screens["materials"] if item["id"] == id and item["stage"] == stage
                    and item["engine"] == "chromium" and item["viewportWidth"] == 390)
        assert item["differingBytes"] == 0 and item["rgbaSha256"] == item["previewRgbaSha256"]
        raw = evidence_file(item["file"]).read_bytes()
        assert sha(raw) == item["sha256"]
        selected[id, stage] = item
derived = OUT / "derivedframes"
derived.mkdir(parents=True, exist_ok=True)
margin, size, header, row_height = 16, 384, 88, 438
overview = Image.new("RGB", (6 * size + 7 * margin, header + 3 * row_height + 44), "#29183c")
draw = ImageDraw.Draw(overview)
draw.text((margin, 9), f"V0.4.4 / {source[:7]} · 六件18态完整导出 · 非手机页面", fill="#f3dfbe", font=font(24))
for column, id in enumerate(IDS):
    draw.text((margin + column * (size + margin), 51), NAMES[id], fill="#8ad9e0", font=font(23))
for row, stage in enumerate(STAGES):
    y = header + row * row_height
    for column, id in enumerate(IDS):
        x = margin + column * (size + margin)
        draw.text((x, y), STAGE_NAMES[stage], fill="#f3dfbe", font=font(21))
        with Image.open(evidence_file(selected[id, stage]["file"])) as image:
            assert image.size == (384, 384)
            rgba = image.convert("RGBA")
            overview.paste(rgba, (x, y + 36), rgba)
draw.text((margin, overview.height - 34), "每格是同一固定包的完整PNG，384原尺寸，背景合成仅为透明图查看；无裁片、补画或重生成。", fill="#c8b4cf", font=font(20))
overview_file = "derivedframes/whole-state-overview.png"
overview.save(OUT / overview_file)
overview_index = {"sourceCommit": source, "zipSha256": zip_sha, "file": overview_file,
                  "sha256": sha((OUT / overview_file).read_bytes()), "width": overview.width, "height": overview.height,
                  "method": "Uncropped full 384px exported PNGs, unchanged size, alpha-composited on the actual bench background; labels outside original pixel squares",
                  "inputs": [{"id": id, "stage": stage, "file": selected[id, stage]["file"], "sha256": selected[id, stage]["sha256"]} for id in IDS for stage in STAGES]}
(derived / "overview-index.json").write_text(json.dumps(overview_index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def figure(file, caption, class_name=""):
    path = (OUT / file).resolve()
    assert path.is_file(), file
    return (f'<figure class="{esc(class_name)}"><a href="{esc(file)}"><img loading="lazy" decoding="async" src="{esc(file)}" '
            f'alt="{esc(caption)}"></a><figcaption>{esc(caption)}</figcaption></figure>')


def film(item, caption):
    return (f'<figure class="film"><video controls playsinline preload="metadata" src="{esc(item["file"])}"></video>'
            f'<figcaption>{esc(caption)} · {item["durationSeconds"]:.2f}秒，原生1倍</figcaption></figure>')


def fold(title, content):
    return f'<details><summary>{esc(title)}</summary>{content}</details>'


approved = {"explore": "02_first_planet_exploration.png", "workbench-stamp": "03_curio_restoration_and_collection.png", "collection": "03_curio_restoration_and_collection.png"}
scene_names = {"explore": "探索", "workbench-stamp": "邮戳B整理工作台", "collection": "收藏室"}
comparison_sections = []
approved_bindings = []
for scene in approved:
    reference = ROOT / "design/visual-renewal/approved" / approved[scene]
    approved_bindings.append({"scene": scene, "file": relative(reference), "sha256": sha(reference.read_bytes())})
    old = next(item for item in before["screenshots"] if item["scene"] == scene and item["engine"] == "chromium" and item["width"] == 390)
    new = next(item for item in current["screenshots"] if item["scene"] == scene and item["engine"] == "chromium" and item["width"] == 390)
    panels = (figure(relative(reference), "批准原始概念全图：不裁切、多场景内容仅作参考", "concept")
              + figure(old["file"], f"精修前 V0.4.3 / {BASELINE[:7]} · 实际390×844")
              + figure(new["file"], f"精修后 V0.4.4 / {source[:7]} · 实际390×844"))
    comparison_sections.append(f'<section><h3>{scene_names[scene]}</h3><div class="comparison">{panels}</div></section>')

videos = [item for item in media if item["kind"] == "videos"]
stamp_video = next((item for item in videos if item.get("id") == "stamp" and item.get("captureKind") == "natural-clean-then-repair"),
                   next(item for item in videos if item.get("id") == "stamp"))
representatives = [stamp_video]
museum_video = next((item for item in videos if Path(item["file"]).name == "museum-all-3-100s.mp4"),
                    next((item for item in videos if "museum" in item["file"]), None))
bell_video = next((item for item in videos if "bell" in item["file"]
                   and ("trial" in (item.get("captureKind") or "") or "mechanism" in item["sourceReport"])), None)
if museum_video:
    representatives.append(museum_video)
elif bell_video:
    representatives.append(bell_video)

parent_rows = [row for row in requirements if row.get("parent") is None]
unfinished = []
for row in parent_rows:
    if row["implementation"] != "IMPLEMENTED" or row["evidence"] != "CURRENT_VERIFIED" or row["visual"] != "USER_ACCEPTED" or row["phone"] != "PASS_WITH_DEVICE_RECORD":
        unfinished.append(row)
table_rows = "".join(f'<tr><th>{esc(row["id"])}</th><td>{esc(row["implementation"])}<br>{esc(row["evidence"])}</td>'
                     f'<td>{esc(row["visual"])}<br>{esc(row["phone"])}</td><td>{esc(row.get("gap", ""))}<br>{esc(row.get("nextAction", ""))}</td></tr>' for row in unfinished)
summary = {dimension: dict(Counter(row[dimension] for row in requirements)) for dimension in ("implementation", "evidence", "visual", "phone")}
all_shots = [item for item in media if item["kind"] == "screenshots"]
all_materials = [item for item in media if item["kind"] == "materials"]
extras = fold(f"全部当前实际页面与预览（{len(all_shots)}张）", '<div class="grid">' + "".join(figure(item["file"], item.get("name", item["file"])) for item in all_shots) + "</div>")
extras += fold(f"全部当前完整材质导出（{len(all_materials)}张）", '<div class="grid">' + "".join(figure(item["file"], item["file"]) for item in all_materials) + "</div>")
extras += fold(f"全部当前原生录像（{len(videos)}段）", '<div class="grid">' + "".join(film(item, item["file"]) for item in videos) + "</div>")
extras += fold("360/390 · Chromium/WebKit · 其余同视图新旧对照", '<div class="grid">' + "".join(figure(item["file"], f'{label} · {item["scene"]} · {item["engine"]} {item["width"]}×{item["height"]}') for label, report in (("历史V043", before), ("本轮V044", current)) for item in report["screenshots"] if not (item["engine"] == "chromium" and item["width"] == 390)) + "</div>")
report_links = "".join(f'<li><a href="{esc(item["file"])}">{esc(item["file"])}</a> · {esc(item["binding"])}<br>'
                       f'源码 <code>{esc(item["sourceCommit"] or "未绑定运行源码（概要/待完成记录）")}</code><br>ZIP <code>{esc(item["zipSha256"] or "未登记")}</code></li>' for item in inventory)
extras += fold("全部报告与确切源码／包归属", f"<ul>{report_links}</ul>")
coverage_link = relative(ROOT / "design/visual-renewal/VISUAL_COVERAGE.md")
registry_link = relative(registry_path)
contract_link = relative(ROOT / "design/visual-renewal/EXECUTION_AND_ART_ACCEPTANCE.md")
page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>首星执行核查与美术精修 V0.4.4 · 待用户/真机验收</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#211232;color:#f3dfbe;font:16px/1.65 system-ui,sans-serif}}main{{max-width:1240px;width:100%;margin:auto;padding:18px;min-width:0}}a{{color:#8ad9e0}}h1{{font-size:26px;line-height:1.4}}h2{{font-size:22px;margin-top:30px}}h3{{font-size:18px}}
p,code,li,figcaption,td,th,summary{{overflow-wrap:anywhere}}code,figcaption{{font-size:12px}}.notice{{padding:14px;background:#3c254b;border:2px solid #c99960}}figure{{margin:0 0 14px;min-width:0;max-width:100%}}img,video{{display:block;width:100%;max-width:100%;height:auto;background:#29183c}}img{{image-rendering:pixelated}}figcaption{{padding:8px 0}}.comparison{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}.comparison img{{height:560px;object-fit:contain}}.concept img{{image-rendering:auto}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px;align-items:start}}.film{{max-width:390px;justify-self:center}}video{{max-height:650px;object-fit:contain}}details{{border:1px solid #77546c;margin:12px 0;padding:0 10px 10px;min-width:0}}summary{{cursor:pointer;padding:12px 0;font-weight:600}}table{{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}}th,td{{padding:8px;border:1px solid #77546c;vertical-align:top}}th{{text-align:left;width:12%}}.state-col{{width:20%}}.overview img{{width:100%;height:auto}}
@media(max-width:650px){{main{{padding:12px}}h1{{font-size:23px}}.comparison{{grid-template-columns:1fr}}.comparison img{{height:auto;max-height:none}}table,thead,tbody,tr,th,td{{display:block;width:100%}}thead{{display:none}}tr{{margin-bottom:10px}}th,td{{border-bottom:0}}td:last-child{{border-bottom:1px solid #77546c}}}}
</style></head><body><main><h1>首星执行核查与美术精修 · V0.4.4</h1>
<p class="notice">待用户/真机验收。工程通过不等于美术或手机通过。</p>
<p>V0.4.4 / <code>{source[:7]}</code> · <a href="package-info.json">当前包信息</a></p>
<p><a href="{esc(contract_link)}">本轮合同</a> · <a href="{esc(coverage_link)}">{len(requirements)}项要求与缺口</a> · <a href="{esc(registry_link)}">权威登记</a></p>
<details><summary>来源与保留规则</summary>
<p>本轮实际运行源码 <code>{source}</code><br>固定ZIP <code>{zip_sha}</code><br>比较基线 V0.4.3 / <code>{BASELINE}</code><br>历史ZIP <code>{BASELINE_ZIP}</code>。历史页和加载JS直接核对原ZIP；不宣称当时工作树等于旧源码。</p>
<p>保留六物18张完整三态、原费用/时长、已购权益、主动免费互动与v037存档；新绘与明确复用按原注册逐项追溯，复用C不冒称新生成。不裁概念海报作运行素材，不恢复分片/擦污生成下一态。</p>
<p>用户对上一版“大部分可以”仅作方向认可，不替代逐对象最终签收。实现、当前证据、内部视觉、真实手机分别记录；下表照录现有权威登记，不因截图数量或RGBA一致而自动通过。</p>
</details>
<h2>六物18态 · 实际同包完整PNG总览</h2>{figure(overview_file, "18张完整384导出在实际工作台底色上并排；点击打开原尺寸。非手机整页截图。", "overview")}
<h2>批准参考／精修前／精修后 · 三个重点场景</h2><p>每个批准PNG均完整显示，不裁取局部冒充设计原图。前后画面均为同一普通clean夹具、390×844原生实际页面；自然世界时钟继续运行，动画相位不伪装完全相同。</p>{''.join(comparison_sections)}
<h2>代表性自然时间录像</h2><div class="grid">{''.join(film(item, "本轮实际固定包代表实录") for item in representatives)}</div>
<h2>尚未闭环／待确认</h2><p>以下{len(unfinished)}个合同父项从既有登记派生；全部{len(requirements)}条有效父/子要求仍在原覆盖表中，没有删成摘要。真实手机、锁屏与发热未以桌面仿真替代。</p>
<table><thead><tr><th>ID</th><td class="state-col">实现／证据</td><td class="state-col">视觉／手机</td><td>缺口与下一动作</td></tr></thead><tbody>{table_rows}</tbody></table>
<p><a href="proof.json">固定源码/树/包/媒体证明</a> · <a href="verification.json">完整工程与回归结果</a> · <a href="performance.json">本次性能原值</a> · <a href="performance-comparison.json">同场景新旧性能</a> · <a href="review-status.json">实际视觉复核记录</a> · <a href="taptap-self-test.json">TapTap开发自测回读</a>。未提供的记录仍属待补，不作通过。</p>
<h2>详细证据（按需展开）</h2>{extras}
<p>继续只打磨退货箱星／退件平原。Draft PR保持Draft，不合并、不提审、不正式发布。全部原始WebM仅供本地取证，不放入本页交付媒体清单。</p></main></body></html>'''
(OUT / "index.html").write_text(page, encoding="utf-8")
for file, digest in inputs.items():
    assert sha((OUT / file).read_bytes()) == digest, f"Original report changed: {file}"
assert sha(registry_path.read_bytes()) == sha(registry_raw), "Canonical registry changed during gallery build; rebuild from one snapshot"
status = {"version": "0.4.4", "sourceCommit": source, "zipSha256": zip_sha, "baselineSourceCommit": BASELINE,
          "baselineZipSha256": BASELINE_ZIP, "physicalPhone": False, "touchEmulation": True,
          "status": "pending_user_and_phone_acceptance", "visualApprovalInferred": False,
          "generatedAt": datetime.now(timezone.utc).isoformat(), "coreReportSha256": inputs,
          "canonicalRegistry": {"file": registry_link, "sha256": sha(registry_raw), "requirements": len(requirements), "summary": summary},
          "unfinishedParentRequirements": [row["id"] for row in unfinished], "overview": overview_index,
          "approvedOriginals": approved_bindings, "priorityScenes": list(approved), "representativeVideos": [item["file"] for item in representatives],
          "reports": inventory, "media": [{key: item[key] for key in ("file", "kind", "sha256", "sourceReport")} for item in media],
          "layout": "Compact overview + three exact before/current scene groups; full approved originals, no crop; native details folded; browser 390px review remains separate",
          "errors": []}
(OUT / "gallery-status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceCommit": source, "zipSha256": zip_sha, "index": str(OUT / "index.html"),
                  "completeStates": 18, "comparisonScreens": 24, "media": len(media), "reports": len(inventory),
                  "representativeVideos": len(representatives), "unfinishedParents": len(unfinished)}, ensure_ascii=False))
