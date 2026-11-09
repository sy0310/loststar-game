#!/usr/bin/env python3
"""Import exact approved 2026-11-09 v0.4 concept artwork. Never touches game saves.
Usage:
    python3 scripts/import_salvage_v04_concept.py --source "/path/to/失物号_星海拾荒像素界面概念板.png"
    python3 scripts/import_salvage_v04_concept.py --find-local
Only files with the exact SHA256 are accepted. Does not git-add/commit.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct

REPO = Path(__file__).resolve().parents[1]
TARGET_ROOT = REPO / "design" / "star-salvage" / "v04" / "concepts"
TARGET = TARGET_ROOT / "salvage_v04_approved_full.png"
CHECKSUM = "16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0"
SIZE = 2142727
WIDTH, HEIGHT = 1122, 1402
CROPS = {
    "home_screen_reference.png": (15, 95, 530, 1135),
    "ship_shop_reference.png": (540, 100, 1115, 555),
    "mission_board_reference.png": (540, 555, 1115, 938),
    "ship_variants_reference.png": (530, 930, 1117, 1160),
    "cargo_icons_reference.png": (12, 1160, 776, 1392),
}


def verify(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size != SIZE:
        return False
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != CHECKSUM:
        return False
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return False
    return struct.unpack(">II", data[16:24]) == (WIDTH, HEIGHT)


def locate():
    roots = [Path.home() / "Downloads", Path.home() / "Desktop", REPO / "design" / "star-salvage" / "v04"]
    for root in roots:
        if root.is_dir():
            for path in root.glob("*.png"):
                if verify(path):
                    return path
    return None


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--source", type=Path, help="Real local original PNG path")
    src.add_argument("--find-local", action="store_true", help="Check only top-level Downloads/Desktop/v04 for exact SHA")
    args = ap.parse_args()
    path = args.source.expanduser().resolve() if args.source else locate()
    if not path:
        raise SystemExit("SOURCE_MISSING: approved concept PNG not found. Provide actual file; do not invent/recreate.")
    if not verify(path):
        raise SystemExit("SOURCE_MISMATCH: file is not the exact approved PNG; no files changed.")
    TARGET_ROOT.mkdir(parents=True, exist_ok=True)
    if TARGET.exists() and not verify(TARGET):
        raise SystemExit("TARGET_CONFLICT: different file exists, do not overwrite.")
    if not TARGET.exists():
        shutil.copyfile(path, TARGET)
    entry = {"reference": TARGET.name, "sizeBytes": SIZE, "sha256": CHECKSUM,
             "width": WIDTH, "height": HEIGHT, "type": "flat_concept_reference_only",
             "status": "SOURCE_PRESENT_NOT_PRODUCTION_SPRITES"}
    try:
        from PIL import Image
    except ImportError:
        print("Pillow unavailable: original copied safely; concept crops not generated.")
    else:
        image = Image.open(TARGET)
        if image.size != (WIDTH, HEIGHT):
            raise SystemExit("SOURCE_MISMATCH: unexpected decoded dimensions.")
        crop_dir = TARGET_ROOT / "reference_crops"
        crop_dir.mkdir(exist_ok=True)
        for name, area in CROPS.items():
            dest = crop_dir / name
            expected = image.crop(area)
            if dest.exists():
                with Image.open(dest) as existing:
                    if existing.size != expected.size or existing.convert("RGBA").tobytes() != expected.convert("RGBA").tobytes():
                        raise SystemExit(f"TARGET_CONFLICT: {dest} differs; do not overwrite.")
            else:
                expected.save(dest)
            entry.setdefault("croppedReferences", {})[name] = {
                "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
                "size": list(expected.size)}
    manifest = TARGET_ROOT / "SOURCE_MANIFEST.json"
    if manifest.exists():
        old = json.loads(manifest.read_text(encoding="utf-8"))
        if old.get("sha256") != CHECKSUM:
            raise SystemExit("TARGET_CONFLICT: existing source manifest differs.")
    manifest.write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SOURCE_PRESENT exact original verified:", TARGET.relative_to(REPO))
    print("Commit only reviewed concept files and manifest; do not treat them as production sprites.")


if __name__ == "__main__":
    main()
