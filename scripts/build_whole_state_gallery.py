#!/usr/bin/env python3
"""Build V0.4.3 review pages and contact sheets from real, source-bound media.

Re-running only replaces this gallery and its derived frames. Capture reports,
runtime files, original images and original recordings are never changed.
"""
import hashlib
import html
import io
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/v043-whole-state-review"
DERIVED = OUT / "derivedframes"
SOURCE = "ff917872227b0f28a452dee1642d9cc8606251db"
ZIP_SHA = "2c37adfcd286cf1b1ba8af05bb7b52127d5cdda126f0b3fa098e812d825893f1"
IDS = ("receipt", "tape", "nested", "stamp", "cosmic-parcel", "bell")
NAMES = dict(zip(IDS, ("未购买的退货收据", "自动道歉的胶带", "无限套娃包裹", "昨日邮戳", "收件人：宇宙", "无人签收铃")))
STAGES = ("found", "clean", "stabilized")
STAGE_NAMES = dict(zip(STAGES, ("A · 刚获得", "B · 清理后", "C · 零件升级后")))
REPORT_FILES = ("screens-whole-state-evidence.json", "process-whole-state-evidence.json", "museum-physical-evidence.json")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def asset(file):
    path = (OUT / file).resolve()
    assert path.is_relative_to(OUT.resolve()) and path.is_file(), f"Missing/unsafe evidence file: {file}"
    return path


def esc(value):
    return html.escape(str(value), quote=True)


reports = {}
report_hashes = {}
for file in REPORT_FILES:
    raw = (OUT / file).read_bytes()
    report = json.loads(raw)
    assert report["sourceCommit"] == SOURCE and report["zipSha256"] == ZIP_SHA, file
    assert report["sourceClean"] is True and not report["physicalPhone"] and report["touchEmulation"], file
    assert report.get("complete", True) and not report["errors"], file
    assert not any(case.get("errors") or case.get("browserErrors") for case in report["cases"]), file
    assert report["package"]["version"] == "0.4.3" and report["package"]["sourceCommit"] == SOURCE, file
    assert report["package"]["sha256"] == ZIP_SHA, file
    reports[file] = report
    report_hashes[file] = sha(raw)
screens, processes, museum = (reports[file] for file in REPORT_FILES)
assert len(screens["cases"]) == 57 and len(screens["screenshots"]) == 78 and len(screens["materials"]) == 54
assert len(processes["cases"]) == 6 and len(processes["videos"]) == 6
assert len(museum["cases"]) == 1 and len(museum["videos"]) == 1
assert all(case["complete"] for case in screens["cases"] + processes["cases"])
assert all(case["ownershipUnchanged"] and case["noRepeatPayment"] for case in processes["cases"])
assert all(step["complete"] and step["noRepeatCharge"] for case in processes["cases"] for step in case["steps"])
assert all(item["differingBytes"] == 0 and item["rgbaSha256"] == item["previewRgbaSha256"]
           for report in (screens, processes) for item in report["materials"])
package = screens["package"]
assert sha((ROOT / package["archive"]).read_bytes()) == ZIP_SHA, "The actual fixed ZIP changed"
DERIVED.mkdir(parents=True, exist_ok=True)

media_index = []
for report in reports.values():
    for kind in ("screenshots", "materials", "videos"):
        for item in report.get(kind, []):
            raw = asset(item["file"]).read_bytes()
            if item.get("sha256"):
                assert sha(raw) == item["sha256"], item["file"]
            if item.get("bytes") is not None:
                assert len(raw) == item["bytes"], item["file"]
            if kind == "videos":
                assert item["speed"] == 1, item["file"]
            media_index.append({"file": item["file"], "kind": kind, "bytes": len(raw), "sha256": sha(raw)})

frames = []
contact_sheets = []
video_frames = {}
video_hashes = {item["file"]: item["sha256"] for report in (processes, museum) for item in report["videos"]}


def extract(video, requested_seconds, label, context):
    """Decode one actual source frame; never interpolate, crop or resize it."""
    file = video["file"]
    if file not in video_frames:
        decoded = subprocess.check_output([
            "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_frames",
            "-show_entries", "frame=best_effort_timestamp_time", "-of", "json", str(asset(file)),
        ])
        video_frames[file] = json.loads(decoded)["frames"]
    available = video_frames[file]
    index = next((i for i, frame in enumerate(available)
                  if float(frame["best_effort_timestamp_time"]) + 1e-7 >= requested_seconds), None)
    assert index is not None, f"No native frame at {requested_seconds}s in {file}"
    actual = float(available[index]["best_effort_timestamp_time"])
    assert 0 <= actual - requested_seconds <= .1, f"Unexpected source-frame gap: {file}"
    command = ["ffmpeg", "-v", "error", "-i", str(asset(file)), "-vf", f"select=eq(n\\,{index})",
               "-frames:v", "1", "-fps_mode", "passthrough", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]
    raw = subprocess.check_output(command)
    image = Image.open(io.BytesIO(raw))
    assert image.size == (390, 844), f"Non-native extracted frame: {file}"
    relative = f"derivedframes/{label}.png"
    (OUT / relative).write_bytes(raw)
    entry = {"file": relative, "sourceVideo": file, "sourceVideoSha256": video_hashes[file],
             "requestedSeconds": round(requested_seconds, 6), "actualVideoSeconds": actual,
             "sourceFrameIndex0Based": index, "width": image.width, "height": image.height,
             "bytes": len(raw), "sha256": sha(raw), "sourceCommit": SOURCE, "zipSha256": ZIP_SHA,
             "source": "One original decoded video frame; no crop, resize, interpolation, painting or fabricated frame",
             **context}
    frames.append(entry)
    return entry


def font(size):
    for file in ("/System/Library/Fonts/STHeiti Light.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(file).is_file():
            return ImageFont.truetype(file, size)
    return ImageFont.load_default()


def sheet(name, selected, labels, title):
    """Place untouched native frames beside captions, outside the frame pixels."""
    columns, margin, heading, caption = 3, 16, 86, 66
    rows = (len(selected) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * 390 + (columns + 1) * margin,
                               heading + rows * (844 + caption + margin) + 40), "#211232")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 12), title, font=font(25), fill="#f3dfbe")
    draw.text((margin, 47), "真实影片提取帧联系表 · 非手机整页截图 · 原帧390×844，未裁切或缩放", font=font(19), fill="#8ad9e0")
    for number, (entry, label) in enumerate(zip(selected, labels)):
        x = margin + number % columns * (390 + margin)
        y = heading + number // columns * (844 + caption + margin)
        with Image.open(asset(entry["file"])) as image:
            canvas.paste(image.convert("RGB"), (x, y))
        draw.text((x, y + 849), f"{label} · {entry['actualVideoSeconds']:.3f}s", font=font(19), fill="#f3dfbe")
        draw.text((x, y + 877), f"frame {entry['sourceFrameIndex0Based']} · SHA {entry['sha256'][:12]}", font=font(17), fill="#c8b4cf")
    draw.text((margin, canvas.height - 29), f"V0.4.3 / {SOURCE[:7]} · 桌面原生触控仿真 · 1×连续录像来源", font=font(17), fill="#c8b4cf")
    relative = f"derivedframes/contact-{name}.png"
    canvas.save(OUT / relative)
    entry = {"name": name, "file": relative, "width": canvas.width, "height": canvas.height,
             "frames": [item["file"] for item in selected], "sha256": sha((OUT / relative).read_bytes()),
             "source": "Labeled arrangement of unchanged original-size extracted frames; captions are outside frame pixels",
             "notPhoneScreenshot": True, "sourceCommit": SOURCE, "zipSha256": ZIP_SHA}
    contact_sheets.append(entry)
    return entry


process_by_id = {case["id"]: case for case in processes["cases"]}
process_sheets = {}
for id in IDS:
    case = process_by_id[id]
    video = case["video"]
    assert video["alignment"]["reviewStartedAt"] == case["reviewStartedAt"]
    selected = []
    for stage, completed in (("found", None), ("clean", case["steps"][0]), ("stabilized", case["steps"][1])):
        seconds = .15 if completed is None else (completed["completedObservedAt"] - case["reviewStartedAt"]) / 1000 + .15
        selected.append(extract(video, seconds, f"process-{id}-{stage}", {
            "id": id, "condition": stage, "reviewStartedAt": case["reviewStartedAt"],
            "completedObservedAt": completed["completedObservedAt"] if completed else None,
            "timestampBasis": "Video begins at reviewStartedAt; initial +0.15s, each actual completedObservedAt +0.15s",
        }))
    process_sheets[id] = sheet(f"process-{id}", selected, [STAGE_NAMES[stage] for stage in STAGES], f"{NAMES[id]} · 三态完整实录")

museum_case = museum["cases"][0]
assert set(museum_case["targets"]) == set(IDS)
assert museum_case["minBodyClearance"] >= 6 and museum_case["maxHandReach"] <= 85
museum_frames = []
for id in museum_case["targets"]:
    indices = [i for i, sample in enumerate(museum_case["trace"])
               if sample.get("robotTarget") == id and sample.get("servicePhase") == "inspect"]
    assert indices, f"Missing natural inspect for {id}"
    first_window = [indices[0]]
    for index in indices[1:]:
        if index != first_window[-1] + 1:
            break
        first_window.append(index)
    index = first_window[len(first_window) // 2]
    sample = museum_case["trace"][index]
    museum_frames.append(extract(museum_case["video"], sample["ms"] / 1000, f"museum-inspect-{id}", {
        "id": id, "servicePhase": "inspect", "traceIndex0Based": index, "traceMs": sample["ms"],
        "timestampBasis": "Median sample of the first contiguous natural inspect window for this cabinet; video zero is trace zero",
    }))
museum_sheet = sheet("museum-six-inspects", museum_frames, [NAMES[item["id"]] for item in museum_frames], "收藏室100秒 · 六柜真实观察")
assert len(frames) == 24 and len(contact_sheets) == 7
dump(DERIVED / "index.json", {"sourceCommit": SOURCE, "zipSha256": ZIP_SHA, "sourceReportSha256": report_hashes,
                           "physicalPhone": False, "touchEmulation": True, "speed": 1, "frames": frames, "contactSheets": contact_sheets})


def figure(file, caption, class_name=""):
    asset(file)
    return (f'<figure class="{esc(class_name)}"><a href="{esc(file)}"><img loading="lazy" decoding="async" '
            f'src="{esc(file)}" alt="{esc(caption)}"></a><figcaption>{esc(caption)}</figcaption></figure>')


def video_figure(item, caption):
    return (f'<figure class="film"><video controls playsinline preload="metadata" src="{esc(item["file"])}"></video>'
            f'<figcaption>{esc(caption)} · {item["durationSeconds"]:.2f}秒 · 原生1倍连续录像</figcaption></figure>')


def details(title, content, opened=False):
    return f'<details{" open" if opened else ""}><summary>{esc(title)}</summary>{content}</details>'


def grid(content, class_name="grid"):
    return f'<div class="{class_name}">{content}</div>'


sections, featured_materials = [], set()
for id in IDS:
    case = process_by_id[id]
    material_figures = []
    for stage in STAGES:
        item = next(item for item in screens["materials"] if item["id"] == id and item["stage"] == stage
                    and item["engine"] == "chromium" and item["viewportWidth"] == 390)
        featured_materials.add(item["file"])
        material_figures.append(figure(item["file"], f'{STAGE_NAMES[stage]} · 实际完整384 PNG导出', "material"))
    preview_case = next(item for item in screens["cases"] if item.get("id") == id
                        and item.get("engine") == "chromium" and item.get("width") == 390 and item.get("stage") == "stabilized")
    previews = preview_case["readOnlyPreviews"]
    assert len(previews) == 3 and all(p["archiveCondition"] == "stabilized" and p["ownershipUnchanged"] and p["returnedToCurrent"] for p in previews)
    process_shots = [case["initialFile"]] + [step[key] for step in case["steps"] for key in ("processingFile", "completeFile")]
    charges = " + ".join(str(step["quote"]["quoted"]) for step in case["steps"])
    content = grid("".join(material_figures), "trio")
    content += f'<p>原清理／零件升级报价：{charges} = {case["quotedTotal"]}；实际账本扣款 {case["ledger"]["charged"]}。已购权益不变。</p>'
    content += grid(video_figure(case["video"], NAMES[id]) + figure(process_sheets[id]["file"], "A/B/C真实视频提取帧联系表，非手机整页截图", "contact"))
    content += details("处理前／处理期间／完成后的实际页面（5张）", grid("".join(figure(file, f'{NAMES[id]} · 实际390×844处理页面') for file in process_shots)))
    content += details("已升级玩家的只读 A/B/C 放大（3张，不改变当前C状态）", grid("".join(figure(item["file"], f'{NAMES[id]} · {STAGE_NAMES[item["condition"]]}只读放大；真实档案仍为C') for item in previews)))
    sections.append(details(f'{NAMES[id]} · 三态／自然处理／只读放大', content, opened=id == "receipt"))

rooms = [case for case in screens["cases"] if case["kind"] == "shared-room"]
room_figures = "".join(figure(case[key], f'{case["engine"]} {case["width"]}×{case["height"]} · {label}实际整页')
                       for case in rooms for key, label in (("baseFile", "基地"), ("collectionFile", "收藏")))
native_screens = [item for item in screens["screenshots"] if item["kind"] == "native-viewport"]
assert len(native_screens) == 54
all_states = details("双引擎／两种尺寸完整三态页面（54张）", grid("".join(figure(item["file"], f'{item["name"]} · 桌面触控仿真实际页面') for item in native_screens)))
other_materials = [item for report in (screens, processes) for item in report["materials"] if item["file"] not in featured_materials]
material_coverage = details("其余完整透明PNG导出与处理中保持前态的证据（72张）", grid("".join(figure(item["file"], f'{item["id"]} · {item["stage"]} · {item["engine"]} {item["viewportWidth"]} · 整图PNG导出') for item in other_materials)))
museum_content = grid(video_figure(museum_case["video"], "收藏室六柜真实观察、开柜、取放与返回")
                      + figure(museum_sheet["file"], "100秒实录中六次inspect原生影片帧，非手机整页截图", "contact"))
museum_content += f'<p>六件目标齐备；最小身体通道 {museum_case["minBodyClearance"]}，最大手部距离 {museum_case["maxHandReach"]}。这些测量不代替视觉审核。</p>'
museum_content += details("收藏室实际处理阶段与柜体原生裁片（36张）", grid("".join(figure(item["file"], item["name"]
                         + (" · 原生Canvas局部，非手机整页截图" if item["kind"] == "native-canvas-crop" else " · 实际390×844页面")) for item in museum["screenshots"])))

deferred = (("verification.json", "完整构建／测试／固定包结果"), ("performance.json", "两引擎绘制测量"),
            ("taptap-self-test.json", "TapTap开发自测回读"), ("review-status.json", "主任务／用户视觉审核状态"))
verification_links = " · ".join(f'<a href="{file}">{label}</a>' for file, label in deferred)
review_path = OUT / "review-status.json"
review = json.loads(review_path.read_text()) if review_path.exists() else {}
internal_reviewed = review.get("internalReview") == "reviewed_for_user_retest"
qa_path = OUT / "gallery-qa.json"
qa = json.loads(qa_path.read_text()) if qa_path.exists() else {}
gallery_reviewed = qa.get("passed") is True
internal_label = "已完成实录抽帧与三态整图复核，可提交复测" if internal_reviewed else "待主任务确认"
original_links = " · ".join(f'<a href="{file}">{label}</a>' for file, label in zip(REPORT_FILES, ("54态与只读预览原始报告", "六件自然处理账本与时间", "100秒收藏室原始报告")))
page = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>六件奇物三张完整图片 · V0.4.3 审核图库</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#211232;color:#f3dfbe;font:16px/1.65 system-ui,sans-serif}}
main{{width:100%;max-width:1250px;margin:auto;padding:20px;min-width:0}}a{{color:#8ad9e0}}h1{{font-size:25px;line-height:1.4}}h2{{font-size:21px;margin-top:30px}}
p,code,figcaption,summary{{overflow-wrap:anywhere}}code,figcaption{{font-size:13px}}.notice{{padding:16px;border:2px solid #c99960;background:#3c254b}}
details{{min-width:0;border:1px solid #77546c;border-radius:5px;margin:14px 0;padding:0 12px 12px}}summary{{cursor:pointer;padding:14px 0;font-weight:600}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:15px;align-items:start;min-width:0}}
.trio{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;min-width:0}}figure{{margin:0 0 12px;min-width:0;max-width:100%}}
figure img,figure video{{display:block;width:100%;max-width:100%;height:auto;background:#29183c}}figure img{{image-rendering:pixelated}}
figure figcaption{{padding:8px 0}}.contact{{grid-column:1/-1}}.film{{width:min(100%,390px);justify-self:center}}.film video{{max-height:680px;object-fit:contain}}
.material img{{background:repeating-conic-gradient(#29183c 0% 25%,#342247 0% 50%) 50% / 20px 20px}}.facts{{padding:12px;background:#2d1b3c}}
@media(max-width:500px){{main{{padding:12px}}h1{{font-size:23px}}details{{padding:0 8px 8px}}.trio{{gap:6px}}.trio figcaption{{font-size:11px}}}}
</style></head><body><main>
<h1>六件奇物 · 三张完整状态图 · V0.4.3</h1>
<p class="notice">内部视觉审核：{internal_label}。用户最终视觉审核：待确认。真实手机：未测。<br>本页来自固定包的桌面移动尺寸触控仿真与真实连续录像，工程检查完成不代表美术验收。</p>
<p>运行源码 <code>{SOURCE}</code><br>ZIP SHA256 <code>{ZIP_SHA}</code><br>继续 <code>loststar.fusion.firstplanet.v037</code> 当前档。</p>
<p class="facts">刚获得 → 清理后 → 零件升级后：每态读取一张完整PNG/WebP画面，一次完整绘制；不分片、不用旧渐变清污或拼片动画生成下一态。处理中保留前图，真实条件提交后才换图；进度条沿用原工作时间。</p>
<p>原费用、存档、已购能力与展柜权益继续；C不增加额外收费或等级。18张源图中13张为本轮生成的完整图，5张C原字节复用已确认完整图以保留主动互动一致性；不声称全部重新生成。批准概念原图仍作为原始参考来源。</p>
<p><a href="../../design/visual-renewal/V043_COMPLETE_IMAGE_STATES.md">三态制作与来源说明</a> · <a href="../../design/visual-renewal/approved/03_curio_restoration_and_collection.png">批准原始概念PNG</a> · <a href="../../assets/runtime/visual-renewal/whole-states-v043/registration.json">18态正式导出登记</a></p>
<p>本轮144项原始图像记录、90份完整PNG导出、7段自然1倍录像；下列7张联系表由24张原生影片帧组成。联系表中的原帧未裁切、缩放或补画，标题与说明位于帧外。<a href="derivedframes/index.json">每张原帧的原片、实际帧序号、时间和SHA</a></p>
<h2>六件三态与实际处理</h2><p>每组三张透明图均选自Chromium 390的实际materialSnapshot完整导出。点击图片可打开原尺寸；折叠组中保留处理页面和已升级物件的只读放大对照。</p>
{''.join(sections)}
<h2>同一房间与收藏页</h2>{details('Chromium360／390和WebKit390：基地与收藏整页（6张）', grid(room_figures))}
<h2>100秒收藏室 · 保留真实开柜取放动作</h2>{museum_content}
<h2>完整覆盖与原始记录</h2>{all_states}{material_coverage}<p>{original_links}</p>
<h2>验证与未完成审核</h2><p>{verification_links}</p>
<p>验证及审核状态分别以链接中的实际记录为准；缺失记录不表示通过。真实TapTap手机的三态观感、触控、锁屏恢复、发热与低端WebView仍待实机复审。铃等已接受的主动免费动作继续保留，本页不重新宣称用户已验收。</p>
<p>当前仅打磨退货箱星／退件平原；Draft PR #2保持Draft，不合并、不提审、不正式发布。</p>
</main></body></html>'''
(OUT / "index.html").write_text(page, encoding="utf-8")
status = {"version": "0.4.3", "sourceCommit": SOURCE, "zipSha256": ZIP_SHA, "sourceClean": True,
          "status": "ready_for_user_retest" if internal_reviewed else "pending_internal_and_user_review",
          "internalReview": "reviewed_for_user_retest" if internal_reviewed else "pending_root_review", "userReview": "pending",
          "physicalPhone": False, "touchEmulation": True, "generatedAt": datetime.now(timezone.utc).isoformat(),
          "reports": list(REPORT_FILES), "sourceReportSha256": report_hashes, "screenshots": 144, "materials": 90,
          "featuredCompleteMaterials": 18, "readOnlyEnlargedPreviews": 18, "sharedRoomPages": 6,
          "videos": [item for item in media_index if item["kind"] == "videos"], "extractedFrames": len(frames),
          "contactSheets": len(contact_sheets), "derivedIndex": "derivedframes/index.json",
          "frameMethod": "ffprobe actual frame timestamps + ffmpeg select by original frame index; no frame interpolation, cropping or resizing",
          "galleryLayout": "Responsive CSS grid and foldable groups; no external libraries. " + ("390px Chromium/WebKit: 241 images and 7 actual MP4s loaded/played, no horizontal overflow." if gallery_reviewed else "Browser layout review remains pending."),
          "deferredVerificationLinks": [file for file, _ in deferred], "media": media_index, "errors": []}
for file, digest in report_hashes.items():
    assert sha((OUT / file).read_bytes()) == digest, f"Original capture report changed during gallery build: {file}"
dump(OUT / "gallery-status.json", status)
print(json.dumps({"sourceCommit": SOURCE, "zipSha256": ZIP_SHA, "gallery": str(OUT / "index.html"),
                  "screenshots": 144, "materials": 90, "videos": 7, "frames": len(frames), "contactSheets": len(contact_sheets)}, ensure_ascii=False))
