"""Verify native pixels, editable layers, original provenance and integer exports."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
EXPECTED = {'lancer': 28, 'sentinel': 32, 'minelayer': 32, 'courier': 32, 'watcher': 40}


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    palette = {tuple(bytes.fromhex(value[1:])) for value in json.loads((HERE / 'palette.json').read_text())['colors']}
    assert {row['id']: row['nativeSize'][0] for row in manifest['assets']} == EXPECTED
    all_records = manifest['sourceInputs'] + [file for row in manifest['assets'] for file in row['files']]
    for row in all_records:
        path = ROOT / row['path']
        assert path.stat().st_size == row['bytes'], path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256'], path
    results = []
    runtime_bytes = 0
    for row in manifest['assets']:
        actor_id, size = row['id'], row['nativeSize'][0]
        native = Image.open(HERE / 'native' / f'{actor_id}@1x.png').convert('RGBA')
        assert native.size == (size, size)
        pixels = list(native.getdata())
        assert {pixel[3] for pixel in pixels} == {0, 255}
        assert {pixel[:3] for pixel in pixels if pixel[3]} <= palette
        bbox = native.getbbox()
        assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < size and bbox[3] < size
        assert list(bbox) == row['contentBBox']
        assert native.getpixel(tuple(map(int, row['center'])))[3] == 255
        for scale in [2, 4]:
            file = next(file for file in row['files'] if file['path'].endswith(f'@{scale}x.png'))
            image = Image.open(ROOT / file['path']).convert('RGBA')
            expected = native.resize((size * scale, size * scale), Image.Resampling.NEAREST)
            assert image.size == expected.size and image.tobytes() == expected.tobytes()
            if scale == 2:
                runtime_bytes += file['bytes']
        with zipfile.ZipFile(HERE / 'native' / f'{actor_id}.ora') as archive:
            assert archive.read('mimetype') == b'image/openraster'
            root = ET.fromstring(archive.read('stack.xml'))
            layers = root.findall('./stack/layer')
            assert len(layers) == 3
            composite = Image.new('RGBA', native.size)
            for layer in reversed(layers):
                image = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
                composite = Image.alpha_composite(composite, image)
            merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
            assert composite.tobytes() == merged.tobytes() == native.tobytes()
        for x, y in row['exhaustAnchors']:
            assert 0 <= x < size and 0 <= y < size
            assert any(native.getpixel((px, py))[3]
                       for px in range(max(0, int(x) - 2), min(size, int(x) + 3))
                       for py in range(max(0, int(y) - 2), min(size, int(y) + 3)))
        results.append({'id': actor_id, 'native': native.size, 'binaryAlpha': True,
                        'paletteMatched': True, 'exportsExact': True, 'editableLayersMatch': True,
                        'bodyOnly': True, 'collisionRadiusWorld': row['collisionRadius'] * 2})
    report = {'scope': 'Static asset integrity and native export validation. Runtime integration, user visual approval and physical phone remain separate.',
              'passed': len(results), 'runtimeBytes': runtime_bytes, 'assets': results,
              'userVisualApproval': 'PENDING', 'physicalPhoneTested': False}
    (HERE / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'PASS {len(results)} native actors, 10 exact exports, 5 editable ORA, runtime {runtime_bytes} bytes')


if __name__ == '__main__':
    main()
