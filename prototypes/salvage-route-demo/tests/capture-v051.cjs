/* Running HTTP evidence. Natural sessions and explicit QA imports are separate. */
const {chromium,webkit}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../src/engine.js');
const O=require('./legacy-engine.cjs')('842dc6afcfc3da079c40dc996a4dd346769d62e0');
const {act,safePort}=require('./v051-fixtures.cjs');
const output=path.resolve(process.env.SALVAGE_CAPTURE_OUT||'releases/v051-visual-review');
const url=process.env.SALVAGE_URL||'http://127.0.0.1:4302/loststar-salvage/';
const baseline=process.env.SALVAGE_BASELINE_URL||'http://127.0.0.1:4301/loststar-salvage/';
const reviewOnly=process.env.SALVAGE_CAPTURE_REVIEW==='1';
fs.mkdirSync(output,{recursive:true});
const report={completed:false,reviewOnly,physicalPhoneTested:false,scope:'Real HTTP desktop browser touch emulation. Natural uses fresh crypto RNG and ordinary UI actions. QA explicitly imports copies and never operates the original user profile.',build:null,baselineBuild:null,natural:{imported:false,seedOverridden:false,clockOverridden:false,checkpoints:[],visibleDiscoveries:[],visibleAnomalies:[],tapTrace:[]},pictures:[],gate:{imported:true,checkpoints:[]},market:{imported:true,checkpoints:[],tapTrace:[]},errors:[]};
const state=page=>page.evaluate(()=>__SALVAGE__.state());
async function boot(page,entry=url){page.on('pageerror',error=>report.errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&/\/(src|assets)\//.test(response.url()))report.errors.push(response.status()+' '+response.url());});await page.goto(entry);await page.waitForFunction(()=>window.__SALVAGE__);if(await page.locator('#modal-close').isVisible())await tap(page,'#modal-close');}
async function tap(page,selector,trace){await page.waitForFunction(()=>__SALVAGE__.ready());await page.locator(selector).tap();await page.waitForFunction(()=>__SALVAGE__.ready());if(trace)trace.push({selector,phase:(await state(page)).phase});}
async function confirm(page,selector,trace){await tap(page,selector,trace);await tap(page,'[data-act=confirm]',trace);}
async function shot(page,name,fullPage=false){await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode().catch(()=>{}))));await page.screenshot({path:path.join(output,name+'.png'),fullPage,animations:'disabled'});}
async function load(page,value,model=E){await tap(page,'[data-act=settings]');await tap(page,'[data-act=import]');await page.locator('#import-file').setInputFiles({name:'explicit-isolated-QA-v051.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await tap(page,'[data-act=confirm]');assert.deepEqual(await state(page),JSON.parse(JSON.stringify(model.restore(value))));}
async function point(page,name,list){const value=await state(page);E.assertState(value);list.push({name,state:value});return value;}
function options(width,video=false){return{viewport:{width,height:width===360?800:844},hasTouch:true,...(video?{recordVideo:{dir:path.join(output,'raw'),size:{width,height:width===360?800:844}}}:{})};}
async function video(page,name){const recording=page.video();await page.close();if(recording)await recording.saveAs(path.join(output,name+'.webm'));}
function eventAt(model,id,depth=3){let value=act(model.create(117),'depart',{},model);for(let i=1;i<=depth;i++){value=act(value,'travel',{id:value.route[0].uid},model);if(i<depth){value=act(value,'choose',{id:'leave',nonce:value.event.nonce},model);value=act(value,'continue',{},model);}}value.event.id=id;model.assertState(value);return value;}
async function pictures(driver,engine){const browser=await driver.launch();try{for(const width of[360,390])for(const [label,entry,model]of[['v050',baseline,O],['v051',url,E]]){const context=await browser.newContext(options(width));const page=await context.newPage();await boot(page,entry);const build=await page.evaluate(()=>LostCargoBuild);if(label==='v050')report.baselineBuild=build;else report.build=build;
 for(const [id,name]of[['tank','regular'],['magnetic_blind','curio']]){await load(page,eventAt(O,id),model);await shot(page,label+'-'+engine+'-'+width+'-'+name);
 const measurements=await page.locator(label==='v050'?'.event-featured-item':'.event-loot-preview .loot-body').evaluateAll(images=>images.map(image=>{const rect=image.getBoundingClientRect(),parent=image.parentElement.getBoundingClientRect(),css=getComputedStyle(image);return{src:image.getAttribute('src'),objectFit:css.objectFit,zIndex:css.zIndex,width:rect.width,height:rect.height,insideParent:rect.x>=parent.x&&rect.y>=parent.y&&rect.right<=parent.right&&rect.bottom<=parent.bottom,decoded:image.complete&&image.naturalWidth>0};}));report.pictures.push({label,engine,width,case:name,build,measurements});
 if(label==='v051'){assert(measurements.length>0);assert(measurements.every(row=>row.objectFit==='contain'&&row.insideParent&&row.decoded));}
 }
 await context.close();}}finally{await browser.close();}}
async function natural(browser){const context=await browser.newContext(options(390,true));let page=await context.newPage();await boot(page);report.build=await page.evaluate(()=>LostCargoBuild);
 for(let voyage=1;voyage<=3;voyage++){
  await point(page,'before-voyage-'+voyage,report.natural.checkpoints);await shot(page,'natural-home-'+voyage);
  await tap(page,'[data-act=depart]',report.natural.tapTrace);await tap(page,'[data-cargo-save]',report.natural.tapTrace);
  const target=voyage===2?5:3;
  for(let depth=1;depth<=target;depth++){
   let value=await state(page);const valid=value.route.filter(route=>E.quote(value,route).enabled);if(!valid.length)break;
   // Choose a visible new signal when available. The player still selects the route.
   const route=valid.find(route=>E.NewEncounters.metadata[route.id]&&!value.discoveries.encounters.some(seen=>seen.id===route.id))||valid[0];
   await tap(page,'[data-route-select="'+route.uid+'"]',report.natural.tapTrace);await tap(page,'[data-travel]',report.natural.tapTrace);value=await point(page,'voyage-'+voyage+'-arrival-'+depth,report.natural.checkpoints);
   if(await page.locator('.new-discovery').isVisible()){report.natural.visibleDiscoveries.push({run:value.runNo,depth:value.depth,id:value.event.id});await shot(page,'natural-new-discovery-'+voyage+'-'+depth);}
   if(await page.locator('.anomaly-card').isVisible()){report.natural.visibleAnomalies.push({run:value.runNo,depth:value.depth,text:await page.locator('.anomaly-card').innerText()});await shot(page,'natural-anomaly-'+voyage+'-'+depth);}
   await shot(page,'natural-event-'+voyage+'-'+depth);
   const choices=E.encounter(value).choices;
   const choice=choices.find(choice=>choice.effect.loot?.length&&!E.checkChoice(value,choice,{ignoreCargo:true})&&value.hull+(choice.effect.hull||0)-(choice.risk?.[1]||0)>=25)||choices.find(choice=>choice.id==='leave');assert(choice);
   await tap(page,'[data-choice="'+choice.id+'"]',report.natural.tapTrace);
   if(await page.locator('[data-cargo-save]').isVisible()){
    if(await page.locator('[data-cargo-save]').isDisabled())await tap(page,'[data-cargo-arrange]',report.natural.tapTrace);
    if(await page.locator('[data-cargo-save]').isEnabled())await tap(page,'[data-cargo-save]',report.natural.tapTrace);
    else{await tap(page,'[data-cargo-cancel]',report.natural.tapTrace);await tap(page,'[data-choice=leave]',report.natural.tapTrace);}
   }
   await shot(page,'natural-result-'+voyage+'-'+depth);
   await tap(page,'[data-act=continue]',report.natural.tapTrace);
  }
  let value=await state(page);assert(value.depth>=2);const method=E.returnQuotes(value).sort((a,b)=>a.cost-b.cost)[0].method;
  await confirm(page,method==='gate'?'[data-act=homeGate]':'[data-act=home]',report.natural.tapTrace);await point(page,'returned-voyage-'+voyage,report.natural.checkpoints);await shot(page,'natural-return-'+voyage);
  if((await state(page)).cargo.length)await tap(page,'[data-act=sellAll]',report.natural.tapTrace);
  await tap(page,'[data-act=depart]',report.natural.tapTrace);await tap(page,'[data-tab=shop]',report.natural.tapTrace);
  for(const supply of['fillFuel','fillHull'])if(await page.locator('[data-act='+supply+']').isEnabled())await confirm(page,'[data-act='+supply+']',report.natural.tapTrace);
  await tap(page,'#back',report.natural.tapTrace);const saved=await point(page,'saved-voyage-'+voyage,report.natural.checkpoints);
  await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);assert.deepEqual(await state(page),saved);await video(page,'natural-voyage-'+voyage);
  if(voyage<3){page=await context.newPage();await boot(page);assert.deepEqual(await state(page),saved);await point(page,'reopened-before-'+(voyage+1),report.natural.checkpoints);}
 }
 assert(report.natural.visibleDiscoveries.length>0);assert(report.natural.visibleAnomalies.length>0);await context.close();}
async function gates(browser){const context=await browser.newContext(options(390,true));const page=await context.newPage();await boot(page);
 for(const depth of[3,5]){await load(page,eventAt(E,'tank',depth));await shot(page,'qa-gate-'+depth+'-both-prices',true);const before=await point(page,'gate-'+depth+'-before',report.gate.checkpoints);await tap(page,'[data-act=homeGate]');await shot(page,'qa-gate-'+depth+'-confirmation');await tap(page,'#modal-close');assert.deepEqual(await state(page),before);await confirm(page,'[data-act=homeGate]');const returned=await point(page,'gate-'+depth+'-actual-receipt',report.gate.checkpoints);assert.equal(before.fuel-returned.fuel,E.V051.gate.fuel);await shot(page,'qa-gate-'+depth+'-receipt');}
 await video(page,'qa-gate-three-five-and-receipts');await context.close();}
async function market(browser){const context=await browser.newContext(options(390,true));const page=await context.newPage();await boot(page);let value=safePort(71,454);value.cargo=[{uid:value.nextUid++,itemId:'time_measure',name:'显式QA计量盒',shapeId:'line2',cells:2,shapeVersion:1,value:100,acquiredRun:0},{uid:value.nextUid++,itemId:'metal_crate',name:'显式QA普通件',shapeId:'point1',cells:1,shapeVersion:1,value:50,acquiredRun:0}];value.cargoGrid.placements=E.Cargo.solve(value.cargo,[],E.cargoSpace(value));await load(page,value);
 const trace=report.market.tapTrace;await tap(page,'[data-tab=shop]',trace);await tap(page,'[data-act=market]',trace);await shot(page,'qa-market-one-chance');await point(page,'before-one-quote',report.market.checkpoints);
 await tap(page,'[data-market-style=bold]',trace);await shot(page,'qa-market-consent');await tap(page,'#modal-close',trace);assert.deepEqual(await state(page),value);
 await confirm(page,'[data-market-style=bold]',trace);await shot(page,'qa-market-used');await point(page,'quoted-once',report.market.checkpoints);
 const offer=(await state(page)).market.offers[0];if(offer.status==='open')await tap(page,'[data-market-keep]',trace);
 await tap(page,'[data-market-select="'+value.cargo[1].uid+'"]',trace);assert.equal(await page.locator('[data-market-style]').count(),0);await shot(page,'qa-market-other-item-still-used');const saved=await point(page,'other-item-no-free-quote',report.market.checkpoints);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);assert.deepEqual(await state(page),saved);await tap(page,'[data-tab=shop]',trace);await tap(page,'[data-act=market]',trace);await shot(page,'qa-market-refresh-same-quota');
 await video(page,'qa-market-shared-chance-and-refresh');await context.close();}
(async()=>{for(const [driver,engine]of[[chromium,'chromium'],[webkit,'webkit']])await pictures(driver,engine);const browser=await chromium.launch();try{if(!reviewOnly){await natural(browser);await gates(browser);await market(browser);}}finally{await browser.close();}assert.deepEqual(report.errors,[]);report.completed=true;fs.rmSync(path.join(output,'raw'),{recursive:true,force:true});fs.writeFileSync(path.join(output,'capture-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({completed:true,output,pictures:report.pictures.length,naturalPoints:report.natural.checkpoints.length,visibleDiscoveries:report.natural.visibleDiscoveries.length,visibleAnomalies:report.natural.visibleAnomalies.length}));})().catch(error=>{report.failure=error.stack;fs.writeFileSync(path.join(output,'capture-report.json'),JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;});
