const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/engine.js');
const O = require('./legacy-engine.cjs')('94e606fc773d1dc37341d29923e39e7ec7c3863b');
const copy = value => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS', name); }
  catch (error) { console.error('FAIL', name, error); process.exitCode = 1; }
}
function act(engine, state, type, action = {}) {
  const result = engine.dispatch(state, { type, ...action });
  assert(result.ok, result.message);
  return result.state;
}
function oldShip(shipId, level = 0) {
  let state = O.create(41);
  state.money = 27049;
  if (shipId !== 'starter') {
    state = act(O, state, 'buyShip', { id: shipId });
    state = act(O, state, 'equipShip', { id: shipId });
  }
  for (let n = 0; n < level; n++) state = act(O, state, 'upgradeCargo');
  state = act(O, state, 'fillFuel');
  return state;
}
function good(uid, shapeId = 'point1', itemId = 'metal_crate', value = 100) {
  return { uid, shapeId, itemId, cells: E.Cargo.area(shapeId), shapeVersion: 1, value, acquiredRun: 0, name: '显式QA物件'+uid };
}
function loaded(state, goods, engine = E) {
  state.cargo = copy(goods);
  state.nextUid = Math.max(state.nextUid, ...goods.map(item => item.uid + 1));
  state.cargoGrid.placements = engine.Cargo.solve(goods, [], engine.cargoSpace(state));
  assert(state.cargoGrid.placements);
  engine.assertState(state);
  return state;
}
const preservedFields = ['money', 'debt', 'fuel', 'hull', 'rng', 'revision', 'seq', 'nextUid', 'runNo', 'distance', 'lastLeg', 'legs', 'history', 'tools', 'ledger', 'missions', 'activeMissionId', 'missionSlot', 'nextMissionUid', 'fleet', 'voyageShip', 'archive', 'log', 'telemetry', 'flags', 'route', 'event', 'result', 'summary'];

for (const [shipId, spec] of Object.entries(E.PORT.ships)) {
  for (let level = 0; level <= spec.cargoUpgradeCosts.length; level++) {
    test(shipId+' level'+level+' full schema6 migrates with exact paid rights and goods', () => {
      let old = oldShip(shipId, level);
      const capacity = O.capacityCells(old);
      old = loaded(old, [good(1, 'legacy16'), ...Array.from({ length: capacity - 16 }, (_, index) => good(index + 2))], O);
      const before = copy(old);
      const state = E.restore(old);
      for (const key of preservedFields) assert.deepEqual(copy(state[key]), before[key], key);
      assert.deepEqual(state.cargo, before.cargo);
      assert.equal(E.capacityCells(state), capacity);
      assert.equal(state.hold.mode, 'bc');
      assert(E.Cargo.validate(state.cargo, state.cargoGrid.placements, E.cargoSpace(state)).ok);
      assert.deepEqual(E.restore(state), state);
      assert.deepEqual(copy(old), before);
    });
    test(shipId+' level'+level+' ongoing old voyage uses original pool and RNG through return', () => {
      let old = act(O, oldShip(shipId, level), 'depart');
      old = act(O, old, 'travel', { id: old.route[0].uid });
      old = act(O, old, 'choose', { id: 'leave', nonce: old.event.nonce });
      let state = E.restore(old);
      assert.equal(state.hold.mode, 'legacy');
      assert.equal(state.run.contentPoolVersion, 'v042');
      for (const key of preservedFields) assert.deepEqual(copy(state[key]), copy(old[key]), key);
      assert.deepEqual(state.cargoGrid, copy(old.cargoGrid));
      old = act(O, old, 'continue');
      state = act(E, state, 'continue');
      assert.deepEqual(state.route, copy(old.route));
      assert.equal(state.rng, old.rng);
      old = act(O, old, 'return');
      state = act(E, state, 'return');
      assert.equal(state.money, old.money);
      assert.equal(state.fuel, old.fuel);
      assert.equal(state.hold.mode, 'legacy');
      state = act(E, state, 'port');
      assert.equal(state.hold.mode, 'bc');
      state = act(E, state, 'depart');
      assert.equal(state.run.contentPoolVersion, 'v05');
    });
  }
}
test('old full4x6 legacy16+8 stays legal when scout edge bay cannot repack', () => {
  const old = loaded(oldShip('scout', 2), [good(1, 'legacy16'), good(2, 'legacy8')], O);
  const state = E.restore(old);
  assert.equal(state.hold.mode, 'legacy');
  assert.deepEqual(state.cargoGrid, copy(old.cargoGrid));
  assert.deepEqual(state.cargo, copy(old.cargo));
  const next = act(E, state, 'sell', { id: 2 });
  assert.equal(next.money, state.money + 100);
  assert.equal(next.hold.mode, 'bc');
  assert.equal(next.cargo[0].uid, 1);
  assert.equal(E.capacityCells(next), 24);
});
test('corrupt old positions are rejected before safe port repacking', () => {
  const old = loaded(oldShip('starter'), [good(1), good(2)], O);
  old.cargoGrid.placements[1] = { ...old.cargoGrid.placements[0], uid: 2 };
  assert.throws(() => E.restore(old), /重叠/);
});
test('client-supplied hold masks cannot create extra cells', () => {
  const state = E.create(2);
  state.cargoGrid.usableCellMask = Array.from({ length: 4 }, () => Array(6).fill(true));
  assert.throws(() => E.restore(state));
  delete state.cargoGrid.usableCellMask;
  state.hold.usableCellMask = [[true]];
  assert.throws(() => E.restore(state));
});
test('every BC paid upgrade preserves existing coordinates and exact original price', () => {
  for (const [shipId, spec] of Object.entries(E.PORT.ships)) {
    let state = E.restore(oldShip(shipId));
    for (let level = 0; level < spec.cargoUpgradeCosts.length; level++) {
      state = loaded(state, Array.from({ length: E.capacityCells(state) }, (_, index) => good(index + 1)));
      const positions = copy(state.cargoGrid.placements);
      const before = state.money;
      state = act(E, state, 'upgradeCargo');
      assert.equal(state.money, before - spec.cargoUpgradeCosts[level]);
      assert.deepEqual(state.cargoGrid.placements, positions);
      assert.equal(E.capacityCells(state), spec.width * (spec.height + level + 1));
    }
  }
});

function atEvent(id, depth = 3, seed = 1) {
  let state = E.create(seed);
  state.money = 27049;
  state = act(E, state, 'buyShip', { id: 'scout' });
  state = act(E, state, 'equipShip', { id: 'scout' });
  for (let n = 0; n < 3; n++) state = act(E, state, 'upgradeShip', { kind: 'fuel' });
  state = act(E, state, 'fillFuel');
  state = act(E, state, 'depart');
  for (let n = 1; n < depth; n++) {
    state = act(E, state, 'travel', { id: state.route[0].uid });
    state = act(E, state, 'choose', { id: 'leave', nonce: state.event.nonce });
    state = act(E, state, 'continue');
  }
  // Explicit isolated-QA route override, followed by the real travel transaction.
  const data = E.NewEncounters.metadata[id];
  state.route[0] = { ...state.route[0], id, name: data[0], signal: data[1], risk: data[2] };
  return act(E, state, 'travel', { id: state.route[0].uid });
}
test('all12 new factories have real choices, safe leaving and atomic costs/loot', () => {
  assert.equal(Object.keys(E.NewEncounters.metadata).length, 12);
  assert.equal(Object.keys(E.NewEncounters.curios).length, 4);
  for (const [id, data] of Object.entries(E.NewEncounters.metadata)) {
    const state = atEvent(id, Math.max(2, data[3]), 73);
    const event = E.encounter(state);
    assert(event.choices.length >= 2 && event.choices.length <= 3);
    assert(event.choices.some(choice => choice.id === 'leave' && !E.checkChoice(state, choice)));
    for (const choice of event.choices) {
      if (E.checkChoice(state, choice)) continue;
      const action = { type: 'choose', id: choice.id, nonce: state.event.nonce };
      const before = copy(state);
      const result = E.dispatch(state, action);
      assert(result.ok, id + '/' + choice.id + ':' + result.message);
      assert.deepEqual(state, before);
      assert(result.state.fuel >= E.safeReturnReserve(result.state));
      assert.deepEqual(E.restore(result.state), result.state);
      assert(!E.dispatch(result.state, action).ok);
    }
  }
});
test('second-voyage first station has6+ legal identities and station2 is not fixed', () => {
  const first = new Set();
  let withoutStation = 0;
  for (let seed = 1; seed <= 160; seed++) {
    let state = act(E, E.create(seed), 'depart');
    state = act(E, state, 'abort');
    state = act(E, state, 'depart');
    for (const route of state.route) first.add(route.id);
    state = act(E, state, 'travel', { id: state.route[0].uid });
    state = act(E, state, 'choose', { id: 'leave', nonce: state.event.nonce });
    state = act(E, state, 'continue');
    if (!state.route.some(route => route.id === 'station')) withoutStation++;
    assert.deepEqual(E.restore(state), state);
  }
  assert(first.size >= 6);
  assert(withoutStation > 80);
});
test('six eggs trigger legally, cap once per voyage, and export contains only seen text', () => {
  const targets = { early_signal: 'lost_probe', unmapped_blank: 'reverse_beacon', reverse_droplet: 'magnetic_blind', empty_passenger: 'drifting_cup', following_light: 'darkside_signal', shifting_coordinates: 'foldback_marker' };
  for (const [eggId, eventId] of Object.entries(targets)) {
    let state;
    for (let seed = 1; seed < 600; seed++) {
      const candidate = atEvent(eventId, 3, seed);
      if (candidate.run.eggId === eggId) { state = candidate; break; }
    }
    assert(state, eggId);
    assert.equal(state.discoveries.eggs.length, 1);
    const before = JSON.stringify(state);
    E.encounter(state);
    assert.equal(JSON.stringify(state), before);
    for (const otherId of Object.keys(E.NewEncounters.eggs)) {
      if (otherId !== eggId) assert(!before.includes(E.NewEncounters.eggs[otherId]));
    }
    if (eggId === 'shifting_coordinates') {
      state = act(E, state, 'choose', { id: 'memento', nonce: state.event.nonce });
      assert(state.discoveries.mementoClaimed);
      const uid = state.cargo.at(-1).uid;
      state = act(E, state, 'return');
      state = act(E, state, 'sell', { id: uid });
      assert(state.discoveries.mementoClaimed);
      assert(!E.dispatch(state, { type: 'choose', id: 'memento', nonce: '1/3' }).ok);
    } else {
      state = act(E, state, 'choose', { id: 'leave', nonce: state.event.nonce });
      state = act(E, state, 'continue');
      state = act(E, state, 'travel', { id: state.route[0].uid });
      assert.equal(state.discoveries.eggs.length, 1);
    }
    assert.deepEqual(E.restore(state), state);
  }
});

function marketGoods(seed = 12, money = 454) {
  const state = require('./v051-fixtures.cjs').safePort(seed,money);
  return loaded(state, [good(1, 'line2', 'time_measure', 100), good(2, 'point1', 'fuel_can', 50)]);
}
test('negotiation freezes once, leaves route RNG and UID intact, accepts one sale only', () => {
  let state = marketGoods();
  const rng = state.rng;
  const positions = copy(state.cargoGrid.placements);
  state = act(E, state, 'marketQuote', { uid: 1, style: 'bold' });
  assert.equal(state.rng, rng);
  assert.equal(state.money, 454);
  assert.deepEqual(state.cargoGrid.placements, positions);
  const offer = state.market.offers[0];
  assert.deepEqual(E.restore(state), state);
  assert(!E.dispatch(state, { type: 'marketQuote', uid: 1, style: 'auction', reservePercent: 100 }).ok);
  state = act(E, state, 'marketAccept', { id: offer.id });
  assert.equal(state.money, 454 + offer.amount);
  assert(!state.cargo.some(item => item.uid === 1));
  assert.equal(state.ledger.filter(row => row.offerId === offer.id).length, 1);
  assert(!E.dispatch(state, { type: 'marketAccept', id: offer.id }).ok);
});
test('auction fee and3 fictional bids persist, failed sale retains goods and normal sale works', () => {
  let sawNoSale = false;
  for (let seed = 1; seed <= 15; seed++) {
    let state = marketGoods(seed);
    const original = copy(state.cargo);
    state = act(E, state, 'marketQuote', { uid: 1, style: 'auction', reservePercent: 110 });
    const offer = state.market.offers[0];
    assert.equal(offer.bids.length, 3);
    assert.equal(state.money, 449);
    assert.deepEqual(state.cargo, original);
    assert.deepEqual(E.restore(state), state);
    assert(!E.dispatch(state, { type: 'marketQuote', uid: 1, style: 'auction', reservePercent: 110 }).ok);
    if (offer.status === 'noSale') {
      sawNoSale = true;
      assert(!E.dispatch(state, { type: 'marketAccept', id: offer.id }).ok);
      state = act(E, state, 'marketKeep', { id: offer.id });
      state = act(E, state, 'sell', { id: 1 });
      assert.equal(state.money, 549);
      assert.equal(state.market.offers[0].status, 'void');
    } else {
      state = act(E, state, 'marketAccept', { id: offer.id });
      assert.equal(state.money, 449 + offer.amount);
    }
    assert.equal(state.ledger.filter(row => row.category === 'marketListing').length, 1);
  }
  assert(sawNoSale);
});
test('quote cancellation, insufficient fee, stale revision and invalid input change nothing', () => {
  const state = marketGoods(12,0);
  const before = copy(state);
  for (const action of [{ type: 'marketQuote', uid: 1, style: 'auction', reservePercent: 100 }, { type: 'marketQuote', uid: 1, style: 'auction', reservePercent: 1 }, { type: 'marketQuote', uid: 99, style: 'bold' }, { type: 'marketQuote', uid: 1, style: 'bold', expected: 99 }]) {
    assert(!E.dispatch(state, action).ok);
    assert.deepEqual(state, before);
  }
});
test('using a quoted consumable invalidates that quote and releases its UID', () => {
  let state = marketGoods();
  state.cargo[1].ability = 'fuel';
  state = act(E, state, 'marketQuote', { uid: 2, style: 'cautious' });
  const offer = state.market.offers[0];
  state = act(E, state, 'use', { id: 2 });
  assert.equal(state.market.offers[0].status, 'void');
  assert(!E.dispatch(state, { type: 'marketAccept', id: offer.id }).ok);
  assert.equal(state.cargo.length, 1);
});
test('rescue preserves quoted carried goods and loses only this voyage cargo', () => {
  let state = marketGoods();
  state = act(E, state, 'marketQuote', { uid: 1, style: 'bold' });
  const offer = copy(state.market.offers[0]);
  state = act(E, state, 'depart');
  state = act(E, state, 'travel', { id: state.route[0].uid });
  state.event.id='tank'; // Explicit isolated QA retains the carried-goods rescue regression.
  state = act(E, state, 'choose', { id: 'force', nonce: state.event.nonce });
  assert.equal(state.cargo.length, 5);
  // Explicit QA damage. The ordinary rescue action still selects real acquiredRun ownership.
  state.hull = 0;
  state = act(E, state, 'rescue');
  assert.deepEqual(state.cargo.map(item => item.uid), [1, 2]);
  assert.deepEqual(state.market.offers[0], offer);
  assert.equal(state.summary.lost, 3);
  assert(!E.dispatch(state, { type: 'rescue' }).ok);
  assert.deepEqual(E.restore(state), state);
});
test('original fees, forward fuel, ordinary return and ship rights stay identical', () => {
  assert.deepEqual(copy(E.BALANCE), copy(O.BALANCE));
  assert.deepEqual(copy(E.PORT), copy(O.PORT));
  assert.deepEqual(E.LEG, copy(O.LEG));
  assert.equal(E.homeCost({ distance: 43 }), O.homeCost({ distance: 43 }));
});
test('buying port stock and reselling through any market style cannot generate cash', () => {
  for (const [id, product] of Object.entries(E.PORT.products)) {
    for (const style of ['cautious', 'bold', 'auction']) {
      for (let seed = 1; seed <= 128; seed++) {
        let state = require('./v051-fixtures.cjs').safePort(seed,1000);
        state = act(E, state, 'buyProduct', { id });
        const uid = state.cargo[0].uid;
        state = act(E, state, 'marketQuote', { uid, style, reservePercent: 100 });
        const offer = state.market.offers[0];
        if (offer.status === 'open' && offer.amount > product.value) state = act(E, state, 'marketAccept', { id: offer.id });
        else state = act(E, state, 'sell', { id: uid });
        assert(state.money < 1000);
        assert.equal(state.cargo.length, 0);
      }
    }
  }
});
test('inconsistent egg flags and new content smuggled into an old voyage are rejected', () => {
  let state;
  for (let seed=1; seed<600; seed++) {
    const candidate = atEvent('lost_probe', 3, seed);
    if (candidate.run.eggId) { state=candidate; break; }
  }
  assert(state);
  const badFlag = copy(state);
  badFlag.run.eggId = null;
  assert.throws(() => E.restore(badFlag), /彩蛋/);
  const badPool = copy(state);
  badPool.run.contentPoolVersion = 'v042';
  assert.throws(() => E.restore(badPool), /旧航次/);
});
const output = path.resolve(__dirname, '../../../releases/v05-model-results.json');
fs.writeFileSync(output, JSON.stringify({ passed, scope: 'Actual v05 model; route overrides explicitly isolated QA, natural coverage measured separately', failed: !!process.exitCode }, null, 2) + '\n');
if (process.exitCode) process.exit(1);
