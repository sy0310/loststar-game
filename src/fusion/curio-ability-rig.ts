import {modernReceiptBounds} from './receipt-paper-model';
import {receiptReadingRecords,receiptReadingLabel} from './receipt-reading-model';
import blankPaperUrl from '../../assets/runtime/visual-renewal/curios/receipt-inner-blank.webp';

export interface AbilityRigRecord {id: string; at: number; detail: string; source?: string; code?: string; orientation?: string}
export interface AbilityAttachments {
  leftTop:{x:number;y:number};leftBottom:{x:number;y:number};
  rightTop:{x:number;y:number};rightBottom:{x:number;y:number};
  leftEdge?:readonly {x:number;y:number}[];rightEdge?:readonly {x:number;y:number}[];
}
export interface CurioAbilityRigOptions {
  id: 'receipt' | 'tape';
  image: CanvasImageSource;
  seconds: number;
  abilityLevel: number;
  experimentProgress?: number;
  records?: readonly AbilityRigRecord[];
  size?: number;
  materialAlreadyPrepared?: boolean;
  materialRevision?: string;
  baseAlreadyDrawn?: boolean;
  attachments?: AbilityAttachments;
  receiverY?: number;
  cavity?: {left:number;top:number;width:number;height:number};
  serviceEnvelope?: number;
  reducedMotion?: boolean;
}
export interface CurioAbilityRigResult {
  bounds: {x: number; y: number; width: number; height: number};
  extension: number;
  usedRecordIds: string[];
}
let blankPaper: HTMLImageElement | undefined;
let paperReady: Promise<void> | undefined;

/** DOM resources are initialized only when the client mounts the specimen view. */
export function curioAbilityReady(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  if (!paperReady) {
    blankPaper = new Image();
    blankPaper.src = blankPaperUrl;
    paperReady = blankPaper.decode();
  }
  return paperReady;
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {const t = clamp(value);return t * t * (3 - 2 * t);};

function openingAt(options: CurioAbilityRigOptions) {
  const phase = (options.seconds + (options.id === 'tape' ? 2.3 : 0)) % 9;
  const idle = options.reducedMotion ? 1 : phase < 2 ? smooth(phase / 2) : phase < 5 ? 1 : phase < 7.5 ? 1 - smooth((phase - 5) / 2.5) : 0;
  if (options.experimentProgress !== undefined && options.experimentProgress > 0 && options.experimentProgress < 1) {
    const trial = Math.sin(options.experimentProgress * Math.PI);
    return (options.reducedMotion ? 1 - .3 * trial : idle + (1 - idle) * smooth(trial)) * (options.serviceEnvelope ?? 1);
  }
  return idle * (options.serviceEnvelope ?? 1);
}

/** Modern receipt: the original rectangle never grows appendices at any research level. */
function receipt(context:CanvasRenderingContext2D,options:CurioAbilityRigOptions,_extension:number):CurioAbilityRigResult{
 if(!options.baseAlreadyDrawn)context.drawImage(options.image,0,0,192,192);
 const level=Math.min(2,Math.max(0,Math.floor(options.abilityLevel)));
 const records=receiptReadingRecords(options.records??[],level);
 const trial=options.experimentProgress!==undefined&&options.experimentProgress>0&&options.experimentProgress<1?options.experimentProgress:0;
 const envelope=clamp(options.serviceEnvelope??1);
 const reading=(level>0||trial>0)&&envelope>.02;
 if(reading){
  const progress=trial||((options.seconds%7)/7);
  const scan=trial?Math.sin(trial*Math.PI):options.reducedMotion?.32:.42;
  // Scan existing original ink rows only: no text, marks or signature are printed onto the sheet.
  const y=options.reducedMotion?83:58+progress*64;
  context.save();context.beginPath();context.moveTo(57,57);context.lineTo(147,59);context.lineTo(139,124);context.lineTo(48,122);context.closePath();context.clip();
  context.globalCompositeOperation='screen';context.globalAlpha=scan*envelope;
  context.fillStyle='#68dafa';context.fillRect(46,y-1.8,104,3.6);context.fillStyle='#d7ffff';context.fillRect(46,y-.35,104,.7);context.restore();
  // This independent reader sits between archival feet. It does not enlarge paper bounds.
  context.save();context.globalAlpha=envelope;context.fillStyle='#a56b45';context.fillRect(56,174,1.5,4);context.fillRect(137,174,1.5,4);
  context.fillStyle='#2e1b42';context.fillRect(54,177,88,15);context.strokeStyle='#e3a454';context.lineWidth=1;context.strokeRect(54.5,177.5,87,14);
  context.fillStyle='#152c37';context.fillRect(57,180,82,9);
  context.font='5px monospace';context.textAlign='left';context.fillStyle='#8de7e7';
  if(!level)context.fillText('RET-031 / P03',60,186.5);
  else if(!records.length)context.fillText('等待现场线索',60,186.5);
  else{
   const labels=records.map(r=>`${receiptReadingLabel(r)} ${r.orientation==='inverted'?'180°':'0°'}`);
   context.fillText(`${level===1?'Ⅰ':'Ⅱ'} ${labels.join(' / ')}`,60,186.5);
  }
  context.restore();
 }
 return{bounds:{...modernReceiptBounds},extension:0,usedRecordIds:reading?records.map(r=>r.id):[]};
}

interface TapeLayers {revision: string; body: HTMLCanvasElement; tail: HTMLCanvasElement; renewal:boolean}
const tapeLayers = new WeakMap<object, TapeLayers>();
function tapeMaterial(image: CanvasImageSource, revision: string) {
  const cached = tapeLayers.get(image);
  if (cached?.revision === revision) return cached;
  const body = document.createElement('canvas'), tail = document.createElement('canvas');
  body.width = body.height = tail.width = tail.height = 192;
  const foreground = tail.getContext('2d')!;
  foreground.drawImage(image, 0, 0, 192, 192);
  foreground.globalCompositeOperation = 'destination-in';foreground.fillStyle = '#fff';
  const renewal='width' in image&&Number(image.width)===384;
  foreground.beginPath();
  const outline=renewal?[[22,122],[33,108],[65,92],[85,92],[78,107],[57,126],[50,142],[23,142]]:[[1,154],[14,136],[48,124],[76,126],[93,137],[73,153],[54,160],[45,177],[8,176]];
  outline.forEach(([x,y],i)=>i?foreground.lineTo(x,y):foreground.moveTo(x,y));foreground.closePath();foreground.fill();
  const background = body.getContext('2d')!;
  background.drawImage(image, 0, 0, 192, 192);background.globalCompositeOperation = 'destination-out';background.drawImage(tail, 0, 0);
  const value = {revision, body, tail,renewal};tapeLayers.set(image, value);return value;
}

export function drawTapeBridge(context: CanvasRenderingContext2D, image: CanvasImageSource,
  path: readonly {x: number; y: number}[], progress: number, width = 12) {
  const lengths = path.slice(1).map((point, index) => Math.hypot(point.x - path[index].x, point.y - path[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = total * clamp(progress);
  for (let index = 0; index < lengths.length; index++) {
    const start = path[index], end = path[index + 1];
    const length = Math.min(remaining, lengths[index]);
    if (length <= 0) break;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    context.save();context.translate(start.x, start.y);context.rotate(angle);
    context.fillStyle = '#64505d';context.fillRect(-1, -width / 2, length + 2, width + 2);
    const renewal='width' in image&&Number(image.width)===384;
    if(renewal)context.drawImage(image,58,244,48,20,0,-width/2,length,width);
    else context.drawImage(image,24,141,43,13,0,-width/2,length,width);
    context.fillStyle = '#ead7a6';context.globalAlpha = .55;context.fillRect(0, -width / 2, length, 1);
    context.restore();
    remaining -= length;
    if (remaining <= 0) break;
  }
}

function tape(context: CanvasRenderingContext2D, options: CurioAbilityRigOptions, extension: number): CurioAbilityRigResult {
  const level = Math.min(2, Math.max(0, options.abilityLevel));
  const material = tapeMaterial(options.image, options.materialRevision ?? 'base');
  const gain = level ? extension : Math.sin(options.seconds * 1.4) * .025 + .025;
  const active = level > 0 ? gain : 0;
  const trial = options.experimentProgress !== undefined && options.experimentProgress > 0 && options.experimentProgress < 1
    ? Math.sin(options.experimentProgress * Math.PI) * (options.serviceEnvelope ?? 1) : 0;
  if (level > 0 && blankPaper?.complete && blankPaper.naturalWidth) {
    context.save();
    context.translate(178, 133);context.rotate(-.12);
    context.drawImage(blankPaper, 79, 70, 57, 47, 0, 0, 29, 27);
    context.drawImage(blankPaper, 143, 93, 57, 47, 33 - active * 2, 0, 29, 27);
    context.strokeStyle = '#644b50';context.lineWidth = 2;
    context.beginPath();context.moveTo(29, 2);context.lineTo(32, 10);context.lineTo(29, 18);context.lineTo(31, 26);context.stroke();
    context.restore();
  }
  if (!options.baseAlreadyDrawn) context.drawImage(material.body, 0, 0);
  if (level > 0) {
    const path = [{x: material.renewal?45:80, y: material.renewal?123:131}, {x: 113, y: 139}, {x: 153, y: 149}, {x: 192, y: 151},
      {x: 220, y: 143}, {x: 234, y: 133}, {x: 226, y: 125}, {x: 203, y: 128}, {x: 201, y: 146}];
    drawTapeBridge(context, options.image, path, active, 12);
    if (level >= 2) drawTapeBridge(context, options.image,
      [{x: material.renewal?48:84, y: material.renewal?127:133}, {x: 117, y: 158}, {x: 162, y: 168}, {x: 206, y: 162}, {x: 230, y: 149}, {x: 222, y: 137}], clamp(active * 1.18 - .15), 10);
  }
  if (level === 0 && trial > 0) {
    drawTapeBridge(context, options.image,
      [{x: material.renewal?45:80, y: material.renewal?123:131}, {x: 51, y: 150}, {x: 24, y: 165}, {x: 4, y: 177}, {x: -18, y: 178}], trial, 12);
    if (trial > .72) {
      context.save();context.globalAlpha = (trial - .72) / .28;
      context.fillStyle = '#825b59';context.font = 'bold 8px monospace';context.textAlign = 'left';
      context.fillText('对不起', -16, 180);context.restore();
    }
  }
  const hinge=material.renewal?{x:80,y:96}:{x:80,y:131};
  context.save();context.translate(hinge.x,hinge.y);context.rotate(Math.sin(options.seconds * 1.4) * .035 + active * .04);context.translate(-hinge.x,-hinge.y);
  context.drawImage(material.tail, 0, 0);context.restore();
  return {bounds: {x: 0, y: 0, width: level ? 244 : 192, height: 192}, extension: active, usedRecordIds: []};
}

/** Coordinates use a prepared 192px specimen. Each caller supplies the same physical material. */
export function drawCurioAbilityRig(context: CanvasRenderingContext2D, options: CurioAbilityRigOptions): CurioAbilityRigResult {
  const size = options.size ?? 192;
  context.save();context.imageSmoothingEnabled = false;
  if (size !== 192) context.scale(size / 192, size / 192);
  const extension = openingAt(options);
  const result = options.id === 'receipt' ? receipt(context, options, extension) : tape(context, options, extension);
  context.restore();
  return result;
}
