import {chromium, webkit} from '@playwright/test';
import {writeFileSync, mkdirSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {cpus, platform, arch} from 'node:os';
import {openReview, click, terrainTap} from './refinement_browser_helpers.mjs';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4207';
const output = process.env.OUTPUT_DIR ?? 'artifacts/refinement';
const seconds = Number(process.env.MEASURE_SECONDS ?? 10);
const packageInfo = JSON.parse(readFileSync('releases/taptap/package-info-fusion.json', 'utf8'));
mkdirSync(output, {recursive:true});
const results = [];
function summarize(values) {
  if (!values.length) return {samples:0};
  const sorted = [...values].sort((a,b) => a-b);
  return {samples:values.length, medianMs:sorted[Math.floor(sorted.length*.5)], p95Ms:sorted[Math.floor(sorted.length*.95)],
    maxMs:sorted.at(-1), over100Ms:values.filter(value => value > 100).length};
}
for (const [engine, type] of [['chromium',chromium], ['webkit',webkit]]) {
  const browser = await type.launch();
  try {
    for (const view of ['day', 'night', 'museum', 'receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell', 'museum-reduced']) {
      const session = await openReview(browser, base, {fixture:view === 'night' ? 'night-sorting' : 'full',
        reducedMotion:view === 'museum-reduced' ? 'reduce' : 'no-preference'});
      const {page} = session;
      if (view === 'museum' || view === 'museum-reduced') {
        await click(page, '[data-tab="base"]');
        await page.locator('#museum-canvas[data-ready="true"]').waitFor();
      } else if (!['day', 'night'].includes(view)) {
        await click(page, '[data-tab="collection"]');
        await click(page, `#fusion-collection-list [data-detail="${view}"]`);
        await page.locator(view === 'receipt' ? '#fusion-paper-focus[data-ready="true"]' : '#fusion-exhibit-focus[data-ready="true"]').waitFor();
      }
      await page.waitForTimeout(1500);
      const sample = await page.evaluate(async duration => {
        window.__FUSION__.resetMetrics();
        window.__FUSION__.resetUiMetrics();
        const intervals = [];
        let previous = performance.now();
        const began = previous;
        await new Promise(resolve => {
          function frame(now) {
            intervals.push(now-previous);previous=now;
            if (now-began<duration) requestAnimationFrame(frame);
            else resolve();
          }
          requestAnimationFrame(frame);
        });
        return {raf:intervals.slice(1), scene:window.__FUSION__.metrics(), ui:window.__FUSION__.uiMetrics(),
          build:document.querySelector('.fu-build').textContent, ua:navigator.userAgent, dpr:devicePixelRatio};
      }, seconds*1000);
      if (!sample.build.includes(packageInfo.sourceCommit.slice(0,7))) throw Error('Measured package SHA mismatch');
      results.push({engine, view, seconds, ...sample, raf:summarize(sample.raf),
        actualPaint:summarize(['museum','museum-reduced'].includes(view) ? sample.ui.museum.intervalsMs : sample.ui.focus.intervalsMs),
        drawCost:summarize(['museum','museum-reduced'].includes(view) ? sample.ui.museum.costsMs : sample.ui.focus.costsMs), errors:session.errors});
      await session.context.close();
    }
    const session = await openReview(browser, base, {fixture:'full'});
    await session.page.waitForTimeout(1000);
    for (let index=0;index<10;index++) {await terrainTap(session.page);await session.page.waitForTimeout(index%2 ? 750 : 200);}
    await session.page.waitForTimeout(800);
    const latency = await session.page.evaluate(() => ({input:window.__FUSION__.uiMetrics().input, feedback:window.__FUSION__.feedbackMetrics()}));
    results.push({engine,view:'input', ...latency,
      contact:summarize(latency.feedback.samples.filter(item=>item.kind==='contact').map(item=>item.firstPaintMs)),
      accepted:summarize(latency.feedback.samples.filter(item=>item.kind==='accepted').map(item=>item.firstPaintMs)),
      transaction:summarize(latency.input.transactionMs), errors:session.errors});
    await session.context.close();
  } finally {await browser.close();}
}
const report = {sourceCommit:packageInfo.sourceCommit,
  verificationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  method:'One headless browser/page at a time, isolated from recording and other tests. 390×844 DPR2 touch emulation, 1.5-second warmup. Actual Museum/focus draw intervals measured independently of page rAF. Input latency ends at first Canvas drawing call, before presentation. Desktop host only. Physical phone and TapTap WebView remain to be tested.',
  host:{platform:platform(),arch:arch(),cpu:cpus()[0]?.model},results};
writeFileSync(`${output}/performance.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(results.map(({engine,view,raf,actualPaint,drawCost,contact,accepted,transaction,errors})=>({engine,view,raf,actualPaint,drawCost,contact,accepted,transaction,errors})),null,2));
if (results.some(result=>result.errors.length)) process.exitCode=1;
