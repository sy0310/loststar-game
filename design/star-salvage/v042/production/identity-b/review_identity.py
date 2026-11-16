"""Rebuild source review contact sheets and hash-bound art manifest."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
CONFIG = json.loads((HERE / 'assets.json').read_text())
OUT = ROOT / 'prototypes/salvage-route-demo/assets/v042'


def record(path):
    return {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


overview = Image.new('RGB', (760, 620), '#242039')
draw = ImageDraw.Draw(overview)
rotations = Image.new('RGB', (1220, 1100), '#242039')
rot_draw = ImageDraw.Draw(rotations)
assets = []
for i, asset in enumerate(CONFIG['assets']):
    name = asset['id']
    stem = 'cargo_' + name
    native_path = HERE / (stem + '@1x.png')
    native = Image.open(native_path).convert('RGBA')
    x, y = 20 + (i % 2) * 380, 20 + (i // 2) * 200
    draw.text((x, y), name, fill='#F4C785')
    scaled = native.resize((native.width * 3, native.height * 3), Image.Resampling.NEAREST)
    overview.paste(scaled, (x, y + 25), scaled)
    x = 16 + i * 244
    rot_draw.text((x, 10), name, fill='#F4C785')
    rotated = native
    for turn in range(4):
        y = 40 + turn * 260
        rot_draw.text((x, y), str(turn * 90) + 'deg clockwise', fill='#B6A1BD')
        scaled = rotated.resize((rotated.width * 3, rotated.height * 3), Image.Resampling.NEAREST)
        rotations.paste(scaled, (x, y + 20), scaled)
        rotated = rotated.transpose(Image.Transpose.ROTATE_270)
    row = {**asset, 'nativeSize': list(native.size), 'mask': CONFIG['shapes'][asset['shapeId']], 'production': {}}
    for kind, path in [
        ('generatedStudy', HERE / (stem + '-generated.png')),
        ('prompt', HERE / (stem + '-prompt.json')),
        ('silhouetteGuide', HERE / (asset['shapeId'] + '-silhouette-guide.png')),
        ('nativeEdits', HERE / (stem + '-native-edits.json')),
        ('reconstruction', HERE / (stem + '-reconstruction.json')),
        ('nativeSource', native_path), ('editableOra', HERE / (stem + '.ora')),
        ('runtime2x', OUT / (stem + '@2x.png')), ('runtime4x', OUT / (stem + '@4x.png'))]:
        row['production'][kind] = record(path)
    assets.append(row)
overview.save(HERE / 'identity-b-overview.png')
rotations.save(HERE / 'identity-b-rotations.png')
manifest = {
    'schema': 1, 'id': 'salvage-v042-cargo-item-identity-b', 'cellPixels': 24,
    'approvedReference': record(ROOT / 'design/star-salvage/v04/concepts/salvage_v04_approved_full.png'),
    'palette': record(ROOT / 'design/star-salvage/v04/production/palette.json'),
    'alpha': 'binary 0/255; nonoccupied footprint cells completely transparent',
    'light': 'upper-left', 'shapePolicy': 'unchanged existing line2, ell3, line3; one physical connected object per PNG; no repeated per-cell items',
    'generation': 'Five independent builtin image_gen generation calls with real transparency. High-resolution studies are production references, not native-grid claims. Native outputs are palette-normalized and whole-outline reconstructed by export_identity.py.',
    'review': {'rootVisual': 'APPROVED_INTERNAL_AFTER_ACTUAL_OVERVIEW', 'userVisual': 'PENDING', 'liveBrowser': 'PARENT_INTEGRATION_REQUIRED', 'phone': 'NOT_TESTED_BY_ART_AGENT'},
    'assets': assets,
    'checks': {
        'validation': record(HERE / 'identity-b-validation.json'),
        'reproducibility': record(HERE / 'identity-b-reproducibility.json'),
        'overview': record(HERE / 'identity-b-overview.png'),
        'rotationsContactSheet': record(HERE / 'identity-b-rotations.png')},
    'productionFiles': [record(HERE / name) for name in ['assets.json', 'export_identity.py', 'validate_identity.py', 'review_identity.py', 'README.md']],
    'runtimeBytes': sum(p.stat().st_size for asset in CONFIG['assets'] for p in [OUT / ('cargo_' + asset['id'] + '@2x.png'), OUT / ('cargo_' + asset['id'] + '@4x.png')])
}
(HERE / 'identity-b-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Wrote hash-bound manifest for', len(assets), 'assets; runtime PNG bytes', manifest['runtimeBytes'])
