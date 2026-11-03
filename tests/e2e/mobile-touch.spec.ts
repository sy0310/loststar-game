import {test,expect} from '@playwright/test';
import {newGame,advance,tuning} from '../../src/game/engine';
const KEY='loststar.save.v1';
async function seeded(page:import('@playwright/test').Page){
  const s=advance(newGame(1800000000000),1800000745000);s.lastAt=Date.now();s.seenDiscoveries=[...s.collection];
  await page.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{key:KEY,state:s});
  await page.goto('/?start=base&review=1');
}
async function tap(page:import('@playwright/test').Page,locator:import('@playwright/test').Locator){await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();expect(box).not.toBeNull();await page.touchscreen.tap(box!.x+box!.width/2,box!.y+box!.height/2);}
test('触控：六件奇物与居民有按钮旁的独立可见演出，重播不发奖',async({page})=>{
  await seeded(page);await tap(page,page.getByRole('button',{name:'图鉴',exact:true}));
  const cases=[['receipt','未购买的退货收据','artifact'],['tape','自动道歉的胶带','artifact'],['nested','无限套娃包裹','artifact'],['stamp','只会盖昨天的邮戳','artifact'],['cosmic-parcel','收件人：宇宙','artifact'],['bell','无人签收铃','artifact'],['mouse','拆封鼠','creature']];
  const kinds={artifact:'奇物',creature:'居民'};
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);
  for(const [id,name,kind] of cases){
    await tap(page,page.getByRole('button',{name:`${name}，${kinds[kind as keyof typeof kinds]}`,exact:true}));
    const button=page.locator(`[data-interact="${id}"]`);await expect(button).toBeInViewport();
    await tap(page,button);const feedback=page.locator('#interaction-feedback');
    await expect(feedback).toBeInViewport();await expect(feedback).toHaveAttribute('data-item',id);await expect(feedback).toHaveAttribute('data-last-input','touch');
    await expect(feedback.locator('canvas')).toBeInViewport();await expect(feedback.locator('#interaction')).toBeInViewport();
    const animation=await feedback.locator('canvas').screenshot();await page.waitForTimeout(220);expect(await feedback.locator('canvas').screenshot()).not.toEqual(animation);
    const first=await feedback.getAttribute('data-replay');await tap(page,button);await expect(feedback).not.toHaveAttribute('data-replay',first!);
    await tap(page,page.getByRole('button',{name:'收起互动反馈'}));await expect(feedback).toBeHidden();
    await tap(page,page.getByRole('button',{name:'关闭详情'}));
  }
  const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);expect(after.collection).toEqual(before.collection);expect(after.resources-before.resources).toBe((after.cycles-before.cycles)*tuning(before).recycler+(after.surveyCount-before.surveyCount)*6);expect(after.upgrades).toEqual(before.upgrades);
  await page.reload();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).collection,KEY)).toEqual(before.collection);
});
test('雷达：减弱动态下仍有 Canvas 扫描，切页返回恢复，无未知节点',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/?start=base&review=1');
  await tap(page,page.getByRole('button',{name:'星图',exact:true}));const canvas=page.locator('#radar-canvas');await expect(canvas).toBeVisible();
  const first=await canvas.screenshot();await page.waitForTimeout(450);expect(await canvas.screenshot()).not.toEqual(first);
  await tap(page,page.getByRole('button',{name:'基地',exact:true}));await tap(page,page.getByRole('button',{name:'星图',exact:true}));
  const frame=Number(await canvas.getAttribute('data-frame'));await expect.poll(async()=>Number(await canvas.getAttribute('data-frame'))).toBeGreaterThan(frame);
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗|固定问号/);
});

test('小屏150%文字时互动与关闭按钮仍在可触区域',async({page})=>{
  await page.setViewportSize({width:360,height:640});await seeded(page);await page.addStyleTag({content:'html{font-size:150%!important}'});
  await tap(page,page.getByRole('button',{name:'图鉴',exact:true}));await tap(page,page.getByRole('button',{name:'无人签收铃，奇物',exact:true}));
  await tap(page,page.locator('[data-interact="bell"]'));await expect(page.locator('#interaction-feedback')).toBeInViewport();await expect(page.locator('#interaction')).toBeInViewport();
  const close=page.getByRole('button',{name:'收起互动反馈'});await expect(close).toBeInViewport();const r=await close.boundingBox();expect(r!.width).toBeGreaterThanOrEqual(44);expect(r!.height).toBeGreaterThanOrEqual(44);
  await tap(page,close);await tap(page,page.getByRole('button',{name:'关闭详情'}));await expect(page.locator('dialog')).toBeHidden();
});
