#!/usr/bin/env python3
"""Build a relocatable TapTap H5 archive: one loststar/ directory at ZIP root."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'releases' / 'taptap'
GAME = OUTPUT / 'loststar'


def main():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    subprocess.run(['npm', 'run', 'build', '--', '--base=./', '--outDir=releases/taptap/loststar'], cwd=ROOT, check=True)
    files = sorted(path for path in GAME.rglob('*') if path.is_file())
    assert (GAME / 'index.html').is_file(), 'Missing first-level HTML entry'
    assert all(path.relative_to(GAME).parts[0] in ('index.html', 'assets') for path in files), 'Unexpected build content'
    html = (GAME / 'index.html').read_text()
    assert 'src="./assets/' in html and 'href="./assets/' in html, 'Entry must use relative URLs'
    archive = OUTPUT / f'loststar-{version}-{commit[:7]}-h5.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        for path in files:
            info = zipfile.ZipInfo('loststar/' + path.relative_to(GAME).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            target.writestr(info, path.read_bytes(), compresslevel=9)
    metadata = {
        'game': '失物星球', 'version': version, 'sourceCommit': commit,
        'archive': str(archive.relative_to(ROOT)), 'bytes': archive.stat().st_size,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'files': len(files), 'uncompressedBytes': sum(path.stat().st_size for path in files),
        'entry': 'loststar/index.html', 'orientation': 'portrait',
    }
    (OUTPUT / 'package-info.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
