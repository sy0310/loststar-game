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
    parser.set_defaults(mode='game')
    modes.add_argument('--night-lab', dest='mode', action='store_const', const='night', help='Package the separate, default-off night prototype')
    modes.add_argument('--d1', dest='mode', action='store_const', const='d1', help='Package the read-only D1 art/motion review, without touching real saves')
    modes.add_argument('--v034', dest='mode', action='store_const', const='week1', help='Package the isolated week-one design review')
    modes.add_argument('--fusion', dest='mode', action='store_const', const='fusion', help='Package integrated exploration, collection and base playtest')
    args = parser.parse_args()
    profiles = {
        'fusion': ('loststar-fusion', 'vite.fusion.config.ts', '-fusion', 'package-info-fusion.json', 'Integrated tap-assisted exploration, collection and base development playtest; independent migrated archive'),
        'game': ('loststar', None, '', 'package-info.json', 'Single-entry H5 with shared home museum and integrated expedition day/night'),
        'night': ('loststar-night', 'vite.night.config.ts', '-night-lab', 'package-info-night.json', 'separate opt-in night prototype'),
        'd1': ('loststar-d1', 'vite.d1.config.ts', '-d1', 'package-info-d1.json', 'D1 read-only spherical night operations and receipt capability comparison; no save access or payment'),
        'week1': ('loststar-week1', 'vite.v034.config.ts', '-week1', 'package-info-v034.json', 'Week-one isolated design review, artifact restoration and evidence-based identification, spherical night events and resident routines; no player save access'),
    }
    folder, config, suffix, metadata_name, purpose = profiles[args.mode]
    game = OUTPUT / folder
    version = json.loads((ROOT / 'package.json').read_text())['version']
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if config:
        subprocess.run(['npx', 'tsc', '--noEmit'], cwd=ROOT, check=True)
    command = ['npx', 'vite', 'build', '--config', config] if config else ['npm', 'run', 'build', '--']
    subprocess.run(command + ['--base=./', '--outDir=releases/taptap/' + folder], cwd=ROOT, check=True)
    if args.mode == 'night':
        (game / 'night-lab.html').replace(game / 'index.html')
    files = sorted(path for path in game.rglob('*') if path.is_file())
    assert (game / 'index.html').is_file(), 'Missing first-level HTML entry'
    assert all(path.relative_to(game).parts[0] in ('index.html', 'assets') for path in files), 'Unexpected build content'
    html = (game / 'index.html').read_text()
    assert 'src="./assets/' in html and 'href="./assets/' in html, 'Entry must use relative URLs'
    archive = OUTPUT / f'loststar-{version}-{commit[:7]}{suffix}-h5.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        for path in files:
            info = zipfile.ZipInfo(folder + '/' + path.relative_to(game).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            target.writestr(info, path.read_bytes(), compresslevel=9)
    metadata = {
        'fusion': ('loststar-fusion', 'vite.fusion.config.ts', '-fusion', 'package-info-fusion.json', 'Integrated tap-assisted exploration, collection and base development playtest; independent migrated archive'),
        'game': '失物星球', 'version': version, 'sourceCommit': commit,
        'archive': str(archive.relative_to(ROOT)), 'bytes': archive.stat().st_size,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'files': len(files), 'uncompressedBytes': sum(path.stat().st_size for path in files),
        'entry': folder + '/index.html', 'orientation': 'portrait',
        'purpose': purpose,
    }
    (OUTPUT / metadata_name).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
