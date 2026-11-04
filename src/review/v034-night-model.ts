import {advance, newGame, type SaveData} from '../game/engine';
import {repairPrice, repairStation, setAutoRepair, type StationReceipt} from '../game/station';
import {
  nightAt, nightRules, simulateNight,
  type NightConfig, type NightOutcome, type NightTimeline,
  type NightActorResult, type NightActorFrame,
} from '../prototype/night-model';
import {bellHoldMs} from '../game/guard-tuning';
import type {ResidentEnvironment} from '../render/resident-motion';
import type {ReceiptSceneObservation} from './receipt-restoration';

export type V034NightPreset = 'basic' | 'complete';
export type V034NightMode = 'event' | 'cycle';
export type V034NightPhase =
  | 'day' | 'dusk' | 'patrol' | 'appear' | 'track' | 'identify'
  | 'contain' | 'result' | 'return' | 'dawn' | 'done';

export interface V034NightOptions {
  mode?: V034NightMode;
  autoRepair?: boolean;
}

export interface V034NightSnapshot {
  preset: V034NightPreset;
  mode: V034NightMode;
  seconds: number;
  duration: number;
  scope: 'third-incident';
  phase: V034NightPhase;
  eventSeconds: number | null;
  sourceWorldMs: number;
  sourceModelMs: number;
  state: SaveData;
  integrity: number;
  damage: number;
  repairSpent: number;
  resources: number;
  autoRepair: boolean;
  repairDue: number;
  configuration: NightConfig;
  actor: {
    id: 2;
    present: boolean;
    progress: number;
    verification: number;
    slowed: boolean;
    stunned: boolean;
    sourceAlpha: number;
    outcome: NightOutcome | null;
    resolution: {modelMs: number; seconds: number; eventSeconds: number} | null;
  };
  facilities: {
    beacon: {enabled: boolean; level: number; guiding: boolean};
    gate: {
      enabled: boolean;
      level: number;
      holding: boolean;
      remainingMs: number;
      triggeredAtModelMs: number | null;
    };
  };
  environment: ResidentEnvironment;
  repair: {
    active: boolean;
    progress: number;
    from: number;
    to: number;
    points: number;
    spent: number;
    startedAt: number | null;
    automatic: boolean;
    displayIntegrity: number;
  };
  morning: StationReceipt | null;
  observations: ReceiptSceneObservation[];
}

const epoch = 1800000000000;
const dayMs = 240000;
const entryModelMs = 40200;
const markerReadMs = 3000;
const knots = [
  {seconds: 0, modelMs: 40200},
  {seconds: 5, modelMs: 42000},
  {seconds: 10, modelMs: 43800},
  {seconds: 16, modelMs: 48000},
  {seconds: 23, modelMs: 52800},
  {seconds: 24, modelMs: 53800},
  {seconds: 27, modelMs: 56500},
  {seconds: 30, modelMs: 60000},
  {seconds: 36, modelMs: 66000},
] as const;

const presets: Record<V034NightPreset, NightConfig> = {
  basic: {slots: ['beacon', 'gate'], strengths: [0, 0]},
  complete: {slots: ['beacon', 'gate'], strengths: [3, 3]},
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smooth(value: number) {
  const time = clamp(value, 0, 1);
  return time * time * (3 - 2 * time);
}

export function v034EventModelMs(seconds: number) {
  const time = clamp(Number.isFinite(seconds) ? seconds : 0, 0, 36);
  const end = knots.findIndex(knot => knot.seconds >= time);
  if (end <= 0) return knots[0].modelMs;
  const startKnot = knots[end - 1];
  const endKnot = knots[end];
  const blend = (time - startKnot.seconds) / (endKnot.seconds - startKnot.seconds);
  return startKnot.modelMs + (endKnot.modelMs - startKnot.modelMs) * blend;
}

export function v034EventSeconds(modelMs: number) {
  const time = clamp(Number.isFinite(modelMs) ? modelMs : entryModelMs, entryModelMs, 66000);
  const end = knots.findIndex(knot => knot.modelMs >= time);
  if (end <= 0) return 0;
  const startKnot = knots[end - 1];
  const endKnot = knots[end];
  const blend = (time - startKnot.modelMs) / (endKnot.modelMs - startKnot.modelMs);
  return startKnot.seconds + (endKnot.seconds - startKnot.seconds) * blend;
}

function eventPhase(seconds: number): V034NightPhase {
  if (seconds < 5) return 'appear';
  if (seconds < 10) return 'track';
  if (seconds < 16) return 'identify';
  if (seconds < 23) return 'contain';
  if (seconds < 27) return 'result';
  if (seconds < 30) return 'return';
  if (seconds < 36) return 'dawn';
  return 'done';
}

function reviewPhase(worldMs: number, eventSeconds: number | null): V034NightPhase {
  if (eventSeconds !== null) return eventPhase(eventSeconds);
  if (worldMs >= 240000) return 'patrol';
  if (worldMs >= 228000) return 'dusk';
  return 'day';
}

function environmentAt(worldMs: number): ResidentEnvironment {
  const seconds = worldMs / 1000;
  if (worldMs < 228000) return {period: 'day', rest: 0, light: 0, seconds};
  if (worldMs < 240000) {
    const rest = smooth((worldMs - 228000) / 12000);
    return {period: 'dusk', rest, light: rest * .65, seconds};
  }
  if (worldMs < 300000) return {period: 'night', rest: 1, light: 1, seconds};
  const rest = 1 - smooth((worldMs - 300000) / 6000);
  return {period: 'dawn', rest, light: rest, seconds};
}

type Command =
  | {atMs: number; reviewAt: number; kind: 'auto'; enabled: boolean; repairTriggered: boolean}
  | {atMs: number; reviewAt: number; kind: 'repair'; expected: number};

/** Isolated review state. Every coin and damage point uses the existing engine. */
export function createV034NightModel(
  initialPreset: V034NightPreset = 'basic',
  initialOptions: V034NightOptions = {},
) {
  let preset = initialPreset;
  let mode: V034NightMode = initialOptions.mode ?? 'event';
  let configuration: NightConfig;
  let timeline: NightTimeline;
  let actorResult: NightActorResult;
  let resolutionFrame: NightActorFrame;
  let markerAt: number;
  let baseline: SaveData;
  let commands: Command[] = [];
  const stateCache = new Map<number, SaveData>();
  let cachedCommandCount = -1;
  let lastTime: number | undefined;
  let lastSnapshot: V034NightSnapshot | undefined;

  function initialise(autoRepair: boolean) {
    configuration = structuredClone(presets[preset]);
    timeline = simulateNight(configuration);
    actorResult = timeline.result.actors[2];
    resolutionFrame = nightAt(configuration, actorResult.atMs / 1000)
      .actors.find(actor => actor.id === 2)!;
    markerAt = timeline.frames.find(frame => frame.actors.some(actor =>
      actor.id === 2 && actor.verification * nightRules.verificationMs >= markerReadMs,
    ))!.atMs;

    const seed = newGame(epoch);
    seed.growth = {
      'guard-0': configuration.strengths[0],
      'guard-1': configuration.strengths[1],
    };
    seed.station.autoRepair = autoRepair;
    baseline = seed;
    if (mode === 'event') baseline = advance(seed, epoch + dayMs + entryModelMs);
    commands = [];
    stateCache.clear();
    cachedCommandCount = -1;
    lastTime = undefined;
    lastSnapshot = undefined;
  }
  initialise(initialOptions.autoRepair ?? true);

  function stateAt(worldMs: number, reviewSeconds: number) {
    const activeCommands = commands.filter(command => command.reviewAt <= reviewSeconds);
    if (activeCommands.length !== cachedCommandCount) {
      stateCache.clear();
      cachedCommandCount = activeCommands.length;
    }
    const tick = Math.floor(worldMs / 100) * 100;
    const existing = stateCache.get(tick);
    if (existing) return existing;

    let state = baseline;
    let fromCache = false;
    for (const [at, candidate] of stateCache) {
      if (at <= tick && at >= state.world.elapsedMs) {
        state = candidate;
        fromCache = true;
      }
    }

    const start = state.world.elapsedMs;
    for (const command of activeCommands) {
      if (command.atMs > tick || command.atMs < start) continue;
      if (fromCache && command.atMs === start) continue;
      state = advance(state, epoch + command.atMs);
      if (command.kind === 'auto') state = setAutoRepair(state, command.enabled);
      else state = repairStation(state, command.expected);
    }
    state = advance(state, epoch + tick);
    stateCache.set(tick, state);
    if (stateCache.size > 64) stateCache.delete(stateCache.keys().next().value!);
    return state;
  }

  function observedAt(modelMs: number) {
    if (mode === 'event') return v034EventSeconds(modelMs);
    return (dayMs + modelMs) / 1000;
  }

  function observationsAt(seconds: number, modelMs: number) {
    const observations: ReceiptSceneObservation[] = [];
    const source = 'parcel/returns-plain/night-review';
    if (modelMs >= markerAt) {
      observations.push({
        actionId: 'v034/night-1/actor-2/pipe-marker',
        evidenceId: 'field-pipe-scan',
        observedAtSeconds: observedAt(markerAt),
        source,
        metadata: {
          artifactCode: 'RET-031',
          boxCode: 'P03',
          nodeId: 'pipe-marker-p03',
          eventKind: 'marker-scan',
        },
      });
    }
    let warehouseAt = observedAt(actorResult.atMs);
    if (actorResult.outcome !== 'arrived') {
      warehouseAt = 29.15;
      if (mode === 'cycle') warehouseAt = observedAt(v034EventModelMs(29.15));
    }
    if (seconds >= warehouseAt) {
      observations.push({
        actionId: 'v034/night-1/actor-2/warehouse-transport',
        evidenceId: 'field-warehouse-arrival',
        observedAtSeconds: warehouseAt,
        source,
        metadata: {
          artifactCode: 'RET-031',
          boxCode: 'P03',
          nodeId: 'receiving-warehouse',
          eventKind: 'warehouse-arrival',
        },
      });
    }
    return observations;
  }

  function repairAt(state: SaveData, seconds: number): V034NightSnapshot['repair'] {
    const repair = state.station.lastRepair;
    if (!repair) {
      return {
        active: false,
        progress: 0,
        from: state.station.integrity,
        to: state.station.integrity,
        points: 0,
        spent: 0,
        startedAt: null,
        automatic: false,
        displayIntegrity: state.station.integrity,
      };
    }
    let startedAt = observedAt(repair.at - epoch - dayMs);
    for (const command of commands) {
      if (command.reviewAt > seconds || command.atMs !== repair.at - epoch) continue;
      if (command.kind === 'repair' || command.repairTriggered) startedAt = command.reviewAt;
    }
    const progress = smooth((seconds - startedAt) / 3);
    return {
      active: progress < 1,
      progress,
      from: repair.from,
      to: repair.to,
      points: repair.points,
      spent: repair.cost,
      startedAt,
      automatic: repair.automatic,
      displayIntegrity: repair.from + (repair.to - repair.from) * progress,
    };
  }

  function snapshot(inputSeconds: number): V034NightSnapshot {
    const duration = mode === 'event' ? 36 : 308;
    const reviewSeconds = Math.max(0, Number.isFinite(inputSeconds) ? inputSeconds : 0);
    // End the source ledger once. A later repair still receives its three
    // seconds of visual work from reviewSeconds without earning more income.
    const seconds = Math.min(reviewSeconds, duration);
    if (reviewSeconds === lastTime && lastSnapshot) return lastSnapshot;

    let sourceWorldMs = seconds * 1000;
    if (mode === 'event') sourceWorldMs = dayMs + v034EventModelMs(seconds);
    const sourceModelMs = sourceWorldMs - dayMs;
    const state = structuredClone(stateAt(sourceWorldMs, reviewSeconds));
    const current = nightAt(configuration, sourceModelMs / 1000)
      .actors.find(actor => actor.id === 2);
    const resolved = sourceModelMs >= actorResult.atMs;
    let actor = current;
    if (!actor && resolved) actor = resolutionFrame;
    if (!actor) {
      actor = {
        id: 2,
        progress: 0,
        verification: 0,
        slowed: false,
        stunned: false,
        sealing: false,
        alpha: 0,
        status: 'approaching',
      };
    }
    let eventSeconds: number | null = null;
    if (sourceModelMs >= entryModelMs) eventSeconds = v034EventSeconds(sourceModelMs);

    const lastGate = timeline.events.filter(event =>
      event.id === 2 && event.kind === 'bell' && event.atMs <= sourceModelMs,
    ).at(-1);
    let gateRemainingMs = 0;
    if (current?.stunned && lastGate) {
      gateRemainingMs = Math.max(0,
        lastGate.atMs + bellHoldMs(configuration.strengths[1]) - sourceModelMs,
      );
    }
    const beacon = {
      enabled: configuration.slots.includes('beacon'),
      level: configuration.strengths[0],
      guiding: !!current?.slowed,
    };
    const gate = {
      enabled: configuration.slots.includes('gate'),
      level: configuration.strengths[1],
      holding: !!current?.stunned,
      remainingMs: gateRemainingMs,
      triggeredAtModelMs: lastGate?.atMs ?? null,
    };
    let actorOutcome: NightOutcome | null = null;
    let progress = actor.progress;
    if (resolved) {
      actorOutcome = actorResult.outcome;
      progress = resolutionFrame.progress;
    }
    let resolution: V034NightSnapshot['actor']['resolution'] = null;
    if (resolved) {
      resolution = {
        modelMs: actorResult.atMs,
        seconds: observedAt(actorResult.atMs),
        eventSeconds: v034EventSeconds(actorResult.atMs),
      };
    }

    lastSnapshot = {
      preset,
      mode,
      seconds,
      duration,
      scope: 'third-incident',
      phase: reviewPhase(sourceWorldMs, eventSeconds),
      eventSeconds,
      sourceWorldMs,
      sourceModelMs,
      state,
      integrity: state.station.integrity,
      damage: state.station.damageTotal,
      repairSpent: state.station.repairSpent,
      resources: state.resources,
      autoRepair: state.station.autoRepair,
      repairDue: (100 - state.station.integrity) * repairPrice(state),
      configuration: structuredClone(configuration),
      actor: {
        id: 2,
        present: sourceModelMs >= entryModelMs && sourceWorldMs < 300000,
        progress,
        verification: actor.verification,
        slowed: !!current?.slowed,
        stunned: !!current?.stunned,
        sourceAlpha: current?.alpha ?? 0,
        outcome: actorOutcome,
        resolution,
      },
      facilities: {beacon, gate},
      environment: environmentAt(sourceWorldMs),
      repair: repairAt(state, reviewSeconds),
      morning: state.station.lastNight,
      observations: observationsAt(seconds, sourceModelMs),
    };
    lastTime = reviewSeconds;
    return lastSnapshot;
  }

  function replay(nextPreset: V034NightPreset = preset, options: V034NightOptions = {}) {
    preset = nextPreset;
    mode = options.mode ?? mode;
    initialise(options.autoRepair ?? true);
    return snapshot(0);
  }

  function record(command: Command, seconds: number) {
    commands.push(command);
    commands.sort((a, b) => a.atMs - b.atMs);
    stateCache.clear();
    lastTime = undefined;
    lastSnapshot = undefined;
    return snapshot(seconds);
  }

  function toggleAuto(enabled: boolean, seconds: number) {
    const current = snapshot(seconds);
    if (current.autoRepair === enabled) return current;
    const updated = setAutoRepair(current.state, enabled);
    return record({
      atMs: current.state.world.elapsedMs,
      reviewAt: Math.max(0, Number.isFinite(seconds) ? seconds : 0),
      kind: 'auto',
      enabled,
      repairTriggered: updated.station.repairSpent > current.repairSpent,
    }, seconds);
  }

  function repair(seconds: number, expected = snapshot(seconds).integrity) {
    const current = snapshot(seconds);
    if (repairStation(current.state, expected) === current.state) return current;
    return record({
      atMs: current.state.world.elapsedMs,
      reviewAt: Math.max(0, Number.isFinite(seconds) ? seconds : 0),
      kind: 'repair',
      expected,
    }, seconds);
  }

  return {
    snapshot,
    replay,
    setAutoRepair: toggleAuto,
    repair,
    getState: (seconds: number) => snapshot(seconds).state,
    get duration() {return mode === 'event' ? 36 : 308;},
  };
}

export type V034NightModel = ReturnType<typeof createV034NightModel>;
