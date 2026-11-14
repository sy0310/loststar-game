"""Physical cargo geometry, native sources and exports; engineering, not user art approval."""
from pathlib import Path
from PIL import Image
import hashlib,io,json,subprocess,zipfile
R=Path(__file__).resolve().parents[3];P=R/'design/star-salvage/v041/production';A=R/'prototypes/salvage-route-demo/assets/v041'
shapes=json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require('./prototypes/salvage-route-demo/src/cargo-layout.js').SHAPES))"],cwd=R))
palette={tuple(bytes.fromhex(x[1:]))for x in json.load(open(R/'design/star-salvage/v04/production/palette.json'))['colors']}
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def rec(p):return {'path':str(p.relative_to(R)),'bytes':p.stat().st_size,'sha256':h(p)}
ids=['ui_shop','ui_missions']+['cargo_'+s for s in ['line2','line3','square4','line4','ell3','ell4','tee4','ell5','rect6','ell7','rect8','legacy12','legacy16']]
rows=[]
for id in ids:
 src=list(P.rglob(id+'@1x.png'));ora=list(P.rglob(id+'.ora'));assert len(src)==len(ora)==1,id
 src=src[0];ora=ora[0];im=Image.open(src).convert('RGBA');assert {p[3]for p in im.getdata()}<={0,255};assert {p[:3]for p in im.getdata()if p[3]}<=palette
 with zipfile.ZipFile(ora)as z:assert Image.open(io.BytesIO(z.read('mergedimage.png'))).convert('RGBA').tobytes()==im.tobytes(),id
 rotations=[]
 if id.startswith('cargo_'):
  opaque={(x,y)for y in range(im.height)for x in range(im.width)if im.getpixel((x,y))[3]};seen={next(iter(opaque))};todo=list(seen)
  while todo:
   x,y=todo.pop()
   for q in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if q in opaque and q not in seen:seen.add(q);todo.append(q)
  assert seen==opaque,('multiple separate objects',id)
  mask=shapes[id[6:]];assert im.size==(24*(max(x for x,y in mask)+1),24*(max(y for x,y in mask)+1))
  for r in range(4):
   rotated=im.rotate(-90*r,expand=True);m=mask
   for _ in range(r):m=[[-y,x]for x,y in m];mx=min(x for x,y in m);my=min(y for x,y in m);m=[[x-mx,y-my]for x,y in m]
   coverage=[]
   for gy in range(rotated.height//24):
    for gx in range(rotated.width//24):
     n=sum(rotated.getpixel((gx*24+x,gy*24+y))[3]>0 for x in range(24)for y in range(24));occupied=[gx,gy]in m;assert n>=24*24*.7 if occupied else n==0,(id,r,gx,gy,n);coverage.append({'cell':[gx,gy],'occupied':occupied,'opaque':n})
   rotations.append({'rotation':r,'cells':len(m),'coverage':coverage})
 else:assert im.size==(24,24) and all(2<=n<=22 for n in im.getbbox())
 files=[src,ora]
 for scale in[2,4]:
  f=A/(id+'@'+str(scale)+'x.png');ex=Image.open(f).convert('RGBA');assert ex.size==(im.width*scale,im.height*scale) and ex.tobytes()==im.resize(ex.size,Image.Resampling.NEAREST).tobytes();files.append(f)
 rows.append({'id':id,'nativeSize':im.size,'files':[rec(p)for p in files],'paletteSubset':True,'binaryAlpha':True,'exactNearest':True,'editableMergedMatches':True,'rotations':rotations})
out=R/'prototypes/salvage-route-demo/verification/art-v041.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps({'scope':'15 new production assets,13 physical bodies×4 rotations, not user art or phone acceptance','passed':15,'physicalRotations':52,'assets':rows},ensure_ascii=False,indent=2)+'\n');print('PASS15 native/editable/2x/4x assets;52 physical rotations exactly follow occupied cells')
