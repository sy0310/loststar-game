import {expect,test,type Page} from '@playwright/test';
import {firstPlanetFixture} from '../../scripts/firstplanet_fixtures';
import {advanceFusion} from '../../src/fusion/domain';
import type {FusionSave} from '../../src/fusion/contracts';
const epoch=1800000000000,database='loststar.fusion.firstplanet.v037',focus='#fusion-exhibit-focus';
test.use({hasTouch:true,isMobile:true});
async function archive(page:Page){return page.evaluate(name=>new Promise<FusionSave>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,g=d.transaction('archive').objectStore('archive').get('current');g.onsuccess=()=>{d.close();resolve(g.result);};g.onerror=()=>reject(g.error);};}),database);}
async function seed(page:Page,ability:0|1|2=0){
 // Use the current running test clock. A future-held archive would disable
 // ordinary settlement and make the no-charge check vacuous.
 const fixture=firstPlanetFixture(await page.evaluate(()=>Date.now()),2,'stabilized',{receiptAbility:0,tapeAbility:ability});
 await page.goto('/tests/fixtures/fusion-store.html');await page.evaluate(({name,state})=>new Promise<void>((resolve,reject)=>{localStorage.setItem('loststar.ui.firstplanet.v037.intro',String(state.journey!.seed));const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite');t.objectStore('archive').put(state,'current');t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);};}),{name:database,state:fixture.state});
 await page.goto('/?sample=first-planet');await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');await page.waitForLoadState('networkidle');await page.clock.runFor(150);await page.locator('[data-tab="collection"]').tap();
}
async function detail(page:Page,id:string){await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();await expect(page.locator(focus)).toHaveAttribute('data-ready','true');await expect(page.locator('#fusion-try')).toBeEnabled();}
async function data(page:Page){return page.locator(focus).evaluate(c=>({...c.dataset}));}
function noNewRightsOrCharges(before:FusionSave,after:FusionSave){
 const automatic=advanceFusion(before,after.game.lastAt);
 // Only the store writer's revision is outside the game model. Compare all
 // business fields, including pending cargo and future entitlements.
 const normalized=(state:FusionSave)=>JSON.parse(JSON.stringify(state,(key,value)=>key==='storageRevision'?undefined:value));
 expect(normalized(after)).toEqual(normalized(automatic));
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));});

test('胶带0/Ⅰ/Ⅱ复用一个出口与主轴，连续抽回且陈旧连点不能重置机构',async({page})=>{
 for(const level of [0,1,2] as const){
  await seed(page,level);await detail(page,'tape');const button=page.locator('#fusion-try'),before=await archive(page),idle=await data(page);
  expect(idle.mechanism).toBe('tape');expect(Number(idle.tapeLength)).toBe(0);
  await button.tap();await page.clock.runFor(550);const feed=await data(page);expect(Number(feed.tapeLength)).toBeGreaterThan(0);expect(Number(feed.tapeRollAngle)).toBeGreaterThan(0);expect(feed.toolContact).toBe('true');await expect(button).toBeDisabled();
  const started=feed.experimentStartedAt,replay=feed.replay;
  await button.evaluate((b:HTMLButtonElement)=>{b.disabled=false;b.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await page.clock.runFor(150);const uninterrupted=await data(page);expect(uninterrupted.experimentStartedAt).toBe(started);expect(uninterrupted.replay).toBe(replay);
  await page.clock.runFor(2100);const end=await data(page);expect(Number(end.tapeLength)).toBe(0);expect(Number(end.tapeRollAngle)).toBe(0);expect(end.mechanismPhase).toBe('idle');await expect(button).toBeEnabled();
  await button.tap();await page.clock.runFor(2800);expect(Number((await data(page)).replay)).toBe(Number(replay)+1);noNewRightsOrCharges(before,await archive(page));
 }
});

test('铃铛接触后同轴压下，触底才震荡和响铃，松手回弹不重结算',async({page})=>{
 await seed(page);await detail(page,'bell');
 await page.evaluate(()=>{(window as unknown as {bellCues:number[]}).bellCues=[];window.addEventListener('loststar:sound-cue',e=>{if((e as CustomEvent).detail.cue==='curio-bell')(window as unknown as {bellCues:number[]}).bellCues.push(performance.now());});});
 const cues=()=>page.evaluate(()=>(window as unknown as {bellCues:number[]}).bellCues),before=await archive(page),button=page.locator('#fusion-try');
 await button.tap();await page.clock.runFor(180);let frame=await data(page);expect(frame.toolContact).toBe('false');expect(Number(frame.bellStroke)).toBe(0);expect(frame.bellTriggered).toBe('false');expect(await cues()).toHaveLength(0);
 await page.clock.runFor(320);frame=await data(page);expect(frame.toolContact).toBe('true');expect(Number(frame.bellStroke)).toBeGreaterThan(0);expect(frame.bellTriggered).toBe('false');expect(await cues()).toHaveLength(0);
 await page.clock.runFor(200);frame=await data(page);expect(frame.toolContact).toBe('true');expect(frame.bellTriggered).toBe('true');const peak=Number(frame.bellStroke);expect(peak).toBeGreaterThan(1);expect(await cues()).toHaveLength(1);
 await page.clock.runFor(250);frame=await data(page);expect(frame.bellTriggered).toBe('false');expect(Number(frame.bellStroke)).toBeLessThan(peak);expect(frame.toolContact).toBe('true');
 await page.clock.runFor(500);frame=await data(page);expect(Number(frame.bellStroke)).toBe(0);expect(frame.toolContact).toBe('false');expect(await cues()).toHaveLength(1);
 await page.clock.runFor(1350);await expect(button).toBeEnabled();await button.tap();await page.clock.runFor(710);expect(await cues()).toHaveLength(2);await page.clock.runFor(2100);noNewRightsOrCharges(before,await archive(page));
});

test('后台跨过铃的触底窗口不会在返回时补响或重新播放压杆',async({page})=>{
 await seed(page);await detail(page,'bell');await page.evaluate(()=>{(window as unknown as {bellCues:number}).bellCues=0;window.addEventListener('loststar:sound-cue',e=>{if((e as CustomEvent).detail.cue==='curio-bell')(window as unknown as {bellCues:number}).bellCues++;});});
 await page.locator('#fusion-try').tap();await page.clock.runFor(150);const started=(await data(page)).experimentStartedAt;
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.fastForward(2100);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(150);
 const frame=await data(page);expect(frame.experimentStartedAt).toBe(started);expect(frame.bellTriggered).toBe('false');expect(Number(frame.bellStroke)).toBe(0);expect(await page.evaluate(()=>(window as unknown as {bellCues:number}).bellCues)).toBe(0);
 await page.clock.runFor(500);await page.locator('#fusion-try').tap();await page.clock.runFor(600);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.fastForward(110);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(30);
 // Returning during the remaining 0.65–0.80 hold window is still not a new strike.
 expect((await data(page)).bellTriggered).toBe('true');expect(await page.evaluate(()=>(window as unknown as {bellCues:number}).bellCues)).toBe(0);
});

for(const [id,asset]of [['tape','tape-frame-back'],['bell','bell-shell']] as const)test(`${id}关键独立部件首次失败后可显式重试，不显示旧碎片、不重买研究`,async({page})=>{
 await page.route(`**/${asset}.webp*`,route=>route.request().resourceType()==='image'?route.abort():route.continue());await seed(page,2);
 await expect(page.locator('#fusion-museum-retry')).toBeVisible();await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();await page.clock.runFor(150);await expect(page.locator('#fusion-try')).toBeDisabled();await expect(page.locator('#fusion-exhibit-interaction')).toBeHidden();
 const before=await archive(page);await page.unroute(`**/${asset}.webp*`);await page.locator('#fusion-treatment-retry').tap();await expect(page.locator(focus)).toHaveAttribute('data-ready','true');await expect(page.locator('#fusion-try')).toBeEnabled();await page.locator('#fusion-try').tap();await page.clock.runFor(2800);noNewRightsOrCharges(before,await archive(page));
});
