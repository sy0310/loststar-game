import {describe, expect, it} from 'vitest';
import {createV036FogState, advanceV036Fog, tapV036Fog, v036FogFrame, v036FogRobot} from '../src/review/v036-fog';

describe('isolated v036 local fog review', () => {
  it('automatically reaches a real revealed site after eighteen seconds without clicks or rewards', () => {
    const initial = createV036FogState();
    expect(v036FogFrame(initial.workMs).phase).toBe('undetected');
    const done = advanceV036Fog(initial, 18000);
    expect(done.workMs).toBe(18000);
    expect(v036FogFrame(done.workMs).phase).toBe('revealed');
    expect(done.assist.actionSeq).toBe(0);
    expect(initial.workMs).toBe(0);
    expect('resources' in done).toBe(false);
    expect('collection' in done).toBe(false);
  });

  it('keeps the world clock and resident loops moving after the reveal while freezing completed work', () => {
    const done = advanceV036Fog(createV036FogState(), 18000);
    const later = advanceV036Fog(done, 5000);
    expect(later.elapsedMs).toBe(23000);
    expect(later.workMs).toBe(18000);
    const tap = tapV036Fog(later);
    expect(tap.accepted).toBe(false);
    expect(tap.state.assist.enqueuedWorkMs).toBe(0);
  });

  it('reveals the place name only after the cloudy scan and outward reveal have actually completed', () => {
    for (const workMs of [0, 6500, 10000, 14499]) {
      expect(v036FogFrame(workMs).status).not.toContain('旧分拣区');
    }
    expect(v036FogFrame(14500).status).toContain('旧分拣区');
    expect(v036FogFrame(6500).scan).toBe(0);
    expect(v036FogFrame(10500).scan).toBe(1);
    expect(v036FogFrame(10500).reveal).toBe(0);
    expect(v036FogFrame(14500).reveal).toBe(1);
  });

  it('queues bounded existing assist work and consumes it smoothly rather than jumping the robot', () => {
    let state = createV036FogState();
    const startPose = v036FogRobot(state.workMs);
    state = tapV036Fog(state).state;
    expect(state.workMs).toBe(0);
    expect(v036FogRobot(state.workMs)).toEqual(startPose);
    expect(tapV036Fog(state).accepted).toBe(false);
    state = advanceV036Fog(state, 100);
    expect(state.workMs).toBeCloseTo(115);
    expect(state.assist.appliedWorkMs).toBeCloseTo(15);
    expect(state.assist.enqueuedWorkMs).toBe(600);
    expect(state.assist.appliedWorkMs + state.assist.pendingWorkMs).toBeCloseTo(600);
    expect(v036FogRobot(state.workMs).parcel.visible).toBe(false);
  });

  it('uses the five-per-twelve-second budget for touch and never queues work while the site is revealed', () => {
    let state = createV036FogState();
    for (let index = 0; index < 5; index++) {
      if (index) state = advanceV036Fog(state, 300);
      const tap = tapV036Fog(state);
      expect(tap.accepted).toBe(true);
      state = tap.state;
    }
    state = advanceV036Fog(state, 300);
    expect(tapV036Fog(state).accepted).toBe(false);
    expect(state.assist.actionSeq).toBe(5);
    expect(state.assist.pendingWorkMs).toBeLessThanOrEqual(3000);
    expect(tapV036Fog(advanceV036Fog(state, 18000)).accepted).toBe(false);
  });

  it('integrates the same assist work in one block and many drawing ticks', () => {
    const seeded = tapV036Fog(createV036FogState()).state;
    const block = advanceV036Fog(seeded, 1000);
    let ticks = seeded;
    for (let index = 0; index < 100; index++) ticks = advanceV036Fog(ticks, 10);
    expect(ticks.workMs).toBeCloseTo(block.workMs, 6);
    expect(ticks.assist.appliedWorkMs).toBeCloseTo(block.assist.appliedWorkMs, 6);
    expect(ticks.assist.pendingWorkMs).toBeCloseTo(block.assist.pendingWorkMs, 6);
  });

  it('follows a continuous surface route with no parcel spawning at phase boundaries', () => {
    for (const edge of [2000, 4000, 6500, 14500, 18000]) {
      const before = v036FogRobot(edge - 1), after = v036FogRobot(edge + 1);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(.01);
      expect(before.parcel.visible).toBe(false);
      expect(after.parcel.visible).toBe(false);
    }
    expect(v036FogRobot(0)).toMatchObject({x: 327, y: 454});
    expect(v036FogRobot(18000)).toMatchObject({x: 457, y: 333, action: 'scan'});
  });

  it('ignores invalid or negative deltas without modifying the visual state', () => {
    const state = createV036FogState();
    for (const delta of [-10, 0, NaN, Infinity]) expect(advanceV036Fog(state, delta)).toBe(state);
  });
});
