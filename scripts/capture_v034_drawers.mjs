import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';

const sourceCommit = execFileSync('git', ['rev-parse', process.env.RUNTIME_COMMIT ?? 'HEAD'], {encoding: 'utf8'}).trim();
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4197';
const output = process.env.OUTPUT_DIR ?? 'artifacts/v034-refine';
const results = [];
const errors = [];

for (const width of [360, 390]) {
  const browser = await chromium.launch();
  const viewport = {width, height: width === 360 ? 800 : 844};
  const context = await browser.newContext({viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(() => {
    const calls = [];
    for (const key of ['getItem', 'setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[key];
      Storage.prototype[key] = function (...args) {calls.push(key); return original.apply(this, args);};
    }
    window.__drawerStorageCalls = calls;
  });
  await page.goto(`${base}/?sample=week1`, {waitUntil: 'domcontentloaded'});
  await page.locator('#week1-world canvas[data-ready=true]').waitFor({timeout: 45000});
  const build = await page.locator('html').getAttribute('data-build');
  if (!build.includes(sourceCommit.slice(0, 7)) || build.includes('本地修改')) throw Error(`Unexpected build ${build}`);
  for (const kind of ['security', 'research', 'repair']) {
    await page.locator(`[data-drawer="${kind}"]`).tap();
    await page.locator('#week1-drawer').waitFor({state: 'visible'});
    // Native touch highlights fade after pointerup. Capture the settled panel.
    await page.waitForTimeout(500);
    const file = `drawer-${kind}-${width}.png`;
    await page.screenshot({path: `${output}/${file}`, scale: 'css'});
    results.push({viewport, build, kind, file, input: 'native touch', settlingMs: 500, at: new Date().toISOString()});
    await page.locator('#week1-close').tap();
    await page.waitForTimeout(300);
  }
  const calls = await page.evaluate(() => window.__drawerStorageCalls);
  if (calls.length) throw Error('Drawers accessed Storage');
  await context.close();
  await browser.close();
}

if (errors.length) throw Error(errors.join('\n'));
await writeFile(`${output}/drawer-capture.json`, JSON.stringify({sourceCommit, method: 'Same production package, fresh isolated contexts, settled native-touch panel screenshots', results, storageCalls: [], errors}, null, 2) + '\n');
console.log(`Captured ${results.length} settled drawer screenshots`);
