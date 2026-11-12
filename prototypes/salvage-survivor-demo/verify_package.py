"""Verify and extract the exact H5 ZIP. No remote or generated fallback resources."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
report = json.loads((HERE / 'dist/build-info.json').read_text())
archive = HERE / 'dist' / report['archive']
assert archive.stat().st_size == report['bytes']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == report['sha256']
target = Path(sys.argv[1] if len(sys.argv) > 1 else 'releases/survivor-v06-extracted').resolve()
expected = {item['path']: item for item in report['files']}
with zipfile.ZipFile(archive) as zipped:
    assert len(zipped.namelist()) == report['fileCount'] == 78
    assert set(zipped.namelist()) == set(expected)
    for name in zipped.namelist():
        assert not name.startswith('/') and '..' not in Path(name).parts
        raw = zipped.read(name)
        assert len(raw) == expected[name]['bytes']
        assert hashlib.sha256(raw).hexdigest() == expected[name]['sha256']
        path = target / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
html = (target / 'index.html').read_text()
for resource in re.findall(r'(?:src|href)="([^"#]+)"', html):
    assert not resource.startswith(('http', '//', 'data:'))
    assert (target / resource).is_file(), resource
assert report['sourceCommit'] in html
assert 'lostcargo.route-demo.v1' not in (target / 'src/persistence.js').read_text()
print(json.dumps({'verifiedFiles': len(expected), 'pngCount': report['pngCount'], 'sourceCommit': report['sourceCommit'], 'sha256': report['sha256'], 'extract': str(target)}))
