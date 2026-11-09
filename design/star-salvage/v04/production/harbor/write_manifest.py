from pathlib import Path
import hashlib,json,zipfile,io
from PIL import Image
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[4]
RUNTIME=REPO/'prototypes/salvage-route-demo/assets/v04'
pal=json.loads((ROOT.parent/'palette.json').read_text());allowed={tuple(bytes.fromhex(x.lstrip('#')))for x in pal['colors']}
def file(p):
    raw=p.read_bytes();return {'path':str(p.relative_to(REPO)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
items=[]
for name in ['harbor_bg','harbor_front']:
    p=ROOT/'source'/(name+'@1x.png');im=Image.open(p);im.load();assert im.size==(192,320)
    colors={x[:3]for x in im.convert('RGBA').getdata()if x[3]};assert colors<=allowed
    if name=='harbor_front':
        assert set(im.getchannel('A').getdata())=={0,255}
        assert im.getchannel('A').crop((0,0,192,280)).getbbox()is None
        assert im.getchannel('A').crop((40,0,153,320)).getbbox()is None
    ex=[]
    for k in [2,4]:
        output=RUNTIME/(name+'@'+str(k)+'x.png');actual=Image.open(output);actual.load()
        expected=im.resize((192*k,320*k),Image.Resampling.NEAREST)
        assert actual.tobytes()==expected.tobytes()
        ex.append({**file(output),'width':actual.width,'height':actual.height,'nearestExact':True})
    ora=ROOT/'source'/(name+'.ora')
    with zipfile.ZipFile(ora)as z:
        assert Image.open(io.BytesIO(z.read('mergedimage.png'))).tobytes()==im.tobytes()
    raw=ROOT/'raw'/(name+'-generated.png');ri=Image.open(raw)
    items.append({'id':name,'requirementId':'harbor_background'if name=='harbor_bg'else'harbor_foreground','logicalSize':[192,320],'source':file(p),'editable':file(ora),'generatedCandidate':{**file(raw),'width':ri.width,'height':ri.height},'prompt':file(ROOT/(name+'.prompt.txt')),'alpha':name=='harbor_front','opaqueColorCount':len(colors),'paletteSubset':True,'nativeAlphaBBox':list(im.getchannel('A').getbbox())if name=='harbor_front'else[0,0,192,320],'exports':ex})
browser=json.loads((ROOT/'harbor-browser-decode.json').read_text());assert browser['passed']==12 and len(browser['checks'])==12
for row in browser['checks']:assert hashlib.sha256((REPO/row['file']).read_bytes()).hexdigest()==row['sha256']
assert hashlib.sha256((REPO/'design/star-salvage/v04/concepts/salvage_v04_approved_full.png').read_bytes()).hexdigest()=='16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0'
manifest={'browserDecode':file(ROOT/'harbor-browser-decode.json'),'browserProducerChecks':12,'schema':1,'method':'Two independent built-in image_gen calls; original project artwork, no concept cropping. Generated candidates sampled/semantically cleaned on native192x320 palette, exact NEAREST exports.','reference':'design/star-salvage/v04/concepts/salvage_v04_approved_full.png','referenceSha256':'16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0','paletteId':pal['id'],'palette':file(ROOT.parent/'palette.json'),'light':'upper-left','shipAnchorSuggestion':[22,222],'shipFeetBaseline':270,'foregroundAbove280Empty':True,'foregroundCTACenterEmpty':[40,0,153,320],'internalVisual':'BACKGROUND_DIRECTION_APPROVED_BY_PARENT; foreground pending parent review','userVisual':'NOT_REVIEWED','physicalPhone':'NOT_TESTED','license':'Original AI-assisted generation for loststar-game; no third-party game pixels reused.','files':items,'normalization':file(ROOT/'normalize_harbor.py'),'layerPreview':file(ROOT/'harbor-layer-preview@2x.png')}
(ROOT.parent/'harbor-art-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('PASS2 independent layers; shared palette; alpha/crop-safe regions;1x/ORA and exact2x/4x checked')
