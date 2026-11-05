import {expect,test,type Page} from '@playwright/test';
import {firstPlanetFixture} from '../../scripts/firstplanet_fixtures';
import {renewalPagesFixture} from '../../scripts/renewal_fixtures';
import type {FusionSave} from '../../src/fusion/contracts';
const epoch=1800000000000;
const database='loststar.fusion.firstplanet.v037';
test.use({hasTouch:true,isMobile:true});
async function read(page:Page){return page.evaluate(name=>new Promise<FusionSave>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,g=d.transaction('archive').objectStore('archive').get('current');g.onsuccess=()=>{d.close();resolve(g.result);};g.onerror=()=>{d.close();reject(g.error);};};}),database);}
async function seed(page:Page,state:FusionSave){
 await page.goto('/tests/fixtures/fusion-store.html');
 await page.evaluate(({name,state})=>new Promise<void>((resolve,reject)=>{localStorage.setItem('loststar.ui.firstplanet.v037.intro',String(state.journey!.seed));localStorage.setItem('loststar.save.v1','exact-unmodified-old-source');const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite'),s=t.objectStore('archive');s.put(state,'current');s.put({kind:'source-backup',raw:'exact-unmodified-old-source'},'backup/renewal');t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>{d.close();reject(t.error);};};}),{name:database,state});
}
async function open(page:Page){await page.goto('/?sample=first-planet');await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');await page.waitForLoadState('networkidle');await page.clock.runFor(300);}
function rights(s:FusionSave){return JSON.parse(JSON.stringify({balance:s.game.resources,collection:s.game.collection,upgrades:s.game.upgrades,growth:s.game.growth,curios:s.curios,receipt:s.receipt,abilities:s.progression.abilities,sorting:s.progression.sorting,journey:s.journey,records:s.records,projects:s.projects}));}

test('翻新继续v037当前27049付费档，浏览所有界面不重置不收费并保留来源',async({page})=>{
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));
 const fixture=firstPlanetFixture(epoch+60000,3,'stabilized');
 // Disclosed synthetic legacy balance; ownership comes from paid ordinary reducers.
 fixture.state.game.resources=27049;fixture.state.receipt.parts=27049;
 await seed(page,fixture.state);await open(page);const before=await read(page);
 expect(rights(before)).toEqual(rights(fixture.state));
 for(const tab of ['collection','base','explore'])await page.locator(`[data-tab="${tab}"]`).tap();
 for(const id of ['fusion-upgrades','fusion-map','fusion-settings','fusion-wallet']){await page.locator(`#${id}`).tap();await expect(page.locator('#fusion-drawer[open]')).toBeVisible();await page.locator('#fusion-close').tap();}
 await page.locator('[data-tab="base"]').tap();
 for(const kind of ['build','research','station']){await page.locator(`.fu-base-actions [data-drawer="${kind}"]`).tap();await page.locator('#fusion-close').tap();}
 await page.locator('[data-tab="collection"]').tap();
 for(const id of ['receipt','tape','nested','stamp','cosmic-parcel','bell']){await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();await expect(page.locator(id==='receipt'?'#fusion-paper-focus':'#fusion-exhibit-focus')).toHaveAttribute('data-ready','true');await page.locator('#fusion-close').tap();}
 expect(rights(await read(page))).toEqual(rights(before));
 await page.reload();await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');expect(rights(await read(page))).toEqual(rights(before));
 expect(await page.evaluate(()=>localStorage.getItem('loststar.save.v1'))).toBe('exact-unmodified-old-source');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星/);
});

test('设置声音与大字在同一游戏持久化，画面与主要操作保持可达',async({page})=>{
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));await open(page);
 const dismiss=page.locator('#fusion-dismiss-intro');if(await dismiss.isVisible())await dismiss.tap();
 await page.locator('#fusion-settings').tap();await page.locator('[data-preference="text"][data-value="large"]').tap();await expect(page.locator('html')).toHaveAttribute('data-text-size','large');
 await page.locator('[data-preference="sound"]').tap();await expect(page.locator('[data-preference="sound"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#fusion-close').tap();await page.reload();await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');await expect(page.locator('html')).toHaveAttribute('data-text-size','large');
 await page.locator('#fusion-settings').tap();await expect(page.locator('[data-preference="sound"]')).toHaveAttribute('aria-pressed','true');await page.locator('#fusion-close').tap();
 const bounds=await page.locator('#fusion-upgrades').boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(44);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(await page.evaluate(()=>innerHeight));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('减少动态仍有真实跨柜行走，后台暂停绘制并在返回后续接世界与旧权益',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));
 const fixture=firstPlanetFixture(epoch+1000,2,'stabilized');await seed(page,fixture.state);await open(page);
 await page.locator('[data-tab="base"]').tap();const canvas=page.locator('#museum-canvas');await expect(canvas).toHaveAttribute('data-ready','true');
 const position=await canvas.evaluate(c=>[c.dataset.robotX,c.dataset.robotY]);await page.clock.runFor(3100);
 expect(await canvas.evaluate(c=>[c.dataset.robotX,c.dataset.robotY])).not.toEqual(position);
 const before=await read(page);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 const frame=await canvas.getAttribute('data-frame');await page.clock.fastForward(61000);await page.clock.runFor(100);expect(await canvas.getAttribute('data-frame')).toBe(frame);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(700);expect(Number(await canvas.getAttribute('data-frame'))).toBeGreaterThan(Number(frame));
 const after=await read(page);expect(after.game.world.elapsedMs).toBeGreaterThan(before.game.world.elapsedMs+60000);
 expect(after.game.growth).toEqual(before.game.growth);expect(after.journey!.seed).toBe(before.journey!.seed);expect(after.curios).toEqual(before.curios);expect(after.progression.abilities).toEqual(before.progression.abilities);
});

test('实际归档回放复用翻新设施与单分拣机，隔离回放不重结算夜班或收费',async({page})=>{
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));
 const fixture=renewalPagesFixture(epoch+1000);await seed(page,fixture.state);await open(page);
 await page.locator('[data-tab="base"]').tap();await page.locator('.fu-base-actions [data-drawer="build"]').tap();await page.locator('#fusion-drawer [data-open-project="archive"]').tap();
 const before=await read(page);await page.locator('#fusion-replay-night').tap();const replay=page.locator('#fusion-archive-replay canvas');await expect(replay).toHaveAttribute('data-ready','true');await page.clock.runFor(1200);
 await expect(replay).toHaveAttribute('data-legacy-sorter-count','0');await expect(replay).toHaveAttribute('data-sorting-entity-id','parcel/old-sorting');await expect(replay).toHaveAttribute('data-robot-render-passes','1');
 const after=await read(page);expect(after.game.world.settledNights).toBe(before.game.world.settledNights);expect(after.game.station.repairSpent).toBe(before.game.station.repairSpent);expect(before.game.resources+after.game.station.grossIncome-before.game.station.grossIncome-after.game.resources).toBe(0);
});

test('单张柜体加载失败不冻结独立工作台，恢复网络后收藏室可显式重试',async({page})=>{
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));
 const fixture=firstPlanetFixture(epoch+60000,0,'stabilized',{receiptAbility:0,tapeAbility:0});await seed(page,fixture.state);
 await page.route('**/case-0-front.webp*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
 await open(page);await page.locator('[data-tab="collection"]').tap();await page.clock.runFor(300);
 await expect(page.locator('#museum-canvas')).toHaveAttribute('data-ready','error');await expect(page.locator('#fusion-museum-retry')).toBeVisible();
 await page.locator('#fusion-collection-list [data-detail="tape"]').tap();const canvas=page.locator('#fusion-exhibit-focus');await expect(canvas).toHaveAttribute('data-ready','true');
 const first=Number(await canvas.getAttribute('data-frame'));await page.clock.runFor(700);expect(Number(await canvas.getAttribute('data-frame'))).toBeGreaterThan(first);
 await page.locator('#fusion-try').tap();await expect(page.locator('#fusion-curio-response')).toBeVisible();expect((await read(page)).game.resources).toBe(fixture.state.game.resources);
 await page.locator('#fusion-close').tap();await page.unroute('**/case-0-front.webp*');await page.locator('#fusion-museum-retry').tap();await expect(page.locator('#museum-canvas')).toHaveAttribute('data-ready','true');await expect(page.locator('#fusion-museum-retry')).toBeHidden();
});

test('柜体升级播放真实安装帧，物件与费用维持原已购模型',async({page})=>{
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));const fixture=firstPlanetFixture(epoch+1000,0,'stabilized',{receiptAbility:0,tapeAbility:0});await seed(page,fixture.state);await open(page);
 await page.locator('[data-tab="base"]').tap();await page.locator('.fu-base-actions [data-drawer="build"]').tap();const button=page.locator('[data-growth="case-0"]');await button.locator('xpath=ancestor::details').evaluate(d=>(d as HTMLDetailsElement).open=true);await button.tap();
 const canvas=page.locator('#fusion-case-preview');await page.clock.runFor(120);await expect(canvas).toHaveAttribute('data-level','1');const first=await canvas.evaluate((c:HTMLCanvasElement)=>c.toDataURL());const frame=Number(await canvas.getAttribute('data-frame'));
 await page.clock.runFor(2000);expect(Number(await canvas.getAttribute('data-frame'))).toBeGreaterThan(frame+10);expect(await canvas.evaluate((c:HTMLCanvasElement)=>c.toDataURL())).not.toBe(first);const after=await read(page);expect(after.game.growth['case-0']).toBe(1);expect(fixture.state.game.resources+(after.game.station.grossIncome-fixture.state.game.station.grossIncome)-(after.game.station.repairSpent-fixture.state.game.station.repairSpent)-after.game.resources).toBe(160);
});

test('关键奇物材质失败有显式恢复入口，重连后六柜无需重新购买',async({page})=>{
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));const fixture=firstPlanetFixture(epoch+60000,1,'stabilized',{receiptAbility:0,tapeAbility:0});await seed(page,fixture.state);
 await page.route('**/tape-rig-fixed.webp*',route=>route.request().resourceType()==='image'?route.abort():route.continue());await open(page);await page.locator('[data-tab="base"]').tap();await page.clock.runFor(300);await expect(page.locator('#fusion-museum-retry')).toBeVisible();
 const before=await read(page);await page.unroute('**/tape-rig-fixed.webp*');await page.locator('#fusion-museum-retry').tap();await expect(page.locator('#fusion-museum-retry')).toBeHidden();expect(rights(await read(page))).toEqual(rights(before));
 await page.locator('[data-tab="collection"]').tap();await page.locator('#fusion-collection-list [data-detail="tape"]').tap();await expect(page.locator('#fusion-exhibit-focus')).toHaveAttribute('data-ready','true');
});
