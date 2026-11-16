"""Theme-specific display lettering; original glyphs remain unmodified OFL font data."""
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
FONT = HERE / "fonts/SmileySans-Oblique.ttf"
INK = (15, 10, 31, 255)


@lru_cache(maxsize=64)
def face(size):
    return ImageFont.truetype(str(FONT), size)


def text_mask(text, size):
    font = face(size)
    box = font.getbbox(text)
    mask = Image.new("L", (box[2] - box[0] + 48, box[3] - box[1] + 48))
    ImageDraw.Draw(mask).text((24 - box[0], 24 - box[1]), text,
                             font=font, fill=255, stroke_width=0)
    return mask


def paint_mask(canvas, mask, color, offset=(0, 0)):
    layer = Image.new("RGBA", canvas.size, color)
    alpha = Image.new("L", canvas.size)
    alpha.paste(mask, offset)
    layer.putalpha(alpha)
    canvas.alpha_composite(layer)


def lettering(text, size, gold=False, hero=False, max_width=880):
    """Compact slanted face, warm metallic face, restrained violet stepped depth."""
    mask = text_mask(text, size)
    while mask.width > max_width:
        size -= 2
        mask = text_mask(text, size)
    width, height = mask.size
    depth = 10 if hero else 4
    border = mask.filter(ImageFilter.MaxFilter(13 if hero else 7))
    canvas = Image.new("RGBA", (width + 16, height + 16))
    paint_mask(canvas, border, INK, (3, depth + 3))
    # Offset, square-ended extrusion suggests the game's solid pixel machinery.
    for step in range(depth, 0, -1):
        paint_mask(canvas, border, (70, 29, 112, 255), (-step // 2 + 5, step + 2))
    paint_mask(canvas, border, INK)
    if hero:
        paint_mask(canvas, mask.filter(ImageFilter.MaxFilter(5)), (250, 190, 74, 255))
    bounds = mask.getbbox()
    top, bottom = bounds[1], bounds[3]
    # A single light source: pale upper edge, saturated body, darker lower edge.
    colors = ((255, 251, 211), (255, 209, 90), (226, 144, 47)) if gold else (
        (255, 255, 255), (246, 240, 255), (187, 168, 222))
    yy = np.clip((np.arange(height) - top) / max(1, bottom - top), 0, 1)
    gradient = np.zeros((height, width, 4), dtype=np.uint8)
    for y, value in enumerate(yy):
        mix = value * 2 if value < .5 else (value - .5) * 2
        a, b = (colors[0], colors[1]) if value < .5 else (colors[1], colors[2])
        gradient[y, :, :3] = [round(a[c] * (1 - mix) + b[c] * mix) for c in range(3)]
    gradient[:, :, 3] = np.asarray(mask)
    canvas.alpha_composite(Image.fromarray(gradient))
    if hero:
        # Two short thrust marks and a clipped corner, kept outside the glyph counters.
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((3, 12, 37, 15), fill=(255, 211, 110, 255))
        draw.rectangle((9, 5, 23, 8), fill=(171, 112, 239, 255))
    return canvas.crop(canvas.getbbox())


def wordmark(width=840):
    canvas = Image.new("RGBA", (width, 310))
    first = lettering("失物号", 150, gold=True, hero=True, max_width=width-40)
    second = lettering("星海突进", 84, gold=False, hero=False, max_width=width-40)
    canvas.alpha_composite(first, ((width-first.width)//2, 8))
    canvas.alpha_composite(second, ((width-second.width)//2, 170))
    draw = ImageDraw.Draw(canvas)
    for x, direction in [(70, 1), (width-70, -1)]:
        tip = x + direction * 95
        draw.line((x, 147, tip, 147), fill=(243, 186, 77, 255), width=3)
        draw.rectangle((min(x,tip), 143, min(x,tip)+7, 150), fill=(174, 112, 237, 255))
    return canvas.crop((0, 0, width, 282))
