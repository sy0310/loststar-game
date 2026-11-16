#!/usr/bin/env python3
"""Collect one frozen package sequentially. Never opens or clears a personal profile."""
from pathlib import Path
import argparse
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True, help='Immutable packaged build served from a relative subdirectory')
parser.add_argument('--modes', nargs='+', default=['screens', 'pages', 'treatment', 'assist', 'cases', 'excavation', 'life'],
                    choices=['screens', 'pages', 'treatment', 'assist', 'cases', 'excavation', 'life'])
parser.add_argument('--measure', action='store_true', help='Measure after all media capture, without concurrent recording')
args = parser.parse_args()
out = ROOT / 'artifacts/visual-renewal'
out.mkdir(parents=True, exist_ok=True)
env = {**os.environ, 'RENEWAL_URL': args.url}

def run(command, log):
    print('Running ' + ' '.join(command), flush=True)
    with (out / log).open('w') as handle:
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=handle, stderr=subprocess.STDOUT)
    if result.returncode:
        raise SystemExit(f'Failed ({result.returncode}); inspect {out / log}')

for name in ['firstplanet', 'feedback', 'renewal']:
    run(['npx', 'vite', 'build', '--ssr', f'scripts/{name}_fixtures.ts', '--outDir', f'releases/{name}-fixtures'], f'fixture-{name}.log')
for mode in args.modes:
    run(['node', 'scripts/capture_visual_renewal.mjs', mode], f'capture-{mode}.log')
    report = json.loads((out / f'{mode}-evidence.json').read_text())
    print(f'{mode}: {len(report["cases"])} cases, {len(report["screenshots"])} screenshots, {len(report["videos"])} videos, {len(report["errors"])} errors', flush=True)
run(['node', 'scripts/smoke_visual_renewal_package.mjs'], 'package-smoke.log')
if args.measure:
    run(['node', 'scripts/measure_visual_renewal.mjs'], 'performance.log')
