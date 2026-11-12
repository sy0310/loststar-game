"""Export three generated boss bodies as native pixels and editable material layers.

Generated originals remain unchanged. Production geometry keeps the original
aspect ratio, and runtime exports use nearest-neighbour integer scaling.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/v065/bosses'
COLORS = json.loads((HERE / 'palette.json').read_text())['colors']
RGB = [tuple(bytes.fromhex(color[1:])) for color in COLORS]
BODY_COLORS = RGB[:28]
GOLD_COLORS = set(RGB[10:15])
ENERGY_COLORS = set(RGB[15:25] + RGB[28:])


def png_bytes(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return stream.getvalue()


def record(path):
    return {'path': path.relative_to(ROOT).as_posix(),
            'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def write_archive(archive, name, data, stored=False):
    entry = zipfile.ZipInfo(name, (2026, 11, 12, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    archive.writestr(entry, data)


def normalize(path, size, actor_id):
    image = Image.open(path).convert('RGBA')
    # Keep the solid generated hull and remove low-opacity exterior fringe.
    alpha = image.getchannel('A').point(lambda value: 255 if value >= 200 else 0)
    image.putalpha(alpha)
    crop = image.getbbox()
    if not crop:
        raise ValueError(f'No solid body in {path}')
    image = image.crop(crop)
    scale = (size - 8) / max(image.size)
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    reduced = image.resize((width, height), Image.Resampling.BOX)
    native = Image.new('RGBA', (size, size))
    offset_x = (size - width) // 2
    offset_y = (size - height) // 2
    for y in range(height):
        for x in range(width):
            red, green, blue, opacity = reduced.getpixel((x, y))
            if opacity < 110:
                continue
            # Existing weapon/effect violets are reserved for the physical
            # core. Metal stays on the shared actor palette.
            purple_energy = red - green > 30 and blue - green > 45
            candidates = RGB if purple_energy else BODY_COLORS
            core_region = 24 <= x + offset_x <= 40 and 20 <= y + offset_y <= 38
            if actor_id == 'boss_weaver' and not core_region:
                candidates = [color for color in candidates if color not in RGB[8:10]]
            color = min(candidates, key=lambda candidate:
                        (candidate[0] - red) ** 2 +
                        (candidate[1] - green) ** 2 +
                        (candidate[2] - blue) ** 2)
            native.putpixel((x + offset_x, y + offset_y), (*color, 255))
    return native, list(crop)


def save_openraster(path, image):
    layers = {name: Image.new('RGBA', image.size) for name in ['armor', 'gold', 'energy']}
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if not pixel[3]:
                continue
            if pixel[:3] in GOLD_COLORS:
                material = 'gold'
            elif pixel[:3] in ENERGY_COLORS:
                material = 'energy'
            else:
                material = 'armor'
            layers[material].putpixel((x, y), pixel)
    merged = Image.new('RGBA', image.size)
    for layer in layers.values():
        merged = Image.alpha_composite(merged, layer)
    assert merged.tobytes() == image.tobytes()
    tree = ET.Element('image', {'w': str(image.width), 'h': str(image.height),
                              'name': path.stem, 'version': '0.0.3'})
    stack = ET.SubElement(tree, 'stack')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
        write_archive(archive, 'mimetype', 'image/openraster', stored=True)
        for name in reversed(layers):
            source = f'data/{name}.png'
            ET.SubElement(stack, 'layer', {'name': name, 'src': source, 'x': '0', 'y': '0',
                                         'opacity': '1.0', 'visibility': 'visible',
                                         'composite-op': 'svg:src-over'})
            write_archive(archive, source, png_bytes(layers[name]))
        write_archive(archive, 'stack.xml', ET.tostring(tree, encoding='utf-8', xml_declaration=True))
        write_archive(archive, 'mergedimage.png', png_bytes(image))


def contact(rows):
    sheet = Image.new('RGB', (1200, 640), '#17172b')
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
    except OSError:
        font = ImageFont.load_default()
    for index, row in enumerate(rows):
        left = index * 400
        draw.rectangle((left + 8, 8, left + 392, 632), fill='#242036', outline='#534b65')
        draw.text((left + 24, 28), row['id'].upper(), font=font, fill='#f4c57a')
        image = Image.open(HERE / 'native' / f"{row['id']}@1x.png").convert('RGBA')
        size = row['nativeSize'][0]
        large = image.resize((size * 4, size * 4), Image.Resampling.NEAREST)
        sheet.paste(large, (left + (400 - large.width) // 2, 74), large)
        actual = image.resize((size * 2, size * 2), Image.Resampling.NEAREST)
        sheet.paste(actual, (left + 38, 420), actual)
        draw.text((left + 194, 459), f'{size}px native / 2x', font=font, fill='#73d9e8')
    sheet.save(HERE / 'contact-sheet.png')


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (HERE / 'native').mkdir(exist_ok=True)
    edits = json.loads((HERE / 'native-edits.json').read_text())['bosses']
    geometry = json.loads((HERE / 'geometry.json').read_text())
    rows = []
    for prompt in json.loads((HERE / 'prompts.json').read_text()):
        actor_id, size = prompt['id'], prompt['nativeSize'][0]
        original = HERE / 'originals' / f'{actor_id}-generated.png'
        image, crop = normalize(original, size, actor_id)
        for edit in edits.get(actor_id, []):
            color = tuple(bytes.fromhex(edit['color'][1:]))
            assert color in RGB
            assert image.getpixel((edit['x'], edit['y']))[3]
            image.putpixel((edit['x'], edit['y']), (*color, 255))
        native = HERE / 'native' / f'{actor_id}@1x.png'
        image.save(native)
        ora = HERE / 'native' / f'{actor_id}.ora'
        save_openraster(ora, image)
        paths = [native, ora, original]
        for scale in [2, 4]:
            path = RUNTIME / f'{actor_id}@{scale}x.png'
            image.resize((size * scale, size * scale), Image.Resampling.NEAREST).save(path)
            paths.append(path)
        rows.append({
            'id': actor_id, 'kind': 'actor', 'nativeSize': [size, size],
            'displaySize': [size * 2, size * 2],
            'center': [size / 2, size / 2], 'forward': [0, -1],
            'collisionCenter': [size / 2, size / 2],
            **geometry[actor_id], 'exhaustDirection': [0, 1],
            'contentBBox': list(image.getbbox()), 'originalCrop': crop,
            'frames': [{'x': 0, 'y': 0, 'width': size, 'height': size,
                        'anchor': [size / 2, size / 2]}],
            'files': [record(path) for path in paths],
        })
    source_names = ['export.py', 'verify.py', 'README.md', 'prompts.json',
                    'palette.json', 'native-edits.json', 'geometry.json']
    manifest = {
        'source': 'Built-in imagegen originals, native palette/grid conversion, material-separated editable ORA',
        'palette': 'palette.json', 'runtimeScale': 2, 'assets': rows,
        'sourceInputs': [record(HERE / name) for name in source_names],
        'userVisualApproval': 'PENDING', 'physicalPhoneTested': False,
    }
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    contact(rows)
    print('Exported three boss bodies, 1x PNG / editable ORA / exact 2x and 4x')


if __name__ == '__main__':
    main()
