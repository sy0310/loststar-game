import {test,expect} from '@playwright/test';
import {newGame,advance,tuning} from '../../src/game/engine';
const KEY='loststar.save.v1';
async function seeded(page:import('@playwright/test').Page,path='/?start=base&review=1'){
  const s=advance(newGame(1800000000000),1800000745000);s.lastAt=Date.now();s.seenDiscoveries=[...s.collection];
  await page.addInitScript(({key,state})=>{if(!localStorage.getItem(key)){state.lastAt=Date.now();localStorage.setItem(key,JSON.stringify(state));}},{key:KEY,state:s});
  await page.goto(path);
}
async function tap(page:import('@playwright/test').Page,locator:import('@playwright/test').Locator){await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();expect(box).not.toBeNull();await page.touchscreen.tap(box!.x+box!.width/2,box!.y+box!.height/2);}
test('触控：六件奇物与居民有按钮旁的独立可见演出，重播不发奖',async({page})=>{
  // Keep screenshots at two known animation instants on slow CI WebKit. Live recordings independently verify wall-clock animation.
  await page.clock.install({time:new Date('2026-11-03T06:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T06:00:10Z'));
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
    const animation=await feedback.locator('canvas').screenshot();await page.clock.runFor(350);expect(await feedback.locator('canvas').screenshot()).not.toEqual(animation);
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

test('夜间实验独立入口、默认关闭，装备/离线/刷新不写正式存档',async({page})=>{
  await page.clock.install({time:new Date('2026-11-03T03:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T03:00:10Z'));
  await seeded(page,'/night-lab.html');await expect(page.getByRole('button',{name:'开启夜间实验',exact:true})).toBeVisible();
  const formal=await page.evaluate(k=>localStorage.getItem(k),KEY);expect(await page.evaluate(()=>localStorage.getItem('loststar.prototype.guard.v1'))).toBeNull();
  await page.locator('#guard-slot-0').selectOption('tape');await page.locator('#guard-slot-1').selectOption('bell');await tap(page,page.getByRole('button',{name:'预演夜晚',exact:true}));
  await expect(page.locator('#guard-phase')).toHaveAttribute('data-phase','night');await page.locator('canvas[data-ready]').waitFor();
  await page.clock.fastForward(61000);await expect(page.locator('#guard-report')).toContainText('第 1 夜');
  const lab=await page.evaluate(()=>JSON.parse(localStorage.getItem('loststar.prototype.guard.v1')!));expect(lab.reports.clues).toBe(3);
  expect(await page.evaluate(k=>localStorage.getItem(k),KEY)).toBe(formal);await page.reload();
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('loststar.prototype.guard.v1')!));expect(restored.reports).toEqual(lab.reports);expect(await page.evaluate(k=>localStorage.getItem(k),KEY)).toBe(formal);
});
test('正常入口不载入实验、不创建守护存档',async({page})=>{
  await page.goto('/?start=base');await expect(page.locator('.base-scene')).toHaveAttribute('data-background-state','ready');expect(await page.evaluate(()=>localStorage.getItem('loststar.prototype.guard.v1'))).toBeNull();
  await expect(page.getByRole('button',{name:'开启夜间实验',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).some(name=>name.includes('/prototype/')))).toBe(false);
});

test('触控：从真实玻璃容器打开六件藏品并就地试验，生态区和夜守入口可返回',async({page})=>{
 await seeded(page);await tap(page,page.getByRole('button',{name:'进入失物收藏室',exact:true}));await expect(page.locator('#exhibition #museum-canvas')).toHaveAttribute('data-ready','true');
 for(const id of ['receipt','tape','nested','stamp','cosmic-parcel','bell']){
  await tap(page,page.locator(`#exhibition [data-exhibit="${id}"]`));await tap(page,page.locator(`[data-interact="${id}"]`));await expect(page.locator('#interaction-feedback')).toBeInViewport();await expect(page.locator('#interaction-feedback')).toHaveAttribute('data-last-input','touch');await tap(page,page.getByRole('button',{name:'关闭详情'}));
 }
 await tap(page,page.locator('[data-habitat="tagbird"]'));await tap(page,page.locator('[data-interact="tagbird"]'));await expect(page.locator('#interaction-feedback')).toBeInViewport();await tap(page,page.getByRole('button',{name:'关闭详情'}));
 await tap(page,page.locator('#exhibition [data-go="base"]'));await tap(page,page.getByRole('link',{name:/夜间守护试玩/}));await expect(page.locator('#guard-phase')).toHaveAttribute('data-phase','day');await tap(page,page.getByRole('link',{name:'返回收件站'}));await expect(page.locator('#base')).toBeVisible();
});
