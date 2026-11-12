const { test, expect } = require("@playwright/test");
const { boot, start, state, stored } = require("./helpers.cjs");
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

test("v063 actual gear UI uses5+5 and all eight 5+4 recipes reject an advanced reward", async ({
  page,
}) => {
  await boot(page);
  const rows = await page.evaluate(
    (recipes) =>
      recipes.map(([weapon, passive, evo]) => {
        const Q = SurvivorQA,
          g = Q.startModel(91);
        g.active = {};
        for (let i = 0; i < 5; i++) Q.pick(weapon);
        for (let i = 0; i < 4; i++) Q.pick(passive);
        Q.reward(true);
        const premature = Q.pick(evo);
        Q.pick(passive);
        Q.level();
        const ordinary = Q.pick(evo);
        Q.reward(true);
        const hint = document.getElementById("upgradeList").textContent;
        const accepted = Q.pick(evo);
        return {
          premature,
          ordinary,
          accepted,
          hint,
          weapon: g.active[weapon],
          passive: g.passive[passive],
        };
      }),
    recipes,
  );
  for (const r of rows) {
    expect(r.premature).toBe(false);
    expect(r.ordinary).toBe(false);
    expect(r.accepted).toBe(true);
    expect(r.hint).toContain("MAX ＋");
    expect(r.weapon).toBe(5);
    expect(r.passive).toBe(5);
  }
});

test("v063 real elite kill opens a one-level reward and trusted touch cannot claim twice", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.spawnTime = 999;
    g.p.inv = 999;
    g.encounters.schedule = [];
    g.xp = 31;
    Q.enemy("elite", 0, -70, 1);
    Q.step(0.5);
    await Q.save();
    await Q.settled();
  });
  await expect(page.locator("#upgradeTitle")).toHaveText(
    "精英战利品 · 等级＋1",
  );
  expect((await state(page)).level).toBe(2);
  expect((await state(page)).xp).toBe(31);
  const b = await page.locator(".skill").first().boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await page.locator("#pauseBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
  expect(before.active.snapshot.game.bossRewards.ids).toHaveLength(1);
  expect(before.active.snapshot.game.bossRewards.pending).toHaveLength(0);
});

test("v063 unforced random reward, exact cards and RNG survive refresh without lottery reroll", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.spawnTime = 999;
    g.p.inv = 999;
    for (let i = 1; i < 5; i++) Q.pick("cannon");
    for (let i = 0; i < 5; i++) Q.pick("lens");
    Q.reward();
    await Q.save();
    await Q.settled();
  });
  const before = await stored(page);
  const labels = await page.locator(".skill").allTextContents();
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
  await page.locator("#continueBtn").click();
  await expect(page.locator("#upgrade")).toBeVisible();
  expect(await page.locator(".skill").allTextContents()).toEqual(labels);
  expect((await state(page)).upgradeSource).toEqual(
    before.active.snapshot.game.upgradeSource,
  );
  expect((await stored(page)).active.snapshot.seed).toBe(
    before.active.snapshot.seed,
  );
});

test("v063 stale actual evolution click refuses a downgraded accessory", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.state();
    for (let i = 1; i < 5; i++) Q.pick("cannon");
    for (let i = 0; i < 5; i++) Q.pick("lens");
    Q.reward(true);
    g.passive.lens = 4;
  });
  await page.getByRole("button", { name: /贯星轨炮/ }).click();
  expect((await state(page)).evolved).toEqual({});
  await expect(page.getByRole("button", { name: /贯星轨炮/ })).toHaveCount(0);
});

test("v063 four current ultimate fusions consume two evolved sources and restore safely", async ({
  page,
}) => {
  await boot(page);
  const rows = await page.evaluate((recipes) => {
    const pairs = [
      ["drone", "arc", "thunderhive"],
      ["missile", "blade", "blastwheel"],
      ["prism", "gravity", "eventhorizon"],
      ["cannon", "shield", "ionbastion"],
    ];
    return pairs.map(([a, b, id]) => {
      const Q = SurvivorQA,
        g = Q.startModel(56);
      g.active = {};
      g.p.inv = 999;
      g.spawnTime = 999;
      for (const weapon of [a, b]) {
        const [, aux, evo] = recipes.find(([source]) => source === weapon);
        for (let i = 0; i < 5; i++) {
          Q.pick(weapon);
          Q.pick(aux);
        }
        Q.reward(true);
        if (!Q.pick(evo)) throw Error("EVO rejected");
      }
      Q.reward(true);
      const title = document.getElementById("upgradeList").textContent;
      const accepted = Q.pick(id);
      Q.validate(Q.snapshot());
      return {
        id,
        accepted,
        title,
        active: g.active,
        evolved: g.evolved,
        fused: g.fused,
        reacquire: Q.options().some((o) => [a, b].includes(o.id)),
      };
    });
  }, recipes);
  for (const r of rows) {
    expect(r.accepted).toBe(true);
    expect(r.title).toContain("终极融合");
    expect(r.active).toEqual({});
    expect(r.evolved).toEqual({});
    expect(r.fused[r.id]).toBe(true);
    expect(r.reacquire).toBe(false);
  }
});

test("v063 visitor has a visible body and shield then actual attacks inside the screen", async ({
  page,
}, info) => {
  await boot(page);
  await start(page);
  for (const kind of ["courier", "watcher"]) {
    const result = await page.evaluate((kind) => {
      const Q = SurvivorQA,
        g = Q.startModel(18);
      g.active = {};
      g.spawnTime = 999;
      g.p.inv = 999;
      g.encounters.schedule = [{ kind, at: 0 }];
      Q.step(2.4);
      Q.runRender();
      const e = g.enemy.find((e) => e.t === kind);
      return {
        x: e.x - g.camera.x + innerWidth / 2,
        y: e.y - g.camera.y + innerHeight * 0.51,
        hp: e.hp,
        age: e.arrivalAge,
      };
    }, kind);
    expect(result.x).toBeGreaterThan(35);
    expect(result.x).toBeLessThan(page.viewportSize().width - 35);
    expect(result.y).toBeGreaterThan(230);
    expect(result.y).toBeLessThan(page.viewportSize().height - 100);
    expect(result.age).toBeLessThan(1.6);
    await info.attach(kind + "-materializing", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    const active = await page.evaluate(() => {
      const Q = SurvivorQA,
        g = Q.state();
      Q.step(1.7);
      Q.runRender();
      return {
        age: g.enemy[0].arrivalAge,
        hazards: g.hazards.map((h) => h.kind),
        shots: g.enemyShots.length,
      };
    });
    expect(active.age).toBeGreaterThan(1.6);
    expect(active.hazards.length + active.shots).toBeGreaterThan(0);
    await info.attach(kind + "-actual-attack", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
});

test("v063 lottery produces both offers and misses through actual rendered choices", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(() => {
    let offers = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const Q = SurvivorQA,
        g = Q.startModel(seed);
      g.active = {};
      for (let i = 0; i < 5; i++) {
        Q.pick("cannon");
        Q.pick("lens");
      }
      Q.reward();
      if (document.querySelector(".skill.evolution")) offers++;
    }
    return offers;
  });
  expect(result).toBeGreaterThan(125);
  expect(result).toBeLessThan(175);
});

test("v063 pursuing boss stays visible and its out-of-range warning releases correctly", async ({
  page,
}) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.startModel(63);
    g.active = {};
    g.spawnTime = 999;
    g.p.inv = 999;
    g.encounters.schedule = [];
    Q.enemy("boss", -700, 0, 100000);
    Object.assign(g.enemy[0], { speed: 82, warn: 0.4 });
    g.keys = { d: true };
    let count = 0;
    for (let i = 0; i < 1200; i++) {
      Q.step(1 / 60);
      const e = g.enemy[0],
        x = e.x - g.camera.x + document.getElementById("game").width / 2;
      if (i > 840 && x > 15 && x < document.getElementById("game").width - 15)
        count++;
    }
    Q.runRender();
    return { visible: count, hp: g.enemy[0].hp, mode: g.mode };
  });
  expect(r.visible).toBeGreaterThan(180);
  expect(r.hp).toBe(100000);
  expect(r.mode).toBe("play");
});

test("v062 three-plus-two evolved save resumes, retains27049 and next new run uses5+5", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    Q.legacyProgression();
    Q.pick("cannon");
    Q.pick("cannon");
    Q.pick("lens");
    Q.pick("lens");
    Q.pick("piercebeam");
    g.credits = 27049;
    g.mode = "pause";
    await Q.save();
    await Q.settled();
  });
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
  await page.locator("#continueBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  expect((await state(page)).active.cannon).toBe(3);
  expect((await state(page)).evolved.cannon).toBe("piercebeam");
  await page.locator("#pauseBtn").click();
  await page.locator("#leaveBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile.credits).toBe(27049);
  await page.locator("#retryBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  expect((await state(page)).rules.progressionVersion).toBe(2);
  expect((await stored(page)).profile.credits).toBe(27049);
});
