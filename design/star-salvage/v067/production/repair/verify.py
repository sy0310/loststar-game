"""Verify repair originals, native colors, integer exports and editable layer composition."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
EXPECTED = {'repair_pod': [28, 24], 'repairpod': [24, 24]}


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    assert {asset['id'] for asset in manifest['assets']} == set(EXPECTED)
    colors = json.loads((HERE / 'palette.json').read_text())['colors']
    palette = {tuple(bytes.fromhex(value[1:])) for value in colors.values()}
    mint = {tuple(bytes.fromhex(colors[name][1:])) for name in ['mintDark', 'mint', 'mintLight']}
    for source in manifest['sourceInputs']:
        path = ROOT / source['path']
        assert path.stat().st_size == source['bytes']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
    rows = []
    for asset in manifest['assets']:
        asset_id = asset['id']
        size = EXPECTED[asset_id]
        assert asset['nativeSize'] == size
        assert asset['center'] == [size[0] / 2, size[1] / 2]
        assert asset['forward'] == [0, -1]
        for item in asset['files']:
            path = ROOT / item['path']
            assert path.stat().st_size == item['bytes']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
        native = Image.open(HERE / 'native' / (asset_id + '@1x.png')).convert('RGBA')
        assert list(native.size) == size
        pixels = list(native.getdata())
        assert {pixel[3] for pixel in pixels} == {0, 255}
        assert {pixel[:3] for pixel in pixels if pixel[3]} <= palette
        assert sum(pixel[:3] in mint and pixel[3] == 255 for pixel in pixels) >= 10
        box = native.getbbox()
        assert list(box) == asset['contentBBox']
        assert box[0] > 0 and box[1] > 0 and box[2] < size[0] and box[3] < size[1]
        if asset_id == 'repair_pod':
            for x, y in asset['launchAnchors'] + [asset['originAnchor'], asset['attachmentAnchor']]:
                assert native.getpixel((int(x), int(y)))[3] == 255
            for y in range(10, 16):
                for x in range(11, 17):
                    assert (native.getpixel((x, y))[:3] in mint) == (x in [13, 14] or y in [12, 13])
        original = Image.open(HERE / 'originals' / (asset_id + '-generated.png'))
        assert original.mode == 'RGBA' and original.getchannel('A').getextrema() == (0, 255)
        runtime_bytes = 0
        for scale in [2, 4]:
            item = next(item for item in asset['files'] if item['path'].endswith('@' + str(scale) + 'x.png'))
            image = Image.open(ROOT / item['path']).convert('RGBA')
            expected = native.resize((size[0] * scale, size[1] * scale), Image.Resampling.NEAREST)
            assert image.size == expected.size and image.tobytes() == expected.tobytes()
            if scale == 2:
                runtime_bytes = item['bytes']
        with zipfile.ZipFile(HERE / 'native' / (asset_id + '.ora')) as archive:
            assert archive.read('mimetype') == b'image/openraster'
            tree = ET.fromstring(archive.read('stack.xml'))
            layers = tree.findall('./stack/layer')
            assert {layer.attrib['name'] for layer in layers} == {'armor', 'brass', 'repair-light'}
            composite = Image.new('RGBA', native.size)
            for layer in reversed(layers):
                image = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
                composite = Image.alpha_composite(composite, image)
            merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
            assert composite.tobytes() == merged.tobytes() == native.tobytes()
        rows.append({'id': asset_id, 'nativeSize': size, 'contentBBox': list(box),
                     'binaryAlpha': True, 'paletteMatched': True, 'integerExportsExact': True,
                     'editableLayersMatch': True, 'runtimeBytes': runtime_bytes})
    report = {'scope': 'Static asset integrity and layer composition. User and phone review pending.',
              'passed': len(rows), 'rows': rows, 'runtimeBytes': sum(row['runtimeBytes'] for row in rows),
              'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('PASS2 repair assets,2 material-layer ORA,exact2x4x,binary alpha,palette and source hashes')


if __name__ == '__main__':
    main()
