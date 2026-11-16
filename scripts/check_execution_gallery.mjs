#!/usr/bin/env node
/** Real browser gallery QA. Run only after the root marks the final gallery ready. */
import {chromium, webkit} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.env.RENEWAL_OUTPUT ?? 'artifacts/v044-execution-art');
const base = process.env.GALLERY_URL ?? 'http://127.0.0.1:4230/artifacts/v044-execution-art/';
const target = new URL(base);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash)
  throw Error('Use the local gallery URL without credentials, query or fragment');
if (!output.startsWith(`${root}/artifacts/`)) throw Error('Write QA only in repository artifacts');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (value, message) => {if (!value) throw Error(message);};
const indexPath = path.join(output, 'index.html'), statusPath = path.join(output, 'gallery-status.json');
const metadata = JSON.parse(await fs.readFile(path.join(root, 'releases/taptap/package-info-fusion.json'), 'utf8'));
const indexBytes = await fs.readFile(indexPath), statusBytes = await fs.readFile(statusPath), status = JSON.parse(statusBytes);
check(status.sourceCommit === metadata.sourceCommit && status.zipSha256 === metadata.sha256, 'Gallery is not bound to the final current package');
const zip = await fs.readFile(path.resolve(root, metadata.archive));
check(zip.length === metadata.bytes && digest(zip) === metadata.sha256, 'Actual package differs from gallery metadata');
const requiredReceipts = ['proof.json', 'verification.json', 'taptap-self-test.json', 'review-status.json'];
const receiptHashes = {};
for (const file of requiredReceipts) {
  const raw = await fs.readFile(path.join(output, file)), report = JSON.parse(raw);
  const source = report.sourceCommit ?? report.runtimeSourceSha ?? report.runtimeSource;
  const archive = report.archive && typeof report.archive === 'object' ? report.archive.sha256 : undefined;
  const sha = report.zipSha256 ?? report.localZipSha256 ?? archive;
  check(source === metadata.sourceCommit && sha === metadata.sha256, `${file}: final source/package receipt is missing or stale`);
  receiptHashes[file] = digest(raw);
}
await fs.mkdir(path.join(output, 'gallery-qa'), {recursive: true});
const report = {schema: 1, sourceCommit: metadata.sourceCommit, version: metadata.version, zipSha256: metadata.sha256,
  gallerySha256: digest(indexBytes), galleryStatusSha256: digest(statusBytes), requiredReceiptSha256: receiptHashes,
  collectorSha256: digest(await fs.readFile(new URL(import.meta.url))), base, startedAt: Date.now(),
  physicalPhone: false, touchEmulation: true, privateContexts: true, audioRecorded: false,
  method: 'Chromium and WebKit 390×844. Expand all details, force and decode every image, play every MP4 element until an actual positive timeupdate, then pause. Check all unique local hrefs; Markdown/source links use HEAD without fetching their body. No application/runtime mutation or personal browser profile.',
  cases: [], screenshots: [], errors: []};

async function layout(page) {
  return page.evaluate(() => {
    const visible = element => Boolean(element.getClientRects().length);
    const offenders = [...document.querySelectorAll('main *')].filter(visible).flatMap(element => {
      const box = element.getBoundingClientRect();
      return box.right > innerWidth + 1 || box.left < -1 ? [{tag: element.tagName.toLowerCase(), id: element.id,
        className: typeof element.className === 'string' ? element.className : '', left: box.left, right: box.right, width: box.width}] : [];
    });
    return {viewport: {width: innerWidth, height: innerHeight}, documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth, noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth && offenders.length === 0,
      overflowElements: offenders.slice(0, 30), overflowElementCount: offenders.length,
      details: document.querySelectorAll('details').length, openDetails: document.querySelectorAll('details[open]').length};
  });
}
async function checkLinks(context, page) {
  const links = await page.locator('a[href]').evaluateAll(anchors => [...new Set(anchors.map(anchor => anchor.href))]);
  const local = [], external = [], fragments = [];
  for (const href of links) {
    const url = new URL(href);
    if (url.origin !== target.origin) {external.push({url: href, checked: false, reason: 'External documentation is outside local gallery QA'});continue;}
    if (url.pathname === target.pathname && url.hash) {fragments.push(url.hash);continue;}
    url.hash = '';local.push(url.href);
  }
  const results = [], unique = [...new Set(local)];let next = 0;
  async function worker() {
    while (next < unique.length) {
      const href = unique[next++], url = new URL(href), json = url.pathname.endsWith('.json');
      try {
        const response = json ? await context.request.get(href, {timeout: 30000}) : await context.request.head(href, {timeout: 30000});
        const entry = {path: url.pathname, method: json ? 'GET JSON' : 'HEAD', status: response.status(), ok: response.ok()};
        if (json && response.ok()) {await response.json();entry.jsonParsed = true;}
        results.push(entry);await response.dispose();
      } catch (error) {results.push({path: url.pathname, ok: false, error: error.message});}
    }
  }
  await Promise.all(Array.from({length: Math.min(6, unique.length)}, worker));
  for (const fragment of fragments) {
    const id = decodeURIComponent(fragment.slice(1));
    results.push({path: `${target.pathname}${fragment}`, method: 'DOM fragment', ok: !id || await page.evaluate(id => Boolean(document.getElementById(id)), id)});
  }
  return {anchorElements: await page.locator('a[href]').count(), uniqueHrefs: links.length,
    uniqueLocalFiles: unique.length, externalUnchecked: external, results: results.sort((a, b) => a.path.localeCompare(b.path))};
}
async function qa(engine, driver) {
  const browser = await driver.launch(), context = await browser.newContext({viewport: {width: 390, height: 844},
    deviceScaleFactor: 1, isMobile: true, hasTouch: true});
  const entry = {engine, width: 390, height: 844, pageErrors: [], consoleErrors: [], consoleWarnings: [],
    httpErrors: [], failedRequests: [], cancelledRequests: [], images: [], videos: [], errors: [], complete: false};report.cases.push(entry);
  try {
    const page = await context.newPage();page.setDefaultTimeout(30000);
    page.on('pageerror', error => entry.pageErrors.push(error.stack ?? error.message));
    page.on('console', message => {
      if (message.type() === 'error') entry.consoleErrors.push(message.text());
      if (message.type() === 'warning') entry.consoleWarnings.push(message.text());
    });
    page.on('response', response => {if (response.status() >= 400) entry.httpErrors.push({status: response.status(), path: new URL(response.url()).pathname});});
    page.on('requestfailed', request => {
      const failure = {path: new URL(request.url()).pathname, error: request.failure()?.errorText};
      // Native media seek/pause can cancel a range request; actual playback is
      // verified independently below. Keep cancellations visible as diagnostics.
      if (/abort|cancel/i.test(failure.error ?? '')) entry.cancelledRequests.push(failure);
      else entry.failedRequests.push(failure);
    });
    const response = await page.goto(base, {waitUntil: 'domcontentloaded'});
    check(response?.ok() && digest(await response.body()) === report.gallerySha256, `${engine}: actual served gallery differs from the final local HTML`);
    entry.closedLayout = await layout(page);
    await page.locator('details').evaluateAll(details => {for (const detail of details) detail.open = true;});
    entry.images = await page.locator('img').evaluateAll(async images => {
      for (const image of images) {image.loading = 'eager';image.decoding = 'async';}
      let timeout;
      try {
        const decoded = Promise.all(images.map(async (image, index) => {
          try {await image.decode();return {index, path: new URL(image.currentSrc || image.src).pathname, complete: image.complete,
            width: image.naturalWidth, height: image.naturalHeight, ok: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0};}
          catch (error) {return {index, path: new URL(image.currentSrc || image.src).pathname, ok: false, error: error.message};}
        }));
        return await Promise.race([decoded, new Promise((_, reject) => {
          timeout = setTimeout(() => reject(Error('Complete gallery image decode timed out')), 60000);
        })]);
      } finally {clearTimeout(timeout);}
    });
    check(entry.images.length > 0 && entry.images.every(image => image.ok), `${engine}: unloaded, empty or broken image`);
    const players = page.locator('video'), count = await players.count();
    for (let index = 0; index < count; index++) {
      const player = players.nth(index);await player.scrollIntoViewIfNeeded();
      const playback = await player.evaluate(async (video, index) => {
        const result = {index, path: new URL(video.currentSrc || video.src).pathname, controls: video.controls,
          playsInline: video.playsInline, audioRecorded: false, playbackMutedForAutomation: true, timeupdates: 0, ok: false};
        video.muted = true;video.defaultMuted = true;video.playsInline = true;video.preload = 'auto';
        try {
          await new Promise((resolve, reject) => {
            let timer;
            const cleanup = () => {clearTimeout(timer);video.removeEventListener('loadedmetadata', ready);video.removeEventListener('error', fail);};
            const ready = () => {cleanup();resolve();}, fail = () => {cleanup();reject(Error(`Media metadata error ${video.error?.code ?? ''}`));};
            if (video.readyState >= 1) {resolve();return;}
            video.addEventListener('loadedmetadata', ready);video.addEventListener('error', fail);
            timer = setTimeout(() => {cleanup();reject(Error('MP4 metadata timed out'));}, 15000);video.load();
          });
          video.currentTime = 0;
          await new Promise((resolve, reject) => {
            let timer;
            const cleanup = () => {clearTimeout(timer);video.removeEventListener('timeupdate', time);video.removeEventListener('error', fail);};
            const time = () => {result.timeupdates++;if (video.currentTime > 0 && !video.paused && video.readyState >= 2) {cleanup();resolve();}};
            const fail = () => {cleanup();reject(Error(`MP4 playback error ${video.error?.code ?? ''}`));};
            video.addEventListener('timeupdate', time);video.addEventListener('error', fail);
            timer = setTimeout(() => {cleanup();reject(Error('No positive actual MP4 timeupdate'));}, 15000);
            video.play().catch(error => {cleanup();reject(error);});
          });
          Object.assign(result, {currentTime: video.currentTime, duration: video.duration, width: video.videoWidth,
            height: video.videoHeight, readyState: video.readyState,
            ok: video.currentTime > 0 && result.timeupdates > 0 && video.videoWidth > 0 && video.videoHeight > 0});
        } catch (error) {result.error = error.message;}
        finally {video.pause();result.pausedAfterCheck = video.paused;}
        return result;
      }, index);
      entry.videos.push(playback);
      console.log(`gallery ${engine}: MP4 ${index + 1}/${count} ${playback.ok ? 'played' : 'FAILED'} ${playback.path}`);
    }
    check(count > 0 && entry.videos.every(video => video.ok && video.controls && video.playsInline && video.pausedAfterCheck), `${engine}: an MP4 failed real playback or native controls/playsinline`);
    entry.links = await checkLinks(context, page);
    check(entry.links.results.every(link => link.ok), `${engine}: broken local gallery/report/source link`);
    await page.evaluate(() => scrollTo(0, 0));entry.expandedLayout = await layout(page);
    check(entry.closedLayout.noHorizontalOverflow && entry.expandedLayout.noHorizontalOverflow
      && entry.expandedLayout.details === entry.expandedLayout.openDetails, `${engine}: horizontal overflow or unopened details`);
    const file = `gallery-qa/${engine}-390-expanded.png`;
    await page.screenshot({path: path.join(output, file), scale: 'css'});
    const shot = await fs.readFile(path.join(output, file));
    report.screenshots.push({file, engine, width: 390, height: 844, sha256: digest(shot),
      source: 'Actual expanded gallery viewport; not a game screenshot or physical-phone capture'});
    check(entry.pageErrors.length === 0 && entry.consoleErrors.length === 0 && entry.consoleWarnings.length === 0
      && entry.httpErrors.length === 0 && entry.failedRequests.length === 0, `${engine}: browser/console/HTTP/request errors`);
    entry.counts = {details: entry.expandedLayout.details, openDetails: entry.expandedLayout.openDetails,
      imageElementsDecoded: entry.images.length, uniqueImageFilesDecoded: new Set(entry.images.map(image => image.path)).size,
      videoElementsPlayed: entry.videos.length, uniqueMp4FilesPlayed: new Set(entry.videos.map(video => video.path)).size,
      uniqueLocalFilesChecked: entry.links.uniqueLocalFiles, badLinks: entry.links.results.filter(link => !link.ok).length};
    entry.complete = true;
  } catch (error) {entry.errors.push(error.stack ?? String(error));report.errors.push(`${engine}: ${error.message}`);}
  finally {await context.close();await browser.close();}
}

try {
  await qa('chromium', chromium);await qa('webkit', webkit);
  check(report.cases.length === 2 && report.cases.every(entry => entry.complete), 'Incomplete two-engine actual gallery QA');
  check(digest(await fs.readFile(indexPath)) === report.gallerySha256 && digest(await fs.readFile(statusPath)) === report.galleryStatusSha256,
    'Gallery changed while QA was running; rebuild and rerun after finalization');
  for (const [file, hash] of Object.entries(receiptHashes)) check(digest(await fs.readFile(path.join(output, file))) === hash, `${file} changed during final gallery QA`);
} catch (error) {report.errors.push(error.stack ?? String(error));}
finally {
  report.endedAt = Date.now();report.complete = report.errors.length === 0;
  await fs.writeFile(path.join(output, 'gallery-layout.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({file: path.join(output, 'gallery-layout.json'), sourceCommit: report.sourceCommit,
    zipSha256: report.zipSha256, gallerySha256: report.gallerySha256, cases: report.cases.map(entry => ({engine: entry.engine, complete: entry.complete, counts: entry.counts})), errors: report.errors.length}));
  if (!report.complete) process.exitCode = 1;
}
