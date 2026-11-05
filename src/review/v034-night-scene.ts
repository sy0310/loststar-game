import invaderUrl from '../../assets/runtime/invader-v02.webp';
import {worldView} from '../game/world';
import {guardLayer} from '../render/guard-scene';
import {tintWorld} from '../render/world-lighting';
import type {SceneCamera, SceneExtension, SceneFrame} from '../render/scene';
import {nightCamera, nightDoor, type NightStage} from './d1-motion';
import {createNightStudy, type NightStudyOptions} from './night-scene';
import {
  createV034NightModel,
  type V034NightModel,
  type V034NightOptions,
  type V034NightPreset,
  type V034NightSnapshot,
} from './v034-night-model';
import {v034BlendFromPatrol, v034Escape, v034NightLightState, v034NightStage, v034RelightState, v034RepairTool} from './v034-night-stage';
import {robotScannerSource} from '../render/motion';
import {nightRobotSourcePoint} from './night-robot';

export interface V034NightSceneOptions {
  camera?: SceneCamera;
  patrolIntruders?: boolean;
  patrolRobotPose?: SceneExtension['robotPose'];
  patrolContents?: NightStudyOptions['idleContents'];
}

const marker = {x: 408, y: 389, width: 43, height: 18};

function softLight(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number,
) {
  const light = context.createRadialGradient(x, y, 1, x, y, radius);
  light.addColorStop(0, color);
  light.addColorStop(1, `${color}00`);
  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = opacity;
  context.fillStyle = light;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  context.restore();
}

/** Alpha-preserving color fields keep the same globe pixels and silhouettes. */
function drawNightAtmosphere(
  context: CanvasRenderingContext2D,
  view: V034NightSnapshot,
) {
  const night = view.environment.light;
  if (night <= 0) return;
  context.save();
  context.globalCompositeOperation = 'source-atop';
  context.globalAlpha = night;
  const shade = context.createLinearGradient(160, 160, 610, 680);
  shade.addColorStop(0, '#20386ba0');
  shade.addColorStop(.48, '#252b5992');
  shade.addColorStop(1, '#17245bb0');
  context.fillStyle = shade;
  context.fillRect(-32, 0, 864, 740);
  const rim = context.createLinearGradient(530, 420, 735, 550);
  rim.addColorStop(0, '#70b4da00');
  rim.addColorStop(.72, '#70b4da0c');
  rim.addColorStop(1, '#70b4da57');
  context.fillStyle = rim;
  context.fillRect(460, 80, 300, 655);
  context.restore();
}

function drawStationLights(
  context: CanvasRenderingContext2D,
  stage: NightStage,
  view: V034NightSnapshot,
) {
  const night = view.environment.light;
  if (night <= 0) return;
  const receiving = stage.phase === 'dock' ? .1 : 0;
  softLight(context, 283, 390, 64, '#ebbd81', (.18 + receiving) * night);
  softLight(context, 359, 334, 46, '#e6b57b', .18 * night);
  softLight(context, 558, 210, 37, '#b1dfd0', .14 * night);
  context.save();
  context.globalCompositeOperation = 'screen';
  let fault = 0;
  if (view.actor.outcome === 'arrived' && view.actor.resolution) {
    const age = view.seconds - view.actor.resolution.seconds;
    if (age >= 0 && age < 1.3) fault = Math.sin(age / 1.3 * Math.PI * 2) ** 2;
  }
  context.globalAlpha = night * (.68 - fault * .42);
  context.fillStyle = '#efc28a';
  // Source-space windows on the original 256×235 warehouse, at scale170/256.
  context.translate(230, 261);
  context.scale(170 / 256, 170 / 256);
  for (const points of [
    [[177, 109], [189, 104], [189, 124], [177, 129]],
    [[193, 102], [207, 97], [207, 118], [193, 123]],
    [[213, 95], [231, 89], [231, 110], [213, 116]],
  ]) {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) context.lineTo(x, y);
    context.closePath();
    context.fill();
  }
  context.restore();
}

/** A small original-pixel patch restores local material contrast under work lights. */
export function createRelightPatch() {
  const patch = document.createElement('canvas');
  patch.width = 256;
  patch.height = 256;
  const painter = patch.getContext('2d')!;
  let left = 0;
  let top = 0;
  let visible = false;

  return {
    capture(context: CanvasRenderingContext2D, center: {x: number; y: number}, radius: number, power: number) {
      visible = power > 0;
      if (!visible) return;
      const transform = context.getTransform();
      const x = transform.a * center.x + transform.c * center.y + transform.e;
      const y = transform.b * center.x + transform.d * center.y + transform.f;
      const scale = Math.hypot(transform.a, transform.b);
      left = Math.floor(x - 128);
      top = Math.floor(y - 128);
      painter.globalCompositeOperation = 'source-over';
      painter.clearRect(0, 0, 256, 256);
      painter.imageSmoothingEnabled = false;
      painter.drawImage(context.canvas, left, top, 256, 256, 0, 0, 256, 256);
      const mask = painter.createRadialGradient(x - left, y - top, radius * scale * .2,
        x - left, y - top, radius * scale);
      mask.addColorStop(0, `rgba(255,255,255,${power})`);
      mask.addColorStop(1, 'rgba(255,255,255,0)');
      painter.globalCompositeOperation = 'destination-in';
      painter.fillStyle = mask;
      painter.fillRect(0, 0, 256, 256);
    },
    draw(context: CanvasRenderingContext2D) {
      if (!visible) return;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = 'source-over';
      context.drawImage(patch, left, top);
      context.restore();
    },
  };
}

function createBeamTexture(color: readonly [number, number, number] = [238, 221, 171]) {
  const texture = document.createElement('canvas');
  texture.width = 128;
  texture.height = 384;
  const context = texture.getContext('2d')!;
  const pixels = context.createImageData(texture.width, texture.height);
  for (let y = 0; y < texture.height; y++) {
    const progress = y / (texture.height - 1);
    const halfWidth = 2 + progress * 62;
    for (let x = 0; x < texture.width; x++) {
      const across = Math.abs(x - 63.5) / halfWidth;
      const feather = Math.max(0, 1 - across * across);
      const opacity = feather * feather * (.27 - progress * .13);
      const offset = (y * texture.width + x) * 4;
      pixels.data[offset] = color[0];
      pixels.data[offset + 1] = color[1];
      pixels.data[offset + 2] = color[2];
      pixels.data[offset + 3] = Math.round(opacity * 255);
    }
  }
  context.putImageData(pixels, 0, 0);
  return texture;
}

function drawSearchlight(
  context: CanvasRenderingContext2D,
  frame: SceneFrame,
  stage: NightStage,
  view: V034NightSnapshot,
  texture: HTMLCanvasElement,
) {
  const light = v034NightLightState(view, stage, frame.ship);
  if (light.beam <= 0) return;
  const angle = Math.atan2(light.target.y - light.source.y, light.target.x - light.source.x);
  const distance = Math.hypot(light.target.x - light.source.x, light.target.y - light.source.y);
  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = light.beam;
  context.translate(light.source.x, light.source.y);
  context.rotate(angle - Math.PI / 2);
  context.drawImage(texture, -28, 0, 56, distance);
  context.restore();
  softLight(context, light.target.x, light.target.y, 38, '#e8dca7', light.beam * .29);
}

function drawAttention(
  context: CanvasRenderingContext2D,
  frame: SceneFrame,
  stage: NightStage,
  view: V034NightSnapshot,
) {
  const light = v034NightLightState(view, stage, frame.ship);
  if (light.attention <= 0) return;
  const escape = v034Escape(view);
  const ground = escape.active
    ? {x: escape.point.x, y: escape.point.y + escape.entry * 44}
    : stage.paper.ground;
  const wave = (view.seconds * .65) % 1;
  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = light.attention;
  for (let index = 0; index < 16; index++) {
    const angle = index / 16 * Math.PI * 2;
    const radius = 27 + wave * 15;
    context.fillStyle = `rgba(180,221,197,${(1 - wave) * .7})`;
    context.fillRect(Math.round(ground.x + Math.cos(angle) * radius), Math.round(ground.y + 3 + Math.sin(angle) * radius * .3), 2, 2);
  }
  context.strokeStyle = '#b4decb';
  context.lineWidth = 1.5;
  for (const sign of [-1, 1]) {
    context.beginPath();
    context.moveTo(light.target.x + sign * 24, light.target.y - 22);
    context.lineTo(light.target.x + sign * 30, light.target.y - 22);
    context.lineTo(light.target.x + sign * 30, light.target.y - 16);
    context.stroke();
  }
  context.restore();
}

function drawDoorSignals(
  context: CanvasRenderingContext2D,
  stage: NightStage,
  view: V034NightSnapshot,
) {
  const active = view.facilities.gate.holding;
  const night = view.environment.light;
  if (night <= 0) return;
  const intensity = active ? .9 : .2;
  context.save();
  context.globalAlpha = night * intensity;
  let indicator = '#85bbbe';
  if (active) indicator = '#e2c384';
  else if (view.repair.displayIntegrity < 100) indicator = '#edaa7e';
  else if (view.actor.outcome === 'intercepted') indicator = '#b9e6bd';
  context.fillStyle = indicator;
  for (const [x, y] of [[257, 373], [307, 380]]) {
    context.fillRect(x, y, 3, 7);
    context.fillRect(x, y + 13, 3, 7);
  }
  if (active) {
    const bottom = 364 + 43 * (1 - stage.gate);
    context.save();
    doorClip(context);
    context.fillStyle = '#f1cd8b';
    context.fillRect(260, bottom - 2, 45, 2);
    context.globalAlpha *= .4;
    for (let y = 369; y < bottom; y += 6) context.fillRect(260, y, 45, 1);
    context.restore();
  }
  context.restore();
  softLight(context, 283, 410, 34, active ? '#d7c691' : '#9fc9bc', night * (active ? .24 : .07));
}

function drawSealedIndicator(
  context: CanvasRenderingContext2D,
  stage: NightStage,
  view: V034NightSnapshot,
) {
  if (view.actor.outcome !== 'intercepted' || !stage.cargo.latched
    || !stage.cargo.visible || stage.cargo.receiving > 0) return;
  context.save();
  context.translate(stage.cargo.grip.x, stage.cargo.grip.y);
  context.rotate(stage.cargo.angle);
  context.transform(stage.cargo.yaw, -(1 - stage.cargo.yaw) * .12, (1 - stage.cargo.pitch) * .18, stage.cargo.pitch, 0, 0);
  context.fillStyle = '#b6edb8';
  context.fillRect(-12, 27, 6, 2);
  context.fillStyle = '#2b5b52';
  context.fillRect(-12, 29, 6, 1);
  context.restore();
}

function doorClip(context: CanvasRenderingContext2D) {
  context.beginPath();
  context.moveTo(nightDoor.opening[0].x, nightDoor.opening[0].y);
  for (const point of nightDoor.opening.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.clip();
}

/** This authored field label is the visible source of the P03 observation. */
function drawMarker(context: CanvasRenderingContext2D) {
  context.save();
  context.fillStyle = '#423744';
  context.beginPath();
  context.moveTo(marker.x, marker.y + 2);
  context.lineTo(marker.x + marker.width - 3, marker.y);
  context.lineTo(marker.x + marker.width, marker.y + marker.height - 2);
  context.lineTo(marker.x + 3, marker.y + marker.height);
  context.closePath();
  context.fill();
  context.fillStyle = '#c6aa80';
  context.fillRect(marker.x + 3, marker.y + 3, marker.width - 6, marker.height - 6);
  context.fillStyle = '#806453';
  context.fillRect(marker.x + 4, marker.y + marker.height - 4, marker.width - 7, 1);
  context.fillStyle = '#39333e';
  context.textAlign = 'center';
  context.font = 'bold 8px monospace';
  context.fillText('P03', marker.x + marker.width / 2, marker.y + 9);
  context.font = '6px monospace';
  context.fillText('RET-031', marker.x + marker.width / 2, marker.y + 14);
  context.restore();
}

function drawMarkerScan(
  context: CanvasRenderingContext2D,
  frame: SceneFrame,
  view: V034NightSnapshot,
  texture: HTMLCanvasElement,
) {
  if (view.phase !== 'identify') return;
  const stage = v034NightStage(view);
  const observed = view.observations.some(item => item.evidenceId === 'field-pipe-scan');
  const source = nightRobotSourcePoint(robotScannerSource, false, stage);
  const target = {x: marker.x + marker.width / 2, y: marker.y + marker.height / 2};
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  context.save();
  context.globalCompositeOperation = 'screen';
  context.translate(source.x, source.y);
  context.rotate(angle - Math.PI / 2);
  context.drawImage(texture, -18, 0, 36, distance);
  context.restore();
  context.save();
  const scanY = marker.y + 2 + ((frame.t * 1.7) % 1) * (marker.height - 4);
  context.fillStyle = observed ? '#dbf4c9' : '#a5d9c5';
  context.fillRect(marker.x + 3, scanY, marker.width - 6, 2);
  if (observed) {
    context.fillRect(marker.x + marker.width + 4, marker.y + 3, 2, 4);
    context.fillRect(marker.x + marker.width + 6, marker.y + 6, 5, 2);
  }
  context.restore();
}

function drawGuidance(
  context: CanvasRenderingContext2D,
  view: V034NightSnapshot,
) {
  if (!view.facilities.beacon.guiding) return;
  const target = v034NightStage(view).target;
  const strength = .11 + view.facilities.beacon.level * .025;
  context.save();
  context.globalCompositeOperation = 'screen';
  const light = context.createLinearGradient(559, 208, target.x, target.y);
  light.addColorStop(0, `rgba(189,225,202,${strength + .06})`);
  light.addColorStop(1, `rgba(189,225,202,${strength})`);
  context.fillStyle = light;
  context.beginPath();
  context.moveTo(556, 208);
  context.lineTo(target.x - 25, target.y + 4);
  context.lineTo(target.x + 25, target.y + 4);
  context.lineTo(562, 208);
  context.closePath();
  context.fill();
  context.fillStyle = '#d8f3c7';
  context.fillRect(555, 207, 9, 3);
  context.restore();
}

function drawDamage(
  context: CanvasRenderingContext2D,
  view: V034NightSnapshot,
) {
  const missing = 100 - view.repair.displayIntegrity;
  if (missing <= .01) return;
  context.save();
  context.lineWidth = 3;
  context.strokeStyle = '#261e35';
  context.beginPath();
  context.moveTo(311, 377);
  context.lineTo(319, 382);
  context.lineTo(315, 389);
  context.lineTo(322, 395);
  context.stroke();
  context.lineWidth = 1;
  context.strokeStyle = '#cc9365';
  context.stroke();
  context.fillStyle = '#ae657e';
  context.fillRect(313, 376, 4, 2);
  context.fillStyle = '#efb779';
  context.fillRect(322, 398, 3, 2);
  context.restore();
}

function drawImpact(
  context: CanvasRenderingContext2D,
  view: V034NightSnapshot,
) {
  if (view.actor.outcome !== 'arrived' || !view.actor.resolution) return;
  const age = view.seconds - view.actor.resolution.seconds;
  if (age < 0 || age > 1.3) return;
  const pulse = (1 - age / 1.3) * (.45 + Math.sin(age / 1.3 * Math.PI * 2) ** 2 * .55);
  softLight(context, 309, 391, 35, '#efb27b', pulse * .45);
  context.save();
  context.globalAlpha = 1 - age / 1.3;
  for (let index = 0; index < 9; index++) {
    const angle = index * 2.3;
    const distance = age * (12 + index * 3);
    context.fillStyle = index % 2 ? '#e9bd8f' : '#b67e91';
    context.fillRect(309 + Math.cos(angle) * distance, 393 + Math.sin(angle) * distance, 2 + index % 2, 4);
  }
  context.fillStyle = '#ffd29c';
  context.fillRect(306, 391, 5, 3);
  context.restore();
}

function drawRepair(
  context: CanvasRenderingContext2D,
  view: V034NightSnapshot,
) {
  if (!view.repair.active) return;
  const tool = v034RepairTool(view);
  softLight(context, tool.tip.x, tool.tip.y, 22, '#b8e3d2', .23);
  context.save();
  context.translate(tool.grip.x, tool.grip.y);
  context.rotate(tool.angle);
  context.fillStyle = '#a67e62';
  context.fillRect(-2, -3, 6, 6);
  context.fillStyle = '#767b90';
  context.fillRect(2, -2, Math.max(0, tool.length - 3), 4);
  context.fillStyle = '#e8ecd0';
  context.fillRect(tool.length - 2, -1, 3, 2);
  context.restore();
  context.save();
  for (let index = 0; index < 8; index++) {
    const phase = (view.repair.progress * 7.2 + index * .17) % 1;
    const angle = index * 2.1;
    context.globalAlpha = 1 - phase;
    context.fillStyle = index % 2 ? '#d6e6d6' : '#f3cd8d';
    context.fillRect(
      tool.tip.x + Math.cos(angle) * phase * 13,
      tool.tip.y + Math.sin(angle) * phase * 8,
      2 + index % 2,
      3,
    );
  }
  context.restore();
}

function drawEscape(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  view: V034NightSnapshot,
  inside: boolean,
) {
  const escape = v034Escape(view);
  if (!escape.active || escape.entry >= 1) return;
  if (escape.entry === 0 && inside) return;
  const scale = .35;
  const left = escape.point.x - 96 * scale;
  const top = escape.point.y - 159 * scale;
  const plane = left + 192 * scale * escape.entry;
  context.save();
  if (inside) {
    doorClip(context);
    context.beginPath();
    context.rect(250, 340, Math.max(0, plane - 250), 100);
    context.clip();
  } else if (escape.entry > 0) {
    context.beginPath();
    context.rect(plane, 300, 200, 150);
    context.clip();
  }
  context.drawImage(image, 0, 0, 192, 192, left, top, 192 * scale, 192 * scale);
  context.restore();
}

/** Financial state and every facility action share the existing deterministic model. */
export function createV034NightScene(model: Pick<V034NightModel, 'snapshot' | 'getState'>, options: V034NightSceneOptions = {}): SceneExtension {
  let currentSeconds = 0;
  const paper = new Image();
  paper.src = invaderUrl;
  const beamTexture = createBeamTexture();
  const scanTexture = createBeamTexture([168, 216, 196]);
  const workRelight = createRelightPatch();
  const stationRelight = createRelightPatch();
  const patrol = guardLayer(() => {
    const state = model.getState(currentSeconds);
    return {
      ...worldView(state),
      station: state.station,
      research: state.research,
      at: state.lastAt,
      repairBay: 0,
    };
  }, {showEquipment: false, showSearchLine: false, showIntruders: options.patrolIntruders});
  const stageAt = (seconds: number) => {
    currentSeconds = seconds;
    const view = model.snapshot(seconds);
    const stage = v034NightStage(view);
    const previous = options.patrolRobotPose?.(stage.robot, seconds) ?? patrol.robotPose?.(stage.robot, seconds);
    if (!previous) return stage;
    return v034BlendFromPatrol(view, stage, previous);
  };
  const study = createNightStudy(seconds => {
    const view = model.snapshot(seconds);
    const focused = view.eventSeconds !== null;
    return {
      environment: view.environment,
      nightSeconds: focused ? seconds : null,
      fraction: focused ? stageAt(seconds).fraction : 0,
      duration: view.duration,
    };
  }, stageAt, {
    idleCarrier: true,
    searchlight: false,
    registrationMarks: false,
    idleContents: options.patrolContents,
    paperRim: '#bce6d5',
    lightWorld: (context, _frame, _stage, strength) => tintWorld(context, '#737da9', strength ?? 1),
  });
  const ready = Promise.all([study.ready, paper.decode()]).then(() => {});
  void ready.catch(() => {});

  return {
    ready,
    camera: options.camera ?? nightCamera,
    environment: seconds => model.snapshot(seconds).environment,
    cycleFraction(base, seconds) {
      currentSeconds = seconds;
      const view = model.snapshot(seconds);
      if (view.eventSeconds === null) return base;
      return stageAt(seconds).fraction;
    },
    robotPose(base, seconds) {
      currentSeconds = seconds;
      const view = model.snapshot(seconds);
      if (view.eventSeconds === null) return options.patrolRobotPose?.(base, seconds) ?? patrol.robotPose?.(base, seconds);
      return study.robotPose?.(base, seconds);
    },
    drawRobot(context, frame, atlas) {
      if (model.snapshot(frame.t).eventSeconds === null) return false;
      return study.drawRobot?.(context, frame, atlas);
    },
    worldEntities(context, frame) {
      const view = model.snapshot(frame.t);
      const entities = [{depth: marker.y + marker.height, draw: () => drawMarker(context)}];
      entities.push(...study.worldEntities?.(context, frame) ?? []);
      if (view.eventSeconds === null) return entities;
      const stage = stageAt(frame.t);
      entities.push({depth: stage.robot.y + .25, draw: () => drawSealedIndicator(context, stage, view)});
      const escape = v034Escape(view);
      if (escape.active && escape.entry < 1) {
        entities.push({depth: 417.15, draw: () => drawEscape(context, paper, view, true)});
        entities.push({depth: 430, draw: () => drawEscape(context, paper, view, false)});
        entities.push({
          depth: 409,
          draw() {
            context.save();
            context.globalAlpha = .2 * (1 - escape.entry);
            context.fillStyle = '#211b34';
            context.beginPath();
            context.ellipse(escape.point.x, escape.point.y + escape.entry * 44 + 2, 15, 4, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();
          },
        });
      }
      return entities;
    },
    afterWorld(context, frame) {
      currentSeconds = frame.t;
      const view = model.snapshot(frame.t);
      const stage = stageAt(frame.t);
      const relight = v034RelightState(view);
      workRelight.capture(context, {x: frame.robot.x - 21, y: frame.robot.y - 64}, 103, relight.work);
      stationRelight.capture(context, {x: 300, y: 365}, 110, relight.station);
      if (view.eventSeconds === null) patrol.afterWorld(context, frame);
      else {
        study.afterWorld(context, frame);
      }
      drawNightAtmosphere(context, view);
      stationRelight.draw(context);
      workRelight.draw(context);
      drawStationLights(context, stage, view);
      if (view.eventSeconds !== null) {
        drawSearchlight(context, frame, stage, view, beamTexture);
        drawAttention(context, frame, stage, view);
        drawDoorSignals(context, stage, view);
        drawGuidance(context, view);
        drawMarkerScan(context, frame, view, scanTexture);
        drawDamage(context, view);
        drawImpact(context, view);
        drawRepair(context, view);
      }
      const canvas = frame.output;
      canvas.dataset.v034Phase = view.phase;
      canvas.dataset.v034Seconds = view.seconds.toFixed(2);
      canvas.dataset.v034SourceWorldMs = view.sourceWorldMs.toFixed(0);
      canvas.dataset.v034SourceModelMs = view.sourceModelMs.toFixed(0);
      canvas.dataset.v034Outcome = view.actor.outcome ?? 'pending';
      canvas.dataset.v034Integrity = String(view.integrity);
      canvas.dataset.v034RepairSpent = String(view.repairSpent);
      canvas.dataset.v034Beacon = String(view.facilities.beacon.guiding);
      canvas.dataset.v034Gate = String(view.facilities.gate.holding);
      canvas.dataset.v034Observation = String(view.observations.length);
      const light = v034NightLightState(view, stage, frame.ship);
      canvas.dataset.v034LightStrength = light.night.toFixed(3);
      canvas.dataset.v034BeamStrength = light.beam.toFixed(3);
      canvas.dataset.v034LightTargetX = light.target.x.toFixed(2);
      canvas.dataset.v034LightTargetY = light.target.y.toFixed(2);
      canvas.dataset.v034WorkLightPower = relight.work.toFixed(3);
      if (view.repair.active) {
        const tool = v034RepairTool(view);
        canvas.dataset.v034RepairGripX = tool.grip.x.toFixed(2);
        canvas.dataset.v034RepairGripY = tool.grip.y.toFixed(2);
        canvas.dataset.v034RepairTipX = tool.tip.x.toFixed(2);
        canvas.dataset.v034RepairTipY = tool.tip.y.toFixed(2);
      }
    },
  };
}

export function createV034NightReview(
  preset: V034NightPreset = 'basic',
  options: V034NightOptions = {},
  sceneOptions: V034NightSceneOptions = {},
) {
  const model = createV034NightModel(preset, options);
  return {
    ...model,
    get duration() {return model.duration;},
    extension: createV034NightScene(model, sceneOptions),
  };
}
