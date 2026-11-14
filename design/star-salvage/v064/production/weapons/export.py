"""Export the independent refraction crystal as native pixels and editable ORA."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/v064/weapons'
PALETTE = json.loads((HERE / 'palette.json').read_text())['colors']
RGB = {name: tuple(bytes.fromhex(color[1:])) for name, color in PALETTE.items()}
SIZE = (16, 24)


def png_bytes(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return stream.getvalue()


def record(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def write_archive(archive, name, data, stored=False):
    entry = zipfile.ZipInfo(name, (2026, 11, 12, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    archive.writestr(entry, data)


def normalize(original):
    image = Image.open(original).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda alpha: 255 if alpha >= 200 else 0))
    crop = image.getbbox()
    if not crop:
        raise ValueError('Generated crystal has no solid body')
    image = image.crop(crop)
    scale = min((SIZE[0] - 2) / image.width, (SIZE[1] - 2) / image.height)
    width, height = round(image.width * scale), round(image.height * scale)
    reduced = image.resize((width, height), Image.Resampling.BOX)
    native = Image.new('RGBA', SIZE)
    left, top = (SIZE[0] - width) // 2, (SIZE[1] - height) // 2
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = reduced.getpixel((x, y))
            if alpha < 110:
                continue
            color = min(RGB.values(), key=lambda candidate:
                        (candidate[0] - red) ** 2 +
                        (candidate[1] - green) ** 2 +
                        (candidate[2] - blue) ** 2)
            native.putpixel((left + x, top + y), (*color, 255))
    for edit in json.loads((HERE / 'native-edits.json').read_text())['pixels']:
        color = tuple(bytes.fromhex(edit['color'][1:]))
        assert color in RGB.values() and native.getpixel((edit['x'], edit['y']))[3]
        native.putpixel((edit['x'], edit['y']), (*color, 255))
    return native, list(crop)


def save_openraster(path, image):
    layers = {name: Image.new('RGBA', SIZE) for name in ['facets', 'core', 'edge']}
    core = {RGB[name] for name in ['white', 'ivory', 'iceLight']}
    edge = {RGB[name] for name in ['gold', 'warm', 'cream']}
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if not pixel[3]:
                continue
            if pixel[:3] in core:
                material = 'core'
            elif pixel[:3] in edge:
                material = 'edge'
            else:
                material = 'facets'
            layers[material].putpixel((x, y), pixel)
    tree = ET.Element('image', {'w': str(SIZE[0]), 'h': str(SIZE[1]),
                              'name': 'prism_crystal', 'version': '0.0.3'})
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


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (HERE / 'native').mkdir(exist_ok=True)
    original = HERE / 'originals/prism_crystal-generated.png'
    image, crop = normalize(original)
    native = HERE / 'native/prism_crystal@1x.png'
    image.save(native)
    ora = HERE / 'native/prism_crystal.ora'
    save_openraster(ora, image)
    files = [native, ora, original]
    for scale in [2, 4]:
        path = RUNTIME / f'prism_crystal@{scale}x.png'
        image.resize((SIZE[0] * scale, SIZE[1] * scale), Image.Resampling.NEAREST).save(path)
        files.append(path)
    entry = {'id': 'prism_crystal', 'kind': 'effect', 'nativeSize': list(SIZE),
             'center': [8, 12], 'forward': [0, -1], 'contentBBox': list(image.getbbox()),
             'frames': [{'x': 0, 'y': 0, 'width': 16, 'height': 24, 'anchor': [8, 12]}],
             'originalCrop': crop, 'files': [record(path) for path in files]}
    inputs = ['export.py', 'verify.py', 'README.md', 'palette.json', 'prompts.json', 'native-edits.json']
    manifest = {'source': 'Built-in imagegen, existing weapon palette and native grid export',
                'runtimeScale': 2, 'palette': 'palette.json', 'assets': [entry],
                'sourceInputs': [record(HERE / name) for name in inputs],
                'styleReference': 'prototypes/salvage-survivor-demo/assets/v061/refraction@2x.png',
                'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    sheet = Image.new('RGB', (360, 160), '#17172b')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 10), 'PRISM CRYSTAL  16x24 NATIVE', fill='#f4c57a')
    for scale, x in [(2, 35), (4, 160)]:
        shown = image.resize((SIZE[0] * scale, SIZE[1] * scale), Image.Resampling.NEAREST)
        sheet.paste(shown, (x, 40), shown)
        draw.text((x, 140), f'{scale}x', fill='#73d9e8')
    sheet.save(HERE / 'contact-sheet.png')
    print('Exported independent prism crystal 16x24, editable ORA and 2x/4x')


if __name__ == '__main__':
    main()
