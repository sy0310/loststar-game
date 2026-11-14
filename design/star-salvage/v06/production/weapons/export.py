"""Original native-pixel weapon artwork and exact integer runtime exports.

Icons extend this project's code-native icon system. Explosion artwork originates
from the built-in imagegen call recorded in generated/explosion-prompt.json.
The native animation cleanup is a deterministic alpha/palette/grid export.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import io
import json
import math
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'source'
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/weapons'
SOURCE.mkdir(exist_ok=True)
RUNTIME.mkdir(parents=True, exist_ok=True)
PALETTE = {
    'ink':'#17172b', 'deep':'#26243b', 'body':'#393449', 'shade':'#57516d',
    'metal':'#756c8e', 'silver':'#9a92ad', 'light':'#c4bed2', 'ivory':'#f3e8e1',
    'bronze':'#825d42', 'gold':'#bd8a51', 'warm':'#f4c57a', 'cream':'#ffe5a6',
    'blueDark':'#28596c', 'blue':'#438fa5', 'ice':'#73d9e8', 'iceLight':'#c1f4ef',
    'teal':'#359a9f', 'coral':'#ff7597', 'red':'#b84269', 'rust':'#934c5b',
    'orange':'#e88d57', 'violet':'#a483c4', 'paleViolet':'#d1b5e3', 'white':'#ffffff'
}
COLORS = {key:tuple(bytes.fromhex(value[1:]))+(255,) for key,value in PALETTE.items()}

class Pixel:
    def __init__(self, size=(24,24)):
        self.im = Image.new('RGBA', size)
        self.d = ImageDraw.Draw(self.im)
    def rect(self, box, color):
        self.d.rectangle(box, fill=COLORS[color])
    def poly(self, points, color):
        self.d.polygon(points, fill=COLORS[color])
    def line(self, points, color, width=1):
        self.d.line(points, fill=COLORS[color], width=width)
    def point(self, xy, color):
        self.d.point(xy, fill=COLORS[color])


def bolts(p, positions):
    for x,y in positions:
        p.rect((x,y,x+1,y+1),'ink')
        p.point((x,y),'light')


def plate(p, box):
    x0,y0,x1,y1 = box
    p.rect(box,'ink')
    p.rect((x0+1,y0+1,x1-1,y1-1),'metal')
    p.line([(x0+1,y1-1),(x0+1,y0+1),(x1-1,y0+1)],'light')
    p.line([(x1-1,y0+2),(x1-1,y1-1),(x0+2,y1-1)],'shade')


def mini_drone(p,x,y):
    p.poly([(x-3,y-2),(x-2,y-3),(x+2,y-3),(x+3,y-2),(x+3,y+2),(x+2,y+3),(x-2,y+3),(x-3,y+2)],'ink')
    p.rect((x-2,y-2,x+2,y+2),'silver')
    p.line([(x-2,y-2),(x+2,y-2)],'light')
    p.rect((x-1,y-1,x+1,y+1),'blueDark')
    p.point((x,y-1),'iceLight')
    p.rect((x-5,y-1,x-3,y+1),'gold')
    p.rect((x+3,y-1,x+5,y+1),'gold')
    p.point((x-4,y-1),'cream')
    p.point((x+4,y-1),'cream')


def cannon(p):
    plate(p,(5,12,19,21))
    p.rect((8,14,16,19),'blueDark')
    p.rect((10,15,14,18),'ice')
    for x in [6,14]:
        p.rect((x,3,x+4,15),'ink')
        p.rect((x+1,4,x+3,14),'metal')
        p.line([(x+1,5),(x+1,12)],'light')
        p.rect((x+1,3,x+3,5),'bronze')
        p.rect((x+1,3,x+3,3),'cream')
        p.rect((x,9,x+4,10),'gold')
    p.rect((10,9,14,13),'shade')
    bolts(p,[(6,17),(17,17)])


def drone(p):
    mini_drone(p,12,11)
    plate(p,(8,14,16,19))
    p.rect((10,16,14,17),'ice')
    for x in [3,18]:
        p.rect((x,7,x+2,15),'ink')
        p.line([(x+1,8),(x+1,14)],'gold')
        p.point((x+1,8),'cream')
    p.line([(12,3),(12,6)],'silver')
    p.point((12,3),'iceLight')


def arc(p):
    plate(p,(7,6,17,20))
    for y in [8,11,14,17]:
        p.rect((5,y,19,y+1),'ink')
        p.line([(6,y),(18,y)],'gold')
        p.line([(8,y+1),(16,y+1)],'bronze')
    p.rect((10,5,14,7),'blue')
    p.line([(12,3),(12,5)],'iceLight')
    p.line([(4,5),(2,9),(5,10),(3,14)],'ice')
    p.line([(20,3),(18,7),(21,8),(19,12)],'iceLight')
    p.point((12,3),'white')


def missile(p):
    p.poly([(12,2),(16,7),(16,16),(20,20),(15,20),(12,18),(9,20),(4,20),(8,16),(8,7)],'ink')
    p.poly([(12,3),(15,7),(15,16),(12,18),(9,16),(9,7)],'silver')
    p.poly([(12,3),(15,7),(9,7)],'warm')
    p.line([(10,8),(10,15)],'ivory')
    p.rect((9,12,15,13),'gold')
    p.poly([(7,16),(7,19),(5,19)],'shade')
    p.poly([(17,16),(19,19),(17,19)],'metal')
    p.rect((11,18,13,20),'blue')
    p.point((12,21),'iceLight')


def blade(p):
    p.poly([(10,3),(14,3),(16,7),(14,9),(18,9),(21,12),(19,16),(14,15),(14,19),(11,21),(7,19),(9,14),(5,14),(3,11),(5,7),(10,9)],'ink')
    p.poly([(11,4),(13,4),(14,7),(12,11),(9,9)],'light')
    p.poly([(16,10),(19,11),(20,13),(18,14),(13,13)],'ice')
    p.poly([(13,16),(12,19),(10,20),(9,18),(11,13)],'silver')
    p.poly([(7,13),(4,12),(4,10),(6,9),(11,11)],'metal')
    p.rect((9,9,15,15),'bronze')
    p.rect((10,10,14,14),'warm')
    p.rect((11,11,13,13),'deep')
    p.point((11,11),'cream')


def shield(p):
    p.poly([(12,2),(21,6),(20,15),(17,19),(12,22),(7,19),(4,15),(3,6)],'ink')
    p.poly([(12,3),(20,7),(19,14),(16,18),(12,20),(8,18),(5,14),(4,7)],'silver')
    p.poly([(12,5),(18,8),(17,14),(15,17),(12,19),(9,17),(7,14),(6,8)],'blueDark')
    p.line([(12,5),(7,8),(8,14),(12,18)],'ice')
    p.line([(12,7),(12,16)],'blue')
    p.rect((10,10,14,13),'gold')
    p.rect((11,10,13,12),'cream')
    p.point((12,11),'ivory')


def lens(p):
    plate(p,(4,14,17,20))
    p.rect((16,7,20,16),'ink')
    p.rect((17,8,19,15),'gold')
    p.poly([(4,7),(7,4),(13,4),(16,7),(16,13),(13,16),(7,16),(4,13)],'ink')
    p.poly([(5,7),(8,5),(12,5),(15,8),(15,12),(12,15),(8,15),(5,12)],'silver')
    p.poly([(7,8),(9,6),(12,7),(14,9),(13,12),(10,14),(7,12)],'blue')
    p.line([(8,8),(10,7),(12,8)],'iceLight')
    p.rect((8,9,9,10),'ice')
    bolts(p,[(6,17),(14,17)])


def lock(p):
    p.rect((6,6,18,18),'ink')
    p.rect((7,7,17,17),'metal')
    p.rect((9,9,15,15),'blueDark')
    for n in [8,11,14,17]:
        p.rect((3,n,5,n),'gold'); p.rect((19,n,21,n),'gold')
        p.rect((n,3,n,5),'gold'); p.rect((n,19,n,21),'gold')
    p.line([(12,8),(12,10)],'iceLight')
    p.line([(12,14),(12,16)],'iceLight')
    p.line([(8,12),(10,12)],'iceLight')
    p.line([(14,12),(16,12)],'iceLight')
    p.point((12,12),'warm')
    p.line([(7,7),(17,7)],'light')


def capacitor(p):
    plate(p,(4,17,20,21))
    for x in [5,13]:
        p.rect((x,5,x+6,18),'ink')
        p.rect((x+1,6,x+5,17),'shade')
        p.line([(x+1,6),(x+1,16)],'silver')
        p.rect((x+1,9,x+5,14),'blueDark')
        p.rect((x+2,9,x+4,13),'ice')
        p.rect((x+2,3,x+4,5),'gold')
        p.point((x+2,3),'cream')
    p.line([(3,11),(2,13),(4,14)],'iceLight')
    p.point((21,9),'ice')


def cooler(p):
    plate(p,(3,7,21,19))
    for x in range(5,21,3):
        p.rect((x,8,x+1,17),'blueDark')
        p.line([(x,8),(x,16)],'ice')
        p.point((x,8),'iceLight')
    p.rect((7,4,17,7),'shade')
    p.line([(8,4),(16,4)],'light')
    p.rect((8,19,16,21),'gold')
    bolts(p,[(3,7),(20,18)])


def magnet(p):
    p.poly([(4,4),(9,4),(9,13),(10,15),(14,15),(15,13),(15,4),(20,4),(20,14),(18,19),(15,21),(9,21),(6,19),(4,14)],'ink')
    p.poly([(5,5),(8,5),(8,14),(10,17),(14,17),(16,14),(16,5),(19,5),(19,14),(17,18),(14,20),(10,20),(7,18),(5,14)],'metal')
    p.rect((5,5,8,9),'warm');p.rect((16,5,19,9),'warm')
    p.line([(5,11),(5,14),(8,18),(10,19)],'light')
    p.poly([(12,6),(15,10),(12,14),(9,10)],'blueDark')
    p.poly([(12,7),(14,10),(12,12),(10,10)],'ice')
    p.point((12,8),'iceLight')


def armor(p):
    p.poly([(7,3),(17,3),(21,7),(20,17),(16,21),(8,21),(4,17),(3,7)],'ink')
    p.poly([(7,4),(17,4),(20,8),(19,16),(15,20),(9,20),(5,16),(4,8)],'shade')
    p.poly([(8,5),(16,5),(18,8),(17,11),(7,11),(6,8)],'light')
    p.poly([(7,12),(17,12),(18,15),(15,18),(9,18),(6,15)],'metal')
    p.line([(8,6),(15,6)],'ivory')
    p.line([(8,13),(16,13)],'silver')
    p.rect((10,9,14,14),'bronze')
    p.rect((11,9,13,13),'warm')
    bolts(p,[(5,8),(18,8),(8,17),(15,17)])


def piercebeam(p):
    plate(p,(5,14,19,21))
    for x in [5,15]:
        plate(p,(x,5,x+4,16))
        p.rect((x+1,9,x+3,10),'warm')
        p.line([(x+1,6),(x+1,8)],'ivory')
    p.rect((10,3,14,17),'blueDark')
    p.rect((11,2,13,16),'ice')
    p.line([(12,2),(12,15)],'iceLight')
    p.point((12,2),'white')
    p.rect((8,18,16,19),'gold')


def hunterswarm(p):
    mini_drone(p,12,6)
    mini_drone(p,7,16)
    mini_drone(p,17,16)
    p.line([(10,11),(8,12)],'blue')
    p.line([(14,11),(16,12)],'blue')
    p.point((12,15),'warm')


def chainstorm(p):
    for x,y in [(5,5),(19,5),(5,19),(19,19)]:
        p.rect((x-2,y-2,x+2,y+2),'ink')
        p.rect((x-1,y-1,x+1,y+1),'gold')
        p.point((x-1,y-1),'cream')
    p.line([(5,7),(8,6),(10,10),(13,8),(17,7)],'ice')
    p.line([(7,19),(9,16),(13,18),(16,14),(18,17)],'ice')
    p.line([(5,8),(7,11),(5,15),(7,17)],'iceLight')
    p.line([(19,8),(17,11),(19,13),(17,17)],'iceLight')
    p.rect((9,9,15,15),'ink')
    p.rect((10,10,14,14),'blue')
    p.rect((11,11,13,13),'iceLight')


def meteorbarrage(p):
    # The side missiles fan out around a larger, upright centre missile.
    for mirrored in [False,True]:
        def fan(points):
            return [(23-x if mirrored else x,y) for x,y in points]
        p.poly(fan([(2,4),(6,5),(10,11),(10,14),(7,14),(3,10)]),'ink')
        p.poly(fan([(3,5),(6,6),(8,10),(8,13),(5,10),(3,7)]),'silver')
        p.poly(fan([(3,5),(6,6),(4,8),(3,7)]),'warm')
        p.line(fan([(5,8),(7,11)]),'ivory')
        p.poly(fan([(4,11),(6,12),(6,15),(3,14)]),'shade')
        p.poly(fan([(8,10),(11,11),(10,13),(9,12)]),'metal')
        p.poly(fan([(7,13),(9,12),(10,14),(8,15)]),'bronze')
        p.poly(fan([(8,15),(10,14),(11,18),(10,20),(9,18)]),'blueDark')
        p.line(fan([(9,15),(10,18)]),'ice')
        p.point(fan([(9,15)])[0],'iceLight')
    p.poly([(12,2),(14,5),(14,13),(16,16),(13,16),(12,15),(11,16),(8,16),(10,13),(10,5)],'ink')
    p.poly([(12,3),(13,5),(13,13),(12,14),(11,13),(11,5)],'light')
    p.poly([(12,3),(13,5),(11,5)],'warm')
    p.line([(11,6),(11,12)],'ivory')
    p.rect((11,9,13,10),'gold')
    p.poly([(9,15),(10,14),(10,15)],'silver')
    p.poly([(14,14),(15,15),(14,15)],'metal')
    p.rect((11,15,13,16),'bronze')
    p.poly([(11,17),(13,17),(13,19),(12,21),(11,19)],'blue')
    p.line([(12,17),(12,19)],'iceLight')


def spiralsaw(p):
    p.poly([(8,3),(16,3),(21,8),(21,16),(16,21),(8,21),(3,16),(3,8)],'ink')
    p.poly([(8,4),(16,4),(20,8),(20,16),(16,20),(8,20),(4,16),(4,8)],'silver')
    p.poly([(8,7),(16,7),(17,8),(17,16),(16,17),(8,17),(7,16),(7,8)],'blueDark')
    p.poly([(4,7),(9,4),(10,7),(7,10)],'ice')
    p.poly([(17,4),(20,9),(17,10),(14,7)],'ice')
    p.poly([(20,17),(15,20),(14,17),(17,14)],'ice')
    p.poly([(7,20),(4,15),(7,14),(10,17)],'ice')
    p.poly([(12,8),(16,12),(12,16),(8,12)],'gold')
    p.poly([(12,9),(15,12),(12,15),(9,12)],'warm')
    p.point((11,11),'cream')


def reactiveaegis(p):
    shield(p)
    p.poly([(7,8),(17,8),(16,12),(8,12)],'metal')
    p.poly([(8,13),(16,13),(14,17),(10,17)],'light')
    p.line([(8,8),(16,8)],'ivory')
    p.rect((11,7,13,16),'gold')
    p.line([(1,8),(2,12),(1,16)],'ice')
    p.line([(22,8),(21,12),(22,16)],'ice')


def thunderhive(p):
    for x,y in [(5,5),(19,5),(5,19),(19,19)]:
        p.rect((x-2,y-2,x+2,y+2),'ink')
        p.rect((x-1,y-1,x+1,y+1),'silver')
        p.point((x,y),'iceLight')
    mini_drone(p,12,12)
    p.line([(10,3),(13,3),(11,8),(14,8),(12,12)],'iceLight')
    p.line([(11,15),(9,21),(13,19)],'ice')
    p.line([(6,8),(8,10)],'blue')
    p.line([(18,8),(16,10)],'blue')


def blastwheel(p):
    p.poly([(8,4),(16,4),(20,8),(20,16),(16,20),(8,20),(4,16),(4,8)],'ink')
    p.poly([(8,5),(16,5),(19,8),(19,16),(16,19),(8,19),(5,16),(5,8)],'bronze')
    p.poly([(9,8),(15,8),(16,9),(16,15),(15,16),(9,16),(8,15),(8,9)],'body')
    for pts in [[(10,2),(14,2),(14,7),(12,9),(10,7)],[(22,10),(22,14),(17,14),(15,12),(17,10)],[(14,22),(10,22),(10,17),(12,15),(14,17)],[(2,14),(2,10),(7,10),(9,12),(7,14)]]:
        p.poly(pts,'ink')
    p.poly([(11,3),(13,3),(13,6),(12,7),(11,6)],'warm')
    p.poly([(21,11),(21,13),(18,13),(17,12),(18,11)],'orange')
    p.poly([(13,21),(11,21),(11,18),(12,17),(13,18)],'warm')
    p.poly([(3,13),(3,11),(6,11),(7,12),(6,13)],'orange')
    p.rect((10,10,14,14),'metal')
    p.rect((11,11,13,13),'ice')


DRAWINGS = {
 'cannon':cannon, 'drone':drone, 'arc':arc, 'missile':missile, 'blade':blade,
 'shield':shield, 'lens':lens, 'lock':lock, 'capacitor':capacitor,
 'cooler':cooler, 'magnet':magnet, 'armor':armor, 'piercebeam':piercebeam,
 'hunterswarm':hunterswarm, 'chainstorm':chainstorm, 'meteorbarrage':meteorbarrage,
 'spiralsaw':spiralsaw, 'reactiveaegis':reactiveaegis,
 'thunderhive':thunderhive, 'blastwheel':blastwheel
}


def small_sprite(name):
    p=Pixel()
    if name=='xp_crystal':
        p.poly([(12,4),(17,10),(15,17),(12,20),(8,15),(7,10)],'ink')
        p.poly([(12,5),(16,10),(14,16),(12,18),(9,14),(8,10)],'blue')
        p.poly([(12,5),(12,17),(9,14),(8,10)],'ice')
        p.line([(12,6),(10,10),(11,13)],'iceLight')
        p.line([(13,8),(15,11),(14,14)],'teal')
    elif name=='scrap':
        p.poly([(8,5),(15,5),(19,9),(19,16),(15,20),(8,20),(4,16),(4,9)],'ink')
        p.poly([(9,6),(14,6),(18,10),(18,15),(14,19),(9,19),(5,15),(5,10)],'gold')
        p.line([(9,7),(14,7),(17,10)],'cream')
        p.poly([(10,10),(14,10),(15,11),(15,14),(14,15),(10,15),(9,14),(9,11)],'bronze')
        p.rect((11,11,13,13),'deep')
        p.point((17,15),'warm')
    elif name=='pulse':
        p.poly([(12,3),(15,7),(14,15),(12,19),(10,15),(9,7)],'blueDark')
        p.rect((11,5,13,14),'ice')
        p.line([(12,5),(12,12)],'iceLight')
        p.point((12,17),'blue')
    elif name=='threat':
        p.poly([(12,5),(17,10),(17,14),(12,19),(7,14),(7,10)],'red')
        p.poly([(12,7),(15,11),(15,13),(12,17),(9,13),(9,11)],'coral')
        p.rect((11,10,13,14),'cream')
        p.point((12,9),'ivory')
    elif name=='missile_body':
        missile(p)
        p.rect((10,20,14,21),'blueDark')
        p.rect((11,20,13,22),'ice')
        p.point((12,22),'iceLight')
    elif name=='blade_body':
        blade(p)
    elif name=='drone_body':
        mini_drone(p,12,12)
        p.rect((6,15,8,17),'blueDark')
        p.rect((16,15,18,17),'blueDark')
        p.point((7,17),'ice');p.point((17,17),'ice')
    elif name=='shield_piece':
        p.poly([(4,7),(19,4),(21,14),(7,20),(3,14)],'blueDark')
        p.line([(4,7),(19,4),(21,14)],'ice')
        p.line([(5,8),(18,5)],'iceLight')
        p.line([(7,19),(20,14)],'blue')
        p.line([(9,7),(10,17)],'blue')
        p.line([(14,6),(15,15)],'blue')
        p.rect((9,10,13,13),'ice')
    elif name=='beam_cap':
        p.poly([(12,2),(17,6),(20,12),(17,18),(12,22),(7,18),(4,12),(7,6)],'blueDark')
        p.poly([(12,4),(16,8),(18,12),(16,16),(12,20),(8,16),(6,12),(8,8)],'blue')
        p.poly([(12,6),(15,10),(16,12),(15,14),(12,18),(9,14),(8,12),(9,10)],'ice')
        p.line([(12,8),(12,16)],'iceLight',2)
    return p.im


def hit_frames():
    layouts=[
      [(12,12,0),(12,9,1),(15,12,1),(10,13,2)],
      [(12,12,0),(12,6,1),(18,12,1),(7,14,1),(16,8,2),(15,17,2)],
      [(12,4,1),(20,12,1),(5,15,1),(18,6,2),(16,20,2),(8,6,2)],
      [(12,3,2),(21,13,2),(4,17,2),(19,5,2),(17,21,2)]
    ]
    frames=[]
    for i,points in enumerate(layouts):
        p=Pixel()
        for x,y,k in points:
            if k==0:
                p.rect((x-1,y-1,x+1,y+1),'iceLight')
                p.point((x,y),'white')
            elif k==1:
                p.rect((x,y,x+1,y+1),'ice')
            else:
                p.point((x,y),'blue')
        if i<3:
            p.line([(12,12),(12,7-i)],'iceLight')
            p.line([(12,12),(16+i,12)],'warm')
        frames.append(p.im)
    return frames


def thruster_frames():
    frames=[]
    for n in range(4):
        p=Pixel()
        end=[18,21,19,22][n]
        p.poly([(8,3),(16,3),(17,8),(15,end-3),(12,end),(9,end-3),(7,8)],'blueDark')
        p.poly([(9,3),(15,3),(15,9),(12,end-2),(9,9)],'blue')
        p.poly([(10,3),(14,3),(14,8),(12,end-4),(10,8)],'ice')
        p.rect((11,3,13,7),'iceLight')
        p.point((12,9),'ivory')
        if n%2:p.point((10,end),'blue')
        frames.append(p.im)
    return frames


def explosion_frames():
    im=Image.open(HERE/'generated/explosion-source.png').convert('RGBA')
    palette_bytes=[]
    for value in COLORS.values():palette_bytes.extend(value[:3])
    palette_bytes += [0]*(768-len(palette_bytes))
    palette=Image.new('P',(1,1));palette.putpalette(palette_bytes)
    frames=[]
    for n in range(6):
        tile=im.crop(((n%3)*512,(n//3)*512,(n%3+1)*512,(n//3+1)*512))
        native=tile.resize((24,24),Image.Resampling.NEAREST)
        alpha=native.getchannel('A').point(lambda x:255 if x>=150 else 0)
        quant=native.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA')
        quant.putalpha(alpha)
        # Very bright source core stays compact at native scale.
        if n in [2,3]:
            for y in range(24):
                for x in range(24):
                    rgba=quant.getpixel((x,y))
                    if rgba[3] and min(rgba[:3])>220 and abs(x-12)+abs(y-12)>3:
                        quant.putpixel((x,y),COLORS['warm'])
        frames.append(quant)
    return frames


def png_bytes(im):
    buf=io.BytesIO();im.save(buf,format='PNG',optimize=True);return buf.getvalue()


def write_ora(path,merged,layers):
    root=ET.Element('image',{'version':'0.0.3','w':str(merged.width),'h':str(merged.height),'name':path.stem})
    stack=ET.SubElement(root,'stack')
    with zipfile.ZipFile(path,'w')as archive:
        def add_entry(name,raw):
            info=zipfile.ZipInfo(name,date_time=(2026,11,11,0,0,0))
            archive.writestr(info,raw,compress_type=zipfile.ZIP_STORED)
        add_entry('mimetype','image/openraster')
        add_entry('mergedimage.png',png_bytes(merged))
        factor=max(1,min(4,256//max(merged.size)))
        add_entry('Thumbnails/thumbnail.png',png_bytes(merged.resize((merged.width*factor,merged.height*factor),Image.Resampling.NEAREST)))
        for index,(name,layer) in enumerate(reversed(layers)):
            src=f'data/layer{index}.png'
            add_entry(src,png_bytes(layer))
            ET.SubElement(stack,'layer',{'name':name,'src':src,'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
        add_entry('stack.xml',ET.tostring(root,encoding='utf-8',xml_declaration=True))


def relative(path):return str(path.relative_to(ROOT))
def record(path):return{'path':relative(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def export(name,merged,layers,kind='icon',frames=None):
    native=SOURCE/(name+'@1x.png');native.write_bytes(png_bytes(merged))
    ora=SOURCE/(name+'.ora');write_ora(ora,merged,layers)
    files=[record(native),record(ora)]
    for scale in [2,4]:
        dest=RUNTIME/(name+'@'+str(scale)+'x.png')
        dest.write_bytes(png_bytes(merged.resize((merged.width*scale,merged.height*scale),Image.Resampling.NEAREST)))
        files.append(record(dest))
    if frames is None:frames=[{'x':0,'y':0,'width':merged.width,'height':merged.height,'anchor':[12,12],'bounds':list(merged.getbbox())}]
    asset={'id':name,'kind':kind,'nativeSize':list(merged.size),'frames':frames,'alpha':'binary','runtimeScale':2,'files':files}
    if name=='thruster':
        asset.update(nozzleAnchor=[12,3],exhaustDirection=[0,1],shipForward=[0,-1],nozzleSpan=[8,16])
        for frame in frames:
            frame.update(nozzleAnchor=[12,3],exhaustDirection=[0,1])
    assets.append(asset)


def atlas(name,frames,duration):
    merged=Image.new('RGBA',(24*len(frames),24));layers=[];metadata=[]
    for i,frame in enumerate(frames):
        layer=Image.new('RGBA',merged.size);layer.paste(frame,(24*i,0));merged.alpha_composite(layer);layers.append((f'frame {i+1}',layer))
        metadata.append({'x':24*i,'y':0,'width':24,'height':24,'anchor':[12,12],'bounds':list(frame.getbbox()),'durationMs':duration})
    export(name,merged,layers,'atlas',metadata)


assets=[]
for name,draw in DRAWINGS.items():
    p=Pixel();draw(p)
    export(name,p.im,[('native mechanical body',p.im)],'icon')
small_names=['xp_crystal','scrap','pulse','threat','missile_body','blade_body','drone_body','shield_piece','beam_cap']
for name in small_names:
    im=small_sprite(name);export(name,im,[('native component',im)],'sprite')
atlas('explosion',explosion_frames(),65)
atlas('hit',hit_frames(),45)
atlas('thruster',thruster_frames(),65)
(HERE/'palette.json').write_text(json.dumps({'colors':PALETTE},indent=2)+'\n')
manifest={'schema':1,'style':'Original purple-grey metal, warm-gold mechanisms and ice-blue energy. Native24px grid, integer2x/4x.','scope':'20 icons,9 component sprites,6-frame explosion,4-frame hit,4-frame thruster. Art pending parent review.','provenance':{'icons':'Original deterministic code-native pixel artwork extending the previous project icon vocabulary.','explosion':'Built-in imagegen source, reduced to a fixed native palette with binary alpha; prompt retained.','runtimeExports':'Exact NEAREST exports from editable native PNG and ORA.'},'sourceInputs':[record(HERE/'export.py'),record(HERE/'generated/explosion-source.png'),record(HERE/'generated/explosion-prompt.json')],'assets':assets}
(HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Opaque review sheet only. Runtime sprites retain genuine transparency.
cols=6;cell_w=130;cell_h=136
rows=math.ceil(len(assets)/cols)
sheet=Image.new('RGB',(cols*cell_w,rows*cell_h),'#17172b');d=ImageDraw.Draw(sheet)
for i,a in enumerate(assets):
    x=(i%cols)*cell_w;y=(i//cols)*cell_h
    im=Image.open(SOURCE/(a['id']+'@1x.png')).convert('RGBA')
    if a['kind']=='atlas':im=im.crop((0,0,24,24))
    big=im.resize((96,96),Image.Resampling.NEAREST)
    sheet.paste(big,(x+17,y+5),big)
    d.text((x+6,y+108),a['id'],fill='#c4bed2')
sheet.save(HERE/'contact-sheet@4x.png')
# All animation frames at real 4x pixel scale for visual review.
anim=Image.new('RGB',(6*110,3*120),'#17172b');ad=ImageDraw.Draw(anim)
for row,name in enumerate(['explosion','hit','thruster']):
    entry=next(a for a in assets if a['id']==name)
    im=Image.open(SOURCE/(name+'@1x.png')).convert('RGBA')
    for i,frame in enumerate(entry['frames']):
        sub=im.crop((frame['x'],0,frame['x']+24,24)).resize((96,96),Image.Resampling.NEAREST)
        anim.paste(sub,(i*110+7,row*120+3),sub)
        ad.text((i*110+5,row*120+101),f'{name} {i+1}',fill='#c4bed2')
anim.save(HERE/'animations@4x.png')
print('Exported',len(assets),'original weapon assets')
