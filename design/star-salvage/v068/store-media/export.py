"""Repeatable size-only exports for internally reviewed store-media candidates."""

from pathlib import Path
import hashlib
import json

from PIL import Image


HERE = Path(__file__).resolve().parent
EXPORTS = [
    ("icon-candidate-a.png", "taptap-icon-512.png", (512, 512)),
    ("icon-candidate-a.png", "taptap-icon-1024.png", (1024, 1024)),
    ("hero-candidate-a.png", "taptap-keyvisual-no-text-1280x720.png", (1280, 720)),
    ("hero-titled-candidate-a.png", "taptap-keyvisual-1280x720.png", (1280, 720)),
    ("hero-candidate-a.png", "taptap-keyvisual-no-text-1920x1080.png", (1920, 1080)),
    ("hero-titled-candidate-a.png", "taptap-keyvisual-1920x1080.png", (1920, 1080)),
    ("square-promo-candidate-a.png", "taptap-square-promo-1440.png", (1440, 1440)),
]


def main():
    destination = HERE / "exports"
    destination.mkdir(exist_ok=True)
    records = []
    for source_name, output_name, size in EXPORTS:
        source = HERE / "candidates" / source_name
        output = destination / output_name
        with Image.open(source) as original:
            image = original.convert("RGB")
            image = image.resize(size, Image.Resampling.NEAREST)
            image.save(output, "PNG", optimize=False)
            source_size = list(original.size)

        with Image.open(output) as exported:
            exported.verify()

        records.append({
            "path": output.relative_to(HERE).as_posix(),
            "source": source.relative_to(HERE).as_posix(),
            "sourceSize": source_size,
            "size": list(size),
            "format": "PNG",
            "mode": "RGB",
            "sizeBytes": output.stat().st_size,
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "processing": "Full-canvas nearest-neighbor size conversion with square corners.",
        })

    report = {
        "method": "Pillow Image.resize with Image.Resampling.NEAREST",
        "scope": "Authorized technical size exports of reviewed generated candidates.",
        "records": records,
    }
    (HERE / "export-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(records, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
