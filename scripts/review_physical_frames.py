#!/usr/bin/env python3
"""Extract chronological frames of actual 1x recordings; no animation synthesis."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / os.environ.get('RENEWAL_OUTPUT', 'artifacts/v042-physical-review')
FRAMES = OUT / 'review-frames'
FRAMES.mkdir(exist_ok=True)
museum = json.loads((OUT / 'museum-physical-evidence.json').read_text())
mechanisms = json.loads((OUT / 'mechanisms-physical-evidence.json').read_text())
treatment = json.loads((OUT / 'treatment-evidence.json').read_text())
source = museum['sourceCommit']
for report in [museum, mechanisms, treatment]:
    assert report['sourceCommit'] == source and not report['errors']
    assert report['zipSha256'] == museum['zipSha256'] and not report['physicalPhone']
index = {'sourceCommit': source, 'zipSha256': museum['zipSha256'], 'physicalPhone': False,
         'method': 'Actual 1x movie frames extracted by ffmpeg; requested seek may round to the next native video frame. Contact sheets crop/nearest-resize these frames for review; they are not phone screenshots or synthetic animation.',
         'frames': [], 'contactSheets': []}

def extract(case, name, seconds):
    movie = case['video']['file']
    file = FRAMES / f'{name}.png'
    subprocess.run(['ffmpeg', '-y', '-ss', str(max(0, seconds)), '-i', str(OUT / movie),
                    '-frames:v', '1', str(file), '-loglevel', 'error'], check=True)
    index['frames'].append({'file': file.relative_to(OUT).as_posix(), 'sourceVideo': movie,
                            'requestedSeconds': seconds, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    return file

def sheet(name, cells, crop, size, columns):
    rows = (len(cells) + columns - 1) // columns
    stride = size[1] + 30
    result = Image.new('RGB', (columns * size[0], rows * stride), '#241342')
    text = ImageDraw.Draw(result)
    for i, (file, label) in enumerate(cells):
        image = Image.open(file).convert('RGB').crop(crop).resize(size, Image.Resampling.NEAREST)
        x, y = i % columns * size[0], i // columns * stride
        result.paste(image, (x, y + 26))
        text.text((x + 6, y + 6), label, fill='#ffe0a0')
    file = FRAMES / f'{name}.png'
    result.save(file)
    index['contactSheets'].append({'file': file.relative_to(OUT).as_posix(), 'name': name,
                                    'kind': 'actual-video-frame-contact-sheet', 'notPhonePage': True})

for case in museum['cases']:
    cells = []
    for target in ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']:
        for phase in ['grip', 'inspect', 'close']:
            row = next(r for r in case['trace'] if r.get('robotTarget') == target and r.get('servicePhase') == phase)
            file = extract(case, f'{case["name"]}-{target}-{phase}', row['ms'] / 1000)
            if phase == 'inspect':
                cells.append((file, f'{case["name"]} / {target}'))
    sheet(f'{case["name"]}-six-inspections', cells, (15, 151, 375, 605), (240, 303), 3)

# The walk screenshot collector starts at the hub. Inspect the narrow vertical
# aisle itself, in both directions, rather than claiming those hub shots prove it.
case = next(c for c in museum['cases'] if c['name'] == 'museum-all-3')
for target in ['receipt', 'nested', 'tape']:
    for action in ['walk', 'return']:
        candidates = [r for r in case['trace'] if r.get('robotTarget') == target
                      and r.get('robotAction') == action
                      and float(r['robotX']) in (244, 524)]
        center = min(candidates, key=lambda r: abs(float(r['robotY']) - 660))['ms'] / 1000
        cells = []
        name = f'museum-all-3-{target}-{action}-aisle'
        for offset in [-.5, 0, .5]:
            time = center + offset
            file = extract(case, f'{name}-{offset}', time)
            cells.append((file, f'{target} {action} / {time:.2f}s'))
        sheet(name, cells, (15, 151, 375, 605), (240, 303), 3)

for case in mechanisms['cases']:
    row = next(r for r in case['trace'] if r.get('experimentPlaying') == 'true' and float(r.get('mechanismTime', '0')) > .1)
    start = row['ms'] / 1000 - float(row['mechanismTime'])
    cells = []
    for time in [.18, .5, .7, .95, 1.45, 2.15, 2.5, 2.59]:
        file = extract(case, f'{case["name"]}-{time}', start + time)
        cells.append((file, f'{case["name"]} / {time:.2f}s'))
    sheet(f'{case["name"]}-physical-contacts', cells, (15, 129, 375, 522), (240, 262), 4)

for case in treatment['cases']:
    cells = []
    for step in case['steps']:
        for fraction in [.3, .55, .8]:
            action = step['action']
            time = (action['startedAt'] + (action['endsAt'] - action['startedAt']) * fraction - case['reviewStartedAt']) / 1000
            file = extract(case, f'{case["id"]}-{step["kind"]}-{fraction}', time)
            cells.append((file, f'{case["id"]} / {step["kind"]} / {fraction:.0%}'))
    sheet(f'{case["id"]}-tool-contacts', cells, (15, 129, 375, 522), (240, 262), 3)

(FRAMES / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'source': source, 'frames': len(index['frames']), 'contactSheets': len(index['contactSheets'])}))
