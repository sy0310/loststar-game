"""Validate instrument geometry, palette, rotations, ORA and integer exports."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
CONFIG = json.loads((HERE / 'assets.json').read_text())
CELL = CONFIG['cellPixels']
PALETTE = json.loads((ROOT / 'design/star-salvage/v04/production/palette.json').read_text())
COLORS = {tuple(bytes.fromhex(value[1:])) for value in PALETTE['colors']}
OUT = ROOT / 'prototypes/salvage-route-demo/assets/v05'
NEIGHBORS = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def rotate_cells(points):
    height = max(y for x, y in points) + 1
    return [(height - 1 - y, x) for x, y in points]


def inspect(image, points):
    width = (max(x for x, y in points) + 1) * CELL
    height = (max(y for x, y in points) + 1) * CELL
    assert image.size == (width, height)
    mask = set(points)
    occupied = {(x, y) for y in range(height) for x in range(width) if image.getpixel((x, y))[3]}
    assert set(image.getchannel('A').getdata()) == {0, 255}
    assert {pixel[:3] for pixel in image.getdata() if pixel[3]} <= COLORS
    coverage = []
    for cell_y in range(height // CELL):
        for cell_x in range(width // CELL):
            count = sum((cell_x * CELL + x, cell_y * CELL + y) in occupied for y in range(CELL) for x in range(CELL))
            if (cell_x, cell_y) in mask:
                assert count / (CELL * CELL) >= 0.7
                coverage.append(count / (CELL * CELL))
            else:
                assert count == 0
    full = {(x, y) for y in range(height) for x in range(width) if (x // CELL, y // CELL) in mask}
    solid = {(x, y) for x, y in full if all((x + dx, y + dy) in full for dx, dy in NEIGHBORS)}
    assert occupied == solid
    start = next(iter(occupied))
    seen = {start}
    queue = [start]
    while queue:
        x, y = queue.pop()
        for dx, dy in NEIGHBORS:
            point = (x + dx, y + dy)
            if point in occupied and point not in seen:
                seen.add(point)
                queue.append(point)
    assert seen == occupied
    seams = []
    for cell_x, cell_y in points:
        if (cell_x + 1, cell_y) in mask:
            count = sum(((cell_x + 1) * CELL - 1, cell_y * CELL + k) in occupied and ((cell_x + 1) * CELL, cell_y * CELL + k) in occupied for k in range(CELL))
            assert count >= CELL - 4
            seams.append(count)
        if (cell_x, cell_y + 1) in mask:
            count = sum((cell_x * CELL + k, (cell_y + 1) * CELL - 1) in occupied and (cell_x * CELL + k, (cell_y + 1) * CELL) in occupied for k in range(CELL))
            assert count >= CELL - 4
            seams.append(count)
    return {'actualMaskCells': len(mask), 'minimumCellCoverage': min(coverage), 'maximumCellCoverage': max(coverage), 'opaquePixels': len(occupied),
            'nonoccupiedAlphaPixels': 0, 'connectedComponents': 1, 'minimumConnectedSeamPixels': min(seams)}


assets = []
for asset in CONFIG['assets']:
    stem = 'cargo_' + asset['id']
    image = Image.open(HERE / (stem + '@1x.png')).convert('RGBA')
    points = list(map(tuple, CONFIG['shapes'][asset['shapeId']]))
    rotated = image
    turns = []
    for turn in range(4):
        turns.append({'clockwiseQuarterTurns': turn, **inspect(rotated, points)})
        points = rotate_cells(points)
        rotated = rotated.transpose(Image.Transpose.ROTATE_270)
    assert rotated.tobytes() == image.tobytes()
    for scale in [2, 4]:
        exported = Image.open(OUT / (stem + '@' + str(scale) + 'x.png')).convert('RGBA')
        assert exported.size == (image.width * scale, image.height * scale)
        assert exported.tobytes() == image.resize(exported.size, Image.Resampling.NEAREST).tobytes()
    with zipfile.ZipFile(HERE / (stem + '.ora')) as archive:
        assert archive.read('mimetype') == b'image/openraster'
        xml = ET.fromstring(archive.read('stack.xml'))
        assert (int(xml.get('w')), int(xml.get('h'))) == image.size
        result = Image.new('RGBA', image.size)
        for layer in reversed(xml.find('stack').findall('layer')):
            source = Image.open(io.BytesIO(archive.read(layer.get('src')))).convert('RGBA')
            result.alpha_composite(source)
        assert result.tobytes() == image.tobytes()
        assert Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA').tobytes() == image.tobytes()
    assets.append({**asset, 'nativeSize': list(image.size), 'binaryAlpha': True, 'paletteColorLimit': len(COLORS),
                   'nativeColors': len({pixel for pixel in image.getdata() if pixel[3]}), 'integerExportsExact': True, 'oraExact': True,
                   'rotations': turns, 'nativePixelSha256': hashlib.sha256(image.tobytes()).hexdigest()})
assert len(assets) == 2
assert len({asset['nativePixelSha256'] for asset in assets}) == 2
report = {'schema': 1, 'passedAssets': 2, 'passedRotations': 8, 'scope': 'Native source and export geometry checks. Live browser, phone and visual acceptance are handled by the main task.', 'assets': assets}
(HERE / 'instruments-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('PASS 2 instruments and 8 rotations with exact ORA and integer exports')
