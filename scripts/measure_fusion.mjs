import {chromium,webkit} from '@playwright/test';
import {captureFixture} from '../releases/fusion-capture/fusion_capture_fixtures.js';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {cpus,platform,arch} from 'node:os';
const base=process.env.BASE_URL??'http://127.0.0.1:4207';
const results=[];
for(const [name,type]of[['chromium',chromium],['webkit',webkit]])for(const phase of['day','night']){
 const browser=await type.launch();
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  if(phase==='night'){
   await page.route('**/*.js',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.evaluate(value=>new Promise(resolve=>{const r=indexedDB.open('loststar.fusion.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onsuccess=()=>{const db=r.result,t=db.transaction('archive','readwrite');t.objectStore('archive').put(value,'current');t.oncomplete=()=>{db.close();resolve();};};}),captureFixture('night-basic',Date.now()-22000));
   await page.unroute('**/*.js');
  }
  await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();await page.waitForTimeout(1500);
  const metrics=await page.evaluate(async()=>{
   window.__FUSION__.resetMetrics();const intervals=[];let previous=performance.now();const start=previous;
   await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;if(now-start<12000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
   const ordered=intervals.slice(3).sort((a,b)=>a-b);
   return{scene:window.__FUSION__.metrics(),raf:{frames:ordered.length,medianMs:ordered[Math.floor(ordered.length*.5)],p95Ms:ordered[Math.floor(ordered.length*.95)]},ua:navigator.userAgent,dpr:devicePixelRatio,build:document.querySelector('.fu-build').textContent};
  });results.push({name,phase,...metrics});
 }finally{await browser.close();}
}
writeFileSync('artifacts/fusion/performance.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),method:'One headless browser/page at a time, 12 real seconds after1.5s warmup, no capture/video/test load, 390x844 DPR2 desktop emulation. Not physical mobile or TapTap WebView measurement.',host:{platform:platform(),arch:arch(),cpu:cpus()[0]?.model},results},null,2)+'\n');console.log(JSON.stringify(results));
