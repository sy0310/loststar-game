#!/usr/bin/env python3
"""Build a relocatable TapTap H5 archive: one loststar/ directory at ZIP root."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'releases' / 'taptap'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--night-lab', action='store_true', help='Package the separate, default-off night prototype')
    modes.add_argument('--d1', action='store_true', help='Package the read-only D1 art/motion review, without touching real saves')
    args = parser.parse_args()
    folder = 'loststar-night' if args.night_lab else 'loststar-d1' if args.d1 else 'loststar'
    game = OUTPUT / folder
    version = json.loads((ROOT / 'package.json').read_text())['version']
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    config = 'vite.night.config.ts' if args.night_lab else 'vite.d1.config.ts' if args.d1 else None
    if config:
        subprocess.run(['npx', 'tsc', '--noEmit'], cwd=ROOT, check=True)
    command = ['npx', 'vite', 'build', '--config', config] if config else ['npm', 'run', 'build', '--']
    subprocess.run(command + ['--base=./', '--outDir=releases/taptap/' + folder], cwd=ROOT, check=True)
    if args.night_lab:
        (game / 'night-lab.html').replace(game / 'index.html')
    files = sorted(path for path in game.rglob('*') if path.is_file())
    assert (game / 'index.html').is_file(), 'Missing first-level HTML entry'
    assert all(path.relative_to(game).parts[0] in ('index.html', 'assets') for path in files), 'Unexpected build content'
    html = (game / 'index.html').read_text()
    assert 'src="./assets/' in html and 'href="./assets/' in html, 'Entry must use relative URLs'
    suffix = '-night-lab' if args.night_lab else '-d1' if args.d1 else ''
    archive = OUTPUT / f'loststar-{version}-{commit[:7]}{suffix}-h5.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        for path in files:
            info = zipfile.ZipInfo(folder + '/' + path.relative_to(game).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            target.writestr(info, path.read_bytes(), compresslevel=9)
    metadata = {
        'game': '失物星球', 'version': version, 'sourceCommit': commit,
        'archive': str(archive.relative_to(ROOT)), 'bytes': archive.stat().st_size,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'files': len(files), 'uncompressedBytes': sum(path.stat().st_size for path in files),
        'entry': folder + '/index.html', 'orientation': 'portrait',
        'purpose': 'separate opt-in night prototype' if args.night_lab else 'D1 read-only 30s spherical night operations and four-tier receipt installation review; no save access or payment' if args.d1 else 'Single-entry H5 with shared home museum and integrated expedition day/night',
    }
    (OUTPUT / ('package-info-night.json' if args.night_lab else 'package-info-d1.json' if args.d1 else 'package-info.json')).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
