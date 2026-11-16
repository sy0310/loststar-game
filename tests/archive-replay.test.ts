import {describe, expect, test} from 'vitest';
import {advance, newGame} from '../src/game/engine';
import {archiveReplaySeed} from '../src/fusion/archive-replay';

describe('归档夜班使用实际历史配置回放', () => {
  test.each([
    {slots: ['beacon', 'gate'], levels: [0, 0]},
    {slots: ['gate', 'beacon'], levels: [1, 3]},
    {slots: ['beacon', null], levels: [2, 0]},
    {slots: [null, null], levels: [0, 0]},
  ] as const)('重现配置$slots，保留原账本与居民', ({slots, levels}) => {
    const initial = newGame(0);
    initial.world.slots = [...slots];
    initial.growth = {'guard-0': levels[0], 'guard-1': levels[1]};
    initial.station.autoRepair = false;
    initial.station.integrity = 85;
    initial.resources = 27049;
    const history = advance(initial, 300000);
    // Purchased upgrades after that night cannot alter its recorded replay.
    history.growth = {'guard-0': 3, 'guard-1': 3};
    const original = structuredClone(history);
    const start = 10000000;
    const replay = archiveReplaySeed(history, start);
    const complete = advance(replay, start + 60000);
    expect(complete.world.lastReport!.result!.actors).toEqual(history.world.lastReport!.result!.actors);
    expect(complete.world.lastReport!.result!.intercepted).toBe(history.world.lastReport!.result!.intercepted);
    expect(complete.world.lastReport!.result!.arrived).toBe(history.world.lastReport!.result!.arrived);
    expect(complete.station.lastNight!.damage).toBe(history.station.lastNight!.damage);
    expect(replay.collection).toEqual(history.collection);
    expect(history).toEqual(original);
  });

  test('记录缺失或夜班编号不一致时拒绝生成回放', () => {
    expect(() => archiveReplaySeed(newGame(0), 1000)).toThrow('记录尚未齐备');
    const history = advance(newGame(0), 300000);
    history.station.lastNight!.number++;
    expect(() => archiveReplaySeed(history, 1000000)).toThrow('记录尚未齐备');
  });
});
