"""Export generated originals onto the existing actor palette and integer grid.

Original AI outputs remain unchanged. The ORA contains editable material layers
derived from the final native image and is not a generated layered master.
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
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/v062/actors'
COLORS = json.loads((HERE / 'palette.json').read_text())['colors']
RGB = [tuple(bytes.fromhex(color[1:])) for color in COLORS]


def png_bytes(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return stream.getvalue()


def record(path):
    return {'path': path.relative_to(ROOT).as_posix(),
            'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def write_archive(archive, name, data, stored=False):
    entry = zipfile.ZipInfo(name, (2026, 11, 11, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    archive.writestr(entry, data)


def normalize(path, size):
    image = Image.open(path).convert('RGBA')
    # The imagegen alpha can include a low-opacity outer fringe. Restrict the
    # production sprite to its solid body before reducing the logical grid.
    image.putalpha(image.getchannel('A').point(lambda alpha: 255 if alpha >= 200 else 0))
    crop = image.getbbox()
    if not crop:
        raise ValueError(f'No solid body in {path}')
    image = image.crop(crop)
    scale = (size - 2) / max(image.size)
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    reduced = image.resize((width, height), Image.Resampling.BOX)
    native = Image.new('RGBA', (size, size))
    offset_x, offset_y = (size - width) // 2, (size - height) // 2
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = reduced.getpixel((x, y))
            if alpha < 110:
                continue
            color = min(RGB, key=lambda candidate:
                        (candidate[0] - red) ** 2 + (candidate[1] - green) ** 2 + (candidate[2] - blue) ** 2)
            native.putpixel((x + offset_x, y + offset_y), (*color, 255))
    return native, list(crop)


def save_openraster(path, image):
    layers = {name: Image.new('RGBA', image.size) for name in ['armor', 'gold', 'energy']}
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if not pixel[3]:
                continue
            material = 'gold' if pixel[:3] in RGB[10:15] else 'energy' if pixel[:3] in RGB[15:25] else 'armor'
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
    sheet = Image.new('RGB', (1000, 360), '#17172b')
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 13)
    except OSError:
        font = ImageFont.load_default()
    for index, row in enumerate(rows):
        left = index * 200
        draw.rectangle((left + 6, 6, left + 194, 354), fill='#242036', outline='#534b65')
        draw.text((left + 15, 20), row['id'].upper(), font=font, fill='#f4c57a')
        image = Image.open(HERE / 'native' / f"{row['id']}@1x.png").convert('RGBA')
        size = row['nativeSize'][0]
        large = image.resize((size * 4, size * 4), Image.Resampling.NEAREST)
        sheet.paste(large, (left + (200 - large.width) // 2, 70), large)
        actual = image.resize((size * 2, size * 2), Image.Resampling.NEAREST)
        sheet.paste(actual, (left + 16, 257), actual)
        draw.text((left + 106, 283), f'{size}px', font=font, fill='#73d9e8')
    sheet.save(HERE / 'native-contact.png')


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (HERE / 'native').mkdir(exist_ok=True)
    rows = []
    edits = json.loads((HERE / 'native-edits.json').read_text())['actors']
    nozzles = {
        'lancer': [[11, 23], [16, 23]],
        'sentinel': [[10, 29], [22, 29]],
        'minelayer': [[12, 25], [20, 25]],
        'courier': [[5, 22], [26, 22], [16, 30]],
        'watcher': [[19, 33]],
    }
    for prompt in json.loads((HERE / 'prompts.json').read_text()):
        actor_id, size = prompt['id'], prompt['size']
        original = HERE / 'originals' / f'{actor_id}-generated.png'
        image, crop = normalize(original, size)
        for edit in edits.get(actor_id, []):
            color = tuple(bytes.fromhex(edit['color'][1:]))
            assert color in RGB and image.getpixel((edit['x'], edit['y']))[3]
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
            'center': [size / 2, size / 2], 'forward': [0, -1],
            'collisionCenter': [size / 2, size / 2], 'collisionRadius': prompt['radius'],
            'exhaustAnchors': nozzles[actor_id], 'exhaustDirection': [0, 1],
            'contentBBox': list(image.getbbox()), 'originalCrop': crop,
            'frames': [{'x': 0, 'y': 0, 'width': size, 'height': size,
                        'anchor': [size / 2, size / 2]}],
            'files': [record(path) for path in paths],
        })
    manifest = {'source': 'Built-in imagegen, palette/grid conversion, material-separated editable ORA',
                'palette': 'palette.json', 'runtimeScale': 2, 'assets': rows,
                'sourceInputs': [record(HERE / name) for name in ['export.py', 'prompts.json', 'palette.json', 'native-edits.json']],
                'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    contact(rows)
    print('Exported five original actors, editable ORA, 1x/2x/4x PNG')


if __name__ == '__main__':
    main()
