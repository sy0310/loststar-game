import {test,expect} from '@playwright/test';
test('收藏室实景：六个独立玻璃展位与三个居民生态区有连续动画',async({page})=>{
  await page.goto('/exhibition-lab.html');
  await expect(page.getByRole('heading',{name:'失物收藏室'})).toBeVisible();
  const room=page.locator('#museum-canvas');await expect(room).toHaveAttribute('data-ready','true');
  await expect(page.locator('[data-exhibit]')).toHaveCount(6);
  await expect(page.locator('[data-habitat] canvas')).toHaveCount(3);
  const first=await room.screenshot();await page.waitForTimeout(550);expect(await room.screenshot()).not.toEqual(first);
  for(const button of await page.locator('[data-exhibit]').all()){const r=await button.boundingBox();expect(r!.width).toBeGreaterThanOrEqual(44);expect(r!.height).toBeGreaterThanOrEqual(44);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('正式基地免费陈列可放大试验，成长购买保留存档，夜守可进入退出',async({page})=>{
 await page.addInitScript(async()=>{const raw={version:2,lastAt:Date.now(),resources:5000,cycles:62,cycleMs:0,radarMs:0,surveyCount:0,surveyNotice:null,planets:['parcel'],collection:['receipt','mouse','tape','hermit','nested','night-shift','stamp','tagbird','cosmic-parcel','bell','return-request','last-recipient'],seenDiscoveries:['receipt','mouse','tape','hermit','nested','night-shift','stamp','tagbird','cosmic-parcel','bell','return-request','last-recipient'],discoveryAt:{},upgrades:{radar:5,scanner:5,recycler:5,cargo:5},pendingReturn:null};if(!localStorage.getItem('loststar.save.v1'))localStorage.setItem('loststar.save.v1',JSON.stringify(raw));});
 await page.goto('/?start=base');await page.getByRole('button',{name:'进入失物收藏室',exact:true}).click();await expect(page.locator('#exhibition #museum-canvas')).toHaveAttribute('data-ready','true');
 await page.getByRole('button',{name:'放大自动道歉的胶带',exact:true}).click();await page.locator('[data-interact=tape]').click();await expect(page.locator('#interaction-feedback')).toBeInViewport();await page.getByRole('button',{name:'关闭详情'}).click();
 await page.getByRole('button',{name:'展柜与设施升级'}).click();await page.locator('[data-growth-buy="case-0"]').click();await expect(page.locator('[data-growth="case-0"]')).toContainText('1 / 3');await page.getByRole('button',{name:'关闭工坊'}).click();await page.reload();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('loststar.save.v1')!).growth['case-0'])).toBe(1);
 await page.getByRole('link',{name:/夜间守护试玩/}).click();await expect(page.locator('#guard-phase')).toHaveAttribute('data-phase','day');await page.getByRole('link',{name:'返回收件站'}).click();await expect(page.locator('#base')).toBeVisible();
});
