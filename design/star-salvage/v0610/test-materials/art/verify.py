"""Verify selected artwork, source provenance, reproducible exports and CLI results."""

from pathlib import Path
import hashlib
import io
import json

from PIL import Image


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]


def require(condition, description):
    if not condition:
        raise ValueError(description)


def main():
    manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
    specs = json.loads((HERE / "platform-specs.json").read_text(encoding="utf-8"))
    checks = []
    for item in manifest["selected"]:
        path = ROOT / item["path"]
        raw = path.read_bytes()
        require(hashlib.sha256(raw).hexdigest() == item["sha256"], f"Changed selected image {path}")
        require(len(raw) == item["sizeBytes"], f"Changed byte size {path}")
        source = ROOT / item["sourceOriginal"]
        require(hashlib.sha256(source.read_bytes()).hexdigest() == item["sourceSha256"], f"Changed source {source}")
        require((ROOT / item["prompt"]).is_file(), f"Missing prompt {item['prompt']}")
        require(item["isGameplayScreenshot"] is False, "Promotional classification changed")

        with Image.open(path) as opened:
            require(opened.format == "PNG" and opened.mode == "RGB", f"Unexpected image format {path}")
            require(opened.size == (item["width"], item["height"]), f"Changed dimensions {path}")
            opened.verify()
        with Image.open(source) as opened:
            require(list(opened.size) == item["sourceDimensions"], f"Changed source dimensions {source}")
            reproduced = opened.convert("RGB").resize((item["width"], item["height"]), Image.Resampling.NEAREST)
            buffer = io.BytesIO()
            reproduced.save(buffer, "PNG", optimize=False)
        require(buffer.getvalue() == raw, f"Non-reproducible technical export {path}")
        checks.append({"id": item["id"], "check": "PNG, SHA256, source, prompt and byte-identical technical export", "passed": True})

        if item["slot"] != "editorial-preview":
            slot = specs["fields"][item["slot"]]
            require(item["width"] >= slot["minimumSize"][0] and item["height"] >= slot["minimumSize"][1], f"Below slot minimum {path}")
            require(item["width"] * slot["aspectRatio"][1] == item["height"] * slot["aspectRatio"][0], f"Wrong slot ratio {path}")
            require(len(raw) <= specs["conservativeMaximumFileSizeBytes"], f"Over local size ceiling {path}")
            checks.append({"id": item["id"], "check": "2026-11-13 read-back slot dimensions, ratio and conservative size", "passed": True})

        local_path = HERE / f"taptap-local-{item['id']}.json"
        local = json.loads(local_path.read_text(encoding="utf-8"))
        require(local["valid"] is True, f"CLI local validation failed {path}")
        candidate = local["candidates"][0]
        require(candidate["width"] == item["width"] and candidate["height"] == item["height"], f"Stale CLI dimensions {path}")
        require(candidate["file_size"] == item["sizeBytes"], f"Stale CLI size {path}")
        require(local["upload_pending"] is True, "Unexpected local upload status")
        checks.append({"id": item["id"], "check": "TapTap CLI local validation and current file dimensions", "passed": True})

    sheet = HERE / manifest["reviewSheet"]
    with Image.open(sheet) as opened:
        require(opened.size == (1600, 1330), "Wrong inspection sheet dimensions")
        opened.verify()
    checks.append({"check": "review contact sheet decodes at 1600x1330", "passed": True})
    report = {
        "status": "passed",
        "checkCount": len(checks),
        "selectedImageCount": len(manifest["selected"]),
        "checks": checks,
        "reviewSheetSha256": hashlib.sha256(sheet.read_bytes()).hexdigest(),
        "visualStatus": "Internal image review completed, user acceptance pending",
        "platformModeration": "Not submitted",
    }
    (HERE / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "checks": len(checks), "selectedImages": len(manifest["selected"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
