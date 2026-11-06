/** Real 1x native-film playback for internal review, separate from game/phone performance. */
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out='artifacts/v045-a-exploration',meta=JSON.parse(await fs.readFile('releases/taptap/package-info-fusion.json','utf8'));
const sha=raw=>createHash('sha256').update(raw).digest('hex'),check=(x,m)=>{if(!x)throw Error(m);};
const base=process.env.GALLERY_ORIGIN??'http://127.0.0.1:4247/',reports=[];
for(const mode of ['cases','screens','collection','assist','night','museum']){const r=JSON.parse(await fs.readFile(`${out}/${mode}-evidence.json`));check(r.complete&&!r.errors.length&&r.sourceCommit===meta.sourceCommit&&r.zipSha256===meta.sha256,'Current complete film reports required');reports.push(r);}
const tasks=[];
for(const r of reports)for(const c of r.cases.filter(c=>c.video)){
 const video=c.video,segments=[];
 if(r.mode==='collection'){
  if(c.excavation)segments.push({name:'actual-free-excavation',start:(c.excavation.clickedAt-c.reviewStartedAt)/1000,seconds:6.5});
  segments.push({name:'actual-representative-interaction',start:(c.freeReplays[0].clickedAt-c.reviewStartedAt)/1000,seconds:3.25});
 }else if(r.mode==='museum')for(const v of c.completeVisits.slice(0,2))segments.push({name:`physical-${v.id}`,start:Math.max(0,v.sequence[0].elapsedMs/1000-.1),seconds:9});
 else if(r.mode==='night')segments.push({name:'paper-incident-through-morning',start:279.8,seconds:24});
 else if(r.mode==='assist')segments.push({name:'received-three-tiers-and-decay',start:0,seconds:7.8});
 else segments.push({name:'three-real-installations',start:0,seconds:video.durationSeconds});
 const bytes=await fs.readFile(`${out}/${video.file}`);check(sha(bytes)===video.sha256,'Actual film bytes changed');tasks.push({mode:r.mode,name:c.name,video,segments});
}
check(tasks.length===12,'Twelve unique real films required');await fs.mkdir(`${out}/playback-review`,{recursive:true});
const result={schema:1,sourceCommit:meta.sourceCommit,zipSha256:meta.sha256,physicalPhone:false,playbackRate:1,audioAudited:false,fullFilmFrameByFrameReview:false,
 method:'Actual Chromium HTMLVideoElement playback from unchanged fetched film Blob (avoids static-server Range limitations), muted, 1x; selected continuous work/contact segments and two physical visits per museum variant. Seeking selects review windows only; the delivered parent films stay unedited. Counts concern encoded-film playback, not production game FPS or artistic/user acceptance.',cases:[],errors:[]};
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
try{
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));await page.goto(`${base}${out}/`,{waitUntil:'domcontentloaded'});
 for(const t of tasks){const entry={name:t.name,mode:t.mode,sourceVideo:t.video.file,sourceVideoSha256:t.video.sha256,segments:[],humanVisualAcceptance:'not-inferred'};result.cases.push(entry);
  await page.setContent(`<html><head><style>html,body{margin:0;background:#211232}video{display:block;width:390px;height:844px;object-fit:contain}</style></head><body><video id="clip" muted playsinline preload="auto" ></video></body></html>`,{waitUntil:'domcontentloaded'});
  await page.evaluate(async url=>{const response=await fetch(url);if(!response.ok)throw Error('Native film fetch failed');document.querySelector('video').src=URL.createObjectURL(await response.blob());},`${base}${out}/${t.video.file}`);
  await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
  for(const segment of t.segments){const duration=await page.locator('video').evaluate(v=>v.duration),seconds=Math.min(segment.seconds,duration-segment.start-.02);check(seconds>2,'Review segment outside actual film');
   await page.locator('video').evaluate(async(v,start)=>{v.pause();v.playbackRate=1;v.currentTime=start;await new Promise(resolve=>{if(!v.seeking)resolve();else v.addEventListener('seeked',resolve,{once:true});});await v.play();},segment.start);
   const began=Date.now(),samples=[],frames=[];
   for(const fraction of [.12,.5,.9]){const expected=segment.start+seconds*fraction;await page.waitForFunction(at=>document.querySelector('video').currentTime>=at,expected,{timeout:30000});
    const sample=await page.locator('video').evaluate(v=>({time:v.currentTime,rate:v.playbackRate,paused:v.paused,ready:v.readyState,quality:v.getVideoPlaybackQuality().toJSON?.()??{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames}}));samples.push(sample);
    const file=`playback-review/${t.name}-${segment.name}-${Math.round(fraction*100)}.png`;await page.screenshot({path:`${out}/${file}`,scale:'css'});const raw=await fs.readFile(`${out}/${file}`);frames.push({file,bytes:raw.length,sha256:sha(raw),atEncodedSeconds:sample.time,kind:'browser-film-review-frame',productionPageScreenshot:false});
   }
   await page.waitForFunction(at=>document.querySelector('video').currentTime>=at,segment.start+seconds,{timeout:30000});const ended=await page.locator('video').evaluate(v=>{v.pause();const q=v.getVideoPlaybackQuality();return{time:v.currentTime,totalVideoFrames:q.totalVideoFrames,droppedVideoFrames:q.droppedVideoFrames,rate:v.playbackRate};});
   check(ended.rate===1&&ended.time-segment.start>=seconds-.03&&samples.every(s=>s.rate===1&&!s.paused),'Actual film did not continuously play at 1x');entry.segments.push({...segment,actualRequestedSeconds:seconds,wallMs:Date.now()-began,samples,ended,frames});
  }
 }
}finally{await context.close();await browser.close();check(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===meta.sourceCommit,'Checkout changed during native review');await fs.writeFile(`${out}/playback-review.json`,JSON.stringify(result,null,2)+'\n');}
check(!result.errors.length,'Playback browser errors');console.log(JSON.stringify({sourceCommit:meta.sourceCommit,films:result.cases.length,segments:result.cases.reduce((s,c)=>s+c.segments.length,0),errors:result.errors}));
