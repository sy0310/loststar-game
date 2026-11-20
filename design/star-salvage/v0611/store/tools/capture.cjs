/* Capture compositor frames with their original wall-clock timestamps, including DOM cards and HUD. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");
const root = path.resolve(__dirname, "../../../../..");
const { steer } = require(
  path.join(root, "prototypes/salvage-survivor-demo/tests/capture-v065.cjs"),
);
const raw = path.join(root, "releases/store-v0611/raw");
const source = "2322f30a696d90a73e4105bdff2049392eca2eeb";
const url = process.env.STORE_URL || "http://127.0.0.1:4486/loststar-survivor/";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function record(scene) {
  const folder = path.join(raw, scene);
  fs.mkdirSync(folder, { recursive: true });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 396, height: 704 },
      deviceScaleFactor: 2,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.SurvivorDemo?.ready());
    const build = await page.evaluate(() => window.SurvivorBuild);
    assert.equal(build.commit, source);
    assert.equal(build.dirty, false);
    assert(await page.evaluate(() => !window.SurvivorQA));
    let checkpoint = null;
    if (scene !== "opening") {
      const { snapshot, ...info } = JSON.parse(
        fs.readFileSync(path.join(raw, "../checkpoints", scene + ".json")),
      );
      checkpoint = info;
      await page.evaluate(
        async ({ snapshot, perks }) => {
          const store = await SurvivorPersistence.create();
          const { record } = await store.read();
          Object.assign(record.profile, perks);
          await new Promise((resolve, reject) => {
            const open = indexedDB.open(store.name, 1);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result,
                tx = db.transaction("state", "readwrite");
              tx.objectStore("state").put(record, "current");
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onabort = () => reject(tx.error);
            };
          });
          const restored = JSON.parse(snapshot, (_, v) =>
            v?.storeCaptureSet ? new Set(v.storeCaptureSet) : v,
          );
          await store.begin("store-" + crypto.randomUUID(), restored);
          store.close();
        },
        { snapshot: JSON.stringify(snapshot), perks: info.perks },
      );
      await page.reload();
      await page.waitForFunction(() => SurvivorDemo.ready());
      await page.locator("#continueBtn").waitFor({ state: "visible" });
    }
    const session = await ctx.newCDPSession(page);
    const frames = [];
    session.on("Page.screencastFrame", (event) => {
      const name = "f" + String(frames.length).padStart(5, "0") + ".jpg";
      fs.writeFileSync(
        path.join(folder, name),
        Buffer.from(event.data, "base64"),
      );
      frames.push({ name, at: event.metadata.timestamp });
      session
        .send("Page.screencastFrameAck", { sessionId: event.sessionId })
        .catch(() => {});
    });
    await session.send("Page.startScreencast", {
      format: "jpeg",
      quality: 94,
      maxWidth: 792,
      maxHeight: 1408,
      everyNthFrame: 1,
    });
    await page.waitForTimeout(450);
    const start = Date.now() / 1000;
    await page
      .locator(scene === "opening" ? "#startBtn" : "#continueBtn")
      .tap();
    await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
    if (scene === "opening") {
      await page.evaluate(() => {
        const stream = SurvivorAudio.recordingStream();
        if (!stream?.getAudioTracks().length)
          throw Error("Game audio unavailable");
        const rec = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });
        const chunks = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        window.storeAudioDone = new Promise(
          (resolve) =>
            (rec.onstop = async () => {
              const a = new Uint8Array(await new Blob(chunks).arrayBuffer());
              let s = "";
              for (let i = 0; i < a.length; i += 8192)
                s += String.fromCharCode(...a.subarray(i, i + 8192));
              resolve(btoa(s));
            }),
        );
        window.storeAudioStart = Date.now() / 1000;
        window.stopStoreAudio = () => rec.stop();
        rec.start();
      });
    }
    const samples = [];
    let direction = -1,
      held = false,
      cardSince = 0,
      lastPhoto = 0;
    while (Date.now() / 1000 - start < (scene === "opening" ? 37 : 7)) {
      const g = await page.evaluate(() => SurvivorDemo.state());
      const now = Date.now() / 1000;
      const sample = {
        at: now,
        mode: g.mode,
        time: g.time,
        kills: g.kills,
        level: g.level,
        x: g.p.x,
        y: g.p.y,
        hp: g.p.hp,
        enemies: g.enemy.length,
        visible: g.enemy.filter(
          (e) =>
            Math.abs(e.x - g.p.x) < 184 &&
            Math.abs(e.y - g.p.y) < 315 &&
            e.hp > 0,
        ).length,
        boss: g.enemy.find((e) => e.t === "boss" && e.hp > 0)?.bossProfile,
        arcs: g.arcs.length,
        wells: g.wells.length,
        active: g.active,
        evolved: g.evolved,
        fused: g.fused,
      };
      samples.push(sample);
      if (
        (scene !== "opening" && now - lastPhoto > 0.65) ||
        (scene === "opening" && g.mode === "upgrade" && !cardSince)
      ) {
        sample.still =
          "still-" + String(samples.length).padStart(3, "0") + ".png";
        await page.screenshot({ path: path.join(folder, sample.still) });
        lastPhoto = now;
      }
      if (g.mode === "upgrade") {
        if (held) {
          await page.mouse.up();
          held = false;
        }
        if (!cardSince) cardSince = now;
        if (now - cardSince > (scene === "opening" ? 2.3 : 0.28))
          await page.locator("#upgradeList .skill").first().tap();
      } else if (g.mode === "play") {
        cardSince = 0;
        if (!held) {
          await page.mouse.move(282, 582);
          await page.mouse.down();
          held = true;
        }
        direction = steer(g, direction, true);
        await page.mouse.move(
          282 + 40 * Math.cos((direction * Math.PI) / 4),
          582 + 40 * Math.sin((direction * Math.PI) / 4),
          { steps: 2 },
        );
      } else if (g.mode === "results") break;
      await sleep(105);
    }
    const end = Date.now() / 1000;
    let audioStart = null;
    if (scene === "opening") {
      audioStart = await page.evaluate(() => {
        window.stopStoreAudio();
        return window.storeAudioStart;
      });
      fs.writeFileSync(
        path.join(folder, "game-audio.webm"),
        Buffer.from(await page.evaluate(() => window.storeAudioDone), "base64"),
      );
    }
    await session.send("Page.stopScreencast");
    assert(frames.length > 60);
    assert.deepEqual(errors, []);
    assert(Math.abs(frames[0].at - start) < 4, "Unexpected screencast clock");
    const timeline = ["ffconcat version 1.0"];
    frames.forEach(({ name, at }, i) => {
      timeline.push("file '" + name + "'", "option framerate 1000");
      if (i + 1 < frames.length)
        timeline.push(
          "duration " + Math.max(0.001, frames[i + 1].at - at).toFixed(6),
        );
    });
    fs.writeFileSync(
      path.join(folder, "frames.ffconcat"),
      timeline.join("\n") + "\n",
    );
    const data = {
      scene,
      source,
      checkpoint,
      firstFrame: frames[0].at,
      frames: frames.length,
      start,
      end,
      audioStart,
      samples,
    };
    fs.writeFileSync(
      path.join(folder, "take.json"),
      JSON.stringify(data, null, 2),
    );
    console.log(
      scene,
      frames.length,
      "frames",
      samples.length,
      "samples",
      sampleSummary(samples),
    );
  } finally {
    await browser.close();
  }
}
function sampleSummary(samples) {
  return samples
    .filter((s) => s.mode === "play")
    .slice(-1)
    .map((s) => ({ time: s.time, kills: s.kills, level: s.level }));
}
(async () => {
  for (const scene of process.argv.slice(2)) await record(scene);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
