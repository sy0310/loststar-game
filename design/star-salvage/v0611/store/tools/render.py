"""Build the stills and edit from timestamped browser takes; run from any directory."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

STORE = Path(__file__).resolve().parents[1]
ROOT = STORE.parents[3]
RAW = ROOT / 'releases/store-v0611/raw'
WORK = ROOT / 'releases/store-v0611/edit'
TYPE = ROOT / 'design/star-salvage/promo-typography'
sys.path.insert(0, str(TYPE))
from typography import lettering

HERO = ROOT / 'design/star-salvage/v068/store-media/exports/taptap-keyvisual-no-text-1920x1080.png'
MARK = TYPE / 'wordmark-transparent.png'
MUSIC = ROOT / 'artifacts/taptap-promo-v1/source-footage/original-project-theme.wav'
SYSTEM_FONT = os.environ.get('STORE_SYSTEM_FONT', '/System/Library/Fonts/STHeiti Medium.ttc')
SOURCE = '2322f30a696d90a73e4105bdff2049392eca2eeb'
SCRIPTS = 'tools/checkpoints.cjs → tools/capture.cjs → tools/render.py'
# Each selector is seconds from the first compositor frame, never from simulated time.
POSTERS = [
    ('01-horde','horde',1.4,'一指走位','满屏割草','拖动飞船，武器自动开火'),
    ('02-choice','opening',5.9,'三选一','越打越强','每次升级，选出下一招'),
    ('03-swarm','electric',3.35,'蜂群出击','电弧连锁','让电网沿着敌舰一路跳过去'),
    ('04-boss','boss',2.02,'迎战','裁决舰','绕过舰炮，贴着弹幕找空隙'),
    ('05-fusion','fusion',1.45,'融合','引出黑洞','棱镜与引力锚进化，合成星环奇点'),
]
# start, length, left headline, supporting caption on the opposite side
CUTS = [
    ('horde',1.15,3.0,'像素太空','满屏割草','拖动飞船','武器自动开火'),
    ('opening-weave',19.8,3.2,'一根手指','穿过敌群','绕开子弹','沿途收经验'),
    ('opening',5.95,2.8,'升级停一下','三选一','挑好下一招','马上回到战场'),
    ('electric',1.05,3.8,'放出蜂群','接上电网','电弧跳跃','打穿一串敌舰'),
    ('fusion',0.82,3.6,'武器融合','黑洞现身','星环奇点','把敌舰拉到一起'),
    ('boss',1.45,4.0,'裁决舰','正面压境','撑过十五分钟','把零件带回港'),
]
END_SECONDS = 3.6

def ff(*args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)

def base_args():
    return ['-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-threads','5']

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def meta(scene):
    return json.loads((RAW/scene/'take.json').read_text())

def rel(path):
    return path.relative_to(STORE).as_posix()

def text_at(canvas, text, size, at, *, gold=False, max_width=1000):
    art=lettering(text,size,gold=gold,hero=gold,max_width=max_width)
    canvas.alpha_composite(art, at)
    return art

def small(draw, text, x, y, size, color):
    draw.text((x,y),text,font=ImageFont.truetype(SYSTEM_FONT,size),anchor='lt',fill=color)

def poster(spec):
    name,scene,at,first,second,sub=spec
    take=meta(scene)
    sample=min((s for s in take['samples'] if s.get('still') and
               s['mode']==('upgrade' if scene=='opening' else 'play')),
               key=lambda s:abs(s['at']-take['firstFrame']-at))
    src=RAW/scene/sample['still']
    original=Image.open(src).convert('RGB')
    canvas=Image.new('RGBA',(1080,2210),'#151025')
    sky=Image.open(HERO).crop((0,0,820,280)).resize((1080,289),Image.Resampling.LANCZOS).convert('RGBA')
    sky.alpha_composite(Image.new('RGBA',sky.size,(20,12,40,112)))
    canvas.alpha_composite(sky,(0,0))
    a=lettering(first,144,max_width=490)
    b=lettering(second,144,hero=True,gold=True,max_width=535)
    left=(1080-a.width-b.width-20)//2
    canvas.alpha_composite(a,(left,26+(max(a.height,b.height)-a.height)//2))
    canvas.alpha_composite(b,(left+a.width+20,26+(max(a.height,b.height)-b.height)//2))
    d=ImageDraw.Draw(canvas)
    font=ImageFont.truetype(SYSTEM_FONT,42)
    d.text((540,222),sub,font=font,fill='#e3daff',anchor='mt')
    d.rectangle((0,283,1079,289),fill='#9d6ad6')
    d.rectangle((48,283,170,289),fill='#ffcf76')
    canvas.paste(original.resize((1080,1920),Image.Resampling.LANCZOS),(0,290))
    dest=STORE/'screenshots'/(name+'.jpg')
    canvas.convert('RGB').save(dest,quality=94,subsampling=0,optimize=True)
    return {'file':rel(dest),'take':scene,'frame':sample['still'],'secondsFromFirstFrame':round(sample['at']-take['firstFrame'],3),
            'sampleBeforeScreenshot':{'modelSeconds':round(sample['time'],2),'kills':sample['kills'],'level':sample['level']},
            'title':[first,second],'subtitle':sub,'titleInkHeightsPx':[a.height,b.height],'rawFrameSHA256':sha(src)}

def side_overlay(i,cut):
    scene,start,duration,first,second,third,fourth=cut
    image=Image.new('RGBA',(1920,1080),(0,0,0,0))
    d=ImageDraw.Draw(image)
    for x in (653,1265):d.rectangle((x,0,x+2,1080),fill=(178,139,229,160))
    # Keep the central 9:16 frame clear, including its HUD.
    d.rectangle((61,370,206,375),fill='#eebf6d')
    text_at(image,first,94,(53,407),max_width=548)
    text_at(image,second,114,(48,526),gold=True,max_width=562)
    d.rectangle((1353,455,1431,460),fill='#c59df4')
    small(d,third,1352,501,58,'#fff2cc')
    small(d,fourth,1352,596,44,'#efe8ff')
    path=WORK/f'sides-{i}.png'
    image.save(path)
    return path

def clip_source(scene):
    dest=WORK/(scene+'.mp4')
    ff('-f','concat','-safe','0','-i',RAW/scene/'frames.ffconcat','-vf','fps=30','-an',
       '-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p',dest)
    return dest


def review_frames(trailer, cuts):
    # Extract one actual encoded frame per shot, including the closing CTA.
    moments=[]
    at=0
    for cut in cuts:
        moments.append(round(at+min(1,cut[2]/2),2))
        at+=cut[2]
    moments.append(round(at+1.5,2))
    sheet=Image.new('RGB',(900,4*279),'#181323')
    draw=ImageDraw.Draw(sheet)
    for i,second in enumerate(moments):
        frame=WORK/f'review-{i}.jpg'
        ff('-ss',second,'-i',trailer,'-vf','scale=448:252','-frames:v','1','-q:v','2',frame)
        x,y=(i%2)*450,(i//2)*279
        with Image.open(frame) as image:
            sheet.paste(image,(x,y))
        small(draw,f'{second:05.2f} s',x+7,y+256,16,'#e7dcf6')
    sheet.save(STORE/'review/trailer-keyframes.jpg',quality=92,optimize=True)

def media():
    WORK.mkdir(parents=True,exist_ok=True)
    for directory in ('screenshots','trailer','gameplay','review'):
        (STORE/directory).mkdir(exist_ok=True)
    posters=[poster(p) for p in POSTERS]
    scenes=sorted({cut[0] for cut in CUTS})
    sources={s:clip_source(s) for s in scenes}
    segments=[]
    first_choice=next(s for s in meta('opening')['samples'] if s['mode']=='upgrade')
    choice_at=round(first_choice['at']-meta('opening')['firstFrame']+.12,2)
    cuts=[(c[0],choice_at,*c[2:]) if c[0]=='opening' and c[3]=='升级停一下' else c for c in CUTS]
    for i,cut in enumerate(cuts):
        scene,start,duration,*_=cut
        dest=WORK/f'cut-{i}.mp4'
        # Work at quarter resolution for the out-of-focus backdrop; draw a sharp
        # full-height portrait on top using the same timestamp and footage.
        filter_graph=('[0:v]setpts=PTS-STARTPTS,split=2[bg][center];[bg]scale=480:-1,crop=480:270,'
                      'gblur=sigma=14,eq=brightness=-0.105:saturation=0.85,scale=1920:1080,setsar=1[wash];'
                      '[center]scale=608:1080:flags=lanczos,setsar=1[portrait];'
                      '[wash][portrait]overlay=656:0[plate];[plate][1:v]overlay=0:0,format=yuv420p[v]')
        ff('-ss',start,'-i',sources[scene],'-i',side_overlay(i,cut),'-filter_complex',filter_graph,
           '-map','[v]','-frames:v',round(30*duration),'-an',*base_args(),dest)
        segments.append(dest)

    endcard=Image.open(HERO).convert('RGBA')
    mark=Image.open(MARK).convert('RGBA')
    mark.thumbnail((750,286),Image.Resampling.LANCZOS)
    endcard.alpha_composite(mark,((870-mark.width)//2,287))
    text_at(endcard,'TapTap 搜索 失物号',63,(100,655),max_width=720)
    endcard.convert('RGB').save(WORK/'end.jpg',quality=97)
    end=WORK/'end.mp4'
    ff('-loop','1','-framerate','30','-i',WORK/'end.jpg','-t',END_SECONDS,*base_args(),end)
    segments.append(end)
    concat=WORK/'cuts.ffconcat'
    concat.write_text('ffconcat version 1.0\n'+''.join("file '"+f.name+"'\n" for f in segments))
    total=round(sum(c[2] for c in CUTS)+END_SECONDS,2)
    trailer=STORE/'trailer/trailer-16x9.mp4'
    ff('-f','concat','-safe','0','-i',concat,'-ss','3','-i',MUSIC,'-map','0:v','-map','1:a','-c:v','copy',
       '-af',f'atrim=duration={total},loudnorm=I=-17:LRA=8:TP=-1.5,aresample=48000,afade=t=in:d=0.12,afade=t=out:st={total-.7}:d=0.7','-t',total,
       '-c:a','aac','-b:a','192k','-movflags','+faststart',trailer)
    review_frames(trailer,cuts)
    cover=STORE/'trailer/cover-16x9.jpg'
    ff('-ss','1.04','-i',trailer,'-frames:v','1','-q:v','2',cover)
    opening=meta('opening')
    delay=round(1000*(opening['audioStart']-opening['firstFrame']))
    gameplay=STORE/'gameplay/first-minute-9x16.mp4'
    ff('-i',sources['opening'],'-i',RAW/'opening/game-audio.webm','-t','35','-map','0:v','-map','1:a',
       '-vf','scale=720:1280:flags=lanczos','-af',f'adelay={delay}:all=1',*base_args(),
       '-c:a','aac','-b:a','160k','-movflags','+faststart',gameplay)
    elapsed=0
    edits=[]
    for scene,start,seconds,*caption in cuts:
        edits.append({'take':scene,'sourceIn':start,'duration':seconds,'timelineIn':round(elapsed,2),'captions':caption})
        elapsed+=seconds
    takes={}
    for s in scenes:
        r=meta(s)
        assert r['source']==SOURCE
        takes[s]={'viewportCSS':[396,704],'deviceScaleFactor':2,'screenshotPixels':[792,1408],
                  'videoCompositorPixels':[396,704],'checkpoint':r['checkpoint'],'rawFrames':r['frames'],
                  'elapsedSeconds':round(r['end']-r['firstFrame'],3)}
    files=[STORE/p['file'] for p in posters]+[trailer,cover,gameplay]
    manifest={'sourceCommit':SOURCE,'packageId':520084,'language':'zh-CN','tools':SCRIPTS,
       'assetSource':'Original player entry, fresh isolated Chromium profiles. Model-earned checkpoints retain actual kills, time, level, cards, weapons and enemies. No synthetic HUD or speed changes.',
       'titles':'design/star-salvage/promo-typography/typography.py; Smiley Sans Oblique, SIL OFL 1.1. Supporting lines use macOS STHeiti Medium.',
       'takes':takes,'screenshots':posters,'trailer':{'file':rel(trailer),'edit':edits,'endCard':{'duration':END_SECONDS,
           'art':HERO.relative_to(ROOT).as_posix(),'wordmark':MARK.relative_to(ROOT).as_posix(),'text':'TapTap 搜索 失物号'},
           'music':MUSIC.relative_to(ROOT).as_posix(),'musicSourceIn':3,'musicMix':'EBU R128 target -17 LUFS / -1.5 dBTP, short in/out fades','rate':1,'cover':{'file':rel(cover),'timelineSecond':1.04}},
       'gameplayDemo':{'file':rel(gameplay),'take':'opening','sourceIn':0,'duration':35,'audio':'actual game mixer output; aligned to compositor clock',
            'entryClickSeconds':round(opening['start']-opening['firstFrame'],3)},
       'files':[{'path':rel(f),'bytes':f.stat().st_size,'sha256':sha(f)} for f in files]}
    (STORE/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')

if __name__=='__main__':
    media()
