import {describe, expect, it} from 'vitest';
import {advance, newGame, upgrade} from '../src/game/engine';
import {tapAssist} from '../src/game/assist';
import {robotPose} from '../src/render/motion';
import {fusionCycleFraction, fusionPendingMs, fusionRenderElapsed} from '../src/fusion/render-clock';
import {fusionNightSnapshot} from '../src/fusion/runtime-night';

const epoch = 1800000000000;

describe('fusion between-tick render clock', () => {
  it('projects Lv5 assisted steps along the route at 16ms intervals without touching money or queue', () => {
    let state = newGame(epoch);
    state.upgrades.scanner = 5;
    state = tapAssist(advance(state, epoch + 2000), epoch + 2000);
    const original = structuredClone(state);
    let previous = robotPose(fusionCycleFraction(state, state.lastAt));
    const jumps: number[] = [];
    for (let offset = 16; offset <= 240; offset += 16) {
      const pose = robotPose(fusionCycleFraction(state, state.lastAt + offset));
      jumps.push(Math.hypot(pose.x - previous.x, pose.y - previous.y));
      previous = pose;
    }
    expect(Math.max(...jumps)).toBeLessThan(7);
    const settled = advance(state, state.lastAt + 240);
    expect(fusionCycleFraction(state, state.lastAt + 240)).toBeCloseTo(fusionCycleFraction(settled, settled.lastAt), 6);
    expect(state).toEqual(original);
  });

  it('keeps path position stable through upgrades and a task wrap', () => {
    let state = advance(newGame(epoch), epoch + 11880);
    const before = robotPose(fusionCycleFraction(state, state.lastAt + 64));
    const through = robotPose(fusionCycleFraction(state, state.lastAt + 144));
    expect(Math.hypot(before.x - through.x, before.y - through.y)).toBeLessThan(12);
    state = advance(state, state.lastAt + 64);
    const oldFraction = fusionCycleFraction(state, state.lastAt);
    const next = upgrade(state, 'scanner', 0);
    expect(fusionCycleFraction(next, next.lastAt)).toBeCloseTo(oldFraction, 10);
  });

  it('advances actual night actor interpolation without mutating its financial state', () => {
    const state = advance(newGame(epoch), epoch + 286000);
    const original = structuredClone(state);
    const before = fusionNightSnapshot(state, fusionRenderElapsed(state, state.lastAt));
    const after = fusionNightSnapshot(state, fusionRenderElapsed(state, state.lastAt + 16));
    expect(after.actor.progress).toBeGreaterThanOrEqual(before.actor.progress);
    expect(after.sourceModelMs - before.sourceModelMs).toBe(16);
    expect(after.resources).toBe(state.resources);
    expect(after.integrity).toBe(state.station.integrity);
    expect(state).toEqual(original);
  });

  it('bounds interpolation and waits for the real day/night settlement', () => {
    const day = advance(newGame(epoch), epoch + 239900);
    expect(fusionPendingMs(day, day.lastAt + 1000)).toBeCloseTo(99.999);
    const night = advance(day, epoch + 299900);
    const frame = fusionNightSnapshot(night, fusionRenderElapsed(night, night.lastAt + 1000));
    expect(frame.environment.period).toBe('night');
    expect(frame.sourceModelMs).toBeLessThan(60000);
    expect(fusionPendingMs(newGame(epoch), epoch + 1000)).toBe(250);
    expect(fusionPendingMs(day, NaN)).toBe(0);
    expect(fusionPendingMs(day, day.lastAt - 1)).toBe(0);
  });
});
