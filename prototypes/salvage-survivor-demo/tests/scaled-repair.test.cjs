const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { createModel } = require("./model-harness.cjs");
(async () => {
  const C = await createModel(),
    Q = C.SurvivorQA;
  const output = path.resolve(
    process.env.SURVIVOR_MODEL_OUT || "releases/survivor-v0610-model.json",
  );
  const report = fs.existsSync(output)
    ? JSON.parse(fs.readFileSync(output))
    : { passed: 0, cases: [], errors: [] };
  async function test(name, fn) {
    try {
      const detail = await fn();
      report.passed++;
      report.cases.push({ name: "v0610 " + name, detail });
      console.log("PASS v0610", name);
    } catch (e) {
      report.errors.push({ name: "v0610 " + name, message: e.stack });
      console.error("FAIL v0610", name, e.message);
      process.exitCode = 1;
    }
  }
  function start(time = 0, maxhp = 100, hp = 1) {
    const g = Q.startModel(91);
    g.time = time;
    g.spawnTime = 9999;
    g.encounters.schedule = [];
    g.p.maxhp = maxhp;
    g.p.hp = hp;
    return g;
  }
  function repair(g) {
    Q.level();
    const i = g.presented.findIndex((x) => x.id === "repair");
    assert(i >= 0);
    const before = g.p.hp;
    assert(Q.select(i));
    return g.p.hp - before;
  }
  await test("new runs mark the repair scaling feature without changing combat8 or base XP", () => {
    const g = start();
    assert.equal(g.rules.combatVersion, 8);
    assert.equal(g.rules.repairScalingVersion, 1);
    assert.equal(C.SurvivorBalance.pickup.baseExperienceRadius, 36);
    assert.equal(g.rerollsRemaining, 3);
  });
  await test("one upgrade repairs progressively more hull with game time", () => {
    const rows = [];
    for (const [t, value] of [
      [0, 28],
      [300, 42],
      [600, 56],
      [840, 67],
      [900, 70],
    ]) {
      const g = start(t);
      const healed = repair(g);
      assert.equal(healed, value);
      rows.push({ seconds: t, healed });
    }
    return rows;
  });
  await test("permanent hull capacity contributes proportionally and missing hull caps actual recovery", () => {
    for (const [t, value] of [
      [0, 41],
      [300, 62],
      [600, 83],
      [900, 104],
    ])
      assert.equal(repair(start(t, 148)), value);
    const capped = start(600);
    Q.level();
    capped.p.hp = 92;
    assert(Q.select(capped.presented.findIndex((x) => x.id === "repair")));
    assert.equal(capped.p.hp, 100);
  });
  await test("repair uses one offered upgrade and never awards parts or extra equipment", () => {
    const g = start(600);
    const before = JSON.stringify({
      active: g.active,
      passive: g.passive,
      credits: g.credits,
    });
    Q.level();
    const card = g.presented.findIndex((x) => x.id === "repair");
    assert(Q.select(card));
    assert.equal(Q.select(card), false);
    assert.equal(g.p.hp, 57);
    assert.equal(
      JSON.stringify({
        active: g.active,
        passive: g.passive,
        credits: g.credits,
      }),
      before,
    );
  });
  await test("older snapshots retain fixed28 recovery while current feature and pause time persist", () => {
    const g = start(600);
    delete g.rules.repairScalingVersion;
    assert.equal(repair(g), 28);
    Q.validate(Q.snapshot());
    const n = start(600);
    Q.level();
    const before = n.time;
    Q.step(120);
    assert.equal(n.time, before);
    Q.validate(Q.snapshot());
    const invalid = Q.snapshot();
    invalid.game.rules.repairScalingVersion = 2;
    assert.throws(() => Q.validate(invalid));
  });
  await test("card and visible completion report the actual capped restoration", () => {
    const g = start(600, 100, 10);
    Q.level();
    const html = C.document.getElementById("upgradeList").innerHTML;
    assert(html.includes("恢复56船体"));
    const i = g.presented.findIndex((x) => x.id === "repair");
    assert(Q.select(i));
    assert.equal(
      C.document.getElementById("toast").textContent,
      "船体修复＋56",
    );
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
})();
