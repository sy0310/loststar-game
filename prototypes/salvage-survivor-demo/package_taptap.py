"""Wrap a verified immutable web build in TapTap's single game directory."""
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--folder', default='artifacts/survivor-v061/current')
args=parser.parse_args()
folder=ROOT/args.folder
info = json.loads((folder / 'build-info.json').read_text())
source = folder / info['archive']
assert hashlib.sha256(source.read_bytes()).hexdigest() == info['sha256']
assert not info['dirty']
expected = {item['path']: item for item in info['files']}
name = f"loststar-survivor-{info['sourceCommit'][:7]}-taptap.zip"
archive = folder / name
extract = ROOT / 'releases' / f"survivor-v061-taptap-{info['sourceCommit'][:7]}"
with zipfile.ZipFile(source) as original, zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as wrapped:
    assert set(original.namelist()) == set(expected)
    for path, record in sorted(expected.items()):
        raw = original.read(path)
        assert len(raw) == record['bytes']
        assert hashlib.sha256(raw).hexdigest() == record['sha256']
        entry = zipfile.ZipInfo('loststar-survivor/' + path, (2026, 11, 11, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        wrapped.writestr(entry, raw, compresslevel=9)
        target = extract / entry.filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
with zipfile.ZipFile(archive) as check:
    assert len(check.namelist()) == info['fileCount']
    assert {path.split('/')[0] for path in check.namelist()} == {'loststar-survivor'}
    assert 'loststar-survivor/index.html' in check.namelist()
    assert all(check.read('loststar-survivor/' + path) == (extract / 'loststar-survivor' / path).read_bytes() for path in expected)
report = {'schema': 1, 'sourceCommit': info['sourceCommit'], 'archive': name, 'bytes': archive.stat().st_size,
          'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'fileCount': info['fileCount'], 'pngCount': info['pngCount'],
          'prefix': 'loststar-survivor/', 'payloadUnchanged': True, 'originalArchiveSha256': info['sha256'],
          'files': [{'path': 'loststar-survivor/' + path, **{key: value for key, value in record.items() if key != 'path'}} for path, record in sorted(expected.items())]}
(folder / 'taptap-build-info.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: value for key, value in report.items() if key != 'files'}))
print(str(extract))
