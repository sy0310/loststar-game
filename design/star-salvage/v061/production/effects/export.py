"""Additive v061 native pixel icons and transparent VFX.

Accepted v06 files are checked read-only before and after export. Icons extend
our deterministic pixel vocabulary. Four VFX original atlases were made with
built-in imagegen and are retained with their full prompts under generated.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import io
import json
import math
import xml.etree.ElementTree as ET
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
SOURCE=HERE/'source'
RUNTIME=ROOT/'prototypes/salvage-survivor-demo/assets/v061'
SOURCE.mkdir(exist_ok=True)
RUNTIME.mkdir(parents=True,exist_ok=True)
PALETTE=json.loads((ROOT/'design/star-salvage/v06/production/weapons/palette.json').read_text())['colors']
COLORS={key:tuple(bytes.fromhex(value[1:]))+(255,)for key,value in PALETTE.items()}

class Pixel:
    def __init__(self,size=(24,24)):
        self.im=Image.new('RGBA',size)
        self.d=ImageDraw.Draw(self.im)
    def rect(self,box,color):self.d.rectangle(box,fill=COLORS[color])
    def poly(self,points,color):self.d.polygon(points,fill=COLORS[color])
    def line(self,points,color,width=1):self.d.line(points,fill=COLORS[color],width=width)
    def point(self,xy,color):self.d.point(xy,fill=COLORS[color])


def prism(p):
    p.line([(12,13),(4,3)],'blue')
    p.line([(12,13),(12,1)],'ice')
    p.line([(12,13),(20,3)],'violet')
    p.poly([(12,4),(21,15),(12,21),(3,15)],'ink')
    p.poly([(12,5),(19,15),(12,18),(5,15)],'blueDark')
    p.poly([(12,6),(12,13),(6,15)],'blue')
    p.poly([(12,6),(18,15),(12,13)],'shade')
    p.poly([(6,15),(12,13),(18,15),(12,17)],'teal')
    p.line([(12,7),(8,12),(7,14)],'ice')
    p.line([(12,8),(12,13),(16,15)],'iceLight')
    p.line([(14,9),(17,14)],'violet')
    p.poly([(3,12),(5,11),(5,16),(9,18),(8,20),(3,17)],'ink')
    p.poly([(4,12),(4,16),(8,18),(7,19),(4,17)],'metal')
    p.line([(4,12),(4,16),(8,18)],'light')
    p.poly([(21,12),(19,11),(19,16),(15,18),(16,20),(21,17)],'ink')
    p.poly([(20,12),(20,16),(16,18),(17,19),(20,17)],'shade')
    p.point((20,12),'silver')
    p.rect((3,14,6,15),'bronze');p.line([(3,14),(5,14)],'warm')
    p.rect((18,14,21,15),'bronze');p.line([(18,14),(20,14)],'gold')
    p.rect((7,19,17,21),'ink')
    p.rect((8,20,16,20),'bronze')
    p.line([(8,19),(16,19)],'silver')
    p.point((8,20),'warm');p.point((16,20),'gold')
    p.point((12,22),'ice')


def gravity(p):
    p.poly([(7,3),(17,3),(21,7),(21,16),(17,20),(7,20),(3,16),(3,7)],'ink')
    p.poly([(7,4),(17,4),(20,7),(20,16),(17,19),(7,19),(4,16),(4,7)],'metal')
    p.line([(7,4),(16,4)],'light')
    p.line([(4,7),(4,15),(7,18)],'silver')
    p.line([(20,8),(20,16),(17,19)],'shade')
    p.poly([(9,6),(15,6),(18,9),(18,14),(15,17),(9,17),(6,14),(6,9)],'deep')
    p.line([(9,6),(15,6),(17,8)],'shade')
    p.line([(6,10),(6,14),(9,17)],'body')
    for x,y in [(10,6),(14,6),(17,9),(17,14),(14,17),(9,17),(6,13),(6,9)]:
        p.point((x,y),'gold')
    p.line([(10,8),(14,8),(16,10),(15,13),(13,15)],'violet')
    p.line([(9,10),(9,13),(11,15),(14,14),(15,12),(14,10),(12,10),(11,11)],'blue')
    p.point((9,10),'ice')
    p.rect((10,2,14,6),'bronze');p.line([(10,2),(14,2)],'warm')
    p.rect((10,17,14,22),'bronze');p.rect((11,18,13,20),'warm')
    p.rect((2,9,6,13),'bronze');p.rect((18,9,22,13),'bronze')
    p.rect((3,10,4,12),'gold');p.rect((19,10,20,12),'gold')
    p.line([(3,9),(5,9)],'warm');p.line([(19,9),(21,9)],'gold')
    p.rect((11,11,13,13),'deep')
    p.point((12,11),'paleViolet')
    p.point((12,12),'blue')


def refraction(p):
    p.rect((5,17,20,21),'ink')
    p.rect((6,18,19,20),'metal')
    p.line([(6,18),(19,18)],'light')
    p.rect((8,18,10,20),'gold');p.rect((16,18,18,20),'gold')
    p.poly([(9,2),(15,8),(9,15),(3,9)],'ink')
    p.poly([(9,3),(13,8),(9,13),(4,9)],'blue')
    p.poly([(9,3),(9,12),(5,9)],'ice')
    p.line([(8,5),(6,8)],'iceLight')
    p.poly([(15,5),(21,11),(15,18),(9,12)],'ink')
    p.poly([(15,6),(20,11),(15,16),(10,12)],'shade')
    p.poly([(15,6),(15,15),(11,12)],'violet')
    p.line([(15,8),(13,11)],'paleViolet')
    p.line([(2,15),(6,12)],'ice')
    p.line([(18,8),(21,5)],'warm')


def singularity(p):
    p.poly([(8,3),(16,3),(21,8),(21,16),(16,21),(8,21),(3,16),(3,8)],'ink')
    p.poly([(8,4),(16,4),(20,8),(20,16),(16,20),(8,20),(4,16),(4,8)],'silver')
    p.poly([(9,6),(15,6),(18,9),(18,15),(15,18),(9,18),(6,15),(6,9)],'bronze')
    p.poly([(10,7),(14,7),(17,10),(17,14),(14,17),(10,17),(7,14),(7,10)],'deep')
    p.line([(8,10),(10,8),(14,8)],'ice')
    p.line([(16,11),(16,14),(13,16)],'violet')
    p.rect((10,10,14,14),'ink')
    p.point((10,10),'paleViolet')
    p.rect((2,10,4,14),'gold');p.rect((20,10,22,14),'gold')
    p.point((2,10),'cream');p.point((20,10),'cream')


def kaleidoscope(p):
    p.poly([(8,4),(16,4),(20,8),(20,16),(16,20),(8,20),(4,16),(4,8)],'ink')
    p.line([(8,5),(16,5),(19,8),(19,16),(16,19),(8,19),(5,16),(5,8),(8,5)],'gold')
    for i in range(6):
        angle=-math.pi/2+i*math.tau/6
        ux,uy=math.cos(angle),math.sin(angle)
        tx,ty=-uy,ux
        def point(r,s=0):return(round(12+ux*r+tx*s),round(12+uy*r+ty*s))
        p.poly([point(10),point(7,3),point(4),point(7,-3)],'ink')
        p.poly([point(9),point(7,2),point(5),point(7,-2)],'blue')
        p.poly([point(9),point(5),point(7,-2)],'ice')
        p.point(point(8),'iceLight')
    p.poly([(12,8),(16,12),(12,16),(8,12)],'bronze')
    p.poly([(12,9),(15,12),(12,15),(9,12)],'warm')
    p.point((12,11),'cream')


def collapse(p):
    p.poly([(7,3),(17,3),(21,7),(21,17),(17,21),(7,21),(3,17),(3,7)],'ink')
    p.poly([(7,4),(17,4),(20,7),(20,17),(17,20),(7,20),(4,17),(4,7)],'metal')
    p.poly([(9,6),(15,6),(18,9),(18,15),(15,18),(9,18),(6,15),(6,9)],'deep')
    p.line([(7,4),(16,4)],'light')
    p.line([(4,7),(4,16),(7,19)],'silver')
    p.line([(20,8),(20,17),(17,20),(8,20)],'shade')
    p.poly([(11,5),(14,7),(12,10),(10,8)],'ink')
    p.poly([(12,6),(13,7),(12,9),(11,8)],'violet')
    p.point((12,6),'paleViolet')
    p.poly([(19,10),(17,14),(14,12),(16,10)],'ink')
    p.poly([(18,11),(17,13),(15,12),(16,11)],'blue')
    p.point((18,11),'ice')
    p.poly([(13,19),(10,17),(12,14),(14,16)],'ink')
    p.poly([(12,18),(11,17),(12,15),(13,16)],'violet')
    p.point((12,18),'paleViolet')
    p.poly([(5,13),(7,10),(10,12),(8,14)],'ink')
    p.poly([(6,12),(7,11),(9,12),(8,13)],'blue')
    p.point((6,12),'ice')
    p.rect((11,11,13,13),'ink')
    p.rect((10,2,14,3),'gold');p.rect((10,21,14,22),'gold')


def eventhorizon(p):
    warm_ring=[(4,17),(4,13),(7,8),(12,4),(17,2),(20,3),(20,7),(17,12),(12,17),(7,21),(4,21),(3,20),(4,17)]
    cool_ring=[(3,5),(4,3),(8,4),(13,8),(18,13),(21,18),(20,21),(17,21),(12,18),(7,13),(3,8),(3,5)]
    p.line(warm_ring,'ink',3)
    p.line(warm_ring,'gold')
    p.line(cool_ring,'ink',3)
    p.line(cool_ring,'ice')
    p.line([(7,8),(12,4),(17,2)],'cream')
    p.line([(13,8),(18,13),(21,18)],'iceLight')
    p.poly([(9,8),(15,8),(17,12),(15,16),(9,16),(7,12)],'body')
    p.poly([(10,9),(14,9),(15,12),(14,15),(10,15),(9,12)],'ink')
    p.line([(11,10),(13,10),(14,12)],'violet')
    for x,y in [(5,6),(18,5),(19,18),(6,19)]:
        p.poly([(x,y-2),(x+2,y),(x,y+2),(x-2,y)],'blueDark')
        p.poly([(x,y-1),(x+1,y),(x,y+1),(x-1,y)],'ice')
        p.point((x,y-1),'iceLight')
    p.point((12,12),'warm')


ICONS={
    'prism':prism,'gravity':gravity,'refraction':refraction,
    'singularity':singularity,'kaleidoscope':kaleidoscope,
    'collapse':collapse,'eventhorizon':eventhorizon
}
FX={
    'rail_muzzle':{'size':24,'durations':[28,35,45,30,22,20],'anchor':[12,17],'direction':[0,-1]},
    'gravity_burst':{'size':48,'durations':[55,80,95,100,85,65],'anchor':[24,24]},
    'evolution_corona':{'size':48,'durations':[70,95,130,110,95,80],'anchor':[24,24]},
    'fusion_nova':{'size':48,'durations':[70,95,135,115,95,90],'anchor':[24,24]}
}


def record(path):
    raw=path.read_bytes()
    return{'path':str(path.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}


def verify_legacy():
    for item in json.loads((HERE/'legacy-baseline.json').read_text())['files']:
        assert record(ROOT/item['path'])==item,'Accepted v06 source changed: '+item['path']


def png_bytes(im):
    data=io.BytesIO();im.save(data,format='PNG',optimize=True);return data.getvalue()


def write_ora(path,merged,layers):
    root=ET.Element('image',{'version':'0.0.3','w':str(merged.width),'h':str(merged.height),'name':path.stem})
    stack=ET.SubElement(root,'stack')
    with zipfile.ZipFile(path,'w')as archive:
        def add(name,raw):
            info=zipfile.ZipInfo(name,date_time=(2026,11,11,0,0,0))
            archive.writestr(info,raw,compress_type=zipfile.ZIP_STORED)
        add('mimetype','image/openraster')
        add('mergedimage.png',png_bytes(merged))
        factor=max(1,min(4,256//max(merged.size)))
        add('Thumbnails/thumbnail.png',png_bytes(merged.resize((merged.width*factor,merged.height*factor),Image.Resampling.NEAREST)))
        for i,(name,image)in enumerate(reversed(layers)):
            src=f'data/layer{i}.png';add(src,png_bytes(image))
            ET.SubElement(stack,'layer',{'name':name,'src':src,'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
        add('stack.xml',ET.tostring(root,encoding='utf-8',xml_declaration=True))


def processed_frames(name,config):
    source=Image.open(HERE/'generated'/(name+'-source.png')).convert('RGBA')
    assert source.width//3==source.height//2,(name,source.size)
    cell=source.width//3
    palette_bytes=[]
    for color in COLORS.values():palette_bytes.extend(color[:3])
    palette_bytes += [0]*(768-len(palette_bytes))
    palette=Image.new('P',(1,1));palette.putpalette(palette_bytes)
    size=config['size'];frames=[]
    for i in range(6):
        tile=source.crop(((i%3)*cell,(i//3)*cell,(i%3+1)*cell,(i//3+1)*cell))
        native=Image.new('RGBA',(size,size))
        for y in range(size):
            for x in range(size):
                block=tile.crop((x*cell//size,y*cell//size,(x+1)*cell//size,(y+1)*cell//size))
                sample=max(block.getdata(),key=lambda color:(color[3],sum(color[:3])))
                native.putpixel((x,y),sample)
        alpha=native.getchannel('A').point(lambda x:255 if x>=155 else 0)
        native=native.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA')
        native.putalpha(alpha)
        # Retain a compact hot core, while keeping the main field transparent.
        ax,ay=config['anchor']
        radius=2 if size==24 else 3
        for y in range(size):
            for x in range(size):
                pixel=native.getpixel((x,y))
                if pixel[3] and min(pixel[:3])>220 and abs(x-ax)+abs(y-ay)>radius:
                    native.putpixel((x,y),COLORS['warm'] if name=='evolution_corona' else COLORS['ice'])
        frames.append(native)
    return frames


assets=[]
def export(name,merged,layers,kind,frames):
    native=SOURCE/(name+'@1x.png');native.write_bytes(png_bytes(merged))
    ora=SOURCE/(name+'.ora');write_ora(ora,merged,layers)
    files=[record(native),record(ora)]
    for scale in [2,4]:
        path=RUNTIME/(name+'@'+str(scale)+'x.png')
        path.write_bytes(png_bytes(merged.resize((merged.width*scale,merged.height*scale),Image.Resampling.NEAREST)))
        files.append(record(path))
    assets.append({'id':name,'kind':kind,'nativeSize':list(merged.size),'runtimeScale':2,'alpha':'binary','frames':frames,'files':files})


def export_icons():
    for name,draw in ICONS.items():
        p=Pixel();draw(p)
        frame={'x':0,'y':0,'width':24,'height':24,'anchor':[12,12],'bounds':list(p.im.getbbox())}
        export(name,p.im,[('native optical/mechanical assembly',p.im)],'icon',[frame])


def export_effects():
    for name,config in FX.items():
        size=config['size'];frames=processed_frames(name,config)
        merged=Image.new('RGBA',(size*6,size));layers=[];metadata=[]
        for i,frame in enumerate(frames):
            layer=Image.new('RGBA',merged.size);layer.paste(frame,(i*size,0));merged.alpha_composite(layer)
            layers.append((f'frame {i+1}',layer))
            metadata.append({'x':i*size,'y':0,'width':size,'height':size,'anchor':config['anchor'],'bounds':list(frame.getbbox()),'durationMs':config['durations'][i]})
        export(name,merged,layers,'atlas',metadata)
        assets[-1]['durationMs']=sum(config['durations'])
        if 'direction'in config:
            assets[-1]['originAnchor']=config['anchor']
            assets[-1]['emissionDirection']=config['direction']


def overviews():
    sheet=Image.new('RGB',(4*132,2*136),'#17172b');d=ImageDraw.Draw(sheet)
    for i,name in enumerate(ICONS):
        im=Image.open(SOURCE/(name+'@1x.png')).convert('RGBA').resize((96,96),Image.Resampling.NEAREST)
        x=(i%4)*132;y=(i//4)*136;sheet.paste(im,(x+18,y+4),im);d.text((x+5,y+108),name,fill='#c4bed2')
    sheet.save(HERE/'icons@4x.png')
    sheet=Image.new('RGB',(6*116,4*130),'#17172b');d=ImageDraw.Draw(sheet)
    for row,name in enumerate(FX):
        config=FX[name];size=config['size'];im=Image.open(SOURCE/(name+'@1x.png')).convert('RGBA')
        for i in range(6):
            frame=im.crop((i*size,0,(i+1)*size,size)).resize((96,96),Image.Resampling.NEAREST)
            x=i*116;y=row*130;sheet.paste(frame,(x+10,y+4),frame);d.text((x+4,y+107),f'{name[:12]} {i+1}',fill='#c4bed2')
    sheet.save(HERE/'animations-review.png')


if __name__=='__main__':
    verify_legacy()
    export_icons()
    export_effects()
    (HERE/'palette.json').write_text(json.dumps({'colors':PALETTE},indent=2)+'\n')
    inputs=[HERE/'export.py',HERE/'legacy-baseline.json',ROOT/'design/star-salvage/v06/production/weapons/palette.json']
    for name in FX:
        inputs.extend([HERE/'generated'/(name+'-source.png'),HERE/'generated'/(name+'-prompt.json')])
    manifest={'schema':1,'style':'Additive v061 purple-grey, warm-gold and ice-blue native pixel effects. Accepted v06 images remain byte-identical.','sourceInputs':[record(p)for p in inputs],'assets':assets}
    (HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    overviews()
    verify_legacy()
    print('Exported7 native24 icons and4 six-frame VFX atlases; v06 baseline unchanged')
