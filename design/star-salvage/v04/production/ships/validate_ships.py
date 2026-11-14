"""Verify native grid, shared palette, binary alpha, margins, ORA and NN exports."""
from pathlib import Path
from PIL import Image
import json,io,zipfile,xml.etree.ElementTree as ET,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
palette=json.loads((HERE.parent/'palette.json').read_text());colors={tuple(bytes.fromhex(x[1:]))for x in palette['colors']}
rows=[]
for name in ['starter','cargo','scout','heavy']:
 stem='ship_'+name;src=Image.open(HERE/(stem+'@1x.png')).convert('RGBA')
 assert src.size==(96,48)
 assert set(src.getchannel('A').getdata())=={0,255}
 assert {p[:3]for p in src.getdata()if p[3]}<=colors
 box=src.getbbox();assert box[0]>0 and box[1]>0 and box[2]<96 and box[3]==43,box
 for scale in [2,4]:
  exported=Image.open(ROOT/f'prototypes/salvage-route-demo/assets/v04/{stem}@{scale}x.png').convert('RGBA')
  assert exported.size==(96*scale,48*scale)
  assert exported.tobytes()==src.resize(exported.size,Image.Resampling.NEAREST).tobytes()
 with zipfile.ZipFile(HERE/(stem+'.ora'))as z:
  assert z.read('mimetype')==b'image/openraster';root=ET.fromstring(z.read('stack.xml'));assert root.get('w')=='96'and root.get('h')=='48'
  recomposed=Image.new('RGBA',src.size)
  for layer in reversed(root.find('stack').findall('layer')):recomposed.alpha_composite(Image.open(io.BytesIO(z.read(layer.get('src')))).convert('RGBA'))
  assert recomposed.tobytes()==src.tobytes()
  assert Image.open(io.BytesIO(z.read('mergedimage.png'))).convert('RGBA').tobytes()==src.tobytes()
 rows.append({'asset':stem,'nativeSize':[96,48],'nativeColors':len({p for p in src.getdata()if p[3]}),'nativeBounds':box,'contactY':42,'binaryAlpha':True,'palette':palette['id'],'integerExportsMatch':True,'oraRoundTrip':True,'opaquePixels':sum(1 for p in src.getdata()if p[3]),'nativePixelSha256':hashlib.sha256(src.tobytes()).hexdigest()})
assert len({r['nativePixelSha256']for r in rows})==4
report={'passed':4,'scope':'Source/export/material-layer verification. Browser decoding and in-scene placement remain for root integration; not user visual acceptance.','assets':rows}
(HERE/'ship-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
