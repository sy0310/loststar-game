import {describe, expect, test} from 'vitest';
import {advance, claimReturn, newGame, restore, tuning, upgrade} from '../src/game/engine';
import {startPlan} from '../src/game/station';
import {
  assistRules, assistStatus, availableAssistWork, cleanAssist, consumeAssistWork,
  createAssist, tapAssist,
} from '../src/game/assist';

function tappedBurst() {
  let state = newGame(0);
  for (let index = 0; index < 5; index++) state = tapAssist(state, index * 300, index);
  return state;
}

describe('tap assistance', () => {
  test('a tap queues work and never awards a resource or discovery immediately', () => {
    const start = newGame(0);
    const state = tapAssist(start, 0, 0);
    expect(state.assist?.pendingWorkMs).toBe(600);
    expect(state.resources).toBe(start.resources);
    expect(state.collection).toEqual([]);
    expect(state.world.elapsedMs).toBe(0);
    expect(state.cycleMs).toBe(0);
    expect(start.assist).toBeUndefined();
  });

  test('input cooldown, action sequence and rolling window reject duplicate or excess input', () => {
    const first = tapAssist(newGame(0), 0, 0);
    expect(tapAssist(first, 0, 0).assist?.actionSeq).toBe(1);
    expect(tapAssist(first, 200, 1).assist?.actionSeq).toBe(1);
    expect(tapAssist(first, 300, 0).assist?.actionSeq).toBe(1);
    const burst = tappedBurst();
    expect(burst.assist?.actionSeq).toBe(5);
    const rejected = tapAssist(burst, 1500, 5);
    expect(rejected.assist?.enqueuedWorkMs).toBe(3000);
    expect(assistStatus(rejected).reason).toBe('limited');
    expect(tapAssist(rejected, 11999, 5).assist?.actionSeq).toBe(5);
    const admitted = tapAssist(rejected, 12000, 5);
    expect(admitted.assist?.actionSeq).toBe(6);
    expect(admitted.assist?.acceptedAt).toEqual([300, 600, 900, 1200, 12000]);
  });

  test('a five-tap burst completes actual first exploration sooner with the same payout path', () => {
    const state = advance(tappedBurst(), 9000);
    const automatic = advance(newGame(0), 9000);
    expect(state.cycles).toBe(1);
    expect(state.resources).toBe(128);
    expect(state.station.grossIncome).toBe(8);
    expect(state.station.autoBudgetTenths).toBe(24);
    expect(state.collection).toEqual(['receipt']);
    expect(automatic.cycles).toBe(0);
    expect(state.radarMs).toBe(automatic.radarMs);
    expect(state.world.elapsedMs).toBe(automatic.world.elapsedMs);
    expect(state.assist?.appliedWorkMs).toBeCloseTo(3000, 6);
    expect(state.assist?.pendingWorkMs).toBe(0);
  });

  test('the first 200ms ramp integrates continuously and does not depend on settlement tick size', () => {
    const assist = createAssist();
    assist.pendingWorkMs = 600;
    expect(availableAssistWork(assist, 100)).toBeCloseTo(15);
    expect(availableAssistWork(assist, 200)).toBeCloseTo(60);
    expect(availableAssistWork(assist, 1000)).toBeCloseTo(540);
    const chunked = structuredClone(assist);
    let applied = 0;
    for (let index = 0; index < 20; index++) applied += consumeAssistWork(chunked, 50);
    expect(applied).toBeCloseTo(availableAssistWork(assist, 1000), 8);
    let state = tapAssist(newGame(0), 0, 0);
    for (let time = 50; time <= 20000; time += 50) state = advance(state, time);
    const single = advance(tapAssist(newGame(0), 0, 0), 20000);
    expect(state.cycles).toBe(single.cycles);
    expect(state.cycleMs).toBeCloseTo(single.cycleMs, 6);
    expect(state.resources).toBe(single.resources);
    expect(state.assist?.appliedWorkMs).toBeCloseTo(single.assist!.appliedWorkMs, 6);
  });

  test('night pauses pending work and rejects new taps while the world continues', () => {
    const state = tapAssist(advance(newGame(0), 239900), 239900, 0);
    const night = advance(state, 240000);
    expect(night.assist?.appliedWorkMs).toBeCloseTo(15);
    const paused = tapAssist(night, 270000, 1);
    expect(paused.assist?.actionSeq).toBe(1);
    expect(paused.assist?.pendingWorkMs).toBeCloseTo(585);
    expect(assistStatus(paused).reason).toBe('night');
    const morning = advance(paused, 300100);
    expect(morning.assist?.appliedWorkMs).toBeCloseTo(60);
    expect(morning.world.elapsedMs).toBe(300100);
  });

  test('offline settlement consumes only the finite queue and repeated restore or claim does not duplicate it', () => {
    const pending = tappedBurst();
    const returned = restore(JSON.stringify(pending), 24 * 3600000);
    expect(returned.assist?.appliedWorkMs).toBeCloseTo(3000);
    expect(returned.assist?.pendingWorkMs).toBe(0);
    expect(returned.pendingReturn?.seconds).toBe(tuning(pending).cargo);
    const replay = restore(JSON.stringify(returned), returned.lastAt);
    expect(replay.pendingReturn).toEqual(returned.pendingReturn);
    expect(replay.assist).toEqual(returned.assist);
    const claimed = claimReturn(returned);
    expect(claimReturn(claimed)).toBe(claimed);
    expect(claimed.collection.filter(id => id === 'receipt')).toHaveLength(1);
    expect(claimed.station.repairSpent).toBe(returned.station.repairSpent);
  });

  test('legacy 27049 funds and purchased equipment survive optional-field migration and invalid assistance', () => {
    const legacy = newGame(1000);
    legacy.resources = 27049;
    legacy.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
    legacy.growth = {'case-0': 3, 'guard-0': 3, 'guard-1': 3};
    const restored = restore(JSON.stringify(legacy), 1000);
    expect(restored.resources).toBe(27049);
    expect(restored.upgrades).toEqual(legacy.upgrades);
    expect(restored.growth).toEqual(legacy.growth);
    expect(restored.assist).toBeUndefined();
    const malformed = {...legacy, assist: {...createAssist(), pendingWorkMs: 1e9}};
    const recovered = restore(JSON.stringify(malformed), 1000);
    expect(recovered.resources).toBe(27049);
    expect(recovered.assist).toBeUndefined();
  });

  test('valid queued work survives a save round trip and equipment upgrade keeps progress fraction', () => {
    const state = tapAssist(newGame(0), 0, 0);
    const partial = advance(state, 300);
    const copied = restore(JSON.stringify(partial), 300);
    expect(copied.assist).toEqual(partial.assist);
    const improved = upgrade(copied, 'scanner');
    expect(improved.cycleMs / tuning(improved).scanner).toBeCloseTo(copied.cycleMs / tuning(copied).scanner);
    expect(improved.assist).toEqual(copied.assist);
    expect(improved.resources).toBe(copied.resources - 45);
  });

  test('damage and active research modify assisted work through the common exploration factor', () => {
    const state = startPlan(newGame(0), 'field', 'artifact', null);
    state.station.integrity = 0;
    state.station.autoRepair = false;
    const automatic = advance(state, 1000);
    const assisted = advance(tapAssist(state, 0, 0), 1000);
    expect(automatic.cycleMs).toBeCloseTo(880);
    expect(assisted.cycleMs - automatic.cycleMs).toBeCloseTo(540 * .8 * 1.1);
    expect(assisted.assist?.appliedWorkMs).toBeCloseTo(540);
    expect(assisted.world.elapsedMs).toBe(automatic.world.elapsedMs);
    expect(assisted.radarMs).toBe(automatic.radarMs);
    expect(assisted.resources).toBe(automatic.resources);
  });

  test('corrupt, future and backwards input cannot create work', () => {
    const state = tapAssist(newGame(1000), 1000, 0);
    expect(tapAssist(state, 999)).toBe(state);
    expect(tapAssist(state, NaN)).toBe(state);
    expect(tapAssist(state, Infinity)).toBe(state);
    expect(cleanAssist({...state.assist, acceptedAt: [2000]}, 1000)).toBeUndefined();
    expect(cleanAssist({...state.assist, enqueuedWorkMs: 1200}, 1000)).toBeUndefined();
    expect(cleanAssist({...state.assist, pendingWorkMs: -1}, 1000)).toBeUndefined();
  });

  test('sustained rapid input obeys the same five-per-window accounting as sparse accepted taps', () => {
    let state = newGame(0);
    const accepted: number[] = [];
    for (let time = 0; time < 120000; time += 125) {
      const previous = state.assist?.actionSeq ?? 0;
      state = tapAssist(state, time, previous);
      if ((state.assist?.actionSeq ?? 0) > previous) accepted.push(time);
    }
    state = advance(state, 125000);
    for (const time of accepted) {
      expect(accepted.filter(at => at > time - assistRules.windowMs && at <= time).length).toBeLessThanOrEqual(5);
    }
    expect(state.assist?.enqueuedWorkMs).toBe(accepted.length * 600);
    expect(state.assist?.appliedWorkMs).toBeCloseTo(state.assist!.enqueuedWorkMs, 6);
    expect(state.assist?.pendingWorkMs).toBe(0);
    expect(state.assist!.enqueuedWorkMs / 120000).toBeLessThanOrEqual(.25);
    const automatic = advance(newGame(0), 125000);
    expect(state.world.elapsedMs).toBe(automatic.world.elapsedMs);
    expect(state.surveyCount).toBe(automatic.surveyCount);
    expect(state.station.grossIncome).toBeGreaterThan(automatic.station.grossIncome);
  });
});
