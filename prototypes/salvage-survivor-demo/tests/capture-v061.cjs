/* Natural timed input, UI continuation and explicitly marked live AV weapon fixtures. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4397/";
const output = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v061/current",
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const directions = [
  ["d"],
  ["d", "s"],
  ["s"],
  ["a", "s"],
  ["a"],
  ["a", "w"],
  ["w"],
  ["d", "w"],
];
const priority = [
  "贯星轨炮",
  "脉冲主炮",
  "聚能透镜",
  "反应壁垒",
  "离子护盾",
  "反应装甲",
  "万花星阵",
  "折跃棱镜",
  "折射晶核",
  "坍缩星核",
  "引力锚",
  "引力透镜",
  "雷暴蜂群",
  "追踪无人机",
  "电弧线圈",
  "锁定芯片",
  "超导电容",
  "爆裂刃环",
  "震荡导弹",
  "旋刃护卫",
  "冷却矩阵",
  "回收磁场",
];
function steer(g, previous) {
  const visible = (point) => {
    const x = point.x - g.camera.x + 195,
      y = point.y - g.camera.y + 844 * 0.51;
    return x > -20 && x < 410 && y > 170 && y < 864;
  };
  const enemies = g.enemy.filter(visible),
    shots = g.enemyShots.filter(visible),
    pickups = g.pickups.filter(
      (pickup) => visible(pickup) && pickup.type === "xp",
    );
  const nearest = (points) =>
    points
      .slice()
      .sort(
        (a, b) =>
          Math.hypot(a.x - g.p.x, a.y - g.p.y) -
          Math.hypot(b.x - g.p.x, b.y - g.p.y),
      )[0];
  const pickup = nearest(pickups),
    target = nearest(enemies);
  let best = previous < 0 ? 0 : previous,
    minimum = Infinity;
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4,
      vx = Math.cos(angle) * g.p.speed,
      vy = Math.sin(angle) * g.p.speed;
    const x = g.p.x + vx * 0.55,
      y = g.p.y + vy * 0.55;
    let risk = 0;
    for (const enemy of enemies) {
      const heading = Math.atan2(g.p.y - enemy.y, g.p.x - enemy.x),
        speed = enemy.charge > 0 ? 315 : enemy.speed;
      const ex = enemy.x + Math.cos(heading) * speed * 0.45,
        ey = enemy.y + Math.sin(heading) * speed * 0.45;
      const distance = Math.max(1, Math.hypot(x - ex, y - ey) - enemy.radius);
      risk +=
        distance < 25
          ? 20000 + (25 - distance) * 100
          : 50 * (100 / distance) ** 2;
    }
    for (const shot of shots) {
      const rx = shot.x - g.p.x,
        ry = shot.y - g.p.y,
        dx = shot.vx - vx,
        dy = shot.vy - vy;
      const time = Math.max(
        0,
        Math.min(0.65, -(rx * dx + ry * dy) / (dx * dx + dy * dy || 1)),
      );
      const distance = Math.max(1, Math.hypot(rx + dx * time, ry + dy * time));
      risk += distance < 22 ? 25000 : 20 * (55 / distance) ** 2;
    }
    if (pickup) risk += Math.hypot(x - pickup.x, y - pickup.y) * 0.13;
    else if (target)
      risk += Math.abs(Math.hypot(x - target.x, y - target.y) - 165) * 0.09;
    if (previous >= 0)
      risk += (1 - Math.cos(((index - previous) * Math.PI) / 4)) * 7;
    if (risk < minimum) {
      minimum = risk;
      best = index;
    }
  }
  return best;
}
async function keys(page, index) {
  for (const key of ["w", "a", "s", "d"]) await page.keyboard.up(key);
  for (const key of directions[index]) await page.keyboard.down(key);
}
async function choose(page, g, row) {
  const cards = await page.locator("[data-pick] h3").allTextContents();
  let index = -1;
  if (g.p.hp / g.p.maxhp < 0.4)
    index = cards.findIndex((name) => name === "船体修补");
  if (index < 0)
    for (const name of priority) {
      index = cards.findIndex((text) => text === name);
      if (index >= 0) break;
    }
  if (index < 0) index = 0;
  row.upgrades.push({ time: g.time, offered: cards, chosen: cards[index] });
  if (row.upgrades.length === 1)
    await page.screenshot({
      path: path.join(output, `natural-${row.run}-first-upgrade.png`),
    });
  await page.locator("[data-pick]").nth(index).click();
}
async function natural(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    recordVideo: {
      dir: path.join(output, "raw"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(url);
  await page.waitForFunction(() => SurvivorDemo.ready());
  const report = {
    source: await page.evaluate(() => SurvivorBuild),
    kind: "natural-continuous-input",
    qa: false,
    imports: false,
    timeOrSeedOverride: false,
    policy:
      "Automated keyboard avoidance of visible enemies/projectiles, visible pickups and actual offered-card titles. No game-state mutation. This is not a human skill benchmark. The whole-page Playwright video has no audio.",
    runs: [],
    errors,
  };
  assert(await page.evaluate(() => !window.SurvivorQA));
  let completed = false;
  for (let run = 1; run <= 3 && !completed; run++) {
    if (run === 1) await page.locator("#startBtn").click();
    else {
      for (const id of ["upgradeHullBtn", "upgradeGunBtn"])
        if (await page.locator("#" + id).isEnabled()) {
          await page.locator("#" + id).click();
          await page.waitForFunction(() => !SurvivorDemo.saving());
          await pause(600);
        }
      await page.locator("#retryBtn").click();
    }
    await page.waitForFunction(
      () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
    );
    const row = { run, upgrades: [], samples: [] },
      began = Date.now();
    let previous = -1,
      next = 0;
    const thresholds = [
      10, 30, 60, 120, 180, 240, 300, 360, 420, 480, 540, 590,
    ];
    while (Date.now() - began < 900000) {
      const g = await page.evaluate(() => SurvivorDemo.state());
      if (g.mode === "results") {
        await page.waitForFunction(() => !SurvivorDemo.saving());
        row.end = {
          time: g.time,
          kills: g.kills,
          level: g.level,
          credits: g.credits,
          evolved: g.evolved,
          fused: g.fused,
          bossKilled: g.bossKilled,
          metrics: g.metrics,
          profile: await page.evaluate(() => SurvivorDemo.profile()),
          audio: await page.evaluate(() => SurvivorAudio.inspect()),
          wallSeconds: (Date.now() - began) / 1000,
        };
        completed = g.time >= 600;
        break;
      }
      if (g.mode === "upgrade") {
        await keys(page, previous < 0 ? 0 : previous);
        for (const key of ["w", "a", "s", "d"]) await page.keyboard.up(key);
        previous = -1;
        await choose(page, g, row);
      } else if (g.mode === "play") {
        const direction = steer(g, previous);
        if (direction !== previous) {
          await keys(page, direction);
          previous = direction;
        }
      }
      if (next < thresholds.length && g.time >= thresholds[next]) {
        const at = thresholds[next++];
        row.samples.push({
          time: g.time,
          threshold: at,
          hp: g.p.hp,
          kills: g.kills,
          level: g.level,
          credits: g.credits,
          active: g.active,
          passive: g.passive,
          evolved: g.evolved,
          fused: g.fused,
          enemies: g.enemy.length,
          milestones: g.metrics.events.filter((event) =>
            ["boss", "elite"].includes(event.kind),
          ),
          audio: await page.evaluate(() => SurvivorAudio.inspect()),
        });
        await page.screenshot({
          path: path.join(output, `natural-${run}-${at}s.png`),
        });
      }
      await pause(100);
    }
    assert(
      row.end,
      "Natural session must settle within measured wall-clock limit",
    );
    for (const key of ["w", "a", "s", "d"]) await page.keyboard.up(key);
    await page.screenshot({
      path: path.join(output, `natural-${run}-results.png`),
    });
    report.runs.push(row);
    fs.writeFileSync(
      path.join(output, "natural-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      `Natural${run}: ${row.end.time.toFixed(1)}s, ${row.end.kills}kills, level${row.end.level}, advanced${Object.keys(row.end.evolved).length + Object.keys(row.end.fused).length}`,
    );
  }
  assert(
    completed,
    "Retain failed attempts and repair the game or policy before claiming a natural600second run",
  );
  await page.locator("#retryBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  await page.keyboard.down("d");
  await page.waitForTimeout(600);
  await page.keyboard.up("d");
  await page.locator("#pauseBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const before = await page.evaluate(() => SurvivorDemo.store());
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.screenshot({
    path: path.join(output, "natural-refresh-continue.png"),
  });
  const reloaded = await page.evaluate(() => SurvivorDemo.store());
  assert.deepEqual(reloaded, before);
  await page.locator("#continueBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  await page.locator("#pauseBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const continued = await page.evaluate(() => SurvivorDemo.state());
  assert(continued.time >= before.active.snapshot.game.time);
  await page.locator("#leaveBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  report.continuation = {
    sameRecordOnRefresh: true,
    beforeTime: before.active.snapshot.game.time,
    continuedTime: continued.time,
    profile: await page.evaluate(() => SurvivorDemo.profile()),
  };
  fs.writeFileSync(
    path.join(output, "natural-report.json"),
    JSON.stringify(report, null, 2),
  );
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "natural-whole-page-silent.webm"));
  assert.equal(errors.length, 0);
}
async function weaponAV(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(url + "?qa=1");
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#startBtn").click();
  await page.waitForFunction(
    () => SurvivorAudio.inspect().contextState === "running",
  );
  const outputFile = path.join(output, "qa-live-canvas-mix.webm");
  fs.writeFileSync(outputFile, Buffer.alloc(0));
  await page.exposeFunction("writeAVChunk", (encoded) =>
    fs.promises.appendFile(outputFile, Buffer.from(encoded, "base64")),
  );
  await page.evaluate(() => {
    const stream = document.getElementById("game").captureStream(30),
      audio = SurvivorAudio.recordingStream();
    if (!audio?.getAudioTracks().length)
      throw Error("No actual mixed audio track");
    stream.addTrack(audio.getAudioTracks()[0]);
    window.liveAV = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8,opus",
      videoBitsPerSecond: 1100000,
      audioBitsPerSecond: 96000,
    });
    window.avWrites = Promise.resolve();
    window.avDone = false;
    liveAV.ondataavailable = (event) => {
      if (event.data.size)
        avWrites = avWrites.then(async () => {
          const bytes = new Uint8Array(await event.data.arrayBuffer());
          let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 32768)
            binary += String.fromCharCode(
              ...bytes.subarray(offset, offset + 32768),
            );
          await window.writeAVChunk(btoa(binary));
        });
    };
    liveAV.onstop = () =>
      avWrites.then(() => {
        window.avDone = true;
      });
    liveAV.start(1000);
  });
  const recipes = [
    ["cannon", "lens", "piercebeam"],
    ["drone", "lock", "hunterswarm"],
    ["arc", "capacitor", "chainstorm"],
    ["missile", "cooler", "meteorbarrage"],
    ["blade", "magnet", "spiralsaw"],
    ["shield", "armor", "reactiveaegis"],
    ["prism", "refraction", "kaleidoscope"],
    ["gravity", "singularity", "collapse"],
    ["drone", "arc", "thunderhive"],
    ["missile", "blade", "blastwheel"],
    ["prism", "gravity", "eventhorizon"],
  ];
  const report = {
    source: await page.evaluate(() => SurvivorBuild),
    kind: "explicit-QA-live-canvas-and-final-audio-bus",
    wholePageUI: false,
    microphone: false,
    timeOrSeedFixtures: true,
    rows: [],
    errors,
  };
  for (const [a, b, id] of recipes) {
    await page.evaluate(
      ([a, b, id]) => {
        const Q = SurvivorQA,
          g = Q.startModel(615);
        g.active = {};
        g.p.inv = 10000;
        g.spawnTime = 999;
        g.qaLabel = id;
        while ((g.active[a] || 0) < 3)
          if (!Q.pick(a)) throw Error("Illegal active");
        if (["thunderhive", "blastwheel", "eventhorizon"].includes(id)) {
          while ((g.active[b] || 0) < 3)
            if (!Q.pick(b)) throw Error("Illegal component");
        } else
          while ((g.passive[b] || 0) < 2)
            if (!Q.pick(b)) throw Error("Illegal passive");
        if (!Q.pick(id)) throw Error("Illegal recipe");
        for (let i = 0; i < 9; i++) {
          const angle = (i * Math.PI * 2) / 9;
          Q.enemy("tank", Math.cos(angle) * 100, Math.sin(angle) * 100, 100000);
        }
      },
      [a, b, id],
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(output, `qa-${id}-reveal.png`) });
    if (id === "reactiveaegis")
      await page.evaluate(() => {
        const g = SurvivorQA.state();
        g.p.inv = 0;
        SurvivorQA.forceDamage(1);
        g.p.inv = 10000;
      });
    await page.waitForTimeout(2400);
    await page.screenshot({ path: path.join(output, `qa-${id}.png`) });
    await page.waitForTimeout(2400);
    report.rows.push(
      await page.evaluate((id) => {
        const g = SurvivorDemo.state();
        return {
          id,
          damage: g.metrics.damage,
          slots: Object.keys(g.active).length + Object.keys(g.fused).length,
          audio: SurvivorAudio.inspect(),
        };
      }, id),
    );
  }
  await page.evaluate(() => liveAV.stop());
  await page.waitForFunction(() => window.avDone);
  assert(fs.statSync(outputFile).size > 100000);
  assert.equal(errors.length, 0);
  fs.writeFileSync(
    path.join(output, "qa-av-report.json"),
    JSON.stringify(report, null, 2),
  );
  await context.close();
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    if (!process.argv.includes("--qa-only")) await natural(browser);
    await weaponAV(browser);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
