const { test, expect } = require("@playwright/test");
const { boot, start, state, stored } = require("./helpers.cjs");
test.afterEach(async ({ page }) => {
  const errors = await page
    .evaluate(() => window.__TEST_ERRORS || [])
    .catch(() => []);
  expect(errors).toEqual([]);
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__TEST_ERRORS = [];
    window.addEventListener("error", (e) => __TEST_ERRORS.push(e.message));
  });
});

const evolutions = [
  ["cannon", "lens", "piercebeam", "piercebeam"],
  ["drone", "lock", "hunterswarm", "drone"],
  ["arc", "capacitor", "chainstorm", "chainstorm"],
  ["missile", "cooler", "meteorbarrage", "meteorbarrage"],
  ["blade", "magnet", "spiralsaw", "spiralsaw"],
  ["shield", "armor", "reactiveaegis", "reactiveaegis"],
  ["prism", "refraction", "kaleidoscope", "kaleidoscope"],
  ["gravity", "singularity", "collapse", "collapse"],
];
for (const [active, passive, id, damageKind] of evolutions)
  test(
    id + " changes actual combat with decoded native art",
    async ({ page }, info) => {
      await boot(page);
      const result = await page.evaluate(
        ({ active, passive, id, damageKind }) => {
          const Q = SurvivorQA,
            g = Q.startModel(93);
          g.active = {};
          g.p.inv = 10000;
          g.spawnTime = 999;
          for (let i = 0; i < 5; i++)
            if (!Q.pick(active)) throw Error("active upgrade rejected");
          for (let i = 0; i < 5; i++)
            if (!Q.pick(passive)) throw Error("passive upgrade rejected");
          Q.reward(true);
          if (!Q.pick(id)) throw Error("evolution rejected");
          Q.enemy(
            "skimmer",
            active === "blade" ? Q.orbits().bladeRadius : 0,
            active === "blade" ? 0 : -100,
            100000,
          );
          Q.enemy(
            "skimmer",
            active === "blade" ? Q.orbits().bladeRadius + 12 : 35,
            active === "blade" ? 0 : -130,
            100000,
          );
          if (active === "shield") {
            Q.step(1 / 60);
            g.p.inv = 0;
            Q.forceDamage(20);
          } else
            Q.step(
              active === "blade" ? 0.12 : active === "missile" ? 1.2 : 0.8,
            );
          Q.runRender();
          return {
            id: g.evolved[active],
            damage: g.metrics.damage[damageKind] || 0,
            enemyHP: g.enemy.map((e) => e.hp),
            art: SurvivorDemo.artCount(),
            slots: Object.keys(g.active).length + Object.keys(g.fused).length,
            shield: g.p.shield,
          };
        },
        { active, passive, id, damageKind },
      );
      expect(result.id).toBe(id);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.enemyHP.some((hp) => hp < 100000)).toBe(true);
      expect(result.art).toBe(74);
      expect(result.slots).toBe(1);
      await info.attach("actual-evolution", {
        body: Buffer.from(JSON.stringify(result, null, 2)),
        contentType: "application/json",
      });
    },
  );
for (const [a, b, id] of [
  ["drone", "arc", "thunderhive"],
  ["missile", "blade", "blastwheel"],
  ["prism", "gravity", "eventhorizon"],
])
  test(
    id + " releases a real slot and causes fusion damage",
    async ({ page }, info) => {
      await boot(page);
      const result = await page.evaluate(
        ({ a, b, id }) => {
          const Q = SurvivorQA,
            g = Q.startModel(97);
          g.active = {};
          g.p.inv = 10000;
          g.spawnTime = 999;
          for (const weapon of [a, b])
            for (let i = 0; i < 5; i++)
              if (!Q.pick(weapon)) throw Error("weapon rejected");
          const pairs = {
            drone: ["lock", "hunterswarm"],
            arc: ["capacitor", "chainstorm"],
            missile: ["cooler", "meteorbarrage"],
            blade: ["magnet", "spiralsaw"],
            prism: ["refraction", "kaleidoscope"],
            gravity: ["singularity", "collapse"],
          };
          for (const weapon of [a, b]) {
            const [passive, evolution] = pairs[weapon];
            for (let i = 0; i < 5; i++) Q.pick(passive);
            Q.reward(true);
            if (!Q.pick(evolution)) throw Error("component evolution rejected");
          }
          Q.reward(true);
          const before = Object.keys(g.active).length;
          if (!Q.pick(id)) throw Error("fusion rejected");
          Q.enemy(
            "skimmer",
            id === "blastwheel" ? Q.orbits().bladeRadius : 0,
            id === "blastwheel" ? 0 : -75,
            100000,
          );
          Q.enemy(
            "skimmer",
            id === "blastwheel" ? Q.orbits().bladeRadius + 34 : 40,
            id === "blastwheel" ? 0 : -80,
            100000,
          );
          Q.step(id === "blastwheel" ? 0.1 : 1);
          Q.runRender();
          return {
            before,
            after: Object.keys(g.active).length + Object.keys(g.fused).length,
            components: [g.active[a], g.active[b]],
            damage: g.metrics.damage[id] || 0,
            reacquire: Q.options().some((o) => [a, b].includes(o.id)),
          };
        },
        { a, b, id },
      );
      expect(result.before - result.after).toBe(1);
      expect(result.components).toEqual([undefined, undefined]);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.reacquire).toBe(false);
      await info.attach("actual-fusion", {
        body: Buffer.from(JSON.stringify(result)),
        contentType: "application/json",
      });
    },
  );

test("early cannon/arc, drone/arc, shield/arc and marked drone links actually affect combat", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const Q = SurvivorQA,
      result = {};
    function setup(ids) {
      const g = Q.startModel(41);
      g.active = {};
      g.spawnTime = 999;
      g.p.inv = 10000;
      ids.forEach((id) => Q.pick(id));
      Q.enemy("skimmer", 90, 0, 100000);
      Q.enemy("skimmer", 150, 0, 100000);
      return g;
    }
    let g = setup(["cannon", "arc"]);
    g.attackClock.arc = 999;
    Q.step(0.5);
    result.cannon = g.metrics.damage.pulseArc || 0;
    g = setup(["drone", "arc"]);
    g.attackClock.arc = 999;
    Q.step(0.5);
    result.drone = g.metrics.damage.droneArc || 0;
    g = setup(["shield", "arc"]);
    g.attackClock.arc = 999;
    Q.step(1 / 60);
    g.p.inv = 0;
    const hp = g.p.hp;
    Q.forceDamage(20);
    result.shield = g.metrics.damage.shieldArc || 0;
    result.protected = g.p.hp === hp;
    g = setup(["cannon", "drone"]);
    Q.step(1.8);
    result.mark = g.enemy[0].marked;
    return result;
  });
  expect(result.cannon).toBeGreaterThan(0);
  expect(result.drone).toBeGreaterThan(0);
  expect(result.shield).toBeGreaterThan(0);
  expect(result.protected).toBe(true);
  expect(result.mark).toBeGreaterThan(0);
});

test("default launch has no QA hooks and naturally attacks approaching enemies", async ({
  page,
}) => {
  await boot(page, false);
  expect(await page.evaluate(() => typeof SurvivorQA)).toBe("undefined");
  await start(page);
  await page.waitForFunction(
    () => SurvivorDemo.state().metrics.damage.pulse > 0,
    { timeout: 15000 },
  );
  const g = await state(page);
  expect(g.time).toBeGreaterThan(0);
  expect(g.metrics.shots.pulse).toBeGreaterThan(0);
  expect(g.enemy.length + g.kills).toBeGreaterThan(0);
  await expect(page.locator(".slot-row").nth(0).locator(".slot")).toHaveCount(
    6,
  );
  await expect(page.locator(".slot-row").nth(1).locator(".slot")).toHaveCount(
    6,
  );
});

test("keyboard and diagonal movement, camera follow and release reflect actual world position", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  const before = await state(page);
  await page.keyboard.down("d");
  await page.keyboard.down("w");
  await page.waitForTimeout(450);
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  const after = await state(page);
  expect(after.p.x).toBeGreaterThan(before.p.x + 20);
  expect(after.p.y).toBeLessThan(before.p.y - 20);
  expect(
    Math.hypot(after.p.x - before.p.x, after.p.y - before.p.y),
  ).toBeLessThan(110);
  expect(after.camera.x).toBeGreaterThan(0);
  await page.locator("#pauseBtn").click();
  await page.locator("#resumeBtn").click();
  expect((await state(page)).input.active).toBe(false);
  expect((await state(page)).keys).toEqual({});
});

test("real browser touch tap and synthetic drag/cancel cleanly release the floating joystick", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    window.__touchSeen = [];
    document
      .getElementById("game")
      .addEventListener("pointerdown", (e) =>
        __touchSeen.push({ type: e.pointerType, trusted: e.isTrusted }),
      );
  });
  await page.touchscreen.tap(100, 500);
  expect(
    await page.evaluate(() =>
      __touchSeen.some((e) => e.type === "touch" && e.trusted),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const canvas = document.getElementById("game");
    for (const [type, x] of [
      ["pointerdown", 100],
      ["pointermove", 140],
    ])
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 55,
          pointerType: "touch",
          clientX: x,
          clientY: 500,
          bubbles: true,
        }),
      );
  });
  await page.waitForTimeout(250);
  expect((await state(page)).input.dx).toBeGreaterThan(0);
  await page.evaluate(() =>
    document.getElementById("game").dispatchEvent(
      new PointerEvent("pointercancel", {
        pointerId: 55,
        pointerType: "touch",
        bubbles: true,
      }),
    ),
  );
  expect((await state(page)).input.active).toBe(false);
  await expect(page.locator("#joystick")).toBeHidden();
});

test("three choices, icons and level changes fit synthetic phone safe areas without overlap", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
    document.documentElement.style.setProperty("--safe-bottom", "34px");
    SurvivorQA.level();
  });
  await expect(page.locator(".skill")).toHaveCount(3);
  const boxes = await page.locator(".skill").evaluateAll((cards) =>
    cards.map((card) => {
      const b = card.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        right: b.right,
        bottom: b.bottom,
        scroll: card.scrollHeight,
        height: card.clientHeight,
        imgs: [...card.querySelectorAll("img")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      };
    }),
  );
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(page.viewportSize().width);
    expect(box.bottom).toBeLessThan(page.viewportSize().height - 34);
    expect(box.imgs).toBe(true);
    expect(box.scroll).toBeLessThanOrEqual(box.height + 2);
  }
  expect(boxes[1].y).toBeGreaterThan(boxes[0].bottom);
  expect(boxes[2].y).toBeGreaterThan(boxes[1].bottom);
  await page.locator(".skill").first().dblclick();
  const loadout = await state(page);
  expect(
    [
      ...Object.values(loadout.active),
      ...Object.values(loadout.passive),
    ].reduce((sum, level) => sum + level, 0),
  ).toBe(2);
});

test("background, reduced motion and orientation pause the real timer and input", async ({
  page,
}) => {
  await boot(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await page.keyboard.down("d");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const paused = await state(page);
  await page.waitForTimeout(600);
  expect((await state(page)).time).toBe(paused.time);
  expect((await state(page)).keys).toEqual({});
  await page.locator("#resumeBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() =>
    window.dispatchEvent(new Event("orientationchange")),
  );
  expect((await state(page)).mode).toBe("pause");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#resumeBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  expect((await state(page)).mode).toBe("play");
});

test("the 600-second deadline settles before a same-frame XP upgrade can interrupt it", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    SurvivorQA.legacyV063();
    const g = SurvivorQA.state();
    g.time = g.endTime - 0.001;
    g.xp = g.xpNext - 1;
    g.pickups = [{ x: g.p.x, y: g.p.y, type: "xp", value: 20, t: 10 }];
    SurvivorQA.step(1 / 60);
  });
  await expect(page.locator("#results")).toBeVisible();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const g = await state(page);
  expect(g.time).toBe(600);
  expect(g.mode).toBe("results");
  expect((await stored(page)).profile.runs).toBe(1);
});
