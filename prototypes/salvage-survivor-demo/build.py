"""Build a deterministic standalone H5 archive from the current survivor sources."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from sync_runtime import generated

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--freeze', action='store_true')
    args = parser.parse_args()
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    relevant = [str(HERE.relative_to(ROOT)), 'design/star-salvage/v06/BALANCE_V06.json', 'design/star-salvage/v06/production', 'design/star-salvage/v061', 'design/star-salvage/v062', 'design/star-salvage/v063', 'design/star-salvage/v064', 'design/star-salvage/v065', 'design/star-salvage/v066', 'design/star-salvage/v067', 'design/star-salvage/v068', 'design/star-salvage/v069']
    dirty_paths = subprocess.check_output(['git', 'status', '--porcelain', '--', *relevant], cwd=ROOT, text=True).strip()
    dirty = bool(dirty_paths)
    if args.freeze and dirty:
        raise RuntimeError('Commit survivor runtime and art before freezing a delivery package\n' + dirty_paths)
    derived, catalog = generated()
    for path, expected in derived.items():
        if path.read_text() != expected:
            raise RuntimeError('Run sync_runtime.py before building')
    runtime = [HERE / 'index.html', *sorted((HERE / 'src').glob('*')), *[HERE / entry['src'][2:] for entry in catalog.values()], *sorted((HERE / 'assets/audio').glob('*.mp3'))]
    payload = {}
    source_files = []
    for path in sorted(runtime):
        raw = path.read_bytes()
        source_files.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': len(raw), 'sha256': digest(raw)})
        if path.name == 'index.html':
            stamp = {'version': '0.6.9', 'commit': commit, 'dirty': dirty}
            raw = re.sub(r'window.SurvivorBuild = \{.*?\};', 'window.SurvivorBuild = ' + json.dumps(stamp) + ';', raw.decode(), flags=re.S).encode()
        payload[path.relative_to(HERE).as_posix()] = raw
    if len(payload) != 84 or sum(name.endswith('.png') for name in payload) != 74 or sum(name.endswith('.mp3') for name in payload) != 2:
        raise RuntimeError('Unexpected runtime inventory')
    output = HERE / 'dist'
    output.mkdir(exist_ok=True)
    folder = output / 'loststar-survivor'
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir()
    archive = output / f'loststar-survivor-{commit[:7]}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for name, raw in sorted(payload.items()):
            target = folder / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            info = zipfile.ZipInfo(name, (2026, 11, 11, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zipped.writestr(info, raw, compresslevel=9)
    report = {'version': '0.6.9', 'sourceCommit': commit, 'dirty': dirty, 'archive': archive.name,
              'bytes': archive.stat().st_size, 'sha256': digest(archive.read_bytes()),
              'fileCount': len(payload), 'pngCount': sum(name.endswith('.png') for name in payload), 'uncompressedBytes': sum(map(len, payload.values())),
              'files': [{'path': name, 'bytes': len(raw), 'sha256': digest(raw)} for name, raw in sorted(payload.items())],
              'sourceFiles': source_files}
    (output / 'build-info.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key not in ('files', 'sourceFiles')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
