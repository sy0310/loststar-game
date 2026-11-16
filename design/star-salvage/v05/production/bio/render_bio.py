"""Native pixel authoring and integer exports for two original biological curios."""
from collections import deque
from pathlib import Path
import hashlib
import io
import json
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
OUT = REPO / 'prototypes/salvage-route-demo/assets/v05'
PALETTE = REPO / 'design/star-salvage/v04/production/palette.json'
PAL = json.loads(PALETTE.read_text())
COLORS = [tuple(bytes.fromhex(c[1:])) for c in PAL['colors']]
CELL = 24


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png(im):
    buf = io.BytesIO()
    im.save(buf, format='PNG')
    return buf.getvalue()


def closest(rgb):
    return min(COLORS, key=lambda color: sum(w*(a-b)**2 for a, b, w in zip(color, rgb, (2, 3, 2))))


def editable(im, path, name):
    groups = {'pale_reflections': set(PAL['colors'][11:14] + PAL['colors'][23:25]),
              'breathing_ring_and_iridescence': set(PAL['colors'][25:30]),
              'coral_and_warm_inclusions': set(PAL['colors'][19:24] + PAL['colors'][30:33]),
              'mineral_shell_or_scale_body': set()}
    layers = {name: Image.new('RGBA', im.size) for name in groups}
    for y in range(im.height):
        for x in range(im.width):
            pixel = im.getpixel((x, y))
            if pixel[3]:
                color = '#' + bytes(pixel[:3]).hex().upper()
                group = next((name for name, colors in groups.items() if color in colors), 'mineral_shell_or_scale_body')
                layers[group].putpixel((x, y), pixel)
    root = ET.Element('image', {'version': '0.0.3', 'w': str(im.width), 'h': str(im.height), 'name': name})
    stack = ET.SubElement(root, 'stack')
    with zipfile.ZipFile(path, 'w') as z:
        def write(name, data, compression=zipfile.ZIP_DEFLATED):
            info = zipfile.ZipInfo(name, (2026, 11, 10, 0, 0, 0))
            info.compress_type = compression
            z.writestr(info, data)
        write('mimetype', 'image/openraster', zipfile.ZIP_STORED)
        for index, (layer_name, layer) in enumerate(layers.items()):
            source = f'data/layer{index}.png'
            write(source, png(layer))
            ET.SubElement(stack, 'layer', {'name': layer_name, 'src': source, 'x': '0', 'y': '0',
                          'opacity': '1.0', 'visibility': 'visible', 'composite-op': 'svg:src-over'})
        write('stack.xml', ET.tostring(root, encoding='utf-8'))
        write('mergedimage.png', png(im))
        write('Thumbnails/thumbnail.png', png(im.resize((96, 96), Image.Resampling.NEAREST)))


def safe_domain(request):
    cells = {tuple(cell) for cell in request['cells']}
    logical = {(x, y) for y in range(48) for x in range(48) if (x//CELL, y//CELL) in cells}
    # One native pixel at the outer and concave boundary of the physical mask.
    return {p for p in logical if all(q in logical for q in [(p[0]-1, p[1]), (p[0]+1, p[1]),
                                                            (p[0], p[1]-1), (p[0], p[1]+1)])}


def regrid(request):
    raw = Image.open(HERE / request['rawFile']).convert('RGBA')
    alpha = raw.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    bounds = alpha.getbbox()
    raw.putalpha(alpha)
    body = raw.crop(bounds)
    landmarks = None
    if request['shapeId'] == 'ell3':
        a = body.getchannel('A')
        right_edges = [a.crop((0, y, body.width, y+1)).getbbox()[2]
                       for y in range(body.height//6, body.height//3)]
        cut_x = sorted(right_edges)[len(right_edges)//2]
        broad_rows = [y for y in range(body.height//3, body.height)
                      if a.crop((0, y, body.width, y+1)).getbbox()[2] > body.width*.7]
        cut_y = broad_rows[0]
        small = Image.new('RGBA', (48, 48))
        # Regrid the continuous mantle at its elbow, preserving all six limb
        # structures and the ventral disc. No repeated creature parts per cell.
        for source, dest in [((0, 0, cut_x, cut_y), (0, 0)),
                             ((0, cut_y, cut_x, body.height), (0, 24)),
                             ((cut_x, cut_y, body.width, body.height), (24, 24))]:
            small.alpha_composite(body.crop(source).resize((24, 24), Image.Resampling.BOX), dest)
        landmarks = {'rawElbowX': cut_x, 'rawElbowY': cut_y}
    else:
        small = Image.new('RGBA', (48, 48))
        small.alpha_composite(body.resize((46, 46), Image.Resampling.BOX), (1, 1))
    result = Image.new('RGBA', (48, 48))
    domain = safe_domain(request)
    for x, y in domain:
        r, g, b, a = small.getpixel((x, y))
        if a >= 128:
            result.putpixel((x, y), (*closest((r, g, b)), 255))
    edits = []
    # Native contour cleanup broadens only underfilled physical quadrants along
    # connected shell tangents. Each added pixel and its material source are logged.
    for cx, cy in request['cells']:
        region = {(x, y) for y in range(cy*24, (cy+1)*24) for x in range(cx*24, (cx+1)*24)}
        while sum(result.getpixel(p)[3] > 0 for p in region) < 408:
            opaque = {p for p in domain if result.getpixel(p)[3]}
            candidates = []
            for point in region & domain - opaque:
                x, y = point
                neighbors = [p for p in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)] if p in opaque]
                if len(neighbors) >= 2:
                    candidates.append((point, neighbors))
            assert candidates, (request['id'], 'Physical contour needs art review')
            (x, y), neighbors = max(candidates, key=lambda row: (len(row[1]), -abs(row[0][0]-23.5), -row[0][1]))
            source = min(neighbors, key=lambda p: abs(p[0]-23.5))
            pixel = result.getpixel(source)
            result.putpixel((x, y), pixel)
            edits.append({'pixel': [x, y], 'rgba': list(pixel), 'materialSource': list(source),
                          'reason': 'native connected contour tangent for cell readability'})
    refinement_path = HERE / 'native-refinement.json'
    refinement = json.loads(refinement_path.read_text()).get('items', {}).get(request['id'], []) if refinement_path.exists() else []
    for edit in refinement:
        point = tuple(edit['pixel'])
        assert result.getpixel(point) == tuple(edit['before'])
        assert tuple(edit['rgba'][:3]) in COLORS and edit['rgba'][3] == 255
        result.putpixel(point, tuple(edit['rgba']))
    return result, {'rawCandidate': request['rawFile'], 'generatedSize': list(raw.size),
                    'alphaBoundsAt128': list(bounds), 'nativeSize': [48, 48], 'landmarks': landmarks,
                    'process': 'continuous whole-body native regrid, shared37 palette quantization, binary alpha and declared contour cleanup',
                    'pixelEdits': edits, 'explicitArtRefinement': refinement,
                    'generatedCandidateIsNativeSource': False}


def validate(im, request):
    cells = {tuple(cell) for cell in request['cells']}
    opaque = {(x, y) for y in range(48) for x in range(48) if im.getpixel((x, y))[3]}
    assert opaque <= safe_domain(request)
    assert set(im.getchannel('A').getdata()) <= {0, 255}
    assert {p[:3] for p in im.getdata() if p[3]} <= set(COLORS)
    assert all(im.getpixel((x, y)) == (0, 0, 0, 0) for y in range(48) for x in range(48)
               if (x//24, y//24) not in cells)
    coverage = []
    for cx, cy in request['cells']:
        n = sum((x, y) in opaque for y in range(cy*24, (cy+1)*24) for x in range(cx*24, (cx+1)*24))
        assert n >= 576*.70
        coverage.append({'cell': [cx, cy], 'opaquePixels': n, 'coverage': round(n/576, 6)})
    seen = set()
    queue = deque([next(iter(opaque))])
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        queue.extend(p for p in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)] if p in opaque and p not in seen)
    assert seen == opaque, 'Disconnected body pixels'
    rotations = []
    for turn in range(4):
        turned = list(cells)
        for _ in range(turn):
            turned = [(-y, x) for x, y in turned]
        min_x, min_y = min(x for x, y in turned), min(y for x, y in turned)
        turned = {(x-min_x, y-min_y) for x, y in turned}
        sprite = im.rotate(-90*turn, expand=True, resample=Image.Resampling.NEAREST)
        outside = sum(sprite.getpixel((x, y))[3] > 0 for y in range(sprite.height) for x in range(sprite.width)
                      if (x//CELL, y//CELL) not in turned)
        assert outside == 0
        rotations.append({'degreesClockwise': turn*90, 'nonOccupiedAlphaPixels': outside})
    return {'nativeSize': [48, 48], 'cellPixels': 24, 'cells': request['cells'], 'cellCoverage': coverage,
            'paletteOnly37': True, 'alphaBinary': True, 'externalSafetyBorderPixels': 1,
            'nonOccupiedAlphaPixels': 0, 'connectedComponents4': 1, 'rotations': rotations}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    requests = json.loads((HERE / 'prompts/requests.json').read_text())
    review_path = HERE / 'review.json'
    reviews = json.loads(review_path.read_text()).get('items', {}) if review_path.exists() else {}
    rows = []
    for request in requests:
        id = request['id']
        im, processing = regrid(request)
        check = validate(im, request)
        source = HERE / 'native1x' / f'cargo_{id}@1x.png'
        im.save(source)
        ora = HERE / 'editable' / f'cargo_{id}.ora'
        editable(im, ora, id)
        log = HERE / 'processing' / f'cargo_{id}.json'
        log.write_text(json.dumps(processing, ensure_ascii=False, indent=2) + '\n')
        exports = []
        for scale in [2, 4]:
            path = OUT / f'cargo_{id}@{scale}x.png'
            im.resize((48*scale, 48*scale), Image.Resampling.NEAREST).save(path)
            exports.append({'path': str(path.relative_to(REPO)), 'width': 48*scale, 'height': 48*scale,
                            'scale': scale, 'bytes': path.stat().st_size, 'sha256': sha(path)})
        raw = HERE / request['rawFile']
        rows.append({'id': id, 'itemId': request['itemId'], 'shapeId': request['shapeId'],
                     'source': str(source.relative_to(REPO)), 'sourceSha256': sha(source),
                     'editableSource': str(ora.relative_to(REPO)), 'editableSourceSha256': sha(ora),
                     'candidate': str(raw.relative_to(REPO)), 'candidateSha256': sha(raw),
                     'generationTool': 'built-in image_gen', 'prompt': request['prompt'],
                     'references': request['references'], 'referenceRole': request['referenceRole'],
                     'processLog': str(log.relative_to(REPO)), 'processLogSha256': sha(log),
                     'exports': exports, 'validation': check,
                     'internalVisual': 'INTERNAL_PASS' if reviews.get(id, {}).get('sourceSha256') == sha(source) else 'PENDING_PARENT_REVIEW',
                     'rootInternalReviewed': reviews.get(id, {}).get('sourceSha256') == sha(source),
                     'userArtAccepted': False, 'physicalPhoneTested': False})
    manifest = {'schema': 1, 'kind': 'v05_original_biological_cargo', 'cellPixels': 24,
                'palette': str(PALETTE.relative_to(REPO)), 'paletteSha256': sha(PALETTE),
                'sourcePromptSet': str((HERE / 'prompts/requests.json').relative_to(REPO)),
                'license': 'Original project assets generated with built-in image_gen and native-grid cleanup.',
                'internalVisualReview': str(review_path.relative_to(REPO)),
                'rootInternalReviewed': all(row['rootInternalReviewed'] for row in rows),
                'displayLimitations': ['A complete48x48 source reduced to a24x24 thumbnail loses six-paddle count and small refracted-granule detail. The breathing ring, suction disc and occupied silhouette remain the main thumbnail identifiers.',
                                       'Full cargo presentation should use the48x48 native source or exact integer enlargement. User art and physical-phone readability remain pending.'],
                'reviewArtifacts': [str((HERE / name).relative_to(REPO)) for name in ['bio-contact.png', 'hull-clinger-refinement.png', 'bio-scale-review.png']],
                'items': rows}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (HERE / 'validation.json').write_text(json.dumps({'passed': True, 'items': [r['validation'] for r in rows]}, ensure_ascii=False, indent=2) + '\n')
    sheet = Image.new('RGBA', (680, 430), (36, 32, 57, 255))
    d = ImageDraw.Draw(sheet)
    for row, (x, y) in zip(rows, [(30, 55), (360, 55)]):
        im = Image.open(REPO / row['source']).convert('RGBA')
        sheet.alpha_composite(im.resize((288, 288), Image.Resampling.NEAREST), (x, y))
        d.text((x, y-24), row['id'], fill=(242, 237, 244, 255))
        d.text((x, y+300), '48x48 / 24px per cell / min fill ' + str(round(min(c['coverage'] for c in row['validation']['cellCoverage'])*100, 1)) + '%', fill=(242, 237, 244, 255))
    sheet.save(HERE / 'bio-contact.png')
    before_path = HERE / 'processing/before-refine/cargo_hull_clinger_ell3@1x.png'
    if before_path.exists():
        comparison = Image.new('RGBA', (680, 390), (36, 32, 57, 255))
        draw = ImageDraw.Draw(comparison)
        before = Image.open(before_path).convert('RGBA')
        after = Image.open(HERE / 'native1x/cargo_hull_clinger_ell3@1x.png').convert('RGBA')
        for image, x, label in [(before, 30, 'Before internal review'), (after, 360, 'Six paddles and ventral cup refinement')]:
            comparison.alpha_composite(image.resize((288, 288), Image.Resampling.NEAREST), (x, 55))
            draw.text((x, 30), label, fill=(242, 237, 244, 255))
        comparison.save(HERE / 'hull-clinger-refinement.png')
    scale_review = Image.new('RGBA', (680, 370), (36, 32, 57, 255))
    draw = ImageDraw.Draw(scale_review)
    for row, x in zip(rows, [30, 360]):
        image = Image.open(REPO / row['source']).convert('RGBA')
        draw.text((x, 20), row['id'], fill=(242, 237, 244, 255))
        scale_review.alpha_composite(image.resize((192, 192), Image.Resampling.NEAREST), (x, 50))
        thumbnail = image.resize((24, 24), Image.Resampling.NEAREST)
        scale_review.alpha_composite(thumbnail.resize((96, 96), Image.Resampling.NEAREST), (x, 265))
        draw.text((x+110, 280), '24px complete-object thumbnail', fill=(242, 237, 244, 255))
    scale_review.save(HERE / 'bio-scale-review.png')
    print('Validated two original biological cargo sprites, four rotations, native/ORA/2x/4x')


if __name__ == '__main__':
    main()
