"""Verify original source hashes, native pixels, geometry and exact exports."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
EXPECTED = {'hunter_drone': [28, 28], 'hive_drone': [32, 28],
            'bastion_mount': [40, 40], 'ionbastion': [24, 24]}


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    assert {entry['id'] for entry in manifest['assets']} == set(EXPECTED)
    colors = json.loads((HERE / 'palette.json').read_text())['colors']
    rgb = {tuple(bytes.fromhex(value[1:])) for value in colors.values()}
    verified_sources = 0
    for source in manifest['sourceInputs']:
        path = ROOT / source['path']
        assert path.stat().st_size == source['bytes'], path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256'], path
        verified_sources += 1
    rows = []
    for entry in manifest['assets']:
        asset_id = entry['id']
        size = EXPECTED[asset_id]
        assert entry['nativeSize'] == size
        assert entry['center'] == [size[0] / 2, size[1] / 2]
        assert entry['forward'] == [0, -1]
        assert entry['frames'] == [{'x': 0, 'y': 0, 'width': size[0], 'height': size[1],
                                    'anchor': [size[0] / 2, size[1] / 2]}]
        for file in entry['files']:
            path = ROOT / file['path']
            assert path.stat().st_size == file['bytes'], path
            assert hashlib.sha256(path.read_bytes()).hexdigest() == file['sha256'], path
        native = Image.open(HERE / 'native' / (asset_id + '@1x.png')).convert('RGBA')
        assert list(native.size) == size
        pixels = list(native.getdata())
        assert {pixel[3] for pixel in pixels} == {0, 255}
        assert {pixel[:3] for pixel in pixels if pixel[3]} <= rgb
        box = native.getbbox()
        assert list(box) == entry['contentBBox']
        assert box[0] > 0 and box[1] > 0 and box[2] < size[0] and box[3] < size[1]
        for x, y in entry.get('muzzleAnchors', []):
            assert native.getpixel((int(x), int(y)))[3], (asset_id, 'muzzle', x, y)
        for x, y in entry.get('nozzleCenters', []):
            assert native.getpixel((int(x), int(y)))[3], (asset_id, 'nozzle', x, y)
        for x, y in entry.get('exhaustAnchors', []):
            assert 0 <= x < size[0] and 0 <= y < size[1]
            assert not native.getpixel((int(x), int(y)))[3], (asset_id, 'exhaust', x, y)
        if asset_id == 'bastion_mount':
            assert entry['clearanceRect'] == [11, 6, 29, 28]
            assert not native.crop(tuple(entry['clearanceRect'])).getbbox()
            assert not native.getpixel((20, 20))[3]
            # Distinct five-pixel armored rails and at least six-pixel side bases.
            assert sum(native.getpixel((x, 10))[3] > 0 for x in range(3, 11)) >= 5
            assert sum(native.getpixel((x, 10))[3] > 0 for x in range(29, 37)) >= 5
            assert sum(native.getpixel((x, 23))[3] > 0 for x in range(1, 11)) >= 6
            assert sum(native.getpixel((x, 23))[3] > 0 for x in range(29, 39)) >= 6
        byte_count = 0
        for scale in [2, 4]:
            file = next(file for file in entry['files'] if file['path'].endswith('@' + str(scale) + 'x.png'))
            actual = Image.open(ROOT / file['path']).convert('RGBA')
            expected = native.resize((size[0] * scale, size[1] * scale), Image.Resampling.NEAREST)
            assert actual.size == expected.size and actual.tobytes() == expected.tobytes()
            if scale == 2:
                byte_count = file['bytes']
        with zipfile.ZipFile(HERE / 'native' / (asset_id + '.ora')) as archive:
            assert archive.read('mimetype') == b'image/openraster'
            stack = ET.fromstring(archive.read('stack.xml'))
            layers = stack.findall('./stack/layer')
            assert {layer.attrib['name'] for layer in layers} == {'armor', 'brass', 'energy'}
            composite = Image.new('RGBA', native.size)
            for layer in reversed(layers):
                image = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
                composite = Image.alpha_composite(composite, image)
            merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
            assert composite.tobytes() == merged.tobytes() == native.tobytes()
        if asset_id != 'ionbastion':
            original = Image.open(HERE / 'originals' / (asset_id + '-generated.png'))
            assert original.mode == 'RGBA' and original.getchannel('A').getextrema() == (0, 255)
        rows.append({'id': asset_id, 'nativeSize': size, 'contentBBox': entry['contentBBox'],
                     'binaryAlpha': True, 'paletteMatched': True, 'integerExportsExact': True,
                     'editableLayersMatch': True, 'geometryChecked': True, 'runtimeBytes': byte_count})
    report = {'scope': 'Static production assets and exports. Runtime visual and phone checks are separate.',
              'passed': len(rows), 'rows': rows, 'verifiedSourceInputs': verified_sources,
              'runtimeBytes': sum(row['runtimeBytes'] for row in rows),
              'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('PASS4 weapon assets,4 material-layer ORA,exact2x4x,binary alpha,clearance and anchors')


if __name__ == '__main__':
    main()
