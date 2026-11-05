import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const output = resolve('artifacts/v036');
const base = process.env.V036_URL ?? 'http://127.0.0.1:4216/';
const rehearse = process.argv.includes('--rehearse');
const packageInfo = JSON.parse(await readFile('releases/taptap/package-info-v036.json', 'utf8'));
await mkdir(`${output}/raw`, {recursive: true});
const report = {
  sourceCommit: packageInfo.sourceCommit,
  verificationCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  mode: rehearse ? 'control rehearsal' : 'native-speed desktop browser touch emulation',
  physicalPhone: false, clockOverrides: false, playerFixtures: false, cases: [],
};

async function installStorageWatch(page) {
  await page.addInitScript(() => {
    const calls = [];
    window.__reviewStorageCalls = calls;
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function(...args) {calls.push(method);return original.apply(this, args);};
    }
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(...args) {calls.push('indexedDB.open');return original.apply(this, args);};
  });
}

async function snapshot(page) {
  return page.evaluate(() => window.__V036__.metrics());
}

for (const [engine, width, height] of [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]]) {
  const browser = await ({chromium, webkit}[engine]).launch();
  for (const study of ['fog', 'receipt']) {
    const name = `${engine}-${width}-${study}`;
    const context = await browser.newContext({
      viewport: {width, height}, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      ...(!rehearse ? {recordVideo: {dir: `${output}/raw`, size: {width, height}}} : {}),
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
    await installStorageWatch(page);
    await page.goto(`${base}?view=${study}`);
    await page.waitForSelector('.v036-stage canvas[data-ready="true"]');
    await page.waitForFunction(() => window.__V036__.metrics().study.ready);
    const label = await page.locator('.v036-footer').innerText();
    if (!label.includes(packageInfo.sourceCommit.slice(0, 7))) throw new Error(`Wrong source package ${label}`);
    const controls = await page.locator('button').evaluateAll(buttons => buttons.map(button => ({text: button.textContent, disabled: button.disabled})));
    for (const selector of ['[data-control="pause"]', '[data-control="replay"]', 'button[data-study="fog"]', 'button[data-study="receipt"]']) {
      if (!await page.locator(selector).isVisible()) throw new Error(`Missing control ${selector}`);
    }
    if (rehearse) {
      await page.locator('[data-control="pause"]').tap();
      await page.locator('[data-control="pause"]').tap();
      await page.locator('[data-control="replay"]').tap();
      report.cases.push({name, controls, label, state: await snapshot(page), errors});
    } else {
      await page.locator('[data-control="replay"]').tap();
      const started = performance.now();
      const frames = [], phases = [], inputs = [];
      const targets = study === 'fog' ? [1, 7.5, 11.5, 15, 18] : [1, 3, 5.5, 7, 10.8, 14.5, 16.8, 18.9, 23, 26, 28];
      let next = 0, lastPhase = '', tapped = 0;
      const stopAt = study === 'fog' ? 21 : 35;
      while ((performance.now() - started) / 1000 < stopAt) {
        const state = await snapshot(page);
        const sample = state.study;
        const seconds = study === 'fog' ? sample.workElapsed / 1000 : sample.elapsed;
        if (sample.phase !== lastPhase) {phases.push({wallSeconds: (performance.now() - started) / 1000, seconds, phase: sample.phase});lastPhase = sample.phase;}
        if (next < targets.length && seconds >= targets[next]) {
          const file = `${name}-${String(next).padStart(2, '0')}-${sample.phase}.png`;
          await page.screenshot({path: `${output}/${file}`, scale: 'css'});
          frames.push({file, seconds, state});next++;
        }
        if (study === 'fog' && tapped < 2 && seconds > (tapped ? 7 : 2)) {
          const box = await page.locator('.v036-stage canvas').boundingBox();
          await page.touchscreen.tap(box.x + box.width * .72, box.y + box.height * .63);
          inputs.push({wallSeconds: (performance.now() - started) / 1000, state: await snapshot(page)});tapped++;
        }
        if (study === 'receipt' && seconds >= 28 && tapped === 0) {
          await page.locator('.v036-try').tap();tapped++;
          inputs.push({wallSeconds: (performance.now() - started) / 1000, state: await snapshot(page)});
        }
        await page.waitForTimeout(100);
      }
      const finalState = await snapshot(page);
      const storageCalls = await page.evaluate(() => window.__reviewStorageCalls);
      const video = page.video();
      await context.close();
      const raw = await video.path();
      const file = `${name}-live.mp4`;
      execFileSync('ffmpeg', ['-y', '-i', raw, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${output}/${file}`], {stdio: 'ignore'});
      const media = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', `${output}/${file}`], {encoding: 'utf8'}));
      report.cases.push({name, label, controls, viewport: {width, height}, frames, phases, inputs, finalState,
        errors, storageCalls, video: {file, bytes: (await stat(`${output}/${file}`)).size, seconds: Number(media.format.duration), fps: media.streams[0].avg_frame_rate}});
      if (errors.length || storageCalls.length) throw new Error(`${name} validation failed`);
      console.log(`${name} recorded`);
    }
    await context.close();
  }
  await browser.close();
}
await writeFile(`${output}/${rehearse ? 'rehearsal' : 'evidence'}.json`, JSON.stringify(report, null, 2) + '\n');
if (!rehearse) await import('./finalize_v036_evidence.mjs');
console.log(JSON.stringify({mode: report.mode, cases: report.cases.length}));
