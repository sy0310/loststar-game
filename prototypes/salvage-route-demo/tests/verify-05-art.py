"""Verify the four new physical objects against real masks and editable source pixels."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import subprocess
import zipfile

REPO = Path(__file__).resolve().parents[3]
PRODUCTION = REPO / 'design/star-salvage/v05/production'
ASSETS = REPO / 'prototypes/salvage-route-demo/assets/v05'


def model_json(expression):
    return json.loads(subprocess.check_output(['node', '-e', expression], cwd=REPO))


def record(file):
    return {'path': str(file.relative_to(REPO)), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}


def rotated_mask(mask, rotation):
    for _ in range(rotation):
        mask = [[-y, x] for x, y in mask]
    left = min(x for x, _ in mask)
    top = min(y for _, y in mask)
    return {(x - left, y - top) for x, y in mask}


def verify_connected(image):
    opaque = {(x, y) for y in range(image.height) for x in range(image.width)
              if image.getpixel((x, y))[3]}
    seen = {next(iter(opaque))}
    queue = list(seen)
    while queue:
        x, y = queue.pop()
        for point in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]:
            if point in opaque and point not in seen:
                seen.add(point)
                queue.append(point)
    assert seen == opaque, 'A physical object must be connected'


shapes = model_json("process.stdout.write(JSON.stringify(require('./prototypes/salvage-route-demo/src/cargo-layout.js').SHAPES))")
pairs = model_json("process.stdout.write(JSON.stringify(require('./prototypes/salvage-route-demo/src/cargo-identity.js').curios))")
palette_file = REPO / 'design/star-salvage/v04/production/palette.json'
palette = {tuple(bytes.fromhex(color[1:])) for color in json.loads(palette_file.read_text())['colors']}
assert len(pairs) == 4
bio_manifest = json.loads((PRODUCTION / 'bio/manifest.json').read_text())
instrument_manifest = json.loads((PRODUCTION / 'instruments/instruments-manifest.json').read_text())
canonical = {row['itemId']: (row['source'], row['editableSource']) for row in bio_manifest['items']}
canonical.update({row['itemId']: (row['files']['nativeSource']['path'], row['files']['editableOra']['path']) for row in instrument_manifest['assets']})
rows = []
for pair in pairs:
    identifier = pair['id']
    source, ora = (REPO / name for name in canonical[pair['itemId']])
    image = Image.open(source).convert('RGBA')
    assert {pixel[3] for pixel in image.getdata()} <= {0, 255}
    assert {pixel[:3] for pixel in image.getdata() if pixel[3]} <= palette
    verify_connected(image)
    with zipfile.ZipFile(ora) as archive:
        merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
        assert image.tobytes() == merged.tobytes()
        assert b'<layer ' in archive.read('stack.xml')
    mask = shapes[pair['shapeId']]
    assert image.size == (24*(max(x for x, _ in mask)+1), 24*(max(y for _, y in mask)+1))
    rotations = []
    for rotation in range(4):
        picture = image.rotate(-90*rotation, expand=True)
        occupied = rotated_mask(mask, rotation)
        coverage = []
        for y in range(picture.height//24):
            for x in range(picture.width//24):
                count = sum(picture.getpixel((x*24+px, y*24+py))[3] > 0
                            for px in range(24) for py in range(24))
                assert count >= 24*24*.7 if (x, y) in occupied else count == 0, (identifier, rotation, x, y)
                coverage.append({'cell': [x, y], 'opaque': count})
        rotations.append({'rotation': rotation, 'coverage': coverage})
    files = [source, ora]
    for scale in [2, 4]:
        file = ASSETS / (identifier+'@'+str(scale)+'x.png')
        exported = Image.open(file).convert('RGBA')
        expected = image.resize((image.width*scale, image.height*scale), Image.Resampling.NEAREST)
        assert exported.size == expected.size and exported.tobytes() == expected.tobytes()
        files.append(file)
    rows.append({'id': identifier, 'itemId': pair['itemId'], 'shapeId': pair['shapeId'],
                 'nativeSize': image.size, 'files': [record(file) for file in files],
                 'rotations': rotations, 'paletteSubset': True, 'editableMergedMatches': True,
                 'exactNearest': True, 'binaryAlpha': True})

output = REPO / 'prototypes/salvage-route-demo/verification/art-v05.json'
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps({'passed': 4, 'physicalRotations': 16,
    'scope': 'Native sources, ORA, masks and integer exports. User art and physical phone pending.',
    'assets': rows}, ensure_ascii=False, indent=2)+'\n')
print('PASS4 original v05 objects,16 exact physical rotations, editable source and integer exports')
