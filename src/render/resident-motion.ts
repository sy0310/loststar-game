export const residentIds = ['mouse', 'hermit', 'tagbird'] as const;
export type ResidentId = typeof residentIds[number];
export type ResidentPeriod = 'day' | 'dusk' | 'night' | 'dawn';
export interface ResidentEnvironment {
  period: ResidentPeriod;
  rest: number;
  light: number;
  seconds: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

/** Period and twilight come from the existing persistent world clock. */
export function residentEnvironment(view: {
  phase: 'day' | 'dusk' | 'night';
  period?: ResidentPeriod;
  light: number;
  untilNextMs: number;
}, seconds: number): ResidentEnvironment {
  const period = view.period ?? view.phase;
  let rest = 0;
  if (period === 'dusk') rest = smooth(view.light / .65);
  if (period === 'night') rest = 1;
  if (period === 'dawn') rest = 1 - smooth((240000 - view.untilNextMs) / 8000);
  return {period, rest, light: clamp(view.light), seconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 0};
}

const residents = {
  mouse: {
    day: {x: 553, y: 447}, home: {x: 565, y: 447},
    width: 83, shadow: 29, phase: 0,
    dayAction: 'foraging', nightAction: 'sleeping',
  },
  hermit: {
    day: {x: 170, y: 397}, home: {x: 164, y: 400},
    width: 66, shadow: 25, phase: 1.4,
    dayAction: 'carrying', nightAction: 'sheltering',
  },
  tagbird: {
    day: {x: 632, y: 232}, home: {x: 601, y: 203},
    width: 47, shadow: 11, phase: 2.1,
    dayAction: 'flying', nightAction: 'roosting',
  },
} as const;

export function residentMotion(id: ResidentId, environment: ResidentEnvironment) {
  const definition = residents[id];
  const time = environment.seconds;
  const speed = id === 'hermit' ? .18 : id === 'tagbird' ? .65 : .45;
  const sway = Math.sin(time * speed + definition.phase);
  const range = id === 'hermit' ? 12 : id === 'tagbird' ? 15 : 16;
  const dayX = definition.day.x + sway * range;
  const dayY = definition.day.y + Math.sin(time * speed * 2 + definition.phase) * (id === 'tagbird' ? 7 : 2);
  const rest = clamp(environment.rest);
  const action = environment.period === 'dusk' ? 'returning'
    : environment.period === 'dawn' ? 'waking'
    : environment.period === 'night' ? definition.nightAction : definition.dayAction;
  return {
    id, action,
    x: dayX + (definition.home.x - dayX) * rest,
    y: dayY + (definition.home.y - dayY) * rest,
    depth: id === 'tagbird' ? 295 : dayY + (definition.home.y - dayY) * rest,
    width: definition.width,
    shadow: definition.shadow,
    frame: Math.floor(time * (id === 'tagbird' && rest < .9 ? 5 : .65) + definition.phase) % 2,
    nightArt: rest >= .9,
    flip: rest < .2 && id === 'mouse' && Math.cos(time * speed) < 0,
  };
}
