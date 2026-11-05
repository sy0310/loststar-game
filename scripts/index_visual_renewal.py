#!/usr/bin/env python3
"""Index original production outputs without modifying any media or player state."""
from pathlib import Path
import json,hashlib,xml.etree.ElementTree as ET
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'design/visual-renewal'
registrations=[]
for base in ['assets/source/visual-renewal','assets/runtime/visual-renewal']:
 for path in sorted((ROOT/base).rglob('*.json')):
  if 'registration' in path.name.lower():
   registrations.append({'path':path.relative_to(ROOT).as_posix(),'data':json.loads(path.read_text())})
files=[]
for kind in ['source','runtime']:
 for path in sorted((ROOT/f'assets/{kind}/visual-renewal').rglob('*')):
  if not path.is_file() or path.suffix.lower() not in ['.png','.webp','.svg']:continue
  rel=path.relative_to(ROOT).as_posix();raw=path.read_bytes()
  entry={'path':rel,'kind':kind,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
  if path.suffix=='.svg':
   el=ET.fromstring(raw);entry.update(width=el.attrib.get('width'),height=el.attrib.get('height'),provenance='Original integer-grid UI joinery; code-native SVG')
  else:
   with Image.open(path) as im:
    entry.update(width=im.width,height=im.height,mode=im.mode)
    if 'A' in im.getbands():entry['alphaExtrema']=list(im.getchannel('A').getextrema())
  files.append(entry)
items=['receipt','tape','nested','stamp','cosmic-parcel','bell']
states=['found','clean','stabilized']
full=[]
for item in items:
 for stage in states:
  rel=f'assets/runtime/visual-renewal/curios/{item}-{stage}.png'
  if (ROOT/rel).is_file():full.append({'id':item,'state':stage,'path':rel})
result={'schema':1,'approvedReferenceCommit':'48efa5212385273bf4a4f618c9ed88702f1303f1','policy':'Approved boards are references only. All runtime production layers are independent original generation or original code-native UI. Source images, deterministic exports and module registrations are retained. Runtime integration and visual acceptance are recorded separately.','files':files,'moduleRegistrations':registrations,'curioStates':full,'completeCurioStateCount':len(full),'runtimeBytes':sum(f['bytes'] for f in files if f['kind']=='runtime')}
(DEST/'ASSET_REGISTRY.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files':len(files),'curioStates':len(full),'runtimeBytes':result['runtimeBytes'],'registrations':len(registrations)}))
