import {openACurio, openACollection, openAFlow} from './a-navigation';
import {expect,test,type Page} from '@playwright/test';
import {firstPlanetFixture} from '../../scripts/firstplanet_fixtures';
import {createFusion,advanceFusion} from '../../src/fusion/domain';
import type {FusionSave} from '../../src/fusion/contracts';
const epoch=1800000000000,database='loststar.fusion.firstplanet.v037';
const ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'];
test.use({hasTouch:true,isMobile:true});
async function install(page:Page,state:FusionSave){
 await page.goto('/tests/fixtures/fusion-store.html');
 await page.evaluate(({database,state})=>new Promise<void>((resolve,reject)=>{
  localStorage.setItem('loststar.ui.firstplanet.v037.intro',String(state.journey!.seed));
  const r=indexedDB.open(database,1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite');t.objectStore('archive').put(state,'current');t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);};
 }),{database,state});
 await page.goto('/?sample=first-planet');await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');
 await page.waitForLoadState('networkidle');await page.clock.runFor(300);
}
async function read(page:Page){return page.evaluate(database=>new Promise<FusionSave>((resolve,reject)=>{const r=indexedDB.open(database,1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,g=d.transaction('archive').objectStore('archive').get('current');g.onsuccess=()=>{d.close();resolve(g.result);};};}),database);}
async function clock(page:Page){await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));}

for(const condition of ['found','clean','stabilized'] as const)test(`${condition}实际收藏卡/基地/展柜/工作台共用持久整图，刷新和后台恢复不回退`,async({page})=>{
 test.setTimeout(60000);await clock(page);
 const fixture=firstPlanetFixture(epoch+1000,2,condition,{receiptAbility:0,tapeAbility:0});await install(page,fixture.state);
 for(const tab of ['base','collection']){
  await page.locator(`#fusion-app > .fu-nav [data-tab="${tab}"]`).tap();
  await expect.poll(()=>page.locator('#museum-canvas').evaluate(c=>JSON.parse((c as HTMLCanvasElement).dataset.curioStates??'{}'))).toEqual(Object.fromEntries(ids.map(id=>[id,`${id}-${condition}`])));
 }
 await openACollection(page,'tap');
 for(const id of ids){
  const card=page.locator(`#fusion-collection-list [data-detail="${id}"]`);
  await expect(card.locator('img')).toHaveAttribute('src',new RegExp(`${id}-${condition}.*\\.webp`));
  await expect(card.locator('img')).toHaveAttribute('data-curio-condition',condition);
  await card.tap();const canvas=page.locator(id==='receipt'?'#fusion-paper-focus':'#fusion-exhibit-focus');
  await expect(canvas).toHaveAttribute('data-state-image',`${id}-${condition}.webp`);
  await expect.poll(()=>canvas.evaluate((c,id)=>JSON.parse((c as HTMLCanvasElement).dataset.curioStates??'{}')[id],id)).toBe(`${id}-${condition}`);
  await page.locator('#fusion-close').tap();
 }
 const before=await read(page);await page.reload();await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');
 await page.locator('#fusion-app > .fu-nav [data-tab="base"]').tap();await page.clock.runFor(300);
 const canvas=page.locator('#museum-canvas');await expect(canvas).toHaveAttribute('data-ready','true');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const frame=await canvas.getAttribute('data-frame');await page.clock.runFor(500);expect(await canvas.getAttribute('data-frame')).toBe(frame);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(300);
 await expect.poll(()=>canvas.evaluate(c=>JSON.parse((c as HTMLCanvasElement).dataset.curioStates??'{}'))).toEqual(Object.fromEntries(ids.map(id=>[id,`${id}-${condition}`])));
 const after=await read(page);expect(after.game.growth).toEqual(before.game.growth);expect(after.progression.abilities).toEqual(before.progression.abilities);expect(after.receipt.condition).toBe(condition);expect(ids.slice(1).map(id=>after.curios[id].condition)).toEqual(ids.slice(1).map(()=>condition));
 expect(before.game.resources+after.game.station.grossIncome-before.game.station.grossIncome-(after.game.station.repairSpent-before.game.station.repairSpent)-after.game.resources).toBe(0);
});

test('真实新发现与离线归航都读持久A图，领取及预览不补造B或C',async({page})=>{
 await clock(page);const fresh=createFusion(epoch+1000,null,{journey:true,seed:17441});await install(page,fresh);
 await page.clock.fastForward(12000);await page.clock.runFor(400);
 await openAFlow(page,'tap');
 const found=page.locator('#fusion-flow-content .fu-flow-find img[data-curio-id]').first();
 await expect(found).toBeVisible();const id=await found.getAttribute('data-curio-id');expect(ids).toContain(id);
 await expect(found).toHaveAttribute('src',new RegExp(`${id}-found.*\\.webp`));
 const now=await page.evaluate(()=>Date.now()),offline=advanceFusion(createFusion(now-1200000,null,{journey:true,seed:17442}),now,true);
 expect(offline.game.pendingReturn!.discoveries.length).toBeGreaterThan(0);await install(page,offline);
 await openAFlow(page,'tap');
 for(const id of offline.game.pendingReturn!.discoveries.filter(id=>ids.includes(id)))await expect(page.locator(`#fusion-flow-content .fu-flow-cargo img[data-curio-id="${id}"]`)).toHaveAttribute('src',new RegExp(`${id}-found.*\\.webp`));
 await page.locator('#fusion-claim').tap();const after=await read(page);expect(after.receipt.condition).toBe('found');expect(Object.values(after.curios).every(x=>x.condition==='found')).toBe(true);
});

test('只读放大及后台隐藏停止近景绘制，返回恢复；已认可铃按动和延后短句保留',async({page})=>{
 await clock(page);await install(page,firstPlanetFixture(epoch+1000,0,'stabilized',{receiptAbility:0,tapeAbility:0}).state);
 await page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();await openACurio(page, 'bell', 'tap');const canvas=page.locator('#fusion-exhibit-focus');await expect(canvas).toHaveAttribute('data-ready','true');
 await page.locator('[data-image-preview-condition="found"]').tap();await page.clock.runFor(50);const f=await canvas.getAttribute('data-frame');await page.clock.runFor(500);expect(await canvas.getAttribute('data-frame')).toBe(f);
 await page.locator('#fusion-state-preview-close').tap();await page.clock.runFor(200);expect(Number(await canvas.getAttribute('data-frame'))).toBeGreaterThan(Number(f));
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await canvas.getAttribute('data-frame');await page.clock.runFor(500);expect(await canvas.getAttribute('data-frame')).toBe(hidden);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(100);
 await page.locator('#fusion-try').tap();await expect(page.locator('#fusion-curio-response')).toHaveText('咔哒正在试验…');await page.clock.runFor(750);await expect(page.locator('#fusion-curio-response')).toHaveText('响了。还是没人签收。');await expect(canvas).toHaveAttribute('data-bell-triggered','true');
});

test('邮戳试验实际把票面退一天，套娃延后揭示原箱；重播不扣费或增添记录',async({page})=>{
 await clock(page);await install(page,firstPlanetFixture(epoch+1000,0,'stabilized',{receiptAbility:0,tapeAbility:0}).state);
 await page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();
 const before=await read(page);
 for(const id of ['stamp','nested']){
  await openACurio(page, id, 'tap');const canvas=page.locator('#fusion-exhibit-focus');await expect(canvas).toHaveAttribute('data-ready','true');
  for(let replay=0;replay<2;replay++){
   await page.locator('#fusion-try').tap();await page.clock.runFor(400);const today=await canvas.getAttribute('data-performance-date');await page.clock.runFor(1050);
   if(id==='stamp')expect(await canvas.getAttribute('data-performance-date')).not.toBe(today);
   await expect(page.locator('#fusion-curio-response')).toHaveText(id==='stamp'?'今天的事，昨天再办。':'拆到最后，还是第一层。');
   await page.clock.runFor(1900);await expect(page.locator('#fusion-curio-response')).toBeHidden();
  }
  await page.locator('#fusion-close').tap();
 }
 const after=await read(page);expect(after.game.collection).toEqual(before.game.collection);expect(after.records).toEqual(before.records);expect(after.curios).toEqual(before.curios);
 expect(before.game.resources+after.game.station.grossIncome-before.game.station.grossIncome-(after.game.station.repairSpent-before.game.station.repairSpent)-after.game.resources).toBe(0);
});

test('收据两种柜级的反转短句与动画同屏可读，不落到竖屏下方',async({page})=>{
 await clock(page);
 for(const level of [0,3]){
  await install(page,firstPlanetFixture(epoch+1000,level,'stabilized',{receiptAbility:0,tapeAbility:0}).state);
  await page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();await openACurio(page, 'receipt', 'tap');await expect(page.locator('#fusion-paper-focus')).toHaveAttribute('data-ready','true');
  await page.locator('#fusion-try').tap();await page.clock.runFor(1500);
  const response=page.locator('#fusion-curio-response');await expect(response).toHaveText('订单没下，退货先到。');await expect(response).toBeInViewport({ratio:1});
  const box=await response.boundingBox(),view=await page.evaluate(()=>innerHeight);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(view);
  const paper=await page.locator('#fusion-paper-focus').boundingBox();expect(paper!.y+paper!.height).toBeLessThanOrEqual(box!.y);
  await page.clock.runFor(1500);
 }
});
