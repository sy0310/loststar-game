/** One mechanical clock for tape/bell. This module never reads or writes a save, price or reward. */
export const mechanismTrialMs=2600;
export type MechanismId='tape'|'bell';
export type MechanismPoint={x:number;y:number};
export type MechanismPhase='idle'|'reach'|'feed'|'press'|'hold'|'release'|'return'|'settle';
export interface MechanismOptions{trial?:number;seconds?:number;abilityLevel?:number;corrections?:readonly number[];reducedMotion?:boolean;serviceEnvelope?:number}
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const ease=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const point=(a:MechanismPoint,b:MechanismPoint,t:number)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
/** Temporary static registration remains in mechanisms-v042/static-registration until root approves all contacts. */
export const mechanismAnchors={tape:{axis:{x:118.5,y:68.575},rearBearing:{x:68,y:60},frontBearing:{x:147.5,y:73.5},guide:{x:55.5,y:134},outlet:{x:48,y:143.65},restTip:{x:40.5,y:154.5},rollRadius:52},bell:{axis:{x:99,y:65.25},buttonRest:{x:99,y:38.25},buttonBBoxTop:{x:99,y:30},screwSeat:{x:142,y:145.5},frontLipY:67.5}} as const;
export function mechanismFrame(id:MechanismId,options:MechanismOptions={}){
 const trial=clamp(options.trial??0),time=trial*mechanismTrialMs/1000,playing=trial>0&&trial<1,envelope=clamp(options.serviceEnvelope??1);
 const corrections=[clamp(options.corrections?.[0]??1),clamp(options.corrections?.[1]??1)];
 const level=Math.min(2,Math.max(0,Math.floor(options.abilityLevel??0)));
 if(id==='tape'){
  const amount=!playing?0:time<.25?0:time<.85?ease((time-.25)/.60):time<1.1?1:time<2.15?1-ease((time-1.1)/1.05):0;
  const length=25*amount*envelope,axis=mechanismAnchors.tape.axis,outlet=mechanismAnchors.tape.outlet;
  const curl=(1-corrections[1])*7+(playing&&time>=.85&&time<1.1?Math.sin((time-.85)/.25*Math.PI)*(options.reducedMotion?.3:1):0);
  const tip={x:mechanismAnchors.tape.restTip.x+(1-corrections[1])*6.5-length*.72,y:mechanismAnchors.tape.restTip.y-(1-corrections[1])*8.5+length*.69-curl};
  const phase:MechanismPhase=!playing?'idle':time<.25?'reach':time<.85?'feed':time<1.1?'hold':time<2.15?'return':'settle';
  const toolContact=playing&&time>=.25&&time<2.15;
  const approach=point({x:260,y:130},tip,ease(time/.25));
  const dock=!playing?1:time<.25?1-ease(time/.25):time<=2.15?0:ease((time-2.15)/.45);
  return{id,trialTime:time,phase,playing,abilityLevel:level,fixedAnchors:{axis,outlet},tool:{tip:time<.25?approach:time<=2.15?tip:point(tip,{x:260,y:130},ease((time-2.15)/.45)),dock,contact:toolContact,pressure:toolContact?1:0},tape:{axis,outlet,tip,length,rollAngle:length/mechanismAnchors.tape.rollRadius,curl,alignment:corrections[0],tension:corrections[1]},bell:undefined};
 }
 const axis=mechanismAnchors.bell.axis,rest=mechanismAnchors.bell.buttonRest;
 const press=!playing?0:time<.35?0:time<.65?ease((time-.35)/.30):time<.80?1:time<1.05?1-ease((time-.80)/.25):0;
 const stroke=(1-corrections[1])*8+press*4*envelope,buttonTop={x:rest.x,y:rest.y+stroke};
 const hit=playing&&time>=.65&&time<.80&&envelope>.01;
 const ringing=playing&&time>=.65&&time<1.80&&envelope>.01;
 const ringEnergy=ringing?Math.exp(-(time-.65)*4.5)*(options.reducedMotion?.4:1)*envelope:0;
 const phase:MechanismPhase=!playing?'idle':time<.35?'reach':time<.65?'press':time<.80?'hold':time<1.05?'release':time<1.4?'return':'settle';
 const toolContact=playing&&time>=.35&&time<=1.05;
 const from={x:260,y:14},away={x:260,y:14},dock=!playing?1:time<.35?1-ease(time/.35):time<=1.05?0:ease((time-1.05)/.35);
 const toolTip=time<.35?point(from,buttonTop,ease(time/.35)):time<=1.05?buttonTop:point(buttonTop,away,ease((time-1.05)/.35));
 return{id,trialTime:time,phase,playing,abilityLevel:level,fixedAnchors:{axis,screwSeat:mechanismAnchors.bell.screwSeat},tool:{tip:toolTip,dock,contact:toolContact,pressure:press},tape:undefined,bell:{axis,buttonTop,stroke,triggered:hit,ringEnergy,screwDepth:(1-corrections[0])*7}};
}

export function mechanismStateProgress(state:{condition:string;action?:{kind:string;startedAt:number;endsAt:number}},now:number){
 const action=state.action,phase=action?clamp((now-action.startedAt)/Math.max(1,action.endsAt-action.startedAt)):0;
 const cleaning=state.condition==='found'?(action?.kind==='clean'?phase:0):1;
 const repairing=state.condition==='stabilized'?1:action?.kind==='repair'?phase:0;
 return{cleaning,repairing,corrections:[ease((repairing*2-.23)/.44),ease((repairing*2-1.23)/.44)]};
}
export function mechanismRepairContact(id:MechanismId,step:number,corrections:readonly number[]):MechanismPoint{
 const first=clamp(corrections[0]??0),second=clamp(corrections[1]??0);
 if(id==='bell')return step===0?{x:142+(1-first)*5,y:145.5+(1-first)*5}:{x:99,y:45.5+(1-second)*8};
 return step===0?{x:61+(1-first)*3,y:121-(1-first)*4}:{x:48+(1-second)*3,y:143.65-(1-second)*5};
}
/** 384-native connected band. Each destination pixel samples one material surface, never a screenshot crop. */
export function mechanismRibbonPoints(frame:ReturnType<typeof mechanismFrame>){
 if(!frame.tape)return[];
 const {alignment,tension,length,curl}=frame.tape,extra=length*2,loose=1-tension,skew=1-alignment;
 return[{x:150,y:190},{x:137+skew*7,y:220},{x:123+skew*4,y:245-skew*5},{x:111,y:268},
  {x:95+loose*3-extra*.34,y:288-loose*12+extra*.30},{x:81+loose*13-extra*.72,y:309-loose*17+extra*.69-curl*2}];
}
export function mechanismRibbonFront(x:number,y:number){return y>=279+(x-50)*.18;}
export const mechanismRibbonRegion={x:16,y:174,width:176,height:202} as const;
export interface MechanismTexture{width:number;height:number;data:Uint8Array|Uint8ClampedArray}
/** Shared Canvas/PNG material mapping. Only the small band region is rasterized; no screenshot sections. */
export function rasterMechanismRibbon(frame:ReturnType<typeof mechanismFrame>,face:MechanismTexture,back:MechanismTexture,tip:MechanismTexture,target:Uint8ClampedArray){
 return rasterMechanismSurface(mechanismRibbonPoints(frame),face,back,tip,target,mechanismRibbonRegion,(frame.tape?.tension??1)<.99,23,true);
}
export function rasterMechanismSurface(points:readonly MechanismPoint[],face:MechanismTexture,back:MechanismTexture,tip:MechanismTexture,target:Uint8ClampedArray,region:{x:number;y:number;width:number;height:number},reversed=false,halfWidth=23,terminal=true){
 target.fill(0);if(points.length<2)return target;
 let total=0;const segments=points.slice(1).map((b,i)=>{const a=points[i],length=Math.hypot(b.x-a.x,b.y-a.y),v={a,b,length,start:total};total+=length;return v;});
 for(let row=0;row<region.height;row++)for(let col=0;col<region.width;col++){
  const x=col+region.x+.5,y=row+region.y+.5;let best=Infinity,arc=0,v=0;
  for(const s of segments){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,raw=((x-s.a.x)*dx+(y-s.a.y)*dy)/(s.length*s.length);if(s===segments[0]&&raw<0||s===segments.at(-1)&&raw>1)continue;
   const t=clamp(raw),px=s.a.x+t*dx,py=s.a.y+t*dy,side=((x-px)*-dy+(y-py)*dx)/s.length,d=Math.hypot(x-px,y-py),width=halfWidth-(s.start+t*s.length)/total*(terminal?3:0);
   if(d<best&&Math.abs(side)<width&&d<width+.2){best=d;arc=s.start+t*s.length;v=(side/width+1)/2;}
  }
  if(!Number.isFinite(best))continue;
  let material=reversed&&arc>total*.72?back:face,sx=3+Math.floor((arc*3.2)%Math.max(1,material.width-6)),sy=3+Math.floor(v*Math.max(1,material.height-7));
  if(terminal&&arc>total-20){material=tip;sx=3+Math.floor(v*Math.max(1,material.width-7));sy=5+Math.floor((arc-total+20)/20*Math.max(1,material.height-9));}
  const from=(sy*material.width+sx)*4,to=(row*region.width+col)*4;
  target[to]=material.data[from];target[to+1]=material.data[from+1];target[to+2]=material.data[from+2];target[to+3]=material.data[from+3];
 }
 return target;
}
export interface MechanismDrawCommand{key:string;dy?:number;matrix?:readonly[number,number,number,number,number,number];clip?:readonly[number,number,number,number];polygon?:readonly MechanismPoint[];raw?:boolean}
/** Both the final PNG exporter and room/workbench/ability view consume these same depth commands. */
export function mechanismDrawCommands(frame:ReturnType<typeof mechanismFrame>):MechanismDrawCommand[]{
 if(frame.id==='tape')return[{key:'tape-frame-back'},{key:'tape-spindle',raw:true},{key:'tape-roll'},
  {key:'tape-spindle',raw:true,polygon:[{x:229,y:114},{x:326,y:130},{x:317,y:169},{x:225,y:152}]},
  {key:'ribbon'},{key:'tape-frame-front'},{key:'tape-spindle-cap'},
  {key:'ribbon',polygon:[{x:0,y:270},{x:384,y:339.12},{x:384,y:384},{x:0,y:384}]}];
 const bell=frame.bell!,depth=bell.screwDepth*2;
 return[{key:'bell-shell'},{key:'bell-collar-back'},
  {key:'bell-plunger',dy:bell.stroke*2,clip:[0,0,384,135]},
  {key:'bell-collar-front'},
  ...(depth>.001?[{key:'bell-screw-thread',matrix:[1,0,0,1,depth*.72,depth*.69] as const,polygon:[{x:261,y:302},{x:297,y:267},{x:353,y:324},{x:316,y:359}]}]:[]),
  {key:'bell-screw-head',matrix:[1,0,0,1,depth*.72,depth*.69]}];
}
