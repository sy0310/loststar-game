import {describe, expect, it} from 'vitest';
import {createWorld, worldView} from '../src/game/world';
import {residentEnvironment, residentMotion, residentIds} from '../src/render/resident-motion';

function environmentAt(milliseconds: number) {
  const world = createWorld(0);
  world.elapsedMs = milliseconds;
  world.settledNights = Math.floor(milliseconds / 300000);
  return residentEnvironment(worldView({world}), milliseconds / 1000);
}

describe('persistent resident daily routine', () => {
  it('gives each existing resident a distinct day and night action', () => {
    const day = residentIds.map(id => residentMotion(id, environmentAt(100000)));
    const night = residentIds.map(id => residentMotion(id, environmentAt(260000)));
    expect(day.map(pose => pose.action)).toEqual(['foraging', 'carrying', 'flying']);
    expect(night.map(pose => pose.action)).toEqual(['sleeping', 'sheltering', 'roosting']);
    expect(day.every(pose => !pose.nightArt)).toBe(true);
    expect(night.every(pose => pose.nightArt)).toBe(true);
  });

  it('moves home through dusk and wakes through the existing eight-second dawn', () => {
    expect(environmentAt(228000).rest).toBe(0);
    expect(environmentAt(234000).rest).toBeCloseTo(.5);
    expect(environmentAt(240000).rest).toBe(1);
    expect(environmentAt(300000).rest).toBe(1);
    expect(environmentAt(304000).rest).toBeCloseTo(.5);
    expect(environmentAt(308000).rest).toBe(0);
    for (const id of residentIds) {
      expect(residentMotion(id, environmentAt(234000)).action).toBe('returning');
      expect(residentMotion(id, environmentAt(304000)).action).toBe('waking');
    }
  });

  it('keeps feet continuous across phase boundaries and resting bodies at their homes', () => {
    for (const boundary of [228000, 240000, 300000, 308000]) {
      for (const id of residentIds) {
        const before = residentMotion(id, environmentAt(boundary - 1));
        const after = residentMotion(id, environmentAt(boundary + 1));
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(.1);
      }
    }
    for (const id of residentIds) {
      const first = residentMotion(id, environmentAt(250000));
      const later = residentMotion(id, environmentAt(275000));
      expect(Math.hypot(later.x - first.x, later.y - first.y)).toBeLessThan(1);
      expect(first.y).toBeGreaterThan(190);
    }
  });

  it('uses the same pose after navigation or offline catch-up and cycles true resting frames', () => {
    for (const id of residentIds) {
      const environment = environmentAt(260000);
      expect(residentMotion(id, environment)).toEqual(residentMotion(id, {...environment}));
      const frames = new Set(Array.from({length: 16}, (_, index) =>
        residentMotion(id, environmentAt(260000 + index * 250)).frame));
      expect(frames).toEqual(new Set([0, 1]));
    }
  });
});
