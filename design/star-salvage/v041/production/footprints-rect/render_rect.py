"""Authoring exports for five complete top-down cargo bodies; not game geometry code.

Generated candidates remain separate. This step rebuilds on the24px/cell native
grid, applies declared pixel edits, and exports exact integer nearest images.
It never reads/crops the approved concept art into production sprites.
"""
from pathlib import Path
import hashlib,io,json,zipfile,xml.etree.ElementTree as ET
from PIL import Image,ImageDraw

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[4]
OUT=REPO/'prototypes/salvage-route-demo/assets/v041'
PAL_PATH=REPO/'design/star-salvage/v04/production/palette.json'
PAL=json.loads(PAL_PATH.read_text())
COLORS=[tuple(bytes.fromhex(c[1:]))for c in PAL['colors']]
HEX={tuple(bytes.fromhex(c[1:])):c for c in PAL['colors']}
CELL=24
NAMES={'line2':'连接组件','line3':'散热导轨','square4':'金属运输箱','rect6':'散热总成','rect8':'引擎总成'}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def png(im):
    f=io.BytesIO();im.save(f,format='PNG');return f.getvalue()
def closest(rgb):return min(COLORS,key=lambda p:sum(w*(a-b)**2 for a,b,w in zip(p,rgb,(2,3,2))))

def editable(im,target,id):
    families={'highlights':set(PAL['colors'][11:14]+PAL['colors'][23:25]+PAL['colors'][29:30]),
              'copper_and_indicators':set(PAL['colors'][19:]),
              'structure':set(PAL['colors'][:6]),'steel':set()}
    layers={name:Image.new('RGBA',im.size)for name in families}
    for y in range(im.height):
        for x in range(im.width):
            p=im.getpixel((x,y))
            if not p[3]:continue
            name=next((k for k,v in families.items()if HEX[p[:3]]in v),'steel')
            layers[name].putpixel((x,y),p)
    image=ET.Element('image',{'version':'0.0.3','w':str(im.width),'h':str(im.height),'name':'cargo_'+id})
    stack=ET.SubElement(image,'stack')
    with zipfile.ZipFile(target,'w')as z:
        def write(name,data,compression=zipfile.ZIP_DEFLATED):
            info=zipfile.ZipInfo(name,(2026,11,9,0,0,0));info.compress_type=compression;z.writestr(info,data)
        write('mimetype','image/openraster',zipfile.ZIP_STORED)
        for i,(name,layer)in enumerate(layers.items()):
            src=f'data/layer{i}.png';write(src,png(layer))
            ET.SubElement(stack,'layer',{'name':name,'src':src,'x':'0','y':'0','opacity':'1.0','visibility':'visible','composite-op':'svg:src-over'})
        write('stack.xml',ET.tostring(image,encoding='utf-8'));write('mergedimage.png',png(im))
        write('Thumbnails/thumbnail.png',png(im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST)))

def native(request):
    path=HERE/'raw'/('cargo_'+request['id']+'_generated.png')
    raw=Image.open(path).convert('RGBA')
    alpha=raw.getchannel('A').point(lambda x:255 if x>=128 else 0)
    box=alpha.getbbox();assert box,'Empty raw candidate'
    clean=raw.copy();clean.putalpha(alpha)
    # The body itself, not a colored tile, is regridded across its true footprint.
    w,h=request['width'],request['height']
    body=clean.crop(box)
    if request['id']=='rect8':
        # Keep the mechanical core circular in top view. Regrid the rectangular
        # side wings separately instead of globally squeezing the central ring.
        uniform=body.resize((round(body.width*(h-2)/body.height),h-2),Image.Resampling.BOX)
        core_w=40;left_edge=(uniform.width-core_w)//2;right_edge=left_edge+core_w
        left_w=(w-2-core_w)//2;right_w=w-2-core_w-left_w
        small=Image.new('RGBA',(w-2,h-2))
        small.alpha_composite(uniform.crop((0,0,left_edge,h-2)).resize((left_w,h-2),Image.Resampling.BOX),(0,0))
        small.alpha_composite(uniform.crop((left_edge,0,right_edge,h-2)),(left_w,0))
        small.alpha_composite(uniform.crop((right_edge,0,uniform.width,h-2)).resize((right_w,h-2),Image.Resampling.BOX),(left_w+core_w,0))
    else:small=body.resize((w-2,h-2),Image.Resampling.BOX)
    result=Image.new('RGBA',(w,h))
    for y in range(h-2):
        for x in range(w-2):
            r,g,b,a=small.getpixel((x,y))
            if a>=128:result.putpixel((x+1,y+1),(*closest((r,g,b)),255))
    edits_path=HERE/'pixel-edits.json'
    edits=json.loads(edits_path.read_text()).get(request['id'],[])if edits_path.exists()else[]
    for x,y,color in edits:
        assert 1<=x<w-1 and 1<=y<h-1,'No edits may erase the outside safety border'
        if color is None:p=(0,0,0,0)
        else:
            assert color in PAL['colors'];p=(*bytes.fromhex(color[1:]),255)
        result.putpixel((x,y),p)
    return result,box,raw.size,edits

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    for name in ['native1x','editable']: (HERE/name).mkdir(exist_ok=True)
    reviews=json.loads((HERE/'review.json').read_text()).get('items',{}) if (HERE/'review.json').exists() else {}
    rows=[]
    for req in json.loads((HERE/'prompts/requests.json').read_text()):
        id=req['id'];im,box,raw_size,edits=native(req)
        assert im.width%CELL==0 and im.height%CELL==0
        bounds=im.getbbox();assert bounds[0]>=1 and bounds[1]>=1 and bounds[2]<=im.width-1 and bounds[3]<=im.height-1
        assert set(im.getchannel('A').getdata())<={0,255}
        visible={p[:3]for p in im.getdata()if p[3]};assert visible<=set(COLORS)
        coverage=[]
        for y in range(im.height//CELL):
            for x in range(im.width//CELL):
                cell=im.crop((x*CELL,y*CELL,(x+1)*CELL,(y+1)*CELL))
                rate=sum(a==255 for a in cell.getchannel('A').getdata())/(CELL*CELL)
                coverage.append({'cell':[x,y],'opaquePixels':round(rate*CELL*CELL),'coverage':round(rate,6)})
                assert rate>=.70,(id,'cell below70% physical fill',x,y,rate)
        src=HERE/'native1x'/('cargo_'+id+'@1x.png');im.save(src)
        ora=HERE/'editable'/('cargo_'+id+'.ora');editable(im,ora,id)
        exports=[]
        for scale in [2,4]:
            out=OUT/('cargo_'+id+f'@{scale}x.png')
            large=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST);large.save(out)
            assert Image.open(out).convert('RGBA').tobytes()==large.tobytes()
            exports.append({'path':str(out.relative_to(REPO)),'scale':scale,'width':large.width,'height':large.height,'bytes':out.stat().st_size,'sha256':sha(out)})
        raw=HERE/'raw'/('cargo_'+id+'_generated.png')
        rows.append({'shapeId':id,'name':NAMES[id],'nativeSize':list(im.size),'logicalCellPixels':CELL,
                     'cells':[[x,y]for y in range(im.height//CELL)for x in range(im.width//CELL)],
                     'source':str(src.relative_to(REPO)),'sourceSha256':sha(src),'sourceBytes':src.stat().st_size,
                     'editableSource':str(ora.relative_to(REPO)),'editableSourceSha256':sha(ora),
                     'candidate':str(raw.relative_to(REPO)),'candidateSha256':sha(raw),'generatedSize':list(raw_size),'generatedVisibleBounds':list(box),
                     'prompt':req['prompt'],'tool':'built-in image_gen','referenceRole':req['referenceRole'],
                     'exports':exports,'alpha':'binary0/255','paletteColorsUsed':len(visible),'visibleBounds':list(bounds),'cellCoverage':coverage,
                     'singleWholeObject':True,'camera':'orthographic-top-down','cellGridOrCategoryBadgeBaked':False,
                     'nativeRegrid':'round-core-preserving side-wing regrid' if id=='rect8' else 'orthographic material regrid','nativePixelEdits':edits,'internalVisual':'INTERNAL_PASS' if reviews.get(id,{}).get('sourceSha256')==sha(src) else 'PENDING_PARENT_REVIEW','userArtAccepted':False,'physicalPhoneTested':False})
    manifest={'schema':1,'kind':'whole_cargo_footprint_rectangles','logicalCellPixels':CELL,
              'palette':str(PAL_PATH.relative_to(REPO)),'paletteSha256':sha(PAL_PATH),'minimumPerCellOpaqueCoverage':.70,
              'process':'Five independent original image_gen calls. Raw candidates preserved; native regrid, palette/alpha cleanup and declared pixel edits; exact nearest integer exports. No concept extraction or small-icon/frame composition.',
              'internalVisualReview':str((HERE/'review.json').relative_to(REPO)),'items':rows,'license':'Original project artwork produced with built-in image_gen and native-grid cleanup. No third-party game assets.'}
    (HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    # QA-only contact sheet; no grid baked into a runtime object.
    sheet=Image.new('RGBA',(680,530),(36,32,57,255));d=ImageDraw.Draw(sheet)
    positions={'line2':(20,35),'line3':(240,35),'square4':(20,190),'rect6':(240,190),'rect8':(240,375)}
    for row in rows:
        im=Image.open(REPO/row['source']);x,y=positions[row['shapeId']];scale=3
        sheet.alpha_composite(im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST),(x,y))
        d.text((x,y-19),row['shapeId']+' / '+str(row['nativeSize'])+' / min '+str(round(min(c['coverage']for c in row['cellCoverage'])*100,1))+'%',fill=(242,237,244,255))
    sheet.save(HERE/'rect-footprints-review.png')
    print('Validated',len(rows),'whole-object footprints, all cells>=70%, source/ORA/2x/4x exported')

if __name__=='__main__':main()
