/* Isolated real-browser audio checks. No original game save or game PRNG is loaded. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "../../../../..");
const { chromium, webkit } = require(
  path.join(ROOT, "node_modules/@playwright/test"),
);
const engine =
  process.env.SURVIVOR_AUDIO_ENGINE ||
  path.join(ROOT, "prototypes/salvage-survivor-demo/src/audio-engine.js");
const audioRoot = path.join(
  ROOT,
  "prototypes/salvage-survivor-demo/assets/audio",
);
const ids = [
  "cannon",
  "drone",
  "arc",
  "missile",
  "blade",
  "shield",
  "prism",
  "gravity",
  "hit",
  "explosion",
  "pickup",
  "scrap",
  "heal",
  "hurt",
  "upgrade",
  "evolution",
  "fusion",
  "boss",
  "enemyCharge",
  "enemyFire",
  "victory",
  "defeat",
];
const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sourceSha = hash(engine);
const reportPath = process.env.SURVIVOR_AUDIO_REPORT
  ? path.resolve(process.env.SURVIVOR_AUDIO_REPORT)
  : path.join(__dirname, "browser-verification.json");
const evidenceRoot = process.env.SURVIVOR_AUDIO_REPORT
  ? path.join(path.dirname(reportPath), "audio-recordings")
  : path.join(__dirname, "auditions");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.mkdirSync(evidenceRoot, { recursive: true });
const report = {
  sourcePath: path.relative(ROOT, engine),
  sourceSha256: sourceSha,
  testSourceSha256: hash(__filename),
  cases: [],
  errors: [],
  physicalPhoneTested: false,
  scope:
    "Real HTTP Chromium/WebKit audio contexts and streaming media. End-boundary seeking and visibility override are explicitly isolated QA. Hearing and physical-phone audio pending.",
};
function encodePcmWav(samples, sampleRate) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let index = 0; index < samples.length; index++)
    bytes.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767),
      44 + index * 2,
    );
  return bytes;
}
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/capture-worklet.js") {
    response.setHeader("Content-Type", "application/javascript");
    response.end(`class ActualBusCapture extends AudioWorkletProcessor {
   process(inputs) {
    const channel=inputs[0]?.[0];
    if(channel?.length) {
     const copy=channel.slice();
     this.port.postMessage(copy.buffer,[copy.buffer]);
    }
    return true;
   }
  }
  registerProcessor('actual-bus-capture',ActualBusCapture);`);
    return;
  }
  if (url.pathname === "/audio-engine.js") {
    response.setHeader("Content-Type", "application/javascript");
    response.end(fs.readFileSync(engine));
    return;
  }
  if (url.pathname.startsWith("/assets/audio/")) {
    const name = path.basename(url.pathname),
      file = path.join(audioRoot, name);
    if (!fs.existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    const stat = fs.statSync(file),
      range = /bytes=(\d+)-(\d*)/.exec(request.headers.range || "");
    response.setHeader("Content-Type", "audio/mpeg");
    response.setHeader("Accept-Ranges", "bytes");
    if (range) {
      const from = +range[1],
        to = range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
      response.writeHead(206, {
        "Content-Range": `bytes ${from}-${to}/${stat.size}`,
        "Content-Length": to - from + 1,
      });
      fs.createReadStream(file, { start: from, end: to }).pipe(response);
    } else {
      response.setHeader("Content-Length", stat.size);
      fs.createReadStream(file).pipe(response);
    }
    return;
  }
  response.setHeader("Content-Type", "text/html");
  const unsupported = url.searchParams.has("unsupported");
  const stalled = url.searchParams.has("stalled-context");
  const pendingMedia = url.searchParams.has("pending-media");
  response.end(
    '<!doctype html><meta charset="utf-8"><button id="unlock">Enable audio</button>' +
      (unsupported
        ? "<script>window.AudioContext=undefined;window.webkitAudioContext=undefined;</script>"
        : "") +
      (stalled
        ? '<script>const NativeContext=window.AudioContext;window.AudioContext=function(options){const audio=new NativeContext(options);let prototype=NativeContext.prototype;while(prototype&&!Object.getOwnPropertyDescriptor(prototype,"state"))prototype=Object.getPrototypeOf(prototype);const getter=Object.getOwnPropertyDescriptor(prototype,"state").get;let held=true,calls=0;const resume=audio.resume.bind(audio);Object.defineProperty(audio,"state",{configurable:true,get:()=>held?"suspended":getter.call(audio)});audio.resume=()=>{if(++calls===1)return new Promise(()=>{});held=false;return resume();};return audio;};</script>'
        : "") +
      '<script>window.audioTestMedia=[];const OriginalAudio=window.Audio;window.Audio=function(...args){const element=new OriginalAudio(...args);window.audioTestMedia.push(element);return element;};window.Audio.prototype=OriginalAudio.prototype;window.audioGameRandomCalls=0;Math.random=()=>{window.audioGameRandomCalls++;throw Error("Audio consumed game randomness");};</script>' +
      (pendingMedia
        ? "<script>const createAudio=window.Audio;window.Audio=function(...args){const element=new createAudio(...args),play=element.play.bind(element),listen=element.addEventListener.bind(element);element.play=()=>{play().catch(()=>{});return new Promise(()=>{});};element.addEventListener=(type,...args)=>{if(type!=='playing')listen(type,...args);};return element;};window.Audio.prototype=createAudio.prototype;</script>"
        : "") +
      '<script src="/audio-engine.js"></script><script>document.getElementById("unlock").onclick=async()=>{window.audioUnlocked=await SurvivorAudio.unlock();SurvivorAudio.setState({playing:true,paused:false,phase:2});};</script>',
  );
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const entry = "http://127.0.0.1:" + server.address().port;
  for (const [name, driver] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    const browser = await driver.launch();
    try {
      const slow = await browser.newPage();
      await slow.route("**/*.mp3", async (route) => {
        await sleep(5000);
        try {
          await route.continue();
        } catch (_) {}
      });
      await slow.goto(entry);
      const unlockStarted = Date.now();
      await slow.locator("#unlock").click();
      await slow.waitForFunction(() => window.audioUnlocked === true, null, {
        timeout: 2500,
      });
      const unlockMs = Date.now() - unlockStarted;
      assert(unlockMs < 2500);
      assert.equal(
        await slow.evaluate(() => SurvivorAudio.play("cannon")),
        true,
      );
      report.cases.push({
        engine: name,
        id: "five-second-music-network-delay-does-not-block-unlock-or-sfx",
        unlockMs,
        state: await slow.evaluate(() => SurvivorAudio.inspect()),
      });
      await slow.close();
      const stalled = await browser.newPage();
      await stalled.goto(entry + "/?stalled-context=1");
      const stallStarted = Date.now();
      await stalled.locator("#unlock").click();
      await stalled.waitForFunction(
        () => window.audioUnlocked === false,
        null,
        { timeout: 2500 },
      );
      const stallMs = Date.now() - stallStarted;
      assert(stallMs < 2500);
      const heldState = await stalled.evaluate(() => SurvivorAudio.inspect());
      assert.equal(heldState.totals.contextWaitTimeouts, 1);
      await stalled.locator("#unlock").click();
      await stalled.waitForFunction(() => window.audioUnlocked === true, null, {
        timeout: 2500,
      });
      await stalled.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.activeMedia === 1,
        null,
        { timeout: 15000 },
      );
      report.cases.push({
        engine: name,
        id: "stalled-audio-context-resume-times-out-and-next-gesture-recovers",
        stallMs,
        state: await stalled.evaluate(() => SurvivorAudio.inspect()),
      });
      await stalled.close();
      const pendingMediaPage = await browser.newPage();
      await pendingMediaPage.goto(entry + "/?pending-media=1");
      await pendingMediaPage.locator("#unlock").click();
      await pendingMediaPage.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.mediaStarts === 1,
        null,
        { timeout: 15000 },
      );
      await pendingMediaPage.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.positions[0].seconds >= 0.2,
        null,
        { timeout: 15000 },
      );
      await pendingMediaPage.evaluate(() => {
        const element = window.audioTestMedia[0];
        element.currentTime = element.duration - 2.1;
      });
      await pendingMediaPage.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.fadesCompleted === 1,
        null,
        { timeout: 15000 },
      );
      const pendingState = await pendingMediaPage.evaluate(() =>
        SurvivorAudio.inspect(),
      );
      assert.equal(pendingState.externalMusic.activeTrack, "Nebula Loop");
      assert.equal(pendingState.externalMusic.activeMedia, 1);
      assert.equal(pendingState.externalMusic.mediaFailures, 0);
      report.cases.push({
        engine: name,
        id: "actual-media-clock-confirms-start-and-crossfade-with-pending-promises-and-missing-playing-events",
        state: pendingState,
      });
      await pendingMediaPage.close();
      const musicLevels = await browser.newPage();
      await musicLevels.goto(entry);
      await musicLevels.locator("#unlock").click();
      await musicLevels.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.positions[0]?.seconds >= 5,
        null,
        { timeout: 15000 },
      );
      for (const title of ["Nebula Groove", "Nebula Loop"]) {
        if (title === "Nebula Loop") {
          await musicLevels.evaluate(() => {
            const media = window.audioTestMedia[0];
            media.currentTime = media.duration - 2.1;
          });
          await musicLevels.waitForFunction(
            () => {
              const audio = SurvivorAudio.inspect();
              return (
                audio.externalMusic.activeTrack === "Nebula Loop" &&
                audio.externalMusic.positions[1].seconds >= 5
              );
            },
            null,
            { timeout: 15000 },
          );
        }
        const measured = await musicLevels.evaluate(async () => {
          const captureContext = new AudioContext();
          await captureContext.resume();
          const source = captureContext.createMediaStreamSource(
              SurvivorAudio.recordingStream(),
            ),
            analyser = captureContext.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          const silent = captureContext.createGain();
          silent.gain.value = 0;
          analyser.connect(silent);
          silent.connect(captureContext.destination);
          await new Promise((resolve) => setTimeout(resolve, 150));
          const before = SurvivorAudio.inspect(),
            data = new Float32Array(analyser.fftSize);
          let square = 0,
            peak = 0,
            samples = 0;
          for (let index = 0; index < 20; index++) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            analyser.getFloatTimeDomainData(data);
            for (const value of data) {
              square += value * value;
              peak = Math.max(peak, Math.abs(value));
              samples++;
            }
          }
          const after = SurvivorAudio.inspect();
          source.disconnect();
          analyser.disconnect();
          silent.disconnect();
          await captureContext.close();
          const rms = Math.sqrt(square / samples);
          return {
            rms,
            rmsDbfs: 20 * Math.log10(rms),
            peak,
            peakDbfs: 20 * Math.log10(peak),
            before,
            after,
          };
        });
        assert(measured.rms > 0.00001);
        assert.equal(measured.before.gains.duck, 1);
        assert.equal(measured.after.gains.duck, 1);
        assert(Math.abs(measured.before.gains.music - 0.25) < 0.001);
        assert.equal(measured.before.settings.master, 0.8);
        assert(
          measured.before.externalMusic.positions.every(
            (slot) => slot.elementVolume === 1,
          ),
        );
        report.cases.push({
          engine: name,
          id: "default-stable-music-mix-level-without-duck",
          title,
          window:
            "One second sampled after media position5s, following the2s entry/crossfade; isolated no-SFX QA",
          ...measured,
        });
      }
      await musicLevels.close();
      const page = await browser.newPage();
      page.on("pageerror", (error) =>
        report.errors.push(name + ": " + error.message),
      );
      await page.goto(entry);
      let state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.contextCreated, false);
      assert.equal(state.externalMusic.mediaElements, 0);
      assert.equal(state.schedulerCount, 0);
      assert.equal(
        await page.evaluate(() => SurvivorAudio.recordingStream()),
        null,
      );
      assert.equal(
        await page.evaluate(() => SurvivorAudio.play("cannon")),
        false,
      );
      report.cases.push({
        engine: name,
        id: "no-autoplay-context-or-media",
        state,
      });
      await page.locator("#unlock").click();
      await page.waitForFunction(() => window.audioUnlocked === true, {
        timeout: 15000,
      });
      await page.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.activeMedia === 1,
        { timeout: 15000 },
      );
      await page.waitForTimeout(350);
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.externalMusic.mediaElements, 2);
      assert.equal(state.externalMusic.fullTrackDecodeCalls, 0);
      assert.equal(state.schedulerCount, 1);
      assert(state.externalMusic.positions.every((slot) => slot.warmed));
      report.cases.push({
        engine: name,
        id: "trusted-gesture-preunlocks-two-streams",
        state,
      });
      await page.evaluate((ids) => {
        for (let i = 0; i < 200; i++) {
          SurvivorAudio.setState({ playing: true, paused: false, phase: 2 });
          for (const id of ids) SurvivorAudio.play(id, { evolved: true });
        }
      }, ids);
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.schedulerCount, 1);
      assert.equal(state.musicStarts, 1);
      assert(
        state.maxVoices <= 24 &&
          state.maxSfx <= 18 &&
          state.maxTotalVoices <= 24 &&
          state.rateDrops > 0,
      );
      report.cases.push({
        engine: name,
        id: "bounded-polyphony-rate-limit-and-one-scheduler",
        state,
      });
      await page.evaluate(() =>
        SurvivorAudio.setState({
          playing: true,
          paused: false,
          phase: 3,
          upgrade: true,
        }),
      );
      assert.equal(
        (await page.evaluate(() => SurvivorAudio.inspect())).musicStarts,
        1,
      );
      await page.evaluate(() =>
        SurvivorAudio.setState({ playing: true, paused: true, upgrade: false }),
      );
      await page.waitForTimeout(100);
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.schedulerCount, 0);
      assert.equal(state.activeVoices, 0);
      assert.equal(state.externalMusic.activeMedia, 0);
      const position = state.externalMusic.positions.find(
        (_, index) => index === 0,
      ).seconds;
      report.cases.push({
        engine: name,
        id: "pause-stops-streams-sfx-and-scheduler",
        state,
      });
      await page.locator("#unlock").click();
      await page.waitForFunction(() => {
        const audio = SurvivorAudio.inspect();
        return (
          audio.externalMusic.activeMedia === 1 &&
          audio.externalMusic.mediaStarts >= 2
        );
      });
      await page.waitForTimeout(150);
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.totals.contexts, 1);
      assert.equal(state.schedulerCount, 1);
      assert(state.externalMusic.positions[0].seconds >= position - 0.1);
      report.cases.push({
        engine: name,
        id: "resume-preserves-position-with-one-context",
        state,
      });
      const recording = await page.evaluate(async () => {
        const stream = SurvivorAudio.recordingStream();
        const sameStream = stream === SurvivorAudio.recordingStream();
        const captureContext = new AudioContext();
        await captureContext.resume();
        const source = captureContext.createMediaStreamSource(stream),
          analyser = captureContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const silent = captureContext.createGain();
        silent.gain.value = 0;
        analyser.connect(silent);
        silent.connect(captureContext.destination);
        // Capture actual PCM without depending on a host's MediaRecorder encoders.
        await captureContext.audioWorklet.addModule("/capture-worklet.js");
        const capture = new AudioWorkletNode(
          captureContext,
          "actual-bus-capture",
        );
        const blocks = [];
        let accepting = true;
        capture.port.onmessage = (event) => {
          if (accepting) blocks.push(new Float32Array(event.data));
        };
        source.connect(capture);
        capture.connect(captureContext.destination);
        SurvivorAudio.configure({ music: 0.5, sfx: 0 });
        await new Promise((resolve) => setTimeout(resolve, 750));
        const sample = () => {
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          return Math.sqrt(
            data.reduce((sum, value) => sum + value * value, 0) / data.length,
          );
        };
        const musicRms = sample();
        SurvivorAudio.setState({ playing: false, paused: false });
        await new Promise((resolve) => setTimeout(resolve, 150));
        SurvivorAudio.configure({ sfx: 0.55 });
        const played = SurvivorAudio.play("victory");
        await new Promise((resolve) => setTimeout(resolve, 250));
        const sfxRms = sample();
        await new Promise((resolve) => setTimeout(resolve, 600));
        accepting = false;
        const pcm = [];
        for (const block of blocks) for (const value of block) pcm.push(value);
        const sampleRate = captureContext.sampleRate;
        source.disconnect();
        analyser.disconnect();
        silent.disconnect();
        capture.disconnect();
        capture.port.close();
        await captureContext.close();
        SurvivorAudio.configure({ music: 0.25 });
        SurvivorAudio.setState({ playing: true, paused: false });
        return {
          sameStream,
          musicRms,
          sfxRms,
          played,
          mimeType: "audio/wav",
          pcm,
          sampleRate,
          channels: 1,
          tracks: stream.getAudioTracks().map((track) => ({
            kind: track.kind,
            readyState: track.readyState,
          })),
          state: SurvivorAudio.inspect(),
        };
      });
      assert(recording.sameStream && recording.played);
      assert.equal(recording.tracks.length, 1);
      assert(
        recording.musicRms > 0.00001 && recording.sfxRms > 0.00001,
        "Recording stream must contain music and SFX " +
          JSON.stringify({
            engine: name,
            music: recording.musicRms,
            sfx: recording.sfxRms,
            played: recording.played,
          }),
      );
      assert(
        recording.pcm.length >= recording.sampleRate,
        "Capture must include at least one second of actual live samples",
      );
      recording.sampleCount = recording.pcm.length;
      recording.pcmRms = Math.sqrt(
        recording.pcm.reduce((sum, value) => sum + value * value, 0) /
          recording.sampleCount,
      );
      assert(
        recording.pcmRms > 0.00001,
        "Saved PCM must include actual non-silent mixed audio",
      );
      const captureFile = path.join(
        evidenceRoot,
        name + "-actual-mixed-recording.wav",
      );
      fs.writeFileSync(
        captureFile,
        encodePcmWav(recording.pcm, recording.sampleRate),
      );
      delete recording.pcm;
      recording.file = path.relative(ROOT, captureFile);
      recording.bytes = fs.statSync(captureFile).size;
      recording.sha256 = hash(captureFile);
      assert(recording.bytes > 1000);
      assert.equal(recording.state.recording.audioTracks, 1);
      report.cases.push({
        engine: name,
        id: "read-only-recording-stream-has-actual-music-and-sfx-without-microphone",
        ...recording,
      });
      await page.waitForFunction(() => {
        const audio = SurvivorAudio.inspect();
        return (
          audio.externalMusic.activeMedia === 1 &&
          audio.externalMusic.mediaStarts >= 3
        );
      });
      // Explicit media-boundary QA, not natural3-minute progression.
      await page.evaluate(() => {
        const media = window.audioTestMedia[0];
        media.currentTime = media.duration - 2.1;
      });
      await page.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.crossfading,
        null,
        { timeout: 15000 },
      );
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.externalMusic.activeMedia, 2);
      assert.equal(state.schedulerCount, 1);
      report.cases.push({
        engine: name,
        id: "two-second-crossfade-streams-overlap-only-at-boundary",
        state,
      });
      await page.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.fadesCompleted >= 1,
        null,
        { timeout: 15000 },
      );
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.externalMusic.activeTrack, "Nebula Loop");
      assert.equal(state.externalMusic.activeMedia, 1);
      assert.equal(state.externalMusic.fullTrackDecodeCalls, 0);
      report.cases.push({
        engine: name,
        id: "second-approved-track-continues-and-old-stream-pauses",
        state,
      });
      await page.waitForTimeout(1100);
      await page.evaluate(() =>
        SurvivorAudio.setState({ playing: false, paused: false }),
      );
      assert.equal(
        await page.evaluate(() => SurvivorAudio.play("victory")),
        true,
      );
      await page.waitForTimeout(50);
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.schedulerCount, 0);
      assert.equal(state.externalMusic.activeMedia, 0);
      assert(state.sfxVoices > 0);
      report.cases.push({
        engine: name,
        id: "results-allow-victory-tail-without-music",
        state,
      });
      await page.evaluate(() => SurvivorAudio.configure({ muted: true }));
      await page.waitForTimeout(50);
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.activeVoices, 0);
      assert.equal(state.schedulerCount, 0);
      assert.equal(
        await page.evaluate(() => SurvivorAudio.play("cannon")),
        false,
      );
      report.cases.push({ engine: name, id: "muted-stops-all-voices", state });
      await page.evaluate(() => {
        SurvivorAudio.configure({
          muted: false,
          musicUrl: "./assets/audio/missing.mp3",
        });
        SurvivorAudio.setState({ playing: true, paused: false });
      });
      await page.locator("#unlock").click();
      await page.waitForFunction(
        () => SurvivorAudio.inspect().externalMusic.mode === "synthesis",
        null,
        { timeout: 15000 },
      );
      state = await page.evaluate(() => SurvivorAudio.inspect());
      assert.equal(state.schedulerCount, 1);
      assert.equal(state.externalMusic.activeMedia, 0);
      report.cases.push({
        engine: name,
        id: "broken-music-falls-back-without-stopping-game-audio",
        state,
      });
      const randomCalls = await page.evaluate(
        () => window.audioGameRandomCalls,
      );
      assert.equal(randomCalls, 0);
      const unsupported = await browser.newPage();
      await unsupported.goto(entry + "/?unsupported=1");
      assert.equal(
        await unsupported.evaluate(() => SurvivorAudio.unlock()),
        false,
      );
      assert.equal(
        await unsupported.evaluate(() => SurvivorAudio.play("gravity")),
        false,
      );
      assert.equal(
        await unsupported.evaluate(() => SurvivorAudio.recordingStream()),
        null,
      );
      await unsupported.evaluate(() => {
        SurvivorAudio.configure({ music: 0.3, sfx: 0.4 });
        SurvivorAudio.setState({ playing: true });
      });
      report.cases.push({
        engine: name,
        id: "unsupported-context-is-safe",
        state: await unsupported.evaluate(() => SurvivorAudio.inspect()),
      });
      await unsupported.close();
      for (const cue of ["enemyCharge", "enemyFire"]) {
        const measured = await page.evaluate(async (id) => {
          const { buffer, stats } = await SurvivorAudio.renderOffline(id);
          const pcm = buffer.getChannelData(0);
          let square = 0,
            peak = 0;
          for (const sample of pcm) {
            square += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
          }
          return {
            rms: Math.sqrt(square / pcm.length),
            peak,
            played: stats.played[id],
          };
        }, cue);
        assert(
          measured.rms > 0.0001 && measured.peak > 0.001 && measured.peak < 1,
        );
        assert.equal(measured.played, 1);
        report.cases.push({
          engine: name,
          id: cue + "-actual-offline-signal",
          measured,
        });
      }
      await page.close();
    } catch (error) {
      report.failedEngine = name;
      report.openPages = [];
      for (const context of browser.contexts())
        for (const page of context.pages()) {
          try {
            report.openPages.push(
              await page.evaluate(() => ({
                url: location.href,
                unlocked: window.audioUnlocked,
                state: SurvivorAudio.inspect(),
              })),
            );
          } catch (diagnosticError) {
            report.openPages.push({ diagnosticError: String(diagnosticError) });
          }
        }
      throw error;
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(report.errors, []);
  assert.equal(
    hash(engine),
    sourceSha,
    "Audio source changed during browser checks",
  );
  report.passed = report.cases.length;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "PASS" +
      report.passed +
      " audio cases in Chromium/WebKit; phone/hearing pending",
  );
})()
  .catch((error) => {
    report.failure = error.stack;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => server.close());
