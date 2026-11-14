"""Prove additive native sources and runtime pixels without touching v06."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
manifest=json.loads((HERE/'manifest.json').read_text())
palette={tuple(bytes.fromhex(value[1:]))for value in json.loads((HERE/'palette.json').read_text())['colors'].values()}
expected_icons={'prism','gravity','refraction','singularity','kaleidoscope','collapse','eventhorizon'}
expected_fx={'rail_muzzle','gravity_burst','evolution_corona','fusion_nova'}
assert {a['id']for a in manifest['assets']}==expected_icons|expected_fx
rows=[]
for asset in manifest['assets']:
    name=asset['id'];native=HERE/'source'/(name+'@1x.png')
    im=Image.open(native).convert('RGBA')
    assert list(im.size)==asset['nativeSize'],name
    assert {pixel[3]for pixel in im.getdata()} <= {0,255},name
    assert {pixel[:3]for pixel in im.getdata()if pixel[3]} <= palette,name
    frame_metrics=[];identities=set()
    for frame in asset['frames']:
        box=(frame['x'],frame['y'],frame['x']+frame['width'],frame['y']+frame['height'])
        image=im.crop(box)
        bounds=image.getbbox()
        assert bounds and list(bounds)==frame['bounds'],(name,bounds)
        assert bounds[0]>=1 and bounds[1]>=1 and bounds[2]<=image.width-1 and bounds[3]<=image.height-1,(name,bounds)
        alpha=image.getchannel('A')
        edges=[alpha.crop((0,0,image.width,1)),alpha.crop((0,image.height-1,image.width,image.height)),alpha.crop((0,0,1,image.height)),alpha.crop((image.width-1,0,image.width,image.height))]
        assert all(edge.getextrema()==(0,0)for edge in edges),(name,'opaque edge')
        identity=hashlib.sha256(image.tobytes()).hexdigest()
        assert identity not in identities,(name,'repeated static frame')
        identities.add(identity)
        white=sum(pixel[3]>0 and min(pixel[:3])>220 for pixel in image.getdata())
        occupied=sum(pixel[3]>0 for pixel in image.getdata())
        white_ratio=white/(image.width*image.height)
        if asset['kind']=='atlas':
            assert white_ratio<.03,(name,white_ratio)
            assert occupied/(image.width*image.height)<.6,(name,'opaque field')
        frame_metrics.append({'bounds':list(bounds),'opaquePixels':occupied,'brightIvoryPixels':white,'brightCanvasRatio':white_ratio})
    if name in expected_icons:
        assert im.size==(24,24) and len(asset['frames'])==1,name
    else:
        assert len(asset['frames'])==6,name
        assert asset['durationMs']==sum(frame['durationMs']for frame in asset['frames']),name
        assert asset['durationMs']<=650,name
        assert all(frame['width']==frame['height'] and frame['width']in[24,48] for frame in asset['frames']),name
    if name=='rail_muzzle':
        assert asset['originAnchor']==[12,17]
        assert asset['emissionDirection']==[0,-1]
    with zipfile.ZipFile(native.with_name(name+'.ora'))as archive:
        assert archive.read('mimetype')==b'image/openraster'
        merged=Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
        assert merged.tobytes()==im.tobytes(),name
        layers=ET.fromstring(archive.read('stack.xml')).find('stack').findall('layer')
        assert len(layers)==len(asset['frames']),name
        rebuilt=Image.new('RGBA',im.size)
        for layer in reversed(layers):
            rebuilt.alpha_composite(Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA'))
        assert rebuilt.tobytes()==im.tobytes(),name
    for record in asset['files']:
        raw=(ROOT/record['path']).read_bytes()
        assert len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256'],name
    for scale in [2,4]:
        file=ROOT/'prototypes/salvage-survivor-demo/assets/v061'/(name+'@'+str(scale)+'x.png')
        exported=Image.open(file).convert('RGBA')
        assert exported.size==(im.width*scale,im.height*scale),name
        assert exported.tobytes()==im.resize(exported.size,Image.Resampling.NEAREST).tobytes(),name
    rows.append({'id':name,'nativeSize':list(im.size),'frames':len(asset['frames']),'frameMetrics':frame_metrics,'binaryAlpha':True,'paletteSubset':True,'fullMargin':True,'editableMergedMatches':True,'exactNearest':True,'files':asset['files']})
for record in manifest['sourceInputs']:
    raw=(ROOT/record['path']).read_bytes()
    assert len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256']
legacy=json.loads((HERE/'legacy-baseline.json').read_text())['files']
for record in legacy:
    raw=(ROOT/record['path']).read_bytes()
    assert len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256'],'Accepted v06 changed: '+record['path']
result={'passed':11,'icons':7,'effectAtlases':4,'effectFrames':24,'legacyFilesUnchanged':len(legacy),'scope':'Actual source/export verification. In-game mapping, combat readability and physical-phone review are separate.','assets':rows}
(HERE/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS11 additive assets,7 icons,24 unique VFX frames,transparent margins,palette,ORA,integer2x/4x;129 v06 files unchanged')
