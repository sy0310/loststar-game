import {expect, test} from '@playwright/test';

async function isolate(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('loststar.save.v1', 'V034-LEGACY-SAVE');
    localStorage.setItem('loststar.preferences.v1', 'V034-PREFERENCES');
    const calls: string[] = [];
    for (const key of ['getItem', 'setItem', 'removeItem', 'clear'] as const) {
      const original = Storage.prototype[key];
      (Storage.prototype as any)[key] = function (...args: any[]) {
        calls.push(key);
        return (original as any).apply(this, args);
      };
    }
    (window as any).__weekStorageCalls = calls;
  });
}

async function step(page: import('@playwright/test').Page, milliseconds: number) {
  await page.clock.fastForward(Math.max(0, milliseconds - 100));
  await page.clock.runFor(Math.min(100, milliseconds));
}

test('V034首周样板隔离、统一抽屉和原存档哨兵保持完整', async ({page}) => {
  await isolate(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?sample=week1');
  await expect(page.locator('#week1-app')).toBeVisible();
  await expect(page.locator('#week1-world canvas')).toHaveAttribute('data-ready', 'true');
  for (const name of ['security', 'research', 'repair']) {
    await page.locator(`[data-drawer="${name}"]`).click();
    await expect(page.locator('#week1-drawer')).toBeVisible();
    await page.locator('#week1-close').click();
    await expect(page.locator('#week1-drawer')).not.toBeVisible();
  }
  await page.locator('[data-week-tab="receipt"]').click();
  await expect(page.locator('#week1-paper')).toHaveAttribute('data-restoration-ready', 'true');
  await page.locator('[data-week-tab="life"]').click();
  await expect(page.locator('#week1-world canvas')).toHaveAttribute('data-period', 'day');
  expect(await page.evaluate(() => (window as any).__weekStorageCalls)).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('同一收据出土清洁修补只付一次，现场证据才能让缺失从2变1', async ({page}) => {
  await isolate(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/?sample=week1&view=receipt');
  await expect(page.locator('#week1-paper')).toHaveAttribute('data-restoration-ready', 'true');
  await page.clock.runFor(150);
  const original = await page.locator('#week1-paper').getAttribute('data-original-code');
  await page.locator('#week1-primary').click();
  await step(page, 4700);
  await expect(page.locator('#week1-primary')).toHaveAttribute('data-kind', 'clean');
  await page.locator('#week1-try').click();
  await step(page, 2600);
  await expect(page.locator('#week1-parts')).toHaveText('360');
  await page.locator('#week1-primary').click();
  await step(page, 3600);
  await expect(page.locator('#week1-parts')).toHaveText('320');
  await expect(page.locator('#week1-primary')).toHaveAttribute('data-kind', 'repair');
  await page.locator('#week1-primary').click();
  await step(page, 3800);
  await expect(page.locator('#week1-parts')).toHaveText('200');
  await expect(page.locator('#week1-missing')).toHaveAttribute('data-count', '2');
  await expect(page.locator('#week1-paper')).toHaveAttribute('data-original-code', original!);
  await page.locator('#week1-primary').click();
  await expect(page.locator('#week1-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(100);
  await step(page, 17000);
  await expect(page.locator('#week1-field-record')).toHaveAttribute('data-recorded', 'true');
  await page.locator('[data-week-tab="receipt"]').click();
  await expect(page.locator('#week1-primary')).toHaveAttribute('data-kind', 'identify');
  await page.locator('#week1-primary').click();
  await step(page, 2800);
  await expect(page.locator('#week1-missing')).toHaveAttribute('data-count', '1');
  await expect(page.locator('#week1-evidence-list')).toContainText('签收记录仍缺失');
  await expect(page.locator('#week1-parts')).toHaveText('200');
  expect(await page.evaluate(() => (window as any).__weekStorageCalls)).toEqual([]);
});

test('同球面事件配置改变实际损伤与晨间维修，画面账目同源', async ({page}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/?sample=week1');
  const canvas = page.locator('#week1-world canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.locator('#week1-replay').click();
  await step(page, 29000);
  await expect(page.locator('#week1-integrity')).toHaveAttribute('data-value', '94');
  await step(page, 6500);
  await expect(page.locator('#week1-repair-spent')).toHaveAttribute('data-value', '18');
  await expect(page.locator('#week1-integrity')).toHaveAttribute('data-value', '100');
  await page.locator('[data-drawer="security"]').click();
  await page.locator('[data-week-config="complete"]').click();
  await page.locator('#week1-close').click();
  await page.locator('#week1-replay').click();
  await step(page, 35000);
  await expect(page.locator('#week1-repair-spent')).toHaveAttribute('data-value', '0');
  await expect(page.locator('#week1-integrity')).toHaveAttribute('data-value', '100');
  await expect(page.locator('#week1-world-result')).toContainText('核验');
});

test('三居民有停下嗅纸、抖壳和落杆动作，减少动态仍保留生活状态', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/?sample=week1&view=life');
  const canvas = page.locator('#week1-world canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(100);
  const seen = {mouse: new Set<string>(), hermit: new Set<string>(), tagbird: new Set<string>()};
  for (let second = 0; second < 15; second++) {
    await step(page, 1000);
    for (const id of ['mouse', 'hermit', 'tagbird'] as const) {
      seen[id].add((await canvas.getAttribute(`data-resident-${id}`))!);
    }
  }
  expect(seen.mouse.has('sniffing') || seen.mouse.has('eating')).toBe(true);
  expect(seen.hermit.has('shaking')).toBe(true);
  expect(seen.tagbird.has('preening')).toBe(true);
  expect(seen.tagbird.has('flying')).toBe(true);
});

test('普通游戏保持既有入口、存档与资产加载边界', async ({page}) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/?start=base');
  await expect(page.locator('#museum-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#week1-app')).toHaveCount(0);
  expect(requests.filter(url => url.includes('/runtime/v034/') || url.includes('/review/v034'))).toEqual([]);
});
