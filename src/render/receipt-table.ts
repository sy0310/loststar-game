import {restorationBrushPose as v036BrushPose, restorationBrushToolTransform as v036BrushToolTransform} from './restoration-brush';
export {restorationBrushPose as v036BrushPose, restorationBrushToolTransform as v036BrushToolTransform} from './restoration-brush';
import {
  createReceiptRestorationAssets,
  receiptRestorationRegistration,
  restorationMeshPoint,
  restorationPaperMesh,
  restorationPaperRig,
  type ReceiptRestorationAssets,
  type ReceiptRestorationDrawOptions,
  type ReceiptRestorationDrawResult,
} from './receipt-restoration';
import {receiptRestorationFrame, type ReceiptRestorationState} from '../review/receipt-restoration';
import {fitReceiptSpecimen, receiptSpecimenRegistration} from './receipt-specimen';
import caseBackUrl from '../../assets/runtime/case-receipt-back.webp';
import caseFrontUrl from '../../assets/runtime/case-receipt-front.webp';
import robotUrl from '../../assets/runtime/robot-empty-v3.webp';

const WIDTH = 640;
const HEIGHT = 700;
const PAPER_SIZE = 340;
const BRUSH_SCALE = .78;
const BRUSH_CONTACT_WIDTH = 42;
const RECEIVER = {x: 320, y: 490};
const DURATION = 28;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => {const p = clamp(value);return p * p * (3 - 2 * p);};
type Point = {x: number; y: number};

/** Project the measured receiver in the actual glass texture, including its asymmetric margins. */
export function v036ReceiptGlassPlacement(
  sourceSize = {width: 320, height: 320},
  target = RECEIVER,
  size = {width: 730, height: 540},
) {
  const floor = receiptSpecimenRegistration().common.floorReceivers.basic.sourceRect;
  const sourceReceiver = {x: floor.x + floor.width / 2, y: floor.y + floor.height / 2};
  const rect = {
    x: target.x - sourceReceiver.x / sourceSize.width * size.width,
    y: target.y - sourceReceiver.y / sourceSize.height * size.height,
    width: size.width, height: size.height,
  };
  const receiver = {
    x: rect.x + sourceReceiver.x / sourceSize.width * rect.width,
    y: rect.y + sourceReceiver.y / sourceSize.height * rect.height,
  };
  return {rect, sourceReceiver, sourceSize: {...sourceSize}, receiver};
}

export type V036ReceiptPhase = 'soil' | 'release' | 'support' | 'dirty' | 'cleaning'
  | 'clean' | 'repairing' | 'display' | 'trying' | 'complete';

/** A visual demonstration only. No wallet, evidence record, or archive is created. */
export function v036ReceiptFrame(seconds: number, trialSeconds?: number) {
  const time = Math.max(0, seconds);
  let phase: V036ReceiptPhase = 'soil';
  if (time >= 1.8) phase = 'release';
  if (time >= 4) phase = 'support';
  if (time >= 6.2) phase = 'dirty';
  if (time >= 8) phase = 'cleaning';
  if (time >= 14) phase = 'clean';
  if (time >= 15.5) phase = 'repairing';
  if (time >= 20) phase = 'display';
  if (time >= 23.5) phase = 'trying';
  if (time >= DURATION) phase = 'complete';
  if (trialSeconds !== undefined) phase = 'trying';
  const trial = trialSeconds === undefined ? clamp((time - 23.5) / 4.5) : clamp(trialSeconds / 4.5);
  return {
    phase,
    elapsed: Math.min(time, DURATION),
    release: ease((time - 1.8) / 2.2),
    support: ease((time - 3.8) / 2.4),
    cleaning: clamp((time - 8) / 6),
    upperPatch: ease((time - 15.8) / 1.25),
    lowerPatch: ease((time - 17.8) / 1.25),
    glass: ease((time - 20.2) / 2.9),
    trial,
    trying: (time >= 23.5 && time < DURATION) || trialSeconds !== undefined,
    originalCode: 'RET-031',
    missingSignature: true,
    evidenceCount: 0,
    flavorOnly: true,
  };
}

/** Persisted game actions select one approved material segment without advancing later work. */
export function v037ReceiptFrame(state: ReceiptRestorationState, seconds: number) {
  return v037ReceiptFrameFromRestoration(receiptRestorationFrame(state, seconds));
}

function v037ReceiptFrameFromRestoration(saved: ReceiptRestorationDrawOptions['restorationFrame']) {
  const time = saved.phase === 'excavating' ? saved.progress * 6.2
    : saved.phase === 'cleaning' ? 8 + saved.progress * 6
      : saved.phase === 'repairing' ? 15.5 + saved.progress * 4.5
        : saved.stage === 'buried' ? 0 : saved.condition === 'found' ? 7 : saved.condition === 'clean' ? 14.8 : 23.2;
  const frame = v036ReceiptFrame(time);
  if (saved.phase === 'repairing') {
    frame.upperPatch = ease(saved.progress / .38);frame.lowerPatch = ease((saved.progress - .46) / .38);frame.glass = ease((saved.progress - .82) / .18);
  }
  if (saved.phase === 'trying') {frame.phase = 'trying';frame.trying = true;frame.trial = saved.progress;}
  return frame;
}



function makeSurface(width = 256, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return {canvas, context: canvas.getContext('2d')!};
}

function drawTriangle(context: CanvasRenderingContext2D, texture: HTMLCanvasElement, source: Point[], target: Point[]) {
  const [a, b, d] = source;
  const [p, q, r] = target;
  const sx1 = b.x - a.x;
  const sy1 = b.y - a.y;
  const sx2 = d.x - a.x;
  const sy2 = d.y - a.y;
  const denominator = sx1 * sy2 - sx2 * sy1;
  const ax = ((q.x - p.x) * sy2 - (r.x - p.x) * sy1) / denominator;
  const bx = ((q.y - p.y) * sy2 - (r.y - p.y) * sy1) / denominator;
  const ay = ((r.x - p.x) * sx1 - (q.x - p.x) * sx2) / denominator;
  const by = ((r.y - p.y) * sx1 - (q.y - p.y) * sx2) / denominator;
  const center = {x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3};
  context.save();
  context.beginPath();
  target.forEach((point, index) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.max(.01, Math.hypot(dx, dy));
    const x = point.x + dx / length * 1.05;
    const y = point.y + dy / length * 1.05;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.clip();
  context.transform(ax, bx, ay, by, p.x - ax * a.x - ay * a.y, p.y - bx * a.x - by * a.y);
  context.drawImage(texture, 0, 0);
  context.restore();
}

export class V036ReceiptTable {
  private paper = makeSurface();
  private mud = makeSurface();
  private remainingMud = makeSurface();
  private ink = makeSurface();
  private patchBack = makeSurface();
  private patchFront = makeSurface();
  private mask = makeSurface();
  private composed = makeSurface();
  private dirtyBristles = makeSurface(192, 163);
  private fit;
  private rows: ({left: number; right: number} | undefined)[];
  private background?: HTMLImageElement;
  private registration = receiptRestorationRegistration();
  private lastCleaning = -1;
  private cleanCoverage = 0;
  public contact: {tool: string; x: number; y: number; pressed: boolean} | null = null;
  public lastMesh?: ReturnType<typeof restorationPaperMesh>;

  constructor(private assets: ReceiptRestorationAssets, private glassBack: HTMLImageElement, private glassFront: HTMLImageElement, private robot: HTMLImageElement, background?: HTMLImageElement) {
    this.background = background;
    const crop = this.registration.receipt.alphaBounds.visible16;
    this.fit = fitReceiptSpecimen(crop.width, crop.height, 256);
    for (const name of ['paper', 'mud', 'patchBack', 'patchFront', 'mask'] as const) {
      const target = this[name].context;
      const image = name === 'mask' ? assets.survivingMask : assets[name];
      target.imageSmoothingEnabled = false;
      target.globalAlpha = name === 'mud' ? .78 : 1;
      target.drawImage(image, crop.x, crop.y, crop.width, crop.height,
        128 + this.fit.left, 128 + this.fit.top, this.fit.width, this.fit.height);
      target.globalAlpha = 1;
    }
    const pixels = this.paper.context.getImageData(0, 0, 256, 256).data;
    this.rows = Array.from({length: 256}, (_, y) => {
      let left = 256;
      let right = 0;
      for (let x = 0; x < 256; x++) {
        if (pixels[(y * 256 + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
      return right > left ? {left, right} : undefined;
    });
    this.paintOriginalInk();
  }

  private paintOriginalInk() {
    const context = this.ink.context;
    context.textAlign = 'center';
    context.fillStyle = '#806455';
    context.font = 'bold 12px monospace';
    context.fillText('退货回执', 140, 53);
    context.font = '8px monospace';
    context.fillText('RETURN / LR-01', 140, 67);
    context.save();
    context.translate(158, 151);context.rotate(-.08);
    context.strokeStyle = '#a95f55';context.lineWidth = 1.1;context.strokeRect(-22, -8, 44, 16);
    context.fillStyle = '#a95f55';context.font = 'bold 11px monospace';context.fillText('未购买', 0, 4);context.restore();
    context.strokeStyle = '#a9947e';
    context.lineWidth = .8;
    for (const y of [74, 111, 145, 181]) {
      context.beginPath();context.moveTo(81, y);context.lineTo(182, y);context.stroke();
    }
    context.fillStyle = '#634d49';
    context.font = 'bold 16px monospace';
    context.fillText('RET-031', 130, 98);
    context.font = '8px monospace';
    context.fillText('原箱标记', 109, 131);
    context.font = 'bold 17px monospace';
    context.fillText('P03', 156, 134);
    context.font = '10px monospace';
    context.fillText('签收', 104, 166);
    context.beginPath();context.moveTo(123, 167);context.lineTo(167, 167);context.stroke();
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(this.mask.canvas, 0, 0);
    context.globalCompositeOperation = 'source-over';
  }

  private normalizedSource(point: Point) {
    const crop = this.registration.receipt.alphaBounds.visible16;
    return {x: 128 + this.fit.left + (point.x - crop.x) * this.fit.scale,
      y: 128 + this.fit.top + (point.y - crop.y) * this.fit.scale};
  }

  private brushSource(pass: number, amount: number) {
    const y = 16 + pass * 32;
    const row = this.rows[Math.min(255, y)];
    const left = Math.max(0, (row?.left ?? 35) - 13);
    const right = Math.min(256, (row?.right ?? 215) + 13);
    const x = pass % 2 === 0 ? left + (right - left) * amount : right - (right - left) * amount;
    return {x, y};
  }

  private prepareMud(progress: number) {
    if (progress === this.lastCleaning) return;
    this.lastCleaning = progress;
    const context = this.remainingMud.context;
    context.clearRect(0, 0, 256, 256);
    context.drawImage(this.mud.canvas, 0, 0);
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.lineWidth = BRUSH_CONTACT_WIDTH;
    context.lineCap = 'round';
    const work = progress * 8;
    for (let pass = 0; pass < 8; pass++) {
      const sweep = clamp((work - pass) / .72);
      if (sweep === 0) continue;
      const start = this.brushSource(pass, 0);
      const end = this.brushSource(pass, sweep);
      context.beginPath();context.moveTo(start.x, start.y);context.lineTo(end.x, end.y);context.stroke();
    }
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(this.mask.canvas, 0, 0);
    context.restore();
    // Measured from the actual remaining mud alpha, not the elapsed animation label.
    const source = this.mud.context.getImageData(0, 0, 256, 256).data;
    const remaining = context.getImageData(0, 0, 256, 256).data;
    let total = 0;
    let still = 0;
    for (let i = 3; i < source.length; i += 4) {total += source[i];still += remaining[i];}
    this.cleanCoverage = total > 0 ? clamp(1 - still / total) : 1;
  }

  private patch(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>, front: boolean) {
    const image = front ? this.patchFront.canvas : this.patchBack.canvas;
    for (const name of ['upper', 'lower'] as const) {
      const installed = name === 'upper' ? frame.upperPatch : frame.lowerPatch;
      if (installed <= 0) continue;
      const target = this.registration.receipt.patchTargets[name];
      const corner = this.normalizedSource({x: target.srcRect.x, y: target.srcRect.y});
      const width = target.srcRect.width * this.fit.scale;
      const height = target.srcRect.height * this.fit.scale;
      const descent = (1 - installed) * 16;
      const widthScale = front ? 1.32 : 1.62;
      const heightScale = name === 'upper' ? (front ? 1.18 : 1.38) : (front ? 1.78 : 2.12);
      const bridge = this.normalizedSource(target.bridgeCenter);
      const scaledWidth = (width + 4) * widthScale;
      const scaledHeight = (height + 4) * heightScale;
      // A broad matte rear-fibre bridge and a smaller front tab leave the torn edge legible.
      // Both patches settle around the measured tear/curl root, away from the original ink.
      const x = bridge.x - scaledWidth / 2 - descent * .4;
      const y = bridge.y - scaledHeight / 2 - descent;
      context.drawImage(image, corner.x - 2, corner.y - 2, width + 4, height + 4,
        x, y, scaledWidth, scaledHeight);
    }
  }

  private compose(frame: ReturnType<typeof v036ReceiptFrame>) {
    this.prepareMud(frame.cleaning);
    const context = this.composed.context;
    context.clearRect(0, 0, 256, 256);
    this.patch(context, frame, false);
    context.drawImage(this.paper.canvas, 0, 0);
    context.drawImage(this.ink.canvas, 0, 0);
    context.drawImage(this.remainingMud.canvas, 0, 0);
    this.patch(context, frame, true);
  }

  private paperMesh(frame: ReturnType<typeof v036ReceiptFrame>, reduced: boolean, ambience: number) {
    const lift = frame.support;
    const lowerPatch = frame.lowerPatch;
    const trial = frame.trying ? Math.sin(frame.trial * Math.PI) : 0;
    const rig = restorationPaperRig(reduced ? 0 : ambience, {
      frame: PAPER_SIZE, paperWidth: this.fit.width / 256 * PAPER_SIZE,
      hingeV: .16, curlV: .80, reveal: 1,
    }, trial * (reduced ? .04 : .16));
    const sectionTilts = Array.from({length: 9}, (_, row) => {
      const opening = ease((frame.elapsed - (1.7 + row * .24)) / 2.2);
      return 1.26 * (1 - opening);
    });
    return restorationPaperMesh(rig, {
      center: {x: RECEIVER.x, y: RECEIVER.y - PAPER_SIZE / 2}, frame: PAPER_SIZE,
      pivot: {x: RECEIVER.x, y: RECEIVER.y - Math.sin(lift * Math.PI) * 11}, pivotU: .51,
      sectionTilts,
      rotation: .22 * (1 - frame.release),
      upperLift: (1 - frame.upperPatch) * (14 + Math.sin(frame.elapsed * 2) * (reduced ? 0 : 2.3)),
      upperOut: (1 - frame.upperPatch) * 9,
      lowerSpread: -13 * (1 - lowerPatch) + lowerPatch * (6 + trial * 16),
      lowerLift: 14 * (1 - lowerPatch),
      pullBend: Math.sin(frame.release * Math.PI) * 10,
    });
  }

  private drawPaper(context: CanvasRenderingContext2D, mesh: ReturnType<typeof restorationPaperMesh>) {
    for (let row = 0; row < mesh.rows; row++) {
      for (let column = 0; column < mesh.columns.length - 1; column++) {
        const x1 = mesh.columns[column] * 256;
        const x2 = mesh.columns[column + 1] * 256;
        const y1 = row / mesh.rows * 256;
        const y2 = (row + 1) / mesh.rows * 256;
        const a = mesh.vertices[row][column];
        const b = mesh.vertices[row][column + 1];
        const c = mesh.vertices[row + 1][column];
        const d = mesh.vertices[row + 1][column + 1];
        drawTriangle(context, this.composed.canvas, [{x: x1, y: y1}, {x: x2, y: y1}, {x: x2, y: y2}], [a, b, d]);
        drawTriangle(context, this.composed.canvas, [{x: x1, y: y1}, {x: x1, y: y2}, {x: x2, y: y2}], [a, c, d]);
      }
    }
  }

  /** Same paper, surviving ink, mud mask and fibres used inside every real museum case. */
  drawSpecimen(context: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions): ReceiptRestorationDrawResult {
    const frame = v037ReceiptFrameFromRestoration(options.restorationFrame);
    const mesh = this.paperMesh(frame, false, options.seconds);
    this.compose(frame);
    const scale = options.frame / PAPER_SIZE;
    const project = (point: Point) => ({x: options.center.x + (point.x - RECEIVER.x) * scale,
      y: options.receiverY + (point.y - RECEIVER.y) * scale});
    context.save();context.translate(options.center.x, options.receiverY);context.scale(scale, scale);context.translate(-RECEIVER.x, -RECEIVER.y);
    this.soil(context, frame, false);
    context.save();
    if (frame.elapsed < 3.9) {
      const exposed = ease((frame.elapsed - 1.6) / 2.3);
      const corner = restorationMeshPoint(mesh, .32, .16);
      context.beginPath();context.rect(corner.x - 9 - exposed * 250, corner.y - 8 - exposed * 250, 27 + exposed * 560, 22 + exposed * 550);context.clip();
    }
    this.drawPaper(context, mesh);context.restore();
    this.soil(context, frame, true);context.restore();
    const edge = (right: boolean) => Array.from({length: 11}, (_, index) => {
      const y = 60 + index * 16;
      const row = this.rows[y];
      return project(restorationMeshPoint(mesh, (right ? (row?.right ?? 160) - 1 : (row?.left ?? 90) + 1) / 256, y / 256));
    });
    const leftEdge = edge(false), rightEdge = edge(true);
    const points = [...leftEdge, ...rightEdge];
    const left = Math.min(...points.map(point => point.x)), top = Math.min(...points.map(point => point.y));
    const saved = options.restorationFrame;
    return {attachments: {leftEdge, rightEdge, leftTop: leftEdge[0], leftBottom: leftEdge[10], rightTop: rightEdge[0], rightBottom: rightEdge[10]},
      tier: saved.caseTier, reveal: saved.cleaning,
      bounds: {left, top, width: Math.max(...points.map(point => point.x)) - left, height: Math.max(...points.map(point => point.y)) - top},
      restoration: {phase: saved.phase, condition: saved.condition, cleaning: saved.cleaning, repairing: saved.repairing,
        excavation: saved.excavation, originalCode: saved.original.artifactCode, missingCount: saved.reading.missingCount}};
  }

  paperAttachments() {
    const mesh = this.lastMesh!;
    const edge = (right: boolean) => Array.from({length: 11}, (_, index) => {
      const y = 60 + index * 16, row = this.rows[y];
      return restorationMeshPoint(mesh, (right ? (row?.right ?? 160) - 1 : (row?.left ?? 90) + 1) / 256, y / 256);
    });
    const leftEdge = edge(false), rightEdge = edge(true);
    return {leftEdge, rightEdge, leftTop: leftEdge[0], leftBottom: leftEdge[10], rightTop: rightEdge[0], rightBottom: rightEdge[10]};
  }

  private mechanicalArm(context: CanvasRenderingContext2D, grip: Point, left: boolean) {
    const direction = left ? -1 : 1;
    const anchor = {x: left ? -16 : 656, y: grip.y + 94};
    const elbow = {x: grip.x + direction * Math.max(54, Math.abs(anchor.x - grip.x) * .48), y: grip.y + 38};
    const segment = (from: Point, to: Point) => {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      context.save();context.translate(from.x, from.y);
      context.rotate(Math.atan2(to.y - from.y, to.x - from.x) - Math.PI / 2);
      // Reuse the original robot's cream shell, purple cuff and rounded shoulder.
      context.drawImage(this.robot, 320 + 91, 160 + 85, 26, 40, -16, -6, 32, length + 13);
      context.restore();
    };
    segment(anchor, elbow);segment(elbow, grip);
    context.drawImage(this.robot, 320 + 93, 160 + 87, 23, 23, elbow.x - 19, elbow.y - 19, 38, 38);
  }

  private spatula(context: CanvasRenderingContext2D, point: Point, angle: number, flip = false) {
    const tool = this.registration.tools.spatula;
    const scale = .50;
    const localGrip = {x: (tool.pivot.x - tool.contact.x) * scale * (flip ? -1 : 1),
      y: (tool.pivot.y - tool.contact.y) * scale};
    const gripPoint = {x: point.x + localGrip.x * Math.cos(angle) - localGrip.y * Math.sin(angle),
      y: point.y + localGrip.x * Math.sin(angle) + localGrip.y * Math.cos(angle)};
    this.mechanicalArm(context, gripPoint, flip);
    context.save();context.translate(point.x, point.y);context.rotate(angle);context.scale(flip ? -1 : 1, 1);
    context.fillStyle = 'rgba(29,17,37,.22)';
    context.beginPath();context.ellipse(0, 7, 24, 5, 0, 0, Math.PI * 2);context.fill();
    context.drawImage(this.assets.spatula, -tool.contact.x * scale, -tool.contact.y * scale,
      tool.size.width * scale, tool.size.height * scale);
    const grip = {x: (tool.pivot.x - tool.contact.x) * scale, y: (tool.pivot.y - tool.contact.y) * scale};
    // The original robot's actual pickup claw closes around the tool handle.
    context.drawImage(this.robot, 160 + 29, 160 + 112, 32, 31, grip.x - 27, grip.y - 21, 52, 50);
    context.restore();
  }

  private soil(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>, front: boolean) {
    if (frame.elapsed >= 20) return;
    const asset = front ? this.assets.soilFront : this.assets.soilBack;
    const shift = ease((frame.elapsed - 4.2) / 2) * 15;
    context.save();
    context.beginPath();context.rect(70, 418, 500, 94);context.clip();
    context.drawImage(asset, 72, 410 + shift, 496, 96);
    context.restore();
    if (front) {
      const spread = ease((frame.elapsed - 1.6) / 3.2) * 100;
      const settle = ease((frame.elapsed - 2) / 4.2);
      const y = 375 + settle * 59;
      const height = 108 - settle * 56;
      // Whole natural rock silhouettes retain their original alpha edges.
      // They separate at the blade contacts, exposing the folded paper between them.
      context.drawImage(this.assets.soilFront, 0, 0, 155, 99, 171 - spread, y, 190, height);
      context.save();context.translate(640, 0);context.scale(-1, 1);
      context.drawImage(this.assets.soilFront, 0, 0, 155, 99, 171 - spread, y, 190, height);
      context.restore();
    }
  }

  private soilChips(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>) {
    if (frame.elapsed < 2.5 || frame.elapsed > 6.4) return;
    for (let index = 0; index < 4; index++) {
      const elapsed = frame.elapsed - (2.7 + index * .55);
      if (elapsed <= 0 || elapsed > 1.1) continue;
      const chip = this.assets[`soilChip${index}` as 'soilChip0' | 'soilChip1' | 'soilChip2' | 'soilChip3'];
      const registration = this.registration.soil.chips[index];
      const t = Math.min(.9, elapsed);
      const direction = index % 2 === 0 ? -1 : 1;
      const x = 270 + index * 26 + direction * t * 30;
      const y = 389 + index * 8 - 30 * t + 110 * t * t;
      context.save();context.translate(x, y);context.rotate(t * direction);
      context.drawImage(chip, -registration.contact.x * .4, -registration.contact.y * .4,
        registration.size.width * .4, registration.size.height * .4);context.restore();
    }
  }

  private excavation(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>, mesh: ReturnType<typeof restorationPaperMesh>, front: boolean) {
    if (frame.elapsed > 6.4) return;
    const source = front ? {x: 80, y: 53} : {x: 137, y: 247};
    const edge = restorationMeshPoint(mesh, source.x / 256, source.y / 256);
    const approach = ease(frame.elapsed / .7);
    const withdraw = ease((frame.elapsed - (front ? 5.4 : 5.9)) / .5);
    const initial = front ? {x: 165, y: 448} : {x: 468, y: 470};
    const tracking = front ? ease((frame.elapsed - 1.7) / .5) : ease((frame.elapsed - 3.8) / .5);
    const scrape = frame.elapsed < 1.8 ? Math.sin(frame.elapsed * 8) * 7 : 0;
    const point = {x: initial.x + (edge.x - initial.x) * tracking + (front ? -1 : 1) * (1 - approach + withdraw) * 100 + scrape,
      y: initial.y + (edge.y - initial.y) * tracking - (1 - approach + withdraw) * 30};
    this.spatula(context, point, front ? -.15 : .10, front);
    if (front && tracking > .99 && withdraw === 0) this.contact = {tool: 'spatula', x: edge.x, y: edge.y, pressed: true};
  }

  private brush(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>, mesh: ReturnType<typeof restorationPaperMesh>) {
    if (frame.phase !== 'cleaning') return;
    const pose = v036BrushPose(frame.cleaning);
    const passSweep = clamp(pose.local / .72);
    let source = this.brushSource(pose.pass, passSweep);
    if (pose.local >= .72 && pose.pass < 7) {
      const next = this.brushSource(pose.pass + 1, 0);
      const transit = ease((pose.local - .72) / .28);
      source = {x: source.x + (next.x - source.x) * transit, y: source.y + (next.y - source.y) * transit};
    }
    const point = restorationMeshPoint(mesh, source.x / 256, source.y / 256);
    const brush = this.registration.tools.brush;
    const matrix = v036BrushToolTransform(pose.pressure);
    const dirty = this.dirtyBristles.context;
    dirty.clearRect(0, 0, 192, 163);
    dirty.drawImage(this.assets.brushBristles, 0, 0);
    dirty.save();dirty.globalCompositeOperation = 'source-atop';dirty.globalAlpha = frame.cleaning * .5;
    dirty.drawImage(this.mud.canvas, 55, 65, 110, 110, 0, 80, 96, 83);dirty.restore();
    const handleGrip = {x: point.x + matrix.handleGrip.x * BRUSH_SCALE,
      y: point.y - pose.lift + matrix.handleGrip.y * BRUSH_SCALE};
    this.mechanicalArm(context, handleGrip, false);
    context.save();context.translate(point.x, point.y - pose.lift);context.scale(BRUSH_SCALE, BRUSH_SCALE);
    context.save();context.transform(matrix.bristles.a, matrix.bristles.b, matrix.bristles.c, matrix.bristles.d, matrix.bristles.e, matrix.bristles.f);
    context.drawImage(this.dirtyBristles.canvas, 0, 0);context.restore();
    context.drawImage(this.assets.brushHandle, matrix.handleOrigin.x, matrix.handleOrigin.y);
    context.drawImage(this.robot, 160 + 29, 160 + 112, 32, 31, matrix.handleGrip.x - 16, matrix.handleGrip.y - 15, 32, 31);
    context.restore();
    this.contact = {tool: 'brush', x: point.x, y: point.y, pressed: pose.contact};
    if (!pose.contact) return;
    context.fillStyle = '#b98d6c';
    for (let index = 0; index < 3; index++) {
      const fall = ((frame.elapsed * 5 + index * .3) % 1);
      context.globalAlpha = 1 - fall;
      context.fillRect(Math.round(point.x - 8 - index * 3 - fall * 9), Math.round(point.y + 5 + fall * 20), 2, 2);
    }
    context.globalAlpha = 1;
  }

  private repair(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>, mesh: ReturnType<typeof restorationPaperMesh>) {
    if (frame.phase !== 'repairing') return;
    const upper = frame.elapsed < 17.6;
    const target = this.registration.receipt.patchTargets[upper ? 'upper' : 'lower'];
    const local = frame.elapsed - (upper ? 15.5 : 17.6);
    const source = this.normalizedSource(target.contact);
    const point = restorationMeshPoint(mesh, source.x / 256, source.y / 256);
    const press = ease(local / .45) * (1 - ease((local - 1.35) / .5));
    this.spatula(context, {x: point.x + (1 - press) * 55, y: point.y - (1 - press) * 34}, -.10);
    this.contact = {tool: 'press', x: point.x, y: point.y, pressed: press > .95};
    if (press > .95) {
      context.save();context.fillStyle = 'rgba(217,179,124,.14)';
      context.beginPath();context.ellipse(point.x, point.y + 2, 17, 5, -.25, 0, Math.PI * 2);context.fill();context.restore();
    }
  }

  private print(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>) {
    if (!frame.trying && frame.phase !== 'complete') return;
    const printing = ease((frame.trial - .20) / .45);
    const height = Math.round(66 * printing);
    context.save();context.fillStyle = '#251d31';context.fillRect(257, 524, 127, 8);
    context.beginPath();context.rect(249, 531, 145, 73);context.clip();
    context.fillStyle = '#f4ddb0';context.fillRect(258, 531, 125, height);
    context.fillStyle = '#705144';context.font = '11px monospace';context.textAlign = 'center';
    context.fillText('您尚未购买任何商品', 320, 531 + height - 35);
    context.fillText('· 收据的自言自语 ·', 320, 531 + height - 14);
    context.restore();
  }

  draw(context: CanvasRenderingContext2D, frame: ReturnType<typeof v036ReceiptFrame>, reduced: boolean, ambience: number, extension?: (context: CanvasRenderingContext2D) => void) {
    this.contact = null;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.imageSmoothingEnabled = false;
    const background = context.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, '#30223f');background.addColorStop(.65, '#21182d');background.addColorStop(1, '#3b2939');
    context.fillStyle = background;context.fillRect(0, 0, WIDTH, HEIGHT);
    if (this.background?.complete && this.background.naturalWidth) context.drawImage(this.background, 0, 0, WIDTH, HEIGHT);
    const light = context.createRadialGradient(280, 240, 20, 300, 350, 340);
    light.addColorStop(0, 'rgba(247,182,102,.13)');light.addColorStop(1, 'rgba(247,182,102,0)');
    context.fillStyle = light;context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#281e30';context.beginPath();context.ellipse(320, 490, 216, 32, 0, 0, Math.PI * 2);context.fill();
    const glassPlacement = v036ReceiptGlassPlacement({width: this.glassBack.naturalWidth, height: this.glassBack.naturalHeight});
    const glassRect = glassPlacement.rect;
    const glassVisible = frame.glass > 0;
    if (glassVisible) {
      context.save();context.globalAlpha = frame.glass;context.drawImage(this.glassBack, glassRect.x, glassRect.y, glassRect.width, glassRect.height);context.restore();
    }
    const tray = this.registration.tools.tray;
    const lipY = tray.frontLipY;
    const trayRect = {
      x: RECEIVER.x - tray.contact.x / tray.size.width * 416,
      y: RECEIVER.y - tray.contact.y / tray.size.height * 77,
      width: 416, height: 77,
    };
    context.drawImage(this.assets.tray, 0, 0, tray.size.width, lipY,
      trayRect.x, trayRect.y, trayRect.width, trayRect.height * lipY / tray.size.height);
    this.soil(context, frame, false);
    const mesh = this.paperMesh(frame, reduced, ambience);
    this.lastMesh = mesh;
    this.compose(frame);
    this.excavation(context, frame, mesh, false);
    context.save();
    if (frame.elapsed < 3.9) {
      const exposed = ease((frame.elapsed - 1.6) / 2.3);
      const corner = restorationMeshPoint(mesh, .32, .16);
      context.beginPath();
      context.rect(corner.x - 9 - exposed * 250, corner.y - 8 - exposed * 250, 27 + exposed * 560, 22 + exposed * 550);
      context.clip();
    }
    this.drawPaper(context, mesh);
    context.restore();
    this.soil(context, frame, true);
    this.soilChips(context, frame);
    this.excavation(context, frame, mesh, true);
    const frontHeight = tray.size.height - lipY;
    context.drawImage(this.assets.tray, 0, lipY, tray.size.width, frontHeight,
      trayRect.x, trayRect.y + trayRect.height * lipY / tray.size.height,
      trayRect.width, trayRect.height * frontHeight / tray.size.height);
    this.brush(context, frame, mesh);
    this.repair(context, frame, mesh);
    extension?.(context);
    if (glassVisible) {
      const descent = (1 - frame.glass) * -130;
      context.save();context.globalAlpha = Math.min(1, frame.glass * 4);
      context.drawImage(this.glassFront, glassRect.x, glassRect.y + descent, glassRect.width, glassRect.height);context.restore();
    }
    this.print(context, frame);
    return {cleanCoverage: this.cleanCoverage, contact: this.contact as {tool: string; x: number; y: number; pressed: boolean} | null, paperFoot: restorationMeshPoint(mesh, .51, 1),
      trayReceiver: {x: trayRect.x + tray.contact.x / tray.size.width * trayRect.width,
        y: trayRect.y + tray.contact.y / tray.size.height * trayRect.height},
      glassReceiver: glassPlacement.receiver, glassRect,
      glassSourceReceiver: glassPlacement.sourceReceiver, glassTextureSize: glassPlacement.sourceSize,
      glassFrontReceiver: {x: glassRect.x + glassPlacement.sourceReceiver.x / this.glassFront.naturalWidth * glassRect.width,
        y: glassRect.y + glassPlacement.sourceReceiver.y / this.glassFront.naturalHeight * glassRect.height - (1 - frame.glass) * 130}};
  }
}

const backgroundUrls = import.meta.glob('../../assets/runtime/v036/*workbench*.webp', {query: '?url', import: 'default'}) as Record<string, () => Promise<string>>;

export async function createV036ReceiptTable() {
  const assets = createReceiptRestorationAssets();
  const load = (url: string) => {const image = new Image();image.src = url;return image;};
  const glassBack = load(caseBackUrl), glassFront = load(caseFrontUrl), robot = load(robotUrl);
  const backgroundLoader = Object.values(backgroundUrls)[0];
  const backgroundUrl = backgroundLoader ? await backgroundLoader() : undefined;
  const background = backgroundUrl ? load(backgroundUrl) : undefined;
  await Promise.all([...Object.values(assets), glassBack, glassFront, robot, ...(background ? [background] : [])].map(image => image.decode()));
  return new V036ReceiptTable(assets, glassBack, glassFront, robot, background);
}
