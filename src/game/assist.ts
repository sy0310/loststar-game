import {advance, type SaveData} from './engine';
import {explorationFactor, planBoost} from './station';

export const assistRules = {
  workPerTapMs: 600,
  capacityMs: 3000,
  intervalMs: 300,
  windowMs: 12000,
  tapsPerWindow: 5,
  rate: .6,
  rampMs: 200,
} as const;

/** All work values use base exploration milliseconds, before station modifiers. */
export interface AssistState {
  version: 1;
  pendingWorkMs: number;
  rampElapsedMs: number;
  acceptedAt: number[];
  actionSeq: number;
  enqueuedWorkMs: number;
  appliedWorkMs: number;
}

export function createAssist(): AssistState {
  return {
    version: 1,
    pendingWorkMs: 0,
    rampElapsedMs: 0,
    acceptedAt: [],
    actionSeq: 0,
    enqueuedWorkMs: 0,
    appliedWorkMs: 0,
  };
}

const finite = (value: unknown, maximum = 1e12): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;

export function cleanAssist(raw: unknown, savedAt: number): AssistState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as AssistState;
  if (value.version !== 1 || !finite(value.pendingWorkMs, assistRules.capacityMs) ||
    !finite(value.rampElapsedMs, assistRules.rampMs) || !finite(value.actionSeq, 1e9) ||
    !Number.isInteger(value.actionSeq) || !finite(value.enqueuedWorkMs) ||
    !finite(value.appliedWorkMs) || !Array.isArray(value.acceptedAt) ||
    value.acceptedAt.length > assistRules.tapsPerWindow || value.acceptedAt.length > value.actionSeq) return undefined;
  if (Math.abs(value.enqueuedWorkMs - value.actionSeq * assistRules.workPerTapMs) > .001 ||
    Math.abs(value.enqueuedWorkMs - value.appliedWorkMs - value.pendingWorkMs) > .01) return undefined;
  if (value.acceptedAt.some((at, index) => !finite(at, savedAt) ||
    (index > 0 && at - value.acceptedAt[index - 1] < assistRules.intervalMs))) return undefined;
  return {...value, acceptedAt: [...value.acceptedAt]};
}

/** Integral of the 200ms start ramp. It is independent of frame or tick size. */
function rampWork(elapsedMs: number) {
  const ramp = Math.min(elapsedMs, assistRules.rampMs);
  return assistRules.rate * (ramp * ramp / (2 * assistRules.rampMs) +
    Math.max(0, elapsedMs - assistRules.rampMs));
}

export function availableAssistWork(assist: AssistState | undefined, daytimeMs: number) {
  if (!assist || assist.pendingWorkMs <= 0 || daytimeMs <= 0) return 0;
  const work = rampWork(assist.rampElapsedMs + daytimeMs) - rampWork(assist.rampElapsedMs);
  return Math.min(assist.pendingWorkMs, work);
}

/** Mutates the already-cloned next save inside the chronological settlement. */
export function consumeAssistWork(assist: AssistState | undefined, daytimeMs: number) {
  const work = availableAssistWork(assist, daytimeMs);
  if (!assist || work <= 0) return 0;
  assist.pendingWorkMs = Math.max(0, assist.pendingWorkMs - work);
  assist.appliedWorkMs += work;
  assist.rampElapsedMs = assist.pendingWorkMs > 0
    ? Math.min(assistRules.rampMs, assist.rampElapsedMs + daytimeMs) : 0;
  return work;
}

export function assistedCycleTime(requiredWorkMs: number, factor: number, assist: AssistState | undefined) {
  const automaticMs = Math.max(1, Math.ceil(requiredWorkMs / factor - 1e-7));
  if (!assist || assist.pendingWorkMs <= 0) return automaticMs;
  let lower = 1;
  let upper = automaticMs;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const work = (middle + availableAssistWork(assist, middle)) * factor;
    if (work + 1e-7 >= requiredWorkMs) upper = middle;
    else lower = middle + 1;
  }
  return lower;
}

export type AssistReason = 'clock' | 'night' | 'busy' | 'cooldown' | 'limited' | null;

export function assistStatus(state: SaveData, now = state.lastAt) {
  const assist = state.assist ?? createAssist();
  const recent = assist.acceptedAt.filter(at => at > now - assistRules.windowMs);
  let reason: AssistReason = null;
  if (!finite(now, 1e15) || now < state.lastAt) reason = 'clock';
  else if (state.world.elapsedMs % 300000 >= 240000) reason = 'night';
  else if (assist.pendingWorkMs + assistRules.workPerTapMs > assistRules.capacityMs + 1e-7) reason = 'busy';
  else if (recent.length && now - recent[recent.length - 1] < assistRules.intervalMs) reason = 'cooldown';
  else if (recent.length >= assistRules.tapsPerWindow) reason = 'limited';
  return {
    pendingWorkMs: assist.pendingWorkMs,
    progressBonusMs: assist.pendingWorkMs * explorationFactor(state) * (1 + planBoost(state)),
    actionSeq: assist.actionSeq,
    accepted: assist.actionSeq,
    appliedWorkMs: assist.appliedWorkMs,
    enqueuedWorkMs: assist.enqueuedWorkMs,
    remainingTaps: Math.max(0, assistRules.tapsPerWindow - recent.length),
    canTap: reason === null,
    reason,
  };
}

export function tapAssist(state: SaveData, now: number, expectedSeq = state.assist?.actionSeq ?? 0): SaveData {
  if (!finite(now, 1e15) || now < state.lastAt) return state;
  const current = advance(state, now, now - state.lastAt >= 30000);
  const status = assistStatus(current, now);
  if (!status.canTap || expectedSeq !== status.actionSeq) return current;
  const assist = current.assist ?? createAssist();
  return {
    ...current,
    assist: {
      ...assist,
      pendingWorkMs: Math.min(assistRules.capacityMs, assist.pendingWorkMs + assistRules.workPerTapMs),
      acceptedAt: [...assist.acceptedAt.filter(at => at > now - assistRules.windowMs), now],
      actionSeq: assist.actionSeq + 1,
      enqueuedWorkMs: assist.enqueuedWorkMs + assistRules.workPerTapMs,
    },
  };
}
