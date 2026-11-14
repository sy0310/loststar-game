"""Engineering proof for native bitmap source, layers and exact runtime exports."""
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
palette={tuple(bytes.fromhex(color[1:])) for color in json.loads((HERE/'palette.json').read_text())['colors'].values()}
expected={'cannon','drone','arc','missile','blade','shield','lens','lock','capacitor','cooler','magnet','armor','piercebeam','hunterswarm','chainstorm','meteorbarrage','spiralsaw','reactiveaegis','thunderhive','blastwheel','xp_crystal','scrap','pulse','threat','missile_body','blade_body','drone_body','shield_piece','beam_cap','explosion','hit','thruster'}
assert {a['id']for a in manifest['assets']}==expected
rows=[]
for asset in manifest['assets']:
    name=asset['id']
    native=HERE/'source'/(name+'@1x.png')
    im=Image.open(native).convert('RGBA')
    assert list(im.size)==asset['nativeSize'],name
    assert {pixel[3]for pixel in im.getdata()} <= {0,255},name
    assert {pixel[:3]for pixel in im.getdata()if pixel[3]} <= palette,name
    for frame in asset['frames']:
        box=(frame['x'],frame['y'],frame['x']+frame['width'],frame['y']+frame['height'])
        image=im.crop(box)
        bounds=image.getbbox()
        assert list(bounds)==frame['bounds'],name
        assert frame['anchor']==[12,12],name
        assert bounds[0]>=1 and bounds[1]>=1 and bounds[2]<=23 and bounds[3]<=23,(name,bounds)
    with zipfile.ZipFile(native.with_name(name+'.ora'))as archive:
        assert archive.read('mimetype')==b'image/openraster'
        merged=Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
        assert merged.tobytes()==im.tobytes(),name
        tree=ET.fromstring(archive.read('stack.xml'))
        layers=tree.find('stack').findall('layer')
        assert layers,name
        rebuilt=Image.new('RGBA',im.size)
        for layer in reversed(layers):
            rebuilt.alpha_composite(Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA'))
        assert rebuilt.tobytes()==im.tobytes(),name
    for record in asset['files']:
        path=ROOT/record['path']
        raw=path.read_bytes()
        assert len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256'],name
    for scale in [2,4]:
        runtime=ROOT/'prototypes/salvage-survivor-demo/assets/weapons'/(name+'@'+str(scale)+'x.png')
        exported=Image.open(runtime).convert('RGBA')
        assert exported.size==(im.width*scale,im.height*scale),name
        assert exported.tobytes()==im.resize(exported.size,Image.Resampling.NEAREST).tobytes(),name
    rows.append({'id':name,'frames':len(asset['frames']),'nativeSize':list(im.size),'paletteSubset':True,'binaryAlpha':True,'editableMergedMatches':True,'exactNearest':True,'fullTransparentMargin':True,'files':asset['files']})
for record in manifest['sourceInputs']:
    raw=(ROOT/record['path']).read_bytes()
    assert len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256']
assert sum(len(a['frames'])for a in manifest['assets']if a['kind']=='atlas')==14
result={'passed':len(rows),'icons':20,'componentSprites':9,'atlasFrames':14,'scope':'Engineering source/export proof. Runtime integration, art approval and physical-phone acceptance are separate.','assets':rows}
(HERE/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS32 native assets,20 icons,9 sprites,14 animation frames; true alpha,editable layers,exact2x/4x')
