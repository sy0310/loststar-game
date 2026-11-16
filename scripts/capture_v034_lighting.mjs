import {chromium} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const output = process.env.OUTPUT_DIR ?? 'artifacts/v034-refine';
const sourceCommit = execFileSync('git', ['rev-parse', process.env.RUNTIME_COMMIT ?? 'HEAD'], {encoding: 'utf8'}).trim();
await mkdir(output, {recursive: true});
const browser = await chromium.launch();
const results = [];
const errors = [];
for (const seconds of [4, 12]) {
  const pair = [];
  for (const light of ['day', 'night']) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
    await page.addInitScript(() => {
      window.__lightingStorage = [];
      for (const key of ['getItem', 'setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[key];
        Storage.prototype[key] = function (...args) {window.__lightingStorage.push(key); return original.apply(this, args);};
      }
    });
    await page.goto(`${base}/tests/fixtures/v034-lighting.html?preset=basic&seconds=${seconds}&light=${light}`);
    await page.locator('html[data-lighting-ready=true]').waitFor({timeout: 45000});
    const build = await page.locator('html').getAttribute('data-build');
    if (!build.includes(sourceCommit.slice(0, 7)) || build.includes('本地修改')) throw Error(`Unexpected fixture build ${build}`);
    const data = await page.locator('#light-world canvas').evaluate(canvas => ({...canvas.dataset}));
    const corners = await page.locator('#light-world canvas').evaluate(canvas => {
      const context = canvas.getContext('2d');
      return [[0, 0], [12, 12], [820, 12], [831, 0], [0, 739], [12, 728], [820, 728], [831, 739]]
        .map(([x, y]) => ({x, y, rgba: [...context.getImageData(x, y, 1, 1).data]}));
    });
    const storage = await page.evaluate(() => window.__lightingStorage);
    if (storage.length) throw Error('Fixture accessed Storage');
    const file = `lighting-basic-${seconds}-${light}-390.png`;
    await page.screenshot({path: `${output}/${file}`, scale: 'css'});
    pair.push({light, build, file, data, corners, storage});
    await context.close();
  }
  for (const key of ['ship', 'auditShipX', 'auditShipY', 'auditRobotX', 'auditRobotY', 'auditCamera', 'v034Phase', 'v034Seconds', 'v034Integrity']) {
    if (pair[0].data[key] === undefined || pair[0].data[key] !== pair[1].data[key]) throw Error(`Lighting changed spatial state ${key}`);
  }
  if (JSON.stringify(pair[0].corners) !== JSON.stringify(pair[1].corners)) throw Error('Local lighting changed sky corners');
  results.push({seconds, pair});
}
await browser.close();
if (errors.length) throw Error(errors.join('\n'));
await writeFile(`${output}/lighting-comparison.json`, JSON.stringify({sourceCommit,
  method: 'Controlled renderer time, same event posture and camera, only environment.light changes. Separate from real wall-clock recordings.',
  viewport: {width: 390, height: 844}, results, errors}, null, 2) + '\n');
console.log(`Captured ${results.length} matched day/night lighting pairs`);
