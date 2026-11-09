"""Compare every payload served at a real HTTP entry with an already-frozen ZIP."""
import argparse, hashlib, json, urllib.request, zipfile
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--info',type=Path,required=True)
p.add_argument('--url',required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
assert a.url.startswith(('http://127.0.0.1:', 'http://localhost:')) and a.url.endswith('/')
b=json.loads(a.info.read_text())
zpath=a.info.parent/b['archive']
digest=lambda raw:hashlib.sha256(raw).hexdigest()
assert zpath.stat().st_size==b['bytes'] and digest(zpath.read_bytes())==b['sha256']
files=[]
with zipfile.ZipFile(zpath) as z:
    assert len(z.namelist())==b['files']
    for name in sorted(z.namelist()):
        assert name.startswith('loststar-salvage/') and '..' not in Path(name).parts
        raw=z.read(name)
        with urllib.request.urlopen(a.url+name.removeprefix('loststar-salvage/'),timeout=15) as response:
            served=response.read()
            assert response.status==200 and served==raw,name
        files.append(dict(path=name,bytes=len(raw),sha256=digest(raw),status=200))
result=dict(sourceCommit=b['sourceCommit'],zipSha256=b['sha256'],
            entry=a.url,allHttpBytesMatchZip=True,files=files)
a.output.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text(json.dumps(result,indent=2)+'\n')
print('PASS',len(files),'actual HTTP payloads match frozen ZIP',b['sourceCommit'])
