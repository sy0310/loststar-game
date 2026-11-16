"""Validate real physical art footprint, all rotations, continuity and source/export integrity."""
from pathlib import Path
from PIL import Image
import io,json,hashlib,zipfile,xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4];CONFIG=json.loads((HERE/'assets.json').read_text());CELL=CONFIG['cellPixels'];PAL=json.loads((ROOT/'design/star-salvage/v04/production/palette.json').read_text());COLORS={tuple(bytes.fromhex(x[1:]))for x in PAL['colors']}
def rotate_cells(points):
 h=max(p[1]for p in points)+1
 return[(h-1-y,x)for x,y in points]
def inspect(im,points):
 width=(max(p[0]for p in points)+1)*CELL;height=(max(p[1]for p in points)+1)*CELL;assert im.size==(width,height);mask=set(points);occupied={(x,y)for y in range(height)for x in range(width)if im.getpixel((x,y))[3]};assert occupied
 assert set(im.getchannel('A').getdata())=={0,255}
 assert {c[:3]for c in im.getdata()if c[3]}<=COLORS
 coverage=[]
 for cy in range(height//CELL):
  for cx in range(width//CELL):
   n=sum((cx*CELL+x,cy*CELL+y)in occupied for y in range(CELL)for x in range(CELL))
   if(cx,cy)in mask:assert n/(CELL*CELL)>.7;coverage.append(n/(CELL*CELL))
   else:assert n==0,'visible alpha in nonoccupied cell'
 # The only omitted physical pixels are the single whole-perimeter safety row.
 full={(x,y)for y in range(height)for x in range(width)if(x//CELL,y//CELL)in mask};solid={(x,y)for x,y in full if all((x+dx,y+dy)in full for dx,dy in[(1,0),(-1,0),(0,1),(0,-1)])};assert occupied==solid
 start=next(iter(occupied));seen={start};queue=[start]
 while queue:
  x,y=queue.pop()
  for p in[(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
   if p in occupied and p not in seen:seen.add(p);queue.append(p)
 assert seen==occupied,'physical object is disconnected'
 seams=[]
 for cx,cy in points:
  if(cx+1,cy)in mask:
   n=sum(((cx+1)*CELL-1,cy*CELL+k)in occupied and((cx+1)*CELL,cy*CELL+k)in occupied for k in range(CELL));assert n>=CELL-4;seams.append(n)
  if(cx,cy+1)in mask:
   n=sum((cx*CELL+k,(cy+1)*CELL-1)in occupied and(cx*CELL+k,(cy+1)*CELL)in occupied for k in range(CELL));assert n>=CELL-4;seams.append(n)
 return {'minimumCellCoverage':min(coverage),'maximumCellCoverage':max(coverage),'occupiedPixels':len(occupied),'nonoccupiedAlphaPixels':0,'connectedComponents':1,'minimumConnectedSeamPixels':min(seams)if seams else None}
rows=[]
for asset in CONFIG['assets']:
 name=asset['id'];mask=CONFIG['shapes'][asset['shapeId']]
 image=Image.open(HERE/('cargo_'+name+'@1x.png')).convert('RGBA');points=list(map(tuple,mask));rotated=image;turns=[]
 for turn in range(4):
  turns.append({'clockwiseQuarterTurns':turn,**inspect(rotated,points)});points=rotate_cells(points);rotated=rotated.transpose(Image.Transpose.ROTATE_270)
 assert rotated.tobytes()==image.tobytes()
 for scale in[2,4]:
  out=Image.open(ROOT/f'prototypes/salvage-route-demo/assets/v042/cargo_{name}@{scale}x.png').convert('RGBA');assert out.tobytes()==image.resize(out.size,Image.Resampling.NEAREST).tobytes();assert out.size==(image.width*scale,image.height*scale)
 with zipfile.ZipFile(HERE/('cargo_'+name+'.ora'))as z:
  assert z.read('mimetype')==b'image/openraster';xml=ET.fromstring(z.read('stack.xml'));assert (int(xml.get('w')),int(xml.get('h')))==image.size;result=Image.new('RGBA',image.size)
  for layer in reversed(xml.find('stack').findall('layer')):result.alpha_composite(Image.open(io.BytesIO(z.read(layer.get('src')))).convert('RGBA'))
  assert result.tobytes()==image.tobytes();assert Image.open(io.BytesIO(z.read('mergedimage.png'))).convert('RGBA').tobytes()==image.tobytes()
 rows.append({'asset':'cargo_'+name,'nativeSize':list(image.size),'cellPixels':CELL,'nativeColors':len({p for p in image.getdata()if p[3]}),'binaryAlpha':True,'integerExportsExact':True,'oraExact':True,'rotations':turns,'nativePixelSha256':hashlib.sha256(image.tobytes()).hexdigest()})
assert len(rows)==5;assert len({x['nativePixelSha256']for x in rows})==5
report={'schema':1,'passedAssets':5,'passedRotations':20,'scope':'Native physical footprint, alpha, palette, geometric continuity, ORA and export verification only. Not a substitute for root visual, live UI, browser or user phone acceptance.','assets':rows}
(HERE/'identity-b-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS5 whole objects /20rotations: occupied alpha>70%,empty alpha0,one physical component,continuous seams,exact2x/4x andORA')
