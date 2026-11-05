import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';
const base=process.env.RENEWAL_URL??'http://127.0.0.1:4226/';
const metadata=JSON.parse(await readFile('releases/taptap/package-info-fusion.json','utf8'));
const runtimePaths=['src','assets/runtime','package.json','package-lock.json','vite.config.ts','vite.fusion.config.ts'];
const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=execFileSync('git',['status','--porcelain','--',...runtimePaths],{encoding:'utf8'}).trim();
const difference=execFileSync('git',['diff','--name-only',metadata.sourceCommit,checkout,'--',...runtimePaths],{encoding:'utf8'}).trim();
const bytes=await readFile(metadata.archive);
if(dirty||difference||createHash('sha256').update(bytes).digest('hex')!==metadata.sha256)throw Error('Performance capture requires the unchanged frozen source and exact package');
const summarize=values=>{const a=[...values].sort((x,y)=>x-y);return{samples:a.length,medianMs:a[Math.floor(a.length*.5)]??null,p95Ms:a[Math.floor(a.length*.95)]??null,over100Ms:a.filter(x=>x>100).length};};
const report={sourceCommit:metadata.sourceCommit,base,zipSha256:metadata.sha256,physicalPhone:false,textureMemory:'Not measured. Decoded image, GPU and total-process residency are not inferred from the JavaScript heap.',host:{cpu:os.cpus()[0].model,platform:os.platform(),architecture:os.arch()},
 method:{viewport:{width:390,height:844},dpr:2,concurrency:1,recording:false,warmupMs:1500,sampleMs:10000,heap:'Chromium coarse JS heap only; excludes texture, GPU and process memory.'},cases:[]};
const views=(process.env.RENEWAL_PERF_VIEWS??'explore,field,collection,receipt,tape,bell').split(',');
if(views.some(view=>!['explore','field','collection','base','receipt','tape','bell','tape-ii','bell-active'].includes(view)))throw Error('Unsupported performance view');
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{for(const view of views){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
   if(['collection','base','receipt','tape','bell','tape-ii','bell-active'].includes(view)){
    const seed=await context.newPage();await seed.route('**/*.js',r=>r.abort());await seed.goto(base,{waitUntil:'domcontentloaded'});
    const fixture=firstPlanetFixture(Date.now(),view==='base'?3:0,'stabilized',{receiptAbility:0,tapeAbility:view==='tape-ii'?2:0});
    await seed.evaluate(save=>new Promise(resolve=>{const r=indexedDB.open('loststar.fusion.firstplanet.v037',1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite');t.objectStore('archive').put(save,'current');t.oncomplete=()=>{d.close();localStorage.setItem('loststar.ui.firstplanet.v037.intro',String(save.journey.seed));resolve();};};}),fixture.state);await seed.close();
   }
   await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
   const dismiss=page.locator('#fusion-dismiss-intro');if(await dismiss.isVisible())await dismiss.tap();
   if(view==='field')await page.locator('#fusion-observe').tap();
   if(view==='collection')await page.locator('[data-tab="collection"]').tap();
   if(view==='base')await page.locator('[data-tab="base"]').tap();
   if(['receipt','tape','bell','tape-ii','bell-active'].includes(view)){
    const id=view==='tape-ii'?'tape':view==='bell-active'?'bell':view;
    await page.locator('[data-tab="collection"]').tap();await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
    await page.locator(id==='receipt'?'#fusion-paper-focus[data-ready="true"]':'#fusion-exhibit-focus[data-ready="true"]').waitFor();
    if(view==='tape-ii'||view==='bell-active')await page.evaluate(()=>{window.__renewalPerfTrials=setInterval(()=>{const button=document.querySelector('#fusion-try');if(button&&!button.disabled)button.click();},2800);});
   }
   const build=await page.locator('.fu-build').innerText();if(!build.includes(metadata.sourceCommit.slice(0,7))||build.includes('dirty'))throw Error(`Unexpected build ${build}`);
   await page.waitForTimeout(1500);await page.evaluate(()=>{window.__FUSION__.resetMetrics();window.__FUSION__.resetUiMetrics();window.__v039Heap=[];window.__v039HeapTimer=setInterval(()=>{if(performance.memory)window.__v039Heap.push(performance.memory.usedJSHeapSize);},100);});
   const sample=await page.evaluate(async()=>{const intervals=[],activities=[];let previous=performance.now(),start=previous;
    await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;const c=document.querySelector('#fusion-exhibit-focus');if(c)activities.push({ms:now-start,playing:c.dataset.experimentPlaying,replay:c.dataset.replay,mechanism:c.dataset.mechanism,phase:c.dataset.mechanismPhase});if(now-start<10000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    clearInterval(window.__v039HeapTimer);return{raf:intervals.slice(1),world:window.__FUSION__.metrics(),ui:window.__FUSION__.uiMetrics(),heap:window.__v039Heap,activities};});
   const field=['explore','field'].includes(view),museum=['collection','base'].includes(view),actualIntervals=field?null:museum?sample.ui.museum.intervalsMs??[]:sample.ui.focus.intervalsMs;
   const activeView=['tape-ii','bell-active'].includes(view),activeFrames=sample.activities.filter(a=>a.playing==='true'),replays=[...new Set(activeFrames.map(a=>a.replay))];
   if(activeView&&(activeFrames.length<10||replays.length<2))errors.push('Active performance view failed to observe two real rendered mechanism replays');
   report.cases.push({engine,view,build,automaticTrialInputs:activeView,activity:{activeFrames:activeFrames.length,replays,phases:[...new Set(activeFrames.map(a=>a.phase))],samples:sample.activities},raf:summarize(sample.raf),actualPaint:field?{samples:sample.world.frames,medianMs:sample.world.medianFrameMs,p95Ms:sample.world.p95FrameMs}:summarize(actualIntervals),
    meanDrawMs:field?sample.world.meanDrawMs:(museum?sample.ui.museum.costsMs:sample.ui.focus.costsMs).reduce((a,b)=>a+b,0)/Math.max(1,(museum?sample.ui.museum.costsMs:sample.ui.focus.costsMs).length),
    heap:{samples:sample.heap.length,maximumBytes:sample.heap.length?Math.max(...sample.heap):null},errors});
   if(errors.length)throw Error(JSON.stringify(errors));
  }finally{await context.close();}
 }}finally{await browser.close();}
}
await writeFile(`${process.env.RENEWAL_OUTPUT??'artifacts/visual-renewal'}/performance.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.cases));
