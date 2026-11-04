import blankPaperUrl from '../../assets/runtime/d1-refinement/receipt-inner-blank.webp';

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

function receipt(context: CanvasRenderingContext2D, options: CurioAbilityRigOptions, extension: number): CurioAbilityRigResult {
  if (!options.baseAlreadyDrawn) context.drawImage(options.image, 0, 0, 192, 192);
  const level = Math.min(2, Math.max(0, options.abilityLevel));
  const records = (options.records ?? []).filter(record => Number.isFinite(record.at) && record.detail.length > 0);
  if (!level || extension <= .001 || !blankPaper?.complete || !blankPaper.naturalWidth) {
    return {bounds: {x: 20, y: 0, width: 152, height: 192}, extension: 0, usedRecordIds: []};
  }
  const attachments = options.attachments ?? {
    rightTop: {x: 136,y: 74},rightBottom: {x: 133,y: 143},
    leftTop: {x: 61,y: 74},leftBottom: {x: 57,y: 143},
  };
  const wings = level === 1 ? ['right'] as const : ['right','left'] as const;
  const usedRecordIds: string[] = [];
  let left = 20, right = 172, top = 0, bottom = 192;
  for (let panel = 0; panel < wings.length; panel++) {
    const side = wings[panel];
    const hingeTop = side === 'right' ? attachments.rightTop : attachments.leftTop;
    const hingeBottom = side === 'right' ? attachments.rightBottom : attachments.leftBottom;
    const opening = smooth(extension * 1.3 - panel * .18);
    const edge = (side === 'right' ? attachments.rightEdge : attachments.leftEdge) ?? [hingeTop,hingeBottom];
    const cavity = options.cavity ?? {left:-18,top:-10,width:228,height:220};
    const margin = side === 'right' ? cavity.left + cavity.width - Math.max(...edge.map(point=>point.x))
      : Math.min(...edge.map(point=>point.x)) - cavity.left;
    const width = Math.min(48, Math.max(0,margin - 4)) * opening;
    if (width < .2) continue;
    const direction = side === 'right' ? 1 : -1;
    // Both vertices of the inner edge are sampled from the current physical
    // paper mesh. The appendix hinges from that edge, including trial bends.
    const spread = {x: direction * width,y: -6 * Math.sin(opening * Math.PI / 2)};
    const height = Math.hypot(hingeBottom.x-hingeTop.x,hingeBottom.y-hingeTop.y);
    // Each strip follows the actual alpha edge of the deforming original.
    // This keeps concave scroll edges continuously joined along the whole fold.
    for (let strip=0;strip<edge.length-1;strip++) {
      const start=edge[strip],end=edge[strip+1];
      const stripHeight=Math.hypot(end.x-start.x,end.y-start.y);
      context.save();
      context.transform(spread.x/46,spread.y/46,(end.x-start.x)/stripHeight,(end.y-start.y)/stripHeight,start.x,start.y);
      context.drawImage(blankPaper,77+panel*29,61+137*strip/(edge.length-1),86,137/(edge.length-1),-.8,-.3,47.6,stripHeight+.6);
      context.fillStyle=panel?'#5c405728':'#fff0bc16';context.fillRect(0,0,46,stripHeight);
      const crease=context.createLinearGradient(0,0,9,0);
      crease.addColorStop(0,'#4c354970');crease.addColorStop(1,'#71515a00');
      context.fillStyle=crease;context.fillRect(0,0,9,stripHeight);
      context.fillStyle='#b69370';context.fillRect(45,0,1,stripHeight);context.restore();
    }
    context.save();
    context.beginPath();context.moveTo(edge[0].x,edge[0].y);
    for (const point of edge) context.lineTo(point.x,point.y);
    for (let index=edge.length-1;index>=0;index--) context.lineTo(edge[index].x+spread.x,edge[index].y+spread.y);
    context.closePath();context.clip();
    const record = records[panel];
    if (record && opening > .2) {
      const code = record.code ?? /\bP(?:03|30)\b/.exec(`${record.source ?? ''} ${record.detail}`.toUpperCase())?.[0];
      const lines = [
        {y:15,text:code ?? '已记录',font:'bold 8px monospace'},
        {y:29,text:new Date(record.at).toISOString().slice(5,10),font:'5px monospace'},
        {y:38,text:record.orientation === 'inverted' ? '180°' : record.code ? '0°' : '',font:'5px monospace'},
      ];
      for (const line of lines) {
        const position=clamp(line.y/height)*(edge.length-1);
        const index=Math.min(edge.length-2,Math.floor(position));
        const amount=position-index,start=edge[index],end=edge[index+1];
        const baseline={x:start.x+(end.x-start.x)*amount,y:start.y+(end.y-start.y)*amount};
        context.save();context.translate(baseline.x,baseline.y);
        context.transform(spread.x/46,spread.y/46,0,1,0,0);
        if(direction<0){context.translate(46,0);context.scale(-1,1);}
        context.fillStyle='#745059';context.font=line.font;context.textAlign='left';context.fillText(line.text,7,0);
        context.fillStyle='#b69b7c';context.fillRect(7,4,27,1);context.restore();
      }
      if (!usedRecordIds.includes(record.id)) usedRecordIds.push(record.id);
    }
    context.restore();
    // A narrow curled seam overlaps the source by one native pixel. It reads
    // as the continuous sheet thickness instead of a detached rectangular card.
    context.save();context.strokeStyle='#bc9676';context.lineWidth=1.3;
    context.beginPath();context.moveTo(edge[0].x,edge[0].y);for(const point of edge) context.lineTo(point.x,point.y);context.stroke();context.restore();
    for (const point of edge) {
      left=Math.min(left,point.x+spread.x);right=Math.max(right,point.x+spread.x);
      top=Math.min(top,point.y+spread.y);bottom=Math.max(bottom,point.y+spread.y);
    }
  }
  return {bounds:{x:left,y:top,width:right-left,height:bottom-top},extension,usedRecordIds};
}

interface TapeLayers {revision: string; body: HTMLCanvasElement; tail: HTMLCanvasElement}
const tapeLayers = new WeakMap<object, TapeLayers>();
function tapeMaterial(image: CanvasImageSource, revision: string) {
  const cached = tapeLayers.get(image);
  if (cached?.revision === revision) return cached;
  const body = document.createElement('canvas'), tail = document.createElement('canvas');
  body.width = body.height = tail.width = tail.height = 192;
  const foreground = tail.getContext('2d')!;
  foreground.drawImage(image, 0, 0, 192, 192);
  foreground.globalCompositeOperation = 'destination-in';foreground.fillStyle = '#fff';
  foreground.beginPath();foreground.moveTo(1, 154);foreground.lineTo(14, 136);foreground.lineTo(48, 124);
  foreground.lineTo(76, 126);foreground.lineTo(93, 137);foreground.lineTo(73, 153);foreground.lineTo(54, 160);
  foreground.lineTo(45, 177);foreground.lineTo(8, 176);foreground.closePath();foreground.fill();
  const background = body.getContext('2d')!;
  background.drawImage(image, 0, 0, 192, 192);background.globalCompositeOperation = 'destination-out';background.drawImage(tail, 0, 0);
  const value = {revision, body, tail};tapeLayers.set(image, value);return value;
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
    context.drawImage(image, 24, 141, 43, 13, 0, -width / 2, length, width);
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
    const path = [{x: 80, y: 131}, {x: 113, y: 139}, {x: 153, y: 149}, {x: 192, y: 151},
      {x: 220, y: 143}, {x: 234, y: 133}, {x: 226, y: 125}, {x: 203, y: 128}, {x: 201, y: 146}];
    drawTapeBridge(context, options.image, path, active, 12);
    if (level >= 2) drawTapeBridge(context, options.image,
      [{x: 84, y: 133}, {x: 117, y: 158}, {x: 162, y: 168}, {x: 206, y: 162}, {x: 230, y: 149}, {x: 222, y: 137}], clamp(active * 1.18 - .15), 10);
  }
  if (level === 0 && trial > 0) {
    drawTapeBridge(context, options.image,
      [{x: 80, y: 131}, {x: 51, y: 150}, {x: 24, y: 165}, {x: 4, y: 177}, {x: -18, y: 178}], trial, 12);
    if (trial > .72) {
      context.save();context.globalAlpha = (trial - .72) / .28;
      context.fillStyle = '#825b59';context.font = 'bold 8px monospace';context.textAlign = 'left';
      context.fillText('对不起', -16, 180);context.restore();
    }
  }
  context.save();context.translate(80, 131);context.rotate(Math.sin(options.seconds * 1.4) * .035 + active * .04);context.translate(-80, -131);
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
