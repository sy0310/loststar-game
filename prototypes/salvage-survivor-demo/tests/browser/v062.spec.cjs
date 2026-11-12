const { test, expect } = require("@playwright/test");
const { boot, start, state, stored, settle } = require("./helpers.cjs");
async function continueRun(page) {
  await page.locator("#continueBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  await page.evaluate(() => {
    SurvivorQA.state().mode = "pause";
  });
}

test("eight evolutions require both full levels and display MAX on real loadout", async ({
  page,
}) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    const recipes = [
      ["cannon", "lens", "piercebeam"],
      ["drone", "lock", "hunterswarm"],
      ["arc", "capacitor", "chainstorm"],
      ["missile", "cooler", "meteorbarrage"],
      ["blade", "magnet", "spiralsaw"],
      ["shield", "armor", "reactiveaegis"],
      ["prism", "refraction", "kaleidoscope"],
      ["gravity", "singularity", "collapse"],
    ];
    return recipes.map(([weapon, accessory, evolution]) => {
      const Q = SurvivorQA,
        g = Q.startModel(16);
      Q.legacyProgression(); // Explicit old 3+2 archive regression.
      g.active = {};
      g.spawnTime = 999;
      g.p.inv = 999;
      for (let i = 0; i < 3; i++) Q.pick(weapon);
      const absent = Q.pick(evolution);
      Q.pick(accessory);
      const half = Q.pick(evolution);
      Q.pick(accessory);
      const maxLabels = document.getElementById("loadout").textContent;
      Q.level();
      const hint = document.getElementById("upgradeList").textContent;
      const accepted = Q.pick(evolution);
      return {
        absent,
        half,
        accepted,
        maxLabels,
        hint,
        result: g.evolved[weapon],
      };
    });
  });
  for (const row of rows) {
    expect(row.absent).toBe(false);
    expect(row.half).toBe(false);
    expect(row.accepted).toBe(true);
    expect(row.maxLabels.match(/MAX/g)).toHaveLength(2);
    expect(row.hint).toContain("MAX ＋");
    expect(row.result).toBeTruthy();
  }
});

test("an offered EVO is rechecked on actual click and stale accessory cannot evolve", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.state();
    Q.legacyProgression();
    g.spawnTime = 999;
    Q.pick("cannon");
    Q.pick("cannon");
    Q.pick("lens");
    Q.pick("lens");
    Q.level();
    g.passive.lens = 1;
  });
  await page.getByRole("button", { name: /贯星轨炮/ }).click();
  expect((await state(page)).evolved).toEqual({});
  expect((await state(page)).mode).toBe("upgrade");
  expect((await state(page)).passive.lens).toBe(1);
  await expect(page.getByRole("button", { name: /贯星轨炮/ })).toHaveCount(0);
});

test("new decoded enemy bodies produce actual dash, beam, mine, curved and shock attacks", async ({
  page,
}) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    const Q = SurvivorQA;
    return ["lancer", "sentinel", "minelayer", "wisp", "ranger", "tank"].map(
      (type) => {
        const g = Q.startModel(46);
        Q.legacyV063();
        g.active = {};
        g.spawnTime = 999;
        g.p.inv = 999;
        g.encounters.schedule = [];
        g.time = 110;
        g.milestoneSeen = SurvivorBalance.milestones.map(
          (m) => m.type + ":" + m.at,
        );
        Q.enemy(type, 0, -140, 100000);
        g.enemy[0].fire = 0;
        Q.step(1.2);
        Q.runRender();
        return {
          type,
          charge: g.enemy[0].charge,
          shots: g.enemyShots.map((s) => s.kind),
          hazards: g.hazards.map((h) => h.kind),
          art: SurvivorDemo.artCount(),
        };
      },
    );
  });
  for (const row of rows) expect(row.art).toBe(59);
  expect(rows.find((r) => r.type === "lancer").charge).toBeGreaterThan(0);
  expect(rows.find((r) => r.type === "sentinel").hazards).toContain("beam");
  expect(rows.find((r) => r.type === "minelayer").hazards).toContain("mine");
  expect(rows.find((r) => r.type === "tank").hazards).toContain("shock");
  expect(rows.find((r) => r.type === "wisp").shots).toEqual(["curl", "curl"]);
  expect(rows.find((r) => r.type === "ranger").shots).toEqual([
    "needle",
    "needle",
    "needle",
  ]);
});

test("visitor warning, planted mine and its fuse persist through actual refresh without reroll", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.active = {};
    g.spawnTime = 999;
    g.p.inv = 999;
    g.encounters.schedule = [{ at: 0, kind: "courier" }];
    Q.step(1);
    g.mode = "pause";
    await Q.save();
    await Q.settled();
  });
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
  await continueRun(page);
  expect((await stored(page)).active.snapshot.game.encounters.pending).toEqual(
    before.active.snapshot.game.encounters.pending,
  );
  expect((await state(page)).encounters.pending.kind).toBe("courier");
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.mode = "play";
    Q.step(1.5);
    const enemy = g.enemy.find((e) => e.t === "courier");
    Object.assign(enemy, { x: 0, y: -120, speed: 0, fire: 0 });
    Q.step(1.8); // Includes the visible v063 materialization phase.
    g.mode = "pause";
    await Q.save();
    await Q.settled();
  });
  const withMine = await stored(page);
  expect(
    withMine.active.snapshot.game.hazards.some((h) => h.kind === "mine"),
  ).toBe(true);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(withMine);
  await continueRun(page);
  const restored = await state(page);
  expect(restored.encounters.seen).toEqual(["courier"]);
  expect((await stored(page)).active.snapshot.game.hazards).toEqual(
    withMine.active.snapshot.game.hazards,
  );
  expect(restored.hazards.map((h) => h.kind)).toEqual(
    withMine.active.snapshot.game.hazards.map((h) => h.kind),
  );
  expect(
    restored.metrics.events.filter((e) => e.kind === "encounterArrival"),
  ).toHaveLength(1);
});

test("old v061 ten-minute snapshot preserves profile and old combat through resume", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await settle(page, 27049);
  await page.locator("#retryBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.time = 169;
    g.rules.version = "0.6.1";
    g.rules.runSeconds = 600;
    g.endTime = 600;
    delete g.rules.progressionVersion;
    delete g.rules.combatVersion;
    delete g.hazards;
    delete g.encounters;
    g.mode = "pause";
    await Q.save();
    await Q.settled();
  });
  const old = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await continueRun(page);
  const restored = await state(page);
  expect(restored.rules).toEqual(old.active.snapshot.game.rules);
  expect(restored.time).toBeGreaterThanOrEqual(169);
  expect(restored.time).toBeLessThan(170);
  expect((await stored(page)).profile).toEqual(old.profile);
  expect(old.profile.credits).toBe(27049);
  await page.evaluate(() => {
    const g = SurvivorQA.state();
    g.mode = "play";
    g.p.inv = 999;
    SurvivorQA.step(3);
  });
  expect(
    (await state(page)).enemy.every(
      (e) =>
        !["lancer", "sentinel", "minelayer", "courier", "watcher"].includes(
          e.t,
        ),
    ),
  ).toBe(true);
});

test("visitor result is recorded once and actual settlement cannot claim it twice", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.spawnTime = 999;
    g.p.inv = 999;
    g.encounters.schedule = [{ at: 0, kind: "courier" }];
    Q.step(2.3);
    const visitor = g.enemy.find((e) => e.t === "courier");
    Object.assign(visitor, {
      x: 0,
      y: -60,
      hp: 1,
      speed: 0,
      fire: 999,
      arrivalAge: 2,
    });
    g.attackClock = {};
    Q.step(0.5);
    g.mode = "pause";
    await Q.save();
    await Q.settled();
  });
  expect((await state(page)).encounters.log).toHaveLength(1);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await continueRun(page);
  expect((await state(page)).encounters.log).toHaveLength(1);
  await page.evaluate(async () => {
    SurvivorQA.step(0.3);
    await SurvivorQA.end(false);
  });
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const done = await stored(page);
  expect(done.profile.runs).toBe(1);
  expect(done.lastResult.encounters).toHaveLength(1);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).profile).toEqual(done.profile);
  expect((await stored(page)).receipts).toEqual(done.receipts);
});

test("visitor banner, boss bar and toast fit actual safe area without overlap", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
    document.documentElement.style.setProperty("--safe-bottom", "34px");
    const Q = SurvivorQA,
      g = Q.state();
    g.active = {};
    g.spawnTime = 999;
    g.p.inv = 999;
    g.encounters.schedule = [{ at: 0, kind: "watcher" }];
    Q.enemy("boss", 80, -100, 100000);
    Q.step(0.1);
  });
  await expect(page.locator("#encounterNotice")).toBeVisible();
  const boxes = await page.evaluate(() =>
    Object.fromEntries(
      ["hud", "bossBar", "encounterNotice", "toast"].map((id) => {
        const b = document.getElementById(id).getBoundingClientRect();
        return [
          id,
          { top: b.top, bottom: b.bottom, left: b.left, right: b.right },
        ];
      }),
    ),
  );
  expect(boxes.encounterNotice.top).toBeGreaterThan(boxes.bossBar.bottom);
  expect(boxes.bossBar.top).toBeGreaterThan(boxes.hud.bottom);
  expect(boxes.toast.top).toBeGreaterThan(boxes.encounterNotice.bottom);
  expect(boxes.encounterNotice.left).toBeGreaterThanOrEqual(0);
  expect(boxes.encounterNotice.right).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
});

test("galaxy raster and all five actor sources decode and reduced motion keeps mechanics live", async ({
  page,
}) => {
  await boot(page);
  const assets = await page.evaluate(async () => {
    const ids = [
      "deep_space",
      "lancer",
      "sentinel",
      "minelayer",
      "courier",
      "watcher",
    ];
    return Promise.all(
      ids.map(async (id) => {
        const e = SurvivorArt.catalog[id],
          i = new Image();
        i.src = e.src;
        await i.decode();
        return {
          id,
          w: i.naturalWidth,
          h: i.naturalHeight,
          expected: e.nativeSize.map((n) => n * 2),
        };
      }),
    );
  });
  for (const row of assets) expect([row.w, row.h]).toEqual(row.expected);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await page.touchscreen.tap(80, 450);
  await page.waitForTimeout(250);
  expect((await state(page)).time).toBeGreaterThan(0);
  expect((await state(page)).rules.combatVersion).toBe(3);
});

test("boss alternates actual fan, sweep and gap shock while hazard and bullet caps stay bounded", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.startModel(28);
    g.active = {};
    g.p.inv = 999;
    g.spawnTime = 999;
    g.encounters.schedule = [];
    Q.enemy("boss", 0, -145, 100000);
    const boss = g.enemy[0];
    boss.fire = 0;
    boss.speed = 0;
    const kinds = new Set();
    for (let i = 0; i < 800; i++) {
      Q.step(1 / 60);
      g.hazards.forEach((h) => kinds.add(h.kind));
      if (g.enemyShots.length) kinds.add("fan");
      if (g.hazards.length > 12 || g.enemyShots.length > 56)
        throw Error("entity cap");
    }
    Q.runRender();
    return [...kinds];
  });
  expect(result).toEqual(expect.arrayContaining(["beam", "shock", "fan"]));
});
