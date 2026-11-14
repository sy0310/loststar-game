"""Validate the standalone crystal without treating it as an enemy actor."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    assert len(manifest['assets']) == 1
    row = manifest['assets'][0]
    assert row['id'] == 'prism_crystal' and row['kind'] == 'effect'
    assert row['nativeSize'] == [16, 24] and row['center'] == [8, 12]
    assert row['frames'] == [{'x': 0, 'y': 0, 'width': 16, 'height': 24, 'anchor': [8, 12]}]
    for item in manifest['sourceInputs'] + row['files']:
        path = ROOT / item['path']
        assert path.stat().st_size == item['bytes'], path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], path
    palette = {tuple(bytes.fromhex(value[1:]))
               for value in json.loads((HERE / 'palette.json').read_text())['colors'].values()}
    image = Image.open(HERE / 'native/prism_crystal@1x.png').convert('RGBA')
    assert image.size == (16, 24)
    pixels = list(image.getdata())
    assert {pixel[3] for pixel in pixels} == {0, 255}
    assert {pixel[:3] for pixel in pixels if pixel[3]} <= palette
    bbox = image.getbbox()
    assert bbox[0] > 0 and bbox[1] > 0 and bbox[2] < 16 and bbox[3] < 24
    assert image.getpixel((8, 12))[3] == 255
    runtime_bytes = 0
    for scale in [2, 4]:
        file = next(file for file in row['files'] if file['path'].endswith(f'@{scale}x.png'))
        actual = Image.open(ROOT / file['path']).convert('RGBA')
        expected = image.resize((16 * scale, 24 * scale), Image.Resampling.NEAREST)
        assert actual.size == expected.size and actual.tobytes() == expected.tobytes()
        if scale == 2:
            runtime_bytes = file['bytes']
    with zipfile.ZipFile(HERE / 'native/prism_crystal.ora') as archive:
        assert archive.read('mimetype') == b'image/openraster'
        root = ET.fromstring(archive.read('stack.xml'))
        layers = root.findall('./stack/layer')
        assert {layer.attrib['name'] for layer in layers} == {'facets', 'core', 'edge'}
        composite = Image.new('RGBA', image.size)
        for layer in reversed(layers):
            pixels = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
            composite = Image.alpha_composite(composite, pixels)
        merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
        assert image.tobytes() == composite.tobytes() == merged.tobytes()
    report = {'scope': 'Static crystal asset and exports. Runtime visual and phone approval remain separate.',
              'passed': 1, 'id': row['id'], 'kind': row['kind'], 'nativeSize': row['nativeSize'],
              'binaryAlpha': True, 'paletteMatched': True, 'integerExportsExact': True,
              'editableLayersMatch': True, 'runtimeBytes': runtime_bytes,
              'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'PASS independent prism crystal, editable ORA, exact 2x/4x, runtime {runtime_bytes} bytes')


if __name__ == '__main__':
    main()
