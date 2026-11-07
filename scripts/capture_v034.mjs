import {chromium, webkit} from '@playwright/test';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';

const base = (process.env.BASE_URL ?? 'http://127.0.0.1:4197').replace(/\/$/, '');
const output = process.env.OUTPUT_DIR ?? 'artifacts/v034-refine';
const raw = 'artifacts/raw-video/v034-refine';
const mode = process.argv.includes('--discover') ? 'discover' : process.argv.includes('--rehearse') ? 'rehearse' : 'record';
const captureCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const sourceCommit = execFileSync('git', ['rev-parse', process.env.RUNTIME_COMMIT ?? 'HEAD'], {encoding: 'utf8'}).trim();
const sourcePaths = ['src', 'assets', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'vite.v034.config.ts', 'scripts/capture_v034.mjs'];
const errors = [];
const audits = [];
const inputs = [];
const screens = [];
await mkdir(output, {recursive: true});
await mkdir(raw, {recursive: true});
function assert(value, message) {if (!value) throw Error(message);}
function dirtySource() {
  return execFileSync('git', ['status', '--porcelain', '--', ...sourcePaths], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
}
async function boot(view = 'night', {engine = chromium, width = 390, record = false} = {}) {
  const browser = await engine.launch();
  const viewport = {width, height: width === 360 ? 800 : 844};
  const context = await browser.newContext({viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    ...(record ? {recordVideo: {dir: raw, size: viewport}} : {})});
  const page = await context.newPage();
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    localStorage.setItem('loststar.save.v1', 'V034-PRESERVE-PLAYER');
    localStorage.setItem('loststar.preferences.v1', 'V034-PRESERVE-PREFERENCES');
    const calls = [];
    for (const key of ['getItem', 'setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[key];
      Storage.prototype[key] = function (...args) {calls.push({method: key, key: args[0]}); return original.apply(this, args);};
    }
    window.__weekCaptureAudit = {calls, strings: () => [get.call(localStorage, 'loststar.save.v1'), get.call(localStorage, 'loststar.preferences.v1')]};
    document.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      const ring = document.createElement('i');
      ring.style.cssText = `position:fixed;left:${event.clientX - 10}px;top:${event.clientY - 10}px;width:20px;height:20px;border:2px solid #ffe2a8;border-radius:50%;pointer-events:none;z-index:99999`;
      document.body.append(ring);
      ring.animate([{opacity: 1, transform: 'scale(.7)'}, {opacity: 0, transform: 'scale(1.5)'}], {duration: 350});
      setTimeout(() => ring.remove(), 360);
    });
  });
  page.on('pageerror', error => errors.push({view, message: error.message}));
  page.on('response', response => {if (response.status() >= 400) errors.push({view, url: response.url(), status: response.status()});});
  page.on('requestfailed', request => errors.push({view, url: request.url(), error: request.failure()?.errorText}));
  await page.goto(`${base}/?sample=week1&view=${view}`, {waitUntil: 'domcontentloaded'});
  await page.locator(view === 'receipt' ? '#week1-paper[data-restoration-ready=true]' : '#week1-world canvas[data-ready=true]').waitFor({timeout: 45000});
  const build = await page.locator('html').getAttribute('data-build');
  if (mode !== 'discover') assert(build.includes(sourceCommit.slice(0, 7)) && !build.includes('本地修改'), `Wrong or dirty build ${build}`);
  return {browser, context, page, viewport, build};
}
async function tap(page, selector) {
  const target = page.locator(selector);
  assert(await target.count() === 1, `Ambiguous target ${selector}`);
  await target.scrollIntoViewIfNeeded();
  const bounds = await target.boundingBox();
  assert(bounds && bounds.width >= 44 && bounds.height >= 44, `Touch target too small ${selector}`);
  await target.tap();
  inputs.push({selector, at: new Date().toISOString(), method: 'native touchscreen tap'});
}
async function screenshot(page, file) {
  await page.screenshot({path: `${output}/${file}`, scale: 'css'});
  screens.push(file);
  return file;
}
async function attributes(page, selector) {return page.locator(selector).evaluate(canvas => ({...canvas.dataset}));}
async function audit(page, label) {
  const result = await page.evaluate(() => ({calls: window.__weekCaptureAudit.calls, strings: window.__weekCaptureAudit.strings()}));
  assert(result.calls.length === 0, `${label} accessed player Storage`);
  assert(result.strings.join('|') === 'V034-PRESERVE-PLAYER|V034-PRESERVE-PREFERENCES', `${label} changed player sentinels`);
  audits.push({label, ...result});
}
async function measureWorld(page) {
  return page.evaluate(async () => {
    window.__WEEK1__.resetMetrics();
    const intervals = [];
    const start = performance.now();
    let last = start;
    await new Promise(resolve => {
      function tick(now) {
        intervals.push(now - last);
        last = now;
        if (now - start >= 6000) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    const sorted = [...intervals].sort((a, b) => a - b);
    return {windowMs: performance.now() - start, p95RafMs: sorted[Math.floor(sorted.length * .95)],
      over50ms: intervals.filter(value => value > 50).length, scene: window.__WEEK1__.metrics()};
  });
}
async function close(trial, file) {
  await audit(trial.page, file ?? 'rehearsal');
  const recording = trial.page.video();
  await trial.context.close();
  let result;
  if (file) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', await recording.path(), '-r', '30', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}/${file}`]);
    result = {file, seconds: Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', `${output}/${file}`], {encoding: 'utf8'})), bytes: (await stat(`${output}/${file}`)).size, playbackRate: 1};
  }
  await trial.browser.close();
  return result;
}
async function receiptFlow(trial, saveScreens) {
  const {page, viewport} = trial;
  const frames = [];
  async function shot(label) {
    const file = saveScreens ? await screenshot(page, `receipt-${label}-${viewport.width}.png`) : null;
    frames.push({label, file, at: new Date().toISOString(), canvas: await attributes(page, '#week1-paper'), parts: await page.locator('#week1-parts').textContent()});
  }
  async function action(kind, phase) {
    assert(await page.locator('#week1-primary').getAttribute('data-kind') === kind, `Unexpected receipt action, expected ${kind}`);
    await tap(page, '#week1-primary');
    if (saveScreens && viewport.width === 390) {
      const start = Date.now();
      const moments = {excavate: [.9, 2.2, 3.5, 4.8, 5.9], clean: [.8, 1.9, 3.2], repair: [.9, 2.2, 3.4]};
      for (const seconds of moments[kind] ?? []) {
        await page.waitForTimeout(Math.max(0, seconds * 1000 - (Date.now() - start)));
        await shot(`${kind}-${seconds}`);
      }
    }
    await page.locator(`#week1-paper[data-restoration-phase="${phase}"]`).waitFor({timeout: 8000});
    await page.waitForTimeout(750);
  }
  await shot('buried');
  await action('excavate', 'found'); await shot('s0');
  await action('clean', 'clean'); await shot('s1');
  await action('repair', 'stabilized'); await shot('s2');
  assert(await page.locator('#week1-parts').textContent() === '200', 'Physical restoration cost differs from 40+120');
  assert(await page.locator('#week1-missing').getAttribute('data-count') === '2', 'Restoration invented evidence');
  await tap(page, '#week1-try');
  await page.locator('#week1-paper[data-restoration-phase=stabilized]').waitFor({timeout: 5000});
  assert(await page.locator('#week1-parts').textContent() === '200', 'Free trial charged parts');
  if (viewport.width === 360) return frames;
  await tap(page, '#week1-primary');
  await page.locator('#week1-world canvas[data-ready=true]').waitFor({timeout: 45000});
  await page.locator('#week1-field-record[data-recorded=true]').waitFor({timeout: 24000});
  await page.waitForTimeout(800);
  if (saveScreens) await screenshot(page, 'receipt-field-proof-390.png');
  await tap(page, '[data-week-tab="receipt"]');
  await action('identify', 'stabilized');
  assert(await page.locator('#week1-missing').getAttribute('data-count') === '1', 'Actual field observation did not reduce missing count');
  assert((await page.locator('#week1-evidence-list').textContent()).includes('签收记录仍缺失'), 'Signature was fabricated');
  await shot('identified');
  return frames;
}

if (mode === 'discover') {
  const trial = await boot();
  const fields = [];
  async function inspect(label) {
    fields.push({label, controls: await trial.page.locator('button,input,select').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).map(node => ({tag: node.tagName, id: node.id, type: node.getAttribute('type'), text: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height})))});
  }
  await inspect('night');
  for (const kind of ['security', 'research', 'repair']) {await tap(trial.page, `[data-drawer="${kind}"]`); await inspect(kind); await tap(trial.page, '#week1-close');}
  await tap(trial.page, '[data-week-tab="receipt"]');
  await trial.page.locator('#week1-paper[data-restoration-ready=true]').waitFor(); await inspect('receipt');
  await tap(trial.page, '[data-week-tab="life"]'); await inspect('life');
  await close(trial);
  await writeFile(`${output}/discovery.json`, JSON.stringify({at: new Date().toISOString(), sourceCommit, build: trial.build, fields, audits, errors}, null, 2) + '\n');
  assert(errors.length === 0, 'Discovery errors');
  console.log('Discovery passed');
} else if (mode === 'rehearse') {
  assert(dirtySource().length === 0, 'Rehearsal requires committed sources');
  const trial = await boot('receipt');
  const receipt = await receiptFlow(trial, false);
  await tap(trial.page, '[data-week-tab="night"]');
  for (const kind of ['security', 'research', 'repair']) {await tap(trial.page, `[data-drawer="${kind}"]`); await tap(trial.page, '#week1-close');}
  await tap(trial.page, '[data-drawer="security"]'); await tap(trial.page, '[data-week-config="basic"]'); await tap(trial.page, '#week1-close');
  await tap(trial.page, '#week1-cycle'); await tap(trial.page, '#week1-cycle');
  await tap(trial.page, '[data-week-tab="life"]'); await trial.page.waitForTimeout(1000);
  await close(trial);
  assert(errors.length === 0, 'Rehearsal errors');
  await writeFile(`${output}/rehearsal.json`, JSON.stringify({at: new Date().toISOString(), sourceCommit, build: trial.build, receipt, inputs, audits, errors, passed: true}, null, 2) + '\n');
  console.log('Rehearsal passed');
} else {
  const rehearsal = JSON.parse(await readFile(`${output}/rehearsal.json`, 'utf8'));
  assert(rehearsal.passed && rehearsal.sourceCommit === sourceCommit, 'Matching rehearsal is required');
  assert(dirtySource().length === 0, 'Recording requires clean sources');
  execFileSync('git', ['diff', '--exit-code', sourceCommit, 'HEAD', '--', ...sourcePaths], {stdio: 'pipe'});
  const videos = [];
  const receipt = await boot('receipt', {record: true});
  const receiptFrames = await receiptFlow(receipt, true);
  videos.push(await close(receipt, 'receipt-lifecycle-and-proof-live.mp4'));

  const nightFrames = [];
  for (const preset of ['basic', 'complete']) {
    const trial = await boot('night', {record: true});
    if (preset === 'complete') {await tap(trial.page, '[data-drawer="security"]'); await tap(trial.page, '[data-week-config="complete"]'); await tap(trial.page, '#week1-close');}
    await tap(trial.page, '#week1-replay'); const start = Date.now();
    for (const target of [.2, 5, 10.5, 16.2, 21.5, 23.2, 24.8, 28.4, 30.2, 31.5, 35.8]) {
      await trial.page.waitForTimeout(Math.max(0, target * 1000 - (Date.now() - start)));
      const file = await screenshot(trial.page, `night-${preset}-${target}-390.png`);
      nightFrames.push({preset, target, wallMs: Date.now() - start, file, canvas: await attributes(trial.page, '#week1-world canvas')});
    }
    assert(await trial.page.locator('#week1-repair-spent').getAttribute('data-value') === (preset === 'basic' ? '18' : '0'), 'Night debit mismatch');
    videos.push(await close(trial, `night-${preset}-36s-live.mp4`));
  }

  const life = await boot('life', {record: true});
  await tap(life.page, '#week1-replay'); const lifeStart = Date.now(); const lifeFrames = [];
  for (const target of [.5, 4, 6.5, 9.5, 12, 15.2]) {
    await life.page.waitForTimeout(Math.max(0, target * 1000 - (Date.now() - lifeStart)));
    lifeFrames.push({target, file: await screenshot(life.page, `residents-${target}-390.png`), canvas: await attributes(life.page, '#week1-world canvas')});
  }
  videos.push(await close(life, 'resident-daily-15s-live.mp4'));

  const small = await boot('receipt', {width: 360});
  await receiptFlow(small, true);
  await tap(small.page, '[data-week-tab="night"]');
  await small.page.locator('#week1-world canvas[data-ready=true]').waitFor();
  await screenshot(small.page, 'night-basic-360.png');
  for (const width of [360, 390]) {
    const trial = width === 360 ? small : await boot();
    for (const kind of ['security', 'research', 'repair']) {await tap(trial.page, `[data-drawer="${kind}"]`); await screenshot(trial.page, `drawer-${kind}-${width}.png`); await tap(trial.page, '#week1-close');}
    await close(trial);
  }

  const cycle = await boot('night', {record: true});
  await tap(cycle.page, '#week1-cycle'); const cycleStart = Date.now(); const cycleFrames = [];
  for (const target of [1, 228.5, 235, 245, 278.5, 279.9, 280.3, 287, 296, 300.2, 307.8]) {
    await cycle.page.waitForTimeout(Math.max(0, target * 1000 - (Date.now() - cycleStart)));
    cycleFrames.push({target, wallMs: Date.now() - cycleStart, file: await screenshot(cycle.page, `cycle-${target}-390.png`), canvas: await attributes(cycle.page, '#week1-world canvas')});
  }
  videos.push(await close(cycle, 'day-night-cycle-308s-live.mp4'));

  const performance = [];
  for (const engine of [chromium, webkit]) {
    const trial = await boot('life', {engine});
    const world = await measureWorld(trial.page);
    await tap(trial.page, '[data-week-tab="night"]');
    await tap(trial.page, '#week1-replay');
    await trial.page.locator('#week1-world canvas[data-v034-phase=identify]').waitFor({timeout: 25000});
    const night = await measureWorld(trial.page);
    await tap(trial.page, '[data-week-tab="receipt"]');
    await trial.page.locator('#week1-paper[data-restoration-ready=true]').waitFor();
    await tap(trial.page, '#week1-primary');
    const paper = await trial.page.evaluate(async () => {
      const canvas = document.querySelector('#week1-paper'); const start = performance.now(); const samples = []; let last = canvas.dataset.frame;
      await new Promise(resolve => {function tick(now) {if (canvas.dataset.frame !== last) {samples.push(Number(canvas.dataset.drawMs)); last = canvas.dataset.frame;} if (now - start >= 8000) resolve(); else requestAnimationFrame(tick);} requestAnimationFrame(tick);});
      const sorted = [...samples].sort((a, b) => a - b); const windowMs = performance.now() - start;
      return {windowMs, uniqueFrames: samples.length, actualHz: samples.length / (windowMs / 1000), meanDrawMs: samples.reduce((sum, value) => sum + value, 0) / samples.length, p95DrawMs: sorted[Math.floor(sorted.length * .95)], maxDrawMs: sorted.at(-1), samples};
    });
    performance.push({engine: engine.name(), world, night, paper}); await close(trial);
  }
  assert(errors.length === 0, 'Recording has page/HTTP errors');
  assert(dirtySource().length === 0 && execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim() === captureCommit, 'Source changed during recording');
  const result = {at: new Date().toISOString(), sourceCommit, captureCommit, viewport: {width: 390, height: 844},
    method: 'Actual wall-clock continuous mobile touch emulation. No injected player save, simulation clock, money, or evidence. The 30-second event deliberately observes source night 40.2–60 seconds through the documented piecewise mapping, followed by six-second dawn. The complete cycle uses real 240-second day and 60-second night.',
    phoneReview: 'Pending physical TapTap scan review', host: {cpu: os.cpus()[0].model, platform: os.platform()},
    performanceScope: 'Desktop separate sampling after all video recording, no simultaneous recording. Daytime residents and active night scanning are each sampled for six seconds. Paper is sampled for eight seconds including the real 6.2-second excavation and idle remainder. Scene CPU excludes the inspection-copy and GPU completion, while requestAnimationFrame intervals observe the whole page. WebKit short samples may be quantized.',
    videos, receiptFrames, nightFrames, lifeFrames, cycleFrames, performance, inputs, audits, errors};
  await writeFile(`${output}/recordings.json`, JSON.stringify(result, null, 2) + '\n');
  const videoNames = {
    'receipt-lifecycle-and-proof-live.mp4': '收据出土、整理与真实来源辨识',
    'night-basic-36s-live.mp4': '基础安保、漏网损伤与清晨修复',
    'night-complete-36s-live.mp4': '完善安保、核验与归站',
    'resident-daily-15s-live.mp4': '三居民日常观察',
    'day-night-cycle-308s-live.mp4': '完整240/60昼夜与清晨',
  };
  const videoCards = videos.map(video => `<article>
    <h2>${videoNames[video.file]}</h2>
    <video controls playsinline src="${video.file}"></video>
    <p>${video.seconds.toFixed(2)}秒 · 真实墙钟</p>
  </article>`).join('\n');
  const figures = screens.filter(file => file.startsWith('receipt-') || file.startsWith('drawer-') || file.startsWith('cycle-')).map(file => `<figure><img src="${file}" alt="${file}"><figcaption>${file}</figcaption></figure>`).join('\n');
  const lightFigures = [4, 12].flatMap(seconds => ['day', 'night'].map(light => {
    const file = `lighting-basic-${seconds}-${light}-390.png`;
    return `<figure><img src="${file}" alt="${seconds}秒同位${light}光照"><figcaption>${seconds}秒同事件姿态 · ${light}</figcaption></figure>`;
  })).join('\n');
  await writeFile(`${output}/index.html`, `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>失物星球 · V0.3.4动作返修候选</title>
  <style>
    body { margin:0; background:#171225; color:#eadcc8; font:15px/1.8 system-ui }
    main { max-width:1100px; margin:auto; padding:22px 16px }
    h1 { font-size:25px }
    h2 { font-size:17px; overflow-wrap:anywhere }
    p { color:#bbafc7 }
    a { color:#b5ddcb }
    video { display:block; width:min(100%,390px); background:#090714 }
    .videos { display:flex; flex-wrap:wrap; gap:22px }
    .gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px }
    figure { margin:0; border:1px solid #796077; padding:7px }
    img { display:block; width:100%; image-rendering:pixelated }
    figcaption { font-size:11px; overflow-wrap:anywhere }
  </style>
</head>
<body><main>
  <h1>V0.3.4 动作返修候选</h1>
  <p>0.3.4 · ${sourceCommit.slice(0, 7)} · 2026年11月4–10日审核计划。样板、费用和材质待用户审核，正式玩家存档保持。</p>
  <p><a href="../v034/">上一轮0.3.4</a> · <a href="recordings.json">原始录制和桌面性能</a> · <a href="economy.md">经济候选</a> · <a href="budget-route.md">有限工程预算路线</a> · <a href="validation.json">验证记录</a> · <a href="https://github.com/sy0310/loststar-game/blob/codex/v0.1-vertical-slice/docs/26_V034_REVIEW_REFINEMENT_AND_MOTION_REFERENCES.md">10款动作参考与返修说明</a></p>
  <p>以下为桌面手机触控仿真。新的真实TapTap手机、锁屏和长期发热待扫码复审。清洁与修补改变原件物理状态，P03场景观察改变核验结果，签收仍缺失。</p>
  <div class="videos">${videoCards}</div>
  <h2>同位灯光渲染检查</h2>
  <p>指定同一渲染时刻与事件姿态，只有环境光场变化。它与上方真实墙钟录像分别记录。<a href="lighting-comparison.json">位置、镜头与星空角点核对</a></p>
  <div class="gallery">${lightFigures}</div>
  <h2>390×844与360×800实际运行画面</h2>
  <div class="gallery">${figures}</div>
  <h2>仍待审核</h2>
  <p>出土受力、两处修补、同位夜色与居民比例等待新一轮手机视觉审核。前两次巡守沿用已有动作。三异常标准稿供形态和动作审核，其余奇物保留设计差异。长期零件消费价值和候选任务内容仍待审核。</p>
</main></body>
</html>\n`);
  console.log(JSON.stringify({videos, errors: errors.length, audits: audits.length, sourceCommit}));
}
