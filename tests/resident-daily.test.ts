import {expect, it} from 'vitest';
import {residentDailyPose} from '../src/review/resident-daily';
import {residentMotion} from '../src/render/resident-motion';

const day = (seconds: number) => ({period: 'day' as const, rest: 0, light: 0, seconds});
it('stops the mouse to sniff and eat, with a fixed foot point and actual selected action frames', () => {
  const sniff = residentDailyPose('mouse', day(4));
  const eat = residentDailyPose('mouse', day(6.5));
  expect(sniff.action).toBe('sniffing');
  expect(eat.action).toBe('eating');
  expect(sniff.x).toBe(eat.x);
  expect(sniff.stopped && eat.stopped).toBe(true);
  expect(sniff.dailyFrame).not.toBeNull();
  expect(residentDailyPose('mouse', day(3.1)).dailyFrame).toBe(sniff.dailyFrame);
  expect(residentDailyPose('mouse', day(7.9)).dailyFrame).toBe(eat.dailyFrame);
  expect(residentDailyPose('mouse', day(10)).action).toBe('carrying');
});
it('keeps the shell and feet at the same contact while the crab shakes and peeks', () => {
  const shake = residentDailyPose('hermit', day(5));
  const peek = residentDailyPose('hermit', day(8));
  expect(shake.action).toBe('shaking');
  expect(peek.action).toBe('peeking');
  expect(shake.x).toBe(peek.x);
  expect(shake.y).toBe(peek.y);
  expect(shake.depth).toBe(shake.y);
  expect(residentDailyPose('hermit', day(10)).action).toBe('dragging-paper');
});
it('lands at the original flag pole and preens before resuming actual wing-frame flight', () => {
  expect(residentDailyPose('tagbird', day(2)).action).toBe('flying');
  const preen = residentDailyPose('tagbird', day(7));
  expect(preen).toMatchObject({x: 601, y: 203, action: 'preening', stopped: true});
  expect(residentDailyPose('tagbird', day(12)).action).toBe('flying');
  for (const id of ['mouse', 'hermit', 'tagbird'] as const) {
    const first = residentDailyPose(id, day(0));
    const last = residentDailyPose(id, day(14.999));
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(.01);
  }
});
it('preserves the original dusk, resting and waking motions exactly', () => {
  for (const period of ['dusk', 'night', 'dawn'] as const) {
    const environment = {...day(10), period, rest: period === 'night' ? 1 : .5};
    const expected = residentMotion('mouse', environment);
    const actual = residentDailyPose('mouse', environment);
    expect(actual.x).toBe(expected.x);
    expect(actual.y).toBe(expected.y);
    expect(actual.action).toBe(expected.action);
  }
});
