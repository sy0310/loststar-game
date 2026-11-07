import {mkdirSync, unlinkSync} from 'node:fs';
import {reviewFixture} from '../releases/refinement-fixtures/refinement_fixtures.js';

export const reviewDatabase = 'loststar.fusion.review.v035';
export const oldDatabase = 'loststar.fusion.v1';
export async function readArchive(page, name = reviewDatabase) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(String(request.error));
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result); db.close();};
      get.onerror = () => {db.close(); reject(String(get.error));};
    };
  }), name);
}
export async function writeArchive(page, value, name = reviewDatabase) {
  return page.evaluate(({value, name}) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archive');
    request.onerror = () => reject(String(request.error));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('archive', 'readwrite');
      transaction.objectStore('archive').put(value, 'current');
      transaction.oncomplete = () => {db.close(); resolve();};
      transaction.onerror = () => {db.close(); reject(String(transaction.error));};
    };
  }), {value, name});
}
export async function openReview(browser, base, options = {}) {
  const {output = 'artifacts/refinement', fixture, levels = [2, 2], width = 390, record = false, reducedMotion = 'no-preference', legacy = false} = options;
  if (record) mkdirSync(`${output}/raw`, {recursive:true});
  const context = await browser.newContext({viewport:{width, height:width === 360 ? 800 : 844}, deviceScaleFactor:2,
    isMobile:true, hasTouch:true, reducedMotion,
    ...(record ? {recordVideo:{dir:`${output}/raw`, size:{width,height:width === 360 ? 800 : 844}}} : {})});
  if (fixture || options.initialState) {
    const seed = await context.newPage();
    await seed.route('**/*', route => route.request().resourceType() === 'script' ? route.abort() : route.continue());
    await seed.goto(base, {waitUntil:'domcontentloaded'});
    const value = options.initialState ?? reviewFixture(fixture, Date.now(), ...levels);
    if (legacy) {
      const {progression, ...old} = value;
      await writeArchive(seed, old, oldDatabase);
      await seed.evaluate(value => localStorage.setItem('loststar.save.v1', JSON.stringify(value)), old.game);
    } else await writeArchive(seed, value);
    const unused = record ? await seed.video().path() : null;
    await seed.close();
    if (unused) try {unlinkSync(unused);} catch {}
  }
  const page = await context.newPage();
  if (options.startTime !== undefined) {
    await page.clock.install({time:new Date(options.startTime)});
    await page.clock.pauseAt(new Date(options.startTime));
  }
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
  await page.goto(base);
  await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
  await page.waitForFunction(() => Boolean(window.__FUSION__));
  const actualDatabase = await page.evaluate(() => window.__FUSION__.databaseName);
  if (actualDatabase !== reviewDatabase) throw Error(`Wrong archive ${actualDatabase}`);
  return {context, page, errors};
}
export async function click(page, selector) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await element.tap();
  await page.waitForTimeout(180);
}
export async function terrainTap(page) {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector('#fusion-world canvas');
    const box = canvas.getBoundingClientRect();
    for (const [px, py] of [[416,610],[460,600],[380,600],[420,570],[488,507]]) {
      const x = box.x + box.width * px / 832;
      const y = box.y + box.height * py / 740;
      const hit = window.__FUSION__.pickAtClient(x, y);
      if (hit.kind === 'planet' && hit.id !== 'sorting') return {x, y};
    }
    throw Error('No unoccupied visible terrain');
  });
  await page.touchscreen.tap(point.x, point.y);
  return point;
}
