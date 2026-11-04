import type {ReceiptRestorationFrame} from '../review/receipt-restoration';
import {fitReceiptSpecimen, receiptPaperRig, type PaperRect, type ReceiptLight} from './receipt-specimen';

export const receiptRestorationCamera = {left: 125, top: 390, width: 100, height: 146} as const;
const TEXTURE_SIZE = 256;
const BAND_COUNT = 9;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function smooth(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function receiptRestorationGeometry(
  frame: ReceiptRestorationFrame,
  center: {x: number; y: number},
  size: number,
  receiverY: number,
) {
  const lift = smooth(frame.excavation);
  const buriedCenterY = receiverY + size * .27;
  const paperCenter = {x: center.x, y: center.y + (1 - lift) * (buriedCenterY - center.y)};
  const paperBounds = {
    left: paperCenter.x - size / 2,
    top: paperCenter.y - size / 2,
    width: size,
    height: size,
  };
  return {
    paperCenter,
    paperBounds,
    soilOpacity: 1 - smooth((frame.excavation - .72) / .28),
    trialBend: frame.phase === 'trying' ? Math.sin(frame.trying * Math.PI * 2) * .8 : 0,
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
type BrushRegistration = {
  file: string;
  size: {width: number; height: number};
  contact: {x: number; y: number};
  pivot: {x: number; y: number};
  suggestedWorldWidth: number;
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
  soil: {back: RegisteredSprite; front: RegisteredSprite};
  tools: {tray: TrayRegistration; brush: BrushRegistration};
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
  brush: HTMLImageElement;
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
  '../../assets/runtime/v034/restoration-brush.webp',
], {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const registrations = import.meta.glob('../../assets/runtime/v034/registration.json', {
  eager: true, import: 'default',
}) as Record<string, ReceiptRestorationRegistration>;

export function receiptRestorationRegistration() {
  const registration = registrations['../../assets/runtime/v034/registration.json'];
  if (!registration) throw new Error('Missing V0.3.4 receipt registration');
  return registration;
}

export function createReceiptRestorationAssets(): ReceiptRestorationAssets {
  const registration = receiptRestorationRegistration();
  const load = (file: string) => {
    const path = `../../assets/runtime/v034/${file}`;
    const url = urls[path];
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
    brush: load(registration.tools.brush.file),
  };
}

type Surface = {canvas: HTMLCanvasElement; context: CanvasRenderingContext2D};

function surface(): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
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
  private fit: ReturnType<typeof fitReceiptSpecimen>;
  private hingeV: number;
  private curlV: number;
  private paperRows: ({left: number; right: number} | null)[];

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
    c.lineWidth = 43;
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
    this.prepareMud(frame.cleaning);
    c.drawImage(this.remainingMud.canvas, 0, 0);
    this.drawPatchLayer(c, 'patchFront', frame.repairing);
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

  private drawPaper(
    c: CanvasRenderingContext2D,
    options: ReceiptRestorationDrawOptions,
    geometry: ReturnType<typeof receiptRestorationGeometry>,
    rig: ReturnType<typeof restorationPaperRig>,
  ) {
    const sourceStep = TEXTURE_SIZE / BAND_COUNT;
    const sourcePixel = TEXTURE_SIZE / receiptRestorationRegistration().receipt.alphaBounds.visible16.height;
    for (let band = 0; band < BAND_COUNT; band++) {
      const first = rig.nodes[band];
      const last = rig.nodes[band + 1];
      const shear = (last.x - first.x) / sourceStep;
      const verticalScale = (last.y - first.y) / sourceStep;
      const boundary = band * sourceStep;
      const top = Math.max(0, boundary - sourcePixel);
      const bottom = Math.min(TEXTURE_SIZE, boundary + sourceStep + sourcePixel);
      c.save();
      c.transform(options.frame / TEXTURE_SIZE, 0, shear, verticalScale,
        geometry.paperCenter.x - options.frame / 2 + first.x - shear * boundary,
        geometry.paperCenter.y + first.y - verticalScale * boundary);
      c.drawImage(this.lit.canvas, 0, top, TEXTURE_SIZE, bottom - top, 0, top, TEXTURE_SIZE, bottom - top);
      c.restore();
    }
  }

  private visiblePaperBounds(
    center: {x: number; y: number},
    frame: number,
    rig: ReturnType<typeof restorationPaperRig>,
  ) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const row = this.paperRows[y];
      if (!row) continue;
      const position = y / TEXTURE_SIZE * BAND_COUNT;
      const band = Math.min(BAND_COUNT - 1, Math.floor(position));
      const fraction = position - band;
      const a = rig.nodes[band];
      const b = rig.nodes[band + 1];
      const displacement = a.x + (b.x - a.x) * fraction;
      const worldY = a.y + (b.y - a.y) * fraction;
      left = Math.min(left, center.x + displacement + (row.left / TEXTURE_SIZE - .5) * frame);
      right = Math.max(right, center.x + displacement + (row.right / TEXTURE_SIZE - .5) * frame);
      top = Math.min(top, center.y + worldY);
      bottom = Math.max(bottom, center.y + worldY + (b.y - a.y) / (TEXTURE_SIZE / BAND_COUNT));
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

  private drawSoil(c: CanvasRenderingContext2D, options: ReceiptRestorationDrawOptions, front: boolean) {
    const geometry = receiptRestorationGeometry(options.restorationFrame, options.center, options.frame, options.receiverY);
    if (geometry.soilOpacity <= 0) return;
    const soil = receiptRestorationRegistration().soil[front ? 'front' : 'back'];
    const rect = this.sourceRect(soil.paperRelative, options.center, options.frame);
    c.save();
    c.globalAlpha = geometry.soilOpacity;
    c.drawImage(front ? this.assets.soilFront : this.assets.soilBack,
      rect.x, rect.y + this.trayGeometry(options).shift, rect.width, rect.height);
    c.restore();
  }

  private paperPoint(
    x: number,
    y: number,
    options: ReceiptRestorationDrawOptions,
    geometry: ReturnType<typeof receiptRestorationGeometry>,
    rig: ReturnType<typeof restorationPaperRig>,
  ) {
    const position = clamp(y / TEXTURE_SIZE) * BAND_COUNT;
    const band = Math.min(BAND_COUNT - 1, Math.floor(position));
    const fraction = position - band;
    const a = rig.nodes[band];
    const b = rig.nodes[band + 1];
    return {
      x: geometry.paperCenter.x + (x / TEXTURE_SIZE - .5) * options.frame + a.x + (b.x - a.x) * fraction,
      y: geometry.paperCenter.y + a.y + (b.y - a.y) * fraction,
    };
  }

  private clampJaw(c: CanvasRenderingContext2D, contact: {x: number; y: number}) {
    c.fillStyle = '#92734e';
    c.fillRect(contact.x - 1.4, contact.y - 1.4, .9, 2.8);
    c.fillStyle = '#e0c18a';
    c.fillRect(contact.x - .5, contact.y - 1.4, 1.8, .8);
    c.fillStyle = '#b59463';
    c.fillRect(contact.x - .5, contact.y + .6, 1.8, .8);
    c.fillStyle = '#9dd4bc';
    c.fillRect(contact.x - .4, contact.y - .35, 1, 1);
  }

  private drawLiftingArm(
    c: CanvasRenderingContext2D,
    options: ReceiptRestorationDrawOptions,
    geometry: ReturnType<typeof receiptRestorationGeometry>,
    rig: ReturnType<typeof restorationPaperRig>,
    front: boolean,
  ) {
    const frame = options.restorationFrame;
    if (frame.phase !== 'excavating') return;
    const rowY = 200;
    const row = this.paperRows[rowY];
    const contact = this.paperPoint((row?.left ?? 65) + 3, rowY, options, geometry, rig);
    const alpha = 1 - smooth((frame.progress - .86) / .14);
    c.save();
    c.globalAlpha = alpha;
    if (front) {
      this.clampJaw(c, contact);
    } else {
      c.strokeStyle = '#b59561';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(options.center.x - 28, options.receiverY - 1);
      c.lineTo(options.center.x - 29, contact.y + 6);
      c.lineTo(contact.x, contact.y);
      c.stroke();
    }
    c.restore();
  }

  private drawCleaningBrush(
    c: CanvasRenderingContext2D,
    options: ReceiptRestorationDrawOptions,
    geometry: ReturnType<typeof receiptRestorationGeometry>,
    rig: ReturnType<typeof restorationPaperRig>,
  ) {
    if (options.restorationFrame.phase !== 'cleaning') return;
    const passes = restorationBrushPasses(options.restorationFrame.cleaning);
    const active = passes.findIndex(candidate => candidate.progress < 1);
    const index = active < 0 ? passes.length - 1 : active;
    const pass = passes[index];
    const contact = this.brushSweep(pass, index, pass.progress);
    const point = this.paperPoint(contact.x, contact.y, options, geometry, rig);
    const brush = receiptRestorationRegistration().tools.brush;
    const scale = brush.suggestedWorldWidth / brush.size.width;
    c.save();
    c.translate(point.x, point.y);
    c.rotate(Math.sin(pass.progress * Math.PI * 2) * .08);
    c.drawImage(this.assets.brush, -brush.contact.x * scale, -brush.contact.y * scale,
      brush.size.width * scale, brush.size.height * scale);
    c.restore();
    for (let particle = 0; particle < 3; particle++) {
      const life = (options.seconds * 4 + particle * .31) % 1;
      c.fillStyle = `rgba(175,135,86,${(1 - life) * .55})`;
      c.fillRect(point.x - 2 + particle * 1.5, point.y - life * 4, .65, .65);
    }
  }

  private drawRepairTool(
    c: CanvasRenderingContext2D,
    options: ReceiptRestorationDrawOptions,
    geometry: ReturnType<typeof receiptRestorationGeometry>,
    rig: ReturnType<typeof restorationPaperRig>,
  ) {
    if (options.restorationFrame.phase !== 'repairing') return;
    const stages = restorationRepairStages(options.restorationFrame.repairing);
    const targets = receiptRestorationRegistration().receipt.patchTargets;
    const upper = this.normalizedSourcePoint(targets.upper.contact.x, targets.upper.contact.y);
    const lower = this.normalizedSourcePoint(targets.lower.contact.x, targets.lower.contact.y);
    upper.x -= 18 * (1 - stages.upper);
    upper.y -= 4 * (1 - stages.upper);
    lower.x -= 18 * (1 - stages.lower);
    lower.y -= 4 * (1 - stages.lower);
    const texturePoint = {
      x: upper.x + (lower.x - upper.x) * stages.toolBetween,
      y: upper.y + (lower.y - upper.y) * stages.toolBetween,
    };
    const target = this.paperPoint(texturePoint.x, texturePoint.y, options, geometry, rig);
    const base = {x: options.center.x - 28, y: options.receiverY - 2};
    const contact = {
      x: target.x + (base.x - target.x) * stages.retract,
      y: target.y + (base.y - target.y) * stages.retract,
    };
    const elbow = {x: Math.min(base.x + 3, contact.x - 5), y: contact.y + 4};
    c.save();
    c.strokeStyle = '#ad915f';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(base.x, base.y);
    c.lineTo(elbow.x, elbow.y);
    c.lineTo(contact.x, contact.y);
    c.stroke();
    c.fillStyle = '#8b6e4d';
    c.beginPath();
    c.arc(elbow.x, elbow.y, 1.1, 0, Math.PI * 2);
    c.fill();
    this.clampJaw(c, contact);
    c.restore();
  }

  private drawIdentification(
    c: CanvasRenderingContext2D,
    options: ReceiptRestorationDrawOptions,
    geometry: ReturnType<typeof receiptRestorationGeometry>,
    rig: ReturnType<typeof restorationPaperRig>,
  ) {
    if (options.restorationFrame.phase !== 'identifying') return;
    const p = options.restorationFrame.identifying;
    const y = Math.round(45 + p * 144);
    const row = this.paperRows[y];
    if (!row) return;
    const first = this.paperPoint(row.left + 2, y, options, geometry, rig);
    const last = this.paperPoint(row.right - 2, y, options, geometry, rig);
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
    this.compose(frame);
    this.illuminate({...options, center: geometry.paperCenter});
    c.save();
    c.imageSmoothingEnabled = false;
    this.drawTray(c, options, false);
    this.drawSoil(c, options, false);
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
    this.drawLiftingArm(c, options, geometry, rig, false);
    this.drawPaper(c, options, geometry, rig);
    this.drawLiftingArm(c, options, geometry, rig, true);
    this.drawSoil(c, options, true);
    this.drawTray(c, options, true);
    this.drawCleaningBrush(c, options, geometry, rig);
    this.drawRepairTool(c, options, geometry, rig);
    this.drawIdentification(c, options, geometry, rig);
    c.restore();
    return {
      tier: frame.caseTier,
      reveal: frame.cleaning,
      bounds: this.visiblePaperBounds(geometry.paperCenter, options.frame, rig),
      restoration: {
        phase: frame.phase,
        condition: frame.condition,
        cleaning: frame.cleaning,
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
