"""Re-grid independently generated item candidates, then export true 1x/2x/4x pixel assets.

Generation outputs are retained as candidates, not mislabelled as native24px art.
No concept-board image is read by this rendering/cleanup step.
"""
from pathlib import Path
import hashlib, io, json, xml.etree.ElementTree as ET, zipfile
from PIL import Image, ImageOps, ImageDraw

REPO = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
OUT = REPO / 'prototypes/salvage-route-demo/assets/v04'
PALETTE = json.loads((HERE.parent / 'palette.json').read_text())
COLORS = [tuple(bytes.fromhex(x[1:])) for x in PALETTE['colors']]
HEX = {tuple(bytes.fromhex(x[1:])): x for x in PALETTE['colors']}
NAMES = {'metal_crate':'金属箱','energy_battery':'能源电池','nav_chip':'导航芯片',
         'broken_engine':'损坏引擎件','medkit':'医疗箱','fuel_can':'备用燃料罐',
         'sample':'观测样本','toolbox':'维修工具箱'}

def png(im):
    f = io.BytesIO(); im.save(f, format='PNG'); return f.getvalue()

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def closest(rgb):
    return min(COLORS, key=lambda c: sum(w*(a-b)**2 for a,b,w in zip(c,rgb,(2,3,2))))

def make_ora(im, target, id):
    # Editable material layers, all on the exact native24px canvas.
    categories = {'highlights':set(PALETTE['colors'][11:14]+PALETTE['colors'][23:25]+PALETTE['colors'][29:30]),
                  'accents':set(PALETTE['colors'][19:24]+PALETTE['colors'][25:]+[PALETTE['colors'][22]]),
                  'structure':set(PALETTE['colors'][:6]), 'material':set()}
    layers = {key:Image.new('RGBA',im.size) for key in categories}
    for y in range(24):
        for x in range(24):
            p=im.getpixel((x,y))
            if not p[3]: continue
            color=HEX[p[:3]]
            key=next((key for key,s in categories.items() if color in s),'material')
            layers[key].putpixel((x,y),p)
    root=ET.Element('image',{'version':'0.0.3','w':'24','h':'24','name':'item_'+id})
    stack=ET.SubElement(root,'stack')
    with zipfile.ZipFile(target,'w')as z:
        def write(name,data,compression=zipfile.ZIP_DEFLATED):
            info=zipfile.ZipInfo(name,(2026,11,9,0,0,0));info.compress_type=compression;z.writestr(info,data)
        write('mimetype','image/openraster',zipfile.ZIP_STORED)
        for i,(name,layer)in enumerate(layers.items()):
            src=f'data/layer{i}.png';write(src,png(layer))
            ET.SubElement(stack,'layer',{'name':name,'src':src,'x':'0','y':'0','opacity':'1.0','visibility':'visible','composite-op':'svg:src-over'})
        write('stack.xml',ET.tostring(root,encoding='utf-8'))
        write('mergedimage.png',png(im))
        write('Thumbnails/thumbnail.png',png(im.resize((96,96),Image.Resampling.NEAREST)))

def native(candidate, id, apply_edits=True):
    alpha=candidate.getchannel('A').point(lambda a:255 if a>=128 else 0)
    bounds=alpha.getbbox()
    if not bounds: raise ValueError('No visible generated item: '+id)
    candidate=candidate.copy();candidate.putalpha(alpha)
    crop=candidate.crop(bounds)
    # The generated large render cannot be claimed to be1x. Reconstruct its
    # material clusters on24x24, eliminate antialiasing and then inspect/edit1x.
    small=ImageOps.contain(crop,(20,20),method=Image.Resampling.BOX)
    result=Image.new('RGBA',(24,24))
    x0=(24-small.width)//2;y0=(24-small.height)//2
    for y in range(small.height):
        for x in range(small.width):
            r,g,b,a=small.getpixel((x,y))
            if a>=128: result.putpixel((x+x0,y+y0),(*closest((r,g,b)),255))
    # Declared native-grid corrections are applied only after visual inspection.
    edits=HERE/'pixel-edits.json'
    actual=[]
    if apply_edits and edits.exists():
        for e in json.loads(edits.read_text()).get(id,[]):
            x,y,color=e
            if color is None:p=(0,0,0,0)
            else:
                assert color in PALETTE['colors'];p=(*bytes.fromhex(color[1:]),255)
            result.putpixel((x,y),p);actual.append(e)
    return result,bounds,actual

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    reviews=json.loads((HERE/'review.json').read_text()).get('items',{}) if (HERE/'review.json').exists() else {}
    rows=[]
    for request in json.loads((HERE/'requests.json').read_text()):
        id=request['id'];candidate=HERE/'candidates'/('item_'+id+'_generated.png')
        original=Image.open(candidate).convert('RGBA');im,bbox,edits=native(original,id)
        source=HERE/('item_'+id+'@1x.png');im.save(source)
        ora=HERE/('item_'+id+'.ora');make_ora(im,ora,id)
        exports=[]
        for scale in(2,4):
            p=OUT/('item_'+id+f'@{scale}x.png');large=im.resize((24*scale,24*scale),Image.Resampling.NEAREST);large.save(p)
            assert large.tobytes()==Image.open(p).tobytes()
            exports.append({'path':str(p.relative_to(REPO)),'width':24*scale,'height':24*scale,'scale':scale,'bytes':p.stat().st_size,'sha256':digest(p)})
        assert set(im.getchannel('A').getdata())<={0,255}
        visible={p[:3]for p in im.getdata()if p[3]};assert visible<=set(COLORS)
        box=im.getbbox();assert box[0]>=2 and box[1]>=2 and box[2]<=22 and box[3]<=22
        rows.append({'id':id,'name':NAMES[id],'spriteId':id,'tool':'built-in image_gen','referenceRole':request['referenceRole'],
                     'referenceSha256':'16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0',
                     'prompt':request['prompt'],'candidate':str(candidate.relative_to(REPO)),'candidateSha256':digest(candidate),
                     'generatedDimensions':list(original.size),'visibleGeneratedBounds':list(bbox),
                     'source':str(source.relative_to(REPO)),'sourceDimensions':[24,24],'sourceSha256':digest(source),
                     'editableSource':str(ora.relative_to(REPO)),'editableSourceSha256':digest(ora),'exports':exports,
                     'paletteId':PALETTE['id'],'colorsUsed':len(visible),'alpha':'binary0/255','visibleBounds':list(box),
                     'nativePixelEdits':edits,'process':'Independent generation; native re-grid/material palette cleanup; nearest integer exports. Candidate is not claimed to be native24px.',
                     'license':'Original project artwork generated with built-in image_gen and native-grid cleanup; no third-party game assets or concept extraction.',
                     'visualStatus':'INTERNAL_PASS' if reviews.get(id,{}).get('sourceSha256')==digest(source) else 'INTERNAL_REVIEW_PENDING_PARENT'})
    manifest={'schema':1,'kind':'original_pixel_item_production','palette':str((HERE.parent/'palette.json').relative_to(REPO)),
              'sourceCanvas':[24,24],'internalVisualReview':str((HERE/'review.json').relative_to(REPO)),'items':rows,'physicalPhoneTested':False,'userArtAccepted':False}
    (HERE.parent/'items-art-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    # QA-only sheet: nearest magnification, never shipped as a combined sprite.
    sheet=Image.new('RGBA',(len(rows)*120,144),(36,32,57,255));d=ImageDraw.Draw(sheet)
    for i,row in enumerate(rows):
        icon=Image.open(REPO/row['source']);sheet.alpha_composite(icon.resize((96,96),Image.Resampling.NEAREST),(i*120+12,8));d.text((i*120+8,116),row['id'],fill=(242,237,244,255))
    sheet.save(HERE/'items-review.png')
    print('Exported',len(rows),'items,24px source/ORA,2x/4x; shared palette and alpha validated')

if __name__=='__main__':main()
