"""Unaccelerated excerpts from the one ordinary recording; retain the full original and explicit provenance."""
from pathlib import Path
import json,subprocess,hashlib
root=Path('artifacts/chapter-one-followup');n=json.loads((root/'natural-evidence.json').read_text());shots={Path(s['file']).stem:s for s in n['screens']};segments=[]
def clip(name,label,start,duration):
 file='videos/'+name+'.mp4';start=max(0,start);duration=min(duration,n['video']['duration']-start)
 subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',str(start),'-i',str(root/n['video']['file']),'-t',str(duration),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(root/file)],check=True)
 segments.append(dict(file=file,label=label,source=n['video']['file'],sourceSha256=n['video']['sha256'],sourceStartSeconds=start,sourceDurationSeconds=duration,qa=False,speed=1,continuousSource=True,sha256=hashlib.sha256((root/file).read_bytes()).hexdigest()))
for id,label in [('receipt','收据伏笔'),('stamp','邮戳关联'),('cosmic-parcel','宇宙包裹与暖色星点')]:
 at=shots['natural-'+id+'-association']['wallMs']/1000
 clip('natural-'+id+'-excerpt','普通源片节选：'+label,at-4,9)
phase=next(t for t in n['timeline'] if t['phase']!='idle')
clip('natural-night-reveal','普通第二夜：同球揭晓连续片段',phase['wallMs']/1000-2,16)
clip('natural-ending-and-real-return','普通结尾与实际离开32秒后回归 · 连续源片（非手机锁屏）',n['endingAt']/1000-3,n['video']['duration'])
(root/'natural-segments.json').write_text(json.dumps(dict(sourceCommit=n['sourceCommit'],segments=segments,note='No speed changes, frame interpolation, QA seeds or reordered footage. Each segment is one continuous source range. Screenshot wall times begin after initial page readiness; generous source-range margins include that startup offset. Full original retained.'),ensure_ascii=False,indent=2)+'\n')
print('Ordinary source excerpts:',len(segments))
