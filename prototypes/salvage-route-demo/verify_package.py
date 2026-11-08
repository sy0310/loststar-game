"""Inspect and extract the exact ZIP that will be uploaded, with path/asset checks."""
from pathlib import Path
import hashlib,json,re,shutil,sys,zipfile
root=Path(__file__).resolve().parent
info=json.loads((root/'dist/build-info.json').read_text())
archive=root/'dist'/info['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest()==info['sha256']
assert archive.stat().st_size==info['bytes']
target=Path(sys.argv[1] if len(sys.argv)>1 else root/'verification/extracted').resolve()
if target.exists():shutil.rmtree(target)
target.mkdir(parents=True)
with zipfile.ZipFile(archive) as z:
    assert len(z.namelist())==info['files']
    for name in z.namelist():
        assert not name.startswith('/') and '..' not in Path(name).parts
        assert name.startswith('loststar-salvage/')
    z.extractall(target)
entry=target/'loststar-salvage'
html=(entry/'index.html').read_text()
assert info['sourceCommit'] in html
assert '"dirty": false' in html or info['dirtySource']
for uri in re.findall(r'(?:src|href)="(\./[^"]+)"',html):
    assert (entry/uri).is_file(),uri
for asset in info['assets']:
    assert hashlib.sha256((entry/asset['path']).read_bytes()).hexdigest()==asset['sha256']
assert (entry/'src/store.js').is_file()
record={**info,'inspection':'PASS','extracted':str(target),'zipSlips':0,'relativeResourcesPresent':True,'browserRunSeparate':True}
(root/'verification/package-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
