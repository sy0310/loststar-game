/* Real browser profiles across process close/reopen. Desktop metrics, not phone FPS. */
const { chromium, webkit } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const repairBenchmark = process.env.SURVIVOR_REPAIR_BENCHMARK === "1";
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4397/";
const output = path.resolve(
  process.env.SURVIVOR_COMPAT_OUT || "releases/survivor-compatibility.json",
);
async function open(type, folder) {
  return type.launchPersistentContext(folder, {
    headless: true,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
}
async function read(page) {
  return page.evaluate(async () => {
    const store = await SurvivorPersistence.create();
    const result = (await store.read()).record;
    store.close();
    return result;
  });
}
(async () => {
  const report = {
    source: null,
    scope:
      "Desktop Chromium/WebKit on actual fixed-package HTTP. Synthetic QA maximum combat is labelled. Physical phone, heat and lock-screen are pending.",
    engines: [],
  };
  for (const type of [chromium, webkit]) {
    const folder = fs.mkdtempSync(
      path.join(os.tmpdir(), "loststar-survivor-profile-"),
    );
    let context = await open(type, folder);
    let page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => SurvivorDemo.ready());
    report.source = await page.evaluate(() => SurvivorBuild);
    await page.locator("#startBtn").click();
    await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
    await page.keyboard.down("d");
    await page.waitForTimeout(650);
    await page.keyboard.up("d");
    await page.locator("#pauseBtn").click();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    const before = await read(page);
    await context.close();
    context = await open(type, folder);
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => SurvivorDemo.ready());
    const reopened = await read(page);
    assert.deepEqual(reopened, before);
    await page.locator("#continueBtn").click();
    await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
    const after = await page.evaluate(() => SurvivorDemo.state());
    assert.equal(after.p.maxhp, 100);
    assert(after.p.x >= before.active.snapshot.game.p.x);
    await page.locator("#pauseBtn").click();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await page.locator("#leaveBtn").click();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await page.locator("#retryBtn").click();
    await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
    assert.equal((await read(page)).profile.runs, 1);
    // Explicit maximum-load QA field. Invulnerability avoids ending the benchmark;
    // all weapons, enemy shots and rendering still run normally.
    await page.goto(url + "?qa=1");
    await page.waitForFunction(() => SurvivorDemo.ready());
    await page.locator("#startBtn").click();
    await page.waitForFunction(
      () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
    );
    await page.evaluate((includeRepair) => {
      const Q = SurvivorQA,
        g = Q.state();
      const equip = (id, n, passive = false) => {
        while (((passive ? g.passive : g.active)[id] || 0) < n)
          if (!Q.pick(id)) throw Error("Invalid benchmark " + id);
      };
      const evolve = (weapon, passive, evolution) => {
        equip(weapon, 5);
        equip(passive, 5, true);
        Q.reward(true);
        if (!Q.pick(evolution))
          throw Error("Benchmark evolution rejected " + evolution);
      };
      evolve("cannon", "lens", "piercebeam");
      evolve("drone", "lock", "hunterswarm");
      evolve("arc", "capacitor", "chainstorm");
      Q.reward(true);
      if (!Q.pick("thunderhive")) throw Error("Benchmark hive rejected");
      evolve("missile", "cooler", "meteorbarrage");
      evolve("blade", "magnet", "spiralsaw");
      Q.reward(true);
      if (!Q.pick("blastwheel")) throw Error("Benchmark wheel rejected");
      evolve("shield", "armor", "reactiveaegis");
      equip("prism", 5);
      equip("gravity", 5);
      if (includeRepair) {
        delete g.active.gravity;
        equip("repairpod", 5);
        g.engineering = { version: 1, thrusters: 6, salvage: 6, plating: 6 };
        g.p.hp = 40;
        g.p.speed = 196;
      }
      if (
        Object.keys(g.active).length + Object.keys(g.fused).length !== 6 ||
        Object.keys(g.passive).length !== 6
      )
        throw Error("Incomplete6+6 benchmark");
      g.time = 135;
      g.bossSpawned = g.eliteSpawned = true;
      g.p.inv = 50;
      for (let i = 0; i < 38; i++)
        Q.enemy(
          ["tank", "lancer", "sentinel", "minelayer", "wisp", "ranger"][i % 6],
          ((i % 7) - 3) * 56,
          (Math.floor(i / 7) - 3) * 62,
          1000000,
        );
      Q.enemy("elite", 165, 60, 1000000, "hive");
      Q.enemy("boss", -165, -70, 1000000, "judicator");
      for (const enemy of g.enemy) enemy.fire = 0.2;
      for (let i = 0; i < 56; i++)
        g.enemyShots.push({
          x: Math.cos((i * Math.PI) / 28) * 200,
          y: Math.sin((i * Math.PI) / 28) * 200,
          vx: 0,
          vy: 0,
          t: 60,
        });
      for (let i = 0; i < 140; i++)
        g.pickups.push({
          x: Math.cos((i * Math.PI) / 70) * (includeRepair ? 360 : 270),
          y: Math.sin((i * Math.PI) / 70) * (includeRepair ? 360 : 270),
          type: i % 4 ? "xp" : "scrap",
          value: 8,
          t: 60,
        });
      for (let i = 0; i < 160; i++)
        g.particles.push({
          x: ((i % 16) - 8) * 24,
          y: (Math.floor(i / 16) - 4) * 30,
          vx: 0,
          vy: 0,
          t: 60,
          max: 60,
          size: 3,
          c: "#f4c57a",
        });
    }, repairBenchmark);
    const metrics = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const frames = [],
            max = {};
          let previous = performance.now(),
            began = previous;
          function sample(now) {
            frames.push(now - previous);
            previous = now;
            const g = SurvivorDemo.state();
            for (const key of [
              "enemy",
              "shots",
              "enemyShots",
              "pickups",
              "particles",
              "texts",
              "arcs",
              "rings",
              "bursts",
              "hazards",
            ])
              max[key] = Math.max(max[key] || 0, g[key].length);
            if (now - began >= 30000) {
              const sorted = frames.slice(1).sort((a, b) => a - b);
              const q = (p) => sorted[Math.floor((sorted.length - 1) * p)];
              resolve({
                seconds: (now - began) / 1000,
                frames: sorted.length,
                medianMs: q(0.5),
                p95Ms: q(0.95),
                p99Ms: q(0.99),
                longFrames50ms: sorted.filter((x) => x > 50).length,
                max,
                damage: g.metrics.damage,
                actualGameTime: g.time,
                persisted: g.persisted,
                profile: SurvivorDemo.profile(),
                audio: SurvivorAudio.inspect(),
                mode: g.mode,
              });
            } else requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        }),
    );
    for (const [key, max] of Object.entries({
      enemy: 40,
      shots: 72,
      enemyShots: 56,
      pickups: 140,
      particles: 160,
      texts: 28,
      arcs: 24,
      rings: 24,
      bursts: 28,
      hazards: 12,
    }))
      assert(metrics.max[key] <= max, key);
    assert.equal(metrics.mode, "play");
    assert.equal(errors.length, 0);
    report.engines.push({
      engine: type.name(),
      closeReopen: "PASS",
      nextRun: "PASS",
      errors,
      syntheticMaximumLoad: metrics,
      variant: repairBenchmark ? "repair-pod-and-all-engineering" : "full-dps",
    });
    await context.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.engines, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
