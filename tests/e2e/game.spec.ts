import { test, expect, type Page } from '@playwright/test';
const KEY='loststar.save.v1';
// Step clocks while allowing the asynchronous save lock to finish, as live intervals do.
async function passTime(page:Page,ms:number){
  for(let left=ms;left>0;left-=10000){await page.clock.fastForward(Math.min(left,10000));await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).lastAt>=Date.now()-500,KEY);}
}
test('新手无剧透，雷达实际定位后才揭晓，刷新保留发现', async ({page})=>{
  await page.clock.install({time:new Date('2026-11-02T17:00:00Z')});
  await page.goto('/');
  await page.getByRole('button',{name:'星图',exact:true}).click();
  await expect(page.getByText('正在聆听宇宙')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗|\?/);
  await expect(page.locator('[data-signal]')).toHaveCount(0);
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星/);
  await passTime(page,61000);
  await expect(page.getByText('捕获异常信号')).toBeVisible();
  await expect(page.locator('[data-signal]')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('回声菌星');
  await passTime(page,34000);
  await expect(page.getByText('正在锁定坐标')).toBeVisible();
  await passTime(page,26000);
  await expect(page.getByText('回声菌星',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'记录新航路'}).click();
  await expect(page.getByRole('button',{name:'记录新航路'})).toHaveCount(0);
  await page.reload();
  await page.getByRole('button',{name:'星图',exact:true}).click();
  await expect(page.getByRole('button',{name:'回声菌星 已记录坐标 · 等待勘测'})).toBeVisible();
  await expect(page.getByRole('button',{name:'记录新航路'})).toHaveCount(0);
});
test('自动探索→图鉴→详情互动→基地展出→升级生效',async({page})=>{
  await page.clock.install({time:new Date('2026-11-02T17:00:00Z')});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await passTime(page,37000);
  await page.getByRole('button',{name:'图鉴',exact:true}).click();
  await expect(page.getByRole('button',{name:/未购买的退货收据/})).toBeVisible();
  await page.getByRole('button',{name:/未购买的退货收据/}).click();
  await page.getByRole('button',{name:'试一试'}).click();
  await expect(page.getByText(/已收到好奇心/)).toBeVisible();
  await page.getByRole('button',{name:'关闭详情'}).click();
  await page.getByRole('button',{name:'基地',exact:true}).click();
  await expect(page.getByRole('button',{name:/查看 未购买的退货收据/})).toBeVisible();
  await page.getByRole('button',{name:/设备工坊/}).click();
  await page.getByRole('button',{name:/升级扫描仪/}).click();
  await expect(page.locator('[data-upgrade="scanner"]')).toContainText('Lv.2');
  await page.reload();
  const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);
  expect(s.upgrades.scanner).toBe(1);
  expect(s.collection).toContain('receipt');expect(errors).toEqual([]);
});
test('离线包裹领取一次，刷新与第二标签页均不双领',async({page,context})=>{
  await page.goto('/');
  await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)!);s.lastAt=Date.now()-3600000;localStorage.setItem(k,JSON.stringify(s));},KEY);
  await page.reload();
  await expect(page.getByText('离线归航')).toBeVisible();
  const second=await context.newPage();await second.goto('/');
  await page.getByRole('button',{name:'收下这次远行'}).click();
  await expect(page.locator('dialog')).not.toBeVisible();
  const balance=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY);
  // Submit the stale second dialog even if the storage event has already closed it.
  await second.locator('[data-action="claim"]').evaluate(el=>(el as HTMLButtonElement).click());
  await page.reload();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY)).toBe(balance);
  await expect(page.getByText('离线归航')).toHaveCount(0);
});
test('所有页面无横向溢出，导航和操作可触达，首屏不加载概念拼版',async({page})=>{
  const bad:string[]=[];page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
  await page.goto('/');
  for(const name of ['远征','星图','图鉴','基地']){
    await page.getByRole('button',{name,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const box=await page.getByRole('button',{name,exact:true}).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:`artifacts/${test.info().project.name}-${name}.png`});
  }
  const refs=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
  expect(refs.some(r=>r.includes('/design/reference'))).toBe(false);expect(bad).toEqual([]);
});
