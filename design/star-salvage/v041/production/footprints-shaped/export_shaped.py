"""Native24px/cell reconstruction of independently generated whole machine parts.
The physical alpha is repaired to a canonical solid footprint, not a UI shape
behind a central icon. No internal cell seam/line is drawn.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json,io,zipfile,hashlib,xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
PALETTE=ROOT/'design/star-salvage/v04/production/palette.json';PAL=json.loads(PALETTE.read_text());COLORS=[tuple(bytes.fromhex(x[1:]))for x in PAL['colors']]
SHAPES=json.loads((HERE/'shapes.json').read_text());CELL=SHAPES['cellPixels'];OUT=ROOT/'prototypes/salvage-route-demo/assets/v041'
def nearest(rgb):return min(COLORS,key=lambda c:sum((c[i]-rgb[i])**2for i in range(3)))
def raw_png(im):
 out=io.BytesIO();im.save(out,format='PNG',optimize=True);return out.getvalue()
def zip_entry(z,name,raw,kind=zipfile.ZIP_DEFLATED):
 info=zipfile.ZipInfo(name,(2026,11,9,0,0,0));info.external_attr=0o100644<<16;info.compress_type=kind;z.writestr(info,raw)
def silhouette(name):
 mask=SHAPES['shapes'][name];w=(max(p[0]for p in mask)+1)*CELL;h=(max(p[1]for p in mask)+1)*CELL;cells=set(map(tuple,mask));full={(x,y)for y in range(h)for x in range(w)if(x//CELL,y//CELL)in cells}
 # A single outer safe pixel, including concave perimeter. No cell partition gaps.
 solid={(x,y)for x,y in full if all((x+dx,y+dy)in full for dx,dy in[(1,0),(-1,0),(0,1),(0,-1)])}
 return w,h,full,solid
def build(name):
 stem='cargo_'+name;source=Image.open(HERE/(stem+'-generated.png')).convert('RGBA');bbox=source.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox();assert bbox
 w,h,full,solid=silhouette(name);guide=source.crop(bbox).resize((w,h),Image.Resampling.BOX);sample=[(x,y,guide.getpixel((x,y))[:3])for y in range(h)for x in range(w)if guide.getpixel((x,y))[3]>=128];assert sample
 native=Image.new('RGBA',(w,h));repaired=0
 for x,y in solid:
  p=guide.getpixel((x,y))
  if p[3]<128:
   sx,sy,rgb=min(sample,key=lambda s:(s[0]-x)**2+(s[1]-y)**2);repaired+=1
  else:rgb=p[:3]
  native.putpixel((x,y),(*nearest(rgb),255))
 # Repairs the outer physical bevel on the native grid, never a cell grid.
 for x,y in solid:
  if(x-1,y)not in solid or(x,y-1)not in solid:native.putpixel((x,y),(155,131,171,255))
  elif(x+1,y)not in solid or(x,y+1)not in solid:native.putpixel((x,y),(56,48,77,255))
 edits=HERE/(stem+'-native-edits.json')
 if edits.exists():
  draw=ImageDraw.Draw(native)
  for e in json.loads(edits.read_text()):
   color=tuple(bytes.fromhex(e['color'][1:]))+(255,)
   if'poly'in e:draw.polygon([tuple(x)for x in e['poly']],fill=color)
   elif'rect'in e:draw.rectangle(e['rect'],fill=color)
   elif'line'in e:draw.line([tuple(x)for x in e['line']],fill=color,width=e.get('width',1))
   else:draw.point(tuple(e['xy']),fill=color)
  for y in range(h):
   for x in range(w):
    if(x,y)not in solid:native.putpixel((x,y),(0,0,0,0))
 native.save(HERE/(stem+'@1x.png'),optimize=True);OUT.mkdir(parents=True,exist_ok=True)
 for scale in[2,4]:native.resize((w*scale,h*scale),Image.Resampling.NEAREST).save(OUT/(stem+'@'+str(scale)+'x.png'),optimize=True)
 groups={'warm conduit and fittings':{(117,77,80),(166,107,85),(206,139,96),(244,199,133),(255,224,166),(236,219,193)},'indicator and traces':{(53,90,112),(80,132,149),(111,174,173),(142,207,207),(183,230,220)}};layers={k:Image.new('RGBA',native.size)for k in['indicator and traces','warm conduit and fittings','one-piece metal body']}
 for y in range(h):
  for x in range(w):
   rgba=native.getpixel((x,y))
   if not rgba[3]:continue
   kind=next((k for k,values in groups.items()if rgba[:3]in values),'one-piece metal body');layers[kind].putpixel((x,y),rgba)
 xml=ET.Element('image',{'version':'0.0.3','w':str(w),'h':str(h),'name':stem});stack=ET.SubElement(xml,'stack')
 with zipfile.ZipFile(HERE/(stem+'.ora'),'w')as z:
  zip_entry(z,'mimetype','image/openraster',zipfile.ZIP_STORED);zip_entry(z,'mergedimage.png',raw_png(native))
  for i,(kind,layer)in enumerate(layers.items()):
   path='data/layer'+str(i)+'.png';zip_entry(z,path,raw_png(layer));ET.SubElement(stack,'layer',{'name':kind,'src':path,'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
  zip_entry(z,'stack.xml',ET.tostring(xml,encoding='utf-8'));zip_entry(z,'Thumbnails/thumbnail.png',raw_png(native.resize((w*2,h*2),Image.Resampling.NEAREST)))
 coverage=[]
 for cx,cy in SHAPES['shapes'][name]:coverage.append(sum(native.getpixel((cx*CELL+x,cy*CELL+y))[3]>0 for y in range(CELL)for x in range(CELL))/(CELL*CELL))
 metadata={'id':name,'nativeSize':[w,h],'cellPixels':CELL,'sourceSize':source.size,'sourceBounds':bbox,'nativeColors':len({p for p in native.getdata()if p[3]}),'nativeRepairedPixels':repaired,'nativeRepairedRatio':round(repaired/len(solid),4),'coverage':coverage,'nonOccupiedAlphaPixels':0,'borderRule':'one native pixel at whole external/concave perimeter; no cell division seams'}
 (HERE/(stem+'-reconstruction.json')).write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps(metadata));return native
if __name__=='__main__':
 import sys
 for name in sys.argv[1:]:build(name)
