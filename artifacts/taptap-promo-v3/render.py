"""Third creator cut: theme-matched display typography over the approved v2 edit."""
import argparse
import json
import math
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "design/star-salvage/promo-typography"))
from typography import lettering, wordmark
WORK = ROOT / "releases/taptap-promo-v3-private/render"
FONT_PATH = os.environ.get("PROMO_FONT", "/System/Library/Fonts/STHeiti Medium.ttc")
FONT_INDEX = int(os.environ.get("PROMO_FONT_INDEX", "1"))
WIDTH, HEIGHT, FPS = 1080, 1920, 30
DURATION = 54
WHITE = "#fff8ef"
GOLD = "#ffd36e"
INK = "#100d20"


def run(args, **kwargs):
    subprocess.run(args, check=True, **kwargs)


def ffmpeg(*args):
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)])


def font(size):
    return ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)


def centered(draw, text, y, size, fill=WHITE, stroke=4):
    face = font(size)
    length = draw.textlength(text, font=face)
    while length > 880:
        size -= 2
        face = font(size)
        length = draw.textlength(text, font=face)
    draw.text(((WIDTH - length) / 2, y), text, font=face, fill=fill,
              stroke_width=stroke, stroke_fill=INK, anchor="lt")


CAPTIONS = [
    {"start": 0.10, "end": 3.7, "lines": ["把电网装进蜂群，", "会怎样？"], "gold": True},
    {"start": 4.2, "end": 7.7, "lines": ["出港时，还挺乖。"]},
    {"start": 8.2, "end": 13.6, "lines": ["这局，试试放电流。"]},
    {"start": 14.15, "end": 19.1, "lines": ["先把电弧，铺成网。"], "gold": True},
    {"start": 19.65, "end": 24.6, "lines": ["再让蜂群，把电网带走。"], "gold": True},
    {"start": 25.2, "end": 28.4, "lines": ["打一架，电一串。"], "gold": True},
    {"start": 40.0, "end": 42.7, "lines": ["再塞一颗黑洞。"], "gold": True, "lower_left": True},
    {"start": 48.15, "end": 53.85, "ending": True},
]


def caption_image(caption):
    image = Image.new("RGBA", (WIDTH, 420))
    draw = ImageDraw.Draw(image)
    if caption.get("ending"):
        title = wordmark().resize((680, 228), Image.Resampling.LANCZOS)
        image.alpha_composite(title, (200, 0))
        centered(draw, "现已上线 TapTap", 254, 48)
        center_art(image, "你的下一套，会有多离谱？", 332, 52)
        return image
    lines = caption["lines"]
    if caption.get("lower_left"):
        image.alpha_composite(lettering(lines[0], 64, gold=True, max_width=700), (120, 174))
        return image
    size = 68 if len(lines[0]) > 12 else 76
    first_y = 174 if len(lines) == 1 else 120
    for index, line in enumerate(lines):
        if len(lines) == 2 and index == 1:
            center_art(image, line, 220, 104, gold=True, hero=True)
        else:
            center_art(image, line, first_y + index * 86, size,
                       gold=caption.get("gold", False), hero=len(lines) == 2)
    if caption.get("small"):
        centered(draw, caption["small"], 280, 32, WHITE, 3)
    # Small stepped corner accents keep the overlay close to the game's pixel UI.
    y = first_y - 26
    for x, direction in [(112, 1), (968, -1)]:
        draw.rectangle((x - 2, y, x + 2, y + 12), fill=GOLD)
        draw.rectangle((min(x, x + direction * 14), y,
                        max(x, x + direction * 14), y + 4), fill=GOLD)
    return image


def center_art(canvas, text, y, size, gold=False, hero=False):
    layer = lettering(text, size, gold=gold, hero=hero)
    canvas.alpha_composite(layer, ((WIDTH-layer.width)//2, y))


def badge(text):
    face = font(28)
    image = Image.new("RGBA", (WIDTH, 70))
    draw = ImageDraw.Draw(image)
    length = math.ceil(draw.textlength(text, font=face))
    draw.rectangle((103, 6, 137 + length, 55), fill=(16, 13, 32, 220))
    draw.rectangle((103, 6, 108, 55), fill=GOLD)
    draw.text((122, 14), text, font=face, fill=WHITE, anchor="lt")
    return image


def render_captions():
    layers = [caption_image(caption) for caption in CAPTIONS]
    labels = {"advanced": badge("进阶配装演示"), "natural": badge("普通开局 · 实际游玩")}
    target = WORK / "caption-track.mov"
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
               "-pixel_format", "rgba", "-video_size", "1080x640", "-framerate", str(FPS),
               "-i", "-", "-c:v", "qtrle", "-pix_fmt", "argb", str(target)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        for frame in range(DURATION * FPS):
            second = frame / FPS
            canvas = Image.new("RGBA", (WIDTH, 640))
            for spec, layer in zip(CAPTIONS, layers):
                if not spec["start"] <= second < spec["end"]:
                    continue
                age = second - spec["start"]
                remaining = spec["end"] - second
                opacity = min(1, age / .10, remaining / .18)
                if age < .13:
                    scale = .93 + age / .13 * .10
                elif age < .28:
                    scale = 1.03 - (age - .13) / .15 * .03
                else:
                    scale = 1
                current = layer.resize((round(WIDTH * scale), round(420 * scale)), Image.Resampling.NEAREST)
                if opacity < 1:
                    current.putalpha(current.getchannel("A").point(lambda a: round(a * opacity)))
                offset = round(12 * max(0, 1 - age / .2))
                # The lower UI region has empty space below the actual cards,
                # reroll button and recipe guide. Place captions there while selecting.
                if spec.get("lower_left"):
                    offset += 274
                elif 8 <= second < 10.5:
                    offset += 274
                elif 14 <= second < 16.5 or 19.5 <= second < 22:
                    offset += 240
                canvas.alpha_composite(current, ((WIDTH - current.width) // 2,
                                                (420 - current.height) // 2 + offset))
                if spec.get("gold") and age < .55:
                    draw = ImageDraw.Draw(canvas)
                    for i in range(4):
                        x = round(160 + i * 252 + math.sin(i * 2) * age * 28)
                        y = round(135 - age * (28 + i * 7))
                        draw.rectangle((x, y, x + 4, y + 4), fill=GOLD)
            canvas.alpha_composite(labels["natural" if 4 <= second < 14 else "advanced"], (0, 568))
            process.stdin.write(canvas.tobytes())
    finally:
        process.stdin.close()
    if process.wait():
        raise RuntimeError("Caption encoding failed")


def render_base(plan):
    parts = []
    for index, segment in enumerate(plan["segments"]):
        source = HERE / segment["file"]
        target = WORK / f"segment-{index:02d}.mov"
        duration = segment["out"] - segment["in"]
        filters = ("scale=1080:1920:force_original_aspect_ratio=decrease:"
                   "force_divisible_by=2:flags=neighbor,"
                   "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x151324,"
                   "setsar=1,fps=30,setpts=PTS-STARTPTS")
        ffmpeg("-ss", segment["sourceIn"], "-i", source, "-t", duration,
               "-vf", filters, "-af", f"asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st={duration-.025}:d=0.025",
               "-c:v", "libx264", "-threads", "4", "-preset", "fast", "-crf", "18",
               "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
               target)
        parts.append(target)
    concat = WORK / "concat.txt"
    concat.write_text("\n".join("file '" + str(part) + "'" for part in parts) + "\n")
    ffmpeg("-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", WORK / "base.mov")


def render_final():
    # This revision changes typography. Copy the approved v2 AAC stream byte for byte.
    graph = "[0:v][1:v]overlay=x=0:y=1240:shortest=1[v]"
    ffmpeg("-i", WORK / "base.mov", "-i", WORK / "caption-track.mov",
           "-i", HERE.parent / "taptap-promo-v2/final-portrait.mp4",
           "-filter_complex", graph, "-map", "[v]", "-map", "2:a:0", "-t", DURATION,
           "-c:v", "libx264", "-threads", "4", "-preset", "slow", "-crf", "19",
           "-maxrate", "10M", "-bufsize", "20M", "-profile:v", "high", "-level:v", "4.1",
           "-pix_fmt", "yuv420p", "-c:a", "copy",
           "-movflags", "+faststart", "-map_metadata", "-1",
           "-metadata", "title=失物号：星海突进｜电网装进蜂群", HERE / "final-portrait.mp4")


def extract_frame(file, second, target):
    ffmpeg("-ss", second, "-i", file, "-frames:v", "1", target)


def render_previews():
    frame = WORK / "cover-frame.png"
    extract_frame(WORK / "base.mov", 49.2, frame)
    image = Image.open(frame).convert("RGBA")
    layer = Image.new("RGBA", image.size)
    draw = ImageDraw.Draw(layer)
    # Softly shaded heading area sits below the complete original HUD and above the ship.
    for y in range(520, 700):
        alpha = round(120 * math.sin((y - 520) / 180 * math.pi))
        draw.line((96, y, 984, y), fill=(14, 10, 30, alpha))
    center_art(layer, "会追踪的电网？", 535, 132, gold=True, hero=True)
    center_art(layer, "蜂群 × 星链雷网", 700, 64)
    center_art(layer, "失物号：星海突进", 805, 44)
    layer.alpha_composite(badge("真实游戏画面 · 进阶配装演示"), (0, 1790))
    Image.alpha_composite(image, layer).convert("RGB").save(HERE / "cover.jpg", quality=95, subsampling=0)
    times = [.8, 5, 8.8, 11.8, 14.8, 17.8, 20.4, 23.4, 27.5, 41.2, 43.2, 51.5]
    sheet = Image.new("RGB", (1080, 3 * 514), "#151324")
    draw = ImageDraw.Draw(sheet)
    face = font(22)
    for index, second in enumerate(times):
        dest = WORK / f"preview-{index:02d}.png"
        extract_frame(HERE / "final-portrait.mp4", second, dest)
        image = Image.open(dest).convert("RGB").resize((270, 480), Image.Resampling.NEAREST)
        x, y = index % 4 * 270, index // 4 * 514
        sheet.paste(image, (x, y))
        draw.text((x + 12, y + 486), f"{second:04.1f}s", font=face, fill=WHITE)
    sheet.save(HERE / "preview-contact-sheet.jpg", quality=94, subsampling=0)
    (HERE / "captions.json").write_text(json.dumps(CAPTIONS, ensure_ascii=False, indent=2) + "\n")
    brand = ROOT / "design/star-salvage/promo-typography"
    wordmark().save(brand / "wordmark-transparent.png")
    # Same actual shot, old and new typography; no changes to underlying battle art.
    before = Image.open(HERE.parent / "taptap-promo-v2/cover.jpg").convert("RGB")
    after = Image.open(HERE / "cover.jpg").convert("RGB")
    comparison = Image.new("RGB", (1080, 1010), INK)
    comparison.paste(before.resize((540, 960)), (0, 50))
    comparison.paste(after.resize((540, 960)), (540, 50))
    labels = ImageDraw.Draw(comparison)
    labels.text((28, 13), "v2 · 原字体", font=font(28), fill=WHITE)
    labels.text((568, 13), "v3 · 字形与字效", font=font(28), fill=GOLD)
    comparison.save(HERE / "typography-before-after.jpg", quality=94, subsampling=0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--previews-only", action="store_true")
    parser.add_argument("--skip-base", action="store_true")
    args = parser.parse_args()
    WORK.mkdir(parents=True, exist_ok=True)
    if not args.previews_only:
        plan = json.loads((HERE / "edit.json").read_text())
        if abs(sum(s["out"] - s["in"] for s in plan["segments"]) - DURATION) > .001:
            raise RuntimeError("Edit duration does not match 54 seconds")
        if not args.skip_base:
            render_base(plan)
        render_captions()
        render_final()
    render_previews()


if __name__ == "__main__":
    main()
