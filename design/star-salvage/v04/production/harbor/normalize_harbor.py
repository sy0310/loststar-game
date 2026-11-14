"""Convert original generated candidate to shared 1x palette, then export exact integer pixels."""
from pathlib import Path
import json,hashlib,zipfile,io
from PIL import Image,ImageDraw
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[4]
RUNTIME=REPO/'prototypes/salvage-route-demo/assets/v04'
colors=json.loads((ROOT.parent/'palette.json').read_text())['colors']
rgb=[tuple(bytes.fromhex(c.lstrip('#'))) for c in colors]
palette=Image.new('P',(1,1));palette.putpalette([v for i in range(256)for v in rgb[min(i,len(rgb)-1)]])
def ora(name,img):
    buf=io.BytesIO();img.save(buf,format='PNG')
    image=ET.Element('image',{'w':str(img.width),'h':str(img.height),'name':name,'version':'0.0.3'})
    stack=ET.SubElement(image,'stack');ET.SubElement(stack,'layer',{'name':name+' native editable pixels','src':'data/layer000.png','opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
    with zipfile.ZipFile(ROOT/'source'/(name+'.ora'),'w')as z:
        z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',ET.tostring(image));z.writestr('data/layer000.png',buf.getvalue());z.writestr('mergedimage.png',buf.getvalue())
def export(name,source,alpha=False):
    source.save(ROOT/'source'/(name+'@1x.png'));ora(name,source)
    for scale in (2,4):source.resize((192*scale,320*scale),Image.Resampling.NEAREST).save(RUNTIME/(name+'@'+str(scale)+'x.png'))
if __name__=='__main__':
    im=Image.open(ROOT/'raw/harbor_bg-generated.png').convert('RGB').resize((192,320),Image.Resampling.BOX).quantize(palette=palette,dither=Image.Dither.NONE).convert('RGB')
    # Align key signal-lamp and pavement highlights to the 1x grid. No conceptual art pixels are used.
    d=ImageDraw.Draw(im)
    for x,y in [(22,121),(66,102),(90,67),(139,88),(174,109)]:
        if 0<=x<192 and 0<=y<320:d.point((x,y),fill='#FFE0A6')
    export('harbor_bg',im)
    front=Image.open(ROOT/'raw/harbor_front-generated.png').convert('RGBA').resize((192,320),Image.Resampling.BOX)
    # Re-align the generated right bollard 8 native pixels so its lamp is not clipped by the CTA-safe center.
    aligned=Image.new('RGBA',(192,320));aligned.alpha_composite(front.crop((0,280,40,320)),(0,280));aligned.alpha_composite(front.crop((140,280,192,320)),(148,280));front=aligned
    clean_rgb=front.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGB')
    alpha=front.getchannel('A').point(lambda a:255 if a>=96 else 0)
    ad=ImageDraw.Draw(alpha);ad.rectangle((0,0,191,279),fill=0);ad.rectangle((40,0,152,319),fill=0)
    clean_rgb.putalpha(alpha)
    # Fully transparent colors are canonicalized, leaving no hidden matte data.
    pixels=clean_rgb.load()
    for y in range(320):
        for x in range(192):
            if pixels[x,y][3]==0:pixels[x,y]=(0,0,0,0)
    export('harbor_front',clean_rgb,True)
    preview=im.convert('RGBA');preview.alpha_composite(clean_rgb);preview.resize((384,640),Image.Resampling.NEAREST).save(ROOT/'harbor-layer-preview@2x.png')
