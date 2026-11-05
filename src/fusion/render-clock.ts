import type {SaveData} from '../game/engine';
import {tuning} from '../game/engine';
import {availableAssistWork, assistRules} from '../game/assist';
import {explorationFactor, planBoost} from '../game/station';
import {dayTimeBetween} from '../game/world';

/** Render between committed ticks for at most 250ms. A phase boundary awaits its real settlement. */
export function fusionPendingMs(state: SaveData, now: number) {
  if (!Number.isFinite(now)) return 0;
  const pending = Math.max(0, Math.min(250, now - state.lastAt));
  const phase = state.world.elapsedMs % 300000;
  const boundary = phase < 240000 ? 240000 : 300000;
  return Math.min(pending, Math.max(0, boundary - phase - .001));
}

/** Pure pose projection. Queue, income, discoveries and world state are untouched. */
export function fusionCycleFraction(state: SaveData, now: number) {
  return fusionRobotWork(state, now).cycles % 1;
}

/** One task is twelve animation seconds. Path, feet and scanner use this same integral. */
export function fusionRobotWork(state: SaveData, now: number) {
  const pending = fusionPendingMs(state, now);
  const daytime = dayTimeBetween(state.world.elapsedMs, pending);
  const bonus = availableAssistWork(state.assist, daytime);
  const factor = explorationFactor(state) * (1 + planBoost(state));
  const work = state.cycleMs + (daytime + bonus) * factor;
  const cycles = state.cycles + work / tuning(state).scanner;
  const assist = state.assist;
  const remaining = Math.max(0, (assist?.pendingWorkMs ?? 0) - bonus);
  const daytimeNow = (state.world.elapsedMs + pending) % 300000 < 240000;
  const assistRate = daytimeNow && remaining > .001
    ? assistRules.rate * Math.min(1, ((assist?.rampElapsedMs ?? 0) + daytime) / assistRules.rampMs) : 0;
  return {cycles, workSeconds: cycles * 12,
    appliedWorkMs: (assist?.appliedWorkMs ?? 0) + bonus, assistRate};
}

export function fusionRenderElapsed(state: SaveData, now: number) {
  return state.world.elapsedMs + fusionPendingMs(state, now);
}
