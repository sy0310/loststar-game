import {createRenewalEngineering} from '../render/renewal-engineering';
import type {SaveData} from '../game/engine';
import {tuning} from '../game/engine';
import {nightAt, type NightActorFrame} from '../prototype/night-model';
import {robotPose, robotScannerPoint, shipPose} from '../render/motion';
import type {SceneExtension, SceneFrame} from '../render/scene';
import {createRenewalResidentRenderer} from '../render/renewal-residents';
import {residentDailyPose} from '../review/resident-daily';
import {createRelightPatch, createV034NightScene} from '../review/v034-night-scene';
import {v034NightCamera, v034NightStage, v034SearchlightSource} from '../review/v034-night-stage';
import {v034ShipPose} from '../review/v034-camera';
import type {V034NightSnapshot} from '../review/v034-night-model';
import {fusionNightPlan, fusionNightSnapshot} from './runtime-night';
import {anomalyPoint, drawContainedAnomaly, drawFusionAnomaly, prepareFusionAnomalies} from './anomalies';
import {fusionCycleFraction, fusionRenderElapsed} from './render-clock';
import {createWorldFeedback, type FusionFeedbackEvent} from './world-feedback';
import type {FusionSave} from './contracts';
import {createSortingScene} from './sorting-scene';
import {createFusionSurfaceFog} from './surface-fog';
import {createRobotPerformance} from './robot-performance';
import {createSecurityMast} from '../render/security-mast';
import {firstPlanetFacilities} from './facilities';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {const amount = clamp(value);return amount * amount * (3 - 2 * amount);};
const interpolate = (from: number, to: number, amount: number) => from + (to - from) * smooth(amount);

function patrolActors(view: V034NightSnapshot) {
  if (view.environment.period !== 'night') return [];
  const plan = fusionNightPlan(view.configuration);
  return nightAt(view.configuration, view.sourceModelMs / 1000).actors.filter(actor => actor.id < 2).map(actor => {
    if (actor.status === 'approaching') return actor;
    const result = plan.result.actors[actor.id];
    const resolved = plan.frames[Math.floor(result.atMs / 100)].actors.find(item => item.id === actor.id)!;
    return {...actor, progress: resolved.progress};
  });
}

function patrolPose(base: ReturnType<typeof robotPose>, view: V034NightSnapshot) {
  if (view.environment.period !== 'night') return undefined;
  const seconds = view.sourceModelMs / 1000;
  const home = {x: 327, y: 454};
  if (seconds < 4.2) {
    const blend = smooth(seconds / 4.2);
    return {...base, x: base.x + (home.x - base.x) * blend, y: base.y + (home.y - base.y) * blend,
      action: 'walk' as const, parcel: {...base.parcel, visible: false, held: false}};
  }
  const id = seconds < 22.2 ? 0 : 1;
  const spawn = id === 0 ? 4.2 : 22.2;
  const end = id === 0 ? 22.2 : 40.2;
  const local = seconds - spawn;
  const result = fusionNightPlan(view.configuration).result.actors[id];
  const resolvedAt = result.atMs / 1000 - spawn;
  let x = 510;
  let y = 478;
  let action: ReturnType<typeof robotPose>['action'] = 'scan';
  if (local < 3) {
    x = interpolate(home.x, 510, local / 3);y = interpolate(home.y, 478, local / 3);action = 'walk';
  } else if (local >= resolvedAt) {
    const returning = (seconds - result.atMs / 1000) / Math.max(.3, end - result.atMs / 1000);
    x = interpolate(510, home.x, returning);y = interpolate(478, home.y, returning);action = 'return';
  }
  if (seconds >= 40.2) {x = home.x;y = home.y;action = 'walk';}
  const actor = patrolActors(view).find(item => item.id === id);
  const target = actor ? anomalyPoint(actor, view.environment.seconds) : {x: 430, y: 445};
  return {...base, x, y, action, facing: local < 3 ? 'right' as const : 'left' as const,
    carrying: false, parcel: {...base.parcel, x: target.x, y: target.y - 15, visible: false, held: false}};
}

function lightCone(context: CanvasRenderingContext2D, source: {x: number; y: number}, target: {x: number; y: number}, color: string, power: number) {
  if (power <= 0) return;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const edge = {x: -Math.sin(angle) * 23, y: Math.cos(angle) * 23};
  context.save();context.globalCompositeOperation = 'screen';
  const light = context.createLinearGradient(source.x, source.y, target.x, target.y);
  light.addColorStop(0, `${color}00`);light.addColorStop(.2, `${color}12`);light.addColorStop(1, `${color}38`);
  context.globalAlpha = power;context.fillStyle = light;context.beginPath();
  context.moveTo(source.x - edge.x * .06, source.y - edge.y * .06);
  context.lineTo(target.x - edge.x, target.y - edge.y);
  context.lineTo(target.x + edge.x, target.y + edge.y);
  context.lineTo(source.x + edge.x * .06, source.y + edge.y * .06);context.closePath();context.fill();
  context.restore();
}

function drawTracking(context: CanvasRenderingContext2D, frame: SceneFrame, actors: NightActorFrame[], view: V034NightSnapshot, beaconSource = {x: 559, y: 208}) {
  const actor = actors.find(item => item.status === 'approaching') ?? actors[0];
  if (!actor) return;
  const point = anomalyPoint(actor, frame.environment.seconds);
  if (!frame.ship.back) lightCone(context, v034SearchlightSource(frame.ship), {x: point.x, y: point.y - 20}, '#e5d8af', smooth(Math.sin(frame.ship.angle) / .18));
  if (actor.slowed) lightCone(context, beaconSource, {x: point.x, y: point.y - 8}, '#c3e4cd', .8);
  context.save();context.globalAlpha = actor.alpha * .6;context.strokeStyle = '#b9dcc6';context.lineWidth = 1;
  const radius = 28 + ((frame.environment.seconds * .6) % 1) * 12;
  context.beginPath();context.ellipse(point.x, point.groundY + 4, radius, radius * .24, 0, 0, Math.PI * 2);context.stroke();
  context.fillStyle = '#483c53';context.fillRect(point.x - 23, point.y - 49, 46, 3);
  context.fillStyle = '#c8e9c4';context.fillRect(point.x - 23, point.y - 49, 46 * actor.verification, 3);
  if (actor.stunned) {
    context.fillStyle = '#b6d8c6';context.fillRect(258, 372, 48, 2);
    for (let index = 0; index < 6; index++) context.fillRect(258 + index * 8, 374, 3, 26);
  }
  context.restore();
}

function drawHabitats(context: CanvasRenderingContext2D, state: SaveData) {
  const positions = [
    {id: 'mouse', x: 565, y: 449, width: 44},
    {id: 'hermit', x: 164, y: 402, width: 38},
    {id: 'tagbird', x: 601, y: 204, width: 31},
  ];
  for (const item of positions) {
    if (!state.collection.includes(item.id)) continue;
    context.save();context.fillStyle = '#3b334c';context.fillRect(item.x - item.width / 2 - 3, item.y + 1, item.width + 6, 7);
    context.fillStyle = '#bb946c';context.fillRect(item.x - item.width / 2, item.y - 1, item.width, 4);
    context.fillStyle = '#dec18d';context.fillRect(item.x - item.width / 2, item.y - 2, item.width - 3, 1);
    context.fillStyle = '#748f80';context.fillRect(item.x - item.width / 2 + 4, item.y + 4, item.width - 8, 2);
    context.fillStyle = '#9fd6c3';context.fillRect(item.x + item.width / 2 - 5, item.y + 3, 3, 2);
    if (item.id === 'hermit') {
      context.fillStyle = '#87775e';context.fillRect(item.x - 20, item.y - 19, 4, 20);context.fillRect(item.x - 21, item.y - 21, 15, 3);
      context.fillStyle = '#bfc7a1';context.fillRect(item.x - 19, item.y - 23, 15, 2);
    }
    if (item.id === 'mouse') {
      context.fillStyle = '#cdc2a4';context.fillRect(item.x + 14, item.y - 7, 12, 5);
      context.fillStyle = '#7d9c8b';context.fillRect(item.x + 16, item.y - 6, 3, 2);
    }
    context.restore();
  }
}

function drawArchive(context: CanvasRenderingContext2D, state: SaveData) {
  const report = state.world.lastReport;
  if (!report?.result) return;
  context.save();
  context.fillStyle = '#40364d';context.fillRect(340, 392, 47, 20);
  context.fillStyle = '#ba9576';context.fillRect(341, 392, 45, 2);
  report.result.actors.forEach((actor, index) => {
    const x = 344 + index * 14;
    context.fillStyle = '#a4a399';context.fillRect(x, 397, 9, 11);
    context.fillStyle = actor.outcome === 'intercepted' ? '#bde1b4' : '#e3b28b';
    context.fillRect(x + 2, 399, 5, 3);context.fillRect(x + 2, 404, 4, 1);
  });
  context.restore();
}

/** The existing scene is animated from one persisted world, with no review ledger. */
export function createFusionScene(
  getState: () => SaveData,
  onObservation?: (id: string, at: number, source: string) => void,
  getProjects: () => string[] = () => [],
  getFusion?: () => FusionSave,
): SceneExtension & {pulse(event?: FusionFeedbackEvent): void; focus(): {x: number; y: number}; unloadPoint(): {x:number;y:number}; feedbackMetrics():ReturnType<ReturnType<typeof createWorldFeedback>['metrics']>; surfaceMetrics():ReturnType<ReturnType<typeof createFusionSurfaceFog>['metrics']>; facilityMetrics(): {singleSorter: boolean; registrations: typeof firstPlanetFacilities}; snapshot(): V034NightSnapshot} {
  let current = fusionNightSnapshot(getState());
  let lastState = getState();
  let lastElapsed = -1;
  const snapshot = () => {
    const state = getState();
    const elapsed = Math.floor(fusionRenderElapsed(state, Date.now()));
    if (state !== lastState || elapsed !== lastElapsed) {
      lastState = state;lastElapsed = elapsed;current = fusionNightSnapshot(state, elapsed);
    }
    return current;
  };
  const journey = Boolean(getFusion?.().journey);
  const robotPerformance = createRobotPerformance(getState);
  const mast = journey ? createSecurityMast() : undefined;
  const daily = createRenewalResidentRenderer();
  const encounterLight = createRelightPatch();
  const layer = createV034NightScene({getState, snapshot}, {
    camera: v034NightCamera, patrolIntruders: false, beaconSource: mast?.source, patrolCarrierOnlyAtNight: journey,
    patrolRobotPose: base => patrolPose(base, snapshot()),
    patrolContents(context, _frame, position) {
      const view = snapshot();
      if (view.environment.period !== 'night' || view.sourceModelMs >= 40200) return;
      const id = view.sourceModelMs < 22200 ? 0 : 1;
      const result = fusionNightPlan(view.configuration).result.actors[id];
      if (result.outcome !== 'intercepted' || view.sourceModelMs < result.atMs) return;
      const end = id === 0 ? 22200 : 40200;
      const opacity = smooth((view.sourceModelMs - result.atMs) / 900) * smooth((end - view.sourceModelMs) / 700);
      drawContainedAnomaly(context, id, position, opacity);
    },
  });
  const feedback = createWorldFeedback();
  const sorting = createSortingScene(getFusion);
  const engineering=createRenewalEngineering(getState);
  const surface = createFusionSurfaceFog(getFusion);
  let feedbackToken = 0;
  let focus = {x: 416, y: 350};
  const seen = new Set<string>();
  const observe = (id: string, at: number, source: string, key: string) => {
    if (!onObservation || seen.has(key) || document.visibilityState !== 'visible') return;
    seen.add(key);onObservation(id, at, source);
    if (seen.size > 20) seen.delete(seen.values().next().value!);
  };
  return {
    ...layer,
    ready: Promise.all([layer.ready, daily.ready, prepareFusionAnomalies(), engineering.ready, sorting.ready, surface.ready, mast?.ready]).then(() => {}),
    hideLegacySorter: journey,
    independentResidents: true,
    robotAnimation: journey ? () => {
      if (snapshot().environment.period === 'night') return undefined;
      return robotPerformance.frame();
    } : undefined,
    shipPose() {
      const state = getState();
      return v034ShipPose(shipPose(fusionRenderElapsed(state, Date.now()) / 1000));
    },
    drawResident(context, id, environment, art, image) {
      if (!getState().collection.includes(id)) return {...residentDailyPose(id, environment), action: 'unseen', source: 'hidden', flightArt: false};
      return daily.draw(context, id, environment)!;
    },
    residentPose: residentDailyPose,
    cycleFraction(base, seconds) {
      const view = snapshot();
      if (view.environment.period !== 'night') return fusionCycleFraction(getState(), Date.now());
      return layer.cycleFraction?.(base, seconds) ?? base;
    },
    pulse(event) {
      const input = event ?? {token: --feedbackToken, kind: 'accepted' as const, ...focus, at: performance.now()};
      feedback.accept(input);
      robotPerformance.receive(input);
    },
    focus: () => focus,
    unloadPoint: () => ({x: 32 + v034NightCamera.x + (firstPlanetFacilities.reception.unload.tray.x - v034NightCamera.x) * v034NightCamera.scale + v034NightCamera.offsetX,
      y: v034NightCamera.y + (firstPlanetFacilities.reception.unload.tray.y - v034NightCamera.y) * v034NightCamera.scale + v034NightCamera.offsetY}),
    feedbackMetrics: () => feedback.metrics(),
    surfaceMetrics: () => surface.metrics(),
    facilityMetrics: () => ({singleSorter: journey, registrations: firstPlanetFacilities}),
    snapshot,
    robotPose(base, seconds) {
      const view = snapshot();
      base = sorting.pose(base, fusionCycleFraction(getState(), Date.now()), view.environment.period === 'night');
      if (sorting.active() && ['day','dusk'].includes(view.environment.period)) return base;
      if (['day', 'dusk'].includes(view.environment.period) && base.action === 'scan') {
        return {...base, parcel: {...base.parcel, x: 429, y: 398, visible: false}};
      }
      if (view.environment.period === 'dawn' && !view.repair.active) {
        const blend = smooth((view.sourceWorldMs - 303000) / 5000);
        return {...base, x: 327 + (base.x - 327) * blend, y: 454 + (base.y - 454) * blend,
          action: 'walk', parcel: {...base.parcel, visible: false, held: false}};
      }
      return layer.robotPose?.(base, seconds);
    },
    drawRobot(context, frame, atlas) {
      const view = snapshot();
      if (view.environment.period === 'dawn' && !view.repair.active) return false;
      return layer.drawRobot?.(context, frame, atlas);
    },
    worldEntities(context, frame) {
      const entities = layer.worldEntities?.(context, frame) ?? [];
      entities.push(...sorting.entities(context, frame));
      entities.push(...engineering.entities(context,frame));
      entities.push(...surface.entities(context, frame));
      const view = snapshot();
      if (mast) entities.push(...mast.entities(context, frame, view.facilities.beacon.enabled ? 1 : 0));
      for (const actor of patrolActors(view)) {
        const point = anomalyPoint(actor, frame.environment.seconds);
        entities.push({depth: actor.id === 1 ? point.groundY + .1 : point.groundY, draw: () => drawFusionAnomaly(context, actor, frame)});
      }
      const projects = getProjects();
      if (projects.includes('habitat-window')) entities.push({depth: 295 - .2, draw: () => drawHabitats(context, getState())});
      if (projects.includes('archive')) entities.push({depth: 417.2, draw: () => drawArchive(context, getState())});
      return entities;
    },
    afterWorld(context, frame) {
      const actors = patrolActors(snapshot());
      const litActor = actors[0];
      if (litActor) {
        const point = anomalyPoint(litActor, frame.environment.seconds);
        encounterLight.capture(context, {x: point.x, y: point.y - 22}, 66, .62);
      } else encounterLight.capture(context, {x: 0, y: 0}, 1, 0);
      layer.afterWorld(context, frame);
      const view = snapshot();
      encounterLight.draw(context);
      drawTracking(context, frame, actors, view, mast?.source());
      feedback.draw(context, frame, getState().assist?.appliedWorkMs ?? 0);
      sorting.afterWorld(context, frame);
      const fraction = getState().cycleMs / tuning(getState()).scanner;
      if (!sorting.active() && ['day', 'dusk'].includes(frame.environment.period) && frame.robot.action === 'scan') {
        lightCone(context, robotScannerPoint(frame.robot, frame.t, frame.robotAnimation), {x: 429, y: 398}, '#a9e2cd', .7);
        context.save();context.fillStyle = '#c3ebcc';context.globalAlpha = .8;
        context.fillRect(412, 392 + ((frame.t * 1.5) % 1) * 12, 34, 1);context.restore();
        if (fraction >= .42 && fraction < .49) observe('field-pipe-scan', getState().lastAt, 'parcel/returns-plain/pipe-marker-p03', `day/${getState().cycles}`);
      }
      for (const observation of fusionNightSnapshot(getState()).observations) {
        observe(observation.evidenceId, observation.observedAtSeconds * 1000, observation.source, observation.actionId);
      }
      let target = sorting.active() && frame.environment.period !== 'night' ? sorting.target() : {x: frame.robot.x, y: frame.robot.y - 48};
      if (actors.length) {const point = anomalyPoint(actors[0], frame.environment.seconds);target = {x: point.x, y: point.y - 20};}
      else if (view.eventSeconds !== null && frame.environment.period === 'night') target = v034NightStage(view).target;
      focus = {
        x: 32 + v034NightCamera.x + (target.x - v034NightCamera.x) * v034NightCamera.scale + v034NightCamera.offsetX,
        y: v034NightCamera.y + (target.y - v034NightCamera.y) * v034NightCamera.scale + v034NightCamera.offsetY,
      };
      frame.output.dataset.fusionPhase = view.phase;
      frame.output.dataset.fusionAnomaly = actors.some(actor => actor.id === 0) ? 'empty-box'
        : actors.some(actor => actor.id === 1) ? 'paper-moth' : view.actor.present ? 'paper-shadow' : 'none';
      frame.output.dataset.fusionWorldMs = String(getState().world.elapsedMs);
      frame.output.dataset.fusionObservation = String(seen.size);
    },
  };
}
