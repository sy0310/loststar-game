import {expect, test, type Page} from '@playwright/test';
import {newGame} from '../../src/game/engine';
import {discoveries} from '../../src/content/catalog';

test.use({isMobile: true, hasTouch: true});
const epoch = 1800000000000;
async function saved(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('loststar.fusion.v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction('archive', 'readonly').objectStore('archive').get('current');
      read.onsuccess = () => {database.close();resolve(read.result);};
      read.onerror = () => {database.close();reject(read.error);};
    };
  }));
}
async function open(page: Page, legacy = false) {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  if (legacy) {
    const game = newGame(epoch + 1000);
    game.resources = 27049;
    game.collection = discoveries.map(item => item.id);
    game.seenDiscoveries = [...game.collection];
    await page.addInitScript(raw => {
      if (!localStorage.getItem('loststar.save.v1')) localStorage.setItem('loststar.save.v1', raw);
    }, JSON.stringify(game));
  }
  await page.goto('/?sample=fusion');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
}
async function pointFor(page: Page, kind: 'planet' | 'robot' | 'resident') {
  return page.evaluate(kind => {
    const canvas = document.querySelector<HTMLCanvasElement>('#fusion-world canvas')!;
    const bounds = canvas.getBoundingClientRect();
    const pick = (window as any).__FUSION__.pickAtClient;
    const scale = Math.min(bounds.width / canvas.width, bounds.height / canvas.height);
    const left = bounds.left + (bounds.width - canvas.width * scale) / 2;
    const top = bounds.top + (bounds.height - canvas.height * scale) / 2;
    // Search rendered alpha targets, keeping terrain below the actor region.
    for (let y = kind === 'planet' ? 500 : 160; y < (kind === 'planet' ? 590 : 520); y += 4) {
      for (let x = kind === 'planet' ? 430 : 100; x < (kind === 'planet' ? 520 : 720); x += 4) {
        const client = {x: left + x * scale, y: top + y * scale};
        const target = pick(client.x, client.y);
        const inside = [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]].every(([dx, dy]) => {const adjacent = pick(client.x + dx, client.y + dy);return adjacent.kind === kind && adjacent.id === target.id;});
        if (target.kind === kind && inside) return {...client, id: target.id};
      }
    }
    throw new Error(`实际绘制中缺少${kind}命中区域`);
  }, kind);
}
async function pointer(page: Page, type: string, point: {x: number; y: number}, id = 81, primary = true, target = '#fusion-tap') {
  await page.locator(target).dispatchEvent(type, {pointerId: id, pointerType: 'touch', isPrimary: primary,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: point.x, clientY: point.y});
}

test('手势拒绝长按双指和滚动，有效原生轻点与键盘各接受一次', async ({page}) => {
  await open(page);
  const terrain = await pointFor(page, 'planet');
  await pointer(page, 'pointerdown', terrain);
  await page.clock.runFor(700);
  await pointer(page, 'pointerup', terrain);
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(0);

  await pointer(page, 'pointerdown', terrain);
  await pointer(page, 'pointerdown', {x: 20, y: 20}, 82, false, '#fusion-parts');
  await pointer(page, 'pointerup', terrain);
  await pointer(page, 'pointerup', {x: 20, y: 20}, 82, false, '#fusion-parts');
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(0);

  await pointer(page, 'pointerdown', terrain);
  await page.locator('#fusion-scroll').dispatchEvent('scroll');
  await pointer(page, 'pointerup', terrain);
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(0);

  await page.touchscreen.tap(terrain.x, terrain.y);
  await expect.poll(async () => ((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(1);
  await page.locator('#fusion-tap').dispatchEvent('click');
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(1);

  await page.clock.runFor(400);
  await page.locator('#fusion-tap').focus();
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect.poll(async () => ((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(2);
});

test('实际机器人与居民命中分别打开设备和详情，场景外点击保持零助力', async ({page}) => {
  await open(page, true);
  const robot = await pointFor(page, 'robot');
  await page.touchscreen.tap(robot.x, robot.y);
  await expect(page.locator('#fusion-drawer')).toBeVisible();
  await expect(page.locator('#fusion-drawer-title')).toHaveText('设备升级');
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(0);
  await page.locator('[data-upgrade="scanner"]').dispatchEvent('click', {clientX: robot.x, clientY: robot.y, detail: 1});
  expect((await saved(page)).game.upgrades.scanner).toBe(0);
  await page.locator('#fusion-close').tap();
  await page.clock.runFor(100);
  const resident = await pointFor(page, 'resident');
  await page.touchscreen.tap(resident.x, resident.y);
  await expect(page.locator('#fusion-drawer-title')).toHaveText(discoveries.find(item => item.id === resident.id)!.name);
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(0);
  await page.locator('#fusion-close').tap();
  await page.clock.runFor(100);
  const canvas = await page.locator('#fusion-world canvas').boundingBox();
  await page.touchscreen.tap(canvas!.x + 2, canvas!.y + 2);
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(0);
});

test('调查面板打开安排刷新取消保持可操作，页面和控制台均无错误', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await open(page, true);
  await page.locator('[data-tab="base"]').tap();
  await page.locator('[data-drawer="research"]').tap();
  await page.locator('button[data-task="marker"]').tap();
  await expect.poll(async () => (await saved(page)).task?.target).toBe('marker');
  await page.clock.runFor(1500);
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
  await page.locator('[data-tab="base"]').tap();
  await page.locator('[data-drawer="research"]').tap();
  await expect(page.locator('button[data-cancel-task]')).toBeVisible();
  await page.locator('button[data-cancel-task]').tap();
  await expect.poll(async () => (await saved(page)).task).toBeNull();
  await page.locator('button[data-task="residents"]').tap();
  await expect.poll(async () => (await saved(page)).task?.target).toBe('residents');
  await page.clock.runFor(500);
  expect(errors).toEqual([]);
});

test('夜间点选星球和机器人只聚焦实景，守护助力账目保持一致', async ({page}) => {
  await open(page, true);
  await page.clock.fastForward(241000);
  await page.clock.runFor(300);
  await expect(page.locator('#fusion-period')).toHaveText('夜间');
  await page.clock.runFor(100);
  const before = (await saved(page)).game.assist;
  const terrain = await pointFor(page, 'planet');
  await page.touchscreen.tap(terrain.x, terrain.y);
  await expect(page.locator('#fusion-pick-reticle')).toBeVisible();
  await expect(page.locator('#fusion-inspection-panel')).toBeVisible();
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  const robot = await pointFor(page, 'robot');
  await page.touchscreen.tap(robot.x, robot.y);
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  expect((await saved(page)).game.assist).toEqual(before);
});
