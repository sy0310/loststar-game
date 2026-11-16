"""Export generated companion craft and the original native fusion icon."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/v065/weapons'
COLORS = json.loads((HERE / 'palette.json').read_text())['colors']
RGB = {name: tuple(bytes.fromhex(value[1:])) for name, value in COLORS.items()}
SIZES = {'hunter_drone': (28, 28), 'hive_drone': (32, 28),
         'bastion_mount': (40, 40), 'ionbastion': (24, 24)}
BRASS = {RGB[name] for name in ['bronze', 'gold', 'warm', 'cream', 'orange']}
ENERGY = {RGB[name] for name in ['blueDark', 'blue', 'ice', 'iceLight', 'teal',
                               'violet', 'paleViolet', 'violetShade', 'violetLight']}


def record(path):
    raw = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest()}


def png_bytes(image):
    stream = io.BytesIO()
    image.save(stream, 'PNG')
    return stream.getvalue()


def archive_entry(archive, name, data, stored=False):
    entry = zipfile.ZipInfo(name, (2026, 11, 12, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    archive.writestr(entry, data)


def normalize(path, size):
    image = Image.open(path).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda alpha: 255 if alpha >= 200 else 0))
    crop = image.getbbox()
    assert crop, path
    image = image.crop(crop)
    scale = min((size[0] - 4) / image.width, (size[1] - 4) / image.height)
    width, height = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    reduced = image.resize((width, height), Image.Resampling.BOX)
    native = Image.new('RGBA', size)
    left, top = (size[0] - width) // 2, (size[1] - height) // 2
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = reduced.getpixel((x, y))
            if alpha < 110:
                continue
            color = min(RGB.values(), key=lambda c:
                        (c[0] - red) ** 2 + (c[1] - green) ** 2 + (c[2] - blue) ** 2)
            native.putpixel((left + x, top + y), (*color, 255))
    return native, list(crop)


def icon():
    image = Image.new('RGBA', (24, 24))
    draw = ImageDraw.Draw(image)
    draw.polygon([(12, 6), (21, 11), (20, 18), (12, 22), (4, 18), (3, 11)],
                 fill=RGB['ink'], outline=RGB['shade'])
    draw.polygon([(12, 8), (19, 12), (18, 17), (12, 20), (6, 17), (5, 12)],
                 fill=RGB['blueDark'], outline=RGB['ice'])
    for x in [3, 17]:
        draw.rectangle((x, 2, x + 3, 15), fill=RGB['deep'])
        draw.rectangle((x + 1, 3, x + 2, 12), fill=RGB['silver'])
        draw.rectangle((x, 2, x + 3, 4), fill=RGB['warm'])
        draw.line((x + 1, 6, x + 1, 12), fill=RGB['iceLight'])
        draw.rectangle((x - 1, 14, x + 4, 18), fill=RGB['body'])
        draw.line((x, 14, x + 3, 14), fill=RGB['silver'])
        draw.rectangle((x, 16, x + 3, 17), fill=RGB['gold'])
    draw.polygon([(12, 9), (15, 11), (15, 17), (12, 19), (9, 17), (9, 11)],
                 fill=RGB['bronze'])
    draw.rectangle((10, 11, 14, 17), fill=RGB['gold'])
    draw.rectangle((11, 10, 13, 16), fill=RGB['warm'])
    draw.line((10, 11, 10, 16), fill=RGB['cream'])
    draw.rectangle((11, 12, 13, 15), fill=RGB['ice'])
    draw.line((11, 12, 11, 14), fill=RGB['iceLight'])
    draw.point((12, 11), fill=RGB['white'])
    draw.point((12, 19), fill=RGB['ivory'])
    return image


def save_ora(path, image):
    layers = {key: Image.new('RGBA', image.size) for key in ['armor', 'brass', 'energy']}
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if pixel[3]:
                key = 'brass' if pixel[:3] in BRASS else 'energy' if pixel[:3] in ENERGY else 'armor'
                layers[key].putpixel((x, y), pixel)
    tree = ET.Element('image', {'w': str(image.width), 'h': str(image.height),
                              'name': path.stem, 'version': '0.0.3'})
    stack = ET.SubElement(tree, 'stack')
    with zipfile.ZipFile(path, 'w') as archive:
        archive_entry(archive, 'mimetype', b'image/openraster', stored=True)
        for name in reversed(layers):
            source = 'data/' + name + '.png'
            ET.SubElement(stack, 'layer', {'name': name, 'src': source, 'x': '0', 'y': '0',
                                         'opacity': '1.0', 'visibility': 'visible',
                                         'composite-op': 'svg:src-over'})
            archive_entry(archive, source, png_bytes(layers[name]))
        archive_entry(archive, 'stack.xml', ET.tostring(tree, encoding='utf-8', xml_declaration=True))
        archive_entry(archive, 'mergedimage.png', png_bytes(image))


def contact(rows):
    sheet = Image.new('RGB', (960, 480), '#17172b')
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 13)
    except OSError:
        font = ImageFont.load_default()
    for index, row in enumerate(rows):
        left = index * 240
        draw.rectangle((left + 6, 6, left + 234, 474), outline='#57516d', fill='#26243b')
        draw.text((left + 15, 20), row['id'], fill='#f4c57a', font=font)
        image = Image.open(HERE / 'native' / (row['id'] + '@1x.png')).convert('RGBA')
        large = image.resize((image.width * 4, image.height * 4), Image.Resampling.NEAREST)
        sheet.paste(large, (left + (240 - large.width) // 2, 68), large)
        actual = image.resize((image.width * 2, image.height * 2), Image.Resampling.NEAREST)
        sheet.paste(actual, (left + (240 - actual.width) // 2, 290), actual)
        draw.text((left + 34, 408), str(row['nativeSize']) + ' native', fill='#c4bed2', font=font)
        draw.text((left + 72, 438), 'actual2x', fill='#73d9e8', font=font)
    sheet.save(HERE / 'contact-sheet.png')


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (HERE / 'native').mkdir(exist_ok=True)
    geometry = json.loads((HERE / 'geometry.json').read_text())
    edits = json.loads((HERE / 'native-edits.json').read_text())
    rows = []
    for asset_id, size in SIZES.items():
        original = HERE / 'originals' / (asset_id + '-generated.png')
        image, crop = (icon(), None) if asset_id == 'ionbastion' else normalize(original, size)
        for edit in edits.get(asset_id, []):
            color = RGB[edit['color']] if edit.get('color') else None
            image.putpixel(tuple(edit['point']), (*color, 255) if color else (0, 0, 0, 0))
        native = HERE / 'native' / (asset_id + '@1x.png')
        image.save(native)
        ora = HERE / 'native' / (asset_id + '.ora')
        save_ora(ora, image)
        paths = [native, ora] + ([original] if original.exists() else [])
        for scale in [2, 4]:
            path = RUNTIME / (asset_id + '@' + str(scale) + 'x.png')
            image.resize((size[0] * scale, size[1] * scale), Image.Resampling.NEAREST).save(path)
            paths.append(path)
        row = {'id': asset_id, 'kind': 'icon' if asset_id == 'ionbastion' else 'sprite',
               'nativeSize': list(size), 'center': [size[0] / 2, size[1] / 2],
               'forward': [0, -1], 'contentBBox': list(image.getbbox()),
               'trueAlpha': True, 'binaryAlpha': True,
               'frames': [{'x': 0, 'y': 0, 'width': size[0], 'height': size[1],
                           'anchor': [size[0] / 2, size[1] / 2]}],
               'originalCrop': crop, 'files': [record(path) for path in paths]}
        row.update(geometry[asset_id])
        rows.append(row)
    source_names = ['export.py', 'verify.py', 'README.md', 'palette.json', 'prompts.json',
                    'geometry.json', 'native-edits.json', 'originals/hive_drone-initial.png']
    manifest = {'schema': 1, 'source': 'Built-in imagegen sprites and original code-native fusion icon',
                'runtimeScale': 2, 'palette': 'palette.json', 'assets': rows,
                'sourceInputs': [record(HERE / name) for name in source_names],
                'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    contact(rows)
    print('Exported4 weapons, exact2x4x and material-layer ORA')


if __name__ == '__main__':
    main()
