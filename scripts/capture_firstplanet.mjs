import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';

const output = resolve('artifacts/first-planet');
const base = process.env.FIRSTPLANET_URL ?? 'http://127.0.0.1:4221/';
const mode = process.argv[2] ?? 'screens';
await mkdir(`${output}/raw`, {recursive: true});
await mkdir(`${output}/screens`, {recursive: true});
const packageInfo = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
const report = {sourceCommit: packageInfo.sourceCommit, mode, physicalPhone: false,
  touchEmulation: true, clockOverrides: false, cases: []};
const databaseName = 'loststar.fusion.firstplanet.v037';

async function state(page) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result);database.close();};
      get.onerror = () => {reject(get.error);database.close();};
    };
  }), databaseName);
}
async function install(page, save) {
  await page.evaluate(({name, save}) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('archive', 'readwrite');
      transaction.objectStore('archive').put(save, 'current');
      transaction.oncomplete = () => {database.close();resolve();};
      transaction.onerror = () => {reject(transaction.error);database.close();};
    };
  }), {name: databaseName, save});
  await page.reload();
  await ready(page);
}
async function ready(page) {
  await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
}
async function waitState(page, predicate, maximumMs = 15000) {
  const start = performance.now();
  while (performance.now() - start < maximumMs) {
    const current = await state(page);
    if (predicate(current)) return current;
    await page.waitForTimeout(150);
  }
  throw new Error(`Saved-state condition timed out after ${maximumMs}ms`);
}
async function shot(page, name) {
  await page.screenshot({path: `${output}/screens/${name}.png`, scale: 'css'});
}
async function dismissIntro(page) {
  if (await page.locator('#fusion-journey-intro').isVisible()) await page.locator('#fusion-dismiss-intro').tap();
}
async function finishVideo(context, page, name) {
  const video = page.video();await context.close();
  const source = await video.path();
  execFileSync('ffmpeg', ['-y', '-i', source, '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}/${name}.mp4`], {stdio: 'ignore'});
  return `${name}.mp4`;
}
async function open(browser, width = 390, height = 844, video = false) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, ...(video ? {recordVideo: {dir: `${output}/raw`, size: {width, height}}} : {})});
  const page = await context.newPage();const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
  await page.goto(base);await ready(page);
  return {context, page, errors};
}

if (mode === 'fresh') {
  const browser = await chromium.launch();
  const {context, page, errors} = await open(browser, 390, 844, true);
  const start = performance.now();
  const milestones = [{seconds: 0, state: await state(page)}];
  await shot(page, 'fresh-390');await dismissIntro(page);
  await page.locator('#fusion-tap').tap();await page.waitForTimeout(800);
  await shot(page, 'tap-feedback-390');
  await waitState(page, save => save.game.collection.includes('receipt'), 18000);
  await shot(page, 'first-found-390');
  await page.locator('#fusion-found').tap();
  await page.locator('#fusion-paper-primary').tap();
  await waitState(page, save => save.receipt.activeAction?.kind === 'excavate');
  await page.waitForTimeout(3100);await shot(page, 'receipt-excavating-390');
  await waitState(page, save => !save.receipt.activeAction);
  await shot(page, 'receipt-dirty-390');
  await page.locator('#fusion-paper-primary').tap();
  await waitState(page, save => save.receipt.activeAction?.kind === 'clean');
  await page.waitForTimeout(1800);await shot(page, 'receipt-brushing-390');
  await waitState(page, save => !save.receipt.activeAction);
  await shot(page, 'receipt-clean-390');
  await page.locator('#fusion-close').tap();
  await waitState(page, save => save.game.resources >= 120, 65000);
  await page.locator('[data-tab="collection"]').tap();
  await page.locator('#fusion-collection-list [data-detail="receipt"]').tap();
  await page.locator('#fusion-paper-primary').tap();
  await waitState(page, save => save.receipt.activeAction?.kind === 'repair');
  await page.waitForTimeout(1900);await shot(page, 'receipt-repairing-390');
  await waitState(page, save => !save.receipt.activeAction);
  await shot(page, 'receipt-stabilized-390');
  await page.locator('#fusion-try').tap();await page.waitForTimeout(1000);
  await shot(page, 'receipt-try-390');await page.waitForTimeout(1800);
  await page.locator('#fusion-close').tap();
  await page.locator('[data-tab="base"]').tap();await page.waitForTimeout(2500);
  await shot(page, 'fresh-base-390');
  await page.locator('[data-tab="explore"]').tap();
  await page.waitForTimeout(Math.max(0, 90000 - (performance.now() - start)));
  milestones.push({seconds: (performance.now() - start) / 1000, state: await state(page)});
  const video = await finishVideo(context, page, 'fresh-exploration-restoration-90s');
  report.cases.push({name: 'fresh', playerFixture: false, errors, milestones, video});
  await browser.close();
} else if (mode === 'cycle') {
  const browser = await chromium.launch();
  const {context, page, errors} = await open(browser, 390, 844, true);
  await dismissIntro(page);const start = performance.now();
  const phases = [], milestones = [];
  let previous = '', next = 0;
  const targets = [1, 15, 35, 230, 236, 246, 254, 268, 286, 296, 303, 307];
  while (performance.now() - start < 310000) {
    const current = await state(page);
    const phase = await page.locator('#fusion-period').innerText();
    const seconds = (performance.now() - start) / 1000;
    if (phase !== previous) {phases.push({seconds, phase, worldMs: current.game.world.elapsedMs});previous = phase;}
    if (next < targets.length && seconds >= targets[next]) {
      await shot(page, `cycle-${String(targets[next]).padStart(3, '0')}-390`);
      milestones.push({seconds, state: current});next++;
    }
    await page.waitForTimeout(220);
  }
  await page.locator('[data-tab="base"]').tap();
  await page.locator('[data-drawer="station"]').tap();
  await page.waitForTimeout(400);await shot(page, 'maintenance-390');
  const finalState = await state(page);
  const video = await finishVideo(context, page, 'full-day-night-310s');
  report.cases.push({name: 'cycle', playerFixture: false, phases, milestones, finalState, errors, video});
  await browser.close();
} else {
  for (const [engine, width, height] of [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]]) {
    const browser = await ({chromium, webkit}[engine]).launch();
    const {context, page, errors} = await open(browser, width, height, width === 390 && engine === 'chromium');
    const label = `${engine}-${width}`;
    await shot(page, `${label}-initial`);
    const fixture = firstPlanetFixture(Date.now(), 3);
    await install(page, fixture.state);await dismissIntro(page);
    await shot(page, `${label}-explore`);
    await page.locator('#fusion-map').tap();await page.waitForTimeout(300);
    await shot(page, `${label}-radar`);await page.locator('#fusion-close').tap();
    await page.locator('[data-tab="collection"]').tap();await page.waitForTimeout(500);
    await shot(page, `${label}-collection`);
    for (const id of ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']) {
      await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
      await page.waitForTimeout(1500);
      await shot(page, `${label}-detail-${id}`);
      await page.locator('#fusion-try').tap();await page.waitForTimeout(900);
      await shot(page, `${label}-try-${id}`);await page.waitForTimeout(1900);
      await page.locator('#fusion-close').tap();
    }
    await page.locator('[data-tab="base"]').tap();await page.waitForTimeout(1500);
    await shot(page, `${label}-base`);await page.waitForTimeout(10000);
    await page.locator('[data-drawer="upgrades"]').tap();await page.waitForTimeout(300);
    await shot(page, `${label}-workshop`);await page.locator('#fusion-close').tap();
    const landscapeSafe = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    let video;
    if (width === 390 && engine === 'chromium') video = await finishVideo(context, page, 'six-curios-base-interactions');
    else await context.close();
    report.cases.push({name: label, playerFixture: true, fixtureAudit: fixture.audit, landscapeSafe, errors, video});
    if (width === 390 && engine === 'chromium') {
      for (let level = 0; level <= 3; level++) {
        const cabinet = await open(browser, width, height);
        const paid = firstPlanetFixture(Date.now(), level);
        await install(cabinet.page, paid.state);await dismissIntro(cabinet.page);
        await cabinet.page.locator('[data-tab="base"]').tap();await cabinet.page.waitForTimeout(1400);
        await shot(cabinet.page, `cabinet-level-${level}-390`);
        report.cases.push({name: `cabinet-${level}`, playerFixture: true, fixtureAudit: paid.audit, errors: cabinet.errors});
        await cabinet.context.close();
      }
    }
    await browser.close();
  }
}
await writeFile(`${output}/${mode}-evidence.json`, JSON.stringify(report, null, 2) + '\n');
if (report.cases.some(entry => entry.errors.length || entry.landscapeSafe === false)) throw new Error('Capture had resource, runtime or overflow errors');
console.log(JSON.stringify({mode, cases: report.cases.length, sourceCommit: report.sourceCommit}));
