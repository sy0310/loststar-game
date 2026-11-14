const { test, expect } = require("@playwright/test");
const { boot, start, settle, stored, state } = require("./helpers.cjs");
async function dock(page) {
  await boot(page);
  await start(page);
  await settle(page, 27049);
  await page.locator("#resultDockBtn").tap();
}
test("v068 launch selection is six image cards with one selected portrait and true reservation", async ({
  page,
}) => {
  await dock(page);
  await page.locator("#chooseLaunchBtn").tap();
  await expect(page.locator("[data-launch-weapon]")).toHaveCount(6);
  for (const id of ["drone", "arc", "missile", "blade", "prism", "gravity"]) {
    const card = page.locator(`[data-launch-weapon="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(card.locator("img")).toHaveCount(1);
    expect(
      await card
        .locator("img")
        .evaluate((x) => x.complete && x.naturalWidth > 0),
    ).toBeTruthy();
    await expect(page.locator("#launchPortrait img")).toHaveCount(1);
  }
  await page.locator('[data-launch-weapon="prism"]').tap();
  await page.locator("#bookLaunchBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile.launchPlan.weapon).toBe("prism");
  expect((await stored(page)).profile.credits).toBe(26849);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#retryBtn").tap();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  expect((await state(page)).active).toEqual({ prism: 1 });
  expect((await stored(page)).profile.credits).toBe(26849);
});
test("v068 exact current upgrade fees preserve old paid levels and prevent duplicate purchasing", async ({
  page,
}) => {
  await dock(page);
  await expect(page.locator("#dockHullBtn")).toContainText("400");
  await page.locator("#dockHullBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile.hull).toBe(1);
  expect((await stored(page)).profile.credits).toBe(26649);
  await expect(page.locator('[data-engineering="salvage"]')).toContainText(
    "550",
  );
  await page.waitForTimeout(560);
  await page.locator('[data-engineering="salvage"]').tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile.credits).toBe(26099);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  const p = (await stored(page)).profile;
  expect(p.hull).toBe(1);
  expect(p.engineering.salvage).toBe(1);
  expect(p.credits).toBe(26099);
});

test("v068 new ship pulls a visible experience crystal before contact and refresh cannot credit it twice", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  const before = await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    Q.legacyV068();
    g.spawnTime = 9999;
    g.enemy = [];
    g.encounters.schedule = [];
    g.active = { cannon: 1 };
    g.pickups = [{ x: g.p.x + 180, y: g.p.y, t: 20, type: "xp", value: 1 }];
    Q.step(0.05);
    const p = g.pickups[0];
    if (!p.magnetized || p.x >= g.p.x + 180)
      throw Error("Experience did not pull");
    g.mode = "pause";
    await Q.save();
    await Q.settled();
    return { xp: g.xp, pickup: p };
  });
  expect(before.xp).toBe(0);
  expect(before.pickup.magnetized).toBe(true);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").tap();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  await page.evaluate(async () => {
    const Q = SurvivorQA;
    Q.step(1);
    Q.state().mode = "pause";
    await Q.save();
    await Q.settled();
  });
  expect((await state(page)).xp).toBe(1);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).active.snapshot.game.xp).toBe(1);
  expect((await stored(page)).active.snapshot.game.pickups).toEqual([]);
});
test("v068 all four legal fusions retain real damage and draw their dedicated animated hardware", async ({
  page,
}) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    const Q = SurvivorQA,
      art = SurvivorArt,
      draw = art.draw,
      rows = [];
    const specs = [
      [
        "drone",
        "lock",
        "hunterswarm",
        "arc",
        "capacitor",
        "chainstorm",
        "thunderhive",
        "thunder_relay",
      ],
      [
        "missile",
        "cooler",
        "meteorbarrage",
        "blade",
        "magnet",
        "spiralsaw",
        "blastwheel",
        "blastwheel_hub",
      ],
      [
        "prism",
        "refraction",
        "kaleidoscope",
        "gravity",
        "singularity",
        "collapse",
        "eventhorizon",
        "eventhorizon_core",
      ],
      [
        "cannon",
        "lens",
        "piercebeam",
        "shield",
        "armor",
        "reactiveaegis",
        "ionbastion",
        "bastion_mount",
      ],
    ];
    function evolve(w, p, e) {
      for (let i = 0; i < 5; i++) {
        if (!Q.pick(w) || !Q.pick(p)) throw Error("Equipment failed");
      }
      Q.reward(true);
      if (!Q.pick(e)) throw Error("Evolution failed");
    }
    for (const [a, pa, ea, b, pb, eb, id, hardware] of specs) {
      const g = Q.startModel(91);
      g.active = {};
      g.spawnTime = 9999;
      g.p.inv = 9999;
      g.encounters.schedule = [];
      evolve(a, pa, ea);
      evolve(b, pb, eb);
      Q.reward(true);
      if (!Q.pick(id)) throw Error("Fusion failed");
      const calls = [];
      art.draw = (ctx, name, ...args) => {
        calls.push(name);
        return draw(ctx, name, ...args);
      };
      Q.enemy("tank", id === "blastwheel" ? 156 : 180, 0, 1e7);
      Q.step(0.06);
      Q.runRender();
      const frameA = document.querySelector("#game").toDataURL();
      Q.step(0.15);
      Q.runRender();
      const frameB = document.querySelector("#game").toDataURL();
      art.draw = draw;
      if (!calls.includes(hardware))
        throw Error("Missing hardware " + hardware);
      if (!g.metrics.damage[id] && id !== "thunderhive")
        throw Error("No actual damage " + id);
      Q.validate(Q.snapshot());
      rows.push({
        id,
        hardware,
        calls: calls.filter((x) => x === hardware).length,
        animation: frameA !== frameB,
        damage: g.metrics.damage[id] || 0,
      });
    }
    return rows;
  });
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.calls).toBeGreaterThan(0);
    expect(row.animation).toBe(true);
  }
});
