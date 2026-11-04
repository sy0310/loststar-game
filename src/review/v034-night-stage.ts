import {nightDoor, nightRobotRegistration, nightStage, smoothInstall, type NightStage} from './d1-motion';
import {bellHoldMs} from '../game/guard-tuning';
import {nightRules} from '../prototype/night-model';
import type {V034NightSnapshot} from './v034-night-model';
import type {robotPose, shipPose} from '../render/motion';
import {nightRobotSourcePoint} from './night-robot';

/** Keeps the complete registered globe inside the existing 832×740 canvas. */
export const v034NightCamera = {scale: 1.085, x: 384, y: 402, offsetX: 0, offsetY: -29};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Spatial progress changes only when the deterministic approach progresses. */
export function v034ApproachPoint(view: V034NightSnapshot) {
  const progress = view.actor.progress;
  const leaving = smoothInstall((progress - .88) / .12);
  const drift = 1 - smoothInstall((progress - .8) / .08);
  return {
    x: 425 + Math.sin(progress * Math.PI * 4) * 8 * drift - leaving * 135,
    y: 372 + Math.sin(progress * Math.PI * 2) * 3 * drift + leaving * 38,
  };
}

export function v034Escape(view: V034NightSnapshot) {
  const active = view.actor.progress > .88 && view.actor.outcome !== 'intercepted';
  let entry = 0;
  if (view.actor.outcome === 'arrived') {
    entry = clamp(1 - view.actor.sourceAlpha + (view.sourceModelMs % nightRules.stepMs) / 2500);
  }
  const point = v034ApproachPoint(view);
  return {active, entry, point: {x: point.x, y: point.y - entry * 44}};
}

function actionTime(view: V034NightSnapshot) {
  const time = view.eventSeconds ?? 0;
  if (time < 5) return time / 5 * 4;
  if (time < 10) return 4 + (time - 5) / 5 * 6;
  if (time < 16) return 10 + (time - 10) / 6 * 5;
  if (!view.actor.outcome) return 15 + smoothInstall((time - 16) / 1.5) * 2.5;
  if (view.actor.outcome === 'arrived') {
    if (time < 24.5) return 17.5 + smoothInstall((time - 23) / 1.5) * 2.5;
    if (time < 28) return 20 + (time - 24.5) / 3.5 * 6;
    return 26 + (time - 28) * 2;
  }
  if (time < 25) return 17.5 + smoothInstall(time - 24) * 2.5;
  if (time < 28) return 20 + (time - 25) * 2;
  return 26 + (time - 28) * 2;
}

function dawnStage(view: V034NightSnapshot) {
  const stage = nightStage(29.1);
  if (view.repair.active) {
    stage.phase = 'dock';
    stage.robot.action = 'unload';
    stage.rig.unload = 1;
    stage.rig.tilt = 0;
    stage.rig.bob = Math.sin(view.repair.progress * 18) * .4;
  }
  stage.cargo.visible = false;
  stage.paper.alpha = 0;
  stage.emerge = 0;
  stage.gate = 0;
  stage.target = {...nightDoor.light};
  stage.beamVisible = () => false;
  return stage;
}

/** Accepted D1 poses remain the renderer. Model facts decide their transitions. */
export function v034NightStage(view: V034NightSnapshot): NightStage {
  if (view.environment.period === 'dawn') return dawnStage(view);
  const stage = nightStage(actionTime(view));
  const time = view.eventSeconds ?? 0;
  const point = v034ApproachPoint(view);

  if (!view.actor.outcome) {
    let folding = 0;
    let intake = 0;
    if (view.actor.progress < .9 && time >= 16) {
      // The model resolves in 100ms ticks. Interpolate this visible folding
      // motion between those same verification ticks without changing facts.
      const verification = clamp(view.actor.verification
        + (view.sourceModelMs % nightRules.stepMs) / nightRules.verificationMs);
      folding = smoothInstall((verification - .9) / .1);
      intake = smoothInstall((verification - .94) / .06);
    }
    stage.paper.fold = folding;
    stage.paper.intake = intake;
    stage.fold = folding;
    stage.paper.freePivot = {
      x: point.x,
      y: point.y - 22.55 - Math.sin(view.seconds * 2) * 1.1,
    };
    stage.paper.ground = {...point};
    stage.target = {
      x: point.x + (stage.cargo.grip.x - point.x) * intake,
      y: point.y + (stage.cargo.grip.y + 20 - point.y) * intake,
    };
    stage.gate = 1;
    const triggeredAt = view.facilities.gate.triggeredAtModelMs;
    if (triggeredAt !== null) {
      const elapsed = view.sourceModelMs - triggeredAt;
      const heldFor = bellHoldMs(view.facilities.gate.level);
      if (elapsed < heldFor) stage.gate = 1 - smoothInstall(elapsed / 200);
      else stage.gate = smoothInstall((elapsed - heldFor) / 200);
    }
  }

  if (v034Escape(view).active) {
    stage.paper.alpha = 0;
    stage.emerge = 0;
    stage.target = {...v034Escape(view).point};
    if (view.actor.outcome === 'arrived') stage.gate = 1 - v034Escape(view).entry;
  }
  if (view.actor.outcome === 'intercepted') {
    stage.paper.fold = 1;
    stage.paper.intake = 1;
    stage.fold = 1;
    if (stage.phase === 'contain' || stage.phase === 'escort') {
      stage.target = {x: stage.cargo.grip.x, y: stage.cargo.grip.y + 20};
    }
  }
  stage.beamVisible = shipBack => !shipBack && view.environment.period === 'night';
  return stage;
}

/** The full cycle reaches this incident from the existing night patrol route. */
export function v034BlendFromPatrol(
  view: V034NightSnapshot,
  stage: NightStage,
  patrol: ReturnType<typeof robotPose>,
): NightStage {
  const elapsed = (view.sourceModelMs - 40200) / 1000;
  if (view.mode !== 'cycle' || view.eventSeconds === null || elapsed >= 1.5) return stage;
  const blend = smoothInstall(elapsed / 1.5);
  const dx = (patrol.x - stage.robot.x) * (1 - blend);
  const dy = (patrol.y - stage.robot.y) * (1 - blend);
  stage.robot.x += dx;
  stage.robot.y += dy;
  stage.robot.action = 'walk';
  stage.robot.facing = 'left';
  stage.phase = 'travel';
  stage.cargo.grip.x += dx;
  stage.cargo.grip.y += dy;
  stage.rig.bob = Math.sin(view.seconds * 12) * 1.1;
  return stage;
}

export function v034RepairTool(view: V034NightSnapshot) {
  const stage = v034NightStage(view);
  const grip = nightRobotSourcePoint(nightRobotRegistration.unloadHands[1], false, stage);
  const bottomLeft = nightDoor.opening[3];
  const bottomRight = nightDoor.opening[2];
  const tip = {
    x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * .75,
    y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * .75,
  };
  return {
    grip,
    tip,
    length: Math.hypot(tip.x - grip.x, tip.y - grip.y),
    angle: Math.atan2(tip.y - grip.y, tip.x - grip.x),
  };
}

// Measured light panels on the existing directional hulls. The source points
// follow their registered sprite layers and share their nozzle-aligned blend.
const searchlightSources = [
  {x: 154, y: 177},
  {x: 128, y: 185},
  {x: 106, y: 177},
  {x: 128, y: 124},
];

export function v034NightLightState(
  view: V034NightSnapshot,
  stage: NightStage,
  ship: ReturnType<typeof shipPose>,
) {
  const source = {x: 0, y: 0};
  for (const layer of ship.layers) {
    const panel = searchlightSources[layer.cell];
    const x = (panel.x - 128) * ship.width / 256;
    const y = (panel.y - 128) * ship.width / 256;
    source.x += (layer.x + x * Math.cos(layer.rotation) - y * Math.sin(layer.rotation)) * layer.alpha;
    source.y += (layer.y + x * Math.sin(layer.rotation) + y * Math.cos(layer.rotation)) * layer.alpha;
  }
  const escape = v034Escape(view);
  let target = {
    x: stage.target.x,
    y: stage.target.y - (1 - stage.paper.intake) * 21,
  };
  if (escape.active && view.actor.outcome === 'arrived') {
    const receive = smoothInstall(escape.entry);
    target = {
      x: 290 + (nightDoor.light.x - 290) * receive,
      y: 389 + (nightDoor.light.y - 389) * receive,
    };
  }
  const seconds = view.eventSeconds ?? 0;
  const orbit = smoothInstall(Math.sin(ship.angle) / .18);
  const entered = smoothInstall(seconds / .7);
  const returning = 1 - smoothInstall((seconds - 29.2) / .8);
  let beam = 0;
  if (view.eventSeconds !== null && stage.beamVisible(ship.back)) {
    beam = orbit * entered * returning * view.environment.light;
  }
  let attention = stage.emerge * (1 - stage.paper.intake);
  if (escape.active) attention = 1 - escape.entry;
  if (!view.actor.present) attention = 0;
  return {source, target, beam, attention, night: view.environment.light};
}

export function v034RelightState(view: V034NightSnapshot) {
  let focus = 0;
  if (view.eventSeconds !== null) {
    focus = smoothInstall((view.eventSeconds - 8) / 2)
      * (1 - smoothInstall((view.eventSeconds - 28) / 2));
  }
  return {
    station: view.environment.light * .48,
    work: view.environment.light * (.24 + focus * .32),
  };
}
