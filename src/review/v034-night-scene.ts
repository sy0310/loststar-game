import invaderUrl from '../../assets/runtime/invader-v02.webp';
import {worldView} from '../game/world';
import {guardLayer} from '../render/guard-scene';
import type {SceneExtension, SceneFrame} from '../render/scene';
import {nightCamera, nightDoor} from './d1-motion';
import {createNightStudy} from './night-scene';
import {
  createV034NightModel,
  type V034NightModel,
  type V034NightOptions,
  type V034NightPreset,
  type V034NightSnapshot,
} from './v034-night-model';
import {v034BlendFromPatrol, v034Escape, v034NightStage, v034RepairTool} from './v034-night-stage';

const marker = {x: 408, y: 389, width: 43, height: 18};

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
) {
  if (view.phase !== 'identify') return;
  const stage = v034NightStage(view);
  const observed = view.observations.some(item => item.evidenceId === 'field-pipe-scan');
  const floor = marker.y + marker.height;
  context.save();
  context.fillStyle = '#abd9c42b';
  context.beginPath();
  context.moveTo(stage.robot.x - 48, stage.robot.y - 66);
  context.lineTo(marker.x - 3, floor);
  context.lineTo(marker.x + marker.width + 3, floor);
  context.closePath();
  context.fill();
  const scanY = marker.y + 2 + ((frame.t * 1.7) % 1) * (marker.height - 4);
  context.fillStyle = observed ? '#dbf4c9' : '#a5d9c5';
  context.fillRect(marker.x + 3, scanY, marker.width - 6, 1);
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
  context.lineWidth = 2;
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
  context.save();
  context.globalAlpha = 1 - age / 1.3;
  for (let index = 0; index < 7; index++) {
    const angle = index * 2.3;
    const distance = age * (12 + index * 3);
    context.fillStyle = index % 2 ? '#e9bd8f' : '#b67e91';
    context.fillRect(309 + Math.cos(angle) * distance, 393 + Math.sin(angle) * distance, 2, 3);
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
  for (let index = 0; index < 6; index++) {
    const phase = (view.repair.progress * 7.2 + index * .17) % 1;
    const angle = index * 2.1;
    context.globalAlpha = 1 - phase;
    context.fillStyle = index % 2 ? '#d6e6d6' : '#f3cd8d';
    context.fillRect(
      tool.tip.x + Math.cos(angle) * phase * 13,
      tool.tip.y + Math.sin(angle) * phase * 8,
      2,
      2,
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
export function createV034NightScene(model: V034NightModel): SceneExtension {
  let currentSeconds = 0;
  const paper = new Image();
  paper.src = invaderUrl;
  const patrol = guardLayer(() => {
    const state = model.getState(currentSeconds);
    return {
      ...worldView(state),
      station: state.station,
      research: state.research,
      at: state.lastAt,
      repairBay: 0,
    };
  }, {showEquipment: false, showSearchLine: false});
  const stageAt = (seconds: number) => {
    currentSeconds = seconds;
    const view = model.snapshot(seconds);
    const stage = v034NightStage(view);
    const previous = patrol.robotPose?.(stage.robot, seconds);
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
  }, stageAt, {idleCarrier: true});
  const ready = Promise.all([study.ready, paper.decode()]).then(() => {});
  void ready.catch(() => {});

  return {
    ready,
    camera: nightCamera,
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
      if (view.eventSeconds === null) return patrol.robotPose?.(base, seconds);
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
      if (view.eventSeconds === null) patrol.afterWorld(context, frame);
      else {
        study.afterWorld(context, frame);
        drawGuidance(context, view);
        drawMarkerScan(context, frame, view);
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
) {
  const model = createV034NightModel(preset, options);
  return {
    ...model,
    get duration() {return model.duration;},
    extension: createV034NightScene(model),
  };
}
