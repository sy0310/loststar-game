const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createModel } = require("./model-harness.cjs");
(async () => {
  const C = await createModel(),
    Q = C.SurvivorQA;
  C.SurvivorArt.frameAt = () => 0;
  const output = path.resolve(
    process.env.SURVIVOR_MODEL_OUT || "releases/survivor-v069-model.json",
  );
  const report = fs.existsSync(output)
    ? JSON.parse(fs.readFileSync(output))
    : { passed: 0, cases: [], errors: [] };
  const start = (seed = 91, perks = {}) => {
    const g = Q.startModel(seed, perks);
    g.spawnTime = 9999;
    g.p.inv = 9999;
    g.encounters.schedule = [];
    return g;
  };
  async function test(name, fn) {
    try {
      const detail = await fn();
      report.passed++;
      report.cases.push({ name: "v069 " + name, detail });
      console.log("PASS v069", name);
    } catch (e) {
      report.errors.push({ name: "v069 " + name, message: e.stack });
      console.error("FAIL v069", name, e.message);
      process.exitCode = 1;
    }
  }
  await test("six slots offer nine distinct active and eight passive devices", () => {
    const g = start();
    g.active = {};
    const o = Q.options();
    assert.equal(g.rules.activeSlots, 6);
    assert.equal(g.rules.passiveSlots, 6);
    assert.equal(o.filter((x) => x.kind === "active").length, 9);
    assert.equal(o.filter((x) => x.kind === "passive").length, 8);
    assert.equal(g.rules.combatVersion, 8);
    assert.equal(g.rerollsRemaining, 3);
  });
  await test("focused weapon and its accessory are weighted without being guaranteed", () => {
    const counts = { cannon: 0, lens: 0, capacitor: 0 };
    const active = new Set();
    for (let i = 1; i <= 2000; i++) {
      const g = start(Math.imul(i, 2654435761) >>> 0);
      g.buildFocus = "cannon";
      Q.level();
      assert.equal(new Set(g.presented.map((x) => x.id)).size, 3);
      for (const x of g.presented) {
        if (x.id in counts) counts[x.id]++;
        if (x.kind === "active") active.add(x.id);
      }
    }
    assert(counts.cannon > 240 && counts.cannon < 1000, JSON.stringify(counts));
    assert(
      counts.lens > counts.capacitor && counts.lens < counts.capacitor * 1.8,
      JSON.stringify(counts),
    );
    assert.equal(active.size, 9);
    return counts;
  });
  await test("three normal rerolls persist and each consume one without granting levels or cash", async () => {
    const g = start();
    Q.level();
    const before = {
      level: g.level,
      xp: g.xp,
      credits: g.credits,
      active: JSON.stringify(g.active),
    };
    for (let i = 2; i >= 0; i--) {
      const old = JSON.stringify(g.presented);
      assert(await Q.reroll());
      assert.equal(g.rerollsRemaining, i);
      assert.notEqual(JSON.stringify(g.presented), old);
      Q.validate(Q.snapshot());
    }
    const last = JSON.stringify(g.presented);
    assert.equal(await Q.reroll(), false);
    assert.equal(JSON.stringify(g.presented), last);
    assert.deepEqual(
      {
        level: g.level,
        xp: g.xp,
        credits: g.credits,
        active: JSON.stringify(g.active),
      },
      before,
    );
    Q.select(0);
    Q.level();
    assert.equal(g.rerollsRemaining, 0);
  });
  await test("reroll refuses pre-rolled elite rewards and exhausted legal alternatives", async () => {
    const g = start();
    Q.reward(false);
    const before = JSON.stringify(g.upgradeSource);
    assert.equal(await Q.reroll(), false);
    assert.equal(g.rerollsRemaining, 3);
    assert.equal(JSON.stringify(g.upgradeSource), before);
    const h = start();
    h.active = { cannon: 5, drone: 5, arc: 5, missile: 5, blade: 5, shield: 5 };
    h.passive = {
      lens: 5,
      lock: 5,
      capacitor: 5,
      cooler: 5,
      magnet: 5,
      armor: 5,
    };
    Q.level();
    assert.equal(await Q.reroll(), false);
    assert.equal(h.rerollsRemaining, 3);
  });
  await test("small starting XP radius grows independently through paid antenna or in-run magnet", () => {
    function pull(distance, perks = {}, magnet = 0, rule = 8) {
      const g = start(91, perks);
      g.rules.combatVersion = rule;
      g.passive = magnet ? { magnet } : {};
      const p = { x: distance, y: 0, t: 20, type: "xp", value: 1 };
      g.pickups = [p];
      Q.step(0.05);
      return !!p.magnetized;
    }
    assert(pull(30));
    assert(!pull(80));
    assert(!pull(180));
    assert(
      pull(80, {
        engineering: { version: 1, thrusters: 0, salvage: 6, plating: 0 },
      }),
    );
    assert(pull(70, {}, 1));
    assert(pull(180, {}, 0, 7));
    assert(!pull(180, {}, 0, 6));
  });
  await test("new reroll count is validated while exact old snapshots need no new fields", () => {
    const g = start();
    Q.level();
    const valid = Q.snapshot();
    for (const value of [-1, 4, 1.5, undefined]) {
      const s = structuredClone(valid);
      s.game.rerollsRemaining = value;
      assert.throws(() => Q.validate(s));
    }
    g.rules.combatVersion = 7;
    g.rules.version = "0.6.8";
    delete g.rerollsRemaining;
    Q.validate(Q.snapshot());
  });
  await test("evolved lightning has saturated purple body and gold core with actual damage", () => {
    const g = start();
    g.active = { arc: 5 };
    g.passive = { capacitor: 5 };
    g.evolved = { arc: "chainstorm" };
    Q.enemy("tank", 160, 0, 1e7);
    Q.step(0.05);
    assert(g.arcs.length);
    const a = g.arcs[0];
    assert.equal(a.color, "#b14cff");
    assert.equal(a.core, "#ffcf58");
    assert(a.width >= 10);
    assert(g.metrics.damage.chainstorm > 0);
    const strokes = [];
    C.document.getElementById("game").getContext().stroke = () =>
      strokes.push(C.document.getElementById("game").getContext().strokeStyle);
    Q.runRender();
    assert(strokes.includes("#b14cff"));
    assert(strokes.includes("#ffcf58"));
    return { arc: a, damage: g.metrics.damage.chainstorm };
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
})();
