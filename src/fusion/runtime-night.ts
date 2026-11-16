import type {SaveData} from '../game/engine';
import {repairPrice} from '../game/station';
import {worldView} from '../game/world';
import {bellHoldMs} from '../game/guard-tuning';
import {nightAt, simulateNight, type NightConfig, type NightTimeline} from '../prototype/night-model';
import {residentEnvironment} from '../render/resident-motion';
import {v034EventSeconds, type V034NightPhase, type V034NightSnapshot} from '../review/v034-night-model';

const plans = new Map<string, NightTimeline>();

export function fusionNightPlan(configuration: NightConfig) {
  const key = JSON.stringify([configuration.slots, configuration.strengths]);
  let plan = plans.get(key);
  if (!plan) {
    plan = simulateNight(configuration);
    if (plans.size >= 24) plans.delete(plans.keys().next().value!);
    plans.set(key, plan);
  }
  return plan;
}

function phaseAt(milliseconds: number, dawn: boolean): V034NightPhase {
  if (dawn) return 'dawn';
  if (milliseconds < 228000) return 'day';
  if (milliseconds < 240000) return 'dusk';
  const seconds = v034EventSeconds(milliseconds - 240000);
  if (milliseconds < 280200) return 'patrol';
  if (seconds < 5) return 'appear';
  if (seconds < 10) return 'track';
  if (seconds < 16) return 'identify';
  if (seconds < 23) return 'contain';
  if (seconds < 27) return 'result';
  return 'return';
}

/** Pose facts are a projection of the actual player world and its frozen night configuration. */
export function fusionNightSnapshot(state: SaveData, renderElapsedMs = state.world.elapsedMs): V034NightSnapshot {
  const phaseMs = renderElapsedMs % 300000;
  const dawn = state.world.settledNights > 0 && phaseMs < 8000;
  const worldMs = dawn ? 300000 + phaseMs : phaseMs;
  const modelMs = worldMs - 240000;
  const active = state.world.activeNight;
  const previous = dawn ? state.world.lastReport?.result?.configuration : undefined;
  const configuration: NightConfig = previous ?? {
    slots: active?.slots ?? state.world.slots,
    strengths: active?.strengths ?? state.world.strengths,
  };
  const plan = fusionNightPlan(configuration);
  const result = plan.result.actors[2];
  const current = nightAt(configuration, modelMs / 1000).actors.find(actor => actor.id === 2);
  const resolved = modelMs >= result.atMs;
  const resolutionFrame = plan.frames[Math.floor(result.atMs / 100)].actors.find(actor => actor.id === 2)!;
  const actor = current ?? (resolved ? resolutionFrame : undefined);
  const lastGate = plan.events.filter(event => event.id === 2 && event.kind === 'bell' && event.atMs <= modelMs).at(-1);
  const gateIndex = configuration.slots.findIndex(id => id === 'gate' || id === 'bell');
  const beaconIndex = configuration.slots.findIndex(id => id === 'beacon' || id === 'tape');
  const gateLevel = gateIndex >= 0 ? configuration.strengths[gateIndex] : 0;
  const renderWorld = {...state, world: {...state.world, elapsedMs: renderElapsedMs}};
  const environment = residentEnvironment(worldView(renderWorld), renderElapsedMs / 1000);
  const repair = state.station.lastRepair;
  const repairAge = repair ? (state.lastAt + renderElapsedMs - state.world.elapsedMs - repair.at) / 1000 : Infinity;
  const repairProgress = Math.max(0, Math.min(1, repairAge / 3));
  const epoch = state.lastAt - state.world.elapsedMs;
  const nightIndex = dawn ? state.world.settledNights : Math.floor(state.world.elapsedMs / 300000) + 1;
  const nightStart = epoch + (nightIndex - 1) * 300000 + 240000;
  const markerAt = plan.frames.find(frame => frame.actors.some(item => item.id === 2 && item.verification * 10500 >= 3000))?.atMs;
  const observations: V034NightSnapshot['observations'] = [];
  if (markerAt !== undefined && modelMs >= markerAt) {
    observations.push({
      actionId: `fusion/night-${nightIndex}/p03`, evidenceId: 'field-pipe-scan',
      observedAtSeconds: (nightStart + markerAt) / 1000,
      source: 'parcel/returns-plain/pipe-marker-p03',
      metadata: {artifactCode: 'RET-031', boxCode: 'P03', nodeId: 'pipe-marker-p03', eventKind: 'marker-scan'},
    });
  }
  if (modelMs >= 59200) {
    observations.push({
      actionId: `fusion/night-${nightIndex}/warehouse`, evidenceId: 'field-warehouse-arrival',
      observedAtSeconds: (nightStart + 59200) / 1000,
      source: 'parcel/returns-plain/receiving-warehouse',
      metadata: {artifactCode: 'RET-031', boxCode: 'P03', nodeId: 'receiving-warehouse', eventKind: 'warehouse-arrival'},
    });
  }
  return {
    preset: configuration.strengths.every(level => level >= 3) ? 'complete' : 'basic',
    mode: 'cycle', seconds: worldMs / 1000, duration: 308, scope: 'third-incident',
    phase: phaseAt(worldMs, dawn), eventSeconds: modelMs >= 40200 ? v034EventSeconds(modelMs) : null,
    sourceWorldMs: worldMs, sourceModelMs: modelMs, state,
    integrity: state.station.integrity, damage: state.station.currentDamage.points,
    repairSpent: state.station.lastNight?.spent ?? 0, resources: state.resources,
    autoRepair: state.station.autoRepair, repairDue: (100 - state.station.integrity) * repairPrice(state),
    configuration,
    actor: {
      id: 2, present: modelMs >= 40200 && modelMs < 60000,
      progress: resolved ? resolutionFrame.progress : actor?.progress ?? 0,
      verification: actor?.verification ?? 0, slowed: !!current?.slowed, stunned: !!current?.stunned,
      sourceAlpha: current?.alpha ?? 0, outcome: resolved ? result.outcome : null,
      resolution: resolved ? {modelMs: result.atMs, seconds: (240000 + result.atMs) / 1000, eventSeconds: v034EventSeconds(result.atMs)} : null,
    },
    facilities: {
      beacon: {enabled: beaconIndex >= 0, level: beaconIndex >= 0 ? configuration.strengths[beaconIndex] : 0, guiding: !!current?.slowed},
      gate: {enabled: gateIndex >= 0, level: gateLevel, holding: !!current?.stunned,
        remainingMs: current?.stunned && lastGate ? Math.max(0, lastGate.atMs + bellHoldMs(gateLevel) - modelMs) : 0,
        triggeredAtModelMs: lastGate?.atMs ?? null},
    },
    environment,
    repair: {
      active: repairAge >= 0 && repairAge < 3,
      progress: repairProgress, from: repair?.from ?? state.station.integrity,
      to: repair?.to ?? state.station.integrity, points: repair?.points ?? 0,
      spent: repair?.cost ?? 0, startedAt: repair ? repair.at / 1000 : null,
      automatic: repair?.automatic ?? false,
      displayIntegrity: repairAge >= 0 && repairAge < 3 ? repair!.from + (repair!.to - repair!.from) * repairProgress : state.station.integrity,
    },
    morning: state.station.lastNight, observations,
  };
}
