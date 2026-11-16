#!/usr/bin/env python3
"""Bind the approved phone follow-up to its actual ZIP, fees and storage evidence."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

root = Path('artifacts/ref-ui-followup')
meta = json.loads(Path('releases/ref-ui-package.json').read_text())
e = json.loads((root / 'evidence.json').read_text())
checks = []


def check(name, valid, detail=None):
    if not valid:
        raise AssertionError((name, detail))
    checks.append(dict(name=name, passed=True, detail=detail))


check('fixed-source', e['sourceCommit'] == meta['sourceCommit'] and e['package'] == meta)
check('zip-sha256', hashlib.sha256(Path(meta['archive']).read_bytes()).hexdigest() == meta['sha256'])
with zipfile.ZipFile(meta['archive']) as z:
    check('single-folder-and-files', len(z.namelist()) == meta['files'] and all(n.startswith('loststar-ui-review/') for n in z.namelist()))
    check('every-extracted-byte', all(Path('releases/ref-ui-static', n).read_bytes() == z.read(n) for n in z.namelist()))
for path in ['src', 'assets/runtime', 'assets/source']:
    changed = subprocess.check_output(['git', 'diff', '--name-only', '06cb11f', meta['sourceCommit'], '--', path], text=True)
    check(path + '-formal-unchanged', not changed)
for s in e['screens']:
    check('screen/' + s['name'], hashlib.sha256((root / s['file']).read_bytes()).hexdigest() == s['sha256'])
    a = s['audit']
    check('default-layout-isolation/' + s['name'], a['build']['commit'] == meta['sourceCommit'] and not a['build']['dirty'] and a['storage'] == dict(opens=0, unchanged=True) and a['visibleComparisons'] == 0 and not a['overflow'])
for v in e['videos']:
    check('movie/' + v['name'], hashlib.sha256((root / v['file']).read_bytes()).hexdigest() == v['sha256'])
    check('source-storage-clock/' + v['name'], v['initial']['build']['commit'] == meta['sourceCommit'] and v['final']['storage'] == dict(opens=0, unchanged=True) and v['speed'] == 1 and not e['clockOverrides'])
prices = dict(receipt=[40, 120], tape=[30, 100], nested=[50, 140], stamp=[45, 180], **{'cosmic-parcel': [60, 220], 'bell': [35, 120]})
for item, costs in prices.items():
    v = next(v for v in e['videos'] if v['name'] == item + '-instant-clean')
    final = v['final']; state = final['state']
    check('committed-C/' + item, (state['receipt'] if item == 'receipt' else state['curios'][item])['condition'] == 'stabilized')
    actions = [r for r in final['trace'] if (r['action']['type'] == 'paper' and item == 'receipt' or r['action']['type'] == 'curio' and r['action'].get('id') == item) and r['action'].get('kind') in ['clean', 'repair']]
    check('original-prices-once/' + item, [r['before'] - r['after'] for r in actions] == costs, costs)
    check('one-instant-clean/' + item, len(final['instantCleaning']) == 1 and final['instantCleaning'][0]['item'] == item)
    check('same-signature-facts/' + item, v['initial']['state']['receipt']['verifiedEvidenceIds'] == state['receipt']['verifiedEvidenceIds'])
    check('one-free-interaction/' + item, len([t for t in final['treatment']['trials'] if t['id'] == item]) == 1)
res = next(v for v in e['videos'] if v['name'] == 'residents-observation')
check('resident-no-spend', not any(r['before'] > r['after'] for r in res['final']['trace']))
check('resident-facility-rights', res['initial']['state']['projects'] == res['final']['state']['projects'])
check('media-count', len(e['screens']) == 41 and len(e['videos']) == 8 and not e['errors'])
stats = json.loads((root / 'checks/browser-results.json').read_text())['stats']
check('80-cases-no-retry', stats['expected'] == 80 and stats['unexpected'] == stats['skipped'] == stats['flaky'] == 0, stats)
check('432-unit-cases', '432 passed' in (root / 'checks/unit.log').read_text())
(root / 'verification.json').write_text(json.dumps(dict(sourceCommit=meta['sourceCommit'], zipSha256=meta['sha256'], checks=checks, physicalPhone='NOT_TESTED', userVisual='PENDING', formalIntegration='IN_PROGRESS'), ensure_ascii=False, indent=2) + '\n')
print('Fixed-package checks:', len(checks))
