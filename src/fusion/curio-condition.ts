import {drawTapeBridge} from './curio-ability-rig';
import {itemCenter,type Exhibit} from '../render/museum-layout';
import {curioActionProgress,type CurioState} from './curio-material';
import {receiptRestorationFrame,type ReceiptRestorationState} from '../review/receipt-restoration';
import {isRenewalCurio,renewalCurioIds,renewalCurioRegistration,renewalReceiptCurioState,renewalTreatmentFrame,renewalBuriedReceiptPose,type RenewalCurioId,type RenewalPoint,type RenewalTool} from './curio-renewal-model';
import {curioRigCommands,type RigId} from './curio-rig-motion';
import registration from '../../assets/runtime/visual-renewal/curios/registration.json';
export {curioConditionPresentation,curioTreatmentLabels,curioPhysicalFrame,curioMaterialRegistration} from './curio-material';
export {renewalReceiptCurioState,renewalTreatmentFrame,renewalCurioRegistration} from './curio-renewal-model';
export type {CurioState} from './curio-material';

export interface CurioPoseOptions {seconds?:number;trial?:number;reducedMotion?:boolean;serviceEnvelope?:number;buried?:boolean;excavation?:number;drawAbility?:(context:CanvasRenderingContext2D,image:HTMLCanvasElement)=>boolean}
interface Material {original:HTMLCanvasElement;image:HTMLCanvasElement;cleanMask:HTMLCanvasElement;dirty:HTMLCanvasElement;revision:string;phase:number;repaired:number;corrections:readonly number[];size:384}
type ToolContact={tool:string;x:number;y:number;pressed:boolean};
const urls=import.meta.glob('../../assets/runtime/visual-renewal/curios/*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const images=new Map<string,HTMLImageElement>(),materials=new Map<string,Material>();
let toolsPromise:Promise<void>|undefined,toolsLoaded=false;
let workbench:HTMLImageElement|undefined,workbenchPromise:Promise<void>|undefined;
const workbenchUrl=new URL('../../assets/runtime/visual-renewal/curios/restoration-workbench.webp',import.meta.url).href;
const make=(size=384)=>{const c=document.createElement('canvas');c.width=c.height=size;return c;};
const clamp=(p:number)=>Number.isFinite(p)?Math.max(0,Math.min(1,p)):0;
const smooth=(p:number)=>{const t=clamp(p);return t*t*(3-2*t);};
function path(c:CanvasRenderingContext2D,points:readonly RenewalPoint[]){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}
function sprite(name:string){return images.get(name);}
function drawImage(c:CanvasRenderingContext2D,image:CanvasImageSource){c.drawImage(image,0,0,192,192);}

/** New material bytes are critical: failure does not pretend a paid treatment is ready. */
export function prepareCurioTools():Promise<void>{
 if(!toolsPromise){
  const entries=Object.entries(urls).filter(([name])=>/\/(?:tool-|excavation-|receipt-inner-blank|[^/]+-rig-)/.test(name));
  toolsPromise=Promise.all(entries.map(async([name,url])=>{
   const key=name.split('/').at(-1)!.replace('.webp','');let image=images.get(key);
   if(!image){image=new Image();image.src=url;images.set(key,image);}
   try{await image.decode();}catch(error){if(images.get(key)===image)images.delete(key);throw error;}
  })).then(()=>{toolsLoaded=true;}).catch(error=>{toolsLoaded=false;toolsPromise=undefined;throw error;});
 }
 return toolsPromise;
}
/** Scenery is decoded on opening the workspace, preserving the load-failure payment gate. */
export function prepareCurioWorkbench():Promise<void>{
 if(!workbenchPromise)workbenchPromise=prepareCurioTools().then(async()=>{const image=new Image();image.src=workbenchUrl;await image.decode();workbench=image;}).catch(error=>{workbenchPromise=undefined;throw error;});
 return workbenchPromise;
}

function cleanMask(c:CanvasRenderingContext2D,id:RenewalCurioId,progress:number){
 c.lineCap='round';c.lineWidth=27;
 for(const [i,[a,b]]of renewalCurioRegistration[id].cleanPaths.entries()){
  const p=clamp((progress*8-i)/.72);if(!p)continue;c.moveTo(a.x,a.y);c.lineTo(a.x+(b.x-a.x)*p,a.y+(b.y-a.y)*p);
 }
 c.stroke();
}

/** The same commands make both runtime specimens and the delivered PNG states. */
function paintPhysicalRig(c:CanvasRenderingContext2D,id:RigId,corrections:readonly number[],seconds=0,trial=0,reduced=true){
 for(const command of curioRigCommands(id,corrections,seconds,trial,reduced)){
  const image=sprite(command.key);if(!image?.naturalWidth)continue;
  c.save();c.transform(...command.matrix);if(command.clip){c.beginPath();c.rect(...command.clip);c.clip();}if(command.polygon){path(c,command.polygon);c.clip();}drawImage(c,image);c.restore();
 }
}

/** Dirty overlays are erased by actual sweeps; the common opaque body is never erased. */
export function prepareCurioMaterial(_image:HTMLImageElement|undefined,state:CurioState,now:number,id:string):Material{
 let material=materials.get(id);if(!material){material={original:make(),image:make(),cleanMask:make(),dirty:make(),revision:'',phase:0,repaired:0,corrections:[0,0],size:384};materials.set(id,material);}
 const phase=curioActionProgress(state,now),repaired=state.condition==='stabilized'?1:state.action?.kind==='repair'?phase:0;
 const revision=`${id}/${state.condition}/${state.action?.kind??''}/${state.action?Math.round(phase*180):0}/${toolsLoaded}`;
 if(material.revision!==revision){
  const c=material.image.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.clearRect(0,0,384,384);c.imageSmoothingEnabled=false;
  if(isRenewalCurio(id)&&toolsLoaded){
   const frame=renewalTreatmentFrame(id,state,now);material.corrections=frame.corrections;
   c.save();c.scale(2,2);paintPhysicalRig(c,id,frame.corrections);c.restore();
   if(frame.cleaning<1){
    const dirty=material.dirty,d=dirty.getContext('2d')!;d.setTransform(1,0,0,1,0,0);d.globalCompositeOperation='source-over';d.clearRect(0,0,384,384);
    const deposits=sprite(`${id}-rig-deposits`);if(deposits)d.drawImage(deposits,0,0,384,384);
    if(state.action?.kind==='clean'){
     const mask=material.cleanMask,m=mask.getContext('2d')!;m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='source-over';m.clearRect(0,0,384,384);m.save();m.scale(2,2);m.beginPath();cleanMask(m,id,phase);m.restore();
     d.save();d.globalCompositeOperation='destination-out';d.drawImage(mask,0,0);d.restore();
    }
    d.save();d.globalCompositeOperation='destination-in';d.drawImage(material.image,0,0);d.restore();c.drawImage(dirty,0,0);
   }
   const o=material.original.getContext('2d')!;o.clearRect(0,0,384,384);o.save();o.scale(2,2);paintPhysicalRig(o,id,[1,1]);o.restore();
  }
  material.revision=revision;
 }
 material.phase=phase;material.repaired=repaired;return material;
}

const idleRigs=new Map<string,{key:string;image:HTMLCanvasElement}>();
/** A physical joint cycle, with one common fixed body and no copy of the old broken specimen. */
export function drawRenewalCurioRig(c:CanvasRenderingContext2D,id:RenewalCurioId,material:Material,seconds:number,trial=0,reduced=false,envelope=1){
 if(material.repaired<.995){drawImage(c,material.image);return;}
 const active=trial>0&&trial<1?Math.sin(trial*Math.PI):0;
 if(active>0){paintPhysicalRig(c,id,[1,1],seconds,trial,reduced);}
 else {
  const key=`${material.revision}/${reduced?0:Math.floor(seconds*20)}/${envelope<.01}`;
  let cache=idleRigs.get(id);if(!cache){cache={key:'',image:make()};idleRigs.set(id,cache);}
  if(cache.key!==key){const context=cache.image.getContext('2d')!;context.clearRect(0,0,384,384);context.save();context.scale(2,2);paintPhysicalRig(context,id,[1,1],seconds,0,reduced||envelope<.01);context.restore();cache.key=key;}
  drawImage(c,cache.image);
 }
 if(id==='cosmic-parcel'&&trial>0&&trial<1){
  const pulse=(start:number)=>trial>start&&trial<start+.12?Math.sin((trial-start)/.12*Math.PI):0;
  const first=pulse(.43),second=pulse(.70),flash=Math.max(first,second)*(reduced?.45:1);
  if(flash>.01){
   c.save();c.globalCompositeOperation='screen';c.globalAlpha=flash*.72;c.strokeStyle='#d7aeff';c.lineWidth=.85;
   // These two edges are the actual closed lid seam of the fixed box, not a ring.
   c.beginPath();c.moveTo(19,84);c.lineTo(118,101);c.lineTo(175,64);c.stroke();
   c.fillStyle='#fff0cb';const points=first>second?[{x:40,y:88},{x:103,y:98}]:[{x:132,y:92},{x:156,y:77}];
   for(const p of points){c.fillRect(p.x,p.y,1.5,1.5);c.fillRect(p.x+.5,p.y-1,0.5,3.5);}
   c.restore();
  }
 }
 if(id==='tape'&&active>.05){
  const paper=sprite('receipt-inner-blank');
  if(paper){c.drawImage(paper,77,61,86,137,5,151,24,25);c.drawImage(paper,106,61,86,137,32,151,24,25);}
  drawTapeBridge(c,material.image,[{x:45,y:122},{x:31,y:139},{x:28,y:157},{x:42,y:163}],active,8);
 }
 if(active>.15&&id==='stamp'){
  c.save();c.translate(76,179);c.fillStyle='#e8c88f';c.fillRect(0,0,44,12);c.fillStyle='#7f5176';c.font='bold 6px monospace';c.fillText('昨天 ←',3,8);c.restore();
 }
 if(id==='bell'&&trial>.45&&trial<1&&!reduced){c.save();c.strokeStyle='#ffe1a2';c.lineWidth=.85;c.globalAlpha=active*.7;for(let i=0;i<2;i++){const w=((trial-.45)*3+i*.5)%1;c.beginPath();c.ellipse(99,140,44+w*31,11+w*9,0,0,Math.PI*2);c.stroke();}c.restore();}
}

const toolEntries=new Map(registration.assets.filter(a=>a.id.startsWith('tool-')).map(a=>[a.id,a]));
function arm(c:CanvasRenderingContext2D,grip:RenewalPoint){
 const sleeve=sprite('tool-forearm'),hand=sprite('tool-gripper');if(!sleeve||!hand)return;
 const elbow={x:Math.min(218,grip.x+52),y:Math.min(187,grip.y+49)},origin={x:242,y:177};
 // Telescoping members keep their authored width. Only straight metal rods
 // extend; the detailed enamel sleeve and brass bearings are never stretched.
 for(const [a,b]of [[origin,elbow],[elbow,grip]]){
  const length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);
  c.save();c.translate(a.x,a.y);c.rotate(angle);
  c.fillStyle='#271638';c.fillRect(-5,-7,length+10,14);c.fillStyle='#9c623c';c.fillRect(-3,-5,length+6,10);
  c.fillStyle='#e8b575';c.fillRect(-2,-4,length+4,7);c.fillStyle='#fff0bf';c.fillRect(-1,-4,length+2,2);c.fillStyle='#74505b';c.fillRect(-1,3,length+2,2);
  for(let x=9;x<length-7;x+=18){c.fillStyle='#b37a50';c.fillRect(x,-3,2,6);c.fillStyle='#f5d49d';c.fillRect(x+2,-3,1,5);}
  c.translate(length-10,0);c.rotate(Math.PI/2);c.drawImage(sleeve,-9,-11,18,29.25);c.restore();
 }
 function bearing(p:RenewalPoint,r:number){
  for(const [radius,color]of [[r+2,'#271638'],[r,'#a4693d'],[r-2,'#f7d399'],[r-4,'#b47b49']] as const){c.fillStyle=color;for(let y=-radius;y<=radius;y+=2){const w=Math.floor(Math.sqrt(Math.max(0,radius*radius-y*y))/2)*2;c.fillRect(Math.round(p.x-w),Math.round(p.y+y),w*2,2);}}
  c.fillStyle='#5c3c55';c.fillRect(Math.round(p.x)-1,Math.round(p.y)-4,2,8);
 }
 bearing(origin,10);bearing(elbow,8);bearing(grip,5);
 c.drawImage(hand,grip.x-12,grip.y-9,24,17);
}
function registeredTool(c:CanvasRenderingContext2D,name:RenewalTool,tip:RenewalPoint,angle:number){
 const image=sprite(`tool-${name}`),entry=toolEntries.get(`tool-${name}`);if(!image||!entry?.contact||!entry.pivot)return;
 const scale=(name==='brush'?77:70)/Math.max(image.naturalWidth,image.naturalHeight);
 const dx=(entry.pivot.x-entry.contact.x)*scale,dy=(entry.pivot.y-entry.contact.y)*scale;
 const grip={x:tip.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:tip.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
 arm(c,grip);c.save();c.translate(tip.x,tip.y);c.rotate(angle);c.scale(scale,scale);c.drawImage(image,-entry.contact.x,-entry.contact.y);c.restore();
}
function drawTool(c:CanvasRenderingContext2D,id:RenewalCurioId,state:CurioState,now:number):ToolContact|undefined{
 if(!state.action||curioActionProgress(state,now)>=1)return;
 const f=renewalTreatmentFrame(id,state,now);
 if(state.action.kind==='clean'){
  const lift=f.cleaningContact?0:Math.sin(clamp((f.local-.72)/.28)*Math.PI)*12;
  registeredTool(c,f.tool,f.contact.y<0?f.contact:{x:f.contact.x,y:f.contact.y-lift},.52+Math.sin(f.local*6.28)*.05);
  return{tool:f.tool,...f.contact,pressed:f.cleaningContact};
 }
 const site=f.repairContact,tip={x:site.x+(1-f.pressure)*23,y:site.y-(1-f.pressure)*19};
 registeredTool(c,f.tool,tip,.55+(f.tool==='screwdriver'&&f.pressure>.95?Math.sin(f.repairLocal*30)*.07:0));
 return{tool:f.tool,...site,pressed:f.pressure>.95};
}

/** One sample-bank composition, with the front soil occluding all but a paper corner. */
function drawBuriedReceipt(c:CanvasRenderingContext2D,material:Material,progress:number,withTool:boolean){
 const pose=renewalBuriedReceiptPose(progress),rear=sprite('excavation-rear'),front=sprite('excavation-front');
 if(rear)c.drawImage(rear,0,67,192,120);
 c.save();c.translate(pose.pivot.x,pose.pivot.y);c.rotate(pose.angle);c.scale(1,pose.scaleY);c.translate(-pose.pivot.x,-pose.pivot.y);drawImage(c,material.image);c.restore();
 if(front){c.save();c.globalAlpha=1-pose.settle;c.drawImage(front,0,133,192,55);c.restore();}
 if(withTool){
  const contact=pose.progress<.36?{x:128+pose.loosen*4,y:139-pose.loosen*3}:pose.edgeContact;
  registeredTool(c,pose.progress<.36?'spatula':'tweezers',contact,.5-pose.tilt*.25);
 }
}

/** Shared specimen path for collection AND home. Contains no case pixels. */
export function drawCurioSpecimen(c:CanvasRenderingContext2D,exhibit:Exhibit,image:HTMLImageElement,state:CurioState,now:number,options:CurioPoseOptions={}){
 if(!isRenewalCurio(exhibit.id)||!toolsLoaded)return false;
 const material=prepareCurioMaterial(image,state,now,exhibit.id),center=itemCenter(exhibit),size=exhibit.item.size*exhibit.scale;
 c.save();c.translate(center.x-size/2,center.y-size/2);c.scale(size/192,size/192);c.imageSmoothingEnabled=false;
 if(exhibit.id==='receipt'&&options.buried)drawBuriedReceipt(c,material,options.excavation??0,false);
 else if(state.action)drawImage(c,material.image);else if(!options.drawAbility?.(c,material.image))drawRenewalCurioRig(c,exhibit.id,material,options.seconds??now/1000,(options.trial??0)*(options.serviceEnvelope??1),options.reducedMotion,options.serviceEnvelope??1);
 c.restore();return true;
}

function paintWorkbench(canvas:HTMLCanvasElement,id:RenewalCurioId,state:CurioState,now:number,options:CurioPoseOptions={},buried=false){
 if(!toolsLoaded||!workbench?.naturalWidth)return false;
 const c=canvas.getContext('2d');if(!c)return false;
 const material=prepareCurioMaterial(undefined,state,now,id),frame=renewalTreatmentFrame(id,state,now);
 c.save();c.clearRect(0,0,canvas.width,canvas.height);c.scale(canvas.width/640,canvas.height/700);c.imageSmoothingEnabled=false;c.drawImage(workbench,0,0,640,700);
 const x=106,y=191,size=428,scale=size/192;
 c.save();c.globalAlpha=.31;c.fillStyle='#25132e';c.beginPath();c.ellipse(x+frame.progress*0+renewalCurioRegistration[id].support.x*scale,y+renewalCurioRegistration[id].support.y*scale+1,122,7,0,0,Math.PI*2);c.fill();c.restore();
 c.save();c.translate(x,y);c.scale(scale,scale);
 if(buried){
  drawBuriedReceipt(c,material,options.excavation??options.trial??0,true);
 }else if(state.action)drawImage(c,material.image);
 else if(!options.drawAbility?.(c,material.image))drawRenewalCurioRig(c,id,material,options.seconds??now/1000,options.trial??0,options.reducedMotion,options.serviceEnvelope??1);
 if(id==='bell'&&options.trial&&options.trial>.02&&options.trial<.42){
  const retract=smooth((options.trial-.18)/.24);arm(c,{x:132+retract*93,y:108+retract*32});
 }
 const contact=buried?undefined:drawTool(c,id,state,now);c.restore();c.restore();
 canvas.dataset.ready='true';canvas.dataset.materialStage=state.condition;canvas.dataset.condition=state.condition;canvas.dataset.type=renewalCurioRegistration[id].material;
 canvas.dataset.cleanProgress=String(frame.cleaning);canvas.dataset.repairProgress=String(frame.repairing);canvas.dataset.toolContact=contact?.pressed?contact.tool:'';canvas.dataset.contact=contact?.tool??'';
 canvas.dataset.contactX=contact?String(x+contact.x*scale):'';canvas.dataset.contactY=contact?String(y+contact.y*scale):'';
 canvas.dataset.structureAligned=String(frame.corrections[0]);canvas.dataset.structurePressed=String(frame.corrections[1]);canvas.dataset.lampAvailable='false';canvas.dataset.frame=String(Number(canvas.dataset.frame??0)+1);
 return{cleanCoverage:frame.cleaning,contact};
}
export function renderCurioTreatment(canvas:HTMLCanvasElement,id:string,state:CurioState,now:number,options:CurioPoseOptions={}){return isRenewalCurio(id)?!!paintWorkbench(canvas,id,state,now,options):false;}

/** The same receipt bytes and original fact model, now in the unified new workbench. */
export function renderRenewalReceipt(canvas:HTMLCanvasElement,state:ReceiptRestorationState,now:number,options:CurioPoseOptions={}){
 const frame=receiptRestorationFrame(state,now/1000),curio=renewalReceiptCurioState(state);
 const result=paintWorkbench(canvas,'receipt',curio,now,{...options,excavation:frame.excavation,trial:frame.phase==='trying'?frame.trying:options.trial},frame.stage==='buried');
 if(!result)return false;
 canvas.dataset.restorationPhase=frame.phase;canvas.dataset.restorationCondition=frame.condition;canvas.dataset.restorationCleaning=String(frame.cleaning);canvas.dataset.restorationRepairing=String(frame.repairing);canvas.dataset.restorationExcavation=String(frame.excavation);canvas.dataset.restorationOriginalCode='RET-031';canvas.dataset.restorationMissing=String(frame.reading.missingCount);canvas.dataset.cleanCoverage=String(result.cleanCoverage);canvas.dataset.phase=frame.phase;
 return result;
}
/** Full-resolution copy: no mutation, no temporary canvas shared with a renderer. */
export function exportCurioMaterial(id:string,state:CurioState,now:number){if(!toolsLoaded||!isRenewalCurio(id))return undefined;const result=make();result.getContext('2d')!.drawImage(prepareCurioMaterial(undefined,state,now,id).image,0,0);return result;}
export function exportRenewalReceiptMaterial(state:ReceiptRestorationState,now:number){return exportCurioMaterial('receipt',renewalReceiptCurioState(state),now);}
