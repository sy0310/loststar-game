"""Freeze relative H5 resources; source art and historical packages are never rewritten."""
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess, zipfile, re
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--freeze',action='store_true');args=ap.parse_args()
 sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 dirty=bool(subprocess.check_output(['git','status','--porcelain','--','src','index.html','build.py','assets','../../design/star-salvage/BALANCE_V01.json','../../design/star-salvage/v04/BALANCE_V04.json','../../design/star-salvage/v041/BALANCE_V041.json'],cwd=ROOT,text=True).strip())
 if args.freeze and dirty:raise SystemExit('Commit runtime and art before freezing the package')
 out=ROOT/'dist';entry=out/'loststar-salvage';entry.mkdir(parents=True,exist_ok=True)
 for folder in ['src','assets']:
  target=entry/folder
  if target.exists():shutil.rmtree(target)
  if folder=='src':shutil.copytree(ROOT/folder,target)
  else:
   for version in ['v04','v041']:
    (target/version).mkdir(parents=True)
    for f in (ROOT/('assets/'+version)).glob('*@2x.png'):shutil.copyfile(f,target/version/f.name)
 for source,destination,name in [('design/star-salvage/BALANCE_V01.json','balance.js','LostCargoBalance'),('design/star-salvage/v041/BALANCE_V041.json','port-balance.js','LostCargoPortBalance')]:
  generated='globalThis.'+name+'='+json.dumps(json.loads((REPO/source).read_text()),ensure_ascii=False,separators=(',',':'))+';\n'
  if (ROOT/'src'/destination).read_text()!=generated:raise ValueError('Generated balance bundle is stale: '+destination)
  (entry/'src'/destination).write_text(generated)
 expected=['harbor_bg','harbor_front']+['ship_'+s for s in ['starter','cargo','scout','heavy']]+['item_'+s for s in ['metal_crate','energy_battery','nav_chip','broken_engine','medkit','fuel_can','sample','toolbox']]
 missing=[name for name in expected if not (entry/'assets/v04'/(name+'@2x.png')).is_file()]
 expected041=['ui_shop','ui_missions']+['cargo_'+x for x in ['line2','line3','square4','line4','ell3','ell4','tee4','ell5','rect6','ell7','rect8','legacy12','legacy16']]
 missing += [name for name in expected041 if not(entry/'assets/v041'/(name+'@2x.png')).is_file()]
 if args.freeze and missing:raise SystemExit('Production art missing: '+','.join(missing))
 sources=[]
 for f in sorted((entry/'assets').rglob('*.png')):
  raw=f.read_bytes()
  if raw[:8]!=b'\x89PNG\r\n\x1a\n':raise ValueError('Invalid PNG '+str(f))
  sources.append({'path':str(f.relative_to(entry)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 version=re.search(r"VERSION='([^']+)'",(ROOT/'src/engine.js').read_text()).group(1)
 build={'version':version,'commit':sha,'dirty':dirty,'blindTest':True}
 art={'ship':'./assets/v04/ship_starter@2x.png'}
 html=(ROOT/'index.html').read_text().replace("const ART={ship:'./assets/ship.webp'};",'const ART='+json.dumps(art)+';window.LostCargoBuild='+json.dumps(build)+';')
 (entry/'index.html').write_text(html)
 archive=out/('loststar-salvage-'+sha[:7]+'.zip')
 with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED)as z:
  for f in sorted(entry.rglob('*')):
   if f.is_file():
    i=zipfile.ZipInfo('loststar-salvage/'+f.relative_to(entry).as_posix(),(2026,11,9,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16;z.writestr(i,f.read_bytes())
 raw=archive.read_bytes();record={'kind':'frozen_build'if args.freeze else'development_build','sourceCommit':sha,'dirtySource':dirty,'entry':'loststar-salvage/index.html','archive':archive.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'files':len(zipfile.ZipFile(archive).namelist()),'assets':sources,'missingOptionalArt':missing,'storageDatabase':'lostcargo.route-demo.v1','physicalPhoneTested':False,'blindTest':True}
 (out/'build-info.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps(record,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
