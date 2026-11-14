import {describe, expect, test} from 'vitest';
import {newGame} from '../src/game/engine';
import {advanceFusion, createFusion, reduceFusion, restoreFusion} from '../src/fusion/domain';
import {createJourney, surfaceView} from '../src/fusion/surface';

const epoch = 1800000000000;
const fresh = () => createFusion(epoch, null, {journey: true, seed: 317});

describe('first planet campaign', () => {
  test('authorized fresh campaign starts with initial rights and leaves the old input intact', () => {
    const old = newGame(epoch - 86400000);
    old.resources = 27049;
    old.collection = ['receipt', 'mouse', 'tape'];
    old.upgrades.scanner = 5;
    const raw = JSON.stringify(old);
    const state = createFusion(epoch, raw, {journey: true, seed: 317});
    expect(JSON.stringify(old)).toBe(raw);
    expect(state.game.resources).toBe(120);
    expect(state.game.collection).toEqual([]);
    expect(state.game.upgrades).toEqual({radar: 0, scanner: 0, recycler: 0, cargo: 0});
    expect(state.game.world.elapsedMs).toBe(0);
    expect(state.receipt.stage).toBe('buried');
    expect(state.receipt.evidenceIds).toEqual([]);
    expect(state.importedLegacy).toBe(false);
    expect(state.journey).toEqual(createJourney(317));
  });

  test('three clouds are registered to real local content and hide names until real reveals', () => {
    let state = fresh();
    const initial = surfaceView(state);
    expect(initial.map(site => site.id)).toEqual(['receipt', 'residents', 'sorting']);
    expect(initial.map(site => site.anchor)).toEqual([{x: 465, y: 357}, {x: 565, y: 447}, {x: 410, y: 315}]);
    expect(initial.every(site => site.phase === 'unknown' && !Object.hasOwn(site, 'name'))).toBe(true);
    state = advanceFusion(state, epoch + 6000);
    expect(surfaceView(state)[0]).toMatchObject({phase: 'scanning', progress: .5, revealed: false});
    state = advanceFusion(state, epoch + 12000);
    expect(state.game.collection).toContain('receipt');
    expect(surfaceView(state)[0]).toMatchObject({phase: 'revealed', progress: 1, name: '退件土样'});
    expect(surfaceView(state)[2].revealed).toBe(false);
    state = advanceFusion(state, epoch + 36000);
    expect(state.game.collection).toContain('mouse');
    expect(state.receipt.evidenceIds).toContain('field-pipe-scan');
    expect(state.progression.sorting.phase).toBe('observed');
    expect(surfaceView(state).every(site => site.revealed)).toBe(true);
  });

  test('offscreen and offline crossed scans preserve actual provenance without a signature', () => {
    const stepped = advanceFusion(advanceFusion(fresh(), epoch + 12000), epoch + 30000);
    const offline = advanceFusion(fresh(), epoch + 30000, true);
    for (const state of [stepped, offline]) {
      expect(state.receipt.evidenceIds).toEqual(['field-pipe-scan']);
      expect(state.receipt.verifiedEvidenceIds).toEqual([]);
      expect(state.receipt.observations[0].metadata?.actualSource).toBe('parcel/returns-plain/pipe-marker-p03');
      expect(state.records[0].at).toBe(epoch + 17040);
      expect(state.records[0].at).toBeLessThan(state.game.lastAt);
    }
    const again = advanceFusion(offline, epoch + 40000);
    expect(again.records.filter(record => record.target === 'marker')).toHaveLength(1);
  });

  test('tap acceptance adds bounded work without directly revealing terrain or awarding sources', () => {
    const initial = fresh();
    const tapped = reduceFusion(initial, {type: 'tap'}, epoch).state;
    expect(tapped.game.assist?.enqueuedWorkMs).toBe(600);
    expect(tapped.journey).toEqual(initial.journey);
    expect(tapped.receipt.evidenceIds).toEqual([]);
  });

  test('seeded sites and completed reveals persist through refresh, night and long capped offline time', () => {
    const revealed = advanceFusion(fresh(), epoch + 36000);
    const expected = structuredClone(revealed.journey);
    const restored = restoreFusion(JSON.stringify(revealed), epoch + 240000);
    expect(restored.journey).toEqual(expected);
    const offline = restoreFusion(JSON.stringify(restored), epoch + 72 * 3600000);
    expect(offline.journey).toEqual(expected);
    const duplicate = advanceFusion(offline, offline.game.lastAt, true);
    expect(duplicate.journey).toEqual(expected);
    expect(duplicate.game.pendingReturn).toEqual(offline.game.pendingReturn);
  });

  test('damaged active journey is rejected while legacy campaigns retain clear terrain', () => {
    const old = createFusion(epoch);
    expect(restoreFusion(JSON.stringify(old), epoch).journey).toBeUndefined();
    expect(surfaceView(old)).toEqual([]);
    const damaged = fresh();
    damaged.journey!.sites[0].anchor.x = 10;
    expect(() => restoreFusion(JSON.stringify(damaged), epoch)).toThrow('首星地表记录校验失败');
  });
});
