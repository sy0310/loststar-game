import backUrl from '../../assets/runtime/v036/fog-back.webp';
import bodyUrl from '../../assets/runtime/v036/fog-body.webp';
import rimUrl from '../../assets/runtime/v036/fog-rim.webp';
import {newGame} from '../game/engine';
import {createAssist, consumeAssistWork, assistRules, type AssistState} from '../game/assist';
import {createFusion} from '../fusion/domain';
import {createSortingScene} from '../fusion/sorting-scene';
import {PlanetTapGesture, type TapPointer} from '../fusion/tap-gesture';
import {ExpeditionScene, type SceneExtension, type SceneFrame} from '../render/scene';
import {robotPose} from '../render/motion';
import {createDailyResidentRenderer} from '../render/v034-residents';
import {residentDailyPose} from './resident-daily';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {const t = clamp(value);return t * t * (3 - 2 * t);};
const mix = (from: number, to: number, fraction: number) => from + (to - from) * smooth(fraction);
export const V036_FOG_DURATION_MS = 18000;
export const V036_FOG_SITE = {x: 410, y: 315, id: 'parcel/old-sorting'} as const;

export interface V036FogState {
  elapsedMs: number;
  workMs: number;
  assist: AssistState;
  rejected: number;
}

/** Visual review state is memory-only. It never loads or settles a player archive. */
export function createV036FogState(): V036FogState {
  return {elapsedMs: 0, workMs: 0, assist: createAssist(), rejected: 0};
}

export function advanceV036Fog(state: V036FogState, deltaMs: number): V036FogState {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return state;
  const assist = {...state.assist};
  const applied = state.workMs < V036_FOG_DURATION_MS ? consumeAssistWork(assist, deltaMs) : 0;
  return {...state, elapsedMs: state.elapsedMs + deltaMs,
    workMs: Math.min(V036_FOG_DURATION_MS, state.workMs + deltaMs + applied), assist};
}

export function tapV036Fog(state: V036FogState): {state: V036FogState; accepted: boolean} {
  const assist = state.assist;
  const at = state.elapsedMs;
  const recent = assist.acceptedAt.filter(time => time > at - assistRules.windowMs);
  const accepted = state.workMs < 14000 && assist.pendingWorkMs + assistRules.workPerTapMs <= assistRules.capacityMs
    && (!recent.length || at - recent[recent.length - 1] >= assistRules.intervalMs)
    && recent.length < assistRules.tapsPerWindow;
  if (!accepted) return {state: {...state, rejected: state.rejected + 1}, accepted};
  return {accepted, state: {...state, assist: {...assist,
    pendingWorkMs: assist.pendingWorkMs + assistRules.workPerTapMs,
    acceptedAt: [...recent, at], actionSeq: assist.actionSeq + 1,
    enqueuedWorkMs: assist.enqueuedWorkMs + assistRules.workPerTapMs}}};
}

export function v036FogFrame(workMs: number) {
  const seconds = Math.max(0, workMs) / 1000;
  const phase = seconds < 6.5 ? 'undetected' : seconds < 10.5 ? 'scanning'
    : seconds < 14.5 ? 'clearing' : seconds < 18 ? 'approaching' : 'revealed';
  const scan = clamp((seconds - 6.5) / 4);
  const reveal = smooth((seconds - 10.5) / 4);
  const labels = {
    undetected: '一团星雾，挡住了纸路。', scanning: '咔哒正在扫描，轻点可助力。',
    clearing: '光从雾里穿过去了。', approaching: '旧分拣区 · 咔哒正在靠近。',
    revealed: '纸路找到了，卡住的故事还在。',
  };
  return {seconds, phase, scan, reveal, progress: clamp(seconds / 18), status: labels[phase]};
}

/** A curved ground route reaches the same registered machine used by the playable branch. */
export function v036FogRobot(workMs: number): ReturnType<typeof robotPose> {
  const second = workMs / 1000;
  const base = robotPose(.34);
  let x = 327, y = 454;
  let action: ReturnType<typeof robotPose>['action'] = 'walk';
  if (second < 2) action = 'scan';
  else if (second < 4) {x = mix(327, 441, (second - 2) / 2);y = mix(454, 432, (second - 2) / 2);}
  else if (second < 6.5) {x = mix(441, 507, (second - 4) / 2.5);y = mix(432, 376, (second - 4) / 2.5);}
  else if (second < 14.5) {x = 507;y = 376;action = 'scan';}
  else {x = mix(507, 457, (second - 14.5) / 3.5);y = mix(376, 333, (second - 14.5) / 3.5);action = second >= 18 ? 'scan' : 'walk';}
  return {...base, x, y, action, facing: second < 6.5 ? 'right' : 'left', carrying: false,
    parcel: {...base.parcel, x: 410, y: 272, visible: false, held: false, delivered: false}};
}

function load(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();image.onload = () => resolve(image);image.onerror = reject;image.src = url;
  });
}

export function mountV036Fog(root: HTMLElement) {
  root.innerHTML = '<div class="v036-world"></div><p class="v036-status" role="status">正在接通地表画面…</p><div class="v036-track" aria-label="星雾观察进度"><i></i></div>';
  const worldRoot = root.querySelector<HTMLElement>('.v036-world')!;
  const status = root.querySelector<HTMLElement>('.v036-status')!;
  const progress = root.querySelector<HTMLElement>('.v036-track i')!;
  let state = createV036FogState();
  let paused = false, destroyed = false, assetReady = false;
  let assetError: string | null = null;
  let previous = 0, drawnAt = 0, requestedFrame = 0;
  let contact: {x: number; y: number; at: number; accepted: boolean | null} | null = null;
  let art: HTMLImageElement[] = [];
  const intervals: number[] = [], drawTimes: number[] = [];
  const touchSamples: {at: number; firstDrawAt?: number; firstDrawMs?: number;
    acceptedAt?: number; acceptedDrawAt?: number; acceptedDrawMs?: number}[] = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const game = newGame(0);
  game.collection = ['mouse', 'hermit', 'tagbird'];
  const fusion = createFusion(0);
  fusion.progression.sorting.phase = 'observed';
  const machine = createSortingScene(() => fusion);
  const daily = createDailyResidentRenderer();
  const layers: HTMLCanvasElement[] = [];
  const groundLight = document.createElement('canvas');groundLight.width = 160;groundLight.height = 88;
  const groundBounds = {x: V036_FOG_SITE.x - 160, y: V036_FOG_SITE.y - 90, width: 320, height: 176};
  let groundLightReady = false;
  const ready = Promise.all([Promise.all([backUrl, bodyUrl, rimUrl].map(load)), machine.ready, daily.ready])
    .then(([images]) => {
      art = images;
      for (let i = 0; i < 3; i++) {const canvas = document.createElement('canvas');canvas.width = 256;canvas.height = 192;layers.push(canvas);}
    }).catch(error => {
      if (!destroyed) {
        assetError = '星雾素材未接通，请刷新重试';
        status.textContent = assetError;root.dataset.error = 'true';
      }
      throw error;
    });

  function groundResponse(context: CanvasRenderingContext2D, frame: SceneFrame) {
    const strength = 1 - v036FogFrame(state.workMs).reveal;
    if (strength <= 0) return;
    if (!groundLightReady) {
      const painter = groundLight.getContext('2d')!;
      painter.imageSmoothingEnabled = false;
      // Reuse the real terrain pixels and their alpha silhouette. Lighting is
      // cached at a two-world-pixel scale, with no rectangular tint in space.
      painter.drawImage(frame.globe, (52 - groundBounds.x) / 2, (70 - groundBounds.y) / 2, 332, 332);
      const material = painter.getImageData(0, 0, groundLight.width, groundLight.height);
      for (let y = 0; y < groundLight.height; y++) for (let x = 0; x < groundLight.width; x++) {
        const index = (y * groundLight.width + x) * 4;
        if (!material.data[index + 3]) continue;
        const worldX = groundBounds.x + x * 2, worldY = groundBounds.y + y * 2;
        const contact = Math.max(0, 1 - Math.hypot((worldX - V036_FOG_SITE.x) / 126,
          (worldY - V036_FOG_SITE.y - 11) / 37)) ** 2 * .42;
        const leftBounce = Math.max(0, 1 - Math.hypot((worldX - V036_FOG_SITE.x + 106) / 67,
          (worldY - V036_FOG_SITE.y + 11) / 57)) ** 2;
        const rightBounce = Math.max(0, 1 - Math.hypot((worldX - V036_FOG_SITE.x - 111) / 66,
          (worldY - V036_FOG_SITE.y - 8) / 48)) ** 2;
        const bounce = Math.max(leftBounce, rightBounce) * .23;
        const weight = contact + bounce;
        if (weight === 0) {material.data[index + 3] = 0;continue;}
        const shadowTint = [.43, .36, .76];
        const reflectedTint = [.56, .34, .88];
        for (let channel = 0; channel < 3; channel++) {
          const original = material.data[index + channel];
          const shadow = original * shadowTint[channel];
          const reflection = original + (255 - original) * reflectedTint[channel];
          material.data[index + channel] = (shadow * contact + reflection * bounce) / weight;
        }
        material.data[index + 3] *= weight;
      }
      painter.putImageData(material, 0, 0);groundLightReady = true;
    }
    context.save();context.globalAlpha = strength;
    context.drawImage(groundLight, groundBounds.x, groundBounds.y, groundBounds.width, groundBounds.height);
    context.restore();
  }

  function cloud(context: CanvasRenderingContext2D) {
    const frame = v036FogFrame(state.workMs);
    if (frame.reveal >= 1 || !art.length) return;
    // Three registered volumes overlap vertically, so the upper shell and lower
    // paper path are genuinely hidden without stretching a thin cloud sheet.
    const anchors = [{x: 408, y: 283}, {x: 413, y: 315}, {x: 407, y: 325}];
    for (let index = 0; index < 3; index++) {
      const canvas = layers[index], c = canvas.getContext('2d')!;
      c.clearRect(0, 0, 256, 192);c.imageSmoothingEnabled = false;c.drawImage(art[index], 0, 0);
      const opening = clamp(frame.reveal * 1.25 - index * .1);
      if (opening > 0) {
        c.globalCompositeOperation = 'destination-out';
        // An irregular expanding aperture follows the swept scanner. Its edge
        // consumes opaque pixels first, leaving independent moving wisps.
        for (let row = 0; row < 192; row += 3) for (let col = 0; col < 256; col += 3) {
          const nx = (col - 128) / 151, ny = (row - 104) / 73;
          const ripple = Math.sin(col * .073 + row * .091 + index * 1.3) * .075;
          if (Math.hypot(nx, ny) + ripple < opening * 2.4) c.fillRect(col, row, 3, 3);
        }
        c.globalCompositeOperation = 'source-over';
      }
      const breath = reduced.matches ? 0 : Math.sin(state.elapsedMs / (1400 + index * 430) + index * 2);
      const separation = frame.reveal * (index === 1 ? 0 : index === 0 ? -26 : 32);
      const width = 270 + breath * 3;
      context.save();context.translate(anchors[index].x + separation, anchors[index].y - frame.reveal * (12 + index * 5));
      context.rotate(reduced.matches ? 0 : breath * .008 + frame.reveal * (index - 1) * .045);
      context.drawImage(canvas, -width / 2, -170 / 256 * width, width, 192 / 256 * width);
      context.restore();
    }
  }

  function scanner(context: CanvasRenderingContext2D, frame: SceneFrame) {
    const view = v036FogFrame(state.workMs);
    if (view.phase !== 'scanning' && view.phase !== 'clearing') return;
    // The cyan emitter of atlas frame 4 is at native (29,82). Register it
    // through the exact same 144/160 scale and sprite origin as drawRobot.
    const source = {x: frame.robot.x - 144 * .54 + 29 * 144 / 160,
      y: frame.robot.y - 144 * .97 + 82 * 144 / 160};
    const target = {x: 410 + Math.sin(view.seconds * 1.7) * 47, y: 254 + Math.sin(view.seconds * 3.4) * 16};
    context.save();context.globalCompositeOperation = 'screen';
    context.fillStyle = '#ddceb52e';context.beginPath();context.moveTo(source.x, source.y);
    context.lineTo(target.x - 13, target.y - 7);context.lineTo(target.x + 13, target.y + 7);context.closePath();context.fill();
    context.strokeStyle = '#c5e1c8cc';context.lineWidth = 2;context.beginPath();context.moveTo(source.x, source.y);context.lineTo(target.x, target.y);context.stroke();
    context.fillStyle = '#f6e1b5';context.fillRect(Math.round(target.x) - 2, Math.round(target.y) - 2, 4, 4);
    context.strokeStyle = '#ead5be99';context.beginPath();context.ellipse(target.x, target.y, 13, 5, -.25, 0, Math.PI * 2);context.stroke();
    for (let index = 0; index < 2; index++) {
      const wave = (state.elapsedMs / 1100 + index * .5) % 1;
      context.globalAlpha = (1 - wave) * .7;
      context.strokeStyle = '#c8d8e5';context.lineWidth = 1.5;
      context.beginPath();context.ellipse(target.x, target.y, 14 + wave * 23, 6 + wave * 10, -.25, 0, Math.PI * 2);context.stroke();
    }
    context.restore();
  }

  function localFeedback(context: CanvasRenderingContext2D, frame: SceneFrame) {
    if (!contact) return;
    const age = state.elapsedMs - contact.at;
    if (age > 650) {contact = null;return;}
    const robot = {x: frame.robot.x - 48, y: frame.robot.y - 76};
    const fraction = clamp(age / 650);
    const sample = touchSamples.at(-1);
    if (sample && sample.firstDrawAt === undefined) {
      sample.firstDrawAt = performance.now();sample.firstDrawMs = sample.firstDrawAt - sample.at;
    }
    if (sample && sample.acceptedAt !== undefined && sample.acceptedDrawAt === undefined) {
      sample.acceptedDrawAt = performance.now();sample.acceptedDrawMs = sample.acceptedDrawAt - sample.acceptedAt;
    }
    context.save();context.globalAlpha = 1 - fraction;
    context.strokeStyle = contact.accepted === false ? '#aa93b5' : '#efc897';context.lineWidth = 2;
    context.beginPath();context.ellipse(contact.x, contact.y, 5 + fraction * 20, 3 + fraction * 9, 0, 0, Math.PI * 2);context.stroke();
    if (contact.accepted) {
      const bead = clamp(age / 350);
      const x = mix(contact.x, robot.x, bead), y = mix(contact.y, robot.y, bead);
      context.fillStyle = '#f6d69e';context.fillRect(x - 2, y - 2, 4, 4);
    }
    context.restore();
  }

  const extension: SceneExtension = {
    ready,
    cycleFraction: () => .34,
    robotPose: () => v036FogRobot(state.workMs),
    drawRobot: (context, frame, atlas) => {
      const robot = frame.robot;
      const moving = robot.action === 'walk';
      const pose = moving ? Math.floor(frame.t * 8) % 4 : 4;
      const bob = moving && !reduced.matches ? Math.round(Math.sin(frame.t * 16)) : 0;
      context.save();context.fillStyle = '#43243e73';context.beginPath();
      context.ellipse(robot.x, robot.y + 1, 31, 31 * .24, 0, 0, Math.PI * 2);context.fill();
      context.translate(Math.round(robot.x), Math.round(robot.y + bob));
      if (moving && robot.facing === 'right') context.scale(-1, 1);
      context.drawImage(atlas, pose % 4 * 160, Math.floor(pose / 4) * 160, 160, 160, -144 * .54, -144 * .97, 144, 144);
      context.restore();
      return true;
    },
    environment: () => ({period: 'day', rest: 0, light: 0, seconds: state.elapsedMs / 1000}),
    drawResident: daily.draw,
    residentPose: residentDailyPose,
    worldEntities: (context, frame) => [
      {depth: 293, draw: () => groundResponse(context, frame)},
      ...machine.entities(context, frame),
      {depth: 340, draw: () => cloud(context)},
      {depth: frame.robot.y + .1, draw: () => scanner(context, frame)},
    ],
    afterWorld: (context, frame) => {
      if (!assetReady) {
        assetReady = true;previous = performance.now();scene.setActive(false);
      }
      localFeedback(context, frame);
      frame.output.dataset.fogPhase = v036FogFrame(state.workMs).phase;
    },
  };
  const scene = new ExpeditionScene(worldRoot, () => game, extension);
  scene.canvas.setAttribute('aria-label', '退货箱星局部星雾观察样板，轻点为咔哒扫描助力');
  scene.canvas.style.touchAction = 'pan-y';
  scene.setActive(true);
  scene.freeze(0);
  const gesture = new PlanetTapGesture();
  const pointer = (event: PointerEvent): TapPointer => ({id: event.pointerId, primary: event.isPrimary,
    button: event.button, x: event.clientX, y: event.clientY, at: performance.now(), scroll: `${scrollX}/${scrollY}`});
  function down(event: PointerEvent) {
    const hit = assetReady ? scene.pickAtClient(event.clientX, event.clientY) : null;
    const eligible = hit?.kind === 'planet' || hit?.kind === 'site';
    gesture.down(pointer(event), eligible && assetReady && !paused && !destroyed && document.visibilityState === 'visible');
    if (!eligible || !assetReady || paused || !event.isPrimary || event.button !== 0) return;
    const box = scene.canvas.getBoundingClientRect();
    contact = {x: (event.clientX - box.left) / box.width * 832 - 32,
      y: (event.clientY - box.top) / box.height * 740, at: state.elapsedMs, accepted: null};
    touchSamples.push({at: performance.now()});
    if (touchSamples.length > 60) touchSamples.shift();
  }
  function move(event: PointerEvent) {gesture.move(pointer(event));}
  function up(event: PointerEvent) {
    if (!gesture.up(pointer(event)) || paused || !assetReady) return;
    const result = tapV036Fog(state);state = result.state;
    if (contact) contact.accepted = result.accepted;
    const sample = touchSamples.at(-1);
    if (result.accepted && sample) sample.acceptedAt = performance.now();
  }
  function cancel(event: PointerEvent) {gesture.pointerCancel(event.pointerId);contact = null;}
  const canvas = scene.canvas;
  canvas.addEventListener('pointerdown', down);canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);canvas.addEventListener('pointercancel', cancel);
  const onVisibility = () => {previous = 0;drawnAt = 0;gesture.reset();contact = null;};
  document.addEventListener('visibilitychange', onVisibility);

  function loop(now: number) {
    if (destroyed) return;
    requestedFrame = requestAnimationFrame(loop);
    if (!scene.ready) return;
    if (!assetReady) {assetReady = true;scene.setActive(false);previous = now;}
    const stopped = paused || document.visibilityState !== 'visible';
    if (stopped) {previous = now;drawnAt = 0;return;}
    const delta = previous ? now - previous : 0;previous = now;
    state = advanceV036Fog(state, delta);
    const interval = reduced.matches ? 1000 / 30 : 1000 / 60;
    if (drawnAt && now - drawnAt < interval - .5) return;
    if (drawnAt) {intervals.push(now - drawnAt);if (intervals.length > 1200) intervals.shift();}
    drawnAt = now;
    const began = performance.now();scene.freeze(state.elapsedMs / 1000);drawTimes.push(performance.now() - began);
    if (drawTimes.length > 1200) drawTimes.shift();
    const frame = v036FogFrame(state.workMs);
    status.textContent = frame.status;progress.style.width = `${frame.progress * 100}%`;
    root.dataset.phase = frame.phase;
  }
  requestedFrame = requestAnimationFrame(loop);

  return {
    replay() {
      state = createV036FogState();previous = 0;drawnAt = 0;contact = null;gesture.reset();
      if (assetReady) scene.freeze(0);
    },
    pause(value: boolean) {paused = value;previous = 0;drawnAt = 0;gesture.reset();contact = null;},
    metrics() {return {ready: assetReady, elapsed: state.elapsedMs, workElapsed: state.workMs,
      assetError,
      phase: v036FogFrame(state.workMs).phase, paused, hidden: document.visibilityState !== 'visible',
      drawIntervals: [...intervals], drawTimes: [...drawTimes], reducedMotion: reduced.matches,
      assist: {...state.assist, acceptedAt: [...state.assist.acceptedAt]}, rejected: state.rejected,
      robot: v036FogRobot(state.workMs), target: {...V036_FOG_SITE},
      stateStorage: 'memory-only', rewards: 0, walletWrites: 0,
      fogDecodedTextureBytes: art.reduce((sum, image) => sum + image.naturalWidth * image.naturalHeight * 4, 0),
      groundRelightDecodedTextureBytes: groundLight.width * groundLight.height * 4,
      inputSamples: touchSamples.map(sample => ({...sample})),
      inputDrawLatencyMs: touchSamples.flatMap(sample => sample.firstDrawMs === undefined ? [] : [sample.firstDrawMs]),
      inputTimingEndpoint: 'Canvas draw call, before browser presentation'};},
    destroy() {
      destroyed = true;cancelAnimationFrame(requestedFrame);scene.destroy();
      canvas.removeEventListener('pointerdown', down);canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);canvas.removeEventListener('pointercancel', cancel);
      document.removeEventListener('visibilitychange', onVisibility);root.replaceChildren();
    },
  };
}
