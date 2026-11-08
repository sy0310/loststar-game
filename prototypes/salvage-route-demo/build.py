"""Create a deterministic relative-resource H5 package; never binds or publishes it."""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,zipfile
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--freeze',action='store_true');args=ap.parse_args()
 sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 dirty=bool(subprocess.check_output(['git','status','--porcelain','--','src','index.html','build.py','assets','../../design/star-salvage/BALANCE_V01.json'],cwd=ROOT,text=True).strip())
 if args.freeze and dirty:raise SystemExit('Commit runtime and art before freezing the package')
 out=ROOT/'dist';entry=out/'loststar-salvage';entry.mkdir(parents=True,exist_ok=True)
 for folder in ['src','assets']:
  target=entry/folder
  if target.exists():shutil.rmtree(target)
  shutil.copytree(ROOT/folder,target)
 balance=json.loads((REPO/'design/star-salvage/BALANCE_V01.json').read_text())
 (entry/'src/balance.js').write_text('globalThis.LostCargoBalance='+json.dumps(balance,ensure_ascii=False,separators=(',',':'))+';\n')
 art={'ship':'./assets/ship.webp'};sources=[];missing=[]
 expected=json.loads((REPO/'design/star-salvage/SOURCE_STATUS.json').read_text())['optionalSourceArt']
 for name in ['ship','port','wreck','harbor']:
  path=entry/'assets'/(name+'.webp')
  if not path.exists():missing.append(name);continue
  raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
  if raw[:4]!=b'RIFF' or raw[8:12]!=b'WEBP':raise ValueError('Invalid WebP: '+str(path))
  if name!='ship' and digest!=next(x['sha256']for x in expected if x['name']==name+'.webp'):raise ValueError('Unverified concept crop '+name)
  art[name]='./assets/'+name+'.webp';sources.append({'path':str(path.relative_to(entry)),'bytes':len(raw),'sha256':digest})
 build={'version':'0.1.1','commit':sha,'dirty':dirty,'blindTest':True}
 html=(ROOT/'index.html').read_text().replace("const ART={ship:'./assets/ship.webp'};",'const ART='+json.dumps(art)+';window.LostCargoBuild='+json.dumps(build)+';')
 (entry/'index.html').write_text(html)
 archive=out/('loststar-salvage-'+sha[:7]+'.zip')
 with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED)as z:
  for f in sorted(entry.rglob('*')):
   if f.is_file():
    i=zipfile.ZipInfo('loststar-salvage/'+f.relative_to(entry).as_posix(),(2026,11,8,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16;z.writestr(i,f.read_bytes())
 raw=archive.read_bytes();record={'kind':'frozen_build'if args.freeze else'development_build','sourceCommit':sha,'dirtySource':dirty,'entry':'loststar-salvage/index.html','archive':archive.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'files':len(zipfile.ZipFile(archive).namelist()),'assets':sources,'missingOptionalArt':missing,'storageDatabase':'lostcargo.route-demo.v1','physicalPhoneTested':False,'blindTest':True}
 (out/'build-info.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps(record,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
