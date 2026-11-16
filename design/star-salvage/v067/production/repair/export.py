"""Export the two approved-source repair assets at native and integer pixel scales."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/v067/repair'
SIZES = {'repair_pod': (28, 24), 'repairpod': (24, 24)}
COLORS = json.loads((HERE / 'palette.json').read_text())['colors']
PALETTE = {name: tuple(bytes.fromhex(value[1:])) for name, value in COLORS.items()}
BRASS = {PALETTE[name] for name in ['bronze', 'gold', 'warm', 'cream', 'orange']}
ENERGY = {PALETTE[name] for name in ['mintDark', 'mint', 'mintLight', 'iceLight', 'teal']}


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


def normalize(source, size):
    image = Image.open(source).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda value: 255 if value >= 200 else 0))
    crop = image.getbbox()
    assert crop, source
    image = image.crop(crop)
    ratio = min((size[0] - 4) / image.width, (size[1] - 4) / image.height)
    width, height = round(image.width * ratio), round(image.height * ratio)
    reduced = image.resize((width, height), Image.Resampling.BOX)
    native = Image.new('RGBA', size)
    left, top = (size[0] - width) // 2, (size[1] - height) // 2
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = reduced.getpixel((x, y))
            if alpha < 110:
                continue
            color = min(PALETTE.values(), key=lambda candidate:
                        (candidate[0] - red) ** 2 + (candidate[1] - green) ** 2 +
                        (candidate[2] - blue) ** 2)
            native.putpixel((left + x, top + y), (*color, 255))
    return native, list(crop)


def save_ora(path, image):
    layers = {name: Image.new('RGBA', image.size) for name in ['armor', 'brass', 'repair-light']}
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if pixel[3]:
                material = 'brass' if pixel[:3] in BRASS else 'repair-light' if pixel[:3] in ENERGY else 'armor'
                layers[material].putpixel((x, y), pixel)
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


def contact(assets):
    sheet = Image.new('RGB', (640, 460), '#17172b')
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
    except OSError:
        font = ImageFont.load_default()
    for index, asset in enumerate(assets):
        left = index * 320
        draw.rectangle((left + 8, 8, left + 312, 452), fill='#26243b', outline='#57516d')
        draw.text((left + 24, 24), asset['id'], fill='#f4c57a', font=font)
        image = Image.open(HERE / 'native' / (asset['id'] + '@1x.png')).convert('RGBA')
        for scale, top in [(6, 76), (2, 308)]:
            preview = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
            sheet.paste(preview, (left + (320 - preview.width) // 2, top), preview)
        draw.text((left + 45, 390), str(asset['nativeSize']) + ' native', fill='#c4bed2', font=font)
        draw.text((left + 78, 420), 'actual2x above', fill='#84d7b0', font=font)
    sheet.save(HERE / 'contact-sheet.png')


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (HERE / 'native').mkdir(exist_ok=True)
    geometry = json.loads((HERE / 'geometry.json').read_text())
    edits = json.loads((HERE / 'native-edits.json').read_text())
    assets = []
    for asset_id, size in SIZES.items():
        original = HERE / 'originals' / (asset_id + '-generated.png')
        image, crop = normalize(original, size)
        for edit in edits[asset_id]:
            image.putpixel(tuple(edit['point']), (*PALETTE[edit['color']], 255))
        native = HERE / 'native' / (asset_id + '@1x.png')
        image.save(native)
        ora = HERE / 'native' / (asset_id + '.ora')
        save_ora(ora, image)
        paths = [native, ora, original]
        for scale in [2, 4]:
            path = RUNTIME / (asset_id + '@' + str(scale) + 'x.png')
            image.resize((size[0] * scale, size[1] * scale), Image.Resampling.NEAREST).save(path)
            paths.append(path)
        asset = {'id': asset_id, 'kind': 'icon' if asset_id == 'repairpod' else 'sprite',
                 'nativeSize': list(size), 'center': [size[0] / 2, size[1] / 2],
                 'forward': [0, -1], 'contentBBox': list(image.getbbox()),
                 'trueAlpha': True, 'binaryAlpha': True,
                 'frames': [{'x': 0, 'y': 0, 'width': size[0], 'height': size[1],
                             'anchor': [size[0] / 2, size[1] / 2]}],
                 'originalCrop': crop, 'files': [record(path) for path in paths]}
        asset.update(geometry[asset_id])
        assets.append(asset)
    manifest = {'schema': 1, 'source': 'Built-in image_gen originals, palette-matched native pixel exports',
                'runtimeScale': 2, 'palette': 'palette.json', 'assets': assets,
                'sourceInputs': [record(HERE / name) for name in
                                 ['export.py', 'verify.py', 'README.md', 'palette.json', 'prompts.json', 'geometry.json', 'native-edits.json']],
                'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    contact(assets)
    print('Exported2 repair assets, exact2x4x and three-material editable ORA')


if __name__ == '__main__':
    main()
