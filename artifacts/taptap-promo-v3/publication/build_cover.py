"""16:9 creator thumbnail from the same actual battle frame as the approved cover."""
import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "design/star-salvage/promo-typography"))
from typography import lettering


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=HERE / "cover-landscape.jpg")
    args = parser.parse_args()
    private = ROOT / "releases/taptap-promo-v3-private/publication"
    private.mkdir(parents=True, exist_ok=True)
    source = ROOT / "artifacts/taptap-promo-v1/source-footage/climax.mp4"
    frame = private / "cover-source.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "15.2", "-i", str(source),
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=neighbor,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x151324,setsar=1",
                    "-frames:v", "1", str(frame)], check=True)
    base = Image.open(frame).convert("RGB")
    image = Image.new("RGB", (1280, 720), "#151324")
    battle = base.crop((96, 520, 984, 1560)).resize((630, 738), Image.Resampling.NEAREST)
    image.paste(battle.crop((0, 0, 630, 720)), (650, 0))
    arr = np.asarray(image).copy()
    for x in range(650, 790):
        t = (x-650)/140
        arr[:, x, :] = (arr[:, x, :].astype(float)*t+np.array([21, 19, 36])*(1-t)).astype('uint8')
    image = Image.fromarray(arr).convert("RGBA")
    for text, y, size, gold, hero in [
        ("蜂群 × 星链雷网", 60, 49, False, False),
        ("会追踪的", 172, 112, True, True),
        ("电网？", 302, 152, True, True),
        ("失物号：星海突进", 535, 49, False, False),
    ]:
        layer = lettering(text, size, gold=gold, hero=hero, max_width=585)
        image.alpha_composite(layer, (57, y))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 28, index=1)
    draw.text((64, 622), "真实游戏画面 · 进阶配装演示", font=font, fill="#c7b8d8")
    draw.line((64, 594, 542, 594), fill="#aa76d2", width=2)
    image.convert("RGB").save(args.output, quality=95, subsampling=0)


if __name__ == "__main__":
    main()
