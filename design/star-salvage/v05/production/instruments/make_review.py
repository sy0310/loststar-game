"""Render instrument contact sheets and bind production files by SHA256."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
CONFIG = json.loads((HERE / 'assets.json').read_text())
OUT = ROOT / 'prototypes/salvage-route-demo/assets/v05'


def record(path):
    return {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


overview = Image.new('RGB', (640, 320), '#242039')
draw = ImageDraw.Draw(overview)
rotations = Image.new('RGB', (640, 1100), '#242039')
rotation_draw = ImageDraw.Draw(rotations)
assets = []
for index, asset in enumerate(CONFIG['assets']):
    stem = 'cargo_' + asset['id']
    native = Image.open(HERE / (stem + '@1x.png')).convert('RGBA')
    x = 16 + index * 300
    draw.text((x, 10), asset['id'], fill='#F4C785')
    preview = native.resize((native.width * 4, native.height * 4), Image.Resampling.NEAREST)
    overview.paste(preview, (x, 40), preview)
    x = 16 + index * 310
    rotation_draw.text((x, 10), asset['id'], fill='#F4C785')
    rotated = native
    for turn in range(4):
        y = 40 + turn * 260
        rotation_draw.text((x, y), str(turn * 90) + 'deg clockwise', fill='#B6A1BD')
        preview = rotated.resize((rotated.width * 3, rotated.height * 3), Image.Resampling.NEAREST)
        rotations.paste(preview, (x, y + 20), preview)
        rotated = rotated.transpose(Image.Transpose.ROTATE_270)
    files = {
        'generatedStudy': HERE / (stem + '-generated.png'),
        'prompt': HERE / (stem + '-prompt.json'),
        'guide': HERE / (asset['shapeId'] + '-silhouette-guide.png'),
        'nativeEdits': HERE / (stem + '-native-edits.json'),
        'reconstruction': HERE / (stem + '-reconstruction.json'),
        'nativeSource': HERE / (stem + '@1x.png'),
        'editableOra': HERE / (stem + '.ora'),
        'runtime2x': OUT / (stem + '@2x.png'),
        'runtime4x': OUT / (stem + '@4x.png')}
    assets.append({**asset, 'nativeSize': list(native.size), 'mask': CONFIG['shapes'][asset['shapeId']], 'files': {kind: record(path) for kind, path in files.items()}})
overview.save(HERE / 'instruments-overview.png')
rotations.save(HERE / 'instruments-rotations.png')
manifest = {
    'schema': 1, 'id': 'salvage-v05-original-instruments', 'cellPixels': 24,
    'approvedReference': record(ROOT / 'design/star-salvage/v04/concepts/salvage_v04_approved_full.png'),
    'palette': record(ROOT / 'design/star-salvage/v04/production/palette.json'),
    'assets': assets,
    'validation': record(HERE / 'instruments-validation.json'),
    'reproducibility': record(HERE / 'instruments-reproducibility.json'),
    'overview': record(HERE / 'instruments-overview.png'),
    'rotations': record(HERE / 'instruments-rotations.png'),
    'production': [record(HERE / filename) for filename in ['assets.json', 'processing.json', 'README.md', 'export_instruments.py', 'validate_instruments.py', 'make_review.py']],
    'runtimeBytes': sum((OUT / ('cargo_' + asset['id'] + '@' + str(scale) + 'x.png')).stat().st_size for asset in CONFIG['assets'] for scale in [2, 4]),
    'review': {'rootVisual': 'APPROVED_INTERNAL_AFTER_ACTUAL_OVERVIEW', 'userVisual': 'PENDING', 'browser': 'PARENT_INTEGRATION_REQUIRED', 'phone': 'NOT_TESTED_BY_ART_AGENT'}}
(HERE / 'instruments-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Wrote two-instrument manifest with', manifest['runtimeBytes'], 'runtime PNG bytes')
