import {describe, expect, test} from 'vitest';
import {createFusion, advanceFusion, restoreFusion} from '../src/fusion/domain';
import {aCurioIds, explorationFlowView} from '../src/fusion/exploration-flow';
import {firstPlanetFixture} from '../scripts/firstplanet_fixtures';
import {newGame} from '../src/game/engine';
import {growthCatalog} from '../src/game/growth';

const epoch = 1800000000000;
function at(seconds: number) {
  let state = createFusion(epoch, null, {journey: true, seed: 4501});
  for (let second = 1; second <= seconds; second++) state = advanceFusion(state, epoch + second * 1000);
  return state;
}

describe('A exploration flow uses real facts and retains the existing campaign', () => {
  test('one clear investigation, no fictional clue target or unearned curio', () => {
    const state = at(0), before = JSON.stringify(state), view = explorationFlowView(state);
    expect(view.objective).toBe('调查：旧分拣站为什么夜里会自己开工？');
    expect(view.clues).toEqual([]);expect(view.waitingCurio).toBeUndefined();expect(view.action).toBeNull();
    expect(view.steps.filter(step => step.current).map(step => step.id)).toEqual(['day']);
    expect(JSON.stringify(state)).toBe(before);
  });
  test('a genuinely collected object leads directly to its simple treatment', () => {
    const state = at(12), before = JSON.stringify(state), view = explorationFlowView(state);
    expect(state.game.collection).toContain('receipt');expect(view.waitingCurio).toBe('receipt');
    expect(view.action).toEqual({label: '整理一下', detail: 'receipt', price: 0, enabled: true});
    expect(JSON.stringify(state)).toBe(before);
  });
  test('dusk, actual night incident and morning are projections of one saved clock', () => {
    const dusk = at(230), night = at(283), dawn = at(302);
    expect(explorationFlowView(dusk)).toMatchObject({period: 'dusk', kind: 'dusk'});
    expect(explorationFlowView(night)).toMatchObject({period: 'night', kind: 'night', action: null});
    expect(explorationFlowView(night).eventTitle).not.toMatch(/防御|击杀|入侵|伤害|战斗/);
    const view = explorationFlowView(dawn);
    expect(view.period).toBe('dawn');expect(view.previousNight?.number).toBe(dawn.game.world.lastReport?.number);
    expect(view.previousNight?.visitors).toBe(dawn.game.world.lastReport?.result?.actors.length);
    expect(view.previousNight?.maintenance).toBe(dawn.game.station.lastNight?.spent);
  });
  test('only actual acquired field evidence and stored source facts become clues', () => {
    const state = at(12);
    expect(explorationFlowView(state).clues).toEqual([]);
    const evening = at(302), ids = explorationFlowView(evening).clues.map(clue => clue.id);
    expect(ids.includes('pipe')).toBe(evening.receipt.evidenceIds.includes('field-pipe-scan'));
    expect(ids.includes('warehouse')).toBe(evening.receipt.evidenceIds.includes('field-warehouse-arrival'));
    expect(evening.receipt.evidenceIds).not.toContain('signed-receipt');
  });
  test('offline cargo uses the same gentle stream and does not claim or repair on read', () => {
    const state = advanceFusion(createFusion(epoch), epoch + 3600000, true), before = JSON.stringify(state);
    expect(state.game.pendingReturn).not.toBeNull();
    expect(explorationFlowView(state)).toMatchObject({kind: 'return', action: {command: {type: 'claim'}}});
    explorationFlowView(state);expect(JSON.stringify(state)).toBe(before);
    expect(restoreFusion(JSON.stringify(state), state.game.lastAt).game.pendingReturn).toEqual(state.game.pendingReturn);
  });
  test('27049 legacy balance, paid facilities and completed images are retained without another fee', () => {
    const old = newGame(epoch);old.resources = 27049;old.collection = [...aCurioIds];
    old.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
    const state = createFusion(epoch, JSON.stringify(old)), before = JSON.stringify(state);
    const view = explorationFlowView(state);
    expect(view.foundCurios).toBe(6);expect(view.settledCurios).toBe(6);expect(view.waitingCurio).toBeUndefined();
    expect(view.expectation).not.toMatch(/下一件失物|新星球|第二/);
    expect(state.game.resources).toBe(27049);expect(state.game.growth).toEqual(old.growth);
    expect(JSON.stringify(state)).toBe(before);
  });
  test('an already identified receipt does not hide the real paper-route work', () => {
    const {state}=firstPlanetFixture(epoch,0,'stabilized',{receiptAbility:1,tapeAbility:0});
    const before=JSON.stringify(state), view=explorationFlowView(state);
    expect(state.receipt.verifiedEvidenceIds.length).toBeGreaterThan(0);
    expect(state.progression.sorting.phase).toBe('observed');
    expect(view.action?.command).toMatchObject({type:'sorting',kind:'survey'});
    expect(JSON.stringify(state)).toBe(before);
  });
  test('a new daytime starts a new sequence while previous-night facts stay separately available', () => {
    const state = at(310), view = explorationFlowView(state);
    expect(view.period).toBe('day');expect(view.previousNight).not.toBeNull();
    expect(view.kind).not.toBe('recap');
    expect(view.steps.filter(step => step.reached).map(step => step.id)).toEqual(['day']);
  });
  test('a morning never attaches another night’s maintenance amount', () => {
    const state = at(302);expect(state.game.station.lastNight).not.toBeNull();
    state.game.station.lastNight = {...state.game.station.lastNight!, number: state.game.world.lastReport!.number + 1, spent: 777};
    expect(explorationFlowView(state).previousNight?.maintenance).toBe(0);
  });

});
