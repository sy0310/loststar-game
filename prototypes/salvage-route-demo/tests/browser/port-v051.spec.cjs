const {test,expect}=require('@playwright/test');
const E=require('../../src/engine.js');
const O=require('../legacy-engine.cjs')('842dc6afcfc3da079c40dc996a4dd346769d62e0');
const {act,safePort}=require('../v051-fixtures.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));
const state=page=>page.evaluate(()=>__SALVAGE__.state());
async function tap(page,selector){await page.waitForFunction(()=>__SALVAGE__.ready());await page.locator(selector).tap();await page.waitForFunction(()=>__SALVAGE__.ready());}
async function boot(page){await page.goto('');await page.waitForFunction(()=>window.__SALVAGE__);if(await page.locator('#modal-close').isVisible())await tap(page,'#modal-close');}
async function load(page,value){await tap(page,'[data-act=settings]');await tap(page,'[data-act=import]');await page.locator('#import-file').setInputFiles({name:'explicit-isolated-v051-QA.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await tap(page,'[data-act=confirm]');await expect.poll(()=>state(page)).toEqual(E.restore(value));}
function eventFixture(id='tank',depth=3,model=E,shipId='starter'){let value=model.create(117);if(shipId!=='starter'){value.money=27049;value=act(value,'buyShip',{id:shipId},model);value=act(value,'equipShip',{id:shipId},model);value=act(value,'fillFuel',{},model);}value=act(value,'depart',{},model);for(let i=1;i<=depth;i++){value=act(value,'travel',{id:value.route[0].uid},model);if(i<depth){value=act(value,'choose',{id:'leave',nonce:value.event.nonce},model);value=act(value,'continue',{},model);}}value.event.id=id;model.assertState(value);return value;}
function marketFixture(){const value=safePort(72,454);value.cargo=[{uid:value.nextUid++,itemId:'time_measure',shapeId:'line2',shapeVersion:1,cells:2,name:'QA计量盒',value:100,acquiredRun:0},{uid:value.nextUid++,itemId:'metal_crate',shapeId:'point1',shapeVersion:1,cells:1,name:'QA普通件',value:50,acquiredRun:0}];value.cargoGrid.placements=E.Cargo.solve(value.cargo,[],E.cargoSpace(value));return value;}
async function archive(page,key,value){return page.evaluate(({key,value})=>new Promise((resolve,reject)=>{const open=indexedDB.open('lostcargo.route-demo.v1');open.onsuccess=()=>{const db=open.result,t=db.transaction('archive',value===undefined?'readonly':'readwrite'),store=t.objectStore('archive');let result;if(value!==undefined)store.put(value,key);else{const get=store.get(key);get.onsuccess=()=>result=get.result;}t.oncomplete=()=>{db.close();resolve(result);};t.onabort=()=>reject(t.error);};}),{key,value});}

for(const [id,label]of[['tank','regular1/2/3'],['engine','regular4/8'],['frozen_freight','whole-square-curio'],['magnetic_blind','whole-L-curio'],['backwards_clock','whole-line-curio'],['reverse_beacon','whole-T-curio']]){
 test('loot preview '+label+' decodes whole sprites with contain, exact box and no ship occlusion',async({page},info)=>{
  await boot(page);await load(page,eventFixture(id,3,E,id==='engine'?'heavy':'starter'));
  await expect(page.locator('.event-loot-preview')).toBeVisible();
  await expect(page.locator('.event-loot-preview .salvage-ship')).toHaveCount(0);
  const expected=E.encounter(await state(page)).choices.flatMap(choice=>choice.effect.loot||[]);
  const expectedIds=new Set(expected.map(item=>[item.itemId,item.shapeId,item.name].join('/')));
  await expect(page.locator('.event-loot-preview .loot-card')).toHaveCount(expectedIds.size);
  const measurements=[];
  for(const image of await page.locator('.event-loot-preview img.loot-body').all()){
   await image.scrollIntoViewIfNeeded();
   const measure=await image.evaluate(async image=>{
    await image.decode();const rect=image.getBoundingClientRect(),frame=image.closest('.loot-frame').getBoundingClientRect(),css=getComputedStyle(image);
    const top=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
    return {src:image.getAttribute('src'),decoded:image.complete&&image.naturalWidth>0,objectFit:css.objectFit,zIndex:css.zIndex,
     rect:{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom},frame:{x:frame.x,y:frame.y,right:frame.right,bottom:frame.bottom},visibleAbove:top?.closest('.loot-frame')===image.closest('.loot-frame')};
   });
   expect(measure.decoded).toBe(true);expect(measure.objectFit).toBe('contain');expect(measure.zIndex).toBe('2');expect(measure.visibleAbove).toBe(true);
   expect(measure.rect.x).toBeGreaterThanOrEqual(measure.frame.x);expect(measure.rect.y).toBeGreaterThanOrEqual(measure.frame.y);expect(measure.rect.right).toBeLessThanOrEqual(measure.frame.right);expect(measure.rect.bottom).toBeLessThanOrEqual(measure.frame.bottom);
   measurements.push(measure);
  }
  await info.attach('whole-loot-computed-boxes',{body:Buffer.from(JSON.stringify(measurements,null,2)),contentType:'application/json'});
  const saved=await state(page);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(saved);await expect(page.locator('.event-loot-preview')).toBeVisible();
 });
}

test('result renders only actually committed UIDs and shows no imaginary pickup after leaving',async({page})=>{
 await boot(page);const value=eventFixture('tank',1);await load(page,value);
 await tap(page,'[data-choice=leave]');await expect(page.locator('.received-loot')).toHaveCount(0);
 await load(page,value);await tap(page,'[data-choice=force]');await tap(page,'[data-cargo-save]');
 const saved=await state(page);const ids=saved.result.cargoChanges.added.map(item=>String(item.uid));
 expect(await page.locator('.received-loot .loot-card').evaluateAll(cards=>cards.map(card=>card.dataset.lootUid))).toEqual(ids);
 expect(ids).toHaveLength(3);for(const uid of ids)expect(saved.cargo.some(item=>item.uid===Number(uid))).toBe(true);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);await expect(page.locator('.received-loot img')).toHaveCount(3);
});

for(const depth of[3,5])test('station'+depth+' offers real normal/gate budgets; cancellation is free and receipt charges once',async({page})=>{
 await boot(page);const value=eventFixture('tank',depth);await load(page,value);
 await expect(page.locator('[data-act=homeGate]')).toContainText('8燃料');await expect(page.locator('[data-act=home]')).toContainText(depth===3?'14燃料':'25燃料');
 if(depth===5)await expect(page.locator('[data-act=home]')).toBeDisabled();
 await tap(page,'[data-act=homeGate]');await tap(page,'#modal-close');expect(await state(page)).toEqual(value);
 await tap(page,'[data-act=homeGate]');await tap(page,'[data-act=confirm]');
 const returned=await state(page);expect(returned.phase).toBe('summary');expect(returned.fuel).toBe(value.fuel-8);expect(returned.summary.returnMethod).toBe('gate');
 await expect(page.locator('.return-fuel-receipt')).toContainText('实扣8燃料');expect(returned.telemetry.filter(row=>row.kind==='return')).toHaveLength(1);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(returned);
});

test('station4 preserves normal reserve while station5 card advertises a guaranteed affordable gate',async({page})=>{
 await boot(page);let value=eventFixture('tank',4);value=act(value,'choose',{id:'leave',nonce:value.event.nonce});value=act(value,'continue');await load(page,value);
 await expect(page.locator('[data-act=homeGate]')).toHaveCount(0);await expect(page.locator('.return-hint')).toContainText('第5站');
 await tap(page,'[data-route-select="'+value.route[0].uid+'"]');await expect(page.locator('.gate-forecast')).toContainText('折返8 / 原航道25');await expect(page.locator('[data-travel]')).toBeEnabled();
 await tap(page,'[data-travel]');expect((await state(page)).depth).toBe(5);await expect(page.locator('[data-act=homeGate]')).toBeEnabled();
});

test('two windows cannot charge gate fuel or conclude the same voyage twice',async({page,context})=>{
 await boot(page);const value=eventFixture('tank',5);await load(page,value);const other=await context.newPage();await boot(other);
 for(const current of[page,other])await tap(current,'[data-act=homeGate]');
 await Promise.allSettled([page.locator('[data-act=confirm]').tap({timeout:1500}),other.locator('[data-act=confirm]').tap({timeout:1500})]);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);const saved=await state(page);expect(saved.fuel).toBe(value.fuel-8);expect(saved.telemetry.filter(row=>row.kind==='return')).toHaveLength(1);expect(saved.summary.returnFuel).toBe(8);await other.close();
});

test('schema7 ongoing migration backs up atomically and keeps the original voyage gate-free',async({page})=>{
 await boot(page);const old=eventFixture('magnetic_blind',3,O);const raw={format:1,revision:36,game:copy(old)};await archive(page,'current',raw);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);
 expect(await archive(page,'migration/schema-7')).toEqual(raw);expect(await state(page)).toEqual(E.restore(old));await expect(page.locator('[data-act=homeGate]')).toHaveCount(0);await expect(page.locator('.reserve')).toContainText('下趟启用');
 const saved=await state(page);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(saved);
});

test('market quota is visible, consumes one shared chance and cannot be restored by same-return import',async({page})=>{
 await boot(page);const value=marketFixture();await load(page,value);await tap(page,'[data-tab=shop]');await tap(page,'[data-act=market]');await expect(page.locator('.market-quota')).toContainText('剩余1次');
 await tap(page,'[data-market-style=bold]');await expect(page.locator('#modal-body')).toContainText('低价留货也消耗');await tap(page,'#modal-close');expect(await state(page)).toEqual(value);
 await tap(page,'[data-market-style=bold]');await tap(page,'[data-act=confirm]');await expect(page.locator('.market-quota')).toContainText('已使用');
 const saved=await state(page);await tap(page,'[data-market-select="'+value.cargo[1].uid+'"]');await expect(page.locator('[data-market-style]')).toHaveCount(0);await expect(page.locator('[data-market-sell]')).toBeEnabled();
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(saved);
 await tap(page,'[data-act=settings]');await tap(page,'[data-act=import]');await page.locator('#import-file').setInputFiles({name:'same-return-older-QA-copy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await tap(page,'[data-act=confirm]');
 expect((await state(page)).market.quota.used).toBe(true);await tap(page,'[data-tab=shop]');await tap(page,'[data-act=market]');await expect(page.locator('.market-quota')).toContainText('已使用');await expect(page.locator('[data-market-style]')).toHaveCount(0);
});

test('failed gate or quote storage preserves current save and opportunity without fictional success',async({page})=>{
 await boot(page);const value=eventFixture('tank',5);await load(page,value);
 await page.evaluate(()=>{window.originalV051Put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){const request=window.originalV051Put.call(this,value,key);if(key==='current'&&value.game.summary?.returnMethod==='gate'){const transaction=this.transaction;queueMicrotask(()=>{try{transaction.abort();}catch{}});}return request;};});
 await tap(page,'[data-act=homeGate]');await tap(page,'[data-act=confirm]');await expect(page.locator('#storage-warning')).toBeVisible();expect(await state(page)).toEqual(value);expect((await archive(page,'current')).game).toEqual(value);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(value);
});

test('anomaly card and first discovery badge survive refresh, respect reduced motion and never cover actions',async({page})=>{
 await boot(page);await page.emulateMedia({reducedMotion:'reduce'});
 let value;for(let seed=1;seed<100;seed++){let candidate=E.create(seed);candidate=act(candidate,'depart');candidate=act(candidate,'travel',{id:candidate.route[0].uid});candidate=act(candidate,'choose',{id:'leave',nonce:candidate.event.nonce});candidate=act(candidate,'continue');const route=candidate.route.find(route=>E.NewEncounters.metadata[route.id]&&E.quote(candidate,route).enabled);if(!route)continue;candidate=act(candidate,'travel',{id:route.uid});if(E.encounter(candidate).eggText){value=candidate;break;}}
 expect(value).toBeTruthy();await load(page,value);await expect(page.locator('.new-discovery')).toHaveText('新发现');await expect(page.locator('.anomaly-card')).toBeVisible();expect(await page.locator('.anomaly-signal').evaluate(element=>getComputedStyle(element).animationName)).toBe('none');
 const before=await state(page);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(before);await expect(page.locator('.anomaly-card')).toBeVisible();
 await tap(page,'[data-choice=leave]');await expect(page.locator('[data-act=continue]')).toBeEnabled();expect((await state(page)).discoveries.eggs).toEqual(before.discoveries.eggs);
});
