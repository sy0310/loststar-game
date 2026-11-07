import {describe, expect, test} from 'vitest';
import {PlanetTapGesture, type TapPointer} from '../src/fusion/tap-gesture';

const point = (overrides: Partial<TapPointer> = {}): TapPointer => ({id: 1, primary: true, button: 0, x: 100, y: 100, at: 0, scroll: '0/0', ...overrides});

describe('星球点触完整手势', () => {
  test('有效轻点只接受一次，派生click和重复pointerup无奖励', () => {
    const gesture = new PlanetTapGesture();
    gesture.down(point(), true);
    expect(gesture.up(point({at: 120}))).toBe(true);
    expect(gesture.up(point({at: 121}))).toBe(false);
  });
  test('700毫秒长按与中途移走再返回都被拒绝', () => {
    const gesture = new PlanetTapGesture();
    gesture.down(point(), true);
    expect(gesture.up(point({at: 700}))).toBe(false);
    gesture.down(point({at: 1000}), true);
    gesture.move(point({x: 140, at: 1100}));
    expect(gesture.up(point({at: 1200}))).toBe(false);
  });
  test('第二触点在球外也会取消整次手势，随后正常轻点可恢复', () => {
    const gesture = new PlanetTapGesture();
    gesture.down(point(), true);
    gesture.down(point({id: 2, primary: false, x: 700, at: 10}), false);
    expect(gesture.up(point({id: 2, primary: false, x: 700, at: 120}))).toBe(false);
    expect(gesture.up(point({at: 130}))).toBe(false);
    gesture.down(point({at: 400}), true);
    expect(gesture.up(point({at: 480}))).toBe(true);
  });
  test('滚动变化、滚动事件以及取消后都不会触发点触', () => {
    const gesture = new PlanetTapGesture();
    gesture.down(point(), true);
    expect(gesture.up(point({at: 100, scroll: '30/0'}))).toBe(false);
    gesture.down(point({at: 200}), true);
    gesture.cancel();
    expect(gesture.up(point({at: 250}))).toBe(false);
    gesture.down(point({at: 400}), true);
    gesture.pointerCancel(1);
    expect(gesture.up(point({at: 450}))).toBe(false);
  });
  test('副指针、右键、球外起点、重复down与反向时间被拒绝', () => {
    const gesture = new PlanetTapGesture();
    gesture.down(point({primary: false}), true);
    expect(gesture.up(point({at: 100, primary: false}))).toBe(false);
    gesture.down(point({button: 2, at: 200}), true);
    expect(gesture.up(point({button: 2, at: 300}))).toBe(false);
    gesture.down(point({at: 400}), false);
    expect(gesture.up(point({at: 500}))).toBe(false);
    gesture.down(point({at: 600}), true);
    gesture.down(point({at: 650}), true);
    expect(gesture.up(point({at: 700}))).toBe(false);
    gesture.down(point({at: 800}), true);
    expect(gesture.up(point({at: 750}))).toBe(false);
  });
});
