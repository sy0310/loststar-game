#!/usr/bin/env python3
"""Verify the renewal preserved the approved business logic, without opening a save."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '51d682c289dc786c43fbb51697bdf285b9044f66'
FILES = [
    'src/game/star-chart.ts', 'src/game/engine.ts', 'src/game/station.ts',
    'src/game/growth.ts', 'src/game/assist.ts', 'src/game/radar.ts',
    'src/game/guard-tuning.ts', 'src/game/persistence.ts', 'src/game/world.ts',
    'src/fusion/domain.ts', 'src/fusion/store.ts', 'src/fusion/contracts.ts',
    'src/fusion/progression.ts', 'src/fusion/surface.ts', 'src/fusion/render-clock.ts',
]

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

records = []
for name in FILES:
    current = (ROOT / name).read_bytes()
    records.append({'path': name, 'sha256': hashlib.sha256(current).hexdigest(),
                    'identicalToBaseline': current == git('show', f'{BASELINE}:{name}')})
report = {
    'sourceCommit': git('rev-parse', 'HEAD').decode().strip(),
    'baselineRuntime': BASELINE,
    'database': 'loststar.fusion.firstplanet.v037',
    'result': 'Business, economy, store, work clock and fog-persistence bytes are checked against the approved baseline. This does not replace runtime archive tests.',
    'files': records,
}
target = ROOT / 'artifacts/visual-renewal/model-invariants.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2) + '\n')
different = [row['path'] for row in records if not row['identicalToBaseline']]
if different:
    raise SystemExit('Business logic changed; review explicitly: ' + ', '.join(different))
print(f'{len(records)}/{len(records)} business modules byte-identical to {BASELINE[:7]}')
