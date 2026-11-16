"""Validate the three boss bodies, their editable layers and runtime exports."""
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
EXPECTED = {'boss_weaver': 64, 'boss_ark': 64, 'boss_judicator': 64}


def inside_canvas(point, size):
    return all(math.isfinite(value) and 0 <= value < size for value in point)


def solid_near(image, point, radius):
    x, y = map(round, point)
    return any(image.getpixel((px, py))[3] == 255
               for py in range(max(0, y - radius), min(image.height, y + radius + 1))
               for px in range(max(0, x - radius), min(image.width, x + radius + 1)))


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    palette = {tuple(bytes.fromhex(value[1:]))
               for value in json.loads((HERE / 'palette.json').read_text())['colors']}
    assert {row['id']: row['nativeSize'][0] for row in manifest['assets']} == EXPECTED
    records = manifest['sourceInputs'] + [file for row in manifest['assets'] for file in row['files']]
    for row in records:
        path = ROOT / row['path']
        assert path.stat().st_size == row['bytes'], path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256'], path
    results = []
    runtime_bytes = 0
    for row in manifest['assets']:
        actor_id, size = row['id'], row['nativeSize'][0]
        native = Image.open(HERE / 'native' / f'{actor_id}@1x.png').convert('RGBA')
        assert native.size == (size, size)
        original = Image.open(HERE / 'originals' / f'{actor_id}-generated.png')
        assert original.mode == 'RGBA'
        minimum_alpha, maximum_alpha = original.getchannel('A').getextrema()
        assert minimum_alpha == 0 and maximum_alpha >= 200
        pixels = list(native.getdata())
        assert {pixel[3] for pixel in pixels} == {0, 255}
        assert {pixel[:3] for pixel in pixels if pixel[3]} <= palette
        bbox = native.getbbox()
        assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < size and bbox[3] < size
        assert list(bbox) == row['contentBBox']
        assert row['forward'] == [0, -1] and row['exhaustDirection'] == [0, 1]
        assert inside_canvas(row['center'], size) and inside_canvas(row['collisionCenter'], size)
        assert 0 < row['collisionRadius'] < size / 2
        assert native.getpixel(tuple(map(int, row['collisionCenter'])))[3] == 255
        assert len(row['nozzleCenters']) == len(row['exhaustAnchors']) == 2
        for nozzle, anchor in zip(row['nozzleCenters'], row['exhaustAnchors']):
            assert inside_canvas(nozzle, size) and inside_canvas(anchor, size)
            assert nozzle[0] == anchor[0] and nozzle[1] < anchor[1]
            assert solid_near(native, nozzle, 1) and solid_near(native, anchor, 3)
        for scale in [2, 4]:
            file = next(file for file in row['files'] if file['path'].endswith(f'@{scale}x.png'))
            actual = Image.open(ROOT / file['path']).convert('RGBA')
            expected = native.resize((size * scale, size * scale), Image.Resampling.NEAREST)
            assert actual.size == expected.size and actual.tobytes() == expected.tobytes()
            if scale == 2:
                runtime_bytes += file['bytes']
        with zipfile.ZipFile(HERE / 'native' / f'{actor_id}.ora') as archive:
            assert archive.read('mimetype') == b'image/openraster'
            root = ET.fromstring(archive.read('stack.xml'))
            layers = root.findall('./stack/layer')
            assert {layer.attrib['name'] for layer in layers} == {'armor', 'gold', 'energy'}
            composite = Image.new('RGBA', native.size)
            for layer in reversed(layers):
                image = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
                assert image.size == native.size
                composite = Image.alpha_composite(composite, image)
            merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
            assert composite.tobytes() == merged.tobytes() == native.tobytes()
        circle_metrics = []
        for circle in row['collisionCircles']:
            assert 0 < circle['r'] < 16
            assert inside_canvas([circle['x'], circle['y']], size)
            assert solid_near(native, [circle['x'], circle['y']], 1)
            total = 0
            solid = 0
            for y in range(size):
                for x in range(size):
                    if math.hypot(x - circle['x'], y - circle['y']) <= circle['r']:
                        total += 1
                        solid += native.getpixel((x, y))[3] == 255
            fraction = solid / total
            assert fraction >= 0.55, (actor_id, circle['part'], fraction)
            circle_metrics.append({'part': circle['part'], 'solidFraction': round(fraction, 4)})
        for point in row['shotNozzles']:
            assert inside_canvas(point, size) and solid_near(native, point, 3)
        for point in row.get('launcherAnchors', []):
            assert inside_canvas(point, size) and solid_near(native, point, 1)
        for point in row['openSpaceSamples']:
            assert native.getpixel(tuple(point))[3] == 0
            assert all(math.hypot(point[0] - circle['x'], point[1] - circle['y']) > circle['r']
                       for circle in row['collisionCircles'])
        results.append({
            'id': actor_id, 'native': list(native.size), 'contentBBox': list(bbox),
            'binaryAlpha': True, 'paletteMatched': True, 'integerExportsExact': True,
            'editableLayersMatch': True, 'centerAndNozzlesValid': True,
            'collisionRadiusWorld': row['collisionRadius'] * 2,
            'suggestedHullCircles': circle_metrics,
            'openSpaceSamplesPreserved': row['openSpaceSamples'],
            'originalIsActualRgba': True,
        })
    ark = next(row for row in results if row['id'] == 'boss_ark')
    x0, y0, x1, y1 = ark['contentBBox']
    assert (x1 - x0) / (y1 - y0) > 1.3, 'Ark should have a broad short cargo body'
    report = {
        'scope': 'Static native PNG, integer exports, ORA materials, palette, provenance hashes and registered geometry. Runtime and phone are separate checks.',
        'passed': len(results), 'runtimeBytes': runtime_bytes, 'assets': results,
        'userVisualApproval': 'PENDING', 'physicalPhoneTested': False,
    }
    (HERE / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'PASS three boss bodies, three editable ORA, six exact exports, runtime {runtime_bytes} bytes')


if __name__ == '__main__':
    main()
