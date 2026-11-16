"""Native-grid authoring/export for six identity-specific physical cargo skins.

Raw image_gen output is retained separately. Runtime sprites are rebuilt on the
24px/cell grid, constrained by the existing canonical physical silhouette, then
palette-cleaned and exported at exact integer nearest-neighbour scales.
This tool does not modify geometry, gameplay, prices, existing art or saves.
"""
from pathlib import Path
from collections import deque
import hashlib
import io
import json
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
OUT = REPO / 'prototypes/salvage-route-demo/assets/v042'
PALETTE = REPO / 'design/star-salvage/v04/production/palette.json'
PAL = json.loads(PALETTE.read_text())
COLORS = [tuple(bytes.fromhex(c[1:])) for c in PAL['colors']]
RGB_HEX = dict(zip(COLORS, PAL['colors']))
CELL = 24


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def png(im):
    buf = io.BytesIO()
    im.save(buf, format='PNG')
    return buf.getvalue()


def closest(rgb):
    return min(COLORS, key=lambda p: sum(w * (a-b)**2 for a, b, w in zip(p, rgb, (2, 3, 2))))


def ora(im, path, name):
    families = {'highlights': set(PAL['colors'][11:14] + PAL['colors'][23:25] + PAL['colors'][29:30]),
                'copper_coral_and_indicators': set(PAL['colors'][19:]),
                'deep_structure': set(PAL['colors'][:6]), 'steel_and_board': set()}
    layers = {name: Image.new('RGBA', im.size) for name in families}
    for y in range(im.height):
        for x in range(im.width):
            p = im.getpixel((x, y))
            if p[3]:
                family = next((k for k, v in families.items() if RGB_HEX[p[:3]] in v), 'steel_and_board')
                layers[family].putpixel((x, y), p)
    image = ET.Element('image', {'version': '0.0.3', 'w': str(im.width), 'h': str(im.height), 'name': name})
    stack = ET.SubElement(image, 'stack')
    with zipfile.ZipFile(path, 'w') as z:
        def write(name, data, compression=zipfile.ZIP_DEFLATED):
            info = zipfile.ZipInfo(name, (2026, 11, 9, 0, 0, 0))
            info.compress_type = compression
            z.writestr(info, data)
        write('mimetype', 'image/openraster', zipfile.ZIP_STORED)
        for i, (layer_name, layer) in enumerate(layers.items()):
            source = f'data/layer{i}.png'
            write(source, png(layer))
            ET.SubElement(stack, 'layer', {'name': layer_name, 'src': source, 'x': '0', 'y': '0',
                          'opacity': '1.0', 'visibility': 'visible', 'composite-op': 'svg:src-over'})
        write('stack.xml', ET.tostring(image, encoding='utf-8'))
        write('mergedimage.png', png(im))
        write('Thumbnails/thumbnail.png', png(im.resize((im.width*2, im.height*2), Image.Resampling.NEAREST)))


def regrid(raw, request):
    alpha = raw.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    bounds = alpha.getbbox()
    clean = raw.copy()
    clean.putalpha(alpha)
    body = clean.crop(bounds)
    w, h = request['width'], request['height']
    method = 'whole-object orthographic material regrid'
    if request['shapeId'] == 'tee4':
        # Keep the continuous top radiator and the lower exhaust intact while
        # aligning the T junction with the existing immutable cell boundary.
        a = body.getchannel('A')
        cuts = [y for y in range(body.height//4, body.height*3//4)
                if sum(v == 255 for v in a.crop((0, y, body.width, y+1)).getdata()) < body.width*.65]
        cut = cuts[0] if cuts else body.height//2
        small = Image.new('RGBA', (w, h))
        small.alpha_composite(body.crop((0, 0, body.width, cut)).resize((w, CELL), Image.Resampling.BOX), (0, 0))
        small.alpha_composite(body.crop((0, cut, body.width, body.height)).resize((w, h-CELL), Image.Resampling.BOX), (0, CELL))
        method = f'continuous T top/stem landmark regrid; raw top boundary={cut}'
    elif request['shapeId'] == 'ell5':
        # A continuous L board, never repeated per-cell icons. Regrid broad arms
        # using the original arm boundaries, preserving the joined PCB corner.
        a = body.getchannel('A')
        right_edges = [a.crop((0, y, body.width, y+1)).getbbox()[2]
                       for y in range(body.height//6, body.height//2)]
        cut_x = sorted(right_edges)[len(right_edges)//2]
        broad_rows = [y for y in range(body.height//2, body.height)
                      if sum(v == 255 for v in a.crop((0, y, body.width, y+1)).getdata()) > body.width*.7]
        cut_y = broad_rows[0] if broad_rows else body.height*2//3
        small = Image.new('RGBA', (w, h))
        for box, dest, size in [((0, 0, cut_x, cut_y), (0, 0), (CELL, CELL*2)),
                               ((0, cut_y, cut_x, body.height), (0, CELL*2), (CELL, CELL)),
                               ((cut_x, cut_y, body.width, body.height), (CELL, CELL*2), (CELL*2, CELL))]:
            small.alpha_composite(body.crop(box).resize(size, Image.Resampling.BOX), dest)
        method = f'continuous L PCB arm/corner landmark regrid; raw landmarks={cut_x},{cut_y}'
    else:
        small = body.resize((w, h), Image.Resampling.BOX)
    return small, bounds, method


def native(request):
    raw_path = HERE / request['rawFile']
    raw = Image.open(raw_path).convert('RGBA')
    small, bounds, method = regrid(raw, request)
    canonical_path = REPO / request['references'][0]
    canonical = Image.open(canonical_path).convert('RGBA').getchannel('A')
    assert canonical.size == small.size
    valid = [(x, y) for y in range(small.height) for x in range(small.width)
             if small.getpixel((x, y))[3] >= 128 and canonical.getpixel((x, y))]
    assert valid
    im = Image.new('RGBA', small.size)
    repairs = []
    for y in range(im.height):
        for x in range(im.width):
            if not canonical.getpixel((x, y)):
                continue
            p = small.getpixel((x, y))
            if p[3] < 128:
                nx, ny = min(valid, key=lambda point: (point[0]-x)**2 + (point[1]-y)**2)
                p = small.getpixel((nx, ny))
                repairs.append({'pixel': [x, y], 'nearestMaterialFrom': [nx, ny]})
            im.putpixel((x, y), (*closest(p[:3]), 255))
    edits_path = HERE / 'pixel-edits.json'
    edits = json.loads(edits_path.read_text()).get(request['id'], []) if edits_path.exists() else []
    for x, y, color in edits:
        assert canonical.getpixel((x, y)) and color in PAL['colors']
        im.putpixel((x, y), (*bytes.fromhex(color[1:]), 255))
    process = {'generatedCandidate': request['rawFile'], 'rawSize': list(raw.size),
               'rawAlphaBoundsAt128': list(bounds), 'nativeSize': list(im.size),
               'geometryAlphaSource': request['references'][0], 'geometryAlphaSha256': sha(canonical_path),
               'method': method, 'colorQuantization': 'weighted nearest shared37 palette (RGB weights2,3,2)',
               'alphaRule': 'exact canonical physical silhouette alpha; all other pixels RGBA0',
               'materialBoundaryRepairs': repairs, 'explicitPixelEdits': edits,
               'nativeChangesGeometry': False, 'rawCandidateIsNativeSource': False}
    return im, process


def validate(im, request):
    cells = {tuple(c) for c in request['cells']}
    opaque = {(x, y) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}
    assert set(im.getchannel('A').getdata()) <= {0, 255}
    assert {p[:3] for p in im.getdata() if p[3]} <= set(COLORS)
    assert all((x//CELL, y//CELL) in cells for x, y in opaque)
    assert all(im.getpixel((x, y)) == (0, 0, 0, 0) for y in range(im.height) for x in range(im.width)
               if (x//CELL, y//CELL) not in cells)
    coverage = []
    for cx, cy in request['cells']:
        n = sum((x, y) in opaque for y in range(cy*CELL, (cy+1)*CELL) for x in range(cx*CELL, (cx+1)*CELL))
        assert n >= CELL*CELL*.7
        coverage.append({'cell': [cx, cy], 'opaquePixels': n, 'coverage': round(n/(CELL*CELL), 6)})
    seen = set()
    queue = deque([next(iter(opaque))])
    while queue:
        point = queue.popleft()
        if point in seen:
            continue
        seen.add(point)
        x, y = point
        queue.extend(p for p in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)] if p in opaque and p not in seen)
    assert seen == opaque, 'Disconnected cargo body'
    rotations = []
    for turn in range(4):
        turned = list(cells)
        for _ in range(turn):
            turned = [(-y, x) for x, y in turned]
        min_x, min_y = min(p[0] for p in turned), min(p[1] for p in turned)
        turned = {(x-min_x, y-min_y) for x, y in turned}
        sprite = im.rotate(-90*turn, expand=True, resample=Image.Resampling.NEAREST)
        outside = sum(sprite.getpixel((x, y))[3] > 0 for y in range(sprite.height) for x in range(sprite.width)
                      if (x//CELL, y//CELL) not in turned)
        assert outside == 0
        rotations.append({'degreesClockwise': turn*90, 'nonOccupiedAlphaPixels': outside,
                          'nativeSize': list(sprite.size)})
    return {'nativeSize': list(im.size), 'cellPixels': CELL, 'occupiedCells': request['cells'],
            'paletteOnly37': True, 'alphaBinary': True, 'nonOccupiedAlphaPixels': 0,
            'opaquePixels': len(opaque), 'connectedComponents4': 1, 'cellCoverage': coverage,
            'canonicalAlphaExact': True, 'rotations': rotations}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for folder in ['native1x', 'editable', 'processing']:
        (HERE / folder).mkdir(exist_ok=True)
    requests = json.loads((HERE / 'prompts/requests.json').read_text())
    review_path = HERE / 'review.json'
    reviews = json.loads(review_path.read_text()).get('items', {}) if review_path.exists() else {}
    rows, checks = [], []
    for request in requests:
        id = request['id']
        im, process = native(request)
        check = {'id': id, **validate(im, request)}
        src = HERE / 'native1x' / f'cargo_{id}@1x.png'
        im.save(src)
        edit = HERE / 'editable' / f'cargo_{id}.ora'
        ora(im, edit, f'cargo_{id}')
        log = HERE / 'processing' / f'cargo_{id}.json'
        log.write_text(json.dumps(process, ensure_ascii=False, indent=2) + '\n')
        exports = []
        for scale in [2, 4]:
            target = OUT / f'cargo_{id}@{scale}x.png'
            enlarged = im.resize((im.width*scale, im.height*scale), Image.Resampling.NEAREST)
            enlarged.save(target)
            assert Image.open(target).convert('RGBA').tobytes() == enlarged.tobytes()
            exports.append({'path': str(target.relative_to(REPO)), 'scale': scale,
                            'width': enlarged.width, 'height': enlarged.height,
                            'bytes': target.stat().st_size, 'sha256': sha(target)})
        raw = HERE / request['rawFile']
        rows.append({'id': id, 'itemId': request['itemId'], 'shapeId': request['shapeId'],
                     'source': str(src.relative_to(REPO)), 'sourceSha256': sha(src),
                     'editableSource': str(edit.relative_to(REPO)), 'editableSourceSha256': sha(edit),
                     'candidate': str(raw.relative_to(REPO)), 'candidateSha256': sha(raw),
                     'prompt': request['prompt'], 'references': request['references'],
                     'referenceRole': request['referenceRole'], 'generationTool': 'built-in image_gen',
                     'processLog': str(log.relative_to(REPO)), 'processLogSha256': sha(log),
                     'exports': exports, 'validation': check,
                     'internalVisual': 'INTERNAL_PASS' if reviews.get(id, {}).get('sourceSha256') == sha(src) else 'PENDING_PARENT_REVIEW',
                     'userArtAccepted': False, 'physicalPhoneTested': False})
        checks.append(check)
    manifest = {'schema': 1, 'kind': 'v042_identity_specific_whole_cargo_bodies',
                'cellPixels': CELL, 'palette': str(PALETTE.relative_to(REPO)), 'paletteSha256': sha(PALETTE),
                'internalVisualReview': str(review_path.relative_to(REPO)),
                'scope': 'six existing itemId x shapeId combinations only; no new shapes or gameplay',
                'provenance': 'Six independent built-in image_gen candidates; genuine native-grid regrid/material cleanup with fixed existing silhouette alpha; no concept cropping or repeated mini-icons.',
                'license': 'Original project artwork, generated and native-cleaned for Lost Star Salvage. No third-party game assets.',
                'items': rows}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (HERE / 'validation.json').write_text(json.dumps({'passed': True, 'checks': checks}, ensure_ascii=False, indent=2) + '\n')
    sheet = Image.new('RGBA', (900, 850), (36, 32, 57, 255))
    draw = ImageDraw.Draw(sheet)
    positions = [(20, 45), (330, 45), (20, 285), (330, 285), (20, 520), (330, 520)]
    for row, (x, y) in zip(rows, positions):
        im = Image.open(REPO / row['source']).convert('RGBA')
        sheet.alpha_composite(im.resize((im.width*4, im.height*4), Image.Resampling.NEAREST), (x, y))
        draw.text((x, y-20), row['id'] + ' / ' + str(im.size), fill=(242, 237, 244, 255))
    sheet.save(HERE / 'identity-a-contact.png')
    print(f'Validated {len(rows)} single-body identity skins: canonical mask, >=70% each occupied cell, alpha0 outside, 37-color native/ORA/nearest2x4x')


if __name__ == '__main__':
    main()
