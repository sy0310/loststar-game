/* Real fixed-package HTTP recording. No fixture import, seed override or extra funds. */
const {chromium,webkit}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'artifacts/salvage-route'),dev=path.join(out,'developer'),url=process.env.SALVAGE_URL||'http://127.0.0.1:4283/loststar-salvage/';
fs.mkdirSync(dev,{recursive:true});fs.mkdirSync(path.join(out,'screens'),{recursive:true});
const read=p=>p.evaluate(()=>__SALVAGE__.state());
async function tap(p,selector){await p.waitForFunction(()=>window.__SALVAGE__?.ready());await p.locator(selector).tap();await p.waitForFunction(()=>window.__SALVAGE__.ready());await p.waitForTimeout(700);}
(async()=>{
 const b=await chromium.launch(),c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,recordVideo:{dir:path.join(root,'releases/salvage-video'),size:{width:390,height:844}}});let p=await c.newPage();const errors=[],failures=[],record={mode:'Ordinary fresh saved game, real controls; no QA imports, no money/clock/seed overrides. Two original page recordings with actual close/reopen between voyages.',url,checkpoints:[],pageErrors:errors,resourceFailures:failures};
 c.on('page',q=>{q.on('pageerror',e=>errors.push(e.message));q.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url);await p.waitForFunction(()=>window.__SALVAGE__);await tap(p,'#modal-buttons [data-act=close]');record.build=await p.evaluate(()=>__SALVAGE__.build);let s=await read(p);assert.equal(s.money,120);assert.equal(s.cargo.length,0);await p.screenshot({path:path.join(out,'screens/home-390.png')});await tap(p,'[data-tab=cargo]');await p.screenshot({path:path.join(out,'screens/empty-cargo-390.png')});await tap(p,'[data-tab=play]');
 const videos=[];
 for(let run=1;run<=2;run++){
  await tap(p,'[data-act=depart]');if(run===1)await p.screenshot({path:path.join(out,'screens/route-budget-390.png'),fullPage:true});
  for(let step=0;step<3;step++){
   await tap(p,'[data-travel]:not(:disabled) >> nth=0');await p.waitForTimeout(1100);await tap(p,step===0?'[data-choice=force]':'[data-choice]:not(:disabled) >> nth=0');await p.waitForTimeout(1100);await tap(p,'[data-act=continue]');
  }
  await tap(p,'[data-act=home]');await tap(p,'[data-act=confirm]');await p.waitForTimeout(1100);if(run===1)await p.screenshot({path:path.join(out,'screens/return-account-390.png'),fullPage:true});
  record.checkpoints.push({label:'return-'+run,state:await read(p)});if(await p.locator('[data-act=sellAll]').isVisible())await tap(p,'[data-act=sellAll]');await tap(p,'[data-act=port]');
  if(run===1){await tap(p,'[data-act=fuel]');if((await read(p)).hull<100)await tap(p,'[data-act=repair]');if((await read(p)).money>=150){await tap(p,'[data-act=repay]');await tap(p,'[data-act=pay100]');}
   const saved=await read(p);await p.reload();await p.waitForFunction(()=>window.__SALVAGE__);assert.deepEqual(await read(p),saved);record.refreshed=true;const video=p.video();await p.close();videos.push(await video.path());p=await c.newPage();await p.goto(url);await p.waitForFunction(()=>window.__SALVAGE__);assert.deepEqual(await read(p),saved);record.closedAndReopened=true;record.checkpoints.push({label:'reopened-real-progress',state:await read(p)});
  }
 }
 record.final=await read(p);assert.equal(record.final.runNo,2);assert.equal(record.final.phase,'port');assert(record.final.debt<12000);record.totalNavigation=await p.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(x=>({domContentLoaded:x.domContentLoadedEventEnd,load:x.loadEventEnd,transferSize:x.transferSize})),resourceBytes:performance.getEntriesByType('resource').reduce((n,x)=>n+x.transferSize,0)}));
 const last=p.video();await p.close();videos.push(await last.path());await c.close();await b.close();record.rawVideoPaths=videos;fs.writeFileSync(path.join(dev,'natural-two-voyages.json'),JSON.stringify(record,null,2));
 const views=[];
 for(const[driver,name]of[[chromium,'chromium'],[webkit,'webkit']])for(const[width,height]of[[360,800],[390,844]]){
  const browser=await driver.launch(),context=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.__SALVAGE__);await tap(page,'#modal-buttons [data-act=close]');const file=`home-${name}-${width}.png`;await page.screenshot({path:path.join(out,'screens',file)});const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,safeTop:document.querySelector('.safe').getBoundingClientRect().height,resources:document.querySelector('#resources').getBoundingClientRect().height,decoded:document.querySelector('.salvage-ship').naturalWidth>0}));assert(!metrics.overflow);assert(metrics.safeTop>=32);assert(metrics.decoded);views.push({engine:name,width,height,file,metrics});await context.close();await browser.close();
 }
 fs.writeFileSync(path.join(out,'screen-checks.json'),JSON.stringify({build:record.build,scope:'Real HTTP fixed ZIP desktop mobile viewports, not physical phone.',views},null,2));console.log(JSON.stringify({source:record.build,errors,failures,videos,final:{run:record.final.runNo,phase:record.final.phase},views:views.length},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
