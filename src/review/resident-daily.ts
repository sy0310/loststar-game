import {residentMotion, type ResidentEnvironment, type ResidentId} from '../render/resident-motion';

const smooth = (value: number) => {
  const amount = Math.max(0, Math.min(1, value));
  return amount * amount * (3 - 2 * amount);
};
const interpolate = (from: number, to: number, amount: number) => from + (to - from) * smooth(amount);

/** Short review routines use the same scene clock and leave the formal resident model intact. */
export function residentDailyPose(id: ResidentId, environment: ResidentEnvironment) {
  const original = residentMotion(id, environment);
  if (environment.period !== 'day') return {...original, dailyFrame: null, stopped: environment.rest > .9};
  const second = Math.max(0, environment.seconds) % 15;
  let x = original.x;
  let y = original.y;
  let action = original.action;
  let dailyFrame: number | null = null;
  let stopped = false;
  let flip = false;
  if (id === 'mouse') {
    y = 447;
    if (second < 3) {x = interpolate(553, 569, second / 3); action = 'walking';}
    else if (second < 8) {
      x = 569; action = second < 5 ? 'sniffing' : 'eating';
      stopped = true; dailyFrame = second < 5 ? 0 : 1;
    } else if (second < 11) {x = interpolate(569, 550, (second - 8) / 3); action = 'carrying'; flip = true;}
    else if (second < 13) {
      x = 550; action = 'ear-twitch'; stopped = true; dailyFrame = 1;
    } else {x = interpolate(550, 553, (second - 13) / 2); action = 'carrying';}
  }
  if (id === 'hermit') {
    y = 400;
    if (second < 4) {x = interpolate(170, 180, second / 4); action = 'carrying';}
    else if (second < 9) {
      x = 180; action = second < 7 ? 'shaking' : 'peeking';
      stopped = true; dailyFrame = Math.floor(second * 1.5) % 2;
    } else if (second < 12) {x = interpolate(180, 170, (second - 9) / 3); action = 'dragging-paper';}
    else {x = 170; action = 'resting'; stopped = true; dailyFrame = 0;}
  }
  if (id === 'tagbird') {
    const flight = (time: number) => ({x: 620 + Math.sin(time * .7) * 12, y: 235 + Math.sin(time * 1.4) * 5});
    const approach = flight(3);
    if (second < 3) {({x, y} = flight(second)); action = 'flying';}
    else if (second < 5) {
      x = interpolate(approach.x, 601, (second - 3) / 2);
      y = interpolate(approach.y, 203, (second - 3) / 2); action = 'landing';
    } else if (second < 11) {
      x = 601; y = 203; action = second < 10 ? 'preening' : 'shaking';
      stopped = true; dailyFrame = Math.floor(second * 2) % 2;
    } else {
      x = interpolate(601, 620, (second - 11) / 4);
      y = interpolate(203, 235, (second - 11) / 4); action = 'flying';
    }
  }
  return {...original, x, y, depth: id === 'tagbird' ? 295 : y, action, flip, dailyFrame, stopped};
}
