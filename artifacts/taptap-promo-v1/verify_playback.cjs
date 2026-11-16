/* Decode the exported MP4 over real HTTP in two engines and ordinary phone layouts. */
const { chromium, webkit } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const url = process.env.PROMO_MEDIA_URL || 'http://127.0.0.1:4473/final-portrait.mp4';
const report = { url, cases: [], scope: 'Actual exported H.264/AAC playback over HTTP. Desktop browser engines at mobile dimensions. Physical phone remains pending.' };
let current = null;

(async () => {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    try {
      for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }]) {
        current = { engine: name, viewport, phase: 'open' };
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        // Keep the media element and its analyser on the same actual HTTP origin.
        await page.goto(new URL('verification.json', url).href);
        await page.setContent(`<meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#151324}video{width:100%;height:100%;object-fit:contain}button{position:fixed;top:0;left:0}</style><video src="${url}" playsinline preload="auto"></video><button>播放检查</button>`);
        await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
        await page.locator('button').evaluate(button => {
          button.onclick = async () => {
            const video = document.querySelector('video');
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            window.analyser = audioContext.createAnalyser();
            audioContext.createMediaElementSource(video).connect(analyser);
            analyser.connect(audioContext.destination);
            await audioContext.resume();
            await video.play();
            button.remove();
          };
        });
        await page.locator('button').click();
        await page.waitForFunction(() => document.querySelector('video').currentTime > .7);
        const audio = await page.evaluate(async () => {
          const data = new Float32Array(analyser.fftSize);
          let maxRms = 0;
          for (let i = 0; i < 20; i++) {
            analyser.getFloatTimeDomainData(data);
            maxRms = Math.max(maxRms, Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length));
            await new Promise(resolve => setTimeout(resolve, 35));
          }
          return { contextState: audioContext.state, rms: maxRms };
        });
        assert(audio.rms > .001 && audio.rms < 1, JSON.stringify({ engine: name, viewport, audio }));
        await page.locator('video').evaluate(video => video.pause());
        const metadata = await page.locator('video').evaluate(video => ({
          duration: video.duration, width: video.videoWidth, height: video.videoHeight,
          error: video.error?.message || null, readyState: video.readyState,
        }));
        assert.equal(metadata.width, 1080);
        assert.equal(metadata.height, 1920);
        assert.equal(metadata.duration, 54);
        assert.equal(metadata.error, null);
        const seeks = [];
        for (const second of [.8, 5, 18.3, 24, 30, 37.8, 51.5, 53.6]) {
          current.phase = 'seek ' + second;
          const presentedTime = await page.locator('video').evaluate((video, second) => new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(Error('Seek timed out')), 7000);
            if (video.requestVideoFrameCallback) {
              function frame(now, metadata) {
                if (Math.abs(metadata.mediaTime - second) < .08) {
                  video.pause();
                  clearTimeout(timeout);
                  resolve(metadata.mediaTime);
                } else video.requestVideoFrameCallback(frame);
              }
              video.requestVideoFrameCallback(frame);
            } else {
              video.addEventListener('seeked', () => {
                setTimeout(() => { clearTimeout(timeout); resolve(video.currentTime); }, 200);
              }, { once: true });
            }
            video.currentTime = second;
            void video.play().catch(reject);
          }), second);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert(await page.locator('video').evaluate(video => video.readyState >= 2 && !video.error));
          seeks.push({ requested: second, presentedTime });
          if ([18.3, 24, 51.5].includes(second)) {
            await page.screenshot({ path: path.join(__dirname, 'review', `${name}-${viewport.width}-${second}.png`) });
          }
        }
        let continuous = null;
        if (process.argv.includes('--continuous') && viewport.width === 390) {
          continuous = await page.locator('video').evaluate(video => new Promise((resolve, reject) => {
            const began = performance.now();
            const samples = [];
            const waiting = [];
            const timeout = setTimeout(() => reject(Error('Continuous playback timed out')), 60000);
            function progress() { samples.push({ wall: (performance.now() - began) / 1000, time: video.currentTime }); }
            function wait() { waiting.push(video.currentTime); }
            video.addEventListener('timeupdate', progress);
            video.addEventListener('waiting', wait);
            video.addEventListener('ended', () => {
              clearTimeout(timeout);
              video.removeEventListener('timeupdate', progress);
              video.removeEventListener('waiting', wait);
              resolve({ wallSeconds: (performance.now() - began) / 1000, samples, waiting });
            }, { once: true });
            video.currentTime = 0;
            void video.play().catch(reject);
          }));
          assert(continuous.wallSeconds > 53 && continuous.wallSeconds < 58);
          assert(continuous.samples.some(sample => sample.time > 53.5));
        }
        assert.deepEqual(errors, []);
        report.cases.push({ engine: name, viewport, audio, metadata, seeks, continuous, errors });
        await context.close();
      }
    } finally { await browser.close(); }
  }
  report.passed = report.cases.length;
  fs.writeFileSync(path.join(__dirname, 'playback-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS', report.passed, 'HTTP playback cases, audio and32 seeks');
})().catch(error => {
  report.failure = { ...current, message: String(error) };
  fs.writeFileSync(path.join(__dirname, 'playback-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify(report.failure));
  process.exitCode = 1;
});
