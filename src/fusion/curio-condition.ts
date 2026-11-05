import {itemCenter, type Exhibit} from '../render/museum-layout';
import {createReceiptRestorationAssets, receiptRestorationRegistration} from '../render/receipt-restoration';
import {restorationBrushPose, restorationBrushToolTransform} from '../render/restoration-brush';
import robotUrl from '../../assets/runtime/robot-empty-v3.webp';
import {drawLocalCurioRig} from './curio-local-rig';

export type CurioState = {condition: 'found' | 'clean' | 'stabilized'; action?: {kind: 'clean' | 'repair'; startedAt: number; endsAt: number}};
type Point = {x: number; y: number};
interface RepairSite extends Point {width: number; height: number; angle: number}
interface Material {
  original: HTMLCanvasElement;
  image: HTMLCanvasElement;
  mud: HTMLCanvasElement;
  remainingMud: HTMLCanvasElement;
  solid: Point[];
  rows: ({left: number; right: number} | undefined)[];
  revision: string;
}
const repairs: Record<string, RepairSite[]> = {
  tape: [{x: 40, y: 144, width: 27, height: 12, angle: -.42}, {x: 73, y: 126, width: 18, height: 9, angle: -.6}],
  nested: [{x: 47, y: 96, width: 31, height: 11, angle: .54}, {x: 143, y: 97, width: 31, height: 11, angle: -.52}],
  stamp: [{x: 100, y: 78, width: 29, height: 12, angle: .42}, {x: 87, y: 105, width: 26, height: 10, angle: .42}],
  'cosmic-parcel': [{x: 27, y: 91, width: 33, height: 13, angle: 1.4}, {x: 161, y: 145, width: 30, height: 13, angle: -.5}],
  bell: [{x: 45, y: 154, width: 28, height: 12, angle: .24}, {x: 146, y: 153, width: 28, height: 12, angle: -.24}],
};
const materials = new WeakMap<HTMLImageElement, Material>();
const make = () => {const canvas = document.createElement('canvas');canvas.width = canvas.height = 192;return canvas;};
let tools: ReturnType<typeof createReceiptRestorationAssets> | undefined;
let toolsLoaded = false;
let toolRobot: HTMLImageElement | undefined;
let toolsPromise: Promise<void> | undefined;

export function prepareCurioTools() {
  if (!toolsPromise) {
    tools = createReceiptRestorationAssets();
    toolRobot = new Image();toolRobot.src = robotUrl;
    toolsPromise = Promise.all([...Object.values(tools), toolRobot].map(image => image.decode())).then(() => {toolsLoaded = true;});
  }
  return toolsPromise;
}

function materialFor(image: HTMLImageElement) {
  const cached = materials.get(image);
  if (cached) return cached;
  const original = make(), context = original.getContext('2d')!;
  const scale = 192 / Math.max(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, (192 - image.naturalWidth * scale) / 2, (192 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  const alpha = context.getImageData(0, 0, 192, 192).data;
  const solid: Point[] = [];
  const rows = Array.from({length: 192}, (_, y) => {
    let left = 192, right = 0;
    for (let x = 0; x < 192; x++) {
      if (alpha[(y * 192 + x) * 4 + 3] < 210) continue;
      left = Math.min(left, x);right = Math.max(right, x + 1);
      if (x % 2 === 0 && y % 2 === 0) solid.push({x, y});
    }
    return right > left ? {left, right} : undefined;
  });
  const material = {original, image: make(), mud: make(), remainingMud: make(), solid, rows, revision: ''};
  materials.set(image, material);
  return material;
}

function sweepPoint(material: Material, pass: number, progress: number): Point {
  const y = 12 + pass * 24;
  const row = material.rows[Math.min(191, y)];
  const left = (row?.left ?? 65) - 8, right = (row?.right ?? 127) + 8;
  return {x: pass % 2 === 0 ? left + (right - left) * progress : right - (right - left) * progress, y};
}

function cleaningPose(material: Material, progress: number) {
  const pose = restorationBrushPose(progress);
  const sweep = Math.min(1, pose.local / .72);
  let point = sweepPoint(material, pose.pass, sweep);
  if (pose.local >= .72 && pose.pass < 7) {
    const next = sweepPoint(material, pose.pass + 1, 0);
    const transit = (pose.local - .72) / .28;
    point = {x: point.x + (next.x - point.x) * transit, y: point.y + (next.y - point.y) * transit};
  }
  return {...pose, point};
}

function drawFibrePatch(context: CanvasRenderingContext2D, site: RepairSite, installed: number, back: boolean) {
  if (!tools || !toolsLoaded || installed <= 0) return;
  const target = receiptRestorationRegistration().receipt.patchTargets.lower.srcRect;
  const descent = (1 - installed) * 13;
  context.save();context.translate(site.x - descent * .2, site.y - descent);context.rotate(site.angle);
  const width = site.width * (back ? 1.12 : 1), height = site.height * (back ? 1.2 : 1);
  context.drawImage(back ? tools.patchBack : tools.patchFront, target.x - 1, target.y - 1, target.width + 2, target.height + 2, -width / 2, -height / 2, width, height);
  context.restore();
}

/** The original mud texture is erased only by the same contact sweeps that drive the fan. */
export function prepareCurioMaterial(image: HTMLImageElement, state: CurioState, now: number, id: string) {
  const material = materialFor(image);
  const phase = state.action ? Math.min(1, Math.max(0, (now - state.action.startedAt) / (state.action.endsAt - state.action.startedAt))) : 0;
  const repaired = state.condition === 'stabilized' ? 1 : state.action?.kind === 'repair' ? phase : 0;
  const revision = `${id}/${state.condition}/${state.action?.kind ?? ''}/${state.action ? Math.round(phase * 120) : 0}/${toolsLoaded}`;
  if (material.revision !== revision) {
    const painter = material.image.getContext('2d')!;
    painter.clearRect(0, 0, 192, 192);
    const sites = repairs[id] ?? [];
    for (const [index, site] of sites.entries()) drawFibrePatch(painter, site, Math.min(1, Math.max(0, (repaired - index * .45) / .48)), true);
    painter.drawImage(material.original, 0, 0);
    // Small open seams remain visible after cleaning and are bridged by the saved fibre repairs.
    if (repaired < 1) {
      painter.save();painter.globalCompositeOperation = 'destination-out';painter.lineWidth = 2.5 * (1 - repaired);
      for (const site of sites) {
        painter.save();painter.translate(site.x, site.y);painter.rotate(site.angle);
        painter.beginPath();painter.moveTo(-site.width * .32, -2);painter.lineTo(0, 1);painter.lineTo(site.width * .32, -1);painter.stroke();painter.restore();
      }
      painter.restore();
    }
    if (state.condition === 'found' && toolsLoaded && tools) {
      const dirt = material.mud.getContext('2d')!;
      dirt.clearRect(0, 0, 192, 192);
      dirt.globalAlpha = .88;
      dirt.drawImage(tools.mud, 0, 0, 192, 192);
      dirt.drawImage(tools.mud, 28, 2, 220, 234, 92, 42, 110, 135);
      dirt.globalAlpha = 1;dirt.globalCompositeOperation = 'destination-in';dirt.drawImage(material.original, 0, 0);dirt.globalCompositeOperation = 'source-over';
      const remaining = material.remainingMud.getContext('2d')!;
      remaining.clearRect(0, 0, 192, 192);remaining.drawImage(material.mud, 0, 0);
      if (state.action?.kind === 'clean') {
        remaining.save();remaining.globalCompositeOperation = 'destination-out';remaining.lineCap = 'round';remaining.lineWidth = 34;
        for (let pass = 0; pass < 8; pass++) {
          const amount = Math.min(1, Math.max(0, (phase * 8 - pass) / .72));
          if (!amount) continue;
          const start = sweepPoint(material, pass, 0), end = sweepPoint(material, pass, amount);
          remaining.beginPath();remaining.moveTo(start.x, start.y);remaining.lineTo(end.x, end.y);remaining.stroke();
        }
        remaining.restore();
      }
      painter.drawImage(material.remainingMud, 0, 0);
    }
    for (const [index, site] of sites.entries()) drawFibrePatch(painter, site, Math.min(1, Math.max(0, (repaired - index * .45) / .48)), false);
    material.revision = revision;
  }
  return {...material, phase, repaired, size: 192 as const};
}

export interface CurioPoseOptions {
  seconds?: number;
  trial?: number;
  reducedMotion?: boolean;
  serviceEnvelope?: number;
  drawAbility?: (context: CanvasRenderingContext2D, image: HTMLCanvasElement) => boolean;
}

function toolArm(context: CanvasRenderingContext2D, grip: Point, claw = false) {
  if (!toolRobot) return;
  if (claw) {
    context.drawImage(toolRobot, 189, 272, 32, 31, grip.x - 8, grip.y - 7, 16, 16);
    return;
  }
  const elbow = {x: Math.max(160, grip.x + 24), y: grip.y + 31};
  for (const [from, to] of [[{x: 199, y: 177}, elbow], [elbow, grip]]) {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    context.save();context.translate(from.x, from.y);context.rotate(Math.atan2(to.y - from.y, to.x - from.x) - Math.PI / 2);
    context.drawImage(toolRobot, 411, 245, 26, 40, -6, -3, 12, length + 6);context.restore();
  }
  context.drawImage(toolRobot, 413, 247, 23, 23, elbow.x - 7, elbow.y - 7, 14, 14);
}

function drawTool(context: CanvasRenderingContext2D, material: Material, state: CurioState, phase: number, id: string) {
  if (!tools || !toolsLoaded || !state.action || phase >= 1) return;
  const registration = receiptRestorationRegistration().tools;
  if (state.action.kind === 'clean') {
    const pose = cleaningPose(material, phase), matrix = restorationBrushToolTransform(pose.pressure);
    const grip = {x: pose.point.x + matrix.handleGrip.x * .48, y: pose.point.y - pose.lift * .55 + matrix.handleGrip.y * .48};
    toolArm(context, grip);
    context.save();context.translate(pose.point.x, pose.point.y - pose.lift * .55);context.scale(.48, .48);
    context.save();context.transform(matrix.bristles.a, matrix.bristles.b, matrix.bristles.c, matrix.bristles.d, matrix.bristles.e, matrix.bristles.f);
    context.drawImage(tools.brushBristles, 0, 0);context.restore();
    context.drawImage(tools.brushHandle, matrix.handleOrigin.x, matrix.handleOrigin.y);context.restore();toolArm(context, grip, true);
    return;
  }
  const sites = repairs[id] ?? [];
  const index = phase < .5 ? 0 : 1, site = sites[index];
  if (!site) return;
  const local = phase * 2 - index;
  const press = Math.min(1, local / .23) * (1 - Math.max(0, (local - .72) / .28));
  const tool = registration.spatula;
  const tip = {x: site.x + (1 - press) * 20, y: site.y - (1 - press) * 18};
  const offset = {x: (tool.pivot.x - tool.contact.x) * .33, y: (tool.pivot.y - tool.contact.y) * .33};
  const grip = {x: tip.x + offset.x * Math.cos(-.16) - offset.y * Math.sin(-.16), y: tip.y + offset.x * Math.sin(-.16) + offset.y * Math.cos(-.16)};
  toolArm(context, grip);
  context.save();context.translate(tip.x, tip.y);context.rotate(-.16);context.scale(.33, .33);
  context.drawImage(tools.spatula, -tool.contact.x, -tool.contact.y);context.restore();toolArm(context, grip, true);
}

/** Registered specimen material and local joints remain behind the real foreground glass. */
export function drawCurioSpecimen(context: CanvasRenderingContext2D, exhibit: Exhibit, image: HTMLImageElement, state: CurioState, now: number, options: CurioPoseOptions = {}) {
  const material = prepareCurioMaterial(image, state, now, exhibit.id);
  const center = itemCenter(exhibit), size = exhibit.item.size * exhibit.scale;
  context.save();context.translate(center.x, center.y);context.scale(size / 192, size / 192);context.translate(-96, -96);
  if (state.action) context.drawImage(material.image, 0, 0);
  else if (!options.drawAbility?.(context, material.image)) drawLocalCurioRig(context, exhibit.id, material.image, material.revision, options.seconds ?? now / 1000,
    (options.trial ?? 0) * (options.serviceEnvelope ?? 1), options.reducedMotion, options.serviceEnvelope ?? 1, material.repaired);
  drawTool(context, material, state, material.phase, exhibit.id);
  context.restore();
}
