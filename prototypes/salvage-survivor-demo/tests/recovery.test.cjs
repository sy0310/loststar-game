/* v066 actual controller regressions. HTTP persistence tests are separate. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createModel } = require('./model-harness.cjs');
(async () => {
  const Q = (await createModel()).SurvivorQA;
  const file = path.resolve(process.env.SURVIVOR_MODEL_OUT || 'releases/survivor-v066-model.json');
  const report = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : { passed: 0, cases: [], errors: [] };
  function start(seed = 91) {
    const game = Q.startModel(seed);
    game.spawnTime = 9999;
    game.p.inv = 10000;
    game.encounters.schedule = [];
    return game;
  }
  async function test(name, run) {
    try {
      const detail = await run();
      report.passed++;
      report.cases.push({ name: 'v066 ' + name, detail: detail || null });
      console.log('PASS v066', name);
    } catch (error) {
      report.errors.push({ name: 'v066 ' + name, message: error.stack });
      console.error('FAIL v066', name, error.message);
      process.exitCode = 1;
    }
  }
  await test('new rules5 preserve fifteen minutes and the existing 5+5 limits', () => {
    const game = start();
    assert.equal(game.rules.combatVersion, 5);
    assert.equal(game.endTime, 900);
    for (let n = 1; n < 5; n++) assert(Q.pick('cannon'));
    for (let n = 0; n < 4; n++) assert(Q.pick('lens'));
    Q.reward(true);
    assert(!Q.pick('piercebeam'));
    assert(Q.pick('lens'));
    Q.reward(true);
    assert(Q.pick('piercebeam'));
    Q.validate(Q.snapshot());
  });
  await test('low health offers optional repair below35percent and never applies it automatically', () => {
    const game = start();
    game.p.hp = 34;
    Q.level();
    assert(game.presented.some((option) => option.id === 'repair'));
    assert.equal(game.p.hp, 34);
    assert(Q.select(game.presented.findIndex((option) => option.id === 'repair')));
    assert.equal(game.p.hp, 62);
    assert(!Q.select(0));
    Q.validate(Q.snapshot());
  });
  await test('escort orbit shrinks modestly and remains outside the crystal band', () => {
    const game = start();
    game.active = { drone: 1, prism: 1 };
    Q.enemy('skimmer', 0, -220, 100000);
    Q.step(0.001);
    const shot = game.shots.find((item) => item.kind === 'drone');
    const radius = Math.hypot(shot.x - game.p.x, shot.y - game.p.y);
    assert(radius > 100 && radius < 121, radius);
    return { radius };
  });
  await test('all five elites have triple saved hull while ordinary enemies and bosses retain prior values', () => {
    const values = [];
    for (const type of ['skimmer', 'boss', 'elite']) {
      for (const profile of type === 'elite' ? ['hunter', 'raider', 'warden', 'reaver', 'hive'] : ['hunter']) {
        const game = start();
        game.time = 350;
        Q.spawn(type, 2, profile);
        const hp = game.enemy[0].maxhp;
        start(); Q.legacyV065();
        Q.state().time = 350;
        Q.spawn(type, 2, profile);
        const old = Q.state().enemy[0].maxhp;
        assert(Math.abs(hp - old * (type === 'elite' ? 3 : 1)) <= 2);
        values.push({ type, profile, old, hp });
        Q.validate(Q.snapshot());
      }
    }
    return values;
  });
  await test('elite repair pack survives a saturated pickup field and heals once up to the hull cap', () => {
    const game = start();
    game.p.hp = 70;
    game.pickups = Array.from({ length: 140 }, () => ({ x: 3000, y: 3000, type: 'xp', value: 1, t: 30 }));
    Q.enemy('elite', 0, -70, 1);
    Q.step(0.6);
    const packs = game.pickups.filter((item) => item.type === 'heal');
    assert.equal(packs.length, 1);
    assert.equal(packs[0].value, 24);
    assert(game.pickups.length <= 140);
    const pack = packs[0];
    game.presented = [];
    game.upgradeSource = null;
    game.mode = 'play';
    game.p.x = pack.x; game.p.y = pack.y;
    Q.step(0.01);
    assert.equal(game.p.hp, 94);
    assert(game.texts.some((item) => item.s === '船体 +24'));
    Q.step(0.01);
    assert.equal(game.p.hp, 94);
    game.pickups.push({ x: game.p.x, y: game.p.y, type: 'heal', value: 24, t: 40 });
    Q.step(0.01);
    assert.equal(game.p.hp, game.p.maxhp);
    Q.validate(Q.snapshot());
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
})();
