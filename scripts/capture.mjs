import { chromium, webkit } from '@playwright/test';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const base=process.env.BASE_URL??'http://127.0.0.1:4173';
await mkdir('artifacts/raw-video',{recursive:true});
const report={date:new Date().toISOString(),host:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0].model},scope:'Desktop headless browsers at phone CSS viewports. Not physical mobile-device certification.',samples:[]};
const browser=await chromium.launch();
// Actual wall-clock screen recording: no simulation time jumps, no frozen scene.
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,recordVideo:{dir:'artifacts/raw-video',size:{width:390,height:844}}});
const recordingStart=Date.now();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/?review=1');await page.locator('canvas[data-ready]').waitFor();
const prefix=(Date.now()-recordingStart)/1000;
await page.waitForTimeout(12200);
const video=page.video();await context.close();const raw=await video.path();
execFileSync('ffmpeg',['-y','-loglevel','error','-ss',prefix.toString(),'-i',raw,'-t','12','-r','30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','artifacts/expedition-12s.mp4']);
console.log('Recorded 12s actual production runtime.');
// Reproducible occlusion keyframes: only visual clock frozen, no save or rewards changed.
const c=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p=await c.newPage();await p.goto(base+'/?review=1');await p.locator('canvas[data-ready]').waitFor();
for(const [name,t] of [['ship-behind',8.8],['ship-front',3.4],['robot-behind-warehouse',1.4],['robot-scanning',5.2]]){
 await p.evaluate(t=>window.__review.freeze(t),t);
 await p.locator('.scene-wrap').screenshot({path:`artifacts/${name}.png`});
}
await p.evaluate(()=>window.__review.freeze(null));
await p.screenshot({path:'artifacts/production-390-expedition.png',fullPage:true});
await p.getByRole('button',{name:'星图',exact:true}).click();await p.screenshot({path:'artifacts/radar-unspoiled.png',fullPage:true});
await c.close();
// Measure scene draw cost, actual rAF timing, resource loads and Chromium heap in fresh contexts.
for(const [engine,name,width,height,throttle] of [[browser,'chromium-360',360,800,1],[browser,'chromium-390',390,844,1],[browser,'chromium-desktop',1440,1000,1],[browser,'chromium-390-cpu4x',390,844,4]]){
 const cx=await engine.newContext({viewport:{width,height},deviceScaleFactor:width<500?2:1});const q=await cx.newPage();
 const cdp=await cx.newCDPSession(q);await cdp.send('Performance.enable');
 if(throttle>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
 await q.goto(base+'/?review=1');await q.locator('canvas[data-ready]').waitFor();await q.evaluate(()=>window.__review.scene.resetMetrics());
 await q.waitForTimeout(6000);
 const metrics=await q.evaluate(()=>({scene:window.__review.scene.metrics(),resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize,transfer:r.transferSize})),dpr:devicePixelRatio}));
 const perf=await cdp.send('Performance.getMetrics');
 report.samples.push({name,viewport:{width,height},cpuThrottling:throttle,...metrics,heapBytes:perf.metrics.find(m=>m.name==='JSHeapUsedSize')?.value});
 await cx.close();console.log(`Measured ${name}.`);
}
// User-flow stills use a disclosed accelerated clock, not the real-time video.
const flowContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
const flow=await flowContext.newPage();await flow.clock.install();await flow.goto(base);
for(let i=0;i<10;i++){await flow.clock.fastForward(10000);await flow.waitForFunction(()=>JSON.parse(localStorage.getItem('loststar.save.v1')).lastAt>=Date.now()-500);}
for(const [tab,name] of [['图鉴','collection-populated'],['基地','base-populated']]){
 await flow.getByRole('button',{name:tab,exact:true}).click();
 await flow.locator('.view:not([hidden]) img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
 await flow.screenshot({path:`artifacts/${name}.png`,fullPage:true});
}
await flow.getByRole('button',{name:'图鉴',exact:true}).click();
await flow.getByRole('button',{name:/未购买的退货收据/}).click();await flow.getByRole('button',{name:'试一试'}).click();
await flow.screenshot({path:'artifacts/detail-receipt.png'});await flow.getByRole('button',{name:'关闭详情'}).click();
await flow.getByRole('button',{name:'基地',exact:true}).click();await flow.getByRole('button',{name:/设备工坊/}).click();await flow.screenshot({path:'artifacts/workshop.png'});await flow.getByRole('button',{name:'关闭工坊'}).click();
await flow.evaluate(()=>{const k='loststar.save.v1',s=JSON.parse(localStorage.getItem(k));s.lastAt=Date.now()-3600000;localStorage.setItem(k,JSON.stringify(s));});await flow.reload();await flow.getByText('离线归航').waitFor();await flow.screenshot({path:'artifacts/offline-return.png'});
await flowContext.close();
await browser.close();
const safari=await webkit.launch();const w=await safari.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
await w.goto(base+'/?review=1');await w.locator('canvas[data-ready]').waitFor();await w.evaluate(()=>window.__review.scene.resetMetrics());await w.waitForTimeout(6000);
report.samples.push({name:'webkit-390',viewport:{width:390,height:844},scene:await w.evaluate(()=>window.__review.scene.metrics())});await safari.close();
const files=await readdir('dist/assets');report.buildFiles=await Promise.all(files.map(async f=>({name:f,bytes:(await stat(path.join('dist/assets',f))).size})));report.consoleErrors=errors;
await writeFile('artifacts/performance.json',JSON.stringify(report,null,2)+'\n');console.log('Saved keyframes, production screenshots and measured performance.json.');
