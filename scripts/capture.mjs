import {chromium,webkit} from '@playwright/test';
import {mkdir,readdir,stat,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const base=process.env.BASE_URL??'http://127.0.0.1:4173';
const out='artifacts/phase1';
await mkdir(out,{recursive:true});await mkdir('artifacts/raw-video',{recursive:true});
const report={date:new Date().toISOString(),phase:'first-planet-polish',host:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0].model},scope:'Desktop headless browsers at phone CSS viewports; no physical mobile certification.',samples:[]};
const browser=await chromium.launch();
const options={viewport:{width:390,height:844},deviceScaleFactor:2};
const decode=async page=>page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode().catch(()=>{}))));
const screenshot=async(page,name,retina=false)=>{await decode(page);await page.screenshot({path:`${out}/${name}.png`,scale:'css'});if(retina)await page.screenshot({path:`${out}/${name}@2x.png`});};
async function passTime(page,ms){for(let left=ms;left>0;left-=10000){await page.clock.fastForward(Math.min(left,10000));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('loststar.save.v1')).lastAt>=Date.now()-500);}}
const reuse=process.argv.includes('--reuse-recording');
const errors=reuse?JSON.parse(await readFile(`${out}/performance.json`,'utf8')).consoleErrors:[];
// Continuous, real wall-clock recording. No seed, time jumps, scene freezes, or scripted clicks.
if(!reuse){
const recording=await browser.newContext({...options,recordVideo:{dir:'artifacts/raw-video',size:{width:390,height:844}}});
const began=Date.now(),live=await recording.newPage();
live.on('pageerror',e=>errors.push(e.message));
await live.goto(base+'/?review=1');await live.locator('canvas[data-ready]').waitFor();
const ready=Date.now(),prefix=(ready-began)/1000;
await live.waitForTimeout(Math.max(0,12500-(Date.now()-ready)));
await live.locator('[data-presentation="receipt"]').waitFor({timeout:3000});await screenshot(live,'discovery-receipt');
await live.waitForTimeout(Math.max(0,36500-(Date.now()-ready)));
await live.locator('[data-presentation="mouse"]').waitFor({timeout:3000});await screenshot(live,'discovery-mouse');
await live.waitForTimeout(Math.max(0,42300-(Date.now()-ready)));
const video=live.video();await recording.close();
execFileSync('ffmpeg',['-y','-loglevel','error','-ss',String(prefix),'-i',await video.path(),'-t','42','-r','30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/expedition-42s.mp4`]);
execFileSync('ffmpeg',['-y','-loglevel','error','-ss','9.5','-i',`${out}/expedition-42s.mp4`,'-t','12','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/expedition-12s.mp4`]);
console.log('Recorded 42s continuous runtime with two real discoveries, plus a 12s unsped excerpt.');
}else console.log('Reusing the unchanged real-time recording; refreshing stills and measurement.');
// Later-stage stills deliberately use a test clock. They do not represent a new save.
const flowContext=await browser.newContext(options),flow=await flowContext.newPage();
await flow.clock.install({time:new Date('2026-11-02T19:00:00Z')});await flow.goto(base+'/?review=1');await flow.locator('canvas[data-ready]').waitFor();
await flow.getByRole('button',{name:'图鉴',exact:true}).click();await passTime(flow,181000);
await flow.getByRole('button',{name:'远征',exact:true}).click();await flow.locator('[data-presentation="night-shift"]').waitFor();await screenshot(flow,'discovery-night-shift');
await flow.getByRole('button',{name:'收起发现提示'}).click();
await flow.evaluate(()=>window.__review.freeze(4.8));await screenshot(flow,'390-expedition',true);
for(const [name,t] of [['ship-back',12.3],['ship-front',5.1],['robot-behind',2.28],['robot-scan',4.8],['robot-unload',11.4]]){
 await flow.evaluate(t=>window.__review.freeze(t),t);await flow.locator('.scene-wrap').screenshot({path:`${out}/${name}.png`,scale:'css'});
}
await flow.evaluate(()=>window.__review.freeze(null));
for(const [tab,name] of [['星图','390-radar'],['图鉴','390-collection'],['基地','390-base']]){await flow.getByRole('button',{name:tab,exact:true}).click();await screenshot(flow,name,true);}
await flow.getByRole('button',{name:/设备工坊/}).click();await screenshot(flow,'390-workshop',true);await flow.getByRole('button',{name:'关闭工坊'}).click();
await flow.getByRole('button',{name:'图鉴',exact:true}).click();await flow.getByRole('button',{name:'未购买的退货收据，奇物'}).click();await flow.getByRole('button',{name:'试一试'}).click();await screenshot(flow,'detail-receipt');await flow.getByRole('button',{name:'关闭详情'}).click();
await passTime(flow,565000);await screenshot(flow,'archive-complete');
await flow.getByRole('button',{name:'基地',exact:true}).click();await screenshot(flow,'base-complete');
await flow.getByRole('button',{name:'图鉴',exact:true}).click();await flow.getByRole('button',{name:'收件人：宇宙，奇物'}).click();await screenshot(flow,'detail-cosmic');await flowContext.close();
const returns=await browser.newContext(options),returnPage=await returns.newPage();
await returnPage.goto(base);await returnPage.evaluate(()=>{const key='loststar.save.v1',s=JSON.parse(localStorage.getItem(key));s.lastAt=Date.now()-86400000;localStorage.setItem(key,JSON.stringify(s));});await returnPage.reload();await returnPage.getByText('离线归航').waitFor();await screenshot(returnPage,'offline-return');await returns.close();
console.log('Captured five exact 390×844 pages, discovery scenes, full ecology, and occlusion frames.');
// Cold contexts and a separate calm sampling window. This is not a phone hardware test.
for(const [name,width,height,throttle] of [['chromium-360',360,800,1],['chromium-390',390,844,1],['chromium-desktop',1440,1000,1],['chromium-390-cpu4x',390,844,4]]){
 const cx=await browser.newContext({viewport:{width,height},deviceScaleFactor:width<500?2:1}),p=await cx.newPage();
 const cdp=await cx.newCDPSession(p);await cdp.send('Performance.enable');if(throttle>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
 await p.goto(base+'/?review=1');await p.locator('canvas[data-ready]').waitFor();await p.evaluate(()=>window.__review.scene.resetMetrics());await p.waitForTimeout(6000);
 const data=await p.evaluate(()=>({scene:window.__review.scene.metrics(),resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize,transfer:r.transferSize})),dpr:devicePixelRatio}));
 const metrics=await cdp.send('Performance.getMetrics');report.samples.push({name,viewport:{width,height},cpuThrottling:throttle,...data,heapBytes:metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value});await cx.close();console.log(`Measured ${name}.`);
}
await browser.close();
const safari=await webkit.launch(),w=await safari.newPage(options);await w.goto(base+'/?review=1');await w.locator('canvas[data-ready]').waitFor();await w.evaluate(()=>window.__review.scene.resetMetrics());await w.waitForTimeout(6000);
report.samples.push({name:'webkit-390',viewport:options.viewport,scene:await w.evaluate(()=>window.__review.scene.metrics())});await safari.close();
report.buildFiles=await Promise.all((await readdir('dist/assets')).map(async name=>({name,bytes:(await stat(path.join('dist/assets',name))).size})));report.consoleErrors=errors;
report.video=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-show_entries','stream=width,height,avg_frame_rate','-of','json',`${out}/expedition-42s.mp4`]));
await writeFile(`${out}/performance.json`,JSON.stringify(report,null,2)+'\n');console.log('Saved phase 1 raw performance and video metadata.');
