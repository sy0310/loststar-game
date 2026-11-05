import {test,expect} from '@playwright/test';
import {newGame,advance,tuning} from '../../src/game/engine';
import {RESTORATION_DURATIONS} from '../../src/review/receipt-restoration';
const KEY='loststar.save.v1';
test('D1原生触控：两样板切换、四档展柜、真实安装与返回不改旧存档',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('loststar.save.v1','preserve-player-save');});
 await page.goto('/?sample=night-d1');await expect(page.locator('#d1-scene canvas')).toHaveAttribute('data-ready','true');
 await tap(page,page.locator('[data-study=receipt]'));await expect(page.locator('#receipt-focus')).toHaveAttribute('data-ready','true');
 for(const tier of [0,1,2,3]){await tap(page,page.locator(`button[data-tier="${tier}"]`));await expect(page.locator('#receipt-focus')).toHaveAttribute('data-tier',String(tier));}
 await tap(page,page.locator('#receipt-specimen-view'));
 await expect(page.locator('#receipt-focus')).toHaveAttribute('data-view','specimen');
 await expect(page.locator('#receipt-focus')).toHaveAttribute('data-specimen-tier','3');
 await tap(page,page.locator('#receipt-specimen-view'));
 await tap(page,page.locator('#receipt-research summary'));
 await tap(page,page.locator('[data-research-tier="3"]'));
 await tap(page,page.locator('#receipt-experiment'));
 await expect(page.locator('#receipt-focus')).toHaveAttribute('data-experiment-phase',/opening|reading|checking/);
 await expect(page.locator('#receipt-reading-result')).toHaveAttribute('data-phase','done',{timeout:7000});
 await expect(page.locator('#receipt-reading-result')).toHaveAttribute('data-pending','2');
 await tap(page,page.locator('#receipt-research summary'));
 await tap(page,page.locator('#receipt-install'));await expect(page.locator('#receipt-install')).toHaveAttribute('data-playing','true');
 await tap(page,page.locator('#receipt-view'));await expect(page.locator('#receipt-focus')).toHaveAttribute('data-view','room');
 await tap(page,page.locator('[data-study=night]'));await tap(page,page.locator('#d1-replay'));await expect(page.locator('#d1-status')).toHaveAttribute('data-phase','signal');
 expect(await page.evaluate(()=>localStorage.getItem('loststar.save.v1'))).toBe('preserve-player-save');
});
async function seeded(page:import('@playwright/test').Page,path='/?start=base&review=1'){
  const s=advance(newGame(1800000000000),1800001000000);s.lastAt=Date.now();s.seenDiscoveries=[...s.collection];
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
test('正常入口只使用主游戏世界，不载入实验页面或实验存档',async({page})=>{
  await page.goto('/?start=base');await expect(page.locator('.base-scene')).toHaveAttribute('data-background-state','ready');expect(await page.evaluate(()=>localStorage.getItem('loststar.prototype.guard.v1'))).toBeNull();
  await expect(page.getByRole('button',{name:'开启夜间实验',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).some(name=>name.includes('/prototype/main')))).toBe(false);
});

test('触控：从真实玻璃容器打开六件藏品并就地试验，生态区和原远征可返回',async({page})=>{
 await seeded(page);await tap(page,page.getByRole('button',{name:'进入失物收藏室',exact:true}));await expect(page.locator('#exhibition #museum-canvas')).toHaveAttribute('data-ready','true');
 for(const id of ['receipt','tape','nested','stamp','cosmic-parcel','bell']){
  await tap(page,page.locator(`#exhibition [data-exhibit="${id}"]`));await tap(page,page.locator(`[data-interact="${id}"]`));await expect(page.locator('#interaction-feedback')).toBeInViewport();await expect(page.locator('#interaction-feedback')).toHaveAttribute('data-last-input','touch');await tap(page,page.getByRole('button',{name:'关闭详情'}));
 }
 await tap(page,page.locator('[data-habitat="tagbird"]'));await tap(page,page.locator('[data-interact="tagbird"]'));await expect(page.locator('#interaction-feedback')).toBeInViewport();await tap(page,page.getByRole('button',{name:'关闭详情'}));
 await tap(page,page.locator('#exhibition [data-go="base"]'));await tap(page,page.getByRole('button',{name:'远征',exact:true}));await expect(page.locator('#world-phase')).toHaveAttribute('data-period','day');await expect(page.locator('a[href*=night-lab]')).toHaveCount(0);
});

test('夜守同源：空槽/单槽/双槽真实结果不同，晨间逐个记录抵达与提前拦退',async({page})=>{
 await page.clock.install({time:new Date('2026-11-03T07:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T07:00:10Z'));await seeded(page,'/night-lab.html?review=1');const formal=await page.evaluate(k=>localStorage.getItem(k),KEY);
 await page.locator('#guard-pacing').selectOption('short');
 for(const [a,b,count] of [['','','0'],['tape','','1'],['tape','bell','2']]){
  await page.locator('#guard-slot-0').selectOption(a);await page.locator('#guard-slot-1').selectOption(b);await tap(page,page.getByRole('button',{name:'预演夜晚',exact:true}));await expect(page.locator('#guard-live')).toBeVisible();await page.clock.fastForward(10200);
  await expect(page.locator('#guard-report')).toHaveAttribute('data-intercepted',count);await expect(page.locator('#guard-report [data-visitor-result]')).toHaveCount(3);await expect(page.locator('#guard-report')).toContainText('安全送回');
 }
 expect(await page.evaluate(k=>localStorage.getItem(k),KEY)).toBe(formal);
 await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)!);s.growth={'guard-0':3,'guard-1':3};localStorage.setItem(k,JSON.stringify(s));},KEY);await page.reload();await tap(page,page.getByRole('button',{name:'预演夜晚',exact:true}));await page.clock.fastForward(10200);await expect(page.locator('#guard-report')).toHaveAttribute('data-intercepted','3');await expect(page.locator('#guard-report')).toContainText('完整封条档案');await expect(page.locator('#guard-effect-0')).toContainText('62%');await expect(page.locator('#guard-effect-1')).toContainText('1.7');
});

test('成长付款后展示真实近景前后对照，切换不再扣款，守护能力有具体数字',async({page})=>{
 await page.clock.install({time:new Date('2026-11-03T07:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T07:00:10Z'));await seeded(page);await tap(page,page.getByRole('button',{name:'进入失物收藏室',exact:true}));await tap(page,page.getByRole('button',{name:'展柜与设施升级'}));
 const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY);await tap(page,page.locator('[data-growth-buy="case-0"]'));const receipt=page.locator('#growth-receipt');await expect(receipt).toBeInViewport();await expect(receipt).toContainText('160');await expect(receipt.locator('canvas')).toHaveAttribute('data-ready','true');
 await tap(page,receipt.getByRole('button',{name:'升级前',exact:true}));const old=await receipt.locator('canvas').screenshot();await tap(page,receipt.getByRole('button',{name:'升级后',exact:true}));expect(await receipt.locator('canvas').screenshot()).not.toEqual(old);expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY)).toBe(before-160);
 await tap(page,page.locator('[data-growth-filter="守护"]'));await expect(page.locator('[data-growth="guard-0"]')).toContainText('44%');await expect(page.locator('[data-growth="guard-0"]')).toContainText('50%');await expect(page.locator('[data-growth="guard-1"]')).toContainText('1.3');
});

test('主远征触控与模拟后台恢复：双槽持久化、夜结算同源、切页恢复作业，多标签不重复归航',async({page,context})=>{
 const T=Date.parse('2026-11-03T10:00:10Z');await page.clock.install({time:new Date(T-10000)});await page.clock.pauseAt(new Date(T));await seeded(page);await page.locator('#museum-canvas[data-ready=true]').waitFor();
 const frames=Number(await page.locator('#museum-canvas').getAttribute('data-frame'));
 // Simulate the WebView visibility event; this is not physical lock-screen certification.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.fastForward(300100);await page.clock.runFor(100);expect(Number(await page.locator('#museum-canvas').getAttribute('data-frame'))).toBe(frames);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(150);await expect.poll(async()=>Number(await page.locator('#museum-canvas').getAttribute('data-frame'))).toBeGreaterThan(frames);
 await expect(page.locator('dialog')).toBeVisible();await tap(page,page.getByRole('button',{name:'收下这次远行'}));await tap(page,page.getByRole('button',{name:'远征',exact:true}));await tap(page,page.locator('#world-controls summary'));await page.locator('#world-slot-0').selectOption('beacon');await page.locator('#world-slot-1').selectOption('gate');
 await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).world.slots,KEY)).toEqual(['beacon','gate']);const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);expect(saved.world.reports.nights).toBe(1);await page.reload();await tap(page,page.getByRole('button',{name:'远征',exact:true}));await tap(page,page.locator('#world-controls summary'));await expect(page.locator('#world-slot-0')).toHaveValue('beacon');await expect(page.locator('#world-slot-1')).toHaveValue('gate');
 const second=await context.newPage();await second.clock.install({time:new Date(T+300350)});await second.clock.pauseAt(new Date(T+300350));await second.goto('/?start=expedition&review=1');const s=await second.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);expect(s.pendingReturn).toBeNull();expect(s.world.reports.nights).toBe(1);expect(s.world.slots).toEqual(['beacon','gate']);expect(await second.locator('a[href*=night-lab]').count()).toBe(0);await second.close();
});

test('V0.3原生触控：余额7部分维修、自动开关保存、刷新不重扣、科研不足禁用',async({page})=>{
 await page.clock.install({time:new Date('2026-11-03T15:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T15:00:10Z'));const s=newGame(Date.parse('2026-11-03T15:00:10Z'));s.resources=7;s.station.integrity=82;s.station.autoRepair=false;
 await page.addInitScript(({s,k})=>{if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(s));},{s,k:KEY});await page.goto('/?start=expedition&review=1');await tap(page,page.locator('#manual-repair'));await expect(page.locator('#station-panel')).toHaveAttribute('data-integrity','84');await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY)).toBe(1);await page.reload();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).resources,KEY)).toBe(1);await tap(page,page.locator('.repair-controls label'));await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).station.autoRepair,KEY)).toBe(true);await tap(page,page.locator('#research-controls summary'));await expect(page.locator('[data-plan=field]')).toBeDisabled();await expect(page.locator('#world-controls')).not.toContainText('无人签收铃');
});

test('V034原生触控：出土整理、免费试验与三抽屉在同一竖屏内可操作', async ({page}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => localStorage.setItem('loststar.save.v1', 'V034-TOUCH-PRESERVE'));
  await page.goto('/?sample=week1&view=receipt');
  const canvas = page.locator('#week1-paper');
  const primary = page.locator('#week1-primary');
  await expect(canvas).toHaveAttribute('data-restoration-ready', 'true');
  await page.clock.runFor(150);
  await expect(primary).toBeInViewport();
  const advance = async (milliseconds: number) => {
    await page.clock.fastForward(milliseconds - 100);
    await page.clock.runFor(100);
  };
  await tap(page, primary);
  await advance(RESTORATION_DURATIONS.excavate * 1000 + 200);
  await tap(page, primary);
  await expect(primary).toBeDisabled();
  await tap(page, primary);
  await advance(RESTORATION_DURATIONS.clean * 1000 + 200);
  await expect(page.locator('#week1-parts')).toHaveText('320');
  await tap(page, primary);
  await advance(RESTORATION_DURATIONS.repair * 1000 + 200);
  await expect(page.locator('#week1-parts')).toHaveText('200');
  const button = page.locator('#week1-try');
  await expect(canvas).toBeInViewport();
  await expect(button).toBeInViewport();
  await tap(page, button);
  await advance(2700);
  await expect(page.locator('#week1-parts')).toHaveText('200');
  await tap(page, page.locator('[data-week-tab="night"]'));
  await expect(page.locator('#week1-world canvas')).toHaveAttribute('data-ready', 'true');
  for (const drawer of ['security', 'research', 'repair']) {
    await tap(page, page.locator(`[data-drawer="${drawer}"]`));
    await expect(page.locator('#week1-close')).toBeInViewport();
    if (drawer === 'research') {
      const ticket = page.locator('[data-study-candidate="field"]');
      await tap(page, ticket.locator('summary'));
      await expect(ticket).toContainText('首星记录已齐');
      await expect(ticket).toContainText('用时与离线');
      await expect(ticket.getByRole('button', {name: '待任务内容审核'})).toBeDisabled();
    }
    await tap(page, page.locator('#week1-close'));
  }
  expect(await page.evaluate(() => localStorage.getItem('loststar.save.v1'))).toBe('V034-TOUCH-PRESERVE');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('融合原生触控：点星球有助力，六件奇物可反复互动且不重复发奖', async ({page}) => {
  await seeded(page, '/?sample=fusion');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  const read = () => page.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('loststar.fusion.v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const item = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      item.onsuccess = () => {resolve(item.result); db.close();};
    };
  }));
  const original = await page.evaluate(() => localStorage.getItem('loststar.save.v1'));
  await tap(page, page.locator('#fusion-tap'));
  await expect.poll(async () => (await read()).game.assist?.actionSeq).toBe(1);
  await tap(page, page.locator('[data-tab="collection"]'));
  const before = await read();
  for (const id of ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']) {
    await tap(page, page.locator(`#fusion-collection-list [data-detail="${id}"]`));
    const trial = page.locator('#fusion-try');
    await expect(trial).toBeEnabled();
    await tap(page, trial);
    if (id === 'receipt') {
      await expect.poll(async () => (await read()).receipt.activeAction?.kind).toBe('try');
      const canvas = page.locator('#fusion-paper-focus');
      const first = await canvas.screenshot();
      await page.waitForTimeout(350);
      expect(await canvas.screenshot()).not.toEqual(first);
      const action = (await read()).receipt.activeAction?.id;
      await expect(trial).toBeEnabled({timeout:5000});
      await tap(page, trial);
      await expect.poll(async () => (await read()).receipt.activeAction?.id).not.toBe(action);
      await expect(canvas).toHaveAttribute('data-restoration-phase','trying');
    } else {
      const canvas = page.locator('#fusion-exhibit-focus');
      await expect(canvas).toHaveAttribute('data-item', id);
      await expect(canvas).toHaveAttribute('data-last-input', 'touch');
      await expect(canvas).toHaveAttribute('data-experiment-playing', 'true');
      await expect(canvas).toBeInViewport();
      await expect(page.locator('#interaction-feedback')).toBeHidden();
      const first = await canvas.screenshot();
      await page.waitForTimeout(250);
      expect(await canvas.screenshot()).not.toEqual(first);
      const replay = await canvas.getAttribute('data-replay');
      const started = await canvas.getAttribute('data-experiment-started-at');
      if(id==='tape'||id==='bell'){
        // A physical mechanism must finish returning before a second touch;
        // replayability does not mean interrupting a loaded shaft or tape.
        await expect(trial).toBeDisabled();
        await expect(trial).toBeEnabled({timeout:5000});
      }
      await tap(page, trial);
      await expect(canvas).not.toHaveAttribute('data-replay', replay!);
      await expect(canvas).not.toHaveAttribute('data-experiment-started-at', started!);
      await expect(canvas).toHaveAttribute('data-experiment-playing', 'true');
    }
    await tap(page, page.locator('#fusion-close'));
  }
  const after = await read();
  expect(after.game.collection).toEqual(before.game.collection);
  expect(after.game.resources - before.game.resources).toBe(after.game.station.grossIncome - before.game.station.grossIncome - after.game.station.repairSpent + before.game.station.repairSpent);
  expect(await page.evaluate(() => localStorage.getItem('loststar.save.v1'))).toBe(original);
});
