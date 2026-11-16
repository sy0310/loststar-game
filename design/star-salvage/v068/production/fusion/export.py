"""Export the four v0.6.8 fusion sprites and their physical editable layers."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import io
import json
import math
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/v068/fusion'
PALETTE = json.loads((HERE / 'palette.json').read_text())['colors']
RGB = {name: tuple(bytes.fromhex(value[1:])) for name, value in PALETTE.items()}
BRASS = {RGB[name] for name in ['bronze', 'gold', 'warm', 'cream', 'orange']}
METAL = {RGB[name] for name in ['deep', 'body', 'shade', 'metal', 'silver', 'light']}
SIZES = {'eventhorizon_core': (64, 64), 'eventhorizon_ring': (64, 64),
         'thunder_relay': (40, 40), 'blastwheel_hub': (48, 48)}


def record(path):
    raw = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest()}


def normalize(asset_id, size):
    source = Image.open(HERE / 'originals' / (asset_id + '-generated.png')).convert('RGBA')
    source.putalpha(source.getchannel('A').point(lambda alpha: 255 if alpha >= 200 else 0))
    crop = source.getbbox()
    source = source.crop(crop)
    scale = min((size[0] - 4) / source.width, (size[1] - 4) / source.height)
    width, height = round(source.width * scale), round(source.height * scale)
    reduced = source.resize((width, height), Image.Resampling.BOX)
    result = Image.new('RGBA', size)
    left, top = (size[0] - width) // 2, (size[1] - height) // 2
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = reduced.getpixel((x, y))
            if alpha < 110:
                continue
            color = min(RGB.values(), key=lambda value:
                        (value[0] - red) ** 2 + (value[1] - green) ** 2 + (value[2] - blue) ** 2)
            result.putpixel((left + x, top + y), (*color, 255))
    return result, list(crop)


def contour(image):
    """Recover a dark one-pixel silhouette on the source's metal surfaces."""
    source = image.copy()
    for y in range(1, image.height - 1):
        for x in range(1, image.width - 1):
            pixel = source.getpixel((x, y))
            if pixel[3] and pixel[:3] in METAL:
                neighbors = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
                if any(source.getpixel(point)[3] == 0 for point in neighbors):
                    image.putpixel((x, y), (*RGB['ink'], 255))


def refine_relay(image):
    """Clean the generated relay's small socket and eight physical contact tips."""
    draw = ImageDraw.Draw(image)
    draw.polygon([(17, 15), (22, 15), (24, 18), (24, 21),
                  (22, 24), (17, 24), (15, 21), (15, 18)],
                 fill=RGB['ink'])
    draw.polygon([(18, 16), (21, 16), (23, 18), (23, 21),
                  (21, 23), (18, 23), (16, 21), (16, 18)],
                 fill=RGB['shade'])
    draw.line((18, 16, 21, 16), fill=RGB['silver'])
    draw.line((16, 18, 16, 21), fill=RGB['metal'])
    draw.line((18, 23, 21, 23), fill=RGB['body'])
    draw.polygon([(18, 18), (21, 18), (22, 19), (22, 20),
                  (21, 21), (18, 21), (17, 20), (17, 19)],
                 fill=(0, 0, 0, 0))
    for point in [(19, 16), (23, 19), (20, 23), (16, 20)]:
        draw.point(point, fill=RGB['warm'])
    for left in [17, 21]:
        draw.rectangle((left, 2, left + 1, 3), fill=RGB['cream'])
        draw.point((left, 2), fill=RGB['white'])
        draw.rectangle((left, 36, left + 1, 37), fill=RGB['cream'])
        draw.point((left, 36), fill=RGB['white'])
    for top in [17, 21]:
        draw.rectangle((2, top, 3, top + 1), fill=RGB['cream'])
        draw.point((2, top), fill=RGB['white'])
        draw.rectangle((36, top, 37, top + 1), fill=RGB['cream'])
        draw.point((36, top), fill=RGB['white'])
    # Gold necks connect the white tips to their source brass housings.
    for point in [(18, 6), (21, 6), (18, 33), (21, 33),
                  (6, 18), (6, 21), (33, 18), (33, 21)]:
        draw.point(point, fill=RGB['warm'])


def refine_hub(image):
    draw = ImageDraw.Draw(image)
    draw.rectangle((23, 23, 24, 24), fill=RGB['white'])
    for point in [(23, 22), (24, 22), (22, 23), (22, 24),
                  (25, 23), (25, 24), (23, 25), (24, 25)]:
        draw.point(point, fill=RGB['cream'])


def split_eventhorizon(image):
    layers = {name: Image.new('RGBA', image.size) for name in ['rim', 'accretion', 'ring']}
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if not pixel[3]:
                continue
            radius = math.hypot(x + 0.5 - 32, y + 0.5 - 32)
            if pixel[:3] in BRASS or pixel[:3] in [RGB['white'], RGB['ivory']]:
                name = 'ring' if radius > 22.5 else 'accretion'
            else:
                name = 'rim' if radius < 13 else 'ring'
            layers[name].putpixel((x, y), pixel)
    return layers


def split_relay(image):
    layers = {name: Image.new('RGBA', image.size)
              for name in ['capacitor', 'conductor_ring', 'electrodes']}
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if not pixel[3]:
                continue
            radius = math.hypot(x + 0.5 - 20, y + 0.5 - 20)
            name = 'conductor_ring'
            if x < 9 or x > 30 or y < 9 or y > 30:
                name = 'electrodes'
            elif radius <= 6.7:
                name = 'capacitor'
            layers[name].putpixel((x, y), pixel)
    return layers


def split_hub(image):
    layers = {name: Image.new('RGBA', image.size) for name in ['housing', 'reactor']}
    mask = Image.new('1', image.size)
    ImageDraw.Draw(mask).polygon([(23, 16), (31, 20), (31, 28),
                                  (23, 32), (16, 28), (16, 20)], fill=1)
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            if pixel[3]:
                name = 'reactor' if mask.getpixel((x, y)) else 'housing'
                layers[name].putpixel((x, y), pixel)
    return layers


def composite(layers):
    result = Image.new('RGBA', next(iter(layers.values())).size)
    for image in layers.values():
        result = Image.alpha_composite(result, image)
    return result


def pixel_edits(before, after):
    changes = []
    for y in range(after.height):
        for x in range(after.width):
            previous, current = before.getpixel((x, y)), after.getpixel((x, y))
            if previous != current:
                changes.append({'point': [x, y], 'before': list(previous), 'after': list(current)})
    return changes


def png_bytes(image):
    data = io.BytesIO()
    image.save(data, 'PNG')
    return data.getvalue()


def archive_entry(archive, name, data, stored=False):
    entry = zipfile.ZipInfo(name, (2026, 11, 13, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    archive.writestr(entry, data)


def save_ora(path, layers):
    merged = composite(layers)
    tree = ET.Element('image', {'w': str(merged.width), 'h': str(merged.height),
                              'name': path.stem, 'version': '0.0.3'})
    stack = ET.SubElement(tree, 'stack')
    with zipfile.ZipFile(path, 'w') as archive:
        archive_entry(archive, 'mimetype', b'image/openraster', stored=True)
        for name, image in reversed(list(layers.items())):
            source = 'data/' + name + '.png'
            ET.SubElement(stack, 'layer', {'name': name, 'src': source, 'x': '0', 'y': '0',
                                         'opacity': '1.0', 'visibility': 'visible',
                                         'composite-op': 'svg:src-over'})
            archive_entry(archive, source, png_bytes(image))
        archive_entry(archive, 'stack.xml', ET.tostring(tree, encoding='utf-8', xml_declaration=True))
        archive_entry(archive, 'mergedimage.png', png_bytes(merged))


def font(size):
    try:
        return ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', size)
    except OSError:
        return ImageFont.load_default()


def checker(sheet, box, cell=8):
    draw = ImageDraw.Draw(sheet)
    left, top, right, bottom = box
    for y in range(top, bottom, cell):
        for x in range(left, right, cell):
            color = '#26243b' if ((x - left) // cell + (y - top) // cell) % 2 else '#302b43'
            draw.rectangle((x, y, min(x + cell - 1, right - 1), min(y + cell - 1, bottom - 1)), fill=color)


def contact(images):
    ids = list(SIZES)
    sheet = Image.new('RGB', (1200, 584), '#17172b')
    draw = ImageDraw.Draw(sheet)
    for index, asset_id in enumerate(ids):
        left = index * 300
        draw.rectangle((left + 5, 5, left + 294, 578), outline='#57516d', fill='#26243b')
        draw.text((left + 14, 18), asset_id, fill='#f4c57a', font=font(14))
        source = images[asset_id]
        checker(sheet, (left + 14, 54, left + 286, 326))
        detail = source.resize((source.width * 4, source.height * 4), Image.Resampling.NEAREST)
        sheet.paste(detail, (left + (300 - detail.width) // 2, 62 + (256 - detail.height) // 2), detail)
        draw.text((left + 16, 336), '4x pixel detail', fill='#c4bed2', font=font(12))
        actual = source.resize((source.width * 2, source.height * 2), Image.Resampling.NEAREST)
        sheet.paste(actual, (left + (300 - actual.width) // 2, 370 + (128 - actual.height) // 2), actual)
        draw.text((left + 16, 520), '2x runtime / ' + str(source.width) + 'px native', fill='#ffe5a6', font=font(12))
        draw.text((left + 16, 548), 'binary alpha / nearest', fill='#c4bed2', font=font(12))
    sheet.save(HERE / 'contact-sheet.png')
    actual_sheet = Image.new('RGB', (1000, 254), '#17172b')
    draw = ImageDraw.Draw(actual_sheet)
    for index, asset_id in enumerate(ids):
        left = index * 250
        source = images[asset_id]
        checker(actual_sheet, (left + 6, 40, left + 244, 220))
        actual = source.resize((source.width * 2, source.height * 2), Image.Resampling.NEAREST)
        actual_sheet.paste(actual, (left + (250 - actual.width) // 2, 62 + (128 - actual.height) // 2), actual)
        draw.text((left + 10, 12), asset_id, fill='#f4c57a', font=font(12))
        draw.text((left + 10, 234), 'actual 2x nearest-neighbor', fill='#c4bed2', font=font(11))
    actual_sheet.save(HERE / 'contact-sheet@2x.png')
    combined = Image.alpha_composite(images['eventhorizon_ring'], images['eventhorizon_core'])
    combined.save(HERE / 'eventhorizon-composition@1x.png')
    combined.resize((256, 256), Image.Resampling.NEAREST).save(HERE / 'eventhorizon-composition@4x.png')


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (HERE / 'native/layers').mkdir(parents=True, exist_ok=True)
    geometry = json.loads((HERE / 'geometry.json').read_text())
    event, event_crop = normalize('eventhorizon_core', (64, 64))
    relay, relay_crop = normalize('thunder_relay', (40, 40))
    hub, hub_crop = normalize('blastwheel_hub', (48, 48))
    baselines = {'eventhorizon_core': event.copy(), 'thunder_relay': relay.copy(), 'blastwheel_hub': hub.copy()}
    for image in [event, relay, hub]:
        contour(image)
    refine_relay(relay)
    refine_hub(hub)
    edits = {'method': 'Source alpha threshold200, box reduction at native grid, alpha threshold110, existing weapon palette, metal edge contrast and targeted native socket/contact refinement.',
             'generatedSourcesAreReferences': True,
             'changes': {'eventhorizon_core': pixel_edits(baselines['eventhorizon_core'], event),
                         'thunder_relay': pixel_edits(baselines['thunder_relay'], relay),
                         'blastwheel_hub': pixel_edits(baselines['blastwheel_hub'], hub)},
             'physicalLayerSeparation': {'eventhorizon_core': ['rim', 'accretion'],
                                         'eventhorizon_ring': ['mechanical_ring'],
                                         'thunder_relay': ['capacitor', 'conductor_ring', 'electrodes'],
                                         'blastwheel_hub': ['housing', 'reactor']}}
    (HERE / 'native-edits.json').write_text(json.dumps(edits, ensure_ascii=False, indent=2) + '\n')
    event_layers = split_eventhorizon(event)
    physical_layers = {'eventhorizon_core': {name: event_layers[name] for name in ['rim', 'accretion']},
                       'eventhorizon_ring': {'mechanical_ring': event_layers['ring']},
                       'thunder_relay': split_relay(relay), 'blastwheel_hub': split_hub(hub)}
    original_crops = {'eventhorizon_core': event_crop, 'eventhorizon_ring': event_crop,
                      'thunder_relay': relay_crop, 'blastwheel_hub': hub_crop}
    rows, images = [], {}
    for asset_id, layers in physical_layers.items():
        image = composite(layers)
        images[asset_id] = image
        native = HERE / 'native' / (asset_id + '@1x.png')
        image.save(native)
        ora = HERE / 'native' / (asset_id + '.ora')
        save_ora(ora, layers)
        paths, layer_rows = [native, ora], []
        for name, layer in layers.items():
            path = HERE / 'native/layers' / (asset_id + '-' + name + '@1x.png')
            layer.save(path)
            paths.append(path)
            layer_rows.append({'name': name, 'contentBBox': list(layer.getbbox()),
                               'path': path.relative_to(ROOT).as_posix()})
        for scale in [2, 4]:
            path = RUNTIME / (asset_id + '@' + str(scale) + 'x.png')
            image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST).save(path)
            paths.append(path)
        row = {'id': asset_id, 'kind': 'sprite', 'nativeSize': list(image.size),
               'center': [image.width / 2, image.height / 2], 'forward': [0, -1],
               'contentBBox': list(image.getbbox()), 'trueAlpha': True, 'binaryAlpha': True,
               'frames': [{'x': 0, 'y': 0, 'width': image.width, 'height': image.height,
                           'anchor': [image.width / 2, image.height / 2]}],
               'originalCrop': original_crops[asset_id], 'physicalLayers': layer_rows,
               'files': [record(path) for path in paths]}
        row.update(geometry[asset_id])
        rows.append(row)
    contact(images)
    source_names = ['export.py', 'verify.py', 'README.md', 'palette.json', 'prompts.json',
                    'geometry.json', 'native-edits.json', 'originals/eventhorizon_core-generated.png',
                    'originals/thunder_relay-generated.png', 'originals/blastwheel_hub-generated.png']
    manifest = {'schema': 1, 'source': 'Built-in ImageGen original transparent references, native palette cleanup and physical sprite layers',
                'runtimeScale': 2, 'palette': 'palette.json', 'assets': rows,
                'sourceInputs': [record(HERE / name) for name in source_names],
                'reviewImages': [record(HERE / name) for name in ['contact-sheet.png', 'contact-sheet@2x.png',
                                                                 'eventhorizon-composition@1x.png', 'eventhorizon-composition@4x.png']],
                'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print('Exported four native fusion sprites, physical ORA layers and exact2x4x PNGs')


if __name__ == '__main__':
    main()
