import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';

const metadata = JSON.parse(await readFile('releases/taptap/package-info-v036.json', 'utf8'));
const base = process.env.V036_PACKAGE_URL ?? 'http://127.0.0.1:4218/loststar-v036/index.html';
const cases = [];
for (const [engine, width, height] of [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]]) {
  const browser = await ({chromium, webkit}[engine]).launch();
  const context = await browser.newContext({viewport: {width, height}, hasTouch: true, isMobile: true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(() => {
    const sentinel = 'existing-27049-parts-and-purchased-rights-must-not-be-read';
    localStorage.setItem('loststar.save.v1', sentinel);
    const originalRead = Storage.prototype.getItem.bind(localStorage);
    const calls = [];
    window.__packageProbe = {calls, originalRead, sentinel};
    for (const name of ['getItem', 'setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[name];
      Storage.prototype[name] = function(...args) {calls.push(name);return original.apply(this, args);};
    }
    const originalOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(...args) {calls.push('indexedDB.open');return originalOpen.apply(this, args);};
  });
  await page.goto(base);
  for (const study of ['fog', 'receipt']) {
    await page.locator(`button[data-study="${study}"]`).tap();
    await page.waitForFunction(() => window.__V036__.metrics().study.ready);
    const label = await page.locator('.v036-footer').innerText();
    if (!label.includes(metadata.sourceCommit.slice(0, 7))) throw new Error('Incorrect packaged source');
    await page.locator('[data-control="pause"]').tap();
    const before = await page.evaluate(() => window.__V036__.metrics().study.elapsed);
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => window.__V036__.metrics().study.elapsed);
    if (before !== after) throw new Error(`${engine}/${study} failed to pause`);
    const probe = await page.evaluate(() => ({calls: window.__packageProbe.calls,
      originalUnchanged: window.__packageProbe.originalRead('loststar.save.v1') === window.__packageProbe.sentinel,
      noOverflow: document.documentElement.scrollWidth <= innerWidth}));
    if (probe.calls.length || !probe.originalUnchanged || !probe.noOverflow || errors.length) throw new Error(`${engine}/${study} failed package smoke`);
    cases.push({engine, study, viewport: {width, height}, build: label, ...probe, errors: [...errors]});
  }
  await page.reload();
  await page.waitForSelector('canvas[data-ready="true"]');
  await browser.close();
}
await mkdir('artifacts/v036', {recursive: true});
await writeFile('artifacts/v036/package-smoke.json', JSON.stringify({sourceCommit: metadata.sourceCommit, base, physicalPhone: false, cases}, null, 2) + '\n');
console.log(`${cases.length} nested-package smoke cases passed`);
