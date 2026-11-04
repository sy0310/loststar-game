import {test,expect} from '@playwright/test';
test('冷首次访问基地：慢网期间不显示悬空角色，解码后才整体显现',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route(/museum-room.*\.webp/,async route=>{if(route.request().resourceType()==='image')await gate;await route.continue();});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  try{
    await expect(page.getByRole('button',{name:'基地',exact:true})).toHaveAttribute('aria-current','page');
    await expect(page.locator('.base-scene')).toHaveAttribute('data-background-state','loading');
    await expect(page.getByText('收件站正在接通')).toBeVisible();
    await page.waitForTimeout(750); // Intentionally hold a slow response; overlay must remain coherent.
    await expect(page.locator('#base #museum-canvas')).toBeHidden();
  }finally{release();}
  await expect(page.locator('.base-scene')).toHaveAttribute('data-background-state','ready');
  expect(await page.locator('#museum-canvas').evaluate(c=>(c as HTMLElement).dataset.ready==='true')).toBe(true);
  await expect(page.locator('#base #museum-canvas')).toBeVisible();await page.reload();
  await expect(page.locator('.base-scene')).toHaveAttribute('data-background-state','ready');
});
test('基地图片失败有可操作重试，不把空房间当加载完成',async({page})=>{
  await page.route(/museum-room.*\.webp/,r=>r.request().resourceType()==='image'?r.abort():r.continue());await page.goto('/');
  await expect(page.locator('.base-scene')).toHaveAttribute('data-background-state','error');
  await expect(page.locator('#base #museum-canvas')).toBeHidden();await page.unroute(/museum-room.*\.webp/);
  await page.getByRole('button',{name:'重新接通收件站'}).click();await expect(page.locator('.base-scene')).toHaveAttribute('data-background-state','ready');
});
test('文字放大、首页偏好和静音可保存，音频只在明确开启后工作',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.dataset.audioState)).toBe('muted');
  await page.getByRole('button',{name:'界面与声音设置'}).click();await page.getByRole('button',{name:'大字号',exact:true}).click();
  await page.getByRole('button',{name:'远征作为首页'}).click();await page.getByRole('button',{name:'开启声音'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-state','running');
  await page.getByRole('button',{name:'静音',exact:true}).click();await page.getByRole('button',{name:'关闭设置'}).click();await page.reload();
  await expect(page.getByRole('button',{name:'远征',exact:true})).toHaveAttribute('aria-current','page');await expect(page.locator('html')).toHaveAttribute('data-text-size','large');await expect(page.locator('html')).toHaveAttribute('data-audio-state','muted');
  for(const name of ['远征','星图','图鉴','基地']){
    await page.getByRole('button',{name,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const nav=await page.locator('nav').boundingBox();expect(nav!.y+nav!.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);
    const small=await page.locator('.view:not([hidden])').evaluate(el=>Array.from(el.querySelectorAll('*')).filter(e=>Array.from(e.childNodes).some(n=>n.nodeType===3&&n.textContent?.trim())&&e.getBoundingClientRect().height>0).map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(n=>n<10));expect(small).toEqual([]);
  }
  await page.addStyleTag({content:'html {font-size:150%!important}'}); // Browser preferred-text enlargement, separate from the in-game control.
  for(const name of ['远征','星图','图鉴','基地']){await page.getByRole('button',{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const nav=await page.locator('nav').boundingBox();expect(nav!.y+nav!.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);}
  expect(errors).toEqual([]);
});
test('长期首星日记有居民联动、存档回看与独立星际连续探测频道',async({page})=>{
  // 223 chronological 10-second clock steps model37 online minutes; Linux WebKit needs more than the default30s total budget.
  test.setTimeout(60000);
  await page.clock.install({time:new Date('2026-11-02T19:00:00Z')});await page.goto('/');
  for(let left=2221000;left>0;left-=10000){await page.clock.fastForward(Math.min(left,10000));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('loststar.save.v1')!).lastAt>=Date.now()-500);}
  await expect(page.locator('.journal-note')).toHaveCount(3);await expect(page.locator('#field-journal')).toContainText('标签鸟寄来了明天');
  await page.reload();await expect(page.locator('.journal-note')).toHaveCount(3);
  await page.getByRole('button',{name:'星图',exact:true}).click();await page.getByRole('button',{name:'星际监听',exact:true}).click();
  await expect(page.locator('#interstellar-status')).toHaveAttribute('data-stage',/searching|anomaly|locating|unconfirmed/);await expect(page.locator('#local-radar')).toBeHidden();
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|六颗|6颗|固定节点|问号/);
  await page.getByRole('button',{name:'地表勘测',exact:true}).click();await expect(page.locator('#local-radar')).toBeVisible();
});
