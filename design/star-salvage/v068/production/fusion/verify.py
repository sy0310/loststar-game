"""Verify hashes, physical layers, native geometry, holes and exact integer exports."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import math
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
EXPECTED = {'eventhorizon_core': [64, 64], 'eventhorizon_ring': [64, 64],
            'thunder_relay': [40, 40], 'blastwheel_hub': [48, 48]}
LAYERS = {'eventhorizon_core': {'rim', 'accretion'}, 'eventhorizon_ring': {'mechanical_ring'},
          'thunder_relay': {'capacitor', 'conductor_ring', 'electrodes'},
          'blastwheel_hub': {'housing', 'reactor'}}


def verify_record(row):
    path = ROOT / row['path']
    raw = path.read_bytes()
    assert len(raw) == row['bytes'], path
    assert hashlib.sha256(raw).hexdigest() == row['sha256'], path


def assert_transparent_circle(image, circle):
    center_x, center_y = circle['center']
    for y in range(image.height):
        for x in range(image.width):
            radius = math.hypot(x + 0.5 - center_x, y + 0.5 - center_y)
            if radius <= circle['radius']:
                assert image.getpixel((x, y))[3] == 0, ('hole', x, y, radius)


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    assert {entry['id'] for entry in manifest['assets']} == set(EXPECTED)
    palette = json.loads((HERE / 'palette.json').read_text())['colors']
    colors = {tuple(bytes.fromhex(value[1:])) for value in palette.values()}
    for record in manifest['sourceInputs'] + manifest['reviewImages']:
        verify_record(record)
    rows, images = [], {}
    for entry in manifest['assets']:
        asset_id = entry['id']
        size = EXPECTED[asset_id]
        assert entry['nativeSize'] == size
        assert entry['center'] == [size[0] / 2, size[1] / 2] == entry['rotationPivot']
        assert entry['forward'] == [0, -1]
        assert entry['frames'] == [{'x': 0, 'y': 0, 'width': size[0], 'height': size[1],
                                    'anchor': [size[0] / 2, size[1] / 2]}]
        for record in entry['files']:
            verify_record(record)
        image = Image.open(HERE / 'native' / (asset_id + '@1x.png')).convert('RGBA')
        images[asset_id] = image
        assert list(image.size) == size
        assert {pixel[3] for pixel in image.getdata()} == {0, 255}
        assert {pixel[:3] for pixel in image.getdata() if pixel[3]} <= colors
        box = image.getbbox()
        assert list(box) == entry['contentBBox']
        assert box[0] > 0 and box[1] > 0 and box[2] < size[0] and box[3] < size[1]
        if 'transparentCircle' in entry:
            assert_transparent_circle(image, entry['transparentCircle'])
        if 'clearanceRect' in entry:
            assert image.crop(tuple(entry['clearanceRect'])).getbbox() is None
        for key in ['segmentAnchors', 'conductionAnchors', 'socketAnchors']:
            for x, y in entry.get(key, []):
                assert image.getpixel((int(x), int(y)))[3], (asset_id, key, x, y)
        if asset_id == 'thunder_relay':
            for pair in entry['contactPairs']:
                for x, y in pair:
                    pixel = image.getpixel((int(x), int(y)))
                    assert pixel[3] and pixel[:3] in [colors_value(palette['white']), colors_value(palette['cream'])]
        for scale in [2, 4]:
            path = ROOT / 'prototypes/salvage-survivor-demo/assets/v068/fusion' / (asset_id + '@' + str(scale) + 'x.png')
            actual = Image.open(path).convert('RGBA')
            expected = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
            assert actual.size == expected.size and actual.tobytes() == expected.tobytes()
        layers_from_files = Image.new('RGBA', image.size)
        assert {layer['name'] for layer in entry['physicalLayers']} == LAYERS[asset_id]
        for layer in entry['physicalLayers']:
            native_layer = Image.open(ROOT / layer['path']).convert('RGBA')
            assert native_layer.size == image.size
            assert list(native_layer.getbbox()) == layer['contentBBox']
            layers_from_files = Image.alpha_composite(layers_from_files, native_layer)
        assert layers_from_files.tobytes() == image.tobytes()
        with zipfile.ZipFile(HERE / 'native' / (asset_id + '.ora')) as archive:
            assert archive.read('mimetype') == b'image/openraster'
            root = ET.fromstring(archive.read('stack.xml'))
            ora_layers = root.findall('./stack/layer')
            assert {layer.attrib['name'] for layer in ora_layers} == LAYERS[asset_id]
            composite = Image.new('RGBA', image.size)
            for layer in reversed(ora_layers):
                part = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
                assert part.size == image.size
                composite = Image.alpha_composite(composite, part)
            merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
            assert composite.tobytes() == merged.tobytes() == image.tobytes()
        runtime = next(record for record in entry['files'] if record['path'].endswith('@2x.png'))
        rows.append({'id': asset_id, 'nativeSize': size, 'contentBBox': list(box),
                     'binaryAlpha': True, 'paletteMatched': True, 'integerExportsExact': True,
                     'physicalLayersMatch': True, 'geometryChecked': True, 'runtimeBytes': runtime['bytes']})
    core, ring = images['eventhorizon_core'], images['eventhorizon_ring']
    assert all(not (left[3] and right[3]) for left, right in zip(core.getdata(), ring.getdata()))
    combined = Image.alpha_composite(ring, core)
    reference = Image.open(HERE / 'eventhorizon-composition@1x.png').convert('RGBA')
    assert combined.tobytes() == reference.tobytes()
    assert core.getpixel((32, 32))[3] == ring.getpixel((32, 32))[3] == 0
    for asset_id in ['eventhorizon_core', 'thunder_relay', 'blastwheel_hub']:
        original = Image.open(HERE / 'originals' / (asset_id + '-generated.png'))
        assert original.mode == 'RGBA' and original.getchannel('A').getextrema() == (0, 255)
    report = {'scope': 'Static native assets, physical layers, transparent holes and exact integer exports.',
              'passed': len(rows), 'rows': rows, 'verifiedSourceInputs': len(manifest['sourceInputs']),
              'separateEventhorizonLayers': True,
              'runtimeBytes': sum(row['runtimeBytes'] for row in rows),
              'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('PASS four fusion assets, physical-layer ORA, native palette, binary holes, anchors and exact2x4x')


def colors_value(value):
    return tuple(bytes.fromhex(value[1:]))


if __name__ == '__main__':
    main()
