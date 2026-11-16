import {openABaseFacility, openACloseup} from './a-navigation';
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
    // Use a whole interior square at integer CSS coordinates. A cross-shaped
    // check can still select a diagonal alpha gap or a narrow antenna pixel.
    const firstX = Math.ceil(left + (kind === 'planet' ? 430 : 100) * scale);
    const lastX = Math.floor(left + (kind === 'planet' ? 520 : 720) * scale);
    const firstY = Math.ceil(top + (kind === 'planet' ? 500 : 160) * scale);
    const lastY = Math.floor(top + (kind === 'planet' ? 590 : 520) * scale);
    const width = lastX - firstX + 1;
    const height = lastY - firstY + 1;
    const stride = width + 2;
    const distance = new Uint16Array(stride * (height + 2));
    for (let y = 1; y <= height; y++) for (let x = 1; x <= width; x++) {
      if (pick(firstX + x - 1, firstY + y - 1).kind === kind) distance[y * stride + x] = 65535;
    }
    for (let y = 1; y <= height; y++) for (let x = 1; x <= width; x++) {
      const index = y * stride + x;
      if (distance[index]) distance[index] = 1 + Math.min(distance[index - 1], distance[index - stride - 1], distance[index - stride], distance[index - stride + 1]);
    }
    let best = {x: 0, y: 0, clearance: 0};
    for (let y = height; y >= 1; y--) for (let x = width; x >= 1; x--) {
      const index = y * stride + x;
      if (!distance[index]) continue;
      distance[index] = Math.min(distance[index], 1 + Math.min(distance[index + 1], distance[index + stride - 1], distance[index + stride], distance[index + stride + 1]));
      if (distance[index] > best.clearance) best = {x: firstX + x - 1, y: firstY + y - 1, clearance: distance[index]};
    }
    if (best.clearance < 3) throw new Error(`实际绘制中的${kind}缺少可轻点的内部区域`);
    return {...best, id: pick(best.x, best.y).id, canvasBounds: {left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height}, scale};
  }, kind);
}
async function auditedTouch(page: Page, point: {x: number; y: number; clearance: number}, label: string) {
  await page.evaluate(() => {
    const audit = window as any;
    audit.__fusionPointerAudit = [];
    if (audit.__fusionPointerAuditInstalled) return;
    audit.__fusionPointerAuditInstalled = true;
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(type, event => {
      const pointer = event as PointerEvent;
      audit.__fusionPointerAudit.push({type, x: pointer.clientX, y: pointer.clientY, pointerId: pointer.pointerId,
        primary: pointer.isPrimary, detail: pointer.detail, at: performance.now(), target: (event.target as Element)?.id,
        scroll: document.querySelector('#fusion-scroll')?.scrollTop,
        hit: audit.__FUSION__.pickAtClient(pointer.clientX, pointer.clientY)});
    }, {capture: true, passive: true});
  });
  await page.touchscreen.tap(point.x, point.y);
  const observed = await page.evaluate(() => ({events: (window as any).__fusionPointerAudit,
    dialogOpen: document.querySelector<HTMLDialogElement>('#fusion-drawer')!.open,
    dialogTitle: document.querySelector('#fusion-drawer-title')?.textContent}));
  await test.info().attach(`${label}-native-touch.json`, {body: JSON.stringify({point, ...observed}, null, 2), contentType: 'application/json'});
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

test('实际机器人与居民命中按A方案协助探索，管理入口收拢且场景外点击零助力', async ({page}) => {
  await open(page, true);
  const robot = await pointFor(page, 'robot');
  await auditedTouch(page, robot, 'robot');
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  await expect.poll(async () => ((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(1);
  // Retarget a compatibility click in the same frame as the actual scene
  // touch. Real navigation taps would advance beyond its 700ms guard window.
  await page.evaluate(robot => {
    document.querySelector<HTMLButtonElement>('.fu-nav [data-tab="base"]')!.click();
    document.querySelector<HTMLButtonElement>('.fu-base-grow')!.click();
    document.querySelector('[data-upgrade="scanner"]')!.dispatchEvent(new MouseEvent('click',
      {bubbles: true, clientX: robot.x, clientY: robot.y, detail: 1}));
  }, robot);
  await expect(page.locator('#fusion-drawer-title')).toHaveText('让探索轻松一点');
  expect((await saved(page)).game.upgrades.scanner).toBe(0);
  await page.locator('#fusion-close').tap();
  await page.locator('#fusion-app > .fu-nav [data-tab="explore"]').tap();
  await page.clock.runFor(400);
  const resident = await pointFor(page, 'resident');
  await auditedTouch(page, resident, 'resident');
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  await expect.poll(async () => ((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(2);
  await page.clock.runFor(100);
  const canvas = await page.locator('#fusion-world canvas').boundingBox();
  await page.touchscreen.tap(canvas!.x + 2, canvas!.y + 2);
  expect(((await saved(page)).game.assist?.actionSeq ?? 0)).toBe(2);
});

test('调查面板打开安排刷新取消保持可操作，页面和控制台均无错误', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await open(page, true);
  await page.locator('#fusion-app > .fu-nav [data-tab="base"]').tap();
  await openABaseFacility(page,'research','tap');
  await page.locator('button[data-task="marker"]').tap();
  await expect.poll(async () => (await saved(page)).task?.target).toBe('marker');
  await page.clock.runFor(1500);
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
  await page.locator('#fusion-app > .fu-nav [data-tab="base"]').tap();
  await openABaseFacility(page,'research','tap');
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
  await openACloseup(page,'tap');await expect(page.locator('#fusion-inspection-panel')).toBeVisible();
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  const robot = await pointFor(page, 'robot');
  await page.touchscreen.tap(robot.x, robot.y);
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  expect((await saved(page)).game.assist).toEqual(before);
});
