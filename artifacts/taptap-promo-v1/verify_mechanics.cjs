/* Caption claims checked against the current, unchanged game controller. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createModel } = require('../../prototypes/salvage-survivor-demo/tests/model-harness.cjs');

(async () => {
  const scope = await createModel();
  const Q = scope.SurvivorQA;
  const recipes = [
    ['cannon', 'lens', 'piercebeam'], ['drone', 'lock', 'hunterswarm'],
    ['arc', 'capacitor', 'chainstorm'], ['missile', 'cooler', 'meteorbarrage'],
    ['blade', 'magnet', 'spiralsaw'], ['shield', 'armor', 'reactiveaegis'],
    ['prism', 'refraction', 'kaleidoscope'], ['gravity', 'singularity', 'collapse'],
  ];
  const fusions = [
    ['drone', 'arc', 'thunderhive'], ['missile', 'blade', 'blastwheel'],
    ['prism', 'gravity', 'eventhorizon'], ['cannon', 'shield', 'ionbastion'],
  ];
  function rank(g, id, n) {
    while ((g.active[id] || g.passive[id] || 0) < n) assert(Q.pick(id));
  }
  const checks = [];
  for (const [weapon, support, evolution] of recipes) {
    const g = Q.startModel(87);
    rank(g, weapon, 5); rank(g, support, 4);
    Q.reward(true);
    assert(!Q.options().some(o => o.id === evolution));
    rank(g, support, 5);
    g.upgradeSource = null;
    assert(!Q.options().some(o => o.id === evolution));
    Q.reward(false);
    assert(!Q.options().some(o => o.id === evolution));
    Q.reward(true);
    assert(Q.options().some(o => o.id === evolution));
    assert(Q.pick(evolution));
    checks.push({ weapon, support, evolution, levels: [5, 5], rewardGated: true, randomRollGated: true });
  }
  for (const [a, b, fusion] of fusions) {
    const g = Q.startModel(87);
    for (const weapon of [a, b]) {
      const [, support, evolution] = recipes.find(row => row[0] === weapon);
      rank(g, weapon, 5); rank(g, support, 5);
      Q.reward(true);
      assert(!Q.options().some(o => o.id === fusion));
      assert(Q.pick(evolution));
    }
    Q.reward(false);
    assert(!Q.options().some(o => o.id === fusion));
    Q.reward(true);
    assert(Q.options().some(o => o.id === fusion));
    assert(Q.pick(fusion));
    checks.push({ sources: [a, b], fusion, bothEvolved: true, randomRollGated: true });
  }
  assert.equal(scope.SurvivorBalance.progression.bossAdvancedChance, .75);
  const report = { checks, passed: checks.length,
    scope: 'Current controller model assertions. Forced-roll true/false is used only in this logic test. Actual video capture prepares ordinary successful random reward checkpoints.',
    captionQualifier: '双方 Lv5 · 精英战利品随机抽取', advancedRewardChance: .75 };
  fs.writeFileSync(path.join(__dirname, 'mechanics-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS', checks.length, 'current evolution/fusion caption checks');
})().catch(error => { console.error(error); process.exitCode = 1; });
