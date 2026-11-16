from pathlib import Path
from PIL import Image
import json,hashlib,zipfile,io
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parents[4];RUNTIME=REPO/'prototypes/salvage-route-demo/assets/v041'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def record(p):return {'path':str(p.relative_to(REPO)),'bytes':p.stat().st_size,'sha256':sha(p)}
palette_path=REPO/'design/star-salvage/v04/production/palette.json';palette=json.loads(palette_path.read_text());allowed={tuple(bytes.fromhex(c[1:]))for c in palette['colors']};assert len(allowed)==37
normalization=json.loads((ROOT/'normalization-records.json').read_text());browser=json.loads((ROOT/'browser-decode.json').read_text());assert browser['passed']==12 and len(browser['checks'])==12
for c in browser['checks']:assert sha(REPO/c['file'])==c['sha256']
assets=[]
for name,label in [('ui_shop','商店/立体供给小舱'),('ui_missions','任务/实体夹板终端')]:
    src=ROOT/'source'/(name+'@1x.png');im=Image.open(src).convert('RGBA');im.load();assert im.size==(24,24)
    alpha=im.getchannel('A');assert set(alpha.getdata())=={0,255};bbox=im.getbbox();assert bbox[0]>=2 and bbox[1]>=2 and bbox[2]<=22 and bbox[3]<=22
    colors={v[:3]for v in im.getdata()if v[3]};assert colors<=allowed
    exports=[]
    for n in(2,4):
        p=RUNTIME/(name+'@'+str(n)+'x.png');out=Image.open(p).convert('RGBA');assert out.size==(24*n,24*n);assert out.tobytes()==im.resize(out.size,Image.Resampling.NEAREST).tobytes();exports.append({**record(p),'size':list(out.size),'nearestExact':True})
    ora=ROOT/'source'/(name+'.ora')
    with zipfile.ZipFile(ora)as z:assert Image.open(io.BytesIO(z.read('mergedimage.png'))).convert('RGBA').tobytes()==im.tobytes()
    raw=ROOT/'raw'/(name+'-generated.png');candidate=Image.open(raw)
    assets.append({'id':name,'label':label,'logicalSize':[24,24],'source':record(src),'editable':record(ora),'generatedCandidate':{**record(raw),'size':list(candidate.size),'method':'built-in image_gen, independent generation'},'prompt':record(ROOT/(name+'.prompt.txt')),'alpha':'binary0/255','nativeAlphaBBox':list(bbox),'transparentSafeMarginAtLeast':2,'opaquePixels':sum(v[3]>0 for v in im.getdata()),'opaqueColorCount':len(colors),'paletteSubset':True,'exports':exports})
refs=[REPO/'design/star-salvage/v04/concepts/salvage_v04_approved_full.png',REPO/'prototypes/salvage-route-demo/assets/v04/item_metal_crate@2x.png',REPO/'prototypes/salvage-route-demo/assets/v04/ship_starter@2x.png']
assert sha(refs[0])=='16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0'
manifest={'schema':1,'scope':'Two production raster entrance icons only; not game integration or user acceptance.','method':'Two independent built-in image_gen calls, then shared-palette/native-grid cleanup; no source-concept crop used.','internalVisual':'DIRECTION_APPROVED_BY_PARENT_KEEP_CURRENT_VERSION','userVisual':'NOT_REVIEWED','physicalPhone':'NOT_TESTED','license':'Original AI-assisted generation for loststar-game; no third-party game art reused.','referenceRole':'style/material/light only','references':[record(p)for p in refs],'palette':{**record(palette_path),'id':palette['id'],'count':37},'light':'upper-left','assets':assets,'normalizationScript':record(ROOT/'normalize-icons.py'),'normalizationRecords':record(ROOT/'normalization-records.json'),'browserDecode':record(ROOT/'browser-decode.json'),'browserChecksPassed':12,'browserScope':browser['scope'],'overview':[record(ROOT/'icons-overview@2x.png'),record(ROOT/'icons-overview-large.png')],'readme':record(ROOT/'README.md')}
(ROOT/'icons-art-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('PASS2 native icons;shared37color palette;alpha safe border;ORA;exact2x/4x;12 hash-bound browser decodes')
