import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';

const base = process.env.V036_URL ?? 'http://127.0.0.1:4216/';
const source = JSON.parse(await readFile('releases/taptap/package-info-v036.json', 'utf8'));
const percentile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null;
};
const summarize = values => ({samples: values.length, medianMs: percentile(values, .5), p95Ms: percentile(values, .95), over100ms: values.filter(value => value > 100).length});
const report = {
  sourceCommit: source.sourceCommit,
  verificationCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  machine: {platform: os.platform(), architecture: os.arch(), cpu: os.cpus()[0].model},
  method: {viewport: {width: 390, height: 844}, dpr: 2, warmupMs: 1000, sampleMs: 10000,
    recording: false, concurrency: 1, inputEndpoint: 'First Canvas draw call before browser presentation',
    heap: 'Chromium performance.memory reported JS heap sampled every 100 ms, excludes textures and GPU memory',
    physicalPhone: false},
  cases: [],
};

for (const [engine, browserType] of Object.entries({chromium, webkit})) {
  const browser = await browserType.launch();
  for (const study of ['fog', 'receipt']) for (const reduced of [false, true]) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
      reducedMotion: reduced ? 'reduce' : 'no-preference'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}?view=${study}`);
    await page.waitForSelector('canvas[data-ready="true"]');
    await page.waitForFunction(() => window.__V036__.metrics().study.ready);
    const build = await page.locator('.v036-footer').innerText();
    if (!build.includes(source.sourceCommit.slice(0, 7))) throw new Error('Measured package source mismatch');
    await page.waitForTimeout(1000);
    const before = await page.evaluate(() => window.__V036__.metrics().study);
    const heap = [];
    let taps = 0;
    const started = performance.now();
    while (performance.now() - started < 10000) {
      if (study === 'fog' && taps < 5 && performance.now() - started > taps * 1600) {
        const box = await page.locator('.v036-stage canvas').boundingBox();
        await page.touchscreen.tap(box.x + box.width * .72, box.y + box.height * .63);
        taps++;
      }
      const memory = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
      if (memory !== null) heap.push(memory);
      await page.waitForTimeout(100);
    }
    const after = await page.evaluate(() => window.__V036__.metrics().study);
    const intervals = (after.drawIntervals ?? after.intervals).slice((before.drawIntervals ?? before.intervals).length);
    report.cases.push({engine, study, reduced, build, drawing: summarize(intervals),
      drawCpu: summarize((after.drawTimes ?? []).slice((before.drawTimes ?? []).length)),
      inputDraw: summarize(after.inputDrawLatencyMs ?? []),
      jsHeapReportedPeakBytes: heap.length ? Math.max(...heap) : null, jsHeapSamples: heap.length,
      fogDecodedTextureBytes: after.fogDecodedTextureBytes ?? null,
      finalState: after, errors});
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`${engine} ${study} reduced=${reduced} measured`);
    await context.close();
  }
  await browser.close();
}
await mkdir('artifacts/v036', {recursive: true});
await writeFile('artifacts/v036/performance.json', JSON.stringify(report, null, 2) + '\n');
