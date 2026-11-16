/** D1-only paper rig. Every band shares its boundary with its neighbours. */
import type {ReceiptExperimentFrame} from '../review/receipt-reading';
import {prepareReceiptInnerPaper,paintReceiptInnerContent,drawReceiptUnfold,drawReceiptTicket} from './receipt-experiment';
const BAND_COUNT = 9;
const TEXTURE_SIZE = 256;
const TRANSITION_SECONDS = 1;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
function smooth(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function fitReceiptSpecimen(width: number, height: number, frame: number) {
  const scale = frame / Math.max(width, height);
  return {
    left: -width * scale / 2,
    top: -height * scale / 2,
    width: width * scale,
    height: height * scale,
    scale,
  };
}

type RigOptions = {
  frame: number;
  paperWidth: number;
  hingeV: number;
  curlV: number;
  reveal: number;
};

export function receiptPaperRig(seconds: number, options: RigOptions) {
  const {frame, paperWidth, hingeV, curlV, reveal} = options;
  const horizontalRoom = Math.max(0, (frame - paperWidth) / 2 - .1);
  const unfold = Math.sin(Math.PI * clamp(reveal));
  const nodes = Array.from({length: BAND_COUNT + 1}, (_, index) => {
    if (index === 0) return {x: 0, y: -frame / 2};
    if (index === BAND_COUNT) return {x: 0, y: frame / 2};
    const v = index / BAND_COUNT;
    const anchored=index<=Math.ceil(hingeV*BAND_COUNT);
    const body = anchored?0:(v - hingeV) * Math.sin(Math.PI * v);
    const curl = smooth((v - curlV) / (1 - curlV)) * (1 - v) * 6;
    const displacement = body * Math.sin(seconds * .85) * 1.2
      + curl * (Math.sin(seconds * 1.35 - .8) * 1.1 + unfold * .9);
    return {
      x: Math.max(-horizontalRoom, Math.min(horizontalRoom, displacement)),
      y: (v - .5) * frame + body * Math.sin(seconds * .9 - .3) * .45,
    };
  });
  return {nodes};
}

export type ReceiptTransition = {
  level: number;
  fromLevel: number;
  since: number;
  lastSeconds: number;
  mix: number;
};

export function advanceReceiptTransition(
  previous: ReceiptTransition | undefined,
  level: number,
  seconds: number,
  installation = 1,
): ReceiptTransition {
  if (!previous || seconds < previous.lastSeconds) {
    return {level, fromLevel: level, since: seconds, lastSeconds: seconds, mix: 1};
  }
  if (previous.level !== level) {
    return {
      level,
      fromLevel: previous.mix >= .5 ? previous.level : previous.fromLevel,
      since: seconds,
      lastSeconds: seconds,
      mix: 0,
    };
  }
  const mix = Math.min(smooth((seconds - previous.since) / TRANSITION_SECONDS), clamp(installation));
  return {...previous, fromLevel: mix === 1 ? level : previous.fromLevel, lastSeconds: seconds, mix};
}

export function receiptRevealAt(progress: number, v: number) {
  return smooth((clamp(progress) - clamp(v) * .45) / .55);
}

export type ReceiptSpecimenAssets = {
  specimen0: HTMLImageElement;
  specimen1: HTMLImageElement;
  specimen2: HTMLImageElement;
  specimen3: HTMLImageElement;
  innerBlank:HTMLImageElement;
};

export type PaperRect = {x: number; y: number; width: number; height: number};
type TierRegistration = {
  file: string;
  alphaBounds: {visible16: PaperRect};
  paperFace: PaperRect;
  inkStrip: PaperRect;
  returnStamp: PaperRect;
  lowerCurl: PaperRect;
  unfoldCutY?:number;
  hingeUv: {x: number; y: number};
};
type SpecimenRegistration = {
  common: {
    vaultEmitters?: {world: PaperRect}[];
    floorReceivers: Record<'basic'|'brass'|'vault', {
      sourceRect: PaperRect;
      outputRect?: PaperRect;
      worldRect: PaperRect;
      sourceFrontLipY: number;
      frontLipY?: number;
      hasBakedFloorFill: boolean;
    }>;
  };
  receipts: {
    tiers: TierRegistration[];
    innerPaper:TierRegistration;
    common: {
      hingeUv: {x: number; y: number};
    };
  };
};

const imageUrls = import.meta.glob(['../../assets/runtime/d1-refinement/receipt-tier-*.webp','../../assets/runtime/d1-refinement/receipt-inner-blank.webp'], {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const registrationFiles = import.meta.glob('../../assets/runtime/d1-refinement/registration.json', {
  eager: true, import: 'default',
}) as Record<string, SpecimenRegistration>;

export function createReceiptSpecimenAssets(): ReceiptSpecimenAssets {
  const load = (name:string) => {
    const path = `../../assets/runtime/d1-refinement/${name}.webp`;
    const url = imageUrls[path];
    if (!url) throw new Error(`Missing D1 receipt specimen ${name}`);
    const image = new Image();
    image.src = url;
    return image;
  };
  return {specimen0:load('receipt-tier-0'),specimen1:load('receipt-tier-1'),specimen2:load('receipt-tier-2'),specimen3:load('receipt-tier-3'),innerBlank:load('receipt-inner-blank')};
}

export function receiptSpecimenRegistration() {
  const registration = registrationFiles['../../assets/runtime/d1-refinement/registration.json'];
  if (!registration) throw new Error('Missing D1 receipt specimen registration');
  return registration;
}

export type ReceiptLight = {x: number; y: number; strength: number};
export type ReceiptSpecimenOptions = {
  center: {x: number; y: number};
  frame: number;
  seconds: number;
  level: number;
  installation: number;
  lights: ReceiptLight[];
  glass: number;
  experiment?:ReceiptExperimentFrame;
  receiverY?:number;
};
export type ReceiptSpecimenResult = {
  tier: number;
  reveal: number;
  bounds: {left: number; top: number; width: number; height: number};
  experiment?:{
    phase:ReceiptExperimentFrame['phase'];researchLevel:number;extension:number;bottom:number;
    floorGap:number;hinge:{x:number;y:number};renderedLineIds:string[];
  };
};

type Surface = {canvas: HTMLCanvasElement; context: CanvasRenderingContext2D};
type PaperRow = {left: number; right: number} | null;
type PreparedPaper = {
  surface: Surface;
  ink: Surface;
  stamp: PaperRect;
  fit: ReturnType<typeof fitReceiptSpecimen>;
  hingeV: number;
  curlV: number;
  sourcePixel: number;
  profile: PaperRow[];
  face:PaperRect;
  hinge:{x:number;y:number};
};

function surface(): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  return {canvas, context: canvas.getContext('2d')!};
}

function mappedRect(rect: PaperRect, crop: PaperRect, fit: ReturnType<typeof fitReceiptSpecimen>): PaperRect {
  return {
    x: TEXTURE_SIZE / 2 + fit.left + (rect.x - crop.x) * fit.scale,
    y: TEXTURE_SIZE / 2 + fit.top + (rect.y - crop.y) * fit.scale,
    width: rect.width * fit.scale,
    height: rect.height * fit.scale,
  };
}

function contains(rect: PaperRect, x: number, y: number) {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function preparePaper(image: HTMLImageElement, registration: TierRegistration): PreparedPaper {
  const crop = registration.alphaBounds.visible16;
  const fit = fitReceiptSpecimen(crop.width, crop.height, TEXTURE_SIZE);
  const paper = surface();
  paper.context.imageSmoothingEnabled = false;
  paper.context.drawImage(
    image, crop.x, crop.y, crop.width, crop.height,
    TEXTURE_SIZE / 2 + fit.left, TEXTURE_SIZE / 2 + fit.top, fit.width, fit.height,
  );
  const ink = surface();
  const face=mappedRect(registration.paperFace,crop,fit);
  const pixels = paper.context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const inkRect = mappedRect(registration.inkStrip, crop, fit);
  const stamp = mappedRect(registration.returnStamp, crop, fit);
  const profile: PaperRow[] = Array.from({length: TEXTURE_SIZE}, () => null);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const offset = (y * TEXTURE_SIZE + x) * 4;
      if (pixels.data[offset + 3] >= 16) {
        const row = profile[y];
        if (row) row.right = x + 1;
        else profile[y] = {left: x, right: x + 1};
      }
      const luminance = pixels.data[offset] * .2126 + pixels.data[offset + 1] * .7152 + pixels.data[offset + 2] * .0722;
      const isInk = contains(inkRect, x, y) || contains(stamp, x, y);
      pixels.data[offset + 3] *= isInk ? clamp((205 - luminance) / 95) : 0;
    }
  }
  ink.context.putImageData(pixels, 0, 0);
  return {
    surface: paper,
    ink,
    stamp,
    fit,
    hingeV: clamp((registration.hingeUv.y * image.naturalHeight - crop.y) / crop.height),
    curlV: Math.max(.68, Math.min(.86, ((registration.unfoldCutY??registration.lowerCurl.y) - crop.y) / crop.height)),
    sourcePixel: TEXTURE_SIZE / crop.height,
    profile,
    face,
    hinge:{
      x:TEXTURE_SIZE/2+fit.left+(registration.hingeUv.x*image.naturalWidth-crop.x)*fit.scale,
      y:TEXTURE_SIZE/2+fit.top+(registration.hingeUv.y*image.naturalHeight-crop.y)*fit.scale,
    },
  };
}

class ReceiptSpecimenPainter {
  private papers: PreparedPaper[];
  private innerPaper:PreparedPaper;
  private innerMaterial:ReturnType<typeof prepareReceiptInnerPaper>;
  private litFrom = surface();
  private litTo = surface();
  private revealed = surface();
  private combined = surface();
  private experimentPage=surface();
  private experimentLit=surface();
  private transition?: ReceiptTransition;

  constructor(images: HTMLImageElement[], registrations: TierRegistration[],blank:HTMLImageElement,blankRegistration:TierRegistration) {
    this.papers = images.map((image, index) => preparePaper(image, registrations[index]));
    this.innerPaper=preparePaper(blank,blankRegistration);
    this.innerMaterial=prepareReceiptInnerPaper(this.innerPaper.surface.canvas,this.innerPaper.face,this.innerPaper.curlV);
  }

  private illuminate(index: number, target: Surface, options: ReceiptSpecimenOptions,innerPage?:HTMLCanvasElement) {
    const {context: c} = target;
    const paper = this.papers[index];
    const units = TEXTURE_SIZE / options.frame;
    c.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    c.drawImage(innerPage??paper.surface.canvas, 0, 0);
    c.save();
    c.globalCompositeOperation = 'source-atop';
    for (const light of options.lights) {
      const x = TEXTURE_SIZE / 2 + (light.x - options.center.x) * units;
      const y = TEXTURE_SIZE / 2 + (light.y - options.center.y) * units;
      const glow = c.createRadialGradient(x, y, 0, x, y, TEXTURE_SIZE * 1.75);
      glow.addColorStop(0, `rgba(255,191,89,${light.strength * .15})`);
      glow.addColorStop(1, 'rgba(255,191,89,0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    }
    const glassPosition = (Math.sin(options.seconds * .35) * .17 + .35) * TEXTURE_SIZE;
    const reflection = c.createLinearGradient(0, glassPosition - 32, TEXTURE_SIZE, glassPosition + 100);
    reflection.addColorStop(0, 'rgba(196,238,221,0)');
    reflection.addColorStop(.43, `rgba(196,238,221,${options.glass * .08})`);
    reflection.addColorStop(.53, `rgba(231,249,226,${options.glass * .12})`);
    reflection.addColorStop(.65, 'rgba(196,238,221,0)');
    c.fillStyle = reflection;
    c.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    const curlShade = c.createLinearGradient(0, TEXTURE_SIZE * paper.curlV, 0, TEXTURE_SIZE);
    curlShade.addColorStop(0, 'rgba(52,28,60,0)');
    curlShade.addColorStop(.45, `rgba(52,28,60,${.055 + Math.sin(options.seconds * 1.35) * .015})`);
    curlShade.addColorStop(.7, 'rgba(255,224,171,.07)');
    curlShade.addColorStop(1, 'rgba(52,28,60,0)');
    c.fillStyle = curlShade;
    c.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    c.restore();
    if(innerPage)return;
    // Ink belongs to this paper surface. The rig below bends the stamp and fibres together.
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = .12 + (Math.sin(options.seconds * 1.1) + 1) * .045;
    c.drawImage(paper.ink.canvas, 0, 0);
    c.beginPath();
    c.rect(paper.stamp.x, paper.stamp.y, paper.stamp.width, paper.stamp.height);
    c.clip();
    c.globalAlpha = .12 + (Math.sin(options.seconds * .9 - .8) + 1) * .11;
    c.drawImage(paper.ink.canvas, 0, 0);
    c.restore();
  }

  private revealMask(target: Surface, mix: number, inverted: boolean) {
    const c = target.context;
    const mask = c.createLinearGradient(0, 0, 0, TEXTURE_SIZE);
    for (let step = 0; step <= 16; step++) {
      const v = step / 16;
      const reveal = receiptRevealAt(mix, v);
      mask.addColorStop(v, `rgba(255,255,255,${inverted ? 1 - reveal : reveal})`);
    }
    c.save();
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = mask;
    c.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    c.restore();
  }

  private drawBands(
    c: CanvasRenderingContext2D,
    image: HTMLCanvasElement,
    rig: ReturnType<typeof receiptPaperRig>,
    options: ReceiptSpecimenOptions,
    sourcePixel: number,
  ) {
    const sourceStep = TEXTURE_SIZE / BAND_COUNT;
    const horizontalScale = options.frame / TEXTURE_SIZE;
    for (let band = 0; band < BAND_COUNT; band++) {
      const first = rig.nodes[band];
      const last = rig.nodes[band + 1];
      const shear = (last.x - first.x) / sourceStep;
      const verticalScale = (last.y - first.y) / sourceStep;
      const boundary = band * sourceStep;
      const sourceTop = Math.max(0, boundary - sourcePixel);
      const sourceBottom = Math.min(TEXTURE_SIZE, boundary + sourceStep + sourcePixel);
      c.save();
      c.transform(
        horizontalScale, 0, shear, verticalScale,
        options.center.x - options.frame / 2 + first.x - shear * boundary,
        options.center.y + first.y - verticalScale * boundary,
      );
      c.drawImage(image, 0, sourceTop, TEXTURE_SIZE, sourceBottom - sourceTop, 0, sourceTop, TEXTURE_SIZE, sourceBottom - sourceTop);
      c.restore();
    }
  }

  private visibleBounds(
    paper: PreparedPaper,
    previous: PreparedPaper,
    rig: ReturnType<typeof receiptPaperRig>,
    options: ReceiptSpecimenOptions,
    mix: number,
  ) {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const reveal = receiptRevealAt(mix, y / TEXTURE_SIZE);
      const current = reveal > 0 ? paper.profile[y] : null;
      const before = reveal < 1 ? previous.profile[y] : null;
      if (!current && !before) continue;
      const first = current ?? before!;
      const second = before ?? first;
      const rowLeft = Math.min(first.left, second.left);
      const rowRight = Math.max(first.right, second.right);
      const position = y / TEXTURE_SIZE * BAND_COUNT;
      const band = Math.min(BAND_COUNT - 1, Math.floor(position));
      const fraction = position - band;
      const a = rig.nodes[band], b = rig.nodes[band + 1];
      const x = a.x + (b.x - a.x) * fraction;
      const worldY = a.y + (b.y - a.y) * fraction;
      left = Math.min(left, options.center.x + x + (rowLeft / TEXTURE_SIZE - .5) * options.frame);
      right = Math.max(right, options.center.x + x + (rowRight / TEXTURE_SIZE - .5) * options.frame);
      top = Math.min(top, options.center.y + worldY);
      bottom = Math.max(bottom, options.center.y + worldY + (b.y - a.y) / (TEXTURE_SIZE / BAND_COUNT));
    }
    return {left, top, width: right - left, height: bottom - top};
  }

  draw(c: CanvasRenderingContext2D, options: ReceiptSpecimenOptions): ReceiptSpecimenResult {
    const paperLevel=options.experiment?.reading.researchLevel??options.level;
    this.transition = advanceReceiptTransition(this.transition, paperLevel, options.seconds, options.installation);
    const transition = this.transition;
    const paper = this.papers[transition.level];
    const previous = this.papers[transition.fromLevel];
    const rigPaper=options.experiment?this.innerPaper:paper;
    const mix = transition.fromLevel === transition.level ? 1 : transition.mix;
    const paperWidth = Math.max(paper.fit.width, previous.fit.width,rigPaper.fit.width) / TEXTURE_SIZE * options.frame;
    const rig = receiptPaperRig(options.seconds, {
      frame: options.frame,
      paperWidth,
      hingeV: rigPaper.hingeV,
      curlV: rigPaper.curlV,
      reveal: mix,
    });
    const composite = this.combined.context;
    composite.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    this.illuminate(transition.level, this.litTo, options);
    if (mix < 1) {
      this.illuminate(transition.fromLevel, this.litFrom, options);
      composite.drawImage(this.litFrom.canvas, 0, 0);
      this.revealMask(this.combined, mix, true);
      this.revealed.context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      this.revealed.context.drawImage(this.litTo.canvas, 0, 0);
      this.revealMask(this.revealed, mix, false);
      composite.save();
      // Complementary premultiplied masks keep the paper opaque through the detail reveal.
      composite.globalCompositeOperation = 'lighter';
      composite.drawImage(this.revealed.canvas, 0, 0);
      composite.restore();
    } else {
      composite.drawImage(this.litTo.canvas, 0, 0);
    }

    if(options.experiment){
      const experiment=options.experiment;
      const inner=this.innerPaper;
      const renderedLineIds=paintReceiptInnerContent(this.experimentPage,inner.surface.canvas,inner.face,inner.hinge.x,inner.profile,inner.curlV*TEXTURE_SIZE,experiment);
      this.illuminate(paperLevel,this.experimentLit,options,this.experimentPage.canvas);
      const hinge={
        x:options.center.x+(inner.hinge.x/TEXTURE_SIZE-.5)*options.frame,
        y:options.center.y+(inner.hinge.y/TEXTURE_SIZE-.5)*options.frame,
      };
      const receiverY=options.receiverY??options.center.y+options.frame/2+18;
      c.save();c.beginPath();
      c.rect(options.center.x-options.frame/2,options.center.y-options.frame/2,options.frame,receiverY-(options.center.y-options.frame/2));
      c.clip();c.imageSmoothingEnabled=false;
      const geometry=drawReceiptUnfold(c,{center:options.center,frame:options.frame,receiverY},experiment,{
        outer:this.combined.canvas,inner:this.experimentLit.canvas,extension:this.innerMaterial.extension.canvas,
        profile:inner.profile,curlV:inner.curlV,hinge,
      },rig,image=>this.drawBands(c,image,rig,options,paper.sourcePixel));
      c.restore();
      const bounds=this.visibleBounds(inner,inner,rig,options,1);
      return {
        tier:paperLevel,reveal:mix,bounds:{...bounds,left:bounds.left+Math.min(0,geometry.capShift),width:bounds.width+Math.abs(geometry.capShift),height:bounds.height+geometry.extension},
        experiment:{phase:experiment.phase,researchLevel:experiment.reading.researchLevel,
          extension:geometry.extension,bottom:geometry.bottom,floorGap:receiverY-geometry.bottom,hinge,renderedLineIds:experiment.open>.02?renderedLineIds:[]},
      };
    }

    c.save();
    c.beginPath();
    c.rect(options.center.x - options.frame / 2, options.center.y - options.frame / 2, options.frame, options.frame);
    c.clip();
    c.imageSmoothingEnabled = false;
    this.drawBands(c, this.combined.canvas, rig, options, paper.sourcePixel);
    c.restore();
    return {
      tier: transition.level,
      reveal: mix,
      bounds: this.visibleBounds(paper, previous, rig, options, mix),
    };
  }

  drawTicket(c:CanvasRenderingContext2D,options:ReceiptSpecimenOptions){
    const frame=options.experiment;
    if(!frame)return;
    const material=this.innerMaterial.grain.canvas;
    drawReceiptTicket(c,options.center,options.receiverY!,material,frame);
  }
}

const painters = new WeakMap<HTMLImageElement, ReceiptSpecimenPainter>();
export function drawReceiptSpecimen(
  c: CanvasRenderingContext2D,
  assets: ReceiptSpecimenAssets,
  options: ReceiptSpecimenOptions,
): ReceiptSpecimenResult {
  let painter = painters.get(assets.specimen0);
  if (!painter) {
    const images = [assets.specimen0, assets.specimen1, assets.specimen2, assets.specimen3];
    const registration=receiptSpecimenRegistration().receipts;
    painter = new ReceiptSpecimenPainter(images,registration.tiers,assets.innerBlank,registration.innerPaper);
    painters.set(assets.specimen0, painter);
  }
  return painter.draw(c, options);
}
export function drawReceiptSpecimenTicket(c:CanvasRenderingContext2D,assets:ReceiptSpecimenAssets,options:ReceiptSpecimenOptions){
  painters.get(assets.specimen0)?.drawTicket(c,options);
}
