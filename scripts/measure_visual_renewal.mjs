import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';
const base=process.env.RENEWAL_URL??'http://127.0.0.1:4226/';
const metadata=JSON.parse(await readFile('releases/taptap/package-info-fusion.json','utf8'));
const summarize=values=>{const a=[...values].sort((x,y)=>x-y);return{samples:a.length,medianMs:a[Math.floor(a.length*.5)]??null,p95Ms:a[Math.floor(a.length*.95)]??null,over100Ms:a.filter(x=>x>100).length};};
const report={sourceCommit:metadata.sourceCommit,base,physicalPhone:false,host:{cpu:os.cpus()[0].model,platform:os.platform(),architecture:os.arch()},
 method:{viewport:{width:390,height:844},dpr:2,concurrency:1,recording:false,warmupMs:1500,sampleMs:10000,heap:'Chromium coarse JS heap only; excludes texture, GPU and process memory.'},cases:[]};
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{for(const view of ['explore','field','collection','receipt','tape','bell']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
   if(['collection','receipt','tape','bell'].includes(view)){
    const seed=await context.newPage();await seed.route('**/*.js',r=>r.abort());await seed.goto(base,{waitUntil:'domcontentloaded'});
    const fixture=firstPlanetFixture(Date.now(),0,'stabilized',{receiptAbility:0,tapeAbility:0});
    await seed.evaluate(save=>new Promise(resolve=>{const r=indexedDB.open('loststar.fusion.firstplanet.v037',1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite');t.objectStore('archive').put(save,'current');t.oncomplete=()=>{d.close();localStorage.setItem('loststar.ui.firstplanet.v037.intro',String(save.journey.seed));resolve();};};}),fixture.state);await seed.close();
   }
   await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
   const dismiss=page.locator('#fusion-dismiss-intro');if(await dismiss.isVisible())await dismiss.tap();
   if(view==='field')await page.locator('#fusion-observe').tap();
   if(view==='collection')await page.locator('[data-tab="collection"]').tap();
   if(['receipt','tape','bell'].includes(view)){
    await page.locator('[data-tab="collection"]').tap();await page.locator(`#fusion-collection-list [data-detail="${view}"]`).tap();
    await page.locator(view==='receipt'?'#fusion-paper-focus[data-ready="true"]':'#fusion-exhibit-focus[data-ready="true"]').waitFor();
   }
   const build=await page.locator('.fu-build').innerText();if(!build.includes(metadata.sourceCommit.slice(0,7))||build.includes('dirty'))throw Error(`Unexpected build ${build}`);
   await page.waitForTimeout(1500);await page.evaluate(()=>{window.__FUSION__.resetMetrics();window.__FUSION__.resetUiMetrics();window.__v039Heap=[];window.__v039HeapTimer=setInterval(()=>{if(performance.memory)window.__v039Heap.push(performance.memory.usedJSHeapSize);},100);});
   const sample=await page.evaluate(async()=>{const intervals=[];let previous=performance.now(),start=previous;
    await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;if(now-start<10000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    clearInterval(window.__v039HeapTimer);return{raf:intervals.slice(1),world:window.__FUSION__.metrics(),ui:window.__FUSION__.uiMetrics(),heap:window.__v039Heap};});
   const field=['explore','field'].includes(view),actualIntervals=field?null:view==='collection'?sample.ui.museum.intervalsMs??[]:sample.ui.focus.intervalsMs;
   report.cases.push({engine,view,build,raf:summarize(sample.raf),actualPaint:field?{samples:sample.world.frames,medianMs:sample.world.medianFrameMs,p95Ms:sample.world.p95FrameMs}:summarize(actualIntervals),
    meanDrawMs:field?sample.world.meanDrawMs:sample.ui.focus.costsMs.reduce((a,b)=>a+b,0)/Math.max(1,sample.ui.focus.costsMs.length),
    heap:{samples:sample.heap.length,maximumBytes:sample.heap.length?Math.max(...sample.heap):null},errors});
   if(errors.length)throw Error(JSON.stringify(errors));
  }finally{await context.close();}
 }}finally{await browser.close();}
}
await writeFile('artifacts/visual-renewal/performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.cases));
