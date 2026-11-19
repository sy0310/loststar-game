const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createModel } = require("./model-harness.cjs");

test("new voyage uses first-minute progression and validates its snapshot", async () => {
  const { SurvivorQA: q, SurvivorBalance: b } = await createModel();
  const g = q.startModel(413);
  assert.equal(g.rules.onboardingVersion, 1);
  assert.equal(g.xpNext, b.onboarding.firstLevelXP);
  q.step(1);
  assert(
    g.enemy.length && g.enemy.every((e) => e.t === "skimmer" && e.maxhp <= 24),
  );
  q.validate(q.snapshot());
  for (const [version, combat] of [
    [2, 8],
    [1, 7],
  ]) {
    const snapshot = q.snapshot();
    Object.assign(snapshot.game.rules, {
      onboardingVersion: version,
      combatVersion: combat,
    });
    assert.throws(() => q.validate(snapshot));
  }
});

test("legacy seed 413 retains the v0.6.10 trajectory at five-second intervals", async () => {
  const { SurvivorQA: q } = await createModel();
  const g = q.startModel(413);
  q.legacyV0610();
  assert.equal(g.xpNext, 100);
  const trajectory = [];
  const seeds = [];
  for (let i = 0; i < 6; i++) {
    q.step(5);
    seeds.push(q.snapshot().seed);
    trajectory.push([g.xp, g.enemy.length, g.p.hp, g.numberSpawned]);
  }
  assert.deepEqual(
    seeds,
    [2626623453, 1449490972, 4000822627, 1408344739, 4287221731, 2229709882],
  );
  assert.deepEqual(trajectory, [
    [0, 2, 100, 4],
    [0, 3, 94, 9],
    [0, 6, 88, 16],
    [24, 10, 52, 24],
    [40, 15, 22, 34],
    [40, 17, 0, 38],
  ]);
});

test("discounts end at level ten and the damage ramp ends at two minutes", async () => {
  const { SurvivorQA: q, SurvivorBalance: b } = await createModel();
  for (const legacy of [false, true]) {
    const g = q.startModel(92);
    if (legacy) q.legacyV0610();
    for (let level = 2; level <= 12; level++) {
      const { base, linear, powerScale, power } = b.assault.levelXP;
      const growth = level - 2;
      const cost = Math.round(
        base + linear * growth + powerScale * growth ** power,
      );
      q.level();
      assert.equal(
        g.xpNext,
        Math.round(
          cost * (legacy ? 1 : (b.onboarding.levelXPScale[growth] ?? 1)),
        ),
      );
    }
    for (const time of [0, 60, 120, 300]) {
      g.time = time;
      g.mode = "play";
      g.p.inv = 0;
      g.p.hp = 100;
      q.forceDamage(20);
      const { start, fullAt } = b.onboarding.damageRamp;
      const factor = legacy
        ? 1
        : start + (1 - start) * Math.min(1, time / fullAt);
      assert.equal(g.p.hp, 100 - 20 * factor);
    }
  }
});

test("new XP radius, magnet and age-based recall leave other drops and legacy XP alone", async () => {
  const { SurvivorQA: q } = await createModel();
  function drop({
    distance = 2000,
    life = 30,
    time = 5,
    type = "xp",
    magnet = 0,
    legacy = false,
  }) {
    const g = q.startModel(88);
    if (legacy) q.legacyV0610();
    g.spawnTime = 999;
    g.time = time;
    g.passive.magnet = magnet;
    const pickup = { x: distance, y: 0, t: life, value: 1, type };
    g.pickups = [pickup];
    q.step(1 / 60);
    return g.pickups[0];
  }
  for (const [legacy, radius, increment] of [
    [false, 96, 40],
    [true, 36, 0.8 * 55],
  ]) {
    for (const magnet of [0, 1]) {
      const edge = radius + magnet * increment;
      assert(drop({ distance: edge - 1, magnet, legacy }).magnetized);
      assert(!drop({ distance: edge + 1, magnet, legacy }).magnetized);
    }
  }
  for (const [time, after] of [
    [20, 1.2],
    [60, 8],
  ]) {
    assert(!drop({ life: 30 - after + 0.1, time }).magnetized);
    assert(drop({ life: 30 - after, time }).magnetized);
  }
  assert(drop({ life: 0.01 }).magnetized);
  assert.equal(drop({ life: 0.01, legacy: true }), undefined);
  assert.equal(drop({ life: 0.01, type: "scrap" }), undefined);
});

test("opening streams are one-shot skimmers and normal waves return after eighteen seconds", async () => {
  const { SurvivorQA: q } = await createModel();
  const types = new Set();
  for (let seed = 1; seed <= 32; seed++) {
    const g = q.startModel(seed);
    for (const time of [0, 3, 6, 9, 12, 15, 17.9, 18, 24]) {
      g.enemy = [];
      g.time = time;
      g.spawnTime = 0;
      q.step(1 / 60);
      assert(g.enemy.length >= 2);
      for (const enemy of g.enemy) {
        if (time < 18) {
          assert.equal(enemy.t, "skimmer");
          assert(enemy.maxhp <= 24);
        } else types.add(enemy.t);
      }
    }
  }
  assert(types.size > 1);
});
