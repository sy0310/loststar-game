import {modernReceiptRepairContact} from './receipt-paper-model';
/** Shared by Canvas rendering and the deterministic PNG exporter. No DOM or save access. */
export type RigId='receipt'|'tape'|'nested'|'stamp'|'cosmic-parcel'|'bell';
export type RigMatrix=readonly[number,number,number,number,number,number];
export interface RigCommand {key:string;matrix:RigMatrix;clip?:readonly[number,number,number,number];polygon?:readonly RigPoint[]}
export type RigPoint={x:number;y:number};
const I:RigMatrix=[1,0,0,1,0,0];
const clamp=(p:number)=>Number.isFinite(p)?Math.max(0,Math.min(1,p)):0;
const rotate=(pivot:RigPoint,angle:number,dx=0,dy=0):RigMatrix=>{const a=Math.cos(angle),b=Math.sin(angle);return[a,b,-b,a,pivot.x+dx-a*pivot.x+b*pivot.y,pivot.y+dy-b*pivot.x-a*pivot.y];};
export const rigTransform=(m:RigMatrix,p:RigPoint)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
const paperOrigin={x:118,y:20},paperNormal={x:48/Math.hypot(38,48),y:-38/Math.hypot(38,48)},paperAlong={x:38/Math.hypot(38,48),y:48/Math.hypot(38,48)};
function curlCoordinate(v:number,broken:number){const theta=clamp(v/40)*Math.PI*1.2,r=9.5;return{v:v+(r*Math.sin(theta)-v)*broken,z:r*(1-Math.cos(theta))*broken,back:broken>.35&&Math.cos(theta)<0};}
function receiptCurlPoint(p:RigPoint,broken:number){const v=(p.x-paperOrigin.x)*paperNormal.x+(p.y-paperOrigin.y)*paperNormal.y,q=curlCoordinate(v,broken);return{x:p.x+paperNormal.x*(q.v-v)+.1*q.z,y:p.y+paperNormal.y*(q.v-v)+.7*q.z};}
function receiptCurlCommands(broken:number):RigCommand[]{
 if(broken<1e-8)return[{key:'receipt-rig-joint0',matrix:I}];const result:RigCommand[]=[];
 for(let v=0;v<44;v+=2){const q=curlCoordinate(v,broken),r=curlCoordinate(v+2,broken),mv=(r.v-q.v)/2,mz=(r.z-q.z)/2,ev=q.v-mv*v,ez=q.z-mz*v,n=paperNormal,dot=n.x*paperOrigin.x+n.y*paperOrigin.y;
  const a=1+n.x*(mv-1)*n.x+.1*mz*n.x,b=n.y*(mv-1)*n.x+.7*mz*n.x,c=n.x*(mv-1)*n.y+.1*mz*n.y,d=1+n.y*(mv-1)*n.y+.7*mz*n.y;
  const e=n.x*ev+.1*ez-(n.x*(mv-1)+.1*mz)*dot,f=n.y*ev+.7*ez-(n.y*(mv-1)+.7*mz)*dot;
  const poly=[[-160,v],[230,v],[230,v+2],[-160,v+2]].map(([s,t])=>({x:paperOrigin.x+paperAlong.x*s+n.x*t,y:paperOrigin.y+paperAlong.y*s+n.y*t}));
  result.push({key:curlCoordinate(v+1,broken).back?'receipt-rig-joint0-back':'receipt-rig-joint0',matrix:[a,b,c,d,e,f],polygon:poly});
 }return result;
}
function receiptFold(broken:number):RigMatrix{const angle=broken*2.05,c=Math.cos(angle),z=Math.sin(angle),n={x:-30/Math.hypot(43,30),y:43/Math.hypot(43,30)},origin={x:22,y:141},dot=n.x*origin.x+n.y*origin.y;const a=1+n.x*(c-1)*n.x,b=n.y*(c-1)*n.x-.4*z*n.x,cc=n.x*(c-1)*n.y,d=1+n.y*(c-1)*n.y-.4*z*n.y;return[a,b,cc,d,-n.x*(c-1)*dot,(-n.y*(c-1)+.4*z)*dot];}
function tapeTailPoint(p:RigPoint,broken:number,trial=0){const t=clamp((p.y-94)/50),bend=broken*13+trial*4;return{x:p.x-bend*t*t,y:p.y+(broken*9-trial*3)*t*t};}
function cosmicBandPoint(p:RigPoint,broken:number){const t=clamp((p.y-22)/143),loop=Math.sin(t*Math.PI);return{x:p.x-broken*14*loop,y:p.y-broken*7*Math.sin(clamp((p.y-22)/61)*Math.PI)};}
function tagMatrix(broken:number,knock=0):RigMatrix{const aa=1-.08*broken,bb=.08*broken,cc=.20*broken,dd=1-.17*broken,angle=knock*.055,cs=Math.cos(angle),sn=Math.sin(angle),a=cs*aa-sn*bb,b=sn*aa+cs*bb,c=cs*cc-sn*dd,d=sn*cc+cs*dd;const p={x:81,y:79};return[a,b,c,d,p.x-a*p.x-c*p.y,p.y-b*p.x-d*p.y];}
function lidMatrix(c0:number,c1:number,trial=0,idle=0):RigMatrix{
 const angle=.15*(1-c0)+.25*c0*(1-c1)+trial*.60+idle;
 const ux=86,uy=14,vx=-50,vy=42,det=ux*vy-vx*uy;
 const tx=vx*Math.cos(angle)-6*(1-c0),ty=vy*Math.cos(angle)-55*Math.sin(angle);
 const a=(ux*vy-tx*uy)/det,c=(-ux*vx+tx*ux)/det,b=(uy*vy-ty*uy)/det,d=(-uy*vx+ty*ux)/det;
 return[a,b,c,d,80-a*80-c*43,43-b*80-d*43];
}
function cornerPoint(p:RigPoint,broken:number){const t=clamp((p.y-126)/45);return{x:p.x+broken*6*t,y:p.y-broken*5*t};}
function stripCommands(key:string,axis:'x'|'y',point:(p:RigPoint)=>RigPoint,back?:(value:number)=>boolean,range:readonly[number,number]=[0,192]){
 const samples=[range[0],(range[0]*3+range[1])/4,(range[0]+range[1])/2,(range[0]+range[1]*3)/4,range[1]];
 if(samples.every(value=>{const p=axis==='x'?{x:value,y:0}:{x:0,y:value},q=point(p);return Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<1e-8;}))return[{key,matrix:I}];
 const commands:RigCommand[]=[];
 for(let value=range[0];value<range[1];value+=2){
  const first=point(axis==='x'?{x:value,y:0}:{x:0,y:value}),next=point(axis==='x'?{x:value+2,y:0}:{x:0,y:value+2});
  const a=axis==='x'?(next.x-first.x)/2:1,b=axis==='x'?(next.y-first.y)/2:0,c=axis==='y'?(next.x-first.x)/2:0,d=axis==='y'?(next.y-first.y)/2:1;
  const e=axis==='x'?first.x-a*value:first.x-c*value,f=axis==='x'?first.y-b*value:first.y-d*value;
  commands.push({key:back?.(value)?`${key}-back`:key,matrix:[a,b,c,d,e,f],clip:axis==='x'?[value,0,2,192]:[0,value,192,2]});
 }
 return commands;
}
/** Every command draws one physical layer at full opacity; there is no full-object crossfade. */
export function curioRigCommands(id:RigId,corrections:readonly number[],seconds=0,trial=0,reduced=true):RigCommand[]{
 const c0=clamp(corrections[0]??0),c1=clamp(corrections[1]??0);
 const active=trial>0&&trial<1?Math.sin(trial*Math.PI)*(reduced?.3:1):0,idle=reduced?0:Math.sin(seconds*1.25);
 const b0=1-c0+(id==='receipt'&&c0===1?(reduced?0:(idle+1)*.05)+active*.18:0),b1=1-c1+(id==='receipt'&&c1===1?active*.22:0);
 const fixed:RigCommand={key:`${id}-rig-fixed`,matrix:I};
 if(id==='receipt')return[fixed,...receiptCurlCommands(b0),{key:b1>.76?'receipt-rig-joint1-back':'receipt-rig-joint1',matrix:receiptFold(b1)},...(active>.01?[{key:'receipt-rig-fibre',matrix:I}]:[])];
 if(id==='tape')return[fixed,{key:'tape-rig-joint0',matrix:rotate({x:125,y:76},-.14*b0+(reduced?0:idle*.007),-4*b0,3*b0)},...stripCommands('tape-rig-joint1','y',p=>tapeTailPoint(p,b1,active+(reduced?0:(idle+1)*.25)),undefined,[90,146]),{key:'tape-rig-front',matrix:I}];
 if(id==='nested'){
  const inner=rotate({x:97,y:111},.12*b1,-7*b1,3*b1);
  const scaled:RigMatrix=[inner[0]*.32,inner[1]*.32,inner[2]*.32,inner[3]*.32,inner[4]+65.2,inner[5]+82.8];
  return[fixed,...(c0<.999||c1<.999||active>.01?[{key:'nested-rig-inner',matrix:scaled}]:[]),{key:'nested-rig-front',matrix:I},...stripCommands('nested-rig-corner','y',p=>cornerPoint(p,b1),undefined,[126,178]),{key:'nested-rig-joint0',matrix:lidMatrix(c0,c1,active,reduced?0:(idle+1)*.009)}];
 }
 if(id==='stamp')return[fixed,{key:'stamp-rig-joint0',matrix:rotate({x:98,y:103},-.30*b0,-3*b0,3*b0+active*5+(reduced?0:(idle+1)*1.6))},{key:'stamp-rig-joint1',matrix:rotate({x:98,y:108},-.22*b1,-4*b1,-5*b1)}];
 if(id==='cosmic-parcel'){
  const pulse=(start:number)=>trial>start&&trial<start+.12?Math.sin((trial-start)/.12*Math.PI):0;
  const knock=(pulse(.43)+pulse(.70))*1.8*(reduced?.3:1);
  return[fixed,...stripCommands('cosmic-parcel-rig-joint0','y',p=>cosmicBandPoint(p,b0),undefined,[22,162]),{key:'cosmic-parcel-rig-string',matrix:I},{key:'cosmic-parcel-rig-joint1',matrix:tagMatrix(b1+(reduced?0:(idle+1)*.08),knock)}];
 }
 const press=trial>.42?Math.sin(clamp((trial-.42)/.58)*Math.PI)*6:0;
 return[fixed,{key:'bell-rig-joint1',matrix:[1,0,0,1,0,16*b1+press*(reduced?.3:1)+(reduced?0:(idle+1)*1.1)]},{key:'bell-rig-joint0',matrix:rotate({x:142,y:139},.35*b0,1+6*b0,3-5*b0)}];
}
/** Exact specimen-local point used by the same tool which moves the joint. */
export function curioRigContact(id:RigId,step:number,corrections:readonly number[]):RigPoint{
 const c0=clamp(corrections[0]??0),c1=clamp(corrections[1]??0),b0=1-c0,b1=1-c1;
 if(id==='receipt')return modernReceiptRepairContact(step,corrections);
 if(id==='tape')return step===0?rigTransform(rotate({x:125,y:76},-.14*b0,-4*b0,3*b0),{x:125,y:70}):tapeTailPoint({x:45,y:125},b1);
 if(id==='nested')return step===0?rigTransform(lidMatrix(c0,c1),{x:130,y:105}):cornerPoint({x:38,y:151},b1);
 if(id==='stamp')return step===0?rigTransform(rotate({x:98,y:103},-.30*b0,-3*b0,3*b0),{x:97,y:89}):rigTransform(rotate({x:98,y:108},-.22*b1,-4*b1,-5*b1),{x:98,y:108});
 if(id==='cosmic-parcel')return step===0?cosmicBandPoint({x:89,y:53},b0):rigTransform(tagMatrix(b1),{x:82,y:128});
 return step===0?rigTransform(rotate({x:142,y:139},.35*b0,1+6*b0,3-5*b0),{x:142,y:139}):{x:97,y:32+16*b1};
}
export const curioRigHinge=(corrections:readonly number[],p:RigPoint,trial=0)=>rigTransform(lidMatrix(clamp(corrections[0]??0),clamp(corrections[1]??0),trial),p);
