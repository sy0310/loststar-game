import robotAtlasUrl from '../../assets/runtime/robot-empty-v3.webp';
import renewalRobotAtlasUrl from '../../assets/runtime/visual-renewal/world/robot-atlas.webp';
import renewalRoomUrl from '../../assets/runtime/visual-renewal/museum/room.webp';
import {RenewalMuseum,renewalExhibits,renewalDisplaySpecimen} from './renewal-museum';
import {prepareRenewalRobot,drawRenewalRobot} from './renewal-robot';
import {baseRobotPose} from './base-motion';
import {FrameCadence} from './frame-cadence';
import {exhibits,exhibitIds,itemCenter,layerPoint,type Exhibit} from './museum-layout';
export {exhibits,exhibitIds} from './museum-layout';
import roomUrl from '../../assets/runtime/museum-room-v02.webp';
import {textures} from '../ui/art';
import {discoveryById} from '../content/catalog';
import type {ArtId} from '../content/types';
import type {ReceiptStudyAssets,ReceiptStudyPaperOverride} from './receipt-study';
import type {ReceiptSpecimenResult} from './receipt-specimen';
import type {ReceiptExperimentFrame} from '../review/receipt-reading';
import type {ReceiptRestorationFrame} from '../review/receipt-restoration';
import type {ReceiptRestorationAssets,ReceiptRestorationDrawResult} from './receipt-restoration';
const habitatUrls=import.meta.glob('../../assets/runtime/habitat-*-v02.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const layers=import.meta.glob('../../assets/runtime/case-*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
export const residentIds=['mouse','hermit','tagbird'] as const;
export type MuseumSource={collection:string[]};
export type MuseumOptions={
 renewal?:boolean;
 receiptStudy?:boolean;
 receiptFrame?:()=>ReceiptRestorationFrame|undefined;
 receiptPaperPending?:()=>boolean;
 receiptPaperOverride?:(context:CanvasRenderingContext2D,options:import('./receipt-restoration').ReceiptRestorationDrawOptions)=>ReceiptRestorationDrawResult|undefined;
 receiptExtension?:(context:CanvasRenderingContext2D,options:{center:{x:number;y:number};frame:number;receiverY:number;seconds:number;carried?:boolean;cavity:{left:number;top:number;width:number;height:number};service?:ReturnType<typeof baseRobotPose>},restoration:ReceiptRestorationFrame,result:ReceiptRestorationDrawResult)=>void;
 drawSpecimen?:(context:CanvasRenderingContext2D,exhibit:Exhibit,t:number,image:HTMLImageElement,service?:ReturnType<typeof baseRobotPose>)=>boolean;
 specimenOpening?:(id:string)=>number;
 caseEngineering?:(context:CanvasRenderingContext2D,exhibit:Exhibit,level:number,t:number,layer:'back'|'front')=>void;
};
function image(url:string){const img=new Image();img.src=url;return img;}
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement|undefined,x:number,y:number,w:number,h=w){if(img?.complete&&img.naturalWidth)c.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
/** Actual rear glass → moving specimen → front glass → independent nameplate. */
export class MuseumScene {
 readonly canvas=document.createElement('canvas');ready:Promise<void>;
 private c:CanvasRenderingContext2D|null;private active=false;private visible=true;private frame=0;private frames=0;private cadence=new FrameCadence();private reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 private room:HTMLImageElement;private robot:HTMLImageElement;private renewal?:RenewalMuseum;private pose=baseRobotPose(0);private art:Record<string,HTMLImageElement>;
 private glass:Record<string,HTMLImageElement[]>;
 private receiptParts?:ReceiptStudyAssets;
 private receiptRenderer?:typeof import('./receipt-study');
 private specimenStatus?:ReceiptSpecimenResult;
 private restorationParts?:ReceiptRestorationAssets;
 private restorationRenderer?:typeof import('./receipt-restoration');
 private restorationReady?:Promise<void>;
 private restorationStatus?:ReceiptRestorationDrawResult;
 private paintIntervals:number[]=[];private paintCosts:number[]=[];private lastPaintAt=0;
 constructor(private root:HTMLElement,private source:()=>MuseumSource,private level:(id:string)=>number=()=>0,private clock:()=>number=()=>performance.now()/1000,private options:MuseumOptions={}){
  this.room=image(options.renewal?renewalRoomUrl:roomUrl);this.robot=image(options.renewal?renewalRobotAtlasUrl:robotAtlasUrl);
  this.art=Object.fromEntries(exhibitIds.map(id=>[id,image(options.renewal?'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=':textures[id])]));
  this.glass=options.renewal?{}:Object.fromEntries(exhibitIds.map(id=>[id,[image(layers[`../../assets/runtime/case-${id}-back.webp`]),image(layers[`../../assets/runtime/case-${id}-front.webp`])]]));
  if(options.renewal)this.renewal=new RenewalMuseum();
  root.classList.add('museum-room');this.canvas.id='museum-canvas';this.canvas.width=768;this.canvas.height=960;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','失物收藏室：六个独立玻璃容器，藏品在玻璃内轻轻活动');root.append(this.canvas);this.c=this.canvas.getContext('2d');
  const hits=document.createElement('div');hits.className='exhibit-hits';hits.innerHTML=(options.renewal?renewalExhibits:exhibits).map(e=>{const p=layerPoint(e,e.crop.x,e.crop.y);return `<button data-exhibit="${e.id}" data-detail="${e.id}" style="left:${p.x/768*100}%;top:${p.y/960*100}%;width:${Math.max(96,e.crop.w*e.scale)/768*100}%;height:${Math.max(96,e.crop.h*e.scale)/960*100}%"></button>`;}).join('');root.append(hits);this.ready=this.load();const visibility=new IntersectionObserver(entries=>{this.visible=entries.some(entry=>entry.isIntersecting);if(!this.visible)this.lastPaintAt=0;this.cadence.reset();this.schedule();});visibility.observe(this.canvas);document.addEventListener('visibilitychange',()=>{this.cadence.reset();this.schedule();});
 }
 private images(){return [this.robot,this.room,...Object.values(this.art),...Object.values(this.glass).flat(),...Object.values(this.receiptParts??{}),...Object.values(this.restorationParts??{})];}
 async load(){this.root.dataset.loading='true';try{if(!this.renewal&&this.options.receiptStudy&&!this.receiptParts){this.receiptRenderer??=await import('./receipt-study');this.receiptParts=this.receiptRenderer.createReceiptStudyAssets();}await Promise.all([this.renewal?.ready,this.renewal?prepareRenewalRobot():undefined,...this.images().map(i=>i.decode())]);this.canvas.dataset.ready='true';this.draw(this.clock());this.refresh();}catch{this.canvas.dataset.ready='error';this.root.setAttribute('aria-label','收藏室暂未接通，请返回后重试');}finally{this.root.dataset.loading='false';}}
 /** Explicit opt-in keeps V0.3.4 layers out of the ordinary game and old D1 path. */
 prepareReceiptRestoration(){
  if(this.renewal)return this.ready;
  this.restorationReady??=(async()=>{
   await this.ready;
   if(!this.options.receiptStudy||this.canvas.dataset.ready!=='true')throw new Error('Receipt study is unavailable');
   try{
    this.restorationRenderer=await import('./receipt-restoration');
    this.restorationParts=this.restorationRenderer.createReceiptRestorationAssets();
    await Promise.all(Object.values(this.restorationParts).map(part=>part.decode()));
   }catch(error){
    this.restorationParts=undefined;
    this.restorationReady=undefined;
    throw error;
   }
  })();
  return this.restorationReady;
 }
 mount(parent:HTMLElement){parent.append(this.root);}
 async retry(){if(this.renewal)void this.renewal.retry().catch(()=>{});for(const img of this.images()){if(img.src.startsWith('data:'))continue;const url=new URL(img.src);url.searchParams.set('retry',String(Date.now()));img.src=url.href;}this.ready=this.load();await this.ready;}
 refresh(){for(const id of exhibitIds){const b=this.root.querySelector<HTMLButtonElement>(`[data-exhibit="${id}"]`)!;const known=this.source().collection.includes(id);b.disabled=!known;b.setAttribute('aria-label',known?`放大${discoveryById(id)!.name}`:'空展柜，等待下一次发现');}}
 setActive(value:boolean){if(this.active!==value)this.cadence.reset();this.active=value;if(!value)this.lastPaintAt=0;this.refresh();if(value&&this.visible&&!document.hidden)this.draw(this.clock());if(!value){cancelAnimationFrame(this.frame);this.frame=0;}this.schedule();}
 private schedule(){if(this.active&&this.visible&&!document.hidden&&!this.frame)this.frame=requestAnimationFrame(this.loop);}
 private loop=(ms:number)=>{this.frame=0;if(this.active&&this.visible&&!document.hidden&&this.cadence.draw(ms,this.reducedMotion.matches?1000/30:1000/60))this.draw(this.clock());this.schedule();};
 resetMetrics(){this.paintIntervals.length=0;this.paintCosts.length=0;this.lastPaintAt=0;}
 metrics(){return {receiptMaterial:this.canvas.dataset.receiptMaterial??'none',receiptCondition:this.canvas.dataset.receiptCondition??'',receiptStage:this.canvas.dataset.receiptStage??'',sampleWindowMs:this.paintIntervals.reduce((sum,value)=>sum+value,0),active:this.active,visible:this.visible,frames:this.frames,intervalsMs:[...this.paintIntervals],costsMs:[...this.paintCosts]};}
 private draw(t:number){const c=this.c;if(!c||this.canvas.dataset.ready!=='true'||!this.room.complete||!this.room.naturalWidth)return;const began=performance.now();if(this.lastPaintAt)this.paintIntervals.push(began-this.lastPaintAt);this.lastPaintAt=began;this.paintIntervals=this.paintIntervals.slice(-1200);c.clearRect(0,0,768,960);this.paint(c,t);
  this.canvas.dataset.robotX=String(Math.round(this.pose.x));this.canvas.dataset.robotY=String(Math.round(this.pose.y));this.canvas.dataset.robotAction=this.pose.action;this.canvas.dataset.robotTarget=this.pose.target;
  this.root.dispatchEvent(new CustomEvent('robot-state',{detail:this.pose}));this.canvas.dataset.frame=String(++this.frames);this.paintCosts.push(performance.now()-began);this.paintCosts=this.paintCosts.slice(-1200);
 }
 private paint(c:CanvasRenderingContext2D,t:number,receipt?:{level:number;install:number;experiment?:ReceiptExperimentFrame;restoration?:ReceiptRestorationFrame},onlyExhibit?:string){if(this.renewal){this.paintRenewal(c,t,onlyExhibit);return;}c.imageSmoothingEnabled=false;sprite(c,this.room,0,0,768,960);
  // Tiny free-floating dust and lamplight are part of the room, never the whole background moving.
  for(let i=0;i<(this.reducedMotion.matches?4:16);i++){const x=(i*127+Math.sin(t*.18+i)*10)%740+14,y=110+(i*61+t*3)%620;c.fillStyle=`rgba(255,218,148,${.15+.15*Math.sin(t+i)})`;c.fillRect(Math.round(x),Math.round(y),2,2);}
  this.pose=baseRobotPose(t);
  if(this.pose.target==='receipt'&&this.restorationRenderer&&this.options.receiptFrame){
   const restoration=this.options.receiptFrame();
   if(restoration){
    const e=exhibits[0],center=itemCenter(e),floor=this.receiptRenderer!.receiptFloorGeometry(e,this.level('case-0'));
    const geometry=this.restorationRenderer.receiptRestorationGeometry(restoration,center,e.item.size*e.scale,floor.y+floor.height/2);
    const offset=(geometry.paperCenter.y-center.y)*(1-this.pose.lift);
    this.pose={...this.pose,item:{...this.pose.item,y:this.pose.item.y+offset},hand:{...this.pose.hand,y:this.pose.hand.y+offset*this.pose.contact}};
    if(restoration.stage==='buried'&&this.pose.action!=='walk'&&this.pose.action!=='return')this.pose={...this.pose,lift:0,contact:0,opening:0,action:'observe'};
   }
  }
  const entities=exhibits.filter(e=>!onlyExhibit||e.id===onlyExhibit).map(e=>({depth:e.y,draw:()=>this.case(c,e,t,receipt?(e.id==='receipt'?receipt.level:this.level(`case-${exhibitIds.indexOf(e.id)}`)):undefined,e.id==='receipt'?receipt?.install:undefined,e.id==='receipt'?receipt?.experiment:undefined,e.id==='receipt'?(receipt?.restoration??this.options.receiptFrame?.()):undefined)}));if(!receipt)entities.push({depth:this.pose.y,draw:()=>this.drawRobot(c,t)});entities.sort((a,b)=>a.depth-b.depth).forEach(e=>e.draw());
  const lights=this.level('light');if(lights){c.fillStyle=`rgba(255,207,124,${.035*lights})`;c.fillRect(0,0,768,960);}
  if(this.level('deco-0')){c.fillStyle='#ffe9ae';for(let i=0;i<12;i++)c.fillRect(34+i*62,163+(i%2)*7,4,4);}
  if(this.level('deco-1')){c.fillStyle='#7dbd9b';for(let i=0;i<9;i++)c.fillRect(25+i*4,710-Math.sin(i)*18,5,8);}
  if(this.level('deco-2')){c.fillStyle='#cf9beb';c.fillRect(580,236,56,27);c.fillStyle='#fff0c9';c.font='16px monospace';c.fillText('LR–01',584,255);}
  if(this.level('deco-3')){c.strokeStyle='#ffdc8b';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.arc(55,285,22+i*9,t*.1,t*.1+Math.PI*1.5);c.stroke();}}
 }
 private drawRobot(c:CanvasRenderingContext2D,t:number){
  const p=this.pose,moving=p.action==='walk'||p.action==='return';
  let foregroundHands:(()=>void)|undefined;
  const frame=moving?Math.floor(t*8)%4:p.action==='observe'?4:p.action==='wipe'?7:6;
  const w=p.width,feet=this.renewal?155:[149,147,149,148,148,148,149,149][frame];
  if(this.renewal){
   const ratio=p.width/144,local=(point:{x:number;y:number})=>({x:p.x+(point.x-p.x)/ratio,y:p.y+(point.y-p.y)/ratio});
   const handling=p.contact>.02;const action=handling?'pickup' as const:moving?'walk' as const:'scan' as const;
   c.save();c.fillStyle='#100c2880';c.beginPath();c.ellipse(p.x,p.y+1,31,7,0,0,Math.PI*2);c.fill();
   c.restore();
   const drawRig=(glovesOnly=false)=>{
    c.save();c.translate(p.x,p.y);c.scale(ratio,ratio);c.translate(-p.x,-p.y);
    drawRenewalRobot(c,{x:p.x,y:p.y,action,facing:p.facing>0?'right':'left',carrying:p.lift>0,parcel:{...local(p.item),held:p.lift>0,delivered:false,visible:p.lift>0},lift:p.lift,release:0},.62,{workSeconds:t,received:0,appliedWorkMs:0,assistRate:0},{hands:handling?[local({x:p.hand.x-5,y:p.hand.y}),local({x:p.hand.x+5,y:p.hand.y})]:undefined,hideGloves:handling&&!glovesOnly,glovesOnly,flip:p.facing>0,bob:0});c.restore();
   };
   drawRig();if(handling)foregroundHands=()=>drawRig(true);
  }else{
  c.save();c.translate(p.x,p.y);c.fillStyle='#100c2880';c.beginPath();c.ellipse(0,1,32,7,0,0,Math.PI*2);c.fill();
  if(p.facing>0)c.scale(-1,1);c.scale(1-p.turn*.18,1);c.rotate((p.opening-p.lift)*.025);
  c.drawImage(this.robot,frame%4*160,Math.floor(frame/4)*160,160,160,-w/2,-feet/160*w,w,w);c.restore();
  }
  if(p.contact>0&&!this.renewal){
   const elbow={x:p.shoulder.x+(p.hand.x-p.shoulder.x)*.48,y:Math.min(p.shoulder.y,p.hand.y)-12*p.contact};
   c.save();c.lineJoin='round';c.lineCap='round';
   for(const [width,color] of [[8,'#35253e'],[5,'#b7956d'],[2,'#dfc497']] as const){c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.moveTo(p.shoulder.x,p.shoulder.y);c.lineTo(elbow.x,elbow.y);c.lineTo(p.hand.x,p.hand.y);c.stroke();}
   c.fillStyle='#58425c';for(const joint of [p.shoulder,elbow,p.hand]){c.fillRect(joint.x-3,joint.y-3,6,6);c.fillStyle='#d2b482';c.fillRect(joint.x-1,joint.y-2,2,2);c.fillStyle='#58425c';}c.restore();
  }
  if(p.lift>0&&this.source().collection.includes(p.target)&&!(!this.renewal&&p.target==='receipt'&&this.options.receiptPaperPending?.())){
   const raw=(this.renewal?renewalExhibits:exhibits).find(e=>e.id===p.target)!;const level=this.level(`case-${exhibitIds.indexOf(raw.id)}`);const e=this.renewal?renewalDisplaySpecimen(raw,level):raw;
   const size=this.renewal?e.item.size*e.scale:e.item.size*e.scale*(1-p.lift)+48*p.lift;
   const scale=size/e.item.size;
   const carried={...e,x:p.item.x-(e.item.x-e.base.x)*scale,y:p.item.y-(e.item.y-e.base.y)*scale,scale};
   const restoration=!this.renewal&&e.id==='receipt'?this.options.receiptFrame?.():undefined;
   if(restoration&&this.restorationRenderer&&this.restorationParts){
    const drawOptions={center:p.item,frame:size,seconds:t,receiverY:p.item.y+size/2,lights:[],glass:0,restorationFrame:{...restoration,phase:restoration.stage==='buried'?'buried' as const:restoration.condition}};
    this.options.receiptPaperOverride?.(c,drawOptions)??this.restorationRenderer.drawReceiptRestoration(c,this.restorationParts,drawOptions);
   }else if(!this.options.drawSpecimen?.(c,carried,t,this.art[p.target as typeof exhibitIds[number]],p)){
    sprite(c,this.art[p.target as typeof exhibitIds[number]],p.item.x-size/2,p.item.y-size/2,size);
   }
  }
  if(p.contact>0&&this.renewal)foregroundHands?.();
  if(p.contact>0&&!this.renewal){
   const grip=4+(1-p.lift)*3;c.strokeStyle='#3c2d43';c.lineWidth=4;
   c.beginPath();c.moveTo(p.hand.x-grip,p.hand.y+3);c.lineTo(p.hand.x-grip,p.hand.y-3);c.lineTo(p.hand.x-grip+3,p.hand.y-5);
   c.moveTo(p.hand.x+grip,p.hand.y+3);c.lineTo(p.hand.x+grip,p.hand.y-3);c.lineTo(p.hand.x+grip-3,p.hand.y-5);c.stroke();
   c.strokeStyle='#dbc39b';c.lineWidth=1;c.stroke();
  }
 }

 private paintRenewal(c:CanvasRenderingContext2D,t:number,onlyExhibit?:string){
  const renewal=this.renewal!;renewal.drawRoom(c,t,this.reducedMotion.matches,this.level);this.pose=renewal.pose(t,this.level);
  const entities=renewalExhibits.filter(e=>!onlyExhibit||e.id===onlyExhibit).map(e=>({depth:e.y,draw:()=>{renewal.drawExhibit(c,e,t,this.source().collection.includes(e.id),this.level(`case-${exhibitIds.indexOf(e.id)}`),this.art[e.id],this.options,this.pose.target===e.id?this.pose:undefined);}}));
  if(!onlyExhibit)entities.push({depth:this.pose.y,draw:()=>this.drawRobot(c,t)});
  entities.sort((a,b)=>a.depth-b.depth).forEach(entity=>entity.draw());
  renewal.drawForegroundFacilities(c,t,this.level,this.reducedMotion.matches);
  const receipt=this.options.receiptFrame?.();
  this.canvas.dataset.visualGeneration='renewal';this.canvas.dataset.receiptMaterial=this.options.receiptPaperPending?.()?'pending':receipt?'renewal':'none';
  this.canvas.dataset.receiptCondition=receipt?.condition??'';this.canvas.dataset.receiptStage=receipt?.stage??'';
 }
 renderExhibit(canvas:HTMLCanvasElement,id:string,level:number,t=0,installation=1){if(this.renewal){const e=renewalExhibits.find(e=>e.id===id),c=canvas.getContext('2d');if(!e||!c||this.canvas.dataset.ready!=='true')return;const scale=Math.min((canvas.width-40)/210,(canvas.height-58)/320);c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#241342';c.fillRect(0,0,canvas.width,canvas.height);c.translate(canvas.width/2-e.x*scale,canvas.height-53-e.y*scale);c.scale(scale,scale);this.renewal.drawExhibit(c,e,t,this.source().collection.includes(id),level,this.art[id],this.options,undefined,installation);c.restore();canvas.dataset.installProgress=String(installation);canvas.dataset.ready='true';canvas.dataset.level=String(level);canvas.dataset.frame=String(++this.frames);canvas.dataset.seconds=String(t);return;}const e=exhibits.find(e=>e.id===id);if(!e||this.canvas.dataset.ready!=='true')return;const c=canvas.getContext('2d');if(!c)return;const scale=Math.min((canvas.width-48)/e.crop.w,(canvas.height-70)/(e.base.y-e.crop.y));c.imageSmoothingEnabled=false;c.fillStyle='#201a32';c.fillRect(0,0,canvas.width,canvas.height);this.case(c,{...e,x:canvas.width/2,y:canvas.height-48,scale,width:e.base.w*scale},t,level,1,undefined,id==='receipt'?this.options.receiptFrame?.():undefined);canvas.dataset.ready='true';canvas.dataset.level=String(level);canvas.dataset.frame=String(++this.frames);canvas.dataset.seconds=String(t);}
 /** D1 compares real structural parts in one fixed room camera, never one fitted poster per level. */
 renderFocused(canvas:HTMLCanvasElement,id:'receipt',level:number,t:number,install=1,view:'focus'|'room'|'specimen'='focus',experiment?:ReceiptExperimentFrame,restoration?:ReceiptRestorationFrame){
  if(this.renewal){this.renderExhibit(canvas,id,level,t,install);canvas.dataset.install=install.toFixed(3);canvas.dataset.tier=String(level);return;}
  if(id!=='receipt'||!this.receiptRenderer||this.canvas.dataset.ready!=='true')return;
  if(restoration&&(!this.restorationParts||!this.restorationRenderer))return;
  if(restoration)experiment=undefined;
  this.restorationStatus=undefined;
  const started=performance.now();
  const c=canvas.getContext('2d');
  if(!c)return;
  const camera=view==='room'?{left:0,top:0,width:768,height:960}
   :view==='specimen'?(restoration?this.restorationRenderer!.receiptRestorationCamera:experiment?this.receiptRenderer.receiptExperimentCamera:this.receiptRenderer.receiptSpecimenCamera):this.receiptRenderer.receiptFocusCamera;
  const scale=Math.min(canvas.width/camera.width,canvas.height/camera.height);
  const x=(canvas.width-camera.width*scale)/2,y=(canvas.height-camera.height*scale)/2;
  c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#171124';c.fillRect(0,0,canvas.width,canvas.height);c.beginPath();c.rect(x,y,camera.width*scale,camera.height*scale);c.clip();c.translate(x-camera.left*scale,y-camera.top*scale);c.scale(scale,scale);this.paint(c,t,{level,install,experiment,restoration},view==='room'?undefined:id);c.restore();
  const e=exhibits[0],item=itemCenter(e),itemSize=e.item.size*e.scale;canvas.dataset.ready='true';canvas.dataset.level=canvas.dataset.tier=String(level);canvas.dataset.install=install.toFixed(3);canvas.dataset.view=view;canvas.dataset.camera=`${camera.left},${camera.top},${camera.width},${camera.height}`;canvas.dataset.item=`${item.x},${item.y},${itemSize}`;canvas.dataset.anchor=`${e.x},${e.y}`;canvas.dataset.anchorX=String(e.x);canvas.dataset.anchorY=String(e.y);canvas.dataset.itemX=String(item.x);canvas.dataset.itemY=String(item.y);canvas.dataset.itemSize=String(itemSize);
  if(this.specimenStatus){const b=this.specimenStatus.bounds;canvas.dataset.specimenTier=String(this.specimenStatus.tier);canvas.dataset.paperBbox=`${b.left},${b.top},${b.width},${b.height}`;canvas.dataset.paperReveal=this.specimenStatus.reveal.toFixed(3);}
  const trial=this.specimenStatus?.experiment;
  canvas.dataset.experimentPhase=trial?.phase??'idle';
  canvas.dataset.researchLevel=trial?String(trial.researchLevel):'';
  if(trial){
   canvas.dataset.experimentExtension=trial.extension.toFixed(3);
   canvas.dataset.experimentBottom=trial.bottom.toFixed(3);
   canvas.dataset.experimentFloorGap=trial.floorGap.toFixed(3);
   canvas.dataset.experimentHinge=`${trial.hinge.x},${trial.hinge.y}`;
   canvas.dataset.readLineIds=trial.renderedLineIds.join(',');
  }
  const restored=(this.restorationStatus as ReceiptRestorationDrawResult|undefined)?.restoration;
  canvas.dataset.restorationPhase=restored?.phase??'idle';
  canvas.dataset.restorationCondition=restored?.condition??'';
  if(restored){
   canvas.dataset.restorationCleaning=restored.cleaning.toFixed(3);
   canvas.dataset.restorationRepairing=restored.repairing.toFixed(3);
   canvas.dataset.restorationExcavation=restored.excavation.toFixed(3);
   canvas.dataset.restorationOriginalCode=restored.originalCode;
   canvas.dataset.restorationMissing=String(restored.missingCount);
  }
  canvas.dataset.frame=String(++this.frames);
  canvas.dataset.drawMs=(performance.now()-started).toFixed(3);
 }
 private case(c:CanvasRenderingContext2D,e:Exhibit,t:number,forcedLevel?:number,install=1,experiment?:ReceiptExperimentFrame,restoration?:ReceiptRestorationFrame){
  const service=forcedLevel===undefined&&this.pose.target===e.id?this.pose:null,known=this.source().collection.includes(e.id),level=forcedLevel??this.level(`case-${exhibitIds.indexOf(e.id)}`),[back,front]=this.glass[e.id],s=e.scale,p=layerPoint(e,e.crop.x,e.crop.y),b=layerPoint(e,e.cavity.x,e.cavity.y),center=itemCenter(e),width=e.cavity.w*s,height=e.cavity.h*s;
  const paperPending=e.id==='receipt'&&Boolean(this.options.receiptPaperPending?.());
  if(e.id==='receipt'&&known&&paperPending)this.canvas.dataset.receiptMaterial='pending';
  const paperOverride:ReceiptStudyPaperOverride|undefined=restoration&&this.restorationRenderer&&this.restorationParts?(context,options)=>{
   const drawOptions={...options,receiverY:options.receiverY!,restorationFrame:restoration};
   const overridden=this.options.receiptPaperOverride?.(context,drawOptions);
   this.restorationStatus=overridden??this.restorationRenderer!.drawReceiptRestoration(context,this.restorationParts!,drawOptions);
   this.canvas.dataset.receiptMaterial=overridden?'v036':'restoration';
   this.canvas.dataset.receiptCondition=restoration.condition;this.canvas.dataset.receiptStage=restoration.stage;
   const floor=this.receiptRenderer!.receiptFloorGeometry(e,level);
   const aperture=level===3?this.receiptRenderer!.receiptVaultWindow(e):{left:b.x,top:b.y,width,height};
   const left=Math.max(b.x,aperture.left),top=Math.max(b.y,aperture.top),right=Math.min(b.x+width,aperture.left+aperture.width),bottom=Math.min(floor.frontY,aperture.top+aperture.height);
   this.options.receiptExtension?.(context,{center:options.center,frame:options.frame,receiverY:options.receiverY!,seconds:options.seconds,cavity:{left,top,width:right-left,height:bottom-top},service:service??undefined},restoration,this.restorationStatus);
   return this.restorationStatus;
  }:undefined;
  if(known)this.options.caseEngineering?.(c,e,level,t,'back');
  if(this.options.receiptStudy&&this.receiptParts&&this.receiptRenderer&&e.id==='receipt'&&level>0){this.specimenStatus=this.receiptRenderer.drawReceiptStudy(c,{e,t,level,install,known,specimenHidden:paperPending||!!service&&service.lift>0,back,front,item:this.art.receipt,assets:this.receiptParts,experiment,paperOverride});if(known)this.options.caseEngineering?.(c,e,level,t,'front');return;}
  c.save();c.fillStyle='#120d2840';c.beginPath();c.ellipse(e.x,e.y-2,e.width*.43,5,0,0,Math.PI*2);c.fill();
  c.drawImage(back,e.crop.x,e.crop.y,e.crop.w,e.crop.h,p.x,p.y,e.crop.w*s,e.crop.h*s);
  if(this.options.receiptStudy&&this.receiptRenderer&&this.receiptParts&&e.id==='receipt'&&known)this.receiptRenderer.drawStudyReceiptFloor(c,e,level,install,this.receiptParts);
  if(level){c.strokeStyle=['','#ffe0a0','#9ce9e1','#e6b2ff'][level];c.lineWidth=level===3?3:2;c.beginPath();c.ellipse(e.x,e.y-9,e.width*.40,6,0,0,Math.PI*2);c.stroke();}
  const paperClipHeight=restoration&&this.receiptRenderer?this.receiptRenderer.receiptFloorGeometry(e,level).frontY-b.y:height;
  c.save();c.beginPath();c.rect(b.x,b.y,width,paperClipHeight);c.clip();
  if(known&&!paperPending&&!(service&&service.lift>0)){
   const phase=t+exhibitIds.indexOf(e.id),bob=Math.sin(phase*1.4)*2,iw=e.item.size*s;
   if(this.options.receiptStudy&&this.receiptParts&&this.receiptRenderer&&e.id==='receipt'){
    this.specimenStatus=this.receiptRenderer.drawStudyReceiptSpecimen(c,e,t,level,install,this.receiptParts,experiment,paperOverride);
   }else{
   if(!this.options.drawSpecimen?.(c,e,t,this.art[e.id],service??undefined)){
   c.save();c.translate(center.x,center.y+bob);
   switch(e.id){
    case 'receipt':c.rotate(Math.sin(t*.8)*.035);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.fillStyle='#ffeab9';for(let i=0;i<3;i++)c.fillRect(-9+i*8,iw*.25+(t*4+i*5)%12,2,2);break;
    case 'tape':c.rotate(Math.sin(t)*.04);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle='#f5cc7a';c.lineWidth=2;c.beginPath();c.moveTo(8,iw*.24);c.lineTo(12+Math.sin(t*1.4)*3,iw*.36);c.lineTo(20,iw*.39);c.stroke();break;
    case 'nested':sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle='#dfb5fb';c.strokeRect(-7,-iw*.30-Math.sin(t*1.3)**2*4,14,9);break;
    case 'stamp':c.translate(0,-Math.max(0,Math.sin(t*1.8))*4);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.fillStyle='#b982da88';c.fillRect(-12,iw*.38,24,2);break;
    case 'cosmic-parcel':c.rotate(Math.sin(t*.7)*.02);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle='#b1d9fd';c.beginPath();c.ellipse(0,0,iw*.50,iw*.19,Math.sin(t*.6)*.4,0,Math.PI*2);c.stroke();break;
    case 'bell':c.rotate(Math.sin(t*1.5)*.07);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle=`rgba(255,224,153,${1-t%2/2})`;c.beginPath();c.ellipse(0,iw*.25,8+t%2*10,3+t%2*3,0,0,Math.PI*2);c.stroke();break;
   }
   c.restore();
   }
   }
   if(level>=2)for(let i=0;i<4;i++){c.fillStyle='#fff3b0';c.fillRect(center.x+Math.sin(t*.5+i)*width*.30,center.y+Math.cos(t*.7+i)*height*.23,2,2);}
  }
  // Register reflection-only front windows onto the back's cavity. The front sheet's
  // independent AI-drawn cap/base cannot supply a second, offset physical pedestal.
  c.save();const opacity=e.id==='cosmic-parcel'?.45:e.id==='bell'?.72:.9;const opening=Math.max(service?.opening??0,this.options.specimenOpening?.(e.id)??0);c.globalAlpha=opacity*(1-opening*.8);c.translate(opening*width*.45,0);c.drawImage(front,e.front.x,e.front.y,e.front.w,e.front.h,b.x,b.y,width,height);c.restore();c.restore();
  if(known)this.options.caseEngineering?.(c,e,level,t,'front');
  if(this.options.receiptStudy&&this.receiptRenderer&&this.receiptParts&&e.id==='receipt')this.receiptRenderer.drawStudyReceiptTicket(c,e,level,t,this.receiptParts,experiment);
  const plaqueW=Math.min(138,e.width*1.10);c.fillStyle='#2b2036';c.fillRect(e.x-plaqueW/2,e.y+12,plaqueW,27);c.strokeStyle=level?'#e8c184':'#a98054';c.lineWidth=2;c.strokeRect(e.x-plaqueW/2,e.y+12,plaqueW,27);c.fillStyle=known?'#ffe9bf':'#b9a9c7';c.font='20px monospace';c.textAlign='center';c.fillText(known?['未购买收据','道歉胶带','套娃包裹','昨天邮戳','收件人：宇宙','签收铃'][exhibitIds.indexOf(e.id)]:'等待好奇心',e.x,e.y+32,plaqueW-8);c.restore();
 }

}
/** Three habitats have independent miniature terrain, idle poses and glass foreground. */
export class HabitatScene {
 readonly canvas=document.createElement('canvas');private c:CanvasRenderingContext2D|null;private art:HTMLImageElement;private background:HTMLImageElement;private active=false;private last=0;
 constructor(root:HTMLElement,private id:typeof residentIds[number],private known:()=>boolean,private level:()=>number=()=>0){this.canvas.width=600;this.canvas.height=220;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','居民生态观察区');root.append(this.canvas);this.c=this.canvas.getContext('2d');this.art=image(textures[id as ArtId]);this.background=image(habitatUrls[`../../assets/runtime/habitat-${id}-v02.webp`]);requestAnimationFrame(this.loop);}
 setActive(v:boolean){this.active=v;}
 private loop=(ms:number)=>{if(this.active&&!document.hidden&&ms-this.last>=80){this.last=ms;this.draw(ms/1000);}requestAnimationFrame(this.loop);};
 private draw(t:number){const c=this.c;if(!c)return;const known=this.known(),level=this.level();c.imageSmoothingEnabled=false;c.fillStyle=this.id==='mouse'?'#32243c':this.id==='hermit'?'#28373e':'#2c2947';c.fillRect(0,0,600,220);
  sprite(c,this.background,0,0,600,220);
  if(known){const x=this.id==='mouse'?300+Math.sin(t*.5)*65:this.id==='hermit'?315+Math.sin(t*.25)*25:330,y=this.id==='tagbird'?101+Math.sin(t*2)*2:185;const w=this.id==='mouse'?122:this.id==='hermit'?132:103;c.save();c.translate(x,y);c.scale(this.id==='mouse'&&Math.cos(t*.5)<0?-1:1,1);c.rotate(Math.sin(t*(this.id==='tagbird'?2:1))*.022);sprite(c,this.art,-w/2,-w,w);c.restore();if(this.id==='mouse'){c.fillStyle='#f1d9b0';c.fillRect(x+35,167,12,3);}}
  if(level){c.fillStyle='#f9dda455';c.fillRect(0,0,600,8);c.fillStyle='#9ed9ca';for(let i=0;i<level*3;i++)c.fillRect(490+i*10,164-i%3*9,6,11);if(level>=2){c.fillStyle='#d5afdd';for(let i=0;i<5;i++)c.fillRect(499+i*9,145-i%2*5,6,6);}}
  c.fillStyle='#bce4ed12';c.fillRect(0,0,600,220);c.fillStyle='#e3edfc70';c.fillRect(14,20,3,140);c.fillRect(21,20,4,35);c.fillRect(577,37,3,91);c.strokeStyle='#ae8e65';c.lineWidth=5;c.strokeRect(3,3,594,214);this.canvas.dataset.frame=String(Math.floor(t*12));
 }
}
