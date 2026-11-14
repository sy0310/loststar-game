"""Validate native editable production and exact integer exports; not visual acceptance."""
from pathlib import Path
from PIL import Image,ImageChops
import hashlib,io,json,zipfile
R=Path(__file__).resolve().parents[3];P=R/'design/star-salvage/v04/production';A=R/'prototypes/salvage-route-demo/assets/v04'
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
palette={tuple(bytes.fromhex(v[1:])) for v in json.loads((P/'palette.json').read_text())['colors']}
ids=['harbor_bg','harbor_front']+['ship_'+s for s in ['starter','cargo','scout','heavy']]+['item_'+s for s in ['metal_crate','energy_battery','nav_chip','broken_engine','medkit','fuel_can','sample','toolbox']]
rows=[]
for id in ids:
 native=list(P.rglob(id+'@1x.png'));assert len(native)==1,id
 src=native[0];im=Image.open(src).convert('RGBA');size=(192,320) if id.startswith('harbor') else (96,48) if id.startswith('ship') else (24,24);assert im.size==size
 assert {p[3] for p in im.getdata()} <= {0,255},id
 assert {p[:3] for p in im.getdata() if p[3]} <= palette,id
 ora=src.with_name(id+'.ora');assert ora.is_file()
 with zipfile.ZipFile(ora) as z:assert Image.open(io.BytesIO(z.read('mergedimage.png'))).convert('RGBA').tobytes()==im.tobytes()
 if id.startswith('item'):
  box=im.getbbox();assert box[0]>=2 and box[1]>=2 and box[2]<=22 and box[3]<=22
 paths=[src,ora]
 for n in [2,4]:
  f=A/(id+'@'+str(n)+'x.png');exp=Image.open(f).convert('RGBA');assert exp.size==(size[0]*n,size[1]*n);assert exp.tobytes()==im.resize(exp.size,Image.Resampling.NEAREST).tobytes(),id;paths.append(f)
 rows.append({'id':id,'nativeSize':size,'paletteSubset':True,'binaryAlpha':True,'exactNearest':True,'editableMergedMatches':True,'files':[{'path':str(f.relative_to(R)),'bytes':f.stat().st_size,'sha256':h(f)}for f in paths]})
ref=R/'design/star-salvage/v04/concepts/salvage_v04_approved_full.png';assert h(ref)=='16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0'
out=R/'prototypes/salvage-route-demo/verification/port-art.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps({'scope':'Engineering checks, not final visual or physical phone approval','approvedReferenceSha256':h(ref),'passed':len(rows),'assets':rows},ensure_ascii=False,indent=2)+'\n');print('PASS14 native/editable/2x/4x production assets, shared palette, alpha and exact NEAREST')
