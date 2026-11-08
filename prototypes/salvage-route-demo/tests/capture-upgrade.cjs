/* Reproducible, developer-only recordings. Natural play and imported QA are labelled separately. */
'use strict';
const {chromium}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const http=require('node:http');
const E=require('../src/engine.js');
const root=path.resolve(__dirname,'..');
const out=path.resolve(process.env.SALVAGE_CAPTURE_OUT||path.join(root,'verification/upgrade-capture'));
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'raw-videos'),{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getState=page=>page.evaluate(()=>__SALVAGE__.state());
async function tap(page,selector){await page.waitForFunction(()=>__SALVAGE__.ready());await page.locator(selector).tap();await page.waitForFunction(()=>__SALVAGE__.ready());await delay(400);}
async function boot(page,url){await page.goto(url);await page.waitForFunction(()=>__SALVAGE__);const close=page.locator('#modal-buttons [data-act=close]');if(await close.isVisible())await tap(page,'#modal-buttons [data-act=close]');}
async function finishLoad(page){const save=page.locator('[data-cargo-save]');if(!await save.isVisible())return;await tap(page,'[data-cargo-arrange]');if(await save.isEnabled())await tap(page,'[data-cargo-save]');else{await tap(page,'[data-cargo-cancel]');await tap(page,'[data-choice=leave]');}}
async function importQA(page,value){await tap(page,'[data-act=settings]');await page.locator('[data-act=import]').tap();await page.locator('#import-file').setInputFiles({name:'explicit-QA-generic-cargo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await tap(page,'[data-act=confirm]');assert.deepEqual(await getState(page),E.restore(value));}
async function ready(url){for(let i=0;i<50;i++){try{await new Promise((resolve,reject)=>http.get(url,r=>{r.resume();r.statusCode===200?resolve():reject(Error(String(r.statusCode)));}).on('error',reject));return;}catch{await delay(100);}}throw Error('HTTP preview did not start');}

(async()=>{
 let server,browser;
 const url=process.env.SALVAGE_URL||'http://127.0.0.1:4285/loststar-salvage/';
 const report={scope:'Desktop Chromium, 390x844 with touch emulation. Real time scripted UI actions; not physical phone or human enjoyment validation.',natural:{imported:false,seedOverridden:false,clockOverridden:false,checkpoints:[]},qa:{imported:true,purpose:'Generic cargo gesture recording, no hidden story outcome',checkpoints:[]},errors:[]};
 const captureState=async(page,name,kind)=>{const s=await getState(page);report[kind].checkpoints.push({name,state:s});E.assertState(s);return s;};
 try{
  if(!process.env.SALVAGE_URL){if(!process.env.SALVAGE_PACKAGE_DIR)execFileSync('python3',['build.py'],{cwd:root,stdio:'ignore'});server=spawn('python3',['-m','http.server','4285','--bind','127.0.0.1','--directory',process.env.SALVAGE_PACKAGE_DIR||'dist'],{cwd:root,stdio:'ignore'});}
  await ready(url);browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,recordVideo:{dir:path.join(out,'raw-videos'),size:{width:390,height:844}}});
  let page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await boot(page,url);report.build=await page.evaluate(()=>window.LostCargoBuild||null);
  await page.screenshot({path:path.join(out,'initial-port.png'),fullPage:true});await tap(page,'[data-tab=route]');await page.screenshot({path:path.join(out,'initial-route.png'),fullPage:true});await tap(page,'[data-tab=cargo]');await page.screenshot({path:path.join(out,'initial-cargo.png'),fullPage:true});await tap(page,'[data-tab=play]');
  for(let run=1;run<=2;run++){
   await captureState(page,`before-voyage-${run}`,'natural');await tap(page,'[data-act=depart]');await finishLoad(page);
   for(let step=0;step<3;step++){
    await tap(page,'[data-tab=route]');const before=await getState(page),route=before.route.find(r=>E.quote(before,r).enabled);assert(route,'an affordable visible route');
    await tap(page,`[data-route-select="${route.uid}"]`);assert.deepEqual(await getState(page),before);if(step===0&&run===1)await page.screenshot({path:path.join(out,'natural-map-branch.png'),fullPage:true});
    await tap(page,`[data-route-detail="${route.uid}"] [data-travel]`);await captureState(page,`voyage-${run}-event-${step+1}`,'natural');
    if(step===0&&run===1)await page.screenshot({path:path.join(out,'natural-event-icons.png'),fullPage:true});
    const choice=step===0?'[data-choice=force]':'[data-choice]:not(:disabled) >> nth=0';await tap(page,choice);await finishLoad(page);assert.equal((await getState(page)).phase,'result');
    if(step===0&&run===1){await page.screenshot({path:path.join(out,'natural-result-icons.png'),fullPage:true});await tap(page,'[data-tab=cargo]');await page.screenshot({path:path.join(out,'natural-cargo-shapes.png'),fullPage:true});await tap(page,'[data-tab=play]');}
    await tap(page,'[data-act=continue]');
   }
   await tap(page,'[data-tab=route]');await page.screenshot({path:path.join(out,`natural-map-return-${run}.png`),fullPage:true});await tap(page,'[data-act=home]');await tap(page,'[data-act=confirm]');await captureState(page,`returned-voyage-${run}`,'natural');
   if(await page.locator('[data-act=sellAll]').isVisible())await tap(page,'[data-act=sellAll]');await tap(page,'[data-act=port]');
   if(run===1){await tap(page,'[data-act=fuel]');if((await getState(page)).hull<100)await tap(page,'[data-act=repair]');if((await getState(page)).money>=150){await tap(page,'[data-act=repay]');await tap(page,'[data-act=pay100]');}}
   const saved=await captureState(page,`saved-after-voyage-${run}`,'natural'),video=page.video();await page.close();await video.saveAs(path.join(out,`natural-voyage-${run}.webm`));
   if(run===1){page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await boot(page,url);assert.deepEqual(await getState(page),saved);await captureState(page,'reopened-before-second-voyage','natural');}
  }
  await context.close();
  const qa=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,recordVideo:{dir:path.join(out,'raw-videos'),size:{width:390,height:844}}});page=await qa.newPage();page.on('pageerror',e=>report.errors.push(e.message));await boot(page,url);
  const fixture=E.create(123);fixture.cargo=[{uid:1,name:'QA 方形容器',size:1,value:60,ability:null,acquiredRun:0,shapeId:'square4',shapeVersion:1},{uid:2,name:'QA 长条构件',size:1,value:80,ability:null,acquiredRun:0,shapeId:'line4',shapeVersion:1}];fixture.nextUid=3;fixture.cargoGrid.placements=E.Cargo.solve(fixture.cargo);E.assertState(fixture);await importQA(page,fixture);await tap(page,'[data-tab=cargo]');await captureState(page,'generic-cargo-before','qa');
  await tap(page,'[data-cargo-pick="2"]');await tap(page,'[data-cargo-stage]');await tap(page,'[data-cargo-rotate]');await tap(page,'[data-cargo-cell="3,0"]');await tap(page,'[data-cargo-pick="1"]');await tap(page,'[data-cargo-stage]');await tap(page,'[data-cargo-cell="0,2"]');await tap(page,'[data-cargo-save]');
  await captureState(page,'tap-rotated-and-saved','qa');await page.locator('.cargo-board').scrollIntoViewIfNeeded();const from=await page.locator('[data-cargo-cell="0,2"]').boundingBox(),to=await page.locator('[data-cargo-cell="0,0"]').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.mouse.up();await delay(450);await tap(page,'[data-cargo-save]');const saved=await captureState(page,'dragged-and-saved','qa');await page.screenshot({path:path.join(out,'qa-generic-cargo.png'),fullPage:true});
  await page.reload();await page.waitForFunction(()=>__SALVAGE__);assert.deepEqual(await getState(page),saved);await tap(page,'[data-tab=cargo]');await page.screenshot({path:path.join(out,'qa-cargo-reloaded.png'),fullPage:true});await captureState(page,'reload-preserved','qa');const video=page.video();await page.close();await video.saveAs(path.join(out,'qa-rotate-drag-persist.webm'));await qa.close();
  assert.deepEqual(report.errors,[]);report.completed=true;
 }finally{
  await browser?.close();server?.kill();fs.writeFileSync(path.join(out,'capture-report.json'),JSON.stringify(report,null,2)+'\n');
 }
 console.log(JSON.stringify({completed:report.completed,output:out,natural:report.natural.checkpoints.length,qa:report.qa.checkpoints.length,errors:report.errors},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
