import {expect, it} from 'vitest';
import {
  createV034NightModel,
  v034EventModelMs,
  v034EventSeconds,
} from '../src/review/v034-night-model';
import {nightAt} from '../src/prototype/night-model';

it('uses real third-actor outcomes, damage and morning cash flow for both presets', () => {
  const basic = createV034NightModel('basic');
  const complete = createV034NightModel('complete');
  expect(basic.snapshot(22.9).integrity).toBe(100);
  expect(basic.snapshot(23).integrity).toBe(94);
  expect(basic.snapshot(29).repairSpent).toBe(0);
  expect(basic.snapshot(35.5)).toMatchObject({integrity: 100, damage: 6, repairSpent: 18});
  expect(complete.snapshot(35)).toMatchObject({integrity: 100, damage: 0, repairSpent: 0});
  expect(basic.snapshot(35).morning).toMatchObject({intercepted: 2, arrived: 1, damage: 6, spent: 18});
  expect(complete.snapshot(35).morning).toMatchObject({intercepted: 3, arrived: 0, damage: 0, spent: 0});
});

it('matches facility pauses and verification to the existing night calculation', () => {
  for (const preset of ['basic', 'complete'] as const) {
    const review = createV034NightModel(preset);
    const view = review.snapshot(16);
    const actor = nightAt(view.configuration, view.sourceModelMs / 1000)
      .actors.find(actor => actor.id === 2)!;
    expect(view.actor.verification).toBe(actor.verification);
    expect(view.facilities.gate.holding).toBe(actor.stunned);
    expect(view.facilities.beacon.guiding).toBe(actor.slowed);
    expect(view.facilities.gate.remainingMs).toBeGreaterThan(0);
  }
});

it('settles identical source states from an event excerpt and a full real-time cycle', () => {
  for (const preset of ['basic', 'complete'] as const) {
    const event = createV034NightModel(preset);
    const cycle = createV034NightModel(preset, {mode: 'cycle'});
    expect(cycle.snapshot(239).environment.period).toBe('dusk');
    expect(cycle.snapshot(250).eventSeconds).toBeNull();
    expect(cycle.snapshot(250).phase).toBe('patrol');
    expect(cycle.snapshot(250).environment.period).toBe('night');
    expect(cycle.snapshot(250).actor.verification).toBe(0);
    expect(event.snapshot(30).state).toEqual(cycle.snapshot(300).state);
    expect(event.snapshot(36).state).toEqual(cycle.snapshot(306).state);
  }
  for (const seconds of [0, 5, 10, 16, 23, 24, 27, 30, 36]) {
    expect(v034EventSeconds(v034EventModelMs(seconds))).toBeCloseTo(seconds, 8);
  }
});

it('applies manual and automatic repairs only once in isolated memory', () => {
  const review = createV034NightModel('basic');
  review.setAutoRepair(false, 3);
  expect(review.snapshot(35.5)).toMatchObject({integrity: 94, repairSpent: 0});
  expect(review.repair(35.5, 94)).toMatchObject({integrity: 100, repairSpent: 18});
  expect(review.repair(35.5, 94)).toMatchObject({integrity: 100, repairSpent: 18});
  expect(review.snapshot(29).integrity).toBe(94);
  expect(review.snapshot(35.5).repairSpent).toBe(18);
  review.replay('basic');
  expect(review.snapshot(35.5).repairSpent).toBe(18);
});

it('finishes late repair animations while keeping the completed event or cycle ledger capped', () => {
  for (const mode of ['event', 'cycle'] as const) {
    for (const action of ['manual', 'auto'] as const) {
      const review = createV034NightModel('basic', {mode, autoRepair: false});
      const end = review.snapshot(review.duration);
      const afterEnd = review.duration + 4;
      const repaired = action === 'manual'
        ? review.repair(afterEnd, 94)
        : review.setAutoRepair(true, afterEnd);
      expect(repaired).toMatchObject({integrity: 100, repairSpent: 18});
      expect(repaired.repair).toMatchObject({active: true, progress: 0, startedAt: afterEnd});
      expect(review.snapshot(afterEnd + 1.5).repair.progress).toBeCloseTo(.5, 5);
      const finished = review.snapshot(afterEnd + 3.1);
      expect(finished.repair.active).toBe(false);
      expect(finished.resources).toBe(end.resources - 18);
      expect(finished.state.world.elapsedMs).toBe(end.state.world.elapsedMs);
      expect(finished.state.station.grossIncome).toBe(end.state.station.grossIncome);
      expect(review.repair(afterEnd + 5, 94).repairSpent).toBe(18);
      const enabled = review.setAutoRepair(true, afterEnd + 6);
      expect(enabled.repairSpent).toBe(18);
      expect(enabled.repair.active).toBe(false);
      expect(review.snapshot(review.duration).repairSpent).toBe(0);
      expect(review.snapshot(afterEnd + 7).repairSpent).toBe(18);
    }
  }
});

it('makes observations available at the real scan or transport time with stable IDs', () => {
  const review = createV034NightModel('basic');
  expect(review.snapshot(5).observations).toEqual([]);
  const observations = review.snapshot(29).observations;
  expect(observations.find(item => item.evidenceId === 'field-pipe-scan')).toMatchObject({
    source: 'parcel/returns-plain/night-review',
    metadata: {
      artifactCode: 'RET-031',
      boxCode: 'P03',
      nodeId: 'pipe-marker-p03',
      eventKind: 'marker-scan',
    },
  });
  expect(observations.some(item => /sign|签收/.test(item.evidenceId))).toBe(false);
  review.replay('complete');
  expect(review.snapshot(35).observations.map(item => item.actionId))
    .toEqual(observations.map(item => item.actionId));
});
