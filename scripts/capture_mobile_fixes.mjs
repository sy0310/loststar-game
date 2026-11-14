import {chromium,webkit} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const base=process.env.BASE_URL??'http://127.0.0.1:4173',out='artifacts/mobile-fixes';
const rehearsal=process.argv.includes('--rehearse');await mkdir(out,{recursive:true});await mkdir('artifacts/raw-video',{recursive:true});
const browser=await chromium.launch(),options={viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2};
const errors=[],recordings=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shot=async(p,name)=>p.screenshot({path:`${out}/${name}.png`,scale:'css'});
async function tap(p,locator){await locator.scrollIntoViewIfNeeded();await locator.waitFor();const r=await locator.boundingBox();if(!r)throw Error('Touch target has no bounds');await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}
async function seed(){
 const cx=await browser.newContext(options),p=await cx.newPage();await p.clock.install({time:new Date('2026-11-03T03:00:00Z')});await p.clock.pauseAt(new Date('2026-11-03T03:00:10Z'));await p.goto(base+'/?start=base&review=1');await tap(p,p.getByRole('button',{name:'图鉴',exact:true}));
 for(let ms=745000;ms>0;ms-=10000){await p.clock.fastForward(Math.min(ms,10000));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('loststar.save.v1')).lastAt>=Date.now()-500);}
 const state=await p.evaluate(()=>window.__review.state());state.seenDiscoveries=[...state.collection];await cx.close();return state;
}
const state=await seed();
const init=async(cx)=>{const p=await cx.newPage();p.on('pageerror',e=>errors.push(e.message));return p;};
const prepare=async(p)=>{await p.addInitScript(s=>{s.lastAt=Date.now();localStorage.setItem('loststar.save.v1',JSON.stringify(s));},state);};
async function interactionFlow(p,pace,navigate=true){
 if(navigate)await p.goto(base+'/?start=base&review=1');await tap(p,p.getByRole('button',{name:'图鉴',exact:true}));
 const map=await p.locator('button').evaluateAll(buttons=>buttons.filter(b=>b.getClientRects().length).map(b=>({text:b.textContent?.trim(),detail:b.dataset.detail,go:b.dataset.go})));if(!map.some(b=>b.detail==='bell'))throw Error('Discovery/rehearsal: bell missing');
 for(const [id,name,kind] of [['tape','自动道歉的胶带','奇物'],['nested','无限套娃包裹','奇物'],['bell','无人签收铃','奇物'],['receipt','未购买的退货收据','奇物'],['stamp','只会盖昨天的邮戳','奇物'],['cosmic-parcel','收件人：宇宙','奇物'],['mouse','拆封鼠','居民']]){
  await tap(p,p.getByRole('button',{name:`${name}，${kind}`,exact:true}));await tap(p,p.locator(`[data-interact="${id}"]`));await p.locator(`#interaction-feedback[data-item="${id}"][data-last-input="touch"]`).waitFor();
  if(pace){await p.waitForTimeout(650);await shot(p,`interaction-${id}`);await p.waitForTimeout(2200);}
  await tap(p,p.getByRole('button',{name:'关闭详情'}));
 }
}
if(rehearsal){const cx=await browser.newContext(options),p=await init(cx);await prepare(p);await interactionFlow(p,false);await tap(p,p.getByRole('button',{name:'星图',exact:true}));await p.locator('#radar-canvas').waitFor();await cx.close();await browser.close();console.log('REHEARSAL passed: all touch targets, feedback cards and radar exist.');process.exit(0);}
async function record(name,run){
 const cx=await browser.newContext({...options,recordVideo:{dir:'artifacts/raw-video',size:options.viewport}}),p=await init(cx);const start=Date.now();const info=await run(p,start);const video=p.video();await cx.close();
 execFileSync('ffmpeg',['-y','-loglevel','error','-ss',String(info.prefix??0),'-i',await video.path(),'-t',String(info.seconds),'-r','30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${name}.mp4`]);
 recordings.push({name,method:'Real wall-clock runtime in desktop browser with touch emulation; not physical TapTap footage',seconds:info.seconds,wallMs:Date.now()-start});console.log(`Recorded ${name}`);
}
await Promise.all([
 record('ship-orbit-28s',async (p,videoStart)=>{await p.goto(base+'/?review=1&start=expedition');await p.locator('canvas[data-ready]').waitFor();await p.waitForTimeout(350);const prefix=(Date.now()-videoStart)/1000;await shot(p,'ship-front-live');await p.waitForTimeout(28300);return {prefix,seconds:28};}),
 record('radar-live-96s',async (p,videoStart)=>{await p.goto(base+'/?review=1&start=base');await tap(p,p.getByRole('button',{name:'星图',exact:true}));await p.locator('#radar-canvas').waitFor();const prefix=(Date.now()-videoStart)/1000,began=Date.now();
  for(const [time,stage] of [[2000,'searching'],[47000,'anomaly'],[74000,'locking'],[92000,'surveyed']]){await p.waitForTimeout(Math.max(0,time-(Date.now()-began)));await shot(p,`radar-${stage}`);}
  await p.waitForTimeout(Math.max(0,96300-(Date.now()-began)));return {prefix,seconds:96};}),
 record('artifacts-touch-emulation',async (p,videoStart)=>{await prepare(p);await p.goto(base+'/?review=1&start=base');await p.evaluate(()=>{document.addEventListener('pointerdown',e=>{const dot=document.createElement('i');dot.style.cssText=`position:fixed;pointer-events:none;z-index:99999;left:${e.clientX-13}px;top:${e.clientY-13}px;width:26px;height:26px;border:2px solid #fff0b8;border-radius:50%;background:#ffe0a033;`; (document.querySelector('dialog[open]')??document.body).append(dot);setTimeout(()=>dot.remove(),350);},{capture:true});});
  const prefix=(Date.now()-videoStart)/1000,began=Date.now();await interactionFlow(p,true,false);await p.waitForTimeout(500);return {prefix,seconds:(Date.now()-began)/1000};})
]);
// Continuous enlargement and old/new comparison: two complete 14-second orbits.
execFileSync('ffmpeg',['-y','-loglevel','error','-i',`${out}/ship-orbit-28s.mp4`,'-vf','crop=390:350:0:182,scale=1170:1050:flags=neighbor','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',`${out}/ship-orbit-zoom-28s.mp4`]);
execFileSync('ffmpeg',['-y','-loglevel','error','-i','artifacts/phase1/expedition-42s.mp4','-i',`${out}/ship-orbit-28s.mp4`,'-filter_complex','[0:v]trim=0:28,setpts=PTS-STARTPTS,crop=390:350:0:182,scale=780:700:flags=neighbor[old];[1:v]crop=390:350:0:182,scale=780:700:flags=neighbor[new];[old][new]hstack=inputs=2','-t','28','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',`${out}/ship-before-after-28s.mp4`]);
const cx=await browser.newContext(options),p=await init(cx);await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/?start=base&review=1');await tap(p,p.getByRole('button',{name:'星图',exact:true}));await p.waitForTimeout(400);await shot(p,'radar-reduced-motion');await tap(p,p.getByRole('button',{name:'远征',exact:true}));await p.locator('canvas[data-ready]').waitFor();await p.evaluate(()=>window.__review.scene.resetMetrics());await p.waitForTimeout(6000);const metrics=await p.evaluate(()=>window.__review.scene.metrics());const build=await p.locator('html').getAttribute('data-build');await cx.close();await browser.close();
await writeFile(`${out}/recordings.json`,JSON.stringify({date:new Date().toISOString(),build,recordings,errors,sceneMetrics:metrics,phone:'Not connected. User will verify the new TapTap QR on physical phone.'},null,2)+'\n');
console.log('All P0 recordings complete.');
