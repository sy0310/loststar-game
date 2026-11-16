"""Semantic clean/quantize generated candidates to shared24x24 native sprites; exact integer exports."""
from pathlib import Path
import json,io,zipfile,xml.etree.ElementTree as ET
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parents[4];RUNTIME=REPO/'prototypes/salvage-route-demo/assets/v041'
palette_path=REPO/'design/star-salvage/v04/production/palette.json';colors=json.loads(palette_path.read_text())['colors'];rgb=[tuple(bytes.fromhex(c[1:]))for c in colors];palette=Image.new('P',(1,1));palette.putpalette([v for i in range(256)for v in rgb[min(i,len(rgb)-1)]])
def ora(name,image):
    data=io.BytesIO();image.save(data,format='PNG');root=ET.Element('image',{'w':'24','h':'24','name':name,'version':'0.0.3'});stack=ET.SubElement(root,'stack');ET.SubElement(stack,'layer',{'name':'Native24px cleaned editable sprite','src':'data/layer000.png','opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
    with zipfile.ZipFile(ROOT/'source'/(name+'.ora'),'w')as z:
        z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',ET.tostring(root));z.writestr('data/layer000.png',data.getvalue());z.writestr('mergedimage.png',data.getvalue())
records=[]
for name in ['ui_shop','ui_missions']:
    original=Image.open(ROOT/'raw'/(name+'-generated.png')).convert('RGBA');mask=original.getchannel('A').point(lambda a:255 if a>=96 else 0);bbox=mask.getbbox();assert bbox
    cropped=original.crop(bbox);ratio=min(20/cropped.width,20/cropped.height);size=(max(1,round(cropped.width*ratio)),max(1,round(cropped.height*ratio)))
    crop=cropped.resize(size,Image.Resampling.BOX);alpha=crop.getchannel('A').point(lambda a:255 if a>=96 else 0);im=crop.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');im.putalpha(alpha)
    native=Image.new('RGBA',(24,24));offset=((24-size[0])//2,(24-size[1])//2);native.alpha_composite(im,offset)
    p=native.load()
    for y in range(24):
        for x in range(24):
            if p[x,y][3]==0:p[x,y]=(0,0,0,0)
    native.save(ROOT/'source'/(name+'@1x.png'));ora(name,native)
    for scale in (2,4):native.resize((24*scale,24*scale),Image.Resampling.NEAREST).save(RUNTIME/(name+'@'+str(scale)+'x.png'))
    records.append({'id':name,'generatedRawBBox':list(bbox),'normalizedObjectSize':list(size),'nativeOffset':list(offset),'nativeBBox':list(native.getbbox())})
(ROOT/'normalization-records.json').write_text(json.dumps(records,indent=2)+'\n')
# Side-by-side native2x overview alongside existing crate for actual scale comparison; no new artwork.
crate=Image.open(REPO/'prototypes/salvage-route-demo/assets/v04/item_metal_crate@2x.png').convert('RGBA');sheet=Image.new('RGB',(216,94),'#242039');d=ImageDraw.Draw(sheet)
for x,name,label in [(12,'crate','CRATE'),(84,'ui_shop','SHOP'),(156,'ui_missions','TASK')]:
    icon=crate if name=='crate'else Image.open(RUNTIME/(name+'@2x.png')).convert('RGBA');sheet.paste(icon,(x,12),icon);d.text((x,70),label,fill='#F4C785')
sheet.save(ROOT/'icons-overview@2x.png');sheet.resize((648,282),Image.Resampling.NEAREST).save(ROOT/'icons-overview-large.png')
print('Normalized2 independent generated24px icons;2px safe edge; shared palette;2x/4x NEAREST.')
