"""Read-only screenshot/source comparison for the unfrozen3x HOME sprite."""
from PIL import Image,ImageFilter
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[4]
source_path=REPO/'prototypes/salvage-route-demo/assets/v04/ship_starter@2x.png'
source=Image.open(source_path).convert('RGBA');native_bbox=source.getbbox();colors={p[:3]for p in source.getdata()if p[3]==255}
report=json.loads((ROOT/'UNFROZEN-after-observation.json').read_text());checks=[]
for view in report['views']:
    image=next(i for i in view['home']['images']if i['class']=='ship-sprite');b=image['bounds'];cta=next(i for i in view['home']['buttons']if i['text']=='出发')['bounds'];w,h=round(b['width']),round(b['height']);assert(w,h)==(288,144)
    screenshot=Image.open(ROOT/('UNFROZEN-after-home-'+str(view['width'])+'x'+str(view['height'])+'.png')).convert('RGB');expected=source.resize((w,h),Image.Resampling.NEAREST);alpha=expected.getchannel('A').point(lambda a:255 if a==255 else 0).filter(ImageFilter.MinFilter(3));samples=differences=off_palette=0;difference_points=[]
    for y in range(h):
        for x in range(w):
            if alpha.getpixel((x,y)):
                samples+=1;pixel=screenshot.getpixel((round(b['x'])+x,round(b['y'])+y));diff=pixel!=expected.getpixel((x,y))[:3];differences+=diff;off_palette+=pixel not in colors
                if diff:difference_points.append((round(b['x'])+x,round(b['y'])+y))
    opaque_bottom=b['y']+native_bbox[3]*h/source.height
    checks.append({'width':view['width'],'height':view['height'],'shipDisplayed':[w,h],'erodedOpaquePixelSamples':samples,'differentFromExactNearest':differences,'mismatchBBox':([min(x for x,y in difference_points),min(y for x,y in difference_points),max(x for x,y in difference_points)+1,max(y for x,y in difference_points)+1]if difference_points else None),'outsideSourcePalette':off_palette,'opaqueShipBottom':opaque_bottom,'ctaTop':cta['y'],'opaqueShipToCTAGap':cta['y']-opaque_bottom,'gameStateUnchanged':view['gameStateUnchanged']})
out={'scope':'UNFROZEN screenshot observation only; actual opaque sprite interiors versus exactNEAREST expected pixels; not phone testing.','sourceSha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'nativeAlphaBBox':list(native_bbox),'checks':checks}
(ROOT/'UNFROZEN-after-pixel-check.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(checks,indent=2))
