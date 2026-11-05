import {discoveries} from '../src/content/catalog';
import {cost, MAX_LEVEL, type UpgradeId} from '../src/game/engine';
import {growthCatalog, growthLevel} from '../src/game/growth';
import {advanceFusion, createFusion, curioPrices, reduceFusion} from '../src/fusion/domain';
import type {FusionAction, FusionSave} from '../src/fusion/contracts';
import {abilityPrices, refinementView, type AbilityLevel} from '../src/fusion/progression';

export type FirstPlanetFixtureStage = 'buried' | 'found' | 'clean' | 'stabilized';
export interface FirstPlanetFixtureOptions {
  receiptAbility?: AbilityLevel;
  tapeAbility?: AbilityLevel;
}
export interface FirstPlanetFixtureAction {
  action: FusionAction;
  at: number;
  balanceBefore: number;
  balanceAfter: number;
  paid: number;
  claimed: number;
}
export interface FirstPlanetFixtureAudit {
  source: 'accelerated-model-fixture';
  label: string;
  seed: number;
  startedAt: number;
  endedAt: number;
  simulatedMs: number;
  advances: number;
  offlineAdvances: number;
  actionCount: number;
  actionsByType: Record<string, number>;
  actions: FirstPlanetFixtureAction[];
  initialParts: number;
  grossEarned: number;
  maintenancePaid: number;
  actionPaid: number;
  claimedParts: number;
  endingParts: number;
  collection: string[];
  receiptEvidence: string[];
  verifiedEvidence: string[];
}

const seed = 317;
const maxAdvances = 512;
const maxActions = 256;
const maxSimulatedMs = 24 * 60 * 60 * 1000;
const earningStepMs = 300000;
const stages: FirstPlanetFixtureStage[] = ['buried', 'found', 'clean', 'stabilized'];

/** Accelerated model fixture. Every owned item and expense comes from the normal campaign reducers. */
export function firstPlanetFixture(
  now: number,
  caseLevel = 0,
  stage: FirstPlanetFixtureStage = 'stabilized',
  options: FirstPlanetFixtureOptions = {},
): {state: FusionSave; audit: FirstPlanetFixtureAudit} {
  if (!Number.isFinite(now) || now < maxSimulatedMs || now > 1e15) throw new Error('Invalid first-planet fixture clock');
  if (!Number.isInteger(caseLevel) || caseLevel < 0 || caseLevel > 3) throw new Error('Fixture case level must be 0–3');
  if (!stages.includes(stage)) throw new Error('Unknown first-planet fixture stage');
  const receiptAbility = options.receiptAbility ?? (stage === 'stabilized' ? 2 : 0);
  const tapeAbility = options.tapeAbility ?? (stage === 'stabilized' ? 2 : 0);
  if (![0, 1, 2].includes(receiptAbility) || ![0, 1, 2].includes(tapeAbility)) throw new Error('Invalid fixture ability level');
  if (stage !== 'stabilized' && (receiptAbility || tapeAbility)) throw new Error('Abilities require a physically stabilized fixture');

  function build(start: number) {
    let state = createFusion(start, null, {journey: true, seed});
    const actions: FirstPlanetFixtureAction[] = [];
    let advances = 0;
    let offlineAdvances = 0;

    function act(action: FusionAction) {
      if (actions.length >= maxActions) throw new Error(`Fixture action limit exceeded at ${action.type}`);
      const before = state.game.resources;
      const cargo = action.type === 'claim' ? state.game.pendingReturn?.resources ?? 0 : 0;
      const result = reduceFusion(state, action, state.game.lastAt);
      if (!result.result.ok) throw new Error(`Fixture action rejected ${JSON.stringify(action)} · ${result.result.message ?? ''}`);
      state = result.state;
      actions.push({action, at: state.game.lastAt, balanceBefore: before, balanceAfter: state.game.resources,
        paid: Math.max(0, before - state.game.resources), claimed: cargo});
    }

    function advance(milliseconds: number, offline = false) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new Error('Fixture advance must move time forward');
      advances++;
      if (advances > maxAdvances || state.game.lastAt + milliseconds - start > maxSimulatedMs) throw new Error('Fixture earning loop exceeded its time or step limit');
      const before = state.game.lastAt;
      state = advanceFusion(state, before + milliseconds, offline);
      if (state.game.lastAt <= before) throw new Error('Fixture model clock failed to advance');
      if (offline) offlineAdvances++;
      if (state.game.pendingReturn) act({type: 'claim'});
    }

    function earn(parts: number) {
      while (state.game.resources < parts) advance(earningStepMs, true);
    }

    function buyUpgrade(id: UpgradeId) {
      const expected = state.game.upgrades[id];
      earn(cost(state.game, id));
      act({type: 'upgrade', id, expected});
      if (state.game.upgrades[id] !== expected + 1) throw new Error(`Fixture upgrade did not advance ${id}`);
    }

    // The equipment is earned before it accelerates later model time.
    for (let level = 0; level < MAX_LEVEL; level++) {
      buyUpgrade('recycler');
      buyUpgrade('scanner');
    }
    while (state.game.collection.length < discoveries.length) advance(earningStepMs, true);
    if (!discoveries.every(discovery => state.game.collection.includes(discovery.id))) throw new Error('Fixture failed to discover every first-planet record');
    if (!state.receipt.evidenceIds.includes('field-pipe-scan')) throw new Error('Fixture never crossed the real P03 scan');

    function paper(kind: 'excavate' | 'clean' | 'repair' | 'identify', price = 0) {
      earn(price);
      act({type: 'paper', kind});
      const action = state.receipt.activeAction;
      if (!action || action.kind !== kind) throw new Error(`Fixture paper action failed to start ${kind}`);
      advance(Math.round(action.durationSeconds * 1000) + 1);
      if (state.receipt.activeAction) throw new Error(`Fixture paper action failed to complete ${kind}`);
    }

    if (stage !== 'buried') paper('excavate');
    if (stage === 'clean' || stage === 'stabilized') paper('clean', 40);
    if (stage === 'stabilized') paper('repair', 120);
    for (const [id, prices] of Object.entries(curioPrices)) {
      const kinds = stage === 'stabilized' ? ['clean', 'repair'] as const : stage === 'clean' ? ['clean'] as const : [];
      for (const kind of kinds) {
        earn(prices[kind]);
        act({type: 'curio', id, kind});
        const action = state.curios[id]?.action;
        if (!action || action.kind !== kind) throw new Error(`Fixture curio action failed to start ${id}/${kind}`);
        advance(action.endsAt - state.game.lastAt + 1);
        const expected = kind === 'clean' ? 'clean' : 'stabilized';
        if (state.curios[id].condition !== expected || state.curios[id].action) throw new Error(`Fixture curio action failed to complete ${id}/${kind}`);
      }
    }
    if (stage === 'stabilized') {
      paper('identify');
      if (!state.receipt.verifiedEvidenceIds.includes('field-pipe-scan')) throw new Error('Fixture identification did not verify its real P03 record');
    }

    for (const [id, target] of [['receipt', receiptAbility], ['tape', tapeAbility]] as const) {
      for (let expected = 0; expected < target; expected++) {
        earn(abilityPrices[id][expected]);
        const ability = refinementView(state).abilities[id];
        if (!ability.enabled || ability.level !== expected) throw new Error(`Fixture ability blocked ${id}/${expected} · ${ability.reason ?? ''}`);
        act({type: 'ability', id, expected});
      }
    }
    for (let index = 0; index < 6; index++) {
      const id = `case-${index}`;
      const entry = growthCatalog.find(entry => entry.id === id);
      if (!entry) throw new Error(`Fixture case definition missing ${id}`);
      for (let expected = 0; expected < caseLevel; expected++) {
        earn(entry.costs[expected]);
        act({type: 'growth', id, expected});
        if (growthLevel(state.game, id) !== expected + 1) throw new Error(`Fixture case did not advance ${id}`);
      }
    }

    const actionPaid = actions.reduce((total, action) => total + action.paid, 0);
    const expectedParts = 120 + state.game.station.grossIncome - state.game.station.repairSpent - actionPaid;
    if (state.game.pendingReturn || state.game.resources !== expectedParts) throw new Error(`Fixture ledger does not reconcile ${state.game.resources}/${expectedParts}`);
    if (state.receipt.activeAction || Object.values(state.curios).some(curio => curio.action)) throw new Error('Fixture left an unfinished physical action');
    if (state.game.planets.length !== 1 || state.game.planets[0] !== 'parcel') throw new Error('Fixture exposed an unavailable world');
    const actionsByType: Record<string, number> = {};
    for (const action of actions) actionsByType[action.action.type] = (actionsByType[action.action.type] ?? 0) + 1;
    const audit: FirstPlanetFixtureAudit = {
      source: 'accelerated-model-fixture', label: '加速真实模型夹具 · 发现与支出均由普通行动生成', seed,
      startedAt: start, endedAt: state.game.lastAt, simulatedMs: state.game.lastAt - start,
      advances, offlineAdvances, actionCount: actions.length, actionsByType, actions,
      initialParts: 120, grossEarned: state.game.station.grossIncome, maintenancePaid: state.game.station.repairSpent,
      actionPaid, claimedParts: actions.reduce((total, action) => total + action.claimed, 0), endingParts: state.game.resources,
      collection: [...state.game.collection], receiptEvidence: [...state.receipt.evidenceIds], verifiedEvidence: [...state.receipt.verifiedEvidenceIds],
    };
    return {state, audit};
  }

  const referenceStart = 1800000000000;
  const offset = build(referenceStart).audit.simulatedMs;
  const fixture = build(now - offset);
  if (fixture.state.game.lastAt !== now || fixture.audit.simulatedMs !== offset) throw new Error('Fixture clock alignment was not deterministic');
  return fixture;
}
