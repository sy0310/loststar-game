"""Read every member of the fixed ZIP through a real HTTP entry."""
from pathlib import Path
import argparse
import hashlib
import json
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--folder', default='artifacts/salvage-v05')
parser.add_argument('--out')
args = parser.parse_args()
folder = ROOT / args.folder
build = json.loads((folder / 'build-info.json').read_text())
rows = []
with zipfile.ZipFile(folder / build['archive']) as archive:
    for name in archive.namelist():
        relative = name.removeprefix('loststar-salvage/')
        with urllib.request.urlopen(args.url.rstrip('/')+'/'+relative, timeout=15) as response:
            data = response.read()
            assert response.status == 200 and data == archive.read(name), name
            rows.append(dict(path=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), status=response.status))
report = dict(sourceCommit=build['sourceCommit'], zipSha256=build['sha256'],
              baseUrl=args.url, allHttpBytesMatchZip=True, files=rows)
(ROOT / args.out if args.out else folder / 'package-http.json').write_text(json.dumps(report, indent=2)+'\n')
print('Verified', len(rows), 'actual HTTP payloads against frozen ZIP')
