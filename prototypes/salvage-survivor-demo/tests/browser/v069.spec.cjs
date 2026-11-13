const {test,expect}=require('@playwright/test');
const {boot,start,state,stored}=require('./helpers.cjs');
async function upgrade(page){await boot(page);await start(page);await page.evaluate(()=>SurvivorQA.level());await page.waitForFunction(()=>!SurvivorDemo.saving());await expect(page.locator('#upgrade')).toBeVisible();}
test('v069 three touch rerolls save choices, preserve inventory and survive close/reload',async({page})=>{
 await upgrade(page);await expect(page.locator('#rerollBtn')).toContainText('3');
 const initial=await state(page);
 for(let left=2;left>=0;left--){const old=(await state(page)).presented;await page.locator('#rerollBtn').tap();await page.waitForFunction(()=>!SurvivorDemo.saving());await expect.poll(async()=>(await state(page)).rerollsRemaining).toBe(left);expect((await state(page)).presented).not.toEqual(old);await page.waitForTimeout(560);}
 await expect(page.locator('#rerollBtn')).toBeDisabled();const saved=await stored(page);expect(saved.active.snapshot.game.active).toEqual(initial.active);expect(saved.profile.credits).toBe(0);
 await page.reload();await page.waitForFunction(()=>SurvivorDemo.ready());await page.locator('#continueBtn').tap();await expect(page.locator('#rerollBtn')).toBeDisabled();expect((await state(page)).presented).toEqual(saved.active.snapshot.game.presented);expect((await state(page)).rerollsRemaining).toBe(0);
 await page.locator('[data-pick="0"]').tap();await page.waitForFunction(()=>!SurvivorDemo.saving());expect((await state(page)).mode).toBe('play');
});
test('v069 aborting reroll checkpoint restores the displayed choices, seed and count',async({page})=>{
 await upgrade(page);const before=await stored(page);
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){IDBObjectStore.prototype.put=put;this.transaction.abort();throw new DOMException('QA reroll abort','QuotaExceededError');};});
 await page.locator('#rerollBtn').tap();await page.waitForFunction(()=>!SurvivorDemo.saving());expect((await state(page)).presented).toEqual(before.active.snapshot.game.presented);expect((await state(page)).rerollsRemaining).toBe(3);expect((await stored(page)).active.snapshot).toEqual(before.active.snapshot);
 await expect(page.locator('#saveBar')).toHaveClass(/error/);
});
test('v069 repeated touch consumes one reroll and a second tab cannot silently overwrite it',async({page,context})=>{
 await upgrade(page);await page.evaluate(()=>{document.getElementById('rerollBtn').click();document.getElementById('rerollBtn').click();});await page.waitForFunction(()=>!SurvivorDemo.saving());expect((await state(page)).rerollsRemaining).toBe(2);
 const other=await context.newPage();await boot(other);await other.locator('#continueBtn').tap();await other.waitForFunction(()=>!SurvivorDemo.saving());await page.waitForTimeout(600);
 await page.evaluate(()=>document.getElementById('rerollBtn').click());await page.waitForFunction(()=>!SurvivorDemo.saving());expect((await stored(page)).active.snapshot.game.rerollsRemaining).toBe(2);await other.close();
});
test('v069 elite result cannot reroll its saved grants or evolution chance',async({page})=>{
 await boot(page);await start(page);await page.evaluate(async()=>{SurvivorQA.reward(false);await SurvivorQA.save();await SurvivorQA.settled();});const before=await stored(page);await expect(page.locator('#rerollBtn')).toBeDisabled();await expect(page.locator('#rerollBtn')).toContainText('已抽定');await page.reload();await page.waitForFunction(()=>SurvivorDemo.ready());await page.locator('#continueBtn').tap();expect((await state(page)).upgradeSource).toEqual(before.active.snapshot.game.upgradeSource);
});
test('v069 UI states six slots and a wider equipment pool, with a genuinely small starting XP radius',async({page})=>{
 await upgrade(page);await expect(page.locator('#upgradeBuild')).toContainText('9种');await expect(page.locator('#upgradeBuild')).toContainText('8种');
 const result=await page.evaluate(()=>{const Q=SurvivorQA,g=Q.state();g.mode='play';g.spawnTime=9999;g.enemy=[];g.pickups=[{x:g.p.x+80,y:g.p.y,t:20,type:'xp',value:1},{x:g.p.x+30,y:g.p.y,t:20,type:'xp',value:1}];Q.step(.05);return g.pickups.map(x=>!!x.magnetized);});expect(result).toEqual([false,true]);
});
