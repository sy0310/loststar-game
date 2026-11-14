#!/usr/bin/env python3
"""Extract native encoded frames for human review; never re-render game evidence."""
from pathlib import Path
import hashlib,json,subprocess,bisect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/v045-a-exploration';DEST=OUT/'review-frames';DEST.mkdir(exist_ok=True)
meta=json.loads((ROOT/'releases/taptap/package-info-fusion.json').read_text());assert meta['version']=='0.4.5'
sha=lambda b:hashlib.sha256(b).hexdigest();records=[]
previous=json.loads((DEST/'index.json').read_text()) if (DEST/'index.json').exists() else None
if previous:assert previous['sourceCommit']==meta['sourceCommit'] and previous['zipSha256']==meta['sha256']
def extract(mode,requests):
 report=json.loads((OUT/f'{mode}-evidence.json').read_text());assert report['sourceCommit']==meta['sourceCommit'] and report['zipSha256']==meta['sha256'] and report['complete'] and not report['errors']
 case=report['cases'][0];video=report['videos'][0];file=OUT/video['file'];assert sha(file.read_bytes())==video['sha256']
 probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(file)]));times=[float(x['best_effort_timestamp_time']) for x in probe['frames']]
 for label,row in requests(case['trace']):
  index=bisect.bisect_left(times,row['elapsedMs']/1000);assert index<len(times)
  dest=DEST/f'{label}.png'
  if dest.exists():
   old=next(x for x in previous['frames'] if x['label']==label);assert old['sourceVideoSha256']==video['sha256'] and old['frameIndex']==index and old['sha256']==sha(dest.read_bytes());records.append(old);continue
  subprocess.run(['ffmpeg','-v','error','-i',str(file),'-vf',f'select=eq(n\\,{index})','-fps_mode','passthrough','-frames:v','1',str(dest)],check=True)
  raw=dest.read_bytes();records.append({'label':label,'file':str(dest.relative_to(OUT)),'bytes':len(raw),'sha256':sha(raw),'sourceVideo':video['file'],'sourceVideoSha256':video['sha256'],'frameIndex':index,'ptsSeconds':times[index],'nearbyObservedAt':row['at'],'traceElapsedMs':row['elapsedMs'],'observation':row['visual'],'method':'One actual encoded native frame. No crop, overlay, repaint, scale or interpolation. Scenario label is a review request, not a pixel-based occlusion pass.'})
def orbit(rows):
 groups=[]
 for row in rows:
  flag=row['visual']['ship']
  if not groups or groups[-1][0]['visual']['ship']!=flag:groups.append([])
  groups[-1].append(row)
 back=max((x for x in groups if x[0]['visual']['ship']=='back'),key=len);front=max((x for x in groups if x[0]['visual']['ship']=='front'),key=len)
 return [('orbit-rear-middle',back[len(back)//2]),('orbit-front-middle',front[len(front)//2]),('orbit-entering-rear',back[0]),('orbit-emerging-front',next(x[0] for x in groups if x[0]['elapsedMs']>back[-1]['elapsedMs'] and x[0]['visual']['ship']=='front'))]
def paper(rows):
 result=[]
 for phase in ['track','identify','contain','result','return']:
  match=[r for r in rows if r['visual']['phase']==phase and r['visual']['anomaly']=='paper-shadow'];assert match,phase;result.append(('night-paper-'+phase,match[len(match)//2]))
 dawn=[r for r in rows if r['visual']['phase']=='dawn' and r.get('lastNight')]
 assert len(dawn)>2
 result.extend([('morning-repair-early',dawn[1]),('morning-repair-late',dawn[2])])
 return result
extract('assist',orbit);extract('night',paper)
(DEST/'index.json').write_text(json.dumps({'schema':1,'sourceCommit':meta['sourceCommit'],'zipSha256':meta['sha256'],'method':'Supplemental human-review samples from two unchanged native continuous films; labels need human visual review and do not replace the films.','frames':records},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'sourceCommit':meta['sourceCommit'],'nativeFrames':len(records),'index':str(DEST/'index.json')}))
