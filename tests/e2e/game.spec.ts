import { test,expect,type Page } from '@playwright/test';
const KEY='loststar.save.v1';
const hiddenWorlds=/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗|等待勘测|新航路/;
async function passTime(page:Page,ms:number){
  for(let left=ms;left>0;left-=10000){await page.clock.fastForward(Math.min(left,10000));await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).lastAt>=Date.now()-500,KEY);}
}
async function boot(page:Page){
  await page.clock.install({time:new Date('2026-11-02T19:00:00Z')});
  // Keep the three-second presentation window independent of navigation/CI CPU time.
  // Pause before app creation; every subsequent game-time change uses passTime().
  await page.clock.pauseAt(new Date('2026-11-02T19:00:10Z'));
  await page.goto('/?start=expedition');
}

test('首星雷达只勘测真实现场，不引向未开放星球',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'星图',exact:true}).click();
  await expect(page.getByText('正在监听退件平原')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(hiddenWorlds);
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(hiddenWorlds);
  await expect(page.locator('[data-signal]')).toHaveCount(0);
  await passTime(page,46000);await expect(page.getByText('捕获本地异常')).toBeVisible();await expect(page.locator('[data-signal]')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('反向分拣回波');
  await passTime(page,26000);await expect(page.getByText('正在核对回波')).toBeVisible();
  await passTime(page,19000);await expect(page.getByRole('heading',{name:'反向分拣回波'})).toBeVisible();
  const balance=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY);
  await page.getByRole('button',{name:'收录现场记录'}).click();await expect(page.getByRole('button',{name:'收录现场记录'})).toHaveCount(0);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY)).toBe(balance);
  await page.reload();await page.getByRole('button',{name:'星图',exact:true}).click();
  await expect(page.getByText('反向分拣回波',{exact:true})).toBeVisible();await expect(page.locator('body')).not.toContainText(hiddenWorlds);
  await expect(page.locator('.known-planet')).toHaveCount(1);
});
test('新奇物和新居民有独立发现演出，不阻断导航、刷新不重放',async({page})=>{
  await boot(page);await passTime(page,12500);
  await expect(page.locator('[data-presentation="receipt"]')).toBeVisible();
  await expect(page.getByText('这张收据，先认识了你。')).toBeVisible();
  await passTime(page,3100);await expect(page.locator('#discovery-stage')).toBeHidden();
  await page.reload();await expect(page.locator('[data-presentation="receipt"]')).toHaveCount(0);
  await passTime(page,20900);await expect(page.locator('[data-presentation="mouse"][data-cue="resident"]')).toBeVisible();
  await page.getByRole('button',{name:'图鉴',exact:true}).click();await expect(page.getByRole('heading',{name:'宇宙图鉴'})).toBeVisible();
  await expect(page.locator('#discovery-stage')).toBeHidden();
});
test('首星事件有像素现场演出，积累发现只展示最新一份',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'图鉴',exact:true}).click();await passTime(page,181000);
  await page.getByRole('button',{name:'远征',exact:true}).click();
  await expect(page.locator('[data-presentation="night-shift"][data-cue="glitch"]')).toBeVisible();
  await expect(page.getByText('夜班开始。员工：零。')).toBeVisible();
  await page.getByRole('button',{name:'收起发现提示'}).click();await passTime(page,7000);
  await expect(page.locator('[data-presentation]')).toHaveCount(0);
});
test('完整首星图鉴生态、六个展柜与奇物互动真实联动',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'图鉴',exact:true}).click();await passTime(page,925000);
  await expect(page.locator('#collection-count')).toContainText('12 / 12');
  for(const [kind,count] of [['奇物',6],['生物',3],['事件',3]] as const){await page.getByRole('button',{name:new RegExp(`^${kind}`)}).click();await expect(page.locator('.discovery-card')).toHaveCount(count);}
  await page.getByRole('button',{name:/^奇物/}).click();await page.getByRole('button',{name:'未购买的退货收据，奇物'}).click();
  const balance=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY);
  await page.getByRole('button',{name:'试一试'}).click();await page.getByRole('button',{name:'试一试'}).click();
  await expect(page.getByText(/已收到好奇心/)).toBeVisible();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY)).toBe(balance);
  await page.getByRole('button',{name:'关闭详情'}).click();await page.getByRole('button',{name:'基地',exact:true}).click();
  await expect(page.locator('#base [data-exhibit]')).toHaveCount(6);await expect(page.locator('.resident')).toHaveCount(3);
  const bounds=await page.locator('#base [data-exhibit]').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect(),p=b.closest('.museum-room')!.getBoundingClientRect();return{w:r.width,h:r.height,inside:r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom}}));
  expect(bounds.every(b=>b.w>=44&&b.h>=44&&b.inside)).toBe(true);
  await expect(page.locator('body')).not.toContainText(hiddenWorlds);
});
test('工坊真实升级反馈、保存与缺钱禁用',async({page})=>{
  await boot(page);await passTime(page,37000);await page.getByRole('button',{name:'基地',exact:true}).click();
  await page.getByRole('button',{name:/设备工坊/}).click();await page.getByRole('button',{name:'升级扫描仪',exact:true}).click();
  await expect(page.locator('[data-upgrade="scanner"]')).toContainText('Lv.2');await expect(page.locator('#toast')).toContainText('9.8 秒');
  await page.reload();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).upgrades.scanner,KEY)).toBe(1);
  await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)!);s.resources=0;localStorage.setItem(k,JSON.stringify(s));},KEY);await page.reload();
  await page.getByRole('button',{name:/设备工坊/}).click();for(const id of ['radar','scanner','recycler','cargo'])await expect(page.locator(`[data-upgrade-buy="${id}"]`)).toBeDisabled();
});
test('离线归航清单只领取一次，旧标签页不重复发奖或轰炸演出',async({page,context})=>{
  await page.goto('/');await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)!);s.lastAt=Date.now()-86400000;localStorage.setItem(k,JSON.stringify(s));},KEY);await page.reload();
  await expect(page.getByText('离线归航')).toBeVisible();await expect(page.locator('.cargo-found .cargo-item')).toHaveCount(12);await expect(page.locator('.manifest-footer')).toContainText('2 小时');
  const second=await context.newPage();await second.goto('/');
  await page.getByRole('button',{name:'收下这次远行'}).click();await expect(page.locator('dialog')).toBeHidden();
  const balance=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY);
  await second.locator('[data-action="claim"]').evaluate(el=>(el as HTMLButtonElement).click());await page.reload();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY)).toBe(balance);await expect(page.getByText('离线归航')).toHaveCount(0);await expect(page.locator('[data-presentation]')).toHaveCount(0);
});
test('旧切片进度迁移，已记录航路永久保留且未完成星球禁用远征',async({page})=>{
  await page.goto('/');await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:1,lastAt:Date.now(),resources:357,cycles:8,cycleMs:0,radarMs:120000,reveal:'echo',planets:['parcel','echo'],collection:['receipt','tape','mouse'],upgrades:{radar:1,scanner:1,recycler:0,cargo:0},pendingReturn:null})),KEY);await page.reload();
  const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);expect(s.version).toBe(2);expect(s.resources).toBe(357);expect(s.planets).toContain('echo');expect(s.collection).toEqual(expect.arrayContaining(['receipt','tape','mouse']));
  await page.getByRole('button',{name:'星图',exact:true}).click();await expect(page.locator('.known-planet')).toHaveCount(2);await expect(page.locator('.known-planet').filter({hasText:'回声菌星'})).toBeDisabled();
});
test('所有页面触控、安全区和资源有效，导航处在滚动内容之外',async({page})=>{
  const bad:string[]=[],errors:string[]=[];page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await boot(page);await passTime(page,61000);
  for(const [name,file] of [['远征','expedition'],['星图','radar'],['图鉴','collection'],['基地','base']] as const){
    await page.getByRole('button',{name,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const nav=await page.locator('nav').boundingBox(),main=await page.locator('main').boundingBox(),button=await page.getByRole('button',{name,exact:true}).boundingBox();
    expect(main!.y+main!.height).toBeLessThanOrEqual(nav!.y+1);expect(button!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:`artifacts/${test.info().project.name}-${file}.png`});
  }
  await page.getByRole('button',{name:/设备工坊/}).click();await page.locator('.equipment-art').evaluateAll(imgs=>Promise.all(imgs.map(i=>(i as HTMLImageElement).decode())));await page.screenshot({path:`artifacts/${test.info().project.name}-workshop.png`});
  const refs=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));expect(refs.some(r=>r.includes('/design/reference'))).toBe(false);expect(bad).toEqual([]);expect(errors).toEqual([]);
});
