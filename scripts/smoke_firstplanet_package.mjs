import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
const metadata = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
const base = process.env.FIRSTPLANET_PACKAGE_URL ?? 'http://127.0.0.1:4218/loststar-fusion/index.html';
const database = 'loststar.fusion.firstplanet.v037';
const cases = [];
for (const [engine, width, height] of [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]]) {
  const browser = await ({chromium, webkit}[engine]).launch();
  const context = await browser.newContext({viewport: {width, height}, hasTouch: true, isMobile: true});
  const page = await context.newPage();const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(() => {
    if (!localStorage.getItem('loststar.save.v1')) localStorage.setItem('loststar.save.v1', '{old-source-27049-preserve-exactly');
  });
  const read = () => page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result);db.close();};get.onerror = () => {reject(get.error);db.close();};
    };
  }), database);
  await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
  let current = await read();
  if (current.game.resources !== 120 || current.game.collection.length) throw new Error('Package did not begin fresh');
  const build = await page.locator('.fu-build').innerText();
  if (!build.includes(metadata.sourceCommit.slice(0, 7)) || build.includes('dirty')) throw new Error(`Unexpected package build ${build}`);
  await page.locator('#fusion-dismiss-intro').tap();await page.locator('#fusion-upgrades').tap();
  await page.locator('[data-upgrade="scanner"]').tap();
  for (let attempt = 0; attempt < 30; attempt++) {current = await read();if (current.game.upgrades.scanner === 1) break;await page.waitForTimeout(50);}
  if (current.game.resources !== 75 || current.game.upgrades.scanner !== 1) throw new Error('Actual upgrade failed');
  await page.locator('#fusion-close').tap();
  const snapshot = {seed: current.journey.seed, sites: current.journey.sites.map(({id, anchor, variant}) => ({id, anchor, variant}))};
  cases.push({engine, viewport: {width, height}, phase: 'new-campaign-and-paid-upgrade', build, playerParts: current.game.resources});
  await page.reload();await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();current = await read();
  const after = {seed: current.journey.seed, sites: current.journey.sites.map(({id, anchor, variant}) => ({id, anchor, variant}))};
  const sourceUnchanged = await page.evaluate(() => localStorage.getItem('loststar.save.v1') === '{old-source-27049-preserve-exactly');
  const a11y = await page.locator('body').ariaSnapshot();
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  if (JSON.stringify(snapshot) !== JSON.stringify(after) || current.game.upgrades.scanner !== 1 || !sourceUnchanged || !noOverflow || /回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星/.test(a11y) || errors.length) throw new Error('Packaged reload or source preservation failed');
  cases.push({engine, viewport: {width, height}, phase: 'reload-continuation', build, sourceUnchanged, noOverflow, stableJourney: true, errors});
  await browser.close();
}
await writeFile('artifacts/first-planet/package-smoke.json', JSON.stringify({sourceCommit: metadata.sourceCommit, base, physicalPhone: false, cases}, null, 2) + '\n');
console.log(`${cases.length} packaged nested-entry cases passed`);
