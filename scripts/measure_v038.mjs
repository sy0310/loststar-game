import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import {feedbackFixture} from '../releases/feedback-fixtures/feedback_fixtures.js';

const base = process.env.V038_URL ?? 'http://127.0.0.1:4224/';
const packageInfo = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
const summarize = values => {
  const ordered = [...values].sort((a, b) => a - b);
  return {samples: values.length, medianMs: ordered[Math.floor(ordered.length * .5)] ?? null,
    p95Ms: ordered[Math.floor(ordered.length * .95)] ?? null,
    over100Ms: values.filter(value => value > 100).length};
};
const report = {sourceCommit: packageInfo.sourceCommit,
  method: {physicalPhone: false, viewport: {width: 390, height: 844}, dpr: 2,
    warmupMs: 1500, sampleMs: 10000, concurrency: 1, recording: false,
    heap: 'Chromium performance.memory coarse JS heap samples. Excludes texture, GPU and process memory.'},
  host: {platform: os.platform(), architecture: os.arch(), cpu: os.cpus()[0].model}, cases: []};
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch();
  for (const view of ['fog', 'night']) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2,
      hasTouch: true, isMobile: true, reducedMotion: view.endsWith('reduced') ? 'reduce' : 'no-preference'});
    const page = await context.newPage();const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
    if (view !== 'fog') {
      const fixture = feedbackFixture('night', Date.now());
      await page.evaluate(save => new Promise((resolve, reject) => {
        const request = indexedDB.open('loststar.fusion.firstplanet.v037', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result, transaction = database.transaction('archive', 'readwrite');
          transaction.objectStore('archive').put(save, 'current');
          transaction.oncomplete = () => {database.close();resolve();};
          transaction.onerror = () => reject(transaction.error);
        };
      }), fixture.state);
      await page.reload();await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
    }
    await page.locator('#fusion-dismiss-intro').tap();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {window.__FUSION__.resetMetrics();window.__FUSION__.resetUiMetrics();window.__heapSamples = [];
      window.__heapTimer = setInterval(() => {if (performance.memory) window.__heapSamples.push(performance.memory.usedJSHeapSize);}, 100);});
    const sample = await page.evaluate(async () => {
      const intervals = [];let previous = performance.now();const began = previous;
      await new Promise(resolve => {
        function frame(now) {
          intervals.push(now - previous);previous = now;
          if (now - began < 10000) requestAnimationFrame(frame);else resolve();
        }
        requestAnimationFrame(frame);
      });
      clearInterval(window.__heapTimer);
      return {raf: intervals.slice(1), scene: window.__FUSION__.metrics(), ui: window.__FUSION__.uiMetrics(),
        surface: window.__FUSION__.surfaceMetrics(), heap: window.__heapSamples,
        build: document.querySelector('.fu-build')?.textContent, ua: navigator.userAgent};
    });
    if (!sample.build?.includes(packageInfo.sourceCommit.slice(0, 7))) throw new Error('Measured package SHA mismatch');
    const frameData = sample.scene;
    report.cases.push({engine, view, ...sample, raf: summarize(sample.raf), actualPaint: {samples: frameData.frames, medianMs: frameData.medianFrameMs, p95Ms: frameData.p95FrameMs},
      drawCost: {meanMs: frameData.meanDrawMs}, heap: {samples: sample.heap.length, maximumBytes: sample.heap.length ? Math.max(...sample.heap) : null}, errors});
    await context.close();
  }
  await browser.close();
}
await writeFile('artifacts/v038-feedback/performance.json', JSON.stringify(report, null, 2) + '\n');
if (report.cases.some(entry => entry.errors.length)) throw new Error('Performance run had runtime errors');
console.log(JSON.stringify(report.cases.map(({engine, view, raf, actualPaint, drawCost, heap}) => ({engine, view, raf, actualPaint, drawCost, heap}))));
