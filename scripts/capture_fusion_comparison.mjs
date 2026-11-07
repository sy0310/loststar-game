import {chromium} from '@playwright/test';
import {freshComparison} from '../releases/fusion-capture/fusion_capture_fixtures.js';
import {mkdirSync, writeFileSync, readFileSync, unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4207';
const output = 'artifacts/fusion';
mkdirSync(`${output}/raw`, {recursive: true});
const source = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
const browser = await chromium.launch();
const startAt = Date.now() + 20000;
const contexts = [];
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, Math.max(0,milliseconds)));
async function read(page) {
  return page.evaluate(() => new Promise(resolve => {
    const request=indexedDB.open('loststar.fusion.v1',1);
    request.onsuccess=()=>{const db=request.result;const r=db.transaction('archive','readonly').objectStore('archive').get('current');r.onsuccess=()=>{resolve(r.result);db.close();};};
  }));
}
async function prepare(width, mode) {
  const height=width===360?800:844;
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:`${output}/raw`,size:{width,height}}});
  const seed=await context.newPage();
  await seed.route('**/*.js',r=>r.abort());await seed.goto(base,{waitUntil:'domcontentloaded'});
  await seed.evaluate(value=>new Promise(resolve=>{const request=indexedDB.open('loststar.fusion.v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('archive');request.onsuccess=()=>{const db=request.result,tx=db.transaction('archive','readwrite');tx.objectStore('archive').put(value,'current');tx.oncomplete=()=>{db.close();resolve();};};}),freshComparison(startAt));
  const unused=await seed.video().path();await seed.close();try{unlinkSync(unused);}catch{}
  const createdAt=Date.now();const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.stack??e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
  const initial=await read(page);
  if(initial.game.world.elapsedMs!==0||initial.game.resources!==120)throw Error('Identical initial state was not held');
  const item={context,page,width,height,mode,createdAt,errors,initial,attempts:[]};contexts.push(item);return item;
}
async function tap(item, scheduledMs) {
  await sleep(startAt+scheduledMs-Date.now());
  const point=await item.page.evaluate(()=>{const box=document.querySelector('#fusion-world canvas').getBoundingClientRect();for(const [px,py]of [[416,610],[460,600],[380,600],[420,570]]){const x=box.x+box.width*px/832,y=box.y+box.height*py/740;if([[0,0],[-5,0],[5,0],[0,-5],[0,5]].every(([dx,dy])=>window.__FUSION__.pickAtClient(x+dx,y+dy).kind==='planet'))return{x,y};}return null;});
  if(!point)throw Error('No visible terrain point');
  const at=Date.now();await item.page.touchscreen.tap(point.x,point.y);if(await item.page.locator('dialog[open]').count())throw Error('Terrain input hit a moving object; comparison aborted');item.attempts.push({scheduledMs,actualMs:at-startAt,...point});
}
try {
  await Promise.all([360,390].flatMap(width=>['idle','slow','burst','fast'].map(mode=>prepare(width,mode))));
  if(Date.now()>=startAt)throw Error('Preparations exceeded the shared real start time');
  await Promise.all(contexts.map(async item=>{
    if(item.mode==='slow')for(let at=200;at<60000;at+=10000)await tap(item,at);
    if(item.mode==='burst')for(let group=0;group<5;group++)for(let index=0;index<5;index++)await tap(item,200+group*12100+index*340);
    if(item.mode==='fast')for(let at=200;at<60000;at+=125)await tap(item,at);
    await sleep(startAt+60700-Date.now());
    item.final=await read(item.page);
    await item.page.screenshot({path:`${output}/compare-${item.width}-${item.mode}.png`});
    item.raw=await item.page.video().path();await item.context.close();
  }));
  const videos=[];
  for(const width of[360,390])for(const modes of[['idle','burst'],['slow','fast']]){
    const [left,right]=modes.map(mode=>contexts.find(c=>c.width===width&&c.mode===mode));
    const file=`compare-${width}-${modes.join('-')}-60s.mp4`;
    const filter=`[0:v]trim=start=${(startAt-left.createdAt)/1000}:duration=60,setpts=PTS-STARTPTS[a];[1:v]trim=start=${(startAt-right.createdAt)/1000}:duration=60,setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2[out]`;
    execFileSync('ffmpeg',['-y','-i',left.raw,'-i',right.raw,'-filter_complex',filter,'-map','[out]','-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${file}`],{stdio:'ignore'});
    videos.push({file,left:modes[0],right:modes[1],bytes:readFileSync(`${output}/${file}`).length,probe:JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',`${output}/${file}`],{encoding:'utf8'}))});
  }
  const results=contexts.map(c=>({width:c.width,height:c.height,mode:c.mode,attempted:c.attempts.length,accepted:c.final.game.assist?.actionSeq??0,discarded:c.attempts.length-(c.final.game.assist?.actionSeq??0),enqueued:c.final.game.assist?.enqueuedWorkMs??0,applied:c.final.game.assist?.appliedWorkMs??0,pending:c.final.game.assist?.pendingWorkMs??0,cycles:c.final.game.cycles,parts:c.final.game.resources,worldMs:c.final.game.world.elapsedMs,firstDiscoveryMs:c.final.game.discoveryAt.receipt-startAt,attempts:c.attempts,errors:c.errors}));
  const failures=results.flatMap(r=>r.errors);
  for(const r of results){if(!Number.isFinite(r.firstDiscoveryMs)||r.accepted>r.attempted||Math.abs(r.enqueued-r.applied-r.pending)>.01||r.enqueued!==r.accepted*600||r.accepted>30||r.parts<120)failures.push(`Comparison accounting: ${r.width}/${r.mode}`);}
  for(const width of[360,390]){const idle=results.find(r=>r.width===width&&r.mode==='idle');const burst=results.find(r=>r.width===width&&r.mode==='burst');const fast=results.find(r=>r.width===width&&r.mode==='fast');if(idle.accepted!==0||burst.accepted<20||fast.discarded<100||burst.firstDiscoveryMs>=idle.firstDiscoveryMs)failures.push(`Comparison behavior: ${width}`);}
  writeFileSync(`${output}/comparison.json`,JSON.stringify({sourceCommit:source,startAt,initial:freshComparison(startAt),method:'Identical initial state held until a shared future real wall-clock start. Native touch, real60second input window and video. Ledger read at60.7seconds to let the200ms persisted tick settle past the60second completion boundary; actual worldMs reported for each arm. No clock acceleration. Video lead-in removed and pairs aligned approximately by page creation timestamps. Data measurements use actual engine timestamps. Desktop emulation, physical phone feedback pending.',results,videos,errors:failures},null,2)+'\n');
  console.log(JSON.stringify(results.map(({attempts,errors,...r})=>r)));
  if(failures.length)throw Error(JSON.stringify(failures));
} finally {await browser.close();}
