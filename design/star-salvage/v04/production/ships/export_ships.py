"""Reconstruct palette-native96x48 ship masters from independent generated studies.
RGBA coverage, shared-palette assignment and explicit native-pixel corrections are
recorded; integer exports and editable ORA are byte-checked. No concept cropping.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,io,zipfile,xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[4]
OUT=REPO/'prototypes/salvage-route-demo/assets/v04'
PAL=json.loads((HERE.parent/'palette.json').read_text())
COLORS=[tuple(bytes.fromhex(c[1:])) for c in PAL['colors']]

def nearest(rgb):
 return min(COLORS,key=lambda c:sum((c[i]-rgb[i])**2 for i in range(3)))
def png(im):
 b=io.BytesIO();im.save(b,format='PNG',optimize=True);return b.getvalue()
def write_entry(z,name,data,compression=zipfile.ZIP_DEFLATED):
 info=zipfile.ZipInfo(name,(2026,11,9,0,0,0));info.external_attr=0o100644<<16;info.compress_type=compression;z.writestr(info,data)
def reconstruct(stem):
 source=Image.open(HERE/(stem+'-generated.png')).convert('RGBA')
 alpha=source.getchannel('A').point(lambda x:255 if x>=160 else 0)
 bbox=alpha.getbbox();assert bbox
 cut=source.crop(bbox)
 scale=min(90/cut.width,39/cut.height)
 size=(max(1,round(cut.width*scale)),max(1,round(cut.height*scale)))
 small=cut.resize(size,Image.Resampling.BOX)
 native=Image.new('RGBA',(96,48));x=(96-size[0])//2;y=43-size[1]
 for sy in range(size[1]):
  for sx in range(size[0]):
   r,g,b,a=small.getpixel((sx,sy))
   if a>=112:native.putpixel((sx+x,sy+y),(*nearest((r,g,b)),255))
 # Native-grid edit instructions are explicit and preserved separately from the study.
 patch=HERE/(stem+'-native-edits.json')
 if patch.exists():
  draw=ImageDraw.Draw(native)
  for edit in json.loads(patch.read_text()):
   color=tuple(bytes.fromhex(edit['color'][1:]))+(255,) if edit['color'] else (0,0,0,0)
   if 'poly'in edit:draw.polygon([tuple(x)for x in edit['poly']],fill=color)
   elif 'rect'in edit:draw.rectangle(edit['rect'],fill=color)
   else:draw.point(edit['xy'],fill=color)
 native.save(HERE/(stem+'@1x.png'),optimize=True)
 OUT.mkdir(parents=True,exist_ok=True)
 for scale in [2,4]:native.resize((96*scale,48*scale),Image.Resampling.NEAREST).save(OUT/(stem+'@'+str(scale)+'x.png'),optimize=True)
 # Editable material layers at the native grid, exact recomposition of final master.
 groups={'windows':{(53,90,112),(80,132,149),(111,174,173),(142,207,207),(183,230,220)},'warm markings':{(117,77,80),(166,107,85),(206,139,96),(244,199,133),(255,224,166),(236,219,193)}}
 layers={k:Image.new('RGBA',native.size)for k in ['windows','warm markings','hull and landing gear']}
 for py in range(48):
  for px in range(96):
   color=native.getpixel((px,py))
   if not color[3]:continue
   group=next((name for name,colors in groups.items()if color[:3]in colors),'hull and landing gear')
   layers[group].putpixel((px,py),color)
 image=ET.Element('image',{'version':'0.0.3','w':'96','h':'48','name':stem});stack=ET.SubElement(image,'stack')
 with zipfile.ZipFile(HERE/(stem+'.ora'),'w')as z:
  write_entry(z,'mimetype','image/openraster',zipfile.ZIP_STORED)
  write_entry(z,'mergedimage.png',png(native))
  for i,(name,im)in enumerate(layers.items()):
   target='data/layer'+str(i)+'.png';write_entry(z,target,png(im));ET.SubElement(stack,'layer',{'name':name,'src':target,'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
  write_entry(z,'stack.xml',ET.tostring(image,encoding='utf-8'));write_entry(z,'Thumbnails/thumbnail.png',png(native.resize((192,96),Image.Resampling.NEAREST)))
 assert set(native.getchannel('A').getdata())<={0,255}
 assert {p[:3]for p in native.getdata()if p[3]}<=set(COLORS)
 return {'sourceBounds':bbox,'nativeObjectBounds':native.getbbox(),'generatedSize':source.size,'nativeColors':len({p for p in native.getdata()if p[3]})}
if __name__=='__main__':
 import sys
 for stem in sys.argv[1:]:print(stem,json.dumps(reconstruct(stem)))
