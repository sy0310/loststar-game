'use strict';
const {test,expect}=require('@playwright/test');
const E=(process.env.SALVAGE_LEGACY==='1'?require('../legacy-engine.cjs')('799a36e78cbd5397d671901fded19c10517429f9'):require('../../src/engine.js'));
const fs=require('node:fs');const O=require('../legacy-engine.cjs')();
const state=page=>page.evaluate(()=>window.__SALVAGE__.state());
async function boot(page){await page.goto('');await page.waitForFunction(()=>window.__SALVAGE__);const close=page.locator('#modal-buttons [data-act=close]');if(await close.isVisible())await close.tap();}
async function tap(page,selector){await page.waitForFunction(()=>window.__SALVAGE__.ready());if(selector.startsWith('[data-travel]')&&!await page.locator('[data-travel]').count()){await page.locator('[data-route-select]').first().tap();}await page.locator(selector).tap();await page.waitForFunction(()=>window.__SALVAGE__.ready());}
async function start(page){await tap(page,'[data-act=depart]');if(await page.locator('[data-cargo-save]').isVisible())await tap(page,'[data-cargo-save]');await expect.poll(async()=>(await state(page)).phase).toBe('route');}
async function importSave(page,value){await tap(page,'[data-act=settings]');await page.locator('[data-act=import]').tap();await page.locator('#import-file').setInputFiles({name:'explicit-qa-copy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await page.locator('[data-act=confirm]').tap();await expect(page.locator('#overlay')).toBeHidden();await expect.poll(()=>state(page)).toEqual(E.restore(value));}
async function archiveRead(page,key){return page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('lostcargo.route-demo.v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,t=db.transaction('archive','readonly'),r=t.objectStore('archive').get(key);r.onsuccess=()=>resolve(r.result);t.oncomplete=()=>db.close();};}),key);}
async function writeCurrent(page,value){await page.evaluate(value=>new Promise((resolve,reject)=>{const open=indexedDB.open('lostcargo.route-demo.v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,t=db.transaction('archive','readwrite');t.objectStore('archive').put(value,'current');t.oncomplete=()=>{db.close();resolve();};t.onabort=()=>reject(t.error);};}),value);}
function legacyGoods(sizes=[1,1,2]){const s=O.create(91);s.schema=2;s.money=643;s.runNo=2;s.cargo=sizes.map((size,i)=>({uid:i+1,name:`已持有测试货${i+1}`,size,value:70+i*13,acquiredRun:i%3,ability:i===0?'patch':null}));s.nextUid=s.cargo.length+1;delete s.cargoGrid;return s;}
function liveWithOldGoods(){let s=E.restore(legacyGoods([1,1,1,1]));s=E.dispatch(s,{type:'depart'}).state;s=E.dispatch(s,{type:'travel',id:s.route[0].uid}).state;return s;}

test('independent route map projects the real branch and selection spends no fuel or RNG',async({page})=>{
 await boot(page);const port=await state(page);await tap(page,'[data-tab=route]');await expect(page.locator('.map-port.is-current')).toBeVisible();expect(await state(page)).toEqual(port);
 await tap(page,'[data-tab=play]');await start(page);const before=await state(page);await tap(page,'[data-tab=route]');
 await expect(page.locator('[data-route-select]')).toHaveCount(2);
 for(const route of before.route){await expect(page.locator(`[data-route-select="${route.uid}"]`)).toContainText(route.name);}
 await tap(page,`[data-route-select="${before.route[1].uid}"]`);expect(await state(page)).toEqual(before);
 const detail=page.locator(`[data-route-detail="${before.route[1].uid}"]`),quote=E.quote(before,before.route[1]);
 await expect(detail).toBeVisible();for(const value of [quote.out,quote.returnCost,quote.free])await expect(detail).toContainText(String(value));
 await tap(page,`[data-route-detail="${before.route[1].uid}"] [data-travel]`);const arrived=await state(page);
 expect(arrived.fuel).toBe(quote.arrival);expect(arrived.history).toEqual([before.route[1].id]);
 await tap(page,'[data-tab=route]');await expect(page.locator('[data-route-select]')).toHaveCount(0);await expect(page.locator('[data-route-visited]')).toHaveCount(1);await expect(page.locator('.map-stop.is-current')).toBeVisible();
 await tap(page,'[data-tab=cargo]');await tap(page,'[data-tab=route]');expect(await state(page)).toEqual(arrived);
 await tap(page,'[data-tab=play]');await expect(page.locator('[data-choice]')).not.toHaveCount(0);expect(await state(page)).toEqual(arrived);
});

test('tap rotation and placement save to the real archive; invalid and interrupted gestures do not move cargo',async({page})=>{
 await boot(page);await importSave(page,E.restore(legacyGoods([1])));await start(page);await tap(page,'[data-tab=cargo]');const before=await state(page),uid=before.cargo[0].uid;
 await tap(page,`[data-cargo-pick="${uid}"]`);await tap(page,'[data-cargo-rotate]');await tap(page,'[data-cargo-cell="3,3"]');
 await expect(page.locator('[data-cargo-status]')).toContainText('边界');expect(await state(page)).toEqual(before);
 await tap(page,'[data-cargo-cell="2,2"]');expect(await state(page)).toEqual(before);await tap(page,'[data-cargo-save]');
 const saved=await state(page);expect(saved.cargoGrid.placements).toContainEqual({uid,x:2,y:2,rotation:1});expect(saved.rng).toBe(before.rng);expect(saved.fuel).toBe(before.fuel);expect(saved.money).toBe(before.money);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(saved);await tap(page,'[data-tab=cargo]');
 await page.locator('[data-cargo-cell="2,2"]').scrollIntoViewIfNeeded();
 await page.evaluate(()=>{
   const host=document.querySelector('#main'),cell=document.querySelector('[data-cargo-cell="2,2"]'),box=cell.getBoundingClientRect();
   const event=(kind,id,x,y)=>new PointerEvent(kind,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===51,button:0,buttons:1,clientX:x,clientY:y});
   cell.dispatchEvent(event('pointerdown',51,box.x+10,box.y+10));host.dispatchEvent(event('pointermove',51,box.x-100,box.y-100));host.dispatchEvent(event('pointercancel',51,box.x-100,box.y-100));
 });
 expect(await state(page)).toEqual(saved);await expect(page.locator('[data-cargo-save]')).toBeDisabled();
 await page.evaluate(()=>{
   const host=document.querySelector('#main'),cell=document.querySelector('[data-cargo-cell="2,2"]'),box=cell.getBoundingClientRect();
   const event=(kind,id,x,y)=>new PointerEvent(kind,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===61,button:0,buttons:1,clientX:x,clientY:y});
   cell.dispatchEvent(event('pointerdown',61,box.x+10,box.y+10));cell.dispatchEvent(event('pointerdown',62,box.x+20,box.y+20));host.dispatchEvent(event('pointermove',61,box.x-100,box.y-100));host.dispatchEvent(event('pointerup',61,box.x-100,box.y-100));host.dispatchEvent(event('pointerup',62,box.x+20,box.y+20));
 });
 expect(await state(page)).toEqual(saved);await expect(page.locator('[data-cargo-save]')).toBeDisabled();
});

test('cargo choice draft cancels without charging or rerolling; commit resolves the risk exactly once',async({page})=>{
 await boot(page);let fixture=E.dispatch(E.create(58),{type:'depart'}).state;fixture=E.dispatch(fixture,{type:'travel',id:fixture.route[0].uid}).state;fixture.event.id='mirror';await importSave(page,fixture);
 const before=await state(page),choice={type:'choose',id:'risk',nonce:before.event.nonce};await tap(page,'[data-choice=risk]');
 await expect(page.locator('[data-cargo-view]')).toBeVisible();await tap(page,'[data-cargo-edit]');await tap(page,'[data-cargo-arrange]');expect(await state(page)).toEqual(before);await tap(page,'[data-cargo-cancel]');expect(await state(page)).toEqual(before);
 await tap(page,'[data-choice=risk]');await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(before);await expect(page.locator('[data-choice=risk]')).toBeVisible();
 await tap(page,'[data-choice=risk]');await tap(page,'[data-cargo-edit]');await tap(page,'[data-cargo-arrange]');const draft=E.cargoDraft(before,choice),layout=E.Cargo.solve(draft.items,draft.placements),expected=E.dispatch(before,{...choice,layout});expect(expected.ok).toBe(true);
 await tap(page,'[data-cargo-save]');expect(await state(page)).toEqual(expected.state);const after=await state(page);
 const repeated=await page.evaluate(async action=>{const writer=await SalvageStore.open(1);try{return await writer.act(action,writer.revision);}finally{writer.close();}},choice);expect(repeated.ok).toBe(false);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(after);expect(after.cargo.length).toBe(before.cargo.length+1);expect(after.hull).toBeLessThan(before.hull);
});

test('full schema2 IndexedDB inventory is backed up and migrated once without changing owned goods or balances',async({page})=>{
 await boot(page);const legacy=legacyGoods(),original={format:1,revision:41,game:legacy};await writeCurrent(page,original);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);const migrated=await state(page);
 expect(migrated.schema).toBe(E.SCHEMA);expect(migrated.money).toBe(legacy.money);expect(migrated.rng).toBe(legacy.rng);expect(migrated.cargo.map(({shapeId,shapeVersion,cells,...item})=>item)).toEqual(legacy.cargo);
 expect(E.Cargo.validate(migrated.cargo,migrated.cargoGrid.placements).ok).toBe(true);expect(E.used(migrated)).toBe(16);
 expect(await archiveRead(page,'migration/schema-2')).toEqual(original);const stored=await archiveRead(page,'current');expect(stored.revision).toBe(42);expect(stored.game.schema).toBe(E.SCHEMA);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await archiveRead(page,'current')).toEqual(stored);expect(await archiveRead(page,'migration/schema-2')).toEqual(original);
 await tap(page,'[data-tab=cargo]');await expect(page.locator('.cargo-cell')).toHaveCount(16);expect(await page.locator('.cargo-cell.occupied').count()).toBe(16);
});

test('an aborted schema2 migration preserves the exact current envelope and exposes its original export',async({page})=>{
 await boot(page);const original={format:1,revision:41,game:legacyGoods()};await writeCurrent(page,original);
 await page.addInitScript(()=>{
   window.realArchivePut=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,key){
     const request=realArchivePut.call(this,value,key);
     if(key==='current'&&value?.revision===42&&value?.game?.schema===4){const transaction=this.transaction;queueMicrotask(()=>{try{transaction.abort();}catch{}});}
     return request;
   };
 });
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);await expect(page.locator('#storage-warning')).toBeVisible();
 expect(await archiveRead(page,'current')).toEqual(original);expect(await archiveRead(page,'migration/schema-2')).toBeUndefined();expect(await page.evaluate(()=>__SALVAGE__.status().persisted)).toBe(false);
 await tap(page,'[data-act=settings]');const download=page.waitForEvent('download');await page.locator('[data-act=export]').tap();const exported=JSON.parse(fs.readFileSync(await(await download).path(),'utf8'));expect(exported.rawSave).toEqual(original);
 await page.evaluate(()=>IDBObjectStore.prototype.put=realArchivePut);await page.locator('[data-act=retry]').tap();await expect.poll(()=>page.evaluate(()=>__SALVAGE__.status().persisted)).toBe(true);expect((await archiveRead(page,'current')).revision).toBe(42);expect(await archiveRead(page,'migration/schema-2')).toEqual(original);
});

test('a stale layout cannot restore a good sold by another real page',async({page,context})=>{
 await boot(page);const fixture=E.restore(legacyGoods([1]));await importSave(page,fixture);const other=await context.newPage();await boot(other);
 for(const p of[page,other])await p.evaluate(async()=>{window.gridWriter=await SalvageStore.open(1);});
 const expectedRevision=await page.evaluate(()=>gridWriter.revision),uid=fixture.cargo[0].uid;
 const sale=await other.evaluate(async v=>gridWriter.act({type:'sellAll'},v),expectedRevision);expect(sale.ok).toBe(true);
 const stale=await page.evaluate(async args=>gridWriter.act({type:'layout',layout:[{uid:args.uid,x:2,y:2,rotation:0}]},args.rev),{uid,rev:expectedRevision});expect(stale.ok).toBe(false);
 const stored=await archiveRead(page,'current');expect(stored.game.cargo).toEqual([]);expect(stored.game.cargoGrid.placements).toEqual([]);expect(stored.game.money).toBe(fixture.money+fixture.cargo[0].value);expect(stored.game.ledger.filter(x=>x.kind==='sale')).toHaveLength(1);
 for(const p of[page,other])await p.evaluate(()=>gridWriter.close());await other.close();
});

test('an import with the same game revision invalidates another page acquisition draft through storage revision',async({page,context})=>{
 await boot(page);await start(page);await tap(page,'[data-travel] >> nth=0');const before=await state(page);await tap(page,'[data-choice=force]');await expect(page.locator('[data-cargo-view]')).toBeVisible();
 const other=await context.newPage();await boot(other);const replacement=E.create(77);replacement.money=999;replacement.revision=before.revision;replacement.seq=before.seq;
 const changed=await other.evaluate(async replacement=>{const writer=await SalvageStore.open(1);try{return await writer.replace(replacement,writer.revision);}finally{writer.close();}},replacement);expect(changed.ok).toBe(true);
 await expect.poll(()=>state(page)).toEqual(replacement);await expect(page.locator('.cargo-loading')).toHaveCount(0);await expect(page.locator('[data-cargo-pick]')).toHaveCount(0);
 expect((await archiveRead(page,'current')).game).toEqual(replacement);await other.close();
});

test('failed layout write preserves the old archive and an out-of-bounds import cannot replace it',async({page})=>{
 await boot(page);await importSave(page,E.restore(legacyGoods([1])));await start(page);await tap(page,'[data-tab=cargo]');const before=await state(page),storedBefore=await archiveRead(page,'current'),uid=before.cargo[0].uid;
 await tap(page,`[data-cargo-pick="${uid}"]`);await tap(page,'[data-cargo-cell="2,2"]');
 await page.evaluate(()=>{window.originalTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=originalTransaction.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>{try{tx.abort();}catch{}});return tx;};});
 await tap(page,'[data-cargo-save]');await expect(page.locator('#storage-warning')).toBeVisible();expect(await state(page)).toEqual(before);
 await page.evaluate(()=>IDBDatabase.prototype.transaction=originalTransaction);expect(await archiveRead(page,'current')).toEqual(storedBefore);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(before);
 const invalid=JSON.parse(JSON.stringify(before));invalid.cargoGrid.placements[0].x=3;
 await tap(page,'[data-act=settings]');await page.locator('[data-act=import]').tap();await page.locator('#import-file').setInputFiles({name:'invalid-grid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await expect(page.locator('#toast')).toContainText('导入失败');expect(await archiveRead(page,'current')).toEqual(storedBefore);
});

test('full cargo replacement requires explicit old-good consent and has no free staging capacity',async({page})=>{
 await boot(page);await importSave(page,liveWithOldGoods());const before=await state(page),old=before.cargo.find(x=>!x.contract),second=before.cargo.filter(x=>!x.contract)[1];
 await tap(page,'[data-choice=force]');await expect(page.locator('[data-cargo-save]')).toBeDisabled();expect(await state(page)).toEqual(before);
 await tap(page,`[data-cargo-pick="${old.uid}"]`);await page.locator('.cargo-more summary').tap();await tap(page,'[data-cargo-discard]');await tap(page,'[data-cargo-confirm-discard]');await tap(page,'[data-cargo-arrange]');expect(await state(page)).toEqual(before);
 await tap(page,'[data-cargo-cancel]');expect(await state(page)).toEqual(before);
 await tap(page,'[data-choice=force]');await tap(page,`[data-cargo-pick="${old.uid}"]`);await page.locator('.cargo-more summary').tap();await tap(page,'[data-cargo-discard]');await tap(page,'[data-cargo-confirm-discard]');await tap(page,'[data-cargo-arrange]');
 // Three 2x2 parcels and one L cannot tile this hold even though their area is
 // exactly 16. The player must explicitly make a second sacrifice or cancel.
 await expect(page.locator('[data-cargo-save]')).toBeDisabled();
 await tap(page,`[data-cargo-pick="${second.uid}"]`);await page.locator('.cargo-more summary').tap();await tap(page,'[data-cargo-discard]');await tap(page,'[data-cargo-confirm-discard]');await tap(page,'[data-cargo-arrange]');await tap(page,'[data-cargo-save]');
 const after=await state(page);expect(after.phase).toBe('result');expect(after.cargo.some(x=>x.uid===old.uid||x.uid===second.uid)).toBe(false);expect(after.cargo).toHaveLength(5);expect(after.cargo.some(x=>x.uid===before.nextUid)).toBe(true);expect(after.hull).toBe(before.hull-16);expect(after.money).toBe(before.money);expect(after.missionSlot?.contract).toBe(true);expect(after.ledger.filter(x=>x.kind==='sale')).toHaveLength(0);expect(E.Cargo.validate(after.cargo,after.cargoGrid.placements).ok).toBe(true);
 await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(after);
});

test('icons and cargo touch targets stay readable at short screen and large text',async({page})=>{
 await boot(page);await page.setViewportSize({width:360,height:640});await page.evaluate(()=>document.documentElement.style.fontSize='18px');
 await expect(page.locator('#resources svg')).toHaveCount(4);await expect(page.locator('#nav svg')).toHaveCount(4);await start(page);await tap(page,'[data-tab=cargo]');
 const sizes=await page.locator('[data-cargo-cell]').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));
 expect(sizes).toHaveLength(16);for(const size of sizes){expect(size.width).toBeGreaterThanOrEqual(48);expect(size.height).toBeGreaterThanOrEqual(48);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await tap(page,'[data-tab=route]');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 const before=await state(page);await tap(page,`[data-route-select="${before.route[0].uid}"]`);await tap(page,`[data-route-detail="${before.route[0].uid}"] [data-travel]`);await expect(page.locator('#main .choice svg').first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
