"""Verify source provenance and reproduce each standard export in memory."""

from pathlib import Path
import hashlib
import io
import json

from PIL import Image


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
MAX_BYTES = 4_000_000


def require(condition, description):
    if not condition:
        raise ValueError(description)


def main():
    manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
    checks = []

    for record in manifest["sources"] + manifest["promptFiles"]:
        path = ROOT / record["path"]
        content = path.read_bytes()
        require(len(content) == record["sizeBytes"], f"Source size changed: {path}")
        require(hashlib.sha256(content).hexdigest() == record["sha256"],
                f"Source SHA256 changed: {path}")
        checks.append({"check": "source size and SHA256", "path": record["path"], "passed": True})

    for record in manifest["assets"]:
        path = ROOT / record["path"]
        original = ROOT / record["repoOriginalPath"]
        content = path.read_bytes()
        require(content == original.read_bytes(), f"Candidate differs from original: {path}")
        require(hashlib.sha256(content).hexdigest() == record["sha256"],
                f"Generated SHA256 changed: {path}")
        with Image.open(path) as image:
            require(image.format == "PNG", f"Generated format changed: {path}")
            require(image.size == (record["width"], record["height"]),
                    f"Generated dimensions changed: {path}")
            image.verify()
        checks.append({"check": "original byte equality, PNG and dimensions",
                       "path": record["path"], "passed": True})

    for record in manifest["exports"]:
        path = HERE / record["path"]
        content = path.read_bytes()
        require(len(content) == record["sizeBytes"] <= MAX_BYTES,
                f"Export size changed or exceeds 4 MB: {path}")
        require(hashlib.sha256(content).hexdigest() == record["sha256"],
                f"Export SHA256 changed: {path}")
        with Image.open(path) as image:
            require(image.format == "PNG" and image.mode == "RGB",
                    f"Export format or color mode changed: {path}")
            require(list(image.size) == record["size"], f"Export dimensions changed: {path}")
            image.verify()

        with Image.open(HERE / record["source"]) as source:
            require(list(source.size) == record["sourceSize"],
                    f"Export source dimensions changed: {path}")
            reproduced = source.convert("RGB").resize(tuple(record["size"]), Image.Resampling.NEAREST)
            buffer = io.BytesIO()
            reproduced.save(buffer, "PNG", optimize=False)
        require(buffer.getvalue() == content, f"Technical export is not reproducible: {path}")
        checks.append({"check": "PNG dimensions, RGB, size, SHA256 and byte-identical reproduction",
                       "path": record["path"], "passed": True})

    for slot in manifest["platformRequirements"]:
        for relative_path in slot["files"]:
            path = HERE / relative_path
            with Image.open(path) as image:
                require(image.width >= slot["minimumSize"][0]
                        and image.height >= slot["minimumSize"][1],
                        f"TapTap {slot['slot']} dimensions failed: {path}")
                require(image.format in slot["formats"], f"TapTap format failed: {path}")
                require(image.width * slot["aspectRatio"][1]
                        == image.height * slot["aspectRatio"][0],
                        f"TapTap aspect ratio failed: {path}")
            require(path.stat().st_size <= slot["maximumSizeBytes"],
                    f"TapTap file exceeds 4 MB: {path}")
            checks.append({"check": "TapTap slot dimensions, aspect ratio, format and size",
                           "slot": slot["slot"], "path": relative_path, "passed": True})

    local_pngs = sorted(HERE.rglob("*.png"))
    require(all(path.stat().st_size <= MAX_BYTES for path in local_pngs),
            "A local store-media PNG exceeds 4 MB")
    checks.append({"check": "all local PNG files are at most 4 MB",
                   "fileCount": len(local_pngs), "passed": True})
    report = {
        "status": "passed",
        "count": len(checks),
        "checks": checks,
        "maximumFileSizeBytes": MAX_BYTES,
        "visualReview": manifest["review"],
        "reproductionMethod": "Full-canvas nearest-neighbor export recreated in memory and compared byte for byte.",
    }
    (HERE / "verification.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"status": "passed", "checks": len(checks),
                      "exportCount": len(manifest["exports"]),
                      "platformFileCount": sum(len(slot["files"]) for slot in manifest["platformRequirements"])},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
