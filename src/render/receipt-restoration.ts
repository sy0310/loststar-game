import {RESTORATION_DURATIONS, type ReceiptRestorationFrame} from '../review/receipt-restoration';
import {fitReceiptSpecimen, receiptPaperRig, type PaperRect, type ReceiptLight} from './receipt-specimen';

export const receiptRestorationCamera = {left: 125, top: 390, width: 100, height: 146} as const;
const TEXTURE_SIZE = 256;
const BAND_COUNT = 9;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function smooth(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function restorationExcavationMotion(progress: number) {
  const p = clamp(progress);
  const lever = smooth((p - .22) / .32);
  const support = smooth((p - .52) / .30);
  const lift = smooth((p - .82) / .06);
  const release = clamp((p - .88) / .08);
  const settle = clamp((p - .96) / .04);
  const sectionTilts = Array.from({length: BAND_COUNT}, (_, row) => {
    const v = (row + .5) / BAND_COUNT;
    const opening = smooth((p - (.20 + v * .35)) / .28);
    return 1.25 * (1 - opening);
  });
  const phase = p < .22 ? 'loosen' : p < .54 ? 'pry' : p < .82 ? 'support' : p < 1 ? 'settle' : 'done';
  return {
    phase,
    progress: p,
    lever,
    support,
    release,
    sectionTilts,
    liftHeight: 7 * lift * (1 - release * release)
      + Math.sin(settle * Math.PI) * .7 * (1 - settle),
    rotation: .46 * (1 - smooth((p - .22) / .58)) + .14 * lift * (1 - release),
    pullBend: 5 * lever * (1 - support),
    soilBreak: smooth((p - .10) / .45),
    soilDrop: smooth((p - .64) / .30) ** 2,
    toolExit: smooth((p - .94) / .06),
  };
}

export function restorationCleaningMotion(progress: number) {
  const p = clamp(progress);
  const withdraw = smooth((p - .90) / .10);
  return {
    wipe: smooth((p - .10) / .80),
    pressure: smooth(p / .10) * (1 - withdraw),
    withdraw,
  };
}

export function restorationBrushTransform(root: Point, contact: Point, pressure: number) {
  const dx = root.x - contact.x;
  const dy = root.y - contact.y;
  const length = Math.max(.001, Math.hypot(dx, dy));
  const nx = dx / length;
  const ny = dy / length;
  const along = 1 - clamp(pressure) * .17;
  const across = 1 + clamp(pressure) * .08;
  const a = across + (along - across) * nx * nx;
  const b = (along - across) * nx * ny;
  const c = b;
  const d = across + (along - across) * ny * ny;
  const e = -a * contact.x - c * contact.y;
  const f = -b * contact.x - d * contact.y;
  return {
    bristles: {a, b, c, d, e, f},
    handleOrigin: {x: a * root.x + c * root.y + e - root.x, y: b * root.x + d * root.y + f - root.y},
  };
}

export function restorationSoilChip(index: number, seconds: number, origin: {x: number; y: number}, floorY: number) {
  const gravity = 42;
  const velocityY = -18 - index % 2 * 2;
  const velocityX = (index % 2 === 0 ? -1 : 1) * (9 + index * 1.6);
  const hit = (-velocityY + Math.sqrt(velocityY * velocityY + 2 * gravity * Math.max(0, floorY - origin.y))) / gravity;
  const t = Math.max(0, Math.min(hit, seconds));
  const after = Math.max(0, seconds - hit);
  const bounce = after < .24 ? Math.sin(after / .24 * Math.PI) * .65 : 0;
  const y = t === hit ? floorY - bounce : origin.y + velocityY * t + .5 * gravity * t * t;
  return {
    x: origin.x + velocityX * t,
    y,
    height: Math.max(0, floorY - y),
    rotation: (index % 2 === 0 ? -1 : 1) * Math.min(seconds, hit) * 2,
  };
}

export function receiptRestorationGeometry(
  frame: ReceiptRestorationFrame,
  center: {x: number; y: number},
  size: number,
  receiverY: number,
) {
  const progress = frame.phase === 'excavating' ? frame.progress : frame.stage === 'displayed' ? 1 : 0;
  const motion = restorationExcavationMotion(progress);
  const pivotY = receiverY - motion.liftHeight;
  const projectedHeight = motion.sectionTilts.reduce((sum, angle) => sum + size / BAND_COUNT * Math.cos(angle), 0);
  const paperCenter = {x: center.x, y: pivotY - projectedHeight / 2 * Math.cos(motion.rotation)};
  const repair = restorationRepairStages(frame.repairing);
  const trial = frame.phase === 'trying' ? Math.sin(frame.trying * Math.PI) : 0;
  const looseTrial = frame.phase === 'trying' ? Math.sin(frame.trying * Math.PI * 5) * (1 - frame.trying) : 0;
  return {
    paperCenter,
    paperBounds: {left: paperCenter.x - size / 2, top: paperCenter.y - projectedHeight / 2, width: size, height: projectedHeight},
    pivotY,
    motion,
    rotation: motion.rotation,
    pullBend: motion.pullBend,
    upperLift: smooth((progress - .60) / .30) * (1 - repair.upper) * (4.8 + Math.sin(frame.seconds * 2) * .6 + looseTrial * .8),
    upperOut: smooth((progress - .60) / .30) * (1 - repair.upper) * 2.2,
    lowerSpread: smooth((progress - .60) / .30) * ((1 - repair.lower) * (-2.4 + Math.sin(frame.seconds * 1.7) * .6 + looseTrial)
      + repair.lower * (2 + trial * 2.8)),
    lowerLift: smooth((progress - .60) / .30) * (1 - repair.lower) * (2.2 + Math.sin(frame.seconds * 2.3) * .35),
    soilOpacity: progress < 1 ? 1 : 0,
    trialBend: trial * .15,
  };
}

const MESH_COLUMNS = [0, .4, .7, 1];
type Point = {x: number; y: number};
type PaperForces = {
  center: Point;
  frame: number;
  rotation: number;
  upperLift: number;
  upperOut: number;
  lowerSpread: number;
  lowerLift: number;
  pullBend: number;
  pivot?: Point;
  pivotU?: number;
  sectionTilts?: number[];
};

export function restorationPaperMesh(rig: ReturnType<typeof restorationPaperRig>, forces: PaperForces) {
  const cosine = Math.cos(forces.rotation);
  const sine = Math.sin(forces.rotation);
  const pivotU = forces.pivotU ?? .5;
  const pivot = forces.pivot ?? {x: forces.center.x, y: forces.center.y + forces.frame / 2};
  const profile = Array<number>(BAND_COUNT + 1).fill(0);
  for (let row = BAND_COUNT - 1; row >= 0; row--) {
    profile[row] = profile[row + 1] - forces.frame / BAND_COUNT * Math.cos(forces.sectionTilts?.[row] ?? 0);
  }
  const vertices = rig.nodes.map((node, row) => {
    const v = row / BAND_COUNT;
    const corner = Math.sin(Math.PI * clamp((v - .03) / .37));
    const curl = Math.sin(Math.PI * clamp((v - .72) / .28));
    return MESH_COLUMNS.map(u => {
      const left = 1 - smooth((u - .40) / .25);
      const right = smooth((u - .40) / .30);
      const x = (u - pivotU) * forces.frame + node.x * .2
        - forces.upperOut * corner * left + forces.lowerSpread * curl * right;
      const idleBend = node.y - (v - .5) * forces.frame;
      const y = profile[row] + idleBend - forces.upperLift * corner * left
        - forces.lowerLift * curl * right - forces.pullBend * (1 - v) ** 2;
      return {
        x: pivot.x + x * cosine - y * sine,
        y: pivot.y + x * sine + y * cosine,
      };
    });
  });
  return {vertices, columns: MESH_COLUMNS, rows: BAND_COUNT};
}

export function restorationMeshPoint(mesh: ReturnType<typeof restorationPaperMesh>, u: number, v: number) {
  const x = clamp(u);
  const position = clamp(v) * mesh.rows;
  const row = Math.min(mesh.rows - 1, Math.floor(position));
  let column = 0;
  while (column < mesh.columns.length - 2 && x >= mesh.columns[column + 1]) column++;
  const fx = (x - mesh.columns[column]) / (mesh.columns[column + 1] - mesh.columns[column]);
  const fy = position - row;
  const a = mesh.vertices[row][column];
  const b = mesh.vertices[row][column + 1];
  const c = mesh.vertices[row + 1][column];
  const d = mesh.vertices[row + 1][column + 1];
  return fy <= fx ? {
    x: a.x * (1 - fx) + b.x * (fx - fy) + d.x * fy,
    y: a.y * (1 - fx) + b.y * (fx - fy) + d.y * fy,
  } : {
    x: a.x * (1 - fy) + c.x * (fy - fx) + d.x * fx,
    y: a.y * (1 - fy) + c.y * (fy - fx) + d.y * fx,
  };
}

export function restorationBrushPasses(progress: number) {
  const p = clamp(progress);
  return Array.from({length: 8}, (_, index) => {
    const forward = index % 2 === 0;
    return {
      start: {x: forward ? 0 : TEXTURE_SIZE, y: 16 + index * 32},
      end: {x: forward ? TEXTURE_SIZE : 0, y: 16 + index * 32},
      y: 16 + index * 32,
      progress: clamp(p * 8 - index),
    };
  });
}

export function restorationPaperRig(
  seconds: number,
  options: Parameters<typeof receiptPaperRig>[1],
  trialBend: number,
) {
  const rig = receiptPaperRig(seconds, options);
  const anchoredThrough = Math.ceil(options.hingeV * BAND_COUNT);
  return {
    nodes: rig.nodes.map((node, index) => ({
      x: node.x + (index <= anchoredThrough ? 0 : trialBend * (index / BAND_COUNT - options.hingeV)),
      y: node.y,
    })),
  };
}

export function restorationRepairStages(progress: number) {
  const p = clamp(progress);
  return {
    upper: smooth((p - .05) / .35),
    lower: smooth((p - .58) / .30),
    toolBetween: smooth((p - .42) / .22),
    retract: smooth((p - .88) / .12),
  };
}

type LayerRegistration = {file: string; opacity?: number};
type PatchTarget = {srcRect: PaperRect; contact: {x: number; y: number}; bridgeCenter: {x: number; y: number}};
type RegisteredSprite = {
  file: string;
  size: {width: number; height: number};
  paperRelative: PaperRect;
};
type TrayRegistration = RegisteredSprite & {
  contact: {x: number; y: number};
  frontLipY: number;
};
type ToolRegistration = {
  file: string;
  size: {width: number; height: number};
  contact: Point;
  pivot: Point;
  suggestedWorldWidth: number;
};
type SoilChipRegistration = ToolRegistration & {sourceRect: {left: number; top: number; width: number; height: number}; outline: number[][]};
type BrushRegistration = {
  file: string;
  size: {width: number; height: number};
  contact: {x: number; y: number};
  pivot: {x: number; y: number};
  suggestedWorldWidth: number;
  root: Point;
  parts: {bristles: {file: string}; handle: {file: string}};
};
export type ReceiptRestorationRegistration = {
  receipt: {
    canvas: {width: number; height: number};
    center: {x: number; y: number};
    hinge: {x: number; y: number};
    unfoldCutY: number;
    alphaBounds: {visible16: PaperRect};
    paperFace: PaperRect;
    lowerCurl: PaperRect;
    layers: Record<'paper' | 'mud' | 'patchBack' | 'patchFront' | 'survivingMask', LayerRegistration>;
    patchTargets: Record<'upper' | 'lower', PatchTarget>;
  };
  soil: {back: RegisteredSprite; front: RegisteredSprite; chips: SoilChipRegistration[]};
  tools: {tray: TrayRegistration; brush: BrushRegistration; spatula: ToolRegistration};
};

export type ReceiptRestorationAssets = {
  paper: HTMLImageElement;
  mud: HTMLImageElement;
  patchBack: HTMLImageElement;
  patchFront: HTMLImageElement;
  survivingMask: HTMLImageElement;
  soilBack: HTMLImageElement;
  soilFront: HTMLImageElement;
  tray: HTMLImageElement;
  brushBristles: HTMLImageElement;
  brushHandle: HTMLImageElement;
  spatula: HTMLImageElement;
  soilChip0: HTMLImageElement;
  soilChip1: HTMLImageElement;
  soilChip2: HTMLImageElement;
  soilChip3: HTMLImageElement;
};

const urls = import.meta.glob([
  '../../assets/runtime/v034/receipt-paper-damaged.webp',
  '../../assets/runtime/v034/receipt-mud.webp',
  '../../assets/runtime/v034/receipt-patch-back.webp',
  '../../assets/runtime/v034/receipt-patch-front.webp',
  '../../assets/runtime/v034/receipt-surviving-paper-mask.webp',
  '../../assets/runtime/v034/receipt-soil-back.webp',
  '../../assets/runtime/v034/receipt-soil-front.webp',
  '../../assets/runtime/v034/restoration-tray.webp',
  '../../assets/runtime/v034-refine/*.webp',
], {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const registrations = import.meta.glob(['../../assets/runtime/v034/registration.json', '../../assets/runtime/v034-refine/registration.json'], {
  eager: true, import: 'default',
}) as Record<string, ReceiptRestorationRegistration>;

let registered: ReceiptRestorationRegistration | undefined;
export function receiptRestorationRegistration() {
  if (registered) return registered;
  const base = registrations['../../assets/runtime/v034/registration.json'];
  const refined = registrations['../../assets/runtime/v034-refine/registration.json'];
  if (!base || !refined) throw new Error('Missing V0.3.4 receipt refinement registration');
  registered = {
    receipt: {...base.receipt, ...refined.receipt,
      layers: {...base.receipt.layers, ...refined.receipt.layers}},
    soil: {...base.soil, ...refined.soil},
    tools: {...base.tools, ...refined.tools, brush: {...base.tools.brush, ...refined.tools.brush}},
  };
  return registered;
}

export function createReceiptRestorationAssets(): ReceiptRestorationAssets {
  const registration = receiptRestorationRegistration();
  const load = (file: string) => {
    const name = file.split('/').at(-1)!;
    const url = urls[`../../assets/runtime/v034-refine/${name}`] ?? urls[`../../assets/runtime/v034/${name}`];
    if (!url) throw new Error(`Missing V0.3.4 receipt layer ${file}`);
    const image = new Image();
    image.src = url;
    return image;
  };
  const layers = registration.receipt.layers;
  return {
    paper: load(layers.paper.file),
    mud: load(layers.mud.file),
    patchBack: load(layers.patchBack.file),
    patchFront: load(layers.patchFront.file),
    survivingMask: load(layers.survivingMask.file),
    soilBack: load(registration.soil.back.file),
    soilFront: load(registration.soil.front.file),
    tray: load(registration.tools.tray.file),
    brushBristles: load(registration.tools.brush.parts.bristles.file),
    brushHandle: load(registration.tools.brush.parts.handle.file),
    spatula: load(registration.tools.spatula.file),
    soilChip0: load(registration.soil.chips[0].file),
    soilChip1: load(registration.soil.chips[1].file),
    soilChip2: load(registration.soil.chips[2].file),
    soilChip3: load(registration.soil.chips[3].file),
  };
}

type Surface = {canvas: HTMLCanvasElement; context: CanvasRenderingContext2D};

function surface(width = TEXTURE_SIZE, height = TEXTURE_SIZE): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return {canvas, context: canvas.getContext('2d')!};
}

export type ReceiptRestorationDrawOptions = {
  center: {x: number; y: number};
  frame: number;
  seconds: number;
  restorationFrame: ReceiptRestorationFrame;
  lights: ReceiptLight[];
  glass: number;
  receiverY: number;
};

export type ReceiptRestorationDrawResult = {
  attachments: {leftTop: Point;leftBottom: Point;rightTop: Point;rightBottom: Point;leftEdge:Point[];rightEdge:Point[]};
  tier: number;
  reveal: number;
  bounds: {left: number; top: number; width: number; height: number};
  restoration: {
    phase: ReceiptRestorationFrame['phase'];
    condition: ReceiptRestorationFrame['condition'];
    cleaning: number;
    repairing: number;
    excavation: number;
    originalCode: string;
    missingCount: number;
  };
};

class ReceiptRestorationPainter {
  private paper = surface();
  private originalInk = surface();
  private mud = surface();
  private patchBack = surface();
  private patchFront = surface();
  private mask = surface();
  private remainingMud = surface();
  private combined = surface();
  private lit = surface();
  private looseSoil = surface(512, 99);
  private dirtyBristles = surface(192, 163);
  private fit: ReturnType<typeof fitReceiptSpecimen>;
  private hingeV: number;
  private curlV: number;
  private paperRows: ({left: number; right: number} | null)[];
  private paperFoot: Point;

  constructor(private assets: ReceiptRestorationAssets) {
    const registration = receiptRestorationRegistration().receipt;
    const crop = registration.alphaBounds.visible16;
    this.fit = fitReceiptSpecimen(crop.width, crop.height, TEXTURE_SIZE);
    this.hingeV = clamp((registration.hinge.y - crop.y) / crop.height);
    this.curlV = clamp((registration.unfoldCutY - crop.y) / crop.height);
    for (const key of ['paper', 'mud', 'patchBack', 'patchFront'] as const) {
      const target = this[key];
      target.context.imageSmoothingEnabled = false;
      target.context.drawImage(assets[key], crop.x, crop.y, crop.width, crop.height,
        TEXTURE_SIZE / 2 + this.fit.left, TEXTURE_SIZE / 2 + this.fit.top,
        this.fit.width, this.fit.height);
    }
    this.mask.context.drawImage(assets.survivingMask, crop.x, crop.y, crop.width, crop.height,
      TEXTURE_SIZE / 2 + this.fit.left, TEXTURE_SIZE / 2 + this.fit.top,
      this.fit.width, this.fit.height);
    const pixels = this.paper.context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data;
    this.paperRows = Array.from({length: TEXTURE_SIZE}, (_, y) => {
      let left = TEXTURE_SIZE;
      let right = 0;
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        if (pixels[(y * TEXTURE_SIZE + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x);
        right = x + 1;
      }
      return right > left ? {left, right} : null;
    });
    const foot = [...this.paperRows].reverse().find(row => row !== null)!;
    this.paperFoot = {x: (foot.left + foot.right) / 2, y: TEXTURE_SIZE};
    this.paintOriginalInk();
  }

  private paintOriginalInk() {
    const c = this.originalInk.context;
    c.textAlign = 'center';
    c.fillStyle = '#806f62';
    c.font = 'bold 12px monospace';
    c.fillText('退货回执', 141, 54);
    c.font = '7px monospace';
    c.fillStyle = '#a08b78';
    c.fillText('RETURN / LR–01', 139, 68);
    c.strokeStyle = '#a9947e';
    c.lineWidth = .65;
    for (const y of [74, 111, 145, 181]) {
      c.beginPath();
      c.moveTo(83, y);
      c.lineTo(180, y);
      c.stroke();
    }
    c.strokeStyle = 'rgba(145,126,113,.36)';
    c.lineWidth = .8;
    for (const radius of [12, 14.5]) {
      c.beginPath();
      c.arc(180, 96, radius, 0, Math.PI * 2);
      c.stroke();
    }
    c.font = '8px monospace';
    c.fillStyle = 'rgba(145,126,113,.45)';
    c.fillText('LR', 180, 99);
    c.fillStyle = '#66504b';
    c.font = 'bold 16px monospace';
    c.fillText('RET-031', 130, 98);
    c.font = '8px monospace';
    c.fillStyle = '#90796a';
    c.fillText('原箱标记', 110, 131);
    c.font = 'bold 17px monospace';
    c.fillStyle = '#66504b';
    c.fillText('P03', 155, 134);
    c.font = '10px monospace';
    c.fillText('签收', 104, 165);
    c.strokeStyle = '#a9947e';
    c.lineWidth = .8;
    c.beginPath();
    c.moveTo(120, 167);
    c.lineTo(164, 167);
    c.stroke();
    // The original ink always uses the surviving original paper, including after repair.
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this.mask.canvas, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  private prepareMud(progress: number) {
    const c = this.remainingMud.context;
    c.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    c.drawImage(this.mud.canvas, 0, 0);
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.lineWidth = 35;
    c.lineCap = 'round';
    c.strokeStyle = '#fff';
    for (const [index, pass] of restorationBrushPasses(progress).entries()) {
      if (pass.progress === 0) continue;
      c.beginPath();
      const first = this.brushSweep(pass, index, 0);
      c.moveTo(first.x, first.y);
      for (let segment = 1; segment <= 12; segment++) {
        const point = this.brushSweep(pass, index, pass.progress * segment / 12);
        c.lineTo(point.x, point.y);
      }
      c.stroke();
    }
    c.restore();
    c.save();
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this.mask.canvas, 0, 0);
    c.restore();
  }

  private brushPath(pass: ReturnType<typeof restorationBrushPasses>[number]) {
    const row = this.paperRows[Math.min(TEXTURE_SIZE - 1, Math.round(pass.y))];
    const left = Math.max(0, (row?.left ?? 0) - 20);
    const right = Math.min(TEXTURE_SIZE, (row?.right ?? TEXTURE_SIZE) + 20);
    return pass.start.x === 0 ? {start: left, end: right} : {start: right, end: left};
  }

  private brushSweep(pass: ReturnType<typeof restorationBrushPasses>[number], index: number, progress: number) {
    const path = this.brushPath(pass);
    const sweep = clamp(progress / .72);
    let x = path.start + (path.end - path.start) * sweep;
    let y = pass.y;
    if (index < 7 && progress > .72) {
      const transition = smooth((progress - .72) / .28);
      const next = {...pass, y: pass.y + 32, start: pass.end, end: pass.start};
      const nextPath = this.brushPath(next);
      x += (nextPath.start - x) * transition;
      y += 32 * transition;
    }
    return {x, y};
  }

  private normalizedSourcePoint(x: number, y: number) {
    const crop = receiptRestorationRegistration().receipt.alphaBounds.visible16;
    return {
      x: TEXTURE_SIZE / 2 + this.fit.left + (x - crop.x) * this.fit.scale,
      y: TEXTURE_SIZE / 2 + this.fit.top + (y - crop.y) * this.fit.scale,
    };
  }

  private drawPatchLayer(c: CanvasRenderingContext2D, layer: 'patchBack' | 'patchFront', progress: number) {
    const registration = receiptRestorationRegistration().receipt;
    const stages = restorationRepairStages(progress);
    for (const id of ['upper', 'lower'] as const) {
      const installed = stages[id];
      if (installed === 0) continue;
      const target = registration.patchTargets[id];
      const corner = this.normalizedSourcePoint(target.srcRect.x, target.srcRect.y);
      const left = Math.max(0, Math.floor(corner.x) - 1);
      const top = Math.max(0, Math.floor(corner.y) - 1);
      const width = Math.ceil(corner.x + target.srcRect.width * this.fit.scale) + 1 - left;
      const height = Math.ceil(corner.y + target.srcRect.height * this.fit.scale) + 1 - top;
      const x = left - 18 * (1 - installed);
      const y = top - 4 * (1 - installed);
      c.save();
      c.globalAlpha = (registration.layers[layer].opacity ?? 1) * smooth(installed * 6);
      c.drawImage(this[layer].canvas, left, top, width, height, x, y, width, height);
      c.restore();
    }
  }

  private compose(frame: ReceiptRestorationFrame) {
    const c = this.combined.context;
    c.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    this.drawPatchLayer(c, 'patchBack', frame.repairing);
    c.drawImage(this.paper.canvas, 0, 0);
    c.drawImage(this.originalInk.canvas, 0, 0);
    const cleaning = restorationCleaningMotion(frame.phase === 'cleaning' ? frame.progress : frame.condition === 'found' ? 0 : 1);
    this.prepareMud(cleaning.wipe);
    c.drawImage(this.remainingMud.canvas, 0, 0);
    this.drawPatchLayer(c, 'patchFront', frame.repairing);
    return cleaning;
  }

  private illuminate(options: ReceiptRestorationDrawOptions) {
    const c = this.lit.context;
    c.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    c.drawImage(this.combined.canvas, 0, 0);
    c.save();
    c.globalCompositeOperation = 'source-atop';
    const units = TEXTURE_SIZE / options.frame;
    for (const light of options.lights) {
      const x = TEXTURE_SIZE / 2 + (light.x - options.center.x) * units;
      const y = TEXTURE_SIZE / 2 + (light.y - options.center.y) * units;
      const glow = c.createRadialGradient(x, y, 0, x, y, TEXTURE_SIZE * 1.75);
      glow.addColorStop(0, `rgba(255,191,89,${light.strength * .15})`);
      glow.addColorStop(1, 'rgba(255,191,89,0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    }
    const reflectionY = (Math.sin(options.seconds * .35) * .17 + .35) * TEXTURE_SIZE;
    const reflection = c.createLinearGradient(0, reflectionY - 32, TEXTURE_SIZE, reflectionY + 100);
    reflection.addColorStop(0, 'rgba(196,238,221,0)');
    reflection.addColorStop(.43, `rgba(196,238,221,${options.glass * .08})`);
    reflection.addColorStop(.53, `rgba(231,249,226,${options.glass * .12})`);
    reflection.addColorStop(.65, 'rgba(196,238,221,0)');
    c.fillStyle = reflection;
    c.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    c.restore();
  }

  private drawTriangle(c: CanvasRenderingContext2D, source: Point[], target: Point[]) {
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
    const centroid = {x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3};
    c.save();
    c.beginPath();
    for (const [index, point] of target.entries()) {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      const length = Math.max(.01, Math.hypot(dx, dy));
      const x = point.x + dx / length * .16;
      const y = point.y + dy / length * .16;
      if (index === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.clip();
    c.transform(ax, bx, ay, by, p.x - ax * a.x - ay * a.y, p.y - bx * a.x - by * a.y);
    c.drawImage(this.lit.canvas, 0, 0);
    c.restore();
  }

  private drawPaper(c: CanvasRenderingContext2D, mesh: ReturnType<typeof restorationPaperMesh>) {
    for (let row = 0; row < mesh.rows; row++) {
      for (let column = 0; column < mesh.columns.length - 1; column++) {
        const x1 = mesh.columns[column] * TEXTURE_SIZE;
        const x2 = mesh.columns[column + 1] * TEXTURE_SIZE;
        const y1 = row / mesh.rows * TEXTURE_SIZE;
        const y2 = (row + 1) / mesh.rows * TEXTURE_SIZE;
        const a = mesh.vertices[row][column];
        const b = mesh.vertices[row][column + 1];
        const d = mesh.vertices[row + 1][column];
        const e = mesh.vertices[row + 1][column + 1];
        this.drawTriangle(c, [{x: x1, y: y1}, {x: x2, y: y1}, {x: x2, y: y2}], [a, b, e]);
        this.drawTriangle(c, [{x: x1, y: y1}, {x: x1, y: y2}, {x: x2, y: y2}], [a, d, e]);
      }
    }
  }

  private visiblePaperBounds(mesh: ReturnType<typeof restorationPaperMesh>) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const row = this.paperRows[y];
      if (!row) continue;
      const points = [row.left, row.right, ...mesh.columns.map(u => u * TEXTURE_SIZE)
        .filter(x => x > row.left && x < row.right)];
      for (const x of points) {
        const point = restorationMeshPoint(mesh, x / TEXTURE_SIZE, y / TEXTURE_SIZE);
        const lower = restorationMeshPoint(mesh, x / TEXTURE_SIZE, (y + 1) / TEXTURE_SIZE);
        left = Math.min(left, point.x, lower.x);
        right = Math.max(right, point.x, lower.x);
        top = Math.min(top, point.y, lower.y);
        bottom = Math.max(bottom, point.y, lower.y);
      }
    }
    return {left, top, width: right - left, height: bottom - top};
  }

  private sourceRect(rect: PaperRect, center: {x: number; y: number}, frame: number) {
    const crop = receiptRestorationRegistration().receipt.alphaBounds.visible16;
    const scale = frame / crop.height;
    return {
      x: center.x + (rect.x - crop.x - crop.width / 2) * scale,
      y: center.y + (rect.y - crop.y - crop.height / 2) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  }

  private trayGeometry(options: ReceiptRestorationDrawOptions) {
    const tray = receiptRestorationRegistration().tools.tray;
    const rect = this.sourceRect(tray.paperRelative, options.center, options.frame);
    const contactY = rect.y + tray.contact.y / tray.size.height * rect.height;
    return {...rect, y: rect.y + options.receiverY - contactY, shift: options.receiverY - contactY};
  }

  private drawTray(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions, front: boolean) {
    const tray = receiptRestorationRegistration().tools.tray;
    const rect = this.trayGeometry(options);
    const top = front ? tray.frontLipY : 0;
    const bottom = front ? tray.size.height : tray.frontLipY;
    const height = bottom - top;
    c.drawImage(this.assets.tray, 0, top, tray.size.width, height,
      rect.x, rect.y + top / tray.size.height * rect.height,
      rect.width, height / tray.size.height * rect.height);
  }

  private drawSoil(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions, geometry: ReturnType<typeof receiptRestorationGeometry>, front: boolean) {
    if (geometry.soilOpacity <= 0) return;
    const registration = receiptRestorationRegistration();
    const soil = registration.soil[front ? 'front' : 'back'];
    const rect = this.sourceRect(soil.paperRelative, options.center, options.frame);
    let image: CanvasImageSource = front ? this.assets.soilFront : this.assets.soilBack;
    if (front) {
      const target = this.looseSoil.context;
      target.clearRect(0, 0, this.looseSoil.canvas.width, this.looseSoil.canvas.height);
      target.drawImage(this.assets.soilFront, 0, 0);
      target.save();
      target.globalCompositeOperation = 'destination-out';
      for (const [index, chip] of registration.soil.chips.entries()) {
        const amount = smooth((geometry.motion.soilBreak - index * .16) / .32);
        const texture = this.assets[`soilChip${index}` as 'soilChip0' | 'soilChip1' | 'soilChip2' | 'soilChip3'];
        target.globalAlpha = amount;
        target.drawImage(texture, chip.sourceRect.left - 5 * amount, chip.sourceRect.top - 5 * amount,
          chip.size.width + 10 * amount, chip.size.height + 10 * amount);
      }
      target.restore();
      image = this.looseSoil.canvas;
    }
    c.drawImage(image, rect.x, rect.y + this.trayGeometry(options).shift + geometry.motion.soilDrop * 18,
      rect.width, rect.height);
  }

  private drawSoilChips(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions, geometry: ReturnType<typeof receiptRestorationGeometry>, front: boolean) {
    const registration = receiptRestorationRegistration();
    const soil = this.sourceRect(registration.soil.front.paperRelative, options.center, options.frame);
    const seconds = geometry.motion.progress * RESTORATION_DURATIONS.excavate;
    const cleared = options.restorationFrame.cleaning;
    for (const [index, chip] of registration.soil.chips.entries()) {
      if ((index % 2 === 1) !== front) continue;
      const elapsed = seconds - [.90, 1.55, 2.25, 3.35][index];
      if (elapsed < 0) continue;
      const origin = {x: soil.x + (chip.sourceRect.left + chip.contact.x) / registration.soil.front.size.width * soil.width,
        y: options.receiverY - 4 - index % 2 * 2};
      const pose = restorationSoilChip(index, elapsed, origin, options.receiverY);
      const scale = chip.suggestedWorldWidth / chip.size.width;
      const cosine = Math.cos(pose.rotation);
      const sine = Math.sin(pose.rotation);
      const foot = Math.max(...chip.outline.map(([x, y]) => (x - chip.contact.x) * sine + (y - chip.contact.y) * cosine));
      const removal = smooth((cleared - .25) / .65);
      c.save();
      c.globalAlpha = 1 - removal;
      c.fillStyle = `rgba(31,19,30,${.16 / (1 + pose.height * .12)})`;
      c.beginPath();
      c.ellipse(pose.x, options.receiverY, chip.suggestedWorldWidth * .5, .5, 0, 0, Math.PI * 2);
      c.fill();
      c.translate(pose.x + (index % 2 === 0 ? -1 : 1) * removal * 6, pose.y - foot * scale + removal * 4);
      c.rotate(pose.rotation);
      c.drawImage(this.assets[`soilChip${index}` as 'soilChip0' | 'soilChip1' | 'soilChip2' | 'soilChip3'],
        -chip.contact.x * scale, -chip.contact.y * scale, chip.size.width * scale, chip.size.height * scale);
      c.restore();
    }
  }

  private paperPoint(x: number, y: number, mesh: ReturnType<typeof restorationPaperMesh>) {
    return restorationMeshPoint(mesh, x / TEXTURE_SIZE, y / TEXTURE_SIZE);
  }

  private drawSpatula(c: CanvasRenderingContext2D, point: Point, angle: number, flip = false) {
    const tool = receiptRestorationRegistration().tools.spatula;
    const scale = tool.suggestedWorldWidth / tool.size.width;
    c.save();
    c.translate(point.x, point.y);
    c.rotate(angle);
    c.scale(flip ? -1 : 1, 1);
    c.drawImage(this.assets.spatula, -tool.contact.x * scale, -tool.contact.y * scale,
      tool.size.width * scale, tool.size.height * scale);
    c.restore();
  }

  private drawExcavationTools(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions,
    geometry: ReturnType<typeof receiptRestorationGeometry>, mesh: ReturnType<typeof restorationPaperMesh>, front: boolean) {
    if (options.restorationFrame.phase !== 'excavating') return;
    const p = geometry.motion.progress;
    if (!front) {
      if (p < .70) return;
      const foot = this.paperPoint(this.paperFoot.x, this.paperFoot.y, mesh);
      if (foot.y > options.receiverY + 1) return;
      const entry = smooth((p - .70) / .10);
      const exit = geometry.motion.toolExit;
      this.drawSpatula(c, {x: foot.x + 16 * (1 - entry) + exit * 18,
        y: foot.y - 2 * (1 - entry) + exit * 4}, -.15 * (1 - entry) + exit * .18);
      return;
    }
    if (p >= .90) return;
    const row = this.paperRows[45];
    const edge = this.paperPoint((row?.left ?? 95) + 2, 45, mesh);
    const scrape = Math.sin(p / .22 * Math.PI * 6);
    const ground = {x: options.center.x - 10 + scrape * 2.5, y: options.receiverY - 10 - Math.abs(scrape) * 1.4};
    const pickup = smooth((p - .20) / .10);
    const exit = smooth((p - .77) / .13);
    const point = {x: ground.x + (edge.x - ground.x) * pickup - exit * 20,
      y: ground.y + (edge.y - ground.y) * pickup - exit * 5};
    this.drawSpatula(c, point, -.30 + geometry.motion.lever * .4 + scrape * (1 - pickup) * .12, true);
  }

  private drawCleaningBrush(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions,
    mesh: ReturnType<typeof restorationPaperMesh>, cleaning: ReturnType<typeof restorationCleaningMotion>) {
    if (options.restorationFrame.phase !== 'cleaning') return;
    const passes = restorationBrushPasses(cleaning.wipe);
    const active = passes.findIndex(candidate => candidate.progress < 1);
    const index = active < 0 ? passes.length - 1 : active;
    const pass = passes[index];
    const contact = this.brushSweep(pass, index, pass.progress);
    const point = this.paperPoint(contact.x, contact.y, mesh);
    const brush = receiptRestorationRegistration().tools.brush;
    const scale = brush.suggestedWorldWidth / brush.size.width;
    const pose = restorationBrushTransform(brush.root, brush.contact, cleaning.pressure);
    const dirty = this.dirtyBristles.context;
    dirty.clearRect(0, 0, brush.size.width, brush.size.height);
    dirty.drawImage(this.assets.brushBristles, 0, 0);
    dirty.save();
    dirty.globalCompositeOperation = 'source-atop';
    dirty.globalAlpha = cleaning.wipe * .60;
    dirty.drawImage(this.mud.canvas, 40, 70, 100, 100, 0, 80, 96, 83);
    dirty.restore();
    const approach = 1 - smooth(options.restorationFrame.progress / .10);
    c.save();
    c.translate(point.x + approach * 10 + cleaning.withdraw * 16,
      point.y - approach * 7 - cleaning.withdraw * 10);
    c.rotate(Math.sin(pass.progress * Math.PI * 2) * .08 - cleaning.withdraw * .18);
    c.scale(scale, scale);
    c.save();
    const matrix = pose.bristles;
    c.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    c.drawImage(this.dirtyBristles.canvas, 0, 0);
    c.restore();
    c.drawImage(this.assets.brushHandle, pose.handleOrigin.x, pose.handleOrigin.y);
    c.restore();
  }

  private drawRepairTool(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions,
    mesh: ReturnType<typeof restorationPaperMesh>) {
    if (options.restorationFrame.phase !== 'repairing') return;
    const stages = restorationRepairStages(options.restorationFrame.repairing);
    const targets = receiptRestorationRegistration().receipt.patchTargets;
    const upper = this.normalizedSourcePoint(targets.upper.contact.x, targets.upper.contact.y);
    const lower = this.normalizedSourcePoint(targets.lower.contact.x, targets.lower.contact.y);
    upper.x -= 18 * (1 - stages.upper);
    upper.y -= 4 * (1 - stages.upper);
    lower.x -= 18 * (1 - stages.lower);
    lower.y -= 4 * (1 - stages.lower);
    const source = {x: upper.x + (lower.x - upper.x) * stages.toolBetween,
      y: upper.y + (lower.y - upper.y) * stages.toolBetween};
    const point = this.paperPoint(source.x, source.y, mesh);
    this.drawSpatula(c, {x: point.x + stages.retract * 18, y: point.y - stages.retract * 8},
      -.12 + stages.toolBetween * .16);
  }

  private drawIdentification(
    c: CanvasRenderingContext2D,
    options: ReceiptRestorationDrawOptions,
    mesh: ReturnType<typeof restorationPaperMesh>,
  ) {
    if (options.restorationFrame.phase !== 'identifying') return;
    const p = options.restorationFrame.identifying;
    const y = Math.round(45 + p * 144);
    const row = this.paperRows[y];
    if (!row) return;
    const first = this.paperPoint(row.left + 2, y, mesh);
    const last = this.paperPoint(row.right - 2, y, mesh);
    c.save();
    c.strokeStyle = `rgba(178,231,208,${Math.sin(p * Math.PI) * .65})`;
    c.lineWidth = .8;
    c.beginPath();
    c.moveTo(first.x, first.y);
    c.lineTo(last.x, last.y);
    c.stroke();
    c.restore();
  }

  draw(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions): ReceiptRestorationDrawResult {
    const frame = options.restorationFrame;
    const geometry = receiptRestorationGeometry(frame, options.center, options.frame, options.receiverY);
    const rig = restorationPaperRig(options.seconds, {
      frame: options.frame,
      paperWidth: this.fit.width / TEXTURE_SIZE * options.frame,
      hingeV: this.hingeV,
      curlV: this.curlV,
      reveal: 1,
    }, geometry.trialBend);
    const mesh = restorationPaperMesh(rig, {center: geometry.paperCenter, frame: options.frame,
      rotation: geometry.rotation, upperLift: geometry.upperLift, upperOut: geometry.upperOut,
      lowerSpread: geometry.lowerSpread, lowerLift: geometry.lowerLift, pullBend: geometry.pullBend,
      pivot: {x: options.center.x + (this.paperFoot.x / TEXTURE_SIZE - .5) * options.frame, y: geometry.pivotY},
      pivotU: this.paperFoot.x / TEXTURE_SIZE, sectionTilts: geometry.motion.sectionTilts});
    const cleaning = this.compose(frame);
    this.illuminate({...options, center: geometry.paperCenter});
    c.save();
    c.imageSmoothingEnabled = false;
    this.drawTray(c, options, false);
    this.drawSoil(c, options, geometry, false);
    this.drawSoilChips(c, options, geometry, false);
    const lightStrength = options.lights.reduce((sum, light) => sum + light.strength, 0);
    const keyX = lightStrength > 0
      ? options.lights.reduce((sum, light) => sum + light.x * light.strength, 0) / lightStrength
      : options.center.x;
    const shadowShift = Math.max(-3, Math.min(3, (geometry.paperCenter.x - keyX) * .025));
    const height = Math.max(0, options.receiverY - geometry.paperCenter.y);
    const shadowAlpha = .045 + .06 * clamp(1 - height / 80);
    c.fillStyle = `rgba(24,15,34,${shadowAlpha})`;
    c.beginPath();
    c.ellipse(options.center.x + shadowShift, options.receiverY, 12, 1.2, 0, 0, Math.PI * 2);
    c.fill();
    this.drawExcavationTools(c, options, geometry, mesh, false);
    this.drawPaper(c, mesh);
    this.drawSoil(c, options, geometry, true);
    this.drawSoilChips(c, options, geometry, true);
    this.drawExcavationTools(c, options, geometry, mesh, true);
    this.drawTray(c, options, true);
    this.drawCleaningBrush(c, options, mesh, cleaning);
    this.drawRepairTool(c, options, mesh);
    this.drawIdentification(c, options, mesh);
    c.restore();
    return {
      attachments: {
        leftEdge: Array.from({length:11},(_,index)=>{const y=60+index*16;return this.paperPoint((this.paperRows[y]?.left??90)+1,y,mesh);}),
        rightEdge: Array.from({length:11},(_,index)=>{const y=60+index*16;return this.paperPoint((this.paperRows[y]?.right??160)-1,y,mesh);}),
        leftTop: this.paperPoint((this.paperRows[60]?.left ?? 90) + 1, 60, mesh),
        leftBottom: this.paperPoint((this.paperRows[220]?.left ?? 90) + 1, 220, mesh),
        rightTop: this.paperPoint((this.paperRows[60]?.right ?? 160) - 1, 60, mesh),
        rightBottom: this.paperPoint((this.paperRows[220]?.right ?? 160) - 1, 220, mesh),
      },
      tier: frame.caseTier,
      reveal: frame.cleaning,
      bounds: this.visiblePaperBounds(mesh),
      restoration: {
        phase: frame.phase,
        condition: frame.condition,
        cleaning: cleaning.wipe,
        repairing: frame.repairing,
        excavation: frame.excavation,
        originalCode: frame.original.artifactCode,
        missingCount: frame.reading.missingCount,
      },
    };
  }
}

const painters = new WeakMap<HTMLImageElement, ReceiptRestorationPainter>();

export function drawReceiptRestoration(
  c: CanvasRenderingContext2D,
  assets: ReceiptRestorationAssets,
  options: ReceiptRestorationDrawOptions,
): ReceiptRestorationDrawResult {
  let painter = painters.get(assets.paper);
  if (!painter) {
    painter = new ReceiptRestorationPainter(assets);
    painters.set(assets.paper, painter);
  }
  return painter.draw(c, options);
}
