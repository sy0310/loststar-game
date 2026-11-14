import type {ResidentDrawResult} from './residents';
import type {ResidentEnvironment,ResidentId} from './resident-motion';
import {residentDailyPose} from '../review/resident-daily';
const urls=import.meta.glob('../../assets/runtime/visual-renewal/museum/{mouse,hermit,tagbird}-[0-2].webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
export interface RenewalResidentAssets {images:Record<string,HTMLImageElement>}
let assets:Promise<RenewalResidentAssets>|undefined;
export function loadRenewalResidents(){
 assets??=Promise.all(Object.entries(urls).map(async([path,url])=>{const image=new Image();image.src=url;await image.decode();return [path.split('/').at(-1)!.replace('.webp',''),image] as const;})).then(entries=>({images:Object.fromEntries(entries)})).catch(error=>{assets=undefined;throw error;});
 return assets;
}
/** Shared by the first-planet surface and resident windows: one real clock, one physical foot. */
export function drawRenewalResident(context:CanvasRenderingContext2D,id:ResidentId,environment:ResidentEnvironment,art:RenewalResidentAssets,transition?:{origin:{x:number;y:number};blend:number}):ResidentDrawResult{
 const original=residentDailyPose(id,environment),seconds=environment.seconds,rest=environment.rest;
 const pose=transition?{...original,x:transition.origin.x+(original.x-transition.origin.x)*transition.blend,y:transition.origin.y+(original.y-transition.origin.y)*transition.blend}:original;
 const active=environment.period==='day';
 const flight=id==='tagbird'&&active&&(pose.action==='flying'||pose.action==='landing');
 const awakePose=id==='mouse'?(pose.action==='eating'||pose.action==='sniffing'?1:0):id==='hermit'?(pose.action==='carrying'||pose.action==='dragging-paper'?1:0):flight?1:0;
 const selected=rest>.88?2:awakePose,image=art.images[`${id}-${selected}`];
 const scale=pose.width/154,foot=id==='tagbird'?142:158,left=-88*scale,top=-foot*scale;
 context.save();context.fillStyle=id==='tagbird'?'#24134230':'#24134260';context.beginPath();context.ellipse(pose.x,id==='tagbird'?294:pose.y+1,pose.shadow,pose.shadow*.22,0,0,Math.PI*2);context.fill();
 context.translate(pose.x,pose.y);if(pose.flip)context.scale(-1,1);context.scale(scale,scale);
 const breathing=selected===2?Math.sin(seconds*1.4)*.012:0;
 context.scale(1-breathing*.3,1+breathing);
 if(flight){
  // The raised wing fan hinges at its authored shoulder seam; the bird body stays continuous.
  const hinge=83,stroke=(1-Math.cos(seconds*9))*.5;
  context.drawImage(image,0,hinge,176,176-hinge,-88,hinge-foot,176,176-hinge);
  const height=hinge*(1-stroke*.42);context.drawImage(image,0,0,176,hinge,-88,hinge-foot-height,176,height);
 }else if(active&&!pose.stopped&&id!=='tagbird'){
  const split=132,step=Math.sin(seconds*(id==='mouse'?8:5))*1.4;
  context.drawImage(image,0,0,176,split,-88,-foot,176,split);
  context.drawImage(image,0,split,88,44,-88+step,split-foot,88,44);
  context.drawImage(image,88,split,88,44,-step,split-foot,88,44);
 }else if(active&&id==='hermit'&&pose.action==='shaking'){
  context.rotate(Math.sin(seconds*15)*.027);context.drawImage(image,-88,-foot,176,176);
 }else if(active&&id==='mouse'&&(pose.action==='eating'||pose.action==='sniffing')){
  const hinge=136,nibble=(1-Math.cos(seconds*(pose.action==='eating'?10:4)))*1.2;
  context.drawImage(image,0,hinge,176,176-hinge,-88,hinge-foot,176,176-hinge);
  context.drawImage(image,0,0,176,hinge,-88,hinge-foot-(hinge-nibble),176,hinge-nibble);
 }else if(active&&id==='mouse'&&pose.action==='ear-twitch'){
  const hinge=68,shift=Math.sin(seconds*18)*.6;context.drawImage(image,0,hinge,176,176-hinge,-88,hinge-foot,176,176-hinge);
  context.drawImage(image,0,0,176,hinge,-88+shift,-foot,176,hinge);
 }else context.drawImage(image,-88,-foot,176,176);
 context.restore();
 return {...pose,source:`renewal-${id}-${selected}.webp`,nightArt:selected===2,flightArt:flight};
}
export function createRenewalResidentRenderer(){
 let art:RenewalResidentAssets|undefined;const ready=loadRenewalResidents().then(loaded=>{art=loaded;});
 return {ready,draw:(context:CanvasRenderingContext2D,id:ResidentId,environment:ResidentEnvironment)=>art?drawRenewalResident(context,id,environment,art):undefined};
}
