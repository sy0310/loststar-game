/* Render the repository's original synthesized fallback theme, without streamed MP3s. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'releases/taptap-promo-v1-private');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(process.env.PROMO_URL || 'http://127.0.0.1:4472/');
    await page.waitForFunction(() => SurvivorDemo.ready());
    const result = await page.evaluate(async () => {
      const { buffer } = await SurvivorAudio.renderOffline('music', { seconds: 60 });
      const length = buffer.length;
      const wav = new ArrayBuffer(44 + length * 4);
      const view = new DataView(wav);
      function text(at, value) { [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0))); }
      text(0, 'RIFF'); view.setUint32(4, 36 + length * 4, true); text(8, 'WAVE');
      text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, 2, true); view.setUint32(24, buffer.sampleRate, true);
      view.setUint32(28, buffer.sampleRate * 4, true); view.setUint16(32, 4, true);
      view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length * 4, true);
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      for (let i = 0; i < length; i++) {
        view.setInt16(44 + i * 4, Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), true);
        view.setInt16(46 + i * 4, Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), true);
      }
      let binary = '';
      const bytes = new Uint8Array(wav);
      for (let i = 0; i < bytes.length; i += 16384)
        binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      return { data: btoa(binary), sampleRate: buffer.sampleRate, seconds: buffer.duration };
    });
    const file = path.join(out, 'original-project-theme-60s.wav');
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    const source = fs.readFileSync(path.join(root, 'prototypes/salvage-survivor-demo/src/audio-engine.js'));
    fs.writeFileSync(path.join(out, 'music-provenance.json'), JSON.stringify({
      source: 'prototypes/salvage-survivor-demo/src/audio-engine.js',
      sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
      method: "SurvivorAudio.renderOffline('music', {seconds:60})",
      containsUserMp3: false, containsVoice: false, sampleRate: result.sampleRate, seconds: result.seconds,
      copyrightBasis: 'Original synthesized SFX and fallback score authored within this project',
    }, null, 2) + '\n');
    console.log(file);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
