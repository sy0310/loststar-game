import {test, expect, type Page} from '@playwright/test';

test.use({hasTouch: true});

async function protectPlayerData(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('loststar.save.v1', 'player-archive-sentinel');
    localStorage.setItem('loststar.preferences.v1', 'player-preference-sentinel');
    const calls: string[] = [];
    Object.assign(window, {__v036StorageCalls: calls});
    for (const key of ['getItem', 'setItem', 'removeItem', 'clear'] as const) {
      const original = Storage.prototype[key];
      Object.defineProperty(Storage.prototype, key, {configurable: true, value(...args: string[]) {
        calls.push(`storage.${key}`);
        return Reflect.apply(original, this, args);
      }});
    }
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(...args) {
      calls.push('indexedDB.open');
      return Reflect.apply(open, this, args);
    };
  });
}

async function metrics(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__V036__.metrics().study);
}

async function start(page: Page, view = 'fog', clock = false) {
  await page.goto(`/?sample=art-v036&view=${view}`);
  await expect(page.locator('.v036-stage canvas').first()).toHaveAttribute('data-ready', 'true');
  if (clock) await page.clock.runFor(100);
  await expect.poll(async () => (await metrics(page)).ready).toBe(true);
}

test('两视觉样板与重播完全隔离玩家存档，触控切换且画幅无溢出', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await protectPlayerData(page);
  await start(page);
  for (const study of ['receipt', 'fog', 'receipt']) {
    await page.locator(`button[data-study="${study}"]`).tap();
    await expect(page.locator(`button[data-study="${study}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.v036-stage canvas').first()).toHaveAttribute('data-ready', 'true');
    await page.locator('[data-control="replay"]').tap();
  }
  expect(await page.evaluate(() => (window as any).__v036StorageCalls)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.locator('.v036-app button').all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗/);
  await page.reload();
  await expect(page.locator('.v036-stage canvas').first()).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => (window as any).__v036StorageCalls)).toEqual([]);
  expect(errors).toEqual([]);
});

test('星雾原生轻触只贡献有界工作，拖动不计入，世界持续绕轨', async ({page}) => {
  await start(page);
  const canvas = page.locator('.v036-stage canvas').first();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * .72;
  const y = box.y + box.height * .63;
  for (let i = 0; i < 8; i++) await page.touchscreen.tap(x, y);
  const result = await metrics(page);
  expect(result.assist.actionSeq).toBeGreaterThan(0);
  expect(result.assist.actionSeq).toBeLessThanOrEqual(5);
  expect(result.assist.enqueuedWorkMs).toBe(result.assist.actionSeq * 600);
  expect(result.assist.pendingWorkMs).toBeLessThanOrEqual(3000);
  expect(result.rewards).toBe(0);
  expect(result.walletWrites).toBe(0);
  const seq = result.assist.actionSeq;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 30, {steps: 4});
  await page.mouse.up();
  expect((await metrics(page)).assist.actionSeq).toBe(seq);
});

for (const study of ['fog', 'receipt']) {
  test(`${study}暂停观察、后台恢复与减少动态保留过程，重播恢复原状态`, async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await start(page, study, true);
    await page.clock.runFor(150);
    await page.locator('[data-control="pause"]').tap();
    const stopped = await metrics(page);
    await page.clock.fastForward(8000);
    await page.clock.runFor(100);
    expect((await metrics(page)).elapsed).toBe(stopped.elapsed);
    await page.locator('[data-control="pause"]').tap();
    await page.clock.runFor(200);
    expect((await metrics(page)).elapsed).toBeGreaterThan(stopped.elapsed);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hidden = await metrics(page);
    await page.clock.fastForward(12000);
    await page.clock.runFor(100);
    expect((await metrics(page)).elapsed).toBe(hidden.elapsed);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(200);
    expect((await metrics(page)).elapsed).toBeGreaterThan(hidden.elapsed);
    await page.locator('[data-control="replay"]').tap();
    await page.clock.runFor(100);
    expect((await metrics(page)).elapsed).toBeLessThan(study === 'fog' ? 250 : .25);
  });
}

test('同球散雾从遮挡到真实节点，完成后角色世界仍持续绘制', async ({page}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await start(page, 'fog', true);
  await page.locator('[data-control="replay"]').tap();
  await page.clock.runFor(100);
  const initial = await metrics(page);
  expect(initial.phase).toBe('undetected');
  expect(await page.locator('.v036-status').innerText()).not.toContain('旧分拣区');
  await page.clock.fastForward(7200);
  await page.clock.runFor(100);
  expect((await metrics(page)).phase).toBe('scanning');
  await page.clock.fastForward(4400);
  await page.clock.runFor(100);
  expect((await metrics(page)).phase).toBe('clearing');
  await page.clock.fastForward(6500);
  await page.clock.runFor(100);
  const complete = await metrics(page);
  expect(complete.phase).toBe('revealed');
  expect(complete.target.id).toBe('parcel/old-sorting');
  expect(Math.hypot(complete.robot.x - initial.robot.x, complete.robot.y - initial.robot.y)).toBeGreaterThan(100);
  const before = await page.locator('.v036-stage canvas').screenshot();
  await page.clock.runFor(400);
  const after = await page.locator('.v036-stage canvas').screenshot();
  expect(after.equals(before)).toBe(false);
  expect((await metrics(page)).elapsed).toBeGreaterThan(complete.elapsed);
  expect((await metrics(page)).rewards).toBe(0);
});

test('刷毛实际擦除泥层，两处压补与免费打印保持原签收空白', async ({page}) => {
  await protectPlayerData(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await start(page, 'receipt', true);
  await page.locator('[data-control="replay"]').tap();
  await page.clock.runFor(100);
  const dirty = (await metrics(page)).cleanCoverage;
  await page.clock.fastForward(10100);
  await page.clock.runFor(100);
  const middle = await metrics(page);
  expect(middle.phase).toBe('cleaning');
  expect(middle.cleanCoverage).toBeGreaterThan(dirty + .15);
  expect(middle.cleanCoverage).toBeLessThan(.9);
  expect(middle.contact?.tool).toBe('brush');
  await page.clock.fastForward(4200);
  await page.clock.runFor(100);
  const cleaned = await metrics(page);
  expect(cleaned.phase).toBe('clean');
  expect(cleaned.cleanCoverage).toBeGreaterThan(.95);
  await page.clock.fastForward(2000);
  await page.clock.runFor(100);
  expect((await metrics(page)).contact?.tool).toBe('press');
  await page.clock.fastForward(12000);
  await page.clock.runFor(100);
  await expect(page.locator('.v036-try')).toBeEnabled();
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.locator('.v036-try').tap();
    await page.clock.runFor(100);
    expect((await metrics(page)).trialCount).toBe(attempt);
    await page.clock.fastForward(4600);
    await page.clock.runFor(100);
    expect(await metrics(page)).toMatchObject({missingSignature: true, originalCode: 'RET-031', evidenceCount: 0, walletTransactions: 0, archiveWrites: 0});
  }
  await page.locator('[data-control="pause"]').tap();
  await expect(page.locator('.v036-try')).toBeDisabled();
  await page.locator('.v036-try').dispatchEvent('click');
  expect((await metrics(page)).trialCount).toBe(2);
  await page.locator('[data-control="pause"]').tap();
  await expect(page.locator('.v036-try')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__v036StorageCalls)).toEqual([]);
});

test('正常游戏与返修版入口不加载V036样板或星雾素材', async ({page}) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(request.url()));
  await page.goto('/?start=base');
  await expect(page.locator('#museum-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.v036-app')).toHaveCount(0);
  await page.goto('/?sample=refinement');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.v036-app')).toHaveCount(0);
  expect(requested.filter(url => /v036-(fog|receipt|entry)|runtime\/v036\//.test(url))).toEqual([]);
});

test('素材未载完切换样板，已销毁远征不会重新启动绘制循环', async ({page}) => {
  await page.addInitScript(() => {
    const pending = new Set<number>();
    const request = requestAnimationFrame.bind(window);
    const cancel = cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = request(time => {pending.delete(id);callback(time);});
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => {pending.delete(id);cancel(id);};
    Object.assign(window, {__v036PendingFrames: () => pending.size});
  });
  await page.route('**/*.webp', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto('/?sample=art-v036');
  await page.locator('button[data-study="receipt"]').tap();
  await expect(page.locator('.v036-stage canvas')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => page.evaluate(() => (window as any).__v036PendingFrames())).toBe(1);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).__v036PendingFrames())).toBe(1);
});

test('星雾素材先失败时受控提示，仍可切换收据且无未处理异常', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*fog-body.webp*', async route => {
    if (route.request().resourceType() === 'image') await route.abort();
    else await route.continue();
  });
  await page.route('**/*robot-empty-v3.webp*', async route => {
    if (route.request().resourceType() === 'image') await new Promise(resolve => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/?sample=art-v036');
  await expect(page.locator('.v036-stage')).toContainText('请刷新');
  await expect(page.locator('.v036-status')).not.toContainText('正在接通');
  await page.locator('button[data-study="receipt"]').tap();
  await expect(page.locator('.v036-stage canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.v036-stage')).not.toHaveAttribute('data-error');
  expect(errors).toEqual([]);
});

test('收据素材载入前暂停，就绪时绘制静态首帧并保留暂停状态', async ({page}) => {
  let release!: () => void;
  const imagesHeld = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/*.webp*', async route => {
    if (route.request().resourceType() === 'image') await imagesHeld;
    await route.continue();
  });
  await page.goto('/?sample=art-v036&view=receipt', {waitUntil: 'domcontentloaded'});
  await page.locator('[data-control="pause"]').tap();
  expect((await metrics(page)).ready).toBe(false);
  release();
  await expect(page.locator('.v036-stage canvas')).toHaveAttribute('data-ready', 'true');
  const initial = await metrics(page);
  expect(initial.paused).toBe(true);
  expect(initial.elapsed).toBe(0);
  expect(initial.drawCount).toBeGreaterThan(0);
  expect(await page.locator('[role="status"]').innerText()).not.toContain('正在点灯');
  await page.waitForTimeout(100);
  expect((await metrics(page)).elapsed).toBe(0);
});
