import {expect, it} from 'vitest';
import {FrameCadence} from '../src/render/frame-cadence';
import {baseRobotPose} from '../src/render/base-motion';

it('30Hz绘制累计显示时间，在60Hz屏上保留小数余量', () => {
  const clock = new FrameCadence();
  const paints: number[] = [];
  for (let frame = 0; frame <= 600; frame++) if (clock.draw(frame * 1000 / 60, 1000 / 30)) paints.push(frame * 1000 / 60);
  expect(paints).toHaveLength(301);
  for (let index = 1; index < paints.length; index++) expect(paints[index] - paints[index - 1]).toBeCloseTo(1000 / 30, 6);
});

it('后台恢复与时间重置各只画当前帧，不补画过期帧', () => {
  const clock = new FrameCadence();
  expect(clock.draw(0)).toBe(true);
  expect(clock.draw(4)).toBe(false);
  clock.reset();
  expect(clock.draw(60000)).toBe(true);
  expect(clock.draw(60004)).toBe(false);
  expect(clock.draw(1)).toBe(true);
});

it('机器人抓取前到达实物，提放停稳，手与机械臂保持连续', () => {
  const before = baseRobotPose(6.2);
  expect(before.lift).toBe(0);
  const at = baseRobotPose(7.2);
  expect(at.lift).toBe(1);
  for (const boundary of [4, 5.5, 6.2, 7.2, 8.2, 9.2, 10, 14]) {
    const a = baseRobotPose(boundary - .001);
    const b = baseRobotPose(boundary + .001);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(1);
    expect(Math.hypot(b.hand.x - a.hand.x, b.hand.y - a.hand.y)).toBeLessThan(1);
    if (a.lift > 0 || b.lift > 0) expect(Math.hypot(b.item.x - a.item.x, b.item.y - a.item.y)).toBeLessThan(1);
  }
});
