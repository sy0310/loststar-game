'use strict';
const{test,expect}=require('@playwright/test'),E=require('../legacy-engine.cjs')('754113a197e52762a80de5e33a45192074f2a99b'),OLD=require('../legacy-engine.cjs')('ba90efbd01143533018f08a28f4221d9c36178c1');
const state=p=>p.evaluate(()=>__SALVAGE__.state());
async function tap(p,s){await p.waitForFunction(()=>__SALVAGE__.ready());await p.locator(s).tap();await p.waitForFunction(()=>__SALVAGE__.ready());}
async function boot(p){await p.goto('');await p.waitForFunction(()=>window.__SALVAGE__);if(await p.locator('#modal-buttons [data-act=close]').isVisible())await tap(p,'#modal-buttons [data-act=close]');}
async function confirm(p,s){await tap(p,s);await tap(p,'[data-act=confirm]');await expect(p.locator('#overlay')).toBeHidden();}
async function load(p,s){await tap(p,'[data-act=settings]');await tap(p,'[data-act=import]');await p.locator('#import-file').setInputFiles({name:'explicit041-QA-copy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await tap(p,'[data-act=confirm]');await expect.poll(()=>state(p)).toEqual(E.restore(s));}
function rich(){const s=E.create(42);s.money=27049;return s;}
function goods(shapes){const s=rich();s.cargo=shapes.map((shapeId,i)=>({uid:i+1,name:'QA整体回收物'+i,itemId:'broken_engine',cells:E.Cargo.area(shapeId),shapeId,shapeVersion:1,value:40,acquiredRun:0}));s.nextUid=s.cargo.length+1;s.cargoGrid.placements=E.Cargo.solve(s.cargo);E.assertState(s);return s;}
async function archive(p,key,value){return p.evaluate(({key,value})=>new Promise((resolve,reject)=>{const r=indexedDB.open('lostcargo.route-demo.v1');r.onsuccess=()=>{const db=r.result,t=db.transaction('archive',value===undefined?'readonly':'readwrite'),st=t.objectStore('archive');let v;if(value!==undefined)st.put(value,key);else{const q=st.get(key);q.onsuccess=()=>v=q.result;}t.oncomplete=()=>{db.close();resolve(v);};t.onabort=()=>reject(t.error);};r.onerror=()=>reject(r.error);}),{key,value});}

test('fuel and hull upgrades are visible immediately, show plain caps, cost once and survive reload',async({page})=>{
 await boot(page);await load(page,rich());await tap(page,'[data-tab=fleet]');
 await expect(page.locator('[data-shipupgrade=fuel]')).toBeVisible();await expect(page.locator('[data-shipupgrade=hull]')).toBeVisible();
 await expect(page.locator('#main')).not.toContainText('实际损伤');await expect(page.locator('#main')).not.toContainText('前进基值');
 await confirm(page,'[data-shipupgrade=fuel]');let s=await state(page);expect(s.fuel).toBe(60);expect(s.money).toBe(27049-300);await expect(page.locator('#resources')).toContainText('60/120');
 await confirm(page,'[data-shipupgrade=hull]');s=await state(page);expect(s.hull).toBe(125);expect(s.money).toBe(27049-300-350);await expect(page.locator('#resources')).toContainText('125/125');
 const y=await page.evaluate(()=>scrollY);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(s);await tap(page,'[data-tab=shop]');await expect(page.locator('.supply-item').first()).toContainText('60 → 120');await confirm(page,'[data-act=fillFuel]');expect((await state(page)).fuel).toBe(120);
});

test('each ship has its own caps and saved tank/hull, equipping never refills or discards the former stock',async({page})=>{
 await boot(page);let s=rich();s.fuel=83;s.hull=48;await load(page,s);await tap(page,'[data-tab=fleet]');await confirm(page,'[data-buyship=cargo]');await tap(page,'[data-equip=cargo]');await expect(page.locator('#resources')).toContainText('0/120');await expect(page.locator('#resources')).toContainText('140/140');await tap(page,'#back');await tap(page,'[data-tab=shop]');await confirm(page,'[data-act=fillFuel]');await tap(page,'#back');await tap(page,'[data-tab=fleet]');const money=(await state(page)).money;await tap(page,'[data-equip=starter]');s=await state(page);expect(s.fuel).toBe(83);expect(s.hull).toBe(48);expect(s.money).toBe(money);await tap(page,'[data-equip=cargo]');s=await state(page);expect(s.fuel).toBe(120);expect(s.hull).toBe(140);expect(s.money).toBe(money);
});

test('actual schema5 migrates once with all purchased rights, existing backup and wallet unchanged',async({page})=>{
 await boot(page);let old=OLD.create(42);old.money=27049;old=OLD.dispatch(old,{type:'buyShip',id:'cargo'}).state;old=OLD.dispatch(old,{type:'equipShip',id:'cargo'}).state;old=OLD.dispatch(old,{type:'upgradeCargo'}).state;old.fuel=32;old.hull=48;old=JSON.parse(JSON.stringify(old));const envelope={format:1,revision:9,game:old};await archive(page,'migration/schema-5',{earlier:'preserve'});await archive(page,'current',envelope);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(E.restore(old));expect(await archive(page,'migration/schema-5')).toEqual({earlier:'preserve'});expect((await archive(page,'current')).revision).toBe(10);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect((await archive(page,'current')).revision).toBe(10);
});

test('event narrative is visible in full immediately without an extra disclosure or repeated intro',async({page})=>{
 await boot(page);await tap(page,'[data-act=depart]');await tap(page,'[data-cargo-save]');await tap(page,'[data-route-select] >> nth=0');await tap(page,'[data-travel]');const s=await state(page),ev=E.encounter(s);await expect(page.locator('.event-record')).toBeVisible();await expect(page.locator('.event-record')).toHaveText(ev.text);await expect(page.locator('.event-intro details')).toHaveCount(0);await expect(page.locator('.event-intro')).not.toContainText('现场记录现场记录');
});

test('whole physical cargo fills every actual occupied cell, empty cutouts stay transparent and CSS boxes align',async({page})=>{
 await boot(page);await load(page,goods(['ell3','line3','square4','tee4']));await tap(page,'[data-tab=cargo]');await expect(page.locator('[data-cargo-object]')).toHaveCount(4);await expect(page.locator('[data-cargo-object] img')).toHaveCount(4);await expect.poll(()=>page.locator('[data-cargo-object] img').evaluateAll(es=>es.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 const result=await page.evaluate(()=>{const E=LostCargo,s=__SALVAGE__.state();return [...document.querySelectorAll('[data-cargo-object]')].map(el=>{const x=s.cargo.find(x=>x.uid===+el.dataset.cargoObject),p=s.cargoGrid.placements.find(p=>p.uid===x.uid),img=el.querySelector('img'),canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,mask=new Set(E.Cargo.cells(x).map(c=>c.join(','))),coverage=[];for(let gy=0;gy<canvas.height/48;gy++)for(let gx=0;gx<canvas.width/48;gx++){let n=0;for(let y=0;y<48;y++)for(let xx=0;xx<48;xx++)n+=data[((gy*48+y)*canvas.width+gx*48+xx)*4+3]>0;coverage.push({occupied:mask.has(gx+','+gy),ratio:n/(48*48)});}const r=el.getBoundingClientRect(),ir=img.getBoundingClientRect(),cell=document.querySelector('[data-cargo-cell="'+p.x+','+p.y+'"]').getBoundingClientRect();return{coverage,bounds:{left:r.x,top:r.y,width:r.width,height:r.height,imgLeft:ir.x,imgTop:ir.y,imgWidth:ir.width,imgHeight:ir.height,cellX:cell.x,cellY:cell.y}};});});
 for(const r of result){for(const c of r.coverage)expect(c.occupied?c.ratio>=.7:c.ratio===0).toBe(true);const b=r.bounds;for(const delta of[b.left-b.imgLeft,b.top-b.imgTop,b.width-b.imgWidth,b.height-b.imgHeight,b.left-b.cellX,b.top-b.cellY])expect(Math.abs(delta)).toBeLessThan(1);}
});

test('rotating cargo rotates the whole physical image with its mask and saves only on confirmation',async({page})=>{
 await boot(page);await load(page,goods(['ell3']));await tap(page,'[data-tab=cargo]');const before=await state(page);await tap(page,'[data-cargo-pick="1"]');for(let r=1;r<=3;r++){await tap(page,'[data-cargo-rotate]');await expect(page.locator('[data-cargo-object="1"] img')).toHaveAttribute('data-rotation',String(r));expect(await state(page)).toEqual(before);}await tap(page,'[data-cargo-save]');const saved=await state(page);expect(saved.cargoGrid.placements[0].rotation).toBe(3);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(saved);await tap(page,'[data-tab=cargo]');await expect(page.locator('[data-cargo-object="1"] img')).toHaveAttribute('data-rotation','3');
});

test('every registered current and legacy footprint is read through the actual cargo entry',async({page})=>{
 await boot(page);
 for(const shapeId of Object.keys(E.Cargo.SHAPES)){
  const s=goods([shapeId]);await load(page,s);await tap(page,'[data-tab=cargo]');
  const img=page.locator('[data-cargo-object="1"] img');await expect(img).toHaveAttribute('data-footprint',shapeId);await expect.poll(()=>img.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  const expected=shapeId==='point1'?'item_broken_engine':shapeId==='legacy4'?'cargo_square4':shapeId==='legacy8'?'cargo_rect8':'cargo_'+shapeId;await expect(img).toHaveAttribute('src',new RegExp(expected+'@2x'));
  expect((await state(page)).cargo[0].cells).toBe(E.Cargo.area(shapeId));await tap(page,'#back');
 }
});

test('two real pages cannot pay for the same next ship upgrade twice',async({page,context})=>{
 await boot(page);await load(page,rich());const p2=await context.newPage();await boot(p2);for(const p of[page,p2])await p.evaluate(async()=>{window.writer=await SalvageStore.open(1)});const rev=await page.evaluate(()=>writer.revision);const results=await Promise.all([page,p2].map(p=>p.evaluate(rev=>writer.act({type:'upgradeShip',kind:'fuel'},rev),rev)));expect(results.filter(r=>r.ok)).toHaveLength(1);const s=results.find(r=>r.ok).state;expect(s.money).toBe(27049-300);expect(s.fleet.fuelLevels.starter).toBe(1);expect(s.ledger.filter(x=>x.category==='shipUpgrade')).toHaveLength(1);for(const p of[page,p2])await p.evaluate(()=>writer.close());await p2.close();
});

test('an aborted upgrade write never charges or shows a fictional cap increase',async({page})=>{
 await boot(page);await load(page,rich());await tap(page,'[data-tab=fleet]');const before=await state(page);await page.evaluate(()=>{window.savedTx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=savedTx.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>{try{tx.abort()}catch{}});return tx;};});await confirm(page,'[data-shipupgrade=hull]');await expect(page.locator('#storage-warning')).toBeVisible();expect(await state(page)).toEqual(before);await expect(page.locator('#resources')).toContainText('100/100');await page.evaluate(()=>IDBDatabase.prototype.transaction=savedTx);await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(before);
});
