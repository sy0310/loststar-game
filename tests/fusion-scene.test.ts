import {describe, expect, it} from 'vitest';
import {advance, newGame} from '../src/game/engine';
import {fusionNightPlan, fusionNightSnapshot} from '../src/fusion/runtime-night';
import {anomalyPoint} from '../src/fusion/anomalies';
import {nightAt} from '../src/prototype/night-model';

const epoch = 1800000000000;

describe('fusion scene projects actual world facts', () => {
  it('uses the real money, night configuration, world and repair receipts', () => {
    let state = newGame(epoch);
    state.resources = 27049;
    state.growth = {'guard-0': 1, 'guard-1': 2};
    state = advance(state, epoch + 285000);
    const original = structuredClone(state);
    const snapshot = fusionNightSnapshot(state);
    expect(snapshot.state).toBe(state);
    expect(snapshot.resources).toBe(state.resources);
    expect(snapshot.configuration).toEqual({slots: ['beacon', 'gate'], strengths: [1, 2]});
    expect(snapshot.sourceModelMs).toBe(45000);
    expect(snapshot.integrity).toBe(state.station.integrity);
    expect(state).toEqual(original);
  });

  it('projects the same night point on later cycles, without clamping world to one night', () => {
    const first = fusionNightSnapshot(advance(newGame(epoch), epoch + 287000));
    const later = fusionNightSnapshot(advance(newGame(epoch), epoch + 887000));
    expect(first.actor.progress).toBe(later.actor.progress);
    expect(first.sourceModelMs).toBe(later.sourceModelMs);
    expect(later.state.world.elapsedMs).toBe(887000);
    expect(later.observations[0].actionId).toContain('night-3');
    expect(later.observations[0].observedAtSeconds).toBe(first.observations[0].observedAtSeconds + 600);
  });

  it('only emits source observations after the actual verification threshold', () => {
    const seed = newGame(epoch);
    const plan = fusionNightPlan({slots: ['beacon', 'gate'], strengths: [0, 0]});
    const marker = plan.frames.find(frame => frame.actors.some(actor => actor.id === 2 && actor.verification * 10500 >= 3000))!.atMs;
    const before = fusionNightSnapshot(advance(seed, epoch + 240000 + marker - 100));
    const after = fusionNightSnapshot(advance(seed, epoch + 240000 + marker));
    expect(before.observations).toEqual([]);
    expect(after.observations[0]).toMatchObject({evidenceId: 'field-pipe-scan', source: 'parcel/returns-plain/pipe-marker-p03', metadata: {artifactCode: 'RET-031', boxCode: 'P03'}});
    expect(after.observations[0].observedAtSeconds).toBe((epoch + 240000 + marker) / 1000);
  });

  it('uses the completed night config during dawn and actual welding age', () => {
    const state = advance(newGame(epoch), epoch + 301000);
    state.world.slots = [null, null];
    state.world.strengths = [3, 3];
    const view = fusionNightSnapshot(state);
    expect(view.environment.period).toBe('dawn');
    expect(view.configuration).toEqual(state.world.lastReport!.result!.configuration);
    expect(view.repair.active).toBe(true);
    expect(view.repair.spent).toBe(state.station.lastRepair!.cost);
    expect(view.repair.progress).toBeCloseTo(1 / 3);
    expect(view.repair.displayIntegrity).toBeGreaterThanOrEqual(view.repair.from);
    expect(view.repair.displayIntegrity).toBeLessThanOrEqual(view.repair.to);
  });

  it('shows the actual disabled gate and live outcome of that configuration', () => {
    const state = newGame(epoch);
    state.world.slots = [null, null];
    const view = fusionNightSnapshot(advance(state, epoch + 295000));
    expect(view.facilities.gate.enabled).toBe(false);
    expect(view.facilities.beacon.enabled).toBe(false);
    expect(view.actor.outcome).toBe('arrived');
    expect(view.resources).toBe(view.state.resources);
  });

  it('gives the new creatures distinct ground contact and flight movement', () => {
    const frame = nightAt({slots: ['beacon', 'gate'], strengths: [0, 0]}, 10).actors[0];
    const box = anomalyPoint(frame, 10);
    const moth = anomalyPoint({...frame, id: 1}, 10);
    expect(box.groundY - box.y).toBeLessThanOrEqual(9);
    expect(moth.groundY - moth.y).toBeGreaterThan(30);
    expect(moth.x).not.toBe(box.x);
  });
});
