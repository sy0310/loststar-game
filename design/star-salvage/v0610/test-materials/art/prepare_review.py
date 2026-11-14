"""Build an inspection sheet and index from the retained promotional originals."""

from pathlib import Path
import hashlib
import json

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SOURCE = ROOT / "design/star-salvage/v068/store-media"
FONT = Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")

SELECTION = [
    ("icon-1024", "taptap-icon-1024.png", "icon", "首选游戏图标", "icon-a"),
    ("icon-512", "taptap-icon-512.png", "icon", "游戏图标标准小尺寸", "icon-a"),
    ("hero-titled", "taptap-keyvisual-1920x1080.png", "editorial-preview", "原版横图，保留玩法短句供介绍使用", "hero-titled-a"),
    ("hero-no-text", "taptap-keyvisual-no-text-1920x1080.png", "banner_4", "无字横版宣传插画备选", "hero-a"),
    ("square", "taptap-square-promo-1440.png", "square_promo_image", "方形宣传插画", "square-promo-a"),
]


def metadata(path):
    content = path.read_bytes()
    with Image.open(path) as opened:
        width, height = opened.size
        mode = opened.mode
        image_format = opened.format
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "width": width,
        "height": height,
        "mode": mode,
        "format": image_format,
        "sizeBytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def main():
    source_manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    provenance = {item["id"]: item for item in source_manifest["assets"]}
    records = []
    for identifier, filename, slot, purpose, source_id in SELECTION:
        record = metadata(SOURCE / "exports" / filename)
        source = provenance[source_id]
        record.update({
            "id": identifier,
            "slot": slot,
            "purpose": purpose,
            "isGameplayScreenshot": False,
            "sourceOriginal": source["repoOriginalPath"],
            "sourceSha256": source["sha256"],
            "sourceDimensions": [source["width"], source["height"]],
            "prompt": source["promptPath"],
            "processing": "Existing full-canvas nearest-neighbor technical export retained byte for byte.",
            "reviewStatus": "internal-reviewed-user-review-pending",
        })
        records.append(record)

    original = HERE / "originals/title-only-banner-generated.png"
    title_export = HERE / "exports/taptap-banner-title-only-1920x1080.png"
    title_export.parent.mkdir(exist_ok=True)
    with Image.open(original) as opened:
        exported = opened.convert("RGB").resize((1920, 1080), Image.Resampling.NEAREST)
        exported.save(title_export, "PNG", optimize=False)
    source = metadata(original)
    record = metadata(title_export)
    record.update({
        "id": "hero-title-only",
        "slot": "banner_4",
        "purpose": "首选平台横版宣传插画，保留标题并移除玩法短句",
        "isGameplayScreenshot": False,
        "sourceOriginal": source["path"],
        "sourceSha256": source["sha256"],
        "sourceDimensions": [source["width"], source["height"]],
        "prompt": (HERE / "title-only-edit-prompt.txt").relative_to(ROOT).as_posix(),
        "editTarget": "design/star-salvage/v068/store-media/exports/taptap-keyvisual-1920x1080.png",
        "generationTool": "built-in image_gen.imagegen",
        "processing": "Preserved tool original; full-canvas nearest-neighbor technical size conversion to 1920x1080.",
        "reviewStatus": "internal-reviewed-user-review-pending",
    })
    records.append(record)

    manifest = {
        "project": "失物号：星海突进",
        "purpose": "v0.6.10 first-test art selection and internal review",
        "filesDuplicated": False,
        "generatedNewArt": "One title-only edit, retaining the approved banner identity and composition",
        "sourceManifest": (SOURCE / "manifest.json").relative_to(ROOT).as_posix(),
        "sourceVerifier": (SOURCE / "verify.py").relative_to(ROOT).as_posix(),
        "selected": records,
        "reviewSheet": "review-contact-sheet.png",
        "visualAcceptance": "User review pending",
        "platformUpload": "Not performed by this art preparation task",
        "limitations": [
            "The selected images are promotional illustrations and a store icon.",
            "In-game screenshots and recordings must come from the actual running build.",
            "1920x1080 and 1440x1440 files are technical size conversions of preserved tool originals.",
            "The detailed promotional hull has more surface detail than the small runtime player sprite.",
        ],
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sheet = Image.new("RGB", (1600, 1330), "#100d20")
    draw = ImageDraw.Draw(sheet)
    title = ImageFont.truetype(str(FONT), 31)
    label = ImageFont.truetype(str(FONT), 21)
    small = ImageFont.truetype(str(FONT), 18)
    draw.text((30, 18), "失物号：星海突进 · 首轮测试美术候选", font=title, fill="#f5e2a4")
    draw.text((30, 64), "内部审图用联系表  /  原件及提示保留于 v068/store-media  /  用户视觉待审", font=label, fill="#c7bddb")

    def tile(filename, position, size):
        with Image.open(SOURCE / "exports" / filename) as opened:
            preview = opened.convert("RGB").resize(size, Image.Resampling.NEAREST)
        sheet.paste(preview, position)

    tile("taptap-icon-1024.png", (30, 140), (390, 390))
    draw.text((30, 102), "图标 · 1024 / 512 · 方形完整画布", font=label, fill="#f1ecf7")
    draw.text((455, 102), "小尺寸辨识检查（以下按实际像素显示）", font=label, fill="#f1ecf7")
    for size, x in [(64, 460), (96, 565), (128, 700)]:
        tile("taptap-icon-1024.png", (x, 168), (size, size))
        draw.text((x, 310), f"{size} × {size}", font=small, fill="#c7bddb")
    draw.text((455, 385), "检查点", font=label, fill="#f5e2a4")
    for index, line in enumerate([
        "机身与青色座舱在小图可辨识",
        "64px时炮管细节会压缩",
        "无文字、无预切圆角",
        "宣传插画与实际游戏画面分别交付",
    ]):
        draw.text((455, 424 + index * 29), line, font=small, fill="#c7bddb")

    tile("taptap-square-promo-1440.png", (990, 140), (565, 565))
    draw.text((990, 102), "方形宣传插画 · 1440 × 1440", font=label, fill="#f1ecf7")
    draw.text((30, 740), "首选横版宣传插画 · 1920 × 1080", font=label, fill="#f1ecf7")
    with Image.open(title_export) as opened:
        sheet.paste(opened.convert("RGB").resize((750, 422), Image.Resampling.NEAREST), (30, 780))
    draw.text((820, 740), "无字横版备选 · 1920 × 1080", font=label, fill="#f1ecf7")
    tile("taptap-keyvisual-no-text-1920x1080.png", (820, 780), (750, 422))
    draw.text((30, 1230), "标题逐字核对  失物号 / 星海突进    首选横幅仅保留准确游戏标题", font=label, fill="#f5e2a4")
    draw.text((30, 1274), "联系表用于比对。提交素材使用 manifest.json 指向的完整PNG，实际截图由运行包单独采集。", font=small, fill="#c7bddb")
    sheet.save(HERE / "review-contact-sheet.png", optimize=False)
    print(json.dumps({"selected": len(records), "reviewSheet": str(HERE / "review-contact-sheet.png")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
