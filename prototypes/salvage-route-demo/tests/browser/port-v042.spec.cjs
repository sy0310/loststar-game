'use strict';
const{test,expect}=require('@playwright/test'),E=require('../../src/engine.js'),I=require('../../src/cargo-identity.js');
const state=p=>p.evaluate(()=>__SALVAGE__.state());
async function tap(p,s){await p.waitForFunction(()=>__SALVAGE__.ready());await p.locator(s).tap();await p.waitForFunction(()=>__SALVAGE__.ready());}
async function boot(p){await p.goto('');await p.waitForFunction(()=>window.__SALVAGE__);if(await p.locator('#modal-buttons [data-act=close]').isVisible())await tap(p,'#modal-buttons [data-act=close]');}
async function load(p,s){await tap(p,'[data-act=settings]');await tap(p,'[data-act=import]');await p.locator('#import-file').setInputFiles({name:'explicit042-QA.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await tap(p,'[data-act=confirm]');await expect.poll(()=>state(p)).toEqual(E.restore(s));}
function goods(pairs){const s=E.create(42);s.money=27049;s.cargo=pairs.map((x,i)=>({uid:i+1,name:'QA类别'+x.itemId,itemId:x.itemId,shapeId:x.shapeId,cells:E.Cargo.area(x.shapeId),shapeVersion:1,value:40,acquiredRun:0}));s.nextUid=s.cargo.length+1;s.cargoGrid.placements=E.Cargo.solve(s.cargo);return s;}

test('affordable upgrades are bright, unavailable one is distinct, cost and confirmation remain real',async({page})=>{
 await boot(page);let s=E.create(42);s.money=454;await load(page,s);await tap(page,'[data-tab=fleet]');
 const fuel=page.locator('[data-shipupgrade=fuel]'),hull=page.locator('[data-shipupgrade=hull]'),cargo=page.locator('[data-act=upgradeCargo]');
 await expect(fuel).toBeEnabled();await expect(hull).toBeEnabled();await expect(cargo).toBeDisabled();
 const colors=await page.locator('.ship-upgrade>button').evaluateAll(es=>es.map(b=>{const s=getComputedStyle(b);return{bg:s.backgroundColor,fg:s.color,opacity:+s.opacity};}));
 expect(colors[0].bg).toBe('rgb(244, 199, 133)');expect(colors[1].bg).toBe(colors[0].bg);expect(colors[2].bg).not.toBe(colors[0].bg);expect(colors[0].opacity).toBe(1);expect(colors[2].opacity).toBeLessThan(.6);
 await tap(page,'[data-shipupgrade=fuel]');await expect(page.locator('#modal-body')).toContainText('300');expect(await state(page)).toEqual(s);await tap(page,'#modal-close');expect(await state(page)).toEqual(s);
 await tap(page,'[data-shipupgrade=fuel]');await tap(page,'[data-act=confirm]');s=await state(page);expect(s.money).toBe(154);expect(s.fleet.fuelLevels.starter).toBe(1);await expect(hull).toBeDisabled();await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(s);
});

test('current ship and three upgrades stay in the first mobile screen; catalog is secondary even with large text',async({page})=>{
 await boot(page);await tap(page,'[data-tab=fleet]');await expect(page.locator('.ship-card')).toHaveCount(0);await expect(page.locator('.current-ship')).toHaveCount(1);
 for(const large of[false,true]){if(large)await page.evaluate(()=>{document.documentElement.style.fontSize='18px';const s=document.createElement('style');s.textContent='.safe{height:44px!important}';document.head.append(s)});const boxes=await page.locator('.ship-upgrade>button').evaluateAll(es=>es.map(x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom}}));for(const r of boxes){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.w).toBeGreaterThanOrEqual(44);expect(r.h).toBeGreaterThanOrEqual(44);expect(r.b).toBeLessThanOrEqual(page.viewportSize().height);}expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 await expect(page.locator('[data-act=shipyard]')).toBeVisible();
});

test('catalog opening is read-only, purchase/equip use real transactions, one back returns to current upgrades',async({page})=>{
 await boot(page);const s=goods([]);await load(page,s);await tap(page,'[data-tab=fleet]');await tap(page,'[data-act=shipyard]');await expect(page.locator('.ship-card')).toHaveCount(3);await expect(page.locator('#back')).toHaveAttribute('aria-label','返回当前飞船');expect(await state(page)).toEqual(s);
 await tap(page,'[data-buyship=cargo]');await tap(page,'#modal-close');expect(await state(page)).toEqual(s);await tap(page,'[data-buyship=cargo]');await tap(page,'[data-act=confirm]');await expect(page.locator('body')).toHaveAttribute('data-screen','shipyard');await tap(page,'[data-equip=cargo]');const saved=await state(page);expect(saved.money).toBe(s.money-1800);await tap(page,'#back');await expect(page.locator('.equipped-summary')).toContainText('中型货船');await expect(page.locator('.ship-card')).toHaveCount(0);await expect(page.locator('[data-shipupgrade=fuel]')).toBeVisible();await tap(page,'#back');await expect(page.locator('.port-home')).toBeVisible();await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect(await state(page)).toEqual(saved);
});

test('five categories with the same line2 mask have distinct complete images and unchanged saved identities',async({page})=>{
 await boot(page);const s=goods(['metal_crate','energy_battery','nav_chip','broken_engine','medkit'].map(itemId=>({itemId,shapeId:'line2'})));await load(page,s);await tap(page,'[data-tab=cargo]');const images=page.locator('[data-cargo-object] img');await expect(images).toHaveCount(5);await expect.poll(()=>images.evaluateAll(es=>es.every(x=>x.complete&&x.naturalWidth>0))).toBe(true);
 const rows=await images.evaluateAll(es=>es.map(x=>({src:x.getAttribute('src'),identity:x.dataset.identity,mask:x.dataset.footprint,w:x.naturalWidth,h:x.naturalHeight})));expect(new Set(rows.map(x=>x.src)).size).toBe(5);for(const x of rows){expect(x.mask).toBe('line2');expect(x.w).toBe(96);expect(x.h).toBe(48);}expect(await state(page)).toEqual(s);await expect(page.locator('[data-cargo-save]')).toBeDisabled();await tap(page,'#back');await page.reload();await page.waitForFunction(()=>window.__SALVAGE__);expect((await state(page)).cargo).toEqual(s.cargo);
});

test('all fourteen actual multi-cell content combinations load their registered whole body through the game',async({page})=>{
 await boot(page);for(const pair of[...I.pairs,...I.retained]){const s=goods([pair]);await load(page,s);await tap(page,'[data-tab=cargo]');const img=page.locator('[data-cargo-object="1"] img');await expect(img).toHaveAttribute('src',I.resolve(pair).src);await expect.poll(()=>img.evaluate(x=>x.complete&&x.naturalWidth>0)).toBe(true);const shape=await img.getAttribute('data-footprint');expect(shape).toBe(pair.shapeId);expect(await state(page)).toEqual(s);await tap(page,'#back');}
});
