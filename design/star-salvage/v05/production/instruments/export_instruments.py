"""Reconstruct original generated instruments on canonical 24px footprints.

High-resolution studies and native pixel production sources are retained as
separate files. Each source is one whole instrument.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import io
import json
import zipfile
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
CONFIG = json.loads((HERE / 'assets.json').read_text())
CELL = CONFIG['cellPixels']
PALETTE = ROOT / 'design/star-salvage/v04/production/palette.json'
COLORS = [tuple(bytes.fromhex(x[1:])) for x in json.loads(PALETTE.read_text())['colors']]
OUT = ROOT / 'prototypes/salvage-route-demo/assets/v05'


def nearest(rgb):
    return min(COLORS, key=lambda c: sum((c[i] - rgb[i]) ** 2 for i in range(3)))


def png(im):
    stream = io.BytesIO()
    im.save(stream, format='PNG', optimize=True)
    return stream.getvalue()


def entry(z, name, raw, kind=zipfile.ZIP_DEFLATED):
    info = zipfile.ZipInfo(name, (2026, 11, 9, 0, 0, 0))
    info.external_attr = 0o100644 << 16
    info.compress_type = kind
    z.writestr(info, raw)


def geometry(shape):
    cells = set(map(tuple, CONFIG['shapes'][shape]))
    w = (max(x for x, y in cells) + 1) * CELL
    h = (max(y for x, y in cells) + 1) * CELL
    full = {(x, y) for y in range(h) for x in range(w) if (x // CELL, y // CELL) in cells}
    solid = {(x, y) for x, y in full if all((x + dx, y + dy) in full for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)])}
    return w, h, full, solid


def register(source, shape, w, h):
    alpha = source.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    bbox = alpha.getbbox()
    assert bbox
    return source.crop(bbox).resize((w, h), Image.Resampling.BOX), bbox, {'mode': 'whole-object bounding-box registration'}


def build(asset):
    name = asset['id']
    stem = 'cargo_' + name
    source = Image.open(HERE / (stem + '-generated.png')).convert('RGBA')
    w, h, full, solid = geometry(asset['shapeId'])
    guide, bbox, registration = register(source, asset['shapeId'], w, h)
    sample = [(x, y, guide.getpixel((x, y))[:3]) for y in range(h) for x in range(w) if guide.getpixel((x, y))[3] >= 128]
    assert sample
    native = Image.new('RGBA', (w, h))
    repaired = 0
    for x, y in solid:
        p = guide.getpixel((x, y))
        if p[3] < 128:
            sx, sy, rgb = min(sample, key=lambda s: (s[0] - x) ** 2 + (s[1] - y) ** 2)
            repaired += 1
        else:
            rgb = p[:3]
        native.putpixel((x, y), (*nearest(rgb), 255))
    for x, y in solid:
        if (x - 1, y) not in solid or (x, y - 1) not in solid:
            native.putpixel((x, y), (155, 131, 171, 255))
        elif (x + 1, y) not in solid or (x, y + 1) not in solid:
            native.putpixel((x, y), (56, 48, 77, 255))
    edits_path = HERE / (stem + '-native-edits.json')
    if not edits_path.exists():
        edits_path.write_text('[]\n')
    draw = ImageDraw.Draw(native)
    for e in json.loads(edits_path.read_text()):
        color = tuple(bytes.fromhex(e['color'][1:])) + (255,)
        if 'poly' in e:
            draw.polygon([tuple(p) for p in e['poly']], fill=color)
        elif 'rect' in e:
            draw.rectangle(e['rect'], fill=color)
        elif 'line' in e:
            draw.line([tuple(p) for p in e['line']], fill=color, width=e.get('width', 1))
        else:
            draw.point(tuple(e['xy']), fill=color)
    for y in range(h):
        for x in range(w):
            if (x, y) not in solid:
                native.putpixel((x, y), (0, 0, 0, 0))
    native.save(HERE / (stem + '@1x.png'), optimize=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for scale in [2, 4]:
        native.resize((w * scale, h * scale), Image.Resampling.NEAREST).save(OUT / (stem + '@' + str(scale) + 'x.png'), optimize=True)
    groups = {'gold mechanism and scales': {(117, 77, 80), (166, 107, 85), (206, 139, 96), (244, 199, 133), (255, 224, 166), (236, 219, 193)},
              'glass and indicators': {(53, 90, 112), (80, 132, 149), (111, 174, 173), (142, 207, 207), (183, 230, 220)}}
    layers = {k: Image.new('RGBA', native.size) for k in ['glass and indicators', 'gold mechanism and scales', 'one-piece metal body']}
    for y in range(h):
        for x in range(w):
            rgba = native.getpixel((x, y))
            if rgba[3]:
                kind = next((k for k, values in groups.items() if rgba[:3] in values), 'one-piece metal body')
                layers[kind].putpixel((x, y), rgba)
    xml = ET.Element('image', {'version': '0.0.3', 'w': str(w), 'h': str(h), 'name': stem})
    stack = ET.SubElement(xml, 'stack')
    with zipfile.ZipFile(HERE / (stem + '.ora'), 'w') as z:
        entry(z, 'mimetype', 'image/openraster', zipfile.ZIP_STORED)
        entry(z, 'mergedimage.png', png(native))
        for i, (kind, layer) in enumerate(layers.items()):
            path = 'data/layer' + str(i) + '.png'
            entry(z, path, png(layer))
            ET.SubElement(stack, 'layer', {'name': kind, 'src': path, 'opacity': '1.0', 'visibility': 'visible', 'composite-op': 'svg:src-over', 'x': '0', 'y': '0'})
        entry(z, 'stack.xml', ET.tostring(xml, encoding='utf-8'))
        entry(z, 'Thumbnails/thumbnail.png', png(native.resize((w * 2, h * 2), Image.Resampling.NEAREST)))
    coverage = [sum(native.getpixel((cx * CELL + x, cy * CELL + y))[3] > 0 for y in range(CELL) for x in range(CELL)) / (CELL * CELL) for cx, cy in CONFIG['shapes'][asset['shapeId']]]
    metadata = {'id': name, 'itemId': asset['itemId'], 'shapeId': asset['shapeId'], 'nativeSize': [w, h], 'cellPixels': CELL, 'sourceSize': source.size, 'sourceBounds': bbox, 'registration': registration,
                'nativeColors': len({p for p in native.getdata() if p[3]}), 'nativeRepairedPixels': repaired, 'nativeRepairedRatio': round(repaired / len(solid), 4), 'coverage': coverage, 'nonOccupiedAlphaPixels': 0,
                'borderRule': 'one native pixel at whole external/concave perimeter; no cell grid division seams', 'provenance': 'independent builtin imagegen study, whole-object registration, native palette and silhouette cleanup, explicit native edits'}
    (HERE / (stem + '-reconstruction.json')).write_text(json.dumps(metadata, indent=2) + '\n')
    return native


if __name__ == '__main__':
    import sys
    selected = set(sys.argv[1:])
    for asset in CONFIG['assets']:
        if not selected or asset['id'] in selected:
            image = build(asset)
            print(asset['id'], image.size)
