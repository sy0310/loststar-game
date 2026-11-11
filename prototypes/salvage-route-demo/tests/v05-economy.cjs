/* Reuses the existing legal-policy runner. This file contains developer-only distributions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { play } = require('./port-economy.cjs');
const E = require('../src/engine.js');
const O = require('./legacy-engine.cjs')('94e606fc773d1dc37341d29923e39e7ec7c3863b');
const round = value => +value.toFixed(3);
const policies = {
  noMission: { depth: 3 },
  manualSurvey: { mission: 'survey', depth: 3 },
  cargoGrowth: { mission: 'survey', depth: 4, ship: 'cargo', full: true },
  scoutGrowth: { mission: 'deep', depth: 5, ship: 'scout', full: true },
  heavyGrowth: { mission: 'survey', depth: 4, ship: 'heavy', full: true },
  starterEngineering: { mission: 'survey', depth: 6, mods: true, full: true }
};
const report = {
  baseline: '0.4.2/94e606f', seedCount: 24, voyagesPerSeed: 16,
  scope: 'Same visible-information finite policies and actual model transactions. No QA event overrides, no optimal-play or human-enjoyment claim. Repacks are automated solver interventions, not measured human gestures.',
  comparisons: {}, marketLots: {}, debtRepayment: {}, oldWallet: null
};

function marketHook(style) {
  if (!style) return undefined;
  return (model, state, act) => {
    for (const good of [...state().cargo]) {
      if (model.Market.offerFor(state(), good.uid)) continue;
      const fee = style === 'auction' ? model.Market.listingFee(good) : 0;
      if (state().money < fee) continue;
      act('marketQuote', { uid: good.uid, style, reservePercent: 100 });
      const offer = model.Market.offerFor(state(), good.uid);
      if (offer.status === 'open' && offer.amount > good.value) act('marketAccept', { id: offer.id });
      else act('marketKeep', { id: offer.id });
    }
  };
}
function summarize(runs, arrivals) {
  const rows = runs.flatMap(run => run.rows);
  const counts = {};
  const first = {};
  const second = {};
  const early = {};
  const sequences = new Map();
  for (const arrival of arrivals) {
    counts[arrival.id] = (counts[arrival.id] || 0) + 1;
    if (arrival.depth === 1) first[arrival.id] = (first[arrival.id] || 0) + 1;
    if (arrival.depth === 2) second[arrival.id] = (second[arrival.id] || 0) + 1;
    if (arrival.depth <= 4) early[arrival.id] = (early[arrival.id] || 0) + 1;
    const key = arrival.seed + '/' + arrival.run;
    if (arrival.depth <= 4) sequences.set(key, [...(sequences.get(key) || []), arrival.id]);
  }
  return {
    voyages: rows.length, meanNetCashAfterRealPurchasesAndPreparation: round(rows.reduce((sum, row) => sum + row.netCash, 0) / rows.length),
    meanGoodsReturned: round(rows.reduce((sum, row) => sum + row.goodsReturned, 0) / rows.length),
    meanDepth: round(rows.reduce((sum, row) => sum + row.depth, 0) / rows.length),
    repacks: runs.reduce((sum, run) => sum + run.counts.repacks, 0),
    geometricOpportunitiesDeclined: runs.reduce((sum, run) => sum + run.counts.declined, 0),
    rescues: runs.reduce((sum, run) => sum + run.counts.rescues, 0), aid: runs.reduce((sum, run) => sum + run.counts.aid, 0),
    firstStationIdentities: Object.keys(first).length, secondStationIdentities: Object.keys(second).length,
    distinctFirstFourSequences: new Set([...sequences.values()].map(sequence => sequence.join('/'))).size,
    newEventVisits: Object.entries(counts).filter(([id]) => E.NewEncounters.metadata[id]).reduce((sum, [, count]) => sum + count, 0),
    arrivalCount: arrivals.length, newEventVisitPercent: round(100 * arrivals.filter(arrival => E.NewEncounters.metadata[arrival.id]).length / arrivals.length),
    visits: counts, first, second, firstFour: early,
    shipPurchaseVoyages: runs.map(run => run.buys.find(buy => buy.type === 'ship')?.run ?? null),
    finalCash: runs.map(run => run.final.money), runs
  };
}
for (const [name, policy] of Object.entries(policies)) {
  report.comparisons[name] = {};
  for (const [version, model, style] of [['v042', O, null], ['v05ordinary', E, null], ['v05bold', E, 'bold'], ['v05auction', E, 'auction']]) {
    const arrivals = [];
    const runs = Array.from({ length: report.seedCount }, (_, index) => play(index + 1, policy, 120, report.voyagesPerSeed, model, {
      onArrival: (engine, state) => arrivals.push({ seed: index + 1, run: state.runNo, depth: state.depth, id: state.event.id }),
      onReturn: marketHook(style)
    }));
    report.comparisons[name][version] = summarize(runs, arrivals);
  }
}
const seenNew = new Set();
for (const comparison of Object.values(report.comparisons)) {
  for (const id of Object.keys(comparison.v05ordinary.visits)) if (E.NewEncounters.metadata[id]) seenNew.add(id);
  assert(comparison.v05ordinary.firstStationIdentities >= 6);
  assert.equal(comparison.v05ordinary.rescues, 0);
}
assert.equal(seenNew.size, 12, 'All12 must be reached in natural fixed-seed policy runs');
report.naturalNewEventCoverage = [...seenNew];

// Fixed inventory isolates optional-market cash from changes in routes or purchasing.
for (const style of ['ordinary', 'cautious', 'bold', 'auction', 'keep']) {
  let net = 0;
  let fees = 0;
  let completed = 0;
  const differences = [];
  for (let seed = 1; seed <= 512; seed++) {
    let state = E.create(seed);
    state.money = 27049;
    const goods = [
      { uid: 1, itemId: 'broken_engine', shapeId: 'line2', cells: 2, value: 22 },
      { uid: 2, itemId: 'echo_brood_capsule', shapeId: 'square4', cells: 4, value: 171 },
      { uid: 3, itemId: 'hull_clinger', shapeId: 'ell3', cells: 3, value: 151 },
      { uid: 4, itemId: 'time_measure', shapeId: 'line2', cells: 2, value: 131 },
      { uid: 5, itemId: 'gravity_faceter', shapeId: 'tee4', cells: 4, value: 181 }
    ].map(item => ({ ...item, value: E.NewEncounters.curios[item.itemId] ? E.NewEncounters.curios[item.itemId].value + 3 * 8 : item.value, shapeVersion: 1, name: '隔离市场样本'+item.uid, acquiredRun: 0 }));
    state.cargo = goods;
    state.nextUid = 6;
    state.cargoGrid.placements = E.Cargo.solve(goods, [], E.cargoSpace(state));
    assert(state.cargoGrid.placements);
    const act = (type, extra = {}) => {
      const result = E.dispatch(state, { type, ...extra });
      assert(result.ok, result.message);
      state = result.state;
    };
    if (!['ordinary', 'keep'].includes(style)) marketHook(style)(E, () => state, act);
    if (style !== 'keep' && state.cargo.length) act('sellAll');
    const income = state.money - 27049;
    const ordinary = goods.reduce((sum, item) => sum + item.value, 0);
    net += income;
    fees += state.ledger.filter(row => row.category === 'marketListing').reduce((sum, row) => sum - row.delta, 0);
    completed += state.ledger.filter(row => row.category === 'marketSale').length;
    differences.push(income - (style === 'keep' ? 0 : ordinary));
  }
  report.marketLots[style] = { seeds: 512, itemsPerSeed: 5, meanActualCash: round(net / 512), meanFees: round(fees / 512), acceptedQuotes: completed, minimumDeltaVsOrdinary: Math.min(...differences), maximumDeltaVsOrdinary: Math.max(...differences) };
}

// Actual repayments, retaining at least400parts for the following preparation.
for (const [name, policy] of Object.entries(policies).slice(0, 4)) {
  const payoffVoyages = [];
  for (let seed = 1; seed <= 8; seed++) {
    let firstPaidOff = null;
    let ports = 0;
    const run = play(seed, policy, 120, 80, E, {
      afterPrepare: (engine, state, act) => {
        ports++;
        while (state().debt && state().money >= 400 + Math.min(100, state().debt)) act('repay', { amount: 100 });
        if (!state().debt && firstPaidOff === null) firstPaidOff = ports;
      }
    });
    payoffVoyages.push({ seed, firstPaidOff, debtAfter80: run.final.debt, cashAfter80: run.final.money });
  }
  report.debtRepayment[name] = payoffVoyages;
}
let old = O.create(19);
old.money = 55499;
function oldAction(type, extra = {}) {
  const result = O.dispatch(old, { type, ...extra });
  assert(result.ok, result.message);
  old = result.state;
}
for (const id of Object.keys(O.PORT.ships)) {
  if (id !== 'starter') { oldAction('buyShip', { id }); oldAction('equipShip', { id }); }
  while (O.cargoUpgradeQuote(old).cost !== null) oldAction('upgradeCargo');
  for (const kind of ['fuel', 'hull']) while (O.shipUpgradeQuote(old, kind).cost !== null) oldAction('upgradeShip', { kind });
}
assert.equal(old.money, 27049);
const migrated = E.restore(old);
assert.equal(migrated.money, 27049);
assert.equal(migrated.debt, old.debt);
assert.deepEqual(JSON.parse(JSON.stringify(migrated.fleet)), JSON.parse(JSON.stringify(old.fleet)));
assert.deepEqual(migrated.ledger, JSON.parse(JSON.stringify(old.ledger)));
report.oldWallet = { openingBeforeOldPurchases: 55499, allOldPurchases: 28450, opening: 27049, afterMigration: migrated.money, debt: migrated.debt, fleet: migrated.fleet, oldLedgerPreserved: true, purchasePricesPreserved: JSON.stringify(E.PORT) === JSON.stringify(O.PORT) };
const repo = path.resolve(__dirname, '../../..');
report.inputFiles = ['src/engine.js','src/cargo-layout.js','src/ship-holds.js','src/encounters-v05.js','src/market-v05.js','tests/port-economy.cjs','tests/v05-economy.cjs'].map(name => 'prototypes/salvage-route-demo/'+name)
  .concat(['design/star-salvage/v05/BALANCE_V05.json','design/star-salvage/v05/ship-holds-approved.json','design/star-salvage/v041/BALANCE_V041.json','design/star-salvage/BALANCE_V01.json'])
  .map(name => { const bytes=fs.readFileSync(path.join(repo,name)); return {path:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}; });
const output = path.resolve(__dirname, '../../../releases/v05-economy.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ policies: Object.fromEntries(Object.entries(report.comparisons).map(([name, versions]) => [name, Object.fromEntries(Object.entries(versions).map(([version, data]) => [version, { cash: data.meanNetCashAfterRealPurchasesAndPreparation, goods: data.meanGoodsReturned, newEventPercent: data.newEventVisitPercent, firstIdentities: data.firstStationIdentities, rescues: data.rescues }]))])), marketLots: report.marketLots, naturalNewEventCoverage: seenNew.size, oldWallet: report.oldWallet }, null, 2));
