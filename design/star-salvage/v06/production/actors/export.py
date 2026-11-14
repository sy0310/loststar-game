"""Normalize original generated actors to editable native pixels and integer exports.

The generated originals remain intact. OpenRaster materials are editable layers,
not a claim that the generative originals arrived as production sprite layers.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import io
import json
import zipfile
import xml.etree.ElementTree as ET

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[4]
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/actors'
COLORS = [
    '#17172b', '#242036', '#393449', '#534b65', '#756c8e',
    '#948aa8', '#b1a7c1', '#c4bed2', '#e9e4ec', '#fff3d7',
    '#6e4642', '#a86c4b', '#d59456', '#f4c57a', '#ffe6a3',
    '#183e55', '#28748c', '#43a8b7', '#73d9e8', '#baf8f5',
    '#732d51', '#ae3d68', '#dc517b', '#ff7597', '#ffb79c',
    '#f38b6e', '#a5c9d8', '#544e75'
]
RGB = [tuple(bytes.fromhex(color[1:])) for color in COLORS]
SIZES = {'player':24, 'skimmer':24, 'wisp':24, 'ranger':24,
         'tank':32, 'elite':36, 'boss':48}
NAMES = {'player':'CIVILIAN SALVAGER', 'skimmer':'FORK INTERCEPTOR',
         'wisp':'CRESCENT SENSOR', 'ranger':'TWIN-BARREL SENTRY',
         'tank':'ARMORED ORE CLAMP', 'elite':'REACTOR PURSUER',
         'boss':'STAR SEA GUARDIAN'}


def png_bytes(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return stream.getvalue()


def record(file):
    return {'path':str(file.relative_to(ROOT)), 'bytes':file.stat().st_size,
            'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}


def normalize(original, size):
    image = Image.open(original).convert('RGBA')
    hard_alpha = image.getchannel('A').point(lambda alpha:255 if alpha >= 160 else 0)
    image.putalpha(hard_alpha)
    crop = image.getbbox()
    assert crop, original
    image = image.crop(crop)
    scale = (size - 2) / max(image.size)
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    small = image.resize((width, height), Image.Resampling.BOX)
    native = Image.new('RGBA', (size,size))
    x0, y0 = (size-width)//2, (size-height)//2
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = small.getpixel((x,y))
            if alpha < 110:
                continue
            nearest = min(RGB, key=lambda color:
                          (color[0]-red)**2+(color[1]-green)**2+(color[2]-blue)**2)
            native.putpixel((x+x0,y+y0), (*nearest,255))
    return native, list(crop)


def material_layers(image):
    layers = {name:Image.new('RGBA', image.size) for name in ['armor','gold','energy']}
    gold = set(RGB[10:15])
    energy = set(RGB[15:25])
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x,y))
            if not pixel[3]:
                continue
            name = 'gold' if pixel[:3] in gold else 'energy' if pixel[:3] in energy else 'armor'
            layers[name].putpixel((x,y), pixel)
    merged = Image.new('RGBA',image.size)
    for layer in layers.values():
        merged = Image.alpha_composite(merged,layer)
    assert merged.tobytes() == image.tobytes()
    return layers


def save_openraster(file, image):
    layers = material_layers(image)
    tree = ET.Element('image', {'w':str(image.width),'h':str(image.height),
                              'name':file.stem,'version':'0.0.3'})
    stack = ET.SubElement(tree,'stack')
    with zipfile.ZipFile(file, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
        for name in reversed(layers):
            source = f'data/{name}.png'
            ET.SubElement(stack,'layer',{'name':name,'src':source,'x':'0','y':'0',
                                        'opacity':'1.0','visibility':'visible',
                                        'composite-op':'svg:src-over'})
            archive.writestr(source,png_bytes(layers[name]))
        archive.writestr('stack.xml',ET.tostring(tree,encoding='utf-8',xml_declaration=True))
        archive.writestr('mergedimage.png',png_bytes(image))
        scale = 256 // image.width
        thumb = image.resize((image.width*scale,image.height*scale),Image.Resampling.NEAREST)
        archive.writestr('Thumbnails/thumbnail.png',png_bytes(thumb))


def main():
    RUNTIME.mkdir(parents=True,exist_ok=True)
    native_dir = SOURCE / 'native'
    native_dir.mkdir(exist_ok=True)
    (SOURCE/'palette.json').write_text(json.dumps({'colors':COLORS},indent=2)+'\n')
    rows = []
    edits = json.loads((SOURCE/'native-edits.json').read_text())
    for id, size in SIZES.items():
        original = SOURCE/'originals'/f'{id}-generated.png'
        image, crop = normalize(original,size)
        for edit in edits.get(id,[]):
            color = tuple(bytes.fromhex(edit['color'][1:]))
            assert color in RGB
            image.putpixel((edit['x'],edit['y']),(*color,255))
        native = native_dir/f'{id}@1x.png'
        image.save(native)
        ora = native_dir/f'{id}.ora'
        save_openraster(ora,image)
        paths = [native,ora,original]
        for scale in [2,4]:
            file = RUNTIME/f'{id}@{scale}x.png'
            image.resize((size*scale,size*scale),Image.Resampling.NEAREST).save(file)
            paths.append(file)
        row = {'id':id,'nativeSize':[size,size],'displaySize':[size*2,size*2],
               'center':[size/2,size/2],'forward':[0,-1],
               'contentBBox':list(image.getbbox()),'originalCrop':crop,
               'binaryAlpha':True,'paletteSubset':True,'exactNearest':True,
               'editableMergedMatches':True,'files':[record(p) for p in paths]}
        if id == 'player':
            row['collisionCenter'] = [12,12]
            row['collisionRadius'] = 7
            row['nozzleCenters'] = [[8.5,21.5],[14.5,21.5]]
            row['exhaustAnchors'] = [[8.5,23],[14.5,23]]
            row['exhaustDirection'] = [0,1]
        rows.append(row)
    manifest = {'source':'Built-in imagegen originals, native palette/grid conversion, material-split editable OpenRaster',
                'palette':'palette.json','runtimeScale':2,'assets':rows,
                'userVisualApproval':'PENDING','physicalPhoneTested':False}
    (SOURCE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    draw_contact(rows,native_dir)
    print('Exported7 native/ORA actors and14 integer runtime exports')


def draw_contact(rows,native_dir):
    width, height = 1008, 800
    sheet = Image.new('RGB',(width,height),'#17172b')
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',13)
    except OSError:
        font = ImageFont.load_default()
    for index,row in enumerate(rows):
        col, line = index % 4, index // 4
        x, y = col*252, line*400
        draw.rectangle((x+8,y+8,x+243,y+395),fill='#242036',outline='#534b65')
        draw.text((x+20,y+20),row['id'].upper(),font=font,fill='#f4c57a')
        draw.text((x+20,y+42),NAMES[row['id']],font=font,fill='#c4bed2')
        native = Image.open(native_dir/f"{row['id']}@1x.png").convert('RGBA')
        scale = min(6, 192//native.width)
        large = native.resize((native.width*scale,native.height*scale),Image.Resampling.NEAREST)
        sheet.paste(large,(x+(252-large.width)//2,y+88+(192-large.height)//2),large)
        sheet.paste(native.resize((native.width*2,native.height*2),Image.Resampling.NEAREST),
                    (x+20,y+292),native.resize((native.width*2,native.height*2),Image.Resampling.NEAREST))
        draw.text((x+120,y+319),f"{native.width}px / 2x",font=font,fill='#73d9e8')
    sheet.save(SOURCE/'native-contact.png')


if __name__ == '__main__':
    main()
