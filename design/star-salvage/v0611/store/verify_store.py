#!/usr/bin/env python3
"""Acceptance checks for the v0.6.11 TapTap store listing package.

Validates listing copy fields and media specs, then writes a thumbnail
contact sheet so a reviewer can judge caption legibility at feed size.
Visual quality and honesty still need human review.

  python3 design/star-salvage/v0611/store/verify_store.py \
      design/star-salvage/v0611/store/listing.json --enforce

Media paths in listing.json are relative to the listing file.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image

Result = dict[str, Any]

ROOT = Path(__file__).resolve().parents[4]
GENRE_WORDS = ["割草", "肉鸽", "Roguelike", "幸存", "清屏", "射击"]
JARGON = ["双满级", "精英战利品中抽取", "辅助配件", "主动装置"]
BANNED_TAGS = ["放置", "增量"]
THUMB_WIDTH = 180
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024


def check(results: list[Result], key: str, passed: Any, detail: Any = "") -> None:
    results.append({"key": key, "pass": bool(passed), "detail": detail})


def lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def check_copy(listing: dict[str, Any], results: list[Result]) -> None:
    check(results, "title", listing.get("title") == "失物号：星海突进", listing.get("title"))
    check(results, "category", listing.get("category") == "action", listing.get("category"))
    tags = listing.get("tags") or []
    check(results, "tags.count", 4 <= len(tags) <= 8, len(tags))
    check(results, "tags.genre", "割草" in tags and ("Roguelike" in tags or "肉鸽" in tags), tags)
    check(results, "tags.pixel", "像素" in tags, tags)
    check(results, "tags.noIdle", not any(tag in BANNED_TAGS for tag in tags), tags)
    promo = listing.get("promotionText") or ""
    check(results, "promotionText.length", 6 <= len(promo) <= 25, f"{len(promo)} {promo}")
    check(results, "promotionText.genre", any(word in promo for word in GENRE_WORDS), promo)
    candidates = listing.get("promotionTextCandidates") or []
    check(results, "promotionText.candidates",
          len(candidates) >= 3 and all(len(text) <= 25 for text in candidates), len(candidates))
    description = listing.get("description") or ""
    body = lines(description)
    check(results, "description.length", 80 <= len(description) <= 500, len(description))
    check(results, "description.hook", bool(body) and len(body[0]) <= 24, body[0] if body else "")
    check(results, "description.noTestFraming", not any("测试" in line for line in body[:3]), body[:3])
    check(results, "description.noJargon", not any(word in description for word in JARGON),
          [word for word in JARGON if word in description])
    check(results, "description.evolutionFusion", "进化" in description and "融合" in description)
    note = listing.get("developerNote") or ""
    bullets = [line for line in lines(note) if line[:1] in "·-•"]
    check(results, "developerNote.changelog", "0.6.11" in note and len(bullets) >= 3, len(bullets))
    check(results, "developerNote.noTestOpening", not note.strip().startswith("这是失物号的开发测试版"))
    check(results, "promotionMaterialType", listing.get("promotionMaterialType") == "TRAILER",
          listing.get("promotionMaterialType"))
    commit = listing.get("sourceCommit") or ""
    exists = bool(re.fullmatch(r"[0-9a-f]{7,40}", commit)) and subprocess.run(
        ["git", "cat-file", "-e", commit + "^{commit}"], cwd=ROOT, capture_output=True).returncode == 0
    check(results, "sourceCommit", exists, commit)


def probe(path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None, float]:
    output = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    data = json.loads(output)
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    return video, audio, float(data["format"]["duration"])


def check_screenshots(paths: list[Path], results: list[Result], thumbs: list[Image.Image]) -> None:
    check(results, "screenshots.count", 5 <= len(paths) <= 6, len(paths))
    for path in paths:
        if not path.exists():
            check(results, f"screenshot.exists:{path.name}", False)
            continue
        with Image.open(path) as image:
            width, height = image.size
            check(results, f"screenshot.size:{path.name}",
                  width == 1080 and 1920 <= height <= 2400, f"{width}x{height}")
            thumbs.append(image.convert("RGB").resize((THUMB_WIDTH, round(height * THUMB_WIDTH / width))))
        check(results, f"screenshot.bytes:{path.name}", path.stat().st_size <= MAX_IMAGE_BYTES,
              path.stat().st_size)
        check(results, f"screenshot.format:{path.name}", path.suffix.lower() in {".png", ".jpg", ".jpeg"})


def check_video(path: Path | None, results: list[Result], key: str, landscape: bool,
                duration_range: tuple[float, float], need_audio: bool) -> float | None:
    if not path or not path.exists():
        check(results, f"{key}.exists", False, str(path))
        return None
    video, audio, duration = probe(path)
    if video is None:
        check(results, f"{key}.videoStream", False)
        return None
    width, height = int(video["width"]), int(video["height"])
    if landscape:
        shape_ok = abs(width / height - 16 / 9) < 0.02 and width >= 1280
    else:
        shape_ok = height > width and min(width, height) >= 540
    check(results, f"{key}.shape", shape_ok, f"{width}x{height}")
    check(results, f"{key}.duration", duration_range[0] <= duration <= duration_range[1], round(duration, 2))
    check(results, f"{key}.codec", video["codec_name"] == "h264", video["codec_name"])
    if need_audio:
        check(results, f"{key}.audio", audio is not None, audio["codec_name"] if audio else None)
    check(results, f"{key}.bytes", path.stat().st_size <= MAX_VIDEO_BYTES, path.stat().st_size)
    return duration


def trailer_frames(path: Path, duration: float, out: Path) -> list[Image.Image]:
    frames = []
    for index, second in enumerate([0.5, 1.5, 3.0, duration / 2, max(0, duration - 2)]):
        target = out / f"trailer-{index}.jpg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{second:.2f}", "-i", str(path),
                        "-frames:v", "1", "-vf", "scale=480:-2", str(target)], check=True)
        with Image.open(target) as image:
            frames.append(image.convert("RGB"))
    return frames


def contact_sheet(thumbs: list[Image.Image], frames: list[Image.Image], out: Path) -> Path:
    rows = [thumbs, frames]
    width = max((sum(i.width for i in row) + 8 * (len(row) + 1) for row in rows if row), default=200)
    height = sum((max(i.height for i in row) + 8) for row in rows if row) + 8
    sheet = Image.new("RGB", (width, max(height, 50)), (18, 16, 30))
    y = 8
    for row in rows:
        if not row:
            continue
        x = 8
        for image in row:
            sheet.paste(image, (x, y))
            x += image.width + 8
        y += max(i.height for i in row) + 8
    target = out / "contact-sheet.jpg"
    sheet.save(target, quality=88)
    return target


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("listing", type=Path)
    parser.add_argument("--enforce", action="store_true")
    parser.add_argument("--copy-only", action="store_true")
    parser.add_argument("--out", type=Path, default=ROOT / "releases" / "store-check" / str(int(time.time())))
    args = parser.parse_args()
    listing_path = args.listing.resolve()
    out = args.out.resolve()
    listing = json.loads(listing_path.read_text())
    base = listing_path.parent
    results: list[Result] = []
    check_copy(listing, results)
    thumbs: list[Image.Image] = []
    frames: list[Image.Image] = []
    out.mkdir(parents=True, exist_ok=True)
    if not args.copy_only:
        media = listing.get("media") or {}
        check_screenshots([base / p for p in media.get("screenshots", [])], results, thumbs)
        trailer = base / media["trailer"] if media.get("trailer") else None
        duration = check_video(trailer, results, "trailer", True, (15, 30), True)
        if duration:
            frames = trailer_frames(trailer, duration, out)
        cover = base / media["trailerCover"] if media.get("trailerCover") else None
        if cover and cover.exists():
            with Image.open(cover) as image:
                check(results, "trailerCover.size", image.size == (1920, 1080), f"{image.size}")
            check(results, "trailerCover.bytes", cover.stat().st_size <= MAX_IMAGE_BYTES)
        else:
            check(results, "trailerCover.exists", False)
        if media.get("gameplayDemo"):
            check_video(base / media["gameplayDemo"], results, "gameplayDemo", False, (15, 60), False)
    sheet = contact_sheet(thumbs, frames, out) if (thumbs or frames) else None
    failures = [item["key"] for item in results if not item["pass"]]
    report = {"listing": str(listing_path.relative_to(ROOT)), "results": results, "failures": failures,
              "contactSheet": str(sheet.relative_to(ROOT)) if sheet else None}
    (out / "store-check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    for item in results:
        print(("PASS " if item["pass"] else "FAIL ") + item["key"], item["detail"])
    print("failures", ", ".join(failures) if failures else "none")
    if sheet:
        print("contact sheet", sheet.relative_to(ROOT))
    return 1 if args.enforce and failures else 0


if __name__ == "__main__":
    sys.exit(main())
