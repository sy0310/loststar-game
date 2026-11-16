import {wholeCurioMaterial} from './curio-state-images';
import {modernReceiptBounds} from './receipt-paper-model';
import {receiptReadingRecords,receiptReadingLabel} from './receipt-reading-model';
import {prepareCurioMechanisms,drawMechanismForMaterial} from './curio-mechanism-renderer';
import {renewalCurioMuseumHandling} from './curio-museum-handling';

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
/** Shared critical decode is retryable even if this entry point is the first caller. */
export function curioAbilityReady():Promise<void>{return typeof Image==='undefined'?Promise.resolve():prepareCurioMechanisms();}
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

/** Tape uses exactly the same physical rig as the room and workbench at every level. */
function tape(context:CanvasRenderingContext2D,options:CurioAbilityRigOptions,_extension:number):CurioAbilityRigResult{
 const whole=wholeCurioMaterial(options.image),trial=options.experimentProgress??0;
 if(whole&&(whole.condition!=='stabilized'||trial<=0||trial>=1)){
  if(!options.baseAlreadyDrawn)context.drawImage(options.image,0,0,192,192);
  const b=renewalCurioMuseumHandling.tape.bounds;
  return{bounds:{x:b.left,y:b.top,width:b.right-b.left,height:b.bottom-b.top},extension:0,usedRecordIds:[]};
 }
 const result=drawMechanismForMaterial(context,'tape',options.image,{seconds:options.seconds,trial:options.experimentProgress,abilityLevel:options.abilityLevel,reducedMotion:options.reducedMotion,serviceEnvelope:options.serviceEnvelope});
 const b=renewalCurioMuseumHandling.tape.bounds;
 return{bounds:{x:b.left,y:b.top,width:b.right-b.left,height:b.bottom-b.top},extension:result.frame.tape?.length??0,usedRecordIds:[]};
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
