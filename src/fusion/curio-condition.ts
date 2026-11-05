import {drawTapeBridge} from './curio-ability-rig';
import {itemCenter,type Exhibit} from '../render/museum-layout';
import {curioActionProgress,type CurioState} from './curio-material';
import {receiptRestorationFrame,type ReceiptRestorationState} from '../review/receipt-restoration';
import {isRenewalCurio,renewalCurioIds,renewalCurioRegistration,renewalReceiptCurioState,renewalTreatmentFrame,renewalBuriedReceiptPose,type RenewalCurioId,type RenewalPoint,type RenewalTool} from './curio-renewal-model';
import registration from '../../assets/runtime/visual-renewal/curios/registration.json';
export {curioConditionPresentation,curioTreatmentLabels,curioPhysicalFrame,curioMaterialRegistration} from './curio-material';
export {renewalReceiptCurioState,renewalTreatmentFrame,renewalCurioRegistration} from './curio-renewal-model';
export type {CurioState} from './curio-material';

export interface CurioPoseOptions {seconds?:number;trial?:number;reducedMotion?:boolean;serviceEnvelope?:number;buried?:boolean;excavation?:number;drawAbility?:(context:CanvasRenderingContext2D,image:HTMLCanvasElement)=>boolean}
interface Material {original:HTMLCanvasElement;image:HTMLCanvasElement;cleanMask:HTMLCanvasElement;revision:string;phase:number;repaired:number;size:384}
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
function specimen(id:string,state:string){return images.get(`${id}-${state}`);}
function sprite(name:string){return images.get(name);}
function drawImage(c:CanvasRenderingContext2D,image:CanvasImageSource){c.drawImage(image,0,0,192,192);}

/** New material bytes are critical: failure does not pretend a paid treatment is ready. */
export function prepareCurioTools():Promise<void>{
 if(!toolsPromise){
  const entries=Object.entries(urls).filter(([name])=>!name.endsWith('/restoration-workbench.webp'));
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

/** All six use independent authored A/B/C textures; only contacted tracks reveal B. */
export function prepareCurioMaterial(_image:HTMLImageElement|undefined,state:CurioState,now:number,id:string):Material{
 let material=materials.get(id);if(!material){material={original:make(),image:make(),cleanMask:make(),revision:'',phase:0,repaired:0,size:384};materials.set(id,material);}
 const phase=curioActionProgress(state,now),repaired=state.condition==='stabilized'?1:state.action?.kind==='repair'?phase:0;
 const revision=`${id}/${state.condition}/${state.action?.kind??''}/${state.action?Math.round(phase*180):0}/${toolsLoaded}`;
 if(material.revision!==revision){
  const c=material.image.getContext('2d')!;c.clearRect(0,0,384,384);c.imageSmoothingEnabled=false;
  if(isRenewalCurio(id)&&toolsLoaded){
   const source=specimen(id,state.condition),clean=specimen(id,'clean'),done=specimen(id,'stabilized');
   if(source&&clean&&done){
    const o=material.original.getContext('2d')!;o.clearRect(0,0,384,384);o.drawImage(done,0,0,384,384);
    c.save();c.scale(2,2);drawImage(c,source);
    if(state.action?.kind==='clean'){
     // The saved B material is revealed only on the exact sweeps used by the brush.
     const mask=material.cleanMask,m=mask.getContext('2d')!;m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='source-over';m.clearRect(0,0,384,384);m.save();m.scale(2,2);m.beginPath();cleanMask(m,id,phase);
     m.restore();
     // Erase A under the same opaque track before revealing B, including alpha edges.
     c.save();c.globalCompositeOperation='destination-out';c.drawImage(mask,0,0,192,192);c.restore();
     m.save();m.scale(2,2);m.globalCompositeOperation='source-in';drawImage(m,clean);m.restore();
     c.drawImage(mask,0,0,192,192);
    }else if(state.action?.kind==='repair'){
     const frame=renewalTreatmentFrame(id,state,now);
     const surface=(frame.corrections[0]+frame.corrections[1])/2;
     if(surface>0){
      // Small authored pose/texture residuals outside structural regions settle
      // only while one of the tools is actually pressing, never on state commit.
      c.save();c.beginPath();c.rect(0,0,192,192);
      for(const repair of renewalCurioRegistration[id].repairs){const points=repair.zone;c.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))c.lineTo(p.x,p.y);c.closePath();}
      c.clip('evenodd');c.clearRect(0,0,192,192);c.globalAlpha=1-surface;drawImage(c,clean);c.globalAlpha=surface;drawImage(c,done);c.restore();
     }
     for(const [index,repair]of renewalCurioRegistration[id].repairs.entries()){
      const amount=frame.corrections[index];if(amount<=0)continue;
      c.save();path(c,repair.zone);c.clip();
      // Replace only the authored joint after a measured tool has engaged it.
      // Its registration moves from the damaged joint into its real seat.
      c.clearRect(0,0,192,192);c.save();c.translate(repair.contact.x,repair.contact.y);
      c.translate(repair.from.x*(1-amount),repair.from.y*(1-amount));c.rotate(repair.angle*(1-amount));c.translate(-repair.contact.x,-repair.contact.y);
      drawImage(c,done);c.restore();c.restore();
     }
     // All registered corrections reach exact C before the tool withdraws.
    }
    c.restore();
   }
  }
  material.revision=revision;
 }
 material.phase=phase;material.repaired=repaired;return material;
}

interface PartLayers {revision:string;body:HTMLCanvasElement;part:HTMLCanvasElement;under:HTMLCanvasElement}
const rigs=new Map<string,PartLayers>();
const rigPolygons:Record<RenewalCurioId,readonly RenewalPoint[]>={
 receipt:[{x:0,y:137},{x:150,y:137},{x:150,y:192},{x:0,y:192}],
 tape:[{x:22,y:122},{x:33,y:108},{x:65,y:92},{x:85,y:92},{x:78,y:107},{x:57,y:126},{x:50,y:142},{x:23,y:142}],
 nested:[{x:30,y:85},{x:77,y:40},{x:166,y:57},{x:166,y:79},{x:132,y:113},{x:30,y:97}],
 stamp:[{x:43,y:0},{x:132,y:0},{x:142,y:119},{x:67,y:121}],
 'cosmic-parcel':[{x:22,y:39},{x:111,y:17},{x:174,y:41},{x:181,y:79},{x:68,y:105},{x:22,y:77}],
 bell:[{x:74,y:15},{x:119,y:15},{x:119,y:64},{x:74,y:64}],
};
function rigFor(id:RenewalCurioId,material:Material){
 let r=rigs.get(id);if(r?.revision===material.revision)return r;
 r??={revision:'',body:make(),part:make(),under:make()};
 for(const canvas of [r.body,r.part,r.under]){const c=canvas.getContext('2d')!;c.globalCompositeOperation='source-over';c.clearRect(0,0,384,384);}
 const p=r.part.getContext('2d')!;p.drawImage(material.image,0,0);p.save();p.scale(2,2);p.globalCompositeOperation='destination-in';path(p,rigPolygons[id]);p.fill();p.restore();
 const b=r.body.getContext('2d')!;b.drawImage(material.image,0,0);b.globalCompositeOperation='destination-out';b.drawImage(r.part,0,0);b.globalCompositeOperation='source-over';
 const u=r.under.getContext('2d')!;const clean=specimen(id,'clean');
 if(clean&&(id==='nested'||id==='cosmic-parcel')){
  u.save();u.scale(2,2);path(u,rigPolygons[id]);u.clip();
  // Only the existing internal layer is exposed, never a second copy of the outer lid.
  u.beginPath();u.rect(0,id==='nested'?83:88,192,29);u.clip();drawImage(u,clean);u.restore();
 }
 r.revision=material.revision;rigs.set(id,r);return r;
}

/** Local joints move; feet/support stay fixed. No whole-icon bobbing substitutes for animation. */
export function drawRenewalCurioRig(c:CanvasRenderingContext2D,id:RenewalCurioId,material:Material,seconds:number,trial=0,reduced=false,envelope=1){
 const r=rigFor(id,material),active=trial>0&&trial<1?Math.sin(trial*Math.PI):0;
 const motion=reduced?0:envelope*(material.repaired<.995?.25:1),idle=Math.sin(seconds*1.3);
 drawImage(c,r.under);drawImage(c,r.body);c.save();
 if(id==='receipt'){
  // Connected strips curl around the fixed upper edge, never lift the whole sheet.
  c.restore();const start=137;
  for(let y=start;y<192;y+=3){const local=(y-start)/(192-start),wave=(Math.sin(seconds*1.1)*1.3+active*7)*motion*local*local;
   c.drawImage(r.part,0,y*2,384,6,0,y-wave,192,3+Math.abs(wave)*.05);}
  return;
 }
 if(id==='tape'){c.translate(80,96);c.rotate((idle*.025+active*.22)*motion);c.translate(-80,-96-active*4*motion);}
 if(id==='nested'){
  const opening=((idle+1)*.018+active*.82)*motion;
  // Project a hinged plane: back-edge vector (86,14) is invariant throughout.
  c.translate(80,43);c.transform(1,.23377*opening,0,1-1.43599*opening,0,0);c.translate(-80,-43);
 }
 if(id==='stamp'){c.translate(103,118);c.rotate(idle*.01*motion);c.translate(-103,-118+active*9*motion);}
 if(id==='cosmic-parcel'){const pulse=(start:number)=>trial>start&&trial<start+.13?Math.sin((trial-start)/.13*Math.PI):0;const knock=(pulse(.43)+pulse(.70))*3*motion;c.translate(173,69);c.rotate(-(.012+idle*.012+active*.04)*motion);c.translate(-173,-69+knock);}
 if(id==='bell'){const delayed=trial>.42?Math.sin(clamp((trial-.42)/.58)*Math.PI):0;c.translate(0,((idle+1)*.6+delayed*8)*motion);}
 drawImage(c,r.part);c.restore();
 if(id==='tape'&&active>.05){
  const paper=sprite('receipt-inner-blank');
  if(paper){c.drawImage(paper,77,61,86,137,5,151,24,25);c.drawImage(paper,106,61,86,137,32,151,24,25);}
  drawTapeBridge(c,material.image,[{x:45,y:122},{x:31,y:139},{x:28,y:157},{x:42,y:163}],active,8);
 }
 if(active>.1&&id==='nested'){
  // The tiny final nested layer carries the exact first-layer mark, not new loot.
  c.save();c.translate(91,78-active*5);c.scale(.23,.23);c.drawImage(material.image,0,0,384,384,0,0,192,192);c.restore();
 }
 if(active>.15&&id==='stamp'){
  c.save();c.translate(76,179);c.fillStyle='#e8c88f';c.fillRect(0,0,44,12);c.fillStyle='#7f5176';c.font='bold 6px monospace';c.fillText('昨天 ←',3,8);c.restore();
 }
 if(id==='bell'&&trial>.45&&trial<1&&!reduced){c.save();c.strokeStyle='#ffe1a2';c.lineWidth=.85;c.globalAlpha=active*.7;for(let i=0;i<2;i++){const w=((trial-.45)*3+i*.5)%1;c.beginPath();c.ellipse(99,140,44+w*31,11+w*9,0,0,Math.PI*2);c.stroke();}c.restore();}
}

const toolEntries=new Map(registration.assets.filter(a=>a.id.startsWith('tool-')).map(a=>[a.id,a]));
function arm(c:CanvasRenderingContext2D,grip:RenewalPoint){
 const forearm=sprite('tool-forearm'),hand=sprite('tool-gripper');if(!forearm||!hand)return;
 const elbow={x:Math.min(230,grip.x+37),y:grip.y+34},origin={x:265,y:213};
 for(const [a,b]of [[origin,elbow],[elbow,grip]]){const length=Math.hypot(b.x-a.x,b.y-a.y);c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2);c.drawImage(forearm,0,0,forearm.naturalWidth,forearm.naturalHeight,-8,-6,16,length+12);c.restore();}
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
