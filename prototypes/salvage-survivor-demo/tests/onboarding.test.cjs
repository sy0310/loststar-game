const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createModel } = require("./model-harness.cjs");

test("new voyage uses first-minute progression and validates its snapshot", async () => {
  const { SurvivorQA: q, SurvivorBalance: b } = await createModel();
  const g = q.startModel(413);
  assert.equal(g.rules.onboardingVersion, 1);
  assert.equal(g.xpNext, b.onboarding.firstLevelXP);
  q.step(1);
  assert(g.enemy.length && g.enemy.every(e => e.t === "skimmer" && e.maxhp <= 24));
  q.validate(q.snapshot());
  for (const [version, combat] of [[2,8],[1,7]]) {
    const snapshot = q.snapshot();
    Object.assign(snapshot.game.rules, {onboardingVersion: version, combatVersion: combat});
    assert.throws(() => q.validate(snapshot));
  }
});

test("legacy seed 413 retains the v0.6.10 trajectory at five-second intervals", async () => {
  const { SurvivorQA: q } = await createModel();
  const g = q.startModel(413);
  q.legacyV0610();
  assert.equal(g.xpNext, 100);
  const trajectory = [];
  for (let i = 0; i < 6; i++) {
    q.step(5);
    trajectory.push([g.xp, g.enemy.length, g.p.hp, g.numberSpawned]);
  }
  assert.deepEqual(trajectory, [[0,2,100,4],[0,3,94,9],[0,6,88,16],[24,10,52,24],[40,15,22,34],[40,17,0,38]]);
});
