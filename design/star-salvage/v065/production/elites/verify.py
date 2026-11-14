"""Verify native elite pixels, layer reconstruction and exact integer exports."""
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


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    palette = {
        tuple(bytes.fromhex(color[1:]))
        for color in json.loads((HERE / 'palette.json').read_text())['colors']
    }
    rows = []
    assert len(manifest['assets']) == 2
    for row in manifest['sourceInputs']:
        source = ROOT / row['path']
        assert source.stat().st_size == row['bytes']
        assert digest(source) == row['sha256'], source
    for asset in manifest['assets']:
        name = asset['id']
        native = Image.open(HERE / 'native' / f'{name}@1x.png').convert('RGBA')
        width, height = asset['nativeSize']
        assert native.size == (width, height)
        assert set(native.getchannel('A').getdata()) == {0, 255}
        assert all(pixel[:3] in palette for pixel in native.getdata() if pixel[3])
        box = native.getbbox()
        assert box == tuple(asset['contentBBox'])
        assert 0 < box[0] < box[2] < width
        assert 0 < box[1] < box[3] < height
        assert asset['forward'] == [0, -1]
        assert asset['exhaustDirection'] == [0, 1]
        assert asset['center'] == [width / 2, height / 2]
        assert 0 < asset['collisionRadius'] < min(width, height) / 2
        for center, anchor in zip(asset['nozzleCenters'], asset['exhaustAnchors']):
            x, y = map(math.floor, center)
            assert native.getpixel((x, y)) == (115, 217, 232, 255)
            assert anchor[0] == center[0] and anchor[1] > center[1]
            assert native.getpixel(tuple(map(math.floor, anchor)))[3] == 0
        for x, y in asset['weaponAnchors']:
            assert native.getpixel((math.floor(x), math.floor(y)))[3] == 255
        if name == 'elite_reaver':
            for x in (5, 34):
                assert native.getpixel((x, 8))[:3] == (115, 217, 232)
                assert native.getpixel((x, 9))[:3] == (186, 248, 245)
                assert native.getpixel((x, 10))[:3] == (115, 217, 232)
        else:
            for x, y in asset['launchAnchors']:
                assert native.getpixel((math.floor(x), math.floor(y))) == (23, 23, 43, 255)
            for x, y in [(7, 14), (38, 14), (7, 22), (38, 22)]:
                assert native.getpixel((x, y)) == (115, 217, 232, 255)
            assert native.getpixel((20, 12))[3] == 0
            assert native.getpixel((28, 22))[3] == 0
        with zipfile.ZipFile(HERE / 'native' / f'{name}.ora') as archive:
            assert archive.read('mimetype') == b'image/openraster'
            xml = ET.fromstring(archive.read('stack.xml'))
            layers = xml.findall('./stack/layer')
            assert len(layers) == 3
            composed = Image.new('RGBA', native.size)
            for layer in reversed(layers):
                raster = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
                composed = Image.alpha_composite(composed, raster)
            assert composed.tobytes() == native.tobytes()
            merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
            assert merged.tobytes() == native.tobytes()
        for row in asset['files']:
            file = ROOT / row['path']
            assert file.stat().st_size == row['bytes']
            assert digest(file) == row['sha256'], file
            for scale in (2, 4):
                if file.name.endswith(f'@{scale}x.png'):
                    raster = Image.open(file).convert('RGBA')
                    expected = native.resize((width * scale, height * scale), Image.Resampling.NEAREST)
                    assert raster.tobytes() == expected.tobytes()
        rows.append({'id': name, 'native': list(native.size),
                     'center': asset['center'], 'collisionRadius': asset['collisionRadius'],
                     'runtimeBytes': next(row['bytes'] for row in asset['files']
                                          if row['path'].endswith('@2x.png'))})
    report = {'schema': 1, 'assets': rows, 'nativeAssets': 2,
              'editableORA': 2, 'exactExports': 4,
              'binaryAlpha': True, 'palette': 'PASS',
              'nozzlesAndEmissionAnchors': 'PASS',
              'fourHivePortsRetainDarkInterior': True,
              'userVisual': 'PENDING', 'phone': 'NOT_TESTED'}
    (HERE / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS two v065 elites, two material-layer ORA, four exact exports, true alpha and registered physical ports')


if __name__ == '__main__':
    main()
