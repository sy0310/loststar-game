const {test,expect}=require('@playwright/test');
const {boot,start,settle,stored,state}=require('./helpers.cjs');
async function dock(page){await boot(page);await start(page);await settle(page,27049);await page.locator('#resultDockBtn').tap();}
test('v068 launch selection is six image cards with one selected portrait and true reservation',async({page})=>{
 await dock(page);
 await expect(page.locator('[data-launch-weapon]')).toHaveCount(6);
 for(const id of ['drone','arc','missile','blade','prism','gravity']){
  const card=page.locator(`[data-launch-weapon="${id}"]`);await card.scrollIntoViewIfNeeded();await card.tap();
  await expect(card).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('img')).toHaveCount(1);
  expect(await card.locator('img').evaluate(x=>x.complete&&x.naturalWidth>0)).toBeTruthy();
  await expect(page.locator('#launchPortrait img')).toHaveCount(1);
 }
 await page.locator('[data-launch-weapon="prism"]').tap();
 await page.locator('#bookLaunchBtn').tap();await page.waitForFunction(()=>!SurvivorDemo.saving());
 expect((await stored(page)).profile.launchPlan.weapon).toBe('prism');expect((await stored(page)).profile.credits).toBe(26849);
 await page.reload();await page.waitForFunction(()=>SurvivorDemo.ready());
 await page.locator('#retryBtn').tap();await page.waitForFunction(()=>SurvivorDemo.state()?.mode==='play'&&!SurvivorDemo.saving());
 expect((await state(page)).active).toEqual({prism:1});expect((await stored(page)).profile.credits).toBe(26849);
});
test('v068 exact current upgrade fees preserve old paid levels and prevent duplicate purchasing',async({page})=>{
 await dock(page);
 await expect(page.locator('#dockHullBtn')).toContainText('400');
 await page.locator('#dockHullBtn').tap();await page.waitForFunction(()=>!SurvivorDemo.saving());
 expect((await stored(page)).profile.hull).toBe(1);expect((await stored(page)).profile.credits).toBe(26649);
 await expect(page.locator('[data-engineering="salvage"]')).toContainText('550');
 await page.waitForTimeout(560);await page.locator('[data-engineering="salvage"]').tap();await page.waitForFunction(()=>!SurvivorDemo.saving());
 expect((await stored(page)).profile.credits).toBe(26099);await page.reload();await page.waitForFunction(()=>SurvivorDemo.ready());
 const p=(await stored(page)).profile;expect(p.hull).toBe(1);expect(p.engineering.salvage).toBe(1);expect(p.credits).toBe(26099);
});
