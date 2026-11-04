import type {SaveData} from '../game/engine';
import {tuning} from '../game/engine';
import {availableAssistWork} from '../game/assist';
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
  const pending = fusionPendingMs(state, now);
  const daytime = dayTimeBetween(state.world.elapsedMs, pending);
  const bonus = availableAssistWork(state.assist, daytime);
  const factor = explorationFactor(state) * (1 + planBoost(state));
  const work = state.cycleMs + (daytime + bonus) * factor;
  return (work / tuning(state).scanner) % 1;
}

export function fusionRenderElapsed(state: SaveData, now: number) {
  return state.world.elapsedMs + fusionPendingMs(state, now);
}
