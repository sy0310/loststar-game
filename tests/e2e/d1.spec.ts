import {test,expect} from '@playwright/test';
import sharp from 'sharp';

async function seedReadOnly(page:import('@playwright/test').Page){
 await page.addInitScript(()=>{
  // Deliberately malformed sentinel: a D1 renderer must never parse the real save.
  localStorage.setItem('loststar.save.v1','existing-player-save-do-not-read-or-replace');
  localStorage.setItem('loststar.preferences.v1','keep-existing-preferences');
  (window as any).__d1StorageCalls=[];
  for(const key of ['getItem','setItem','removeItem','clear'] as const){
   const original=Storage.prototype[key];
   (Storage.prototype as any)[key]=function(...args:any[]){(window as any).__d1StorageCalls.push([key,...args]);return (original as any).apply(this,args);};
  }
 });
}
async function diff(a:Buffer,b:Buffer){
 const aa=await sharp(a).removeAlpha().raw().toBuffer(),bb=await sharp(b).removeAlpha().raw().toBuffer();
 expect(aa.length).toBe(bb.length);let changed=0;for(let i=0;i<aa.length;i+=3)if(Math.max(Math.abs(aa[i]-bb[i]),Math.abs(aa[i+1]-bb[i+1]),Math.abs(aa[i+2]-bb[i+2]))>20)changed++;return changed/(aa.length/3);
}
test('D1只读两样板同H5切换，重播/四档/刷新完全不接触正式存档与偏好',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await seedReadOnly(page);
 await page.goto('/?sample=night-d1');await expect(page.locator('#d1-app')).toContainText('只读');
 await expect(page.locator('#d1-scene canvas')).toHaveAttribute('data-ready','true');
 await page.locator('[data-study=receipt]').click();await expect(page.locator('#receipt-focus')).toHaveAttribute('data-ready','true');
 for(const level of [0,1,2,3]){await page.locator(`button[data-tier="${level}"]`).click();await expect(page.locator(`button[data-tier="${level}"]`)).toHaveAttribute('aria-pressed','true');}
 await page.locator('#receipt-install').click();await page.waitForTimeout(150);await page.locator('[data-study=night]').click();await page.locator('#d1-replay').click();
 expect(await page.evaluate(()=>(window as any).__d1StorageCalls)).toEqual([]);
 await page.reload();await expect(page.locator('#d1-scene canvas')).toHaveAttribute('data-ready','true');expect(await page.evaluate(()=>(window as any).__d1StorageCalls)).toEqual([]);expect(errors).toEqual([]);
});
test('D1减弱动态下夜巡各阶段跨球面追踪核验收容返站，三十秒后完成，镜头不溢出', async ({page}) => {
 await page.emulateMedia({reducedMotion: 'reduce'});
 await page.clock.install();
 await page.clock.pauseAt(new Date(Date.now() + 1000));
 await page.goto('/?sample=night-d1');
 const canvas = page.locator('#d1-scene canvas');
 await expect(canvas).toHaveAttribute('data-ready', 'true');
 await page.locator('#d1-replay').click();
 await page.clock.runFor(150);
 const frames: Buffer[] = [];
 const positions: number[] = [];
 for (const [delta, phase] of [[0, 'signal'], [7200, 'travel'], [4200, 'identify'], [5000, 'contain'], [5000, 'escort'], [5500, 'dock'], [3300, 'done']] as const) {
  // Jump between checkpoints, then execute real render callbacks for the image assertions.
  // Long runFor calls replay every intermediate RAF and exhaust slow Linux WebKit runners.
  await page.clock.fastForward(Math.max(0, delta - 100));
  await page.clock.runFor(Math.min(100, delta));
  await expect(page.locator('#d1-status')).toHaveAttribute('data-phase', phase);
  frames.push(await canvas.screenshot());
  positions.push(Number(await canvas.getAttribute('data-robot-x')));
 }
 expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(200);
 expect(await diff(frames[0], frames[2])).toBeGreaterThan(.01);
 expect(await diff(frames[2], frames[4])).toBeGreaterThan(.01);
 const bounds = await canvas.boundingBox();
 expect(bounds).not.toBeNull();
 expect(bounds!.y).toBeGreaterThanOrEqual(0);
 expect(bounds!.x).toBeGreaterThanOrEqual(0);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗/);
});
test('D1收据四级实际轮廓明显变化、同镜头同物品尺寸，安装有中间画面',async({page})=>{
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('/?sample=receipt-d1');
 // The asset promises resolve outside the paused test clock; render one real RAF after decode.
 await expect(page.locator('#d1-museum-source canvas')).toHaveAttribute('data-ready','true');await page.clock.runFor(100);
 const canvas=page.locator('#receipt-focus');await expect(canvas).toHaveAttribute('data-ready','true');const frames:Buffer[]=[];
 for(const level of [0,1,2,3]){await page.locator(`button[data-tier="${level}"]`).click();await page.clock.runFor(100);frames.push(await canvas.screenshot());}
 for(let i=1;i<4;i++)expect(await diff(frames[i-1],frames[i])).toBeGreaterThan(.02);
 await page.locator('#receipt-install').click();await page.clock.runFor(2410);const middle=await canvas.screenshot();await page.clock.runFor(1000);expect(await diff(middle,await canvas.screenshot())).toBeGreaterThan(.005);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const selector of ['[data-study=night]','[data-study=receipt]','button[data-tier="0"]','#receipt-install','#receipt-view']){const r=await page.locator(selector).boundingBox();expect(r!.height).toBeGreaterThanOrEqual(44);expect(r!.width).toBeGreaterThanOrEqual(44);}
});
test('正常游戏入口不载入D1新展柜或样板界面',async({page})=>{
 const requested:string[]=[];page.on('request',r=>requested.push(r.url()));await page.goto('/?start=base');await expect(page.locator('#museum-canvas')).toHaveAttribute('data-ready','true');await expect(page.locator('#d1-app')).toHaveCount(0);
 expect(requested.filter(x=>x.includes('/review/d1.ts')||x.includes('/review/night-scene')||/\/runtime\/d1(?:-refinement)?\//.test(x))).toEqual([]);
});

test('收据本体近景展示四档细节并保持同一观察镜头，纸卷持续柔性活动', async ({page}) => {
 await page.goto('/?sample=receipt-d1');
 const canvas = page.locator('#receipt-focus');
 await expect(canvas).toHaveAttribute('data-ready', 'true');
 await page.locator('#receipt-specimen-view').click();
 await expect(canvas).toHaveAttribute('data-view', 'specimen');
 const camera = await canvas.getAttribute('data-camera');
 const frames: Buffer[] = [];
 for (const level of [0, 1, 2, 3]) {
  await page.locator(`button[data-tier="${level}"]`).click();
  await expect(canvas).toHaveAttribute('data-specimen-tier', String(level));
  await expect(canvas).toHaveAttribute('data-camera', camera!);
  await page.waitForTimeout(500);
  frames.push(await canvas.screenshot());
 }
 for (let level = 1; level < frames.length; level++) {
  expect(await diff(frames[level - 1], frames[level])).toBeGreaterThan(.02);
 }
 const before = await canvas.screenshot();
 await page.waitForTimeout(550);
 expect(await diff(before, await canvas.screenshot())).toBeGreaterThan(.002);
 await page.locator('#receipt-specimen-view').click();
 await expect(canvas).toHaveAttribute('data-view', 'focus');
});

test('收据研究独立于柜体并实际核对输入记录，补签收后未发生事项从2变1', async ({page}) => {
 await seedReadOnly(page);
 await page.clock.install();
 await page.clock.pauseAt(new Date(Date.now() + 1000));
 await page.goto('/?sample=receipt-d1');
 const canvas = page.locator('#receipt-focus');
 await expect(page.locator('#d1-museum-source canvas')).toHaveAttribute('data-ready', 'true');
 await page.clock.runFor(120);
 await page.locator('#receipt-research summary').click();
 await page.locator('[data-research-tier="3"]').click();
 await page.locator('#receipt-experiment').click();
 await page.clock.runFor(250);
 await expect(canvas).toHaveAttribute('data-experiment-phase', 'opening');
 await expect(canvas).toHaveAttribute('data-research-level', '3');
 const paperBox = await canvas.boundingBox();
 const trialBox = await page.locator('#receipt-experiment').boundingBox();
 const viewportHeight = page.viewportSize()!.height;
 expect(paperBox!.y).toBeGreaterThanOrEqual(0);
 expect(paperBox!.y + paperBox!.height).toBeLessThanOrEqual(viewportHeight);
 expect(trialBox!.y + trialBox!.height).toBeLessThanOrEqual(viewportHeight);
 await page.clock.fastForward(5000);
 await page.clock.runFor(120);
 await expect(page.locator('#receipt-reading-result')).toHaveAttribute('data-pending', '2');
 await page.locator('#receipt-research summary').click();
 await page.locator('button[data-tier="0"]').click();
 await page.locator('#receipt-research summary').click();
 await expect(page.locator('[data-research-tier="3"]')).toHaveAttribute('aria-pressed', 'true');
 await page.locator('#receipt-sample').selectOption('B');
 await page.locator('#receipt-experiment').click();
 await page.clock.fastForward(5000);
 await page.clock.runFor(120);
 await expect(page.locator('#receipt-reading-result')).toHaveAttribute('data-pending', '1');
 await page.locator('#receipt-experiment').click();
 await page.clock.fastForward(5000);
 await page.clock.runFor(120);
 await expect(page.locator('#receipt-reading-result')).toHaveAttribute('data-pending', '1');
 expect(await page.evaluate(() => (window as any).__d1StorageCalls)).toEqual([]);
});
