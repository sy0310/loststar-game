"""Export reusable transparent branding and a type hierarchy specimen."""
from PIL import Image, ImageDraw, ImageFont
from typography import HERE, lettering, wordmark


def main():
    image = Image.new("RGB", (1280, 960), "#151324")
    draw = ImageDraw.Draw(image)
    regular = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 27, index=1)
    draw.text((64, 38), "失物号 · 宣传字体层级 / TYPOGRAPHY", font=regular, fill="#bca9d6")
    draw.line((64, 92, 1216, 92), fill="#4c315f", width=2)
    mark = wordmark(840)
    image.paste(mark, (220, 118), mark)
    draw.text((64, 445), "01  封面 / 片名 · 金色字面，紫色侧影，少量推进切边", font=regular, fill="#bca9d6")
    hero = lettering("会追踪的电网？", 110, gold=True, hero=True)
    image.paste(hero, ((1280-hero.width)//2, 502), hero)
    draw.text((64, 655), "02  短字幕 · 同字形，白色主体，减轻字效", font=regular, fill="#bca9d6")
    caption = lettering("这局，试试放电流。", 70)
    image.paste(caption, (110, 708), caption)
    draw.text((64, 846), "03  信息小字 / 游戏 HUD · 简洁、清晰；字效不覆盖数值", font=regular, fill="#bca9d6")
    image.save(HERE / "type-system-preview.png")
    mark.save(HERE / "wordmark-transparent.png")
    print("Exported reusable wordmark and 1280×960 hierarchy specimen")


if __name__ == "__main__":
    main()
