#!/usr/bin/env python3
"""Recheck immutable review media, source trees, original fees and storage isolation."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile
root = Path('artifacts/ref-ui-unified')
meta = json.loads(Path('releases/ref-ui-package.json').read_text())
evidence = json.loads((root / 'evidence.json').read_text())
checks = []
def check(name, valid, detail=None):
    if not valid:
        raise AssertionError((name, detail))
    checks.append({'name': name, 'passed': True, 'detail': detail})
check('runtime-zip-evidence-source', evidence['sourceCommit'] == meta['sourceCommit'] and evidence['package']['sha256'] == meta['sha256'])
check('zip-bytes', hashlib.sha256(Path(meta['archive']).read_bytes()).hexdigest() == meta['sha256'], meta)
with zipfile.ZipFile(meta['archive']) as archive:
    check('single-folder-files', len(archive.namelist()) == meta['files'] and all(n.startswith('loststar-ui-review/') for n in archive.namelist()))
    check('every-extracted-byte-matches-input', all(Path('releases/ref-ui-static', n).read_bytes() == archive.read(n) for n in archive.namelist()))
for path in ['src', 'assets/runtime', 'assets/source']:
    diff = subprocess.check_output(['git', 'diff', '--name-only', '06cb11f', meta['sourceCommit'], '--', path], text=True)
    check(path + '-unchanged-vs-formal', not diff, subprocess.check_output(['git', 'rev-parse', meta['sourceCommit'] + ':' + path], text=True).strip())
for image in evidence['screens']:
    check('image-hash/' + image['file'], hashlib.sha256((root / image['file']).read_bytes()).hexdigest() == image['sha256'])
for movie in evidence['videos']:
    check('movie-hash/' + movie['file'], hashlib.sha256((root / movie['file']).read_bytes()).hexdigest() == movie['sha256'])
    check('movie-source-storage/' + movie['name'], movie['initial']['build']['commit'] == meta['sourceCommit'] and movie['final']['storage'] == {'opens': 0, 'unchanged': True})
    check('natural-clock/' + movie['name'], not movie['clockOverrides'] and movie['speed'] == 1)
prices = {'receipt': [40, 120], 'tape': [30, 100], 'nested': [50, 140], 'stamp': [45, 180], 'cosmic-parcel': [60, 220], 'bell': [35, 120]}
for item, costs in prices.items():
    movie = next(v for v in evidence['videos'] if v['name'] == item + '-whole-state-treatment')
    state = movie['final']['state']
    check('committed-C/' + item, (state['receipt'] if item == 'receipt' else state['curios'][item])['condition'] == 'stabilized')
    actions = [r for r in movie['final']['trace'] if (r['action']['type'] == 'paper' and item == 'receipt' or r['action']['type'] == 'curio' and r['action'].get('id') == item) and r['action'].get('kind') in ['clean', 'repair']]
    check('exact-original-charges/' + item, [r['before'] - r['after'] for r in actions] == costs, costs)
    check('signature-facts-unchanged/' + item, movie['initial']['state']['receipt']['verifiedEvidenceIds'] == state['receipt']['verifiedEvidenceIds'])
    check('one-free-action/' + item, len([t for t in movie['final']['treatment']['trials'] if t['id'] == item]) == 1)
check('route-storage', all(r['storage'] == {'opens': 0, 'unchanged': True} and not r['overflow'] for r in evidence['routeChecks']))
check('browser-errors', not evidence['errors'])
stats = json.loads((root / 'checks/browser-results.json').read_text())['stats']
check('browser-cases', stats['expected'] == 72 and stats['unexpected'] == stats['skipped'] == stats['flaky'] == 0, stats)
check('no-important', '!important' not in Path('prototypes/ref-ui/style.css').read_text())
check('formal-entry-unchanged', 'prototypes/ref-ui' not in Path('src/fusion/entry.ts').read_text())
(root / 'verification.json').write_text(json.dumps({'sourceCommit': meta['sourceCommit'], 'zipSha256': meta['sha256'], 'checks': checks, 'physicalPhone': 'NOT_TESTED', 'userVisual': 'PENDING', 'formalIntegration': 'IN_PROGRESS'}, ensure_ascii=False, indent=2) + '\n')
print(f'Integrity checks: {len(checks)}')
