/** Modern RET-031: one connected printed sheet. No receipt facts, prices, save or DOM access. */
export type ReceiptPoint={x:number;y:number};
export type ReceiptMatrix=readonly[number,number,number,number,number,number];
export interface ReceiptPaperCommand {key:string;matrix:ReceiptMatrix;clip?:readonly[number,number,number,number]}
export interface ReceiptPaperPose {cleaning:number;upper:number;lower:number;flex:number}
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const ease=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
export const modernReceiptBounds={x:39,y:13,width:115,height:153} as const;
export const modernReceiptSupport={x:96,y:195} as const;
/** Canonical paper-space sweeps. Tool tips are projected through the same sheet field. */
export const modernReceiptCleanPaths=[
 [{x:43,y:15},{x:155,y:15}],[{x:155,y:36},{x:39,y:36}],
 [{x:36,y:57},{x:156,y:57}],[{x:153,y:78},{x:34,y:78}],
 [{x:32,y:99},{x:151,y:99}],[{x:151,y:120},{x:29,y:120}],
 [{x:27,y:141},{x:149,y:141}],[{x:145,y:162},{x:27,y:162}],
] as const;
export const modernReceiptClampContacts=[{id:'tl',x:117/2,y:35/2},{id:'tr',x:305/2,y:43/2},{id:'bl',x:78/2,y:318/2},{id:'br',x:270/2,y:322/2}] as const;
export function modernReceiptPose(cleaning:number,corrections:readonly number[],seconds=0,trial=0,reduced=true,envelope=1):ReceiptPaperPose{
 const complete=clamp(corrections[0]??0)===1&&clamp(corrections[1]??0)===1;
 const explicit=trial>0&&trial<1?Math.sin(trial*Math.PI)*(reduced?.3:1):0;
 const idle=complete&&!reduced?(1+Math.sin(seconds*1.15))*.10:0;
 return{cleaning:clamp(cleaning),upper:clamp(corrections[0]??0),lower:clamp(corrections[1]??0),flex:complete?(explicit*.8+idle)*clamp(envelope):0};
}
const bump=(y:number,center:number,width:number)=>Math.exp(-(((y-center)/width)**2));
/** Smooth, monotonic whole-sheet mapping. No detached corner patches or duplicated print. */
export function modernReceiptPoint(point:ReceiptPoint,pose:ReceiptPaperPose):ReceiptPoint{
 const y=point.y,foldTop=bump(y,59,17),foldBottom=bump(y,126,15);
 const dirtyFold=(1-ease((pose.cleaning-.60)/.35));
 const upper=(1-pose.upper),lower=(1-pose.lower);
 const shift=(Math.sin((y-59)*.12)*foldTop*(.9+dirtyFold*2.3)*upper)
   +(Math.sin((y-126)*.14)*foldBottom*(1.2+dirtyFold*3.5)*lower)
   +Math.sin((y-105)/38*Math.PI)*bump(y,111,27)*pose.flex;
 const narrow=foldTop*(.012+dirtyFold*.025)*upper+foldBottom*(.016+dirtyFold*.05)*lower;
 const vertical=foldTop*(.8+dirtyFold*2.4)*upper-foldBottom*(1.0+dirtyFold*3.6)*lower;
 return{x:96+(point.x-96)*(1-narrow)+shift,y:y+vertical};
}
/** Connected scanlines, each sampling the SAME full printed master; source regions never crossfade. */
export function modernReceiptCommands(pose:ReceiptPaperPose):ReceiptPaperCommand[]{
 if(pose.cleaning===1&&pose.upper===1&&pose.lower===1&&Math.abs(pose.flex)<1e-8)return[{key:'receipt-paper-master',matrix:[1,0,0,1,0,0]}];
 const rows:ReceiptPaperCommand[]=[];
 for(let y=0;y<192;y++){
  const left=modernReceiptPoint({x:0,y},pose),right=modernReceiptPoint({x:192,y},pose),next=modernReceiptPoint({x:0,y:y+1},pose);
  const a=(right.x-left.x)/192,d=next.y-left.y;
  rows.push({key:'receipt-paper-master',matrix:[a,0,0,d,left.x,left.y-d*y],clip:[0,y,192,1.02]});
 }
 return rows;
}
export function modernReceiptRepairContact(step:number,corrections:readonly number[]){
 return modernReceiptPoint(step===0?{x:109,y:59}:{x:67,y:126},modernReceiptPose(1,corrections));
}
/** Hardware remains independent from the paper and has real front/back jaws. */
export function modernReceiptClampAmount(cleaning:number,repairing:number){
 return ease((cleaning-.68)/.28)*(1-ease((repairing-.88)/.12));
}
/** Shared archival support: the feet (195) land at the same registered sole in every case level. */
export const modernReceiptHolder={width:192,height:216,sole:modernReceiptSupport.y} as const;

/** Inverse rasterization of the connected sheet, not alpha-over scanline patches.
 * Each destination pixel samples the master exactly once, so opaque print cannot become translucent.
 * Caller owns/reuses the 384px destination buffer. */
export function warpModernReceiptPixels(source:Uint8Array|Uint8ClampedArray,pose:ReceiptPaperPose,target:Uint8ClampedArray){
 if(source.length!==384*384*4||target.length!==source.length)throw new Error('receipt-paper-384-required');
 target.fill(0);
 for(let row=0;row<384;row++){
  const destY=(row+.5)/2;
  let low=Math.max(0,destY-8),high=Math.min(192,destY+8);
  // y deformation is monotonic at every authored state. No triangles are detached or duplicated.
  for(let i=0;i<10;i++){const mid=(low+high)/2;if(modernReceiptPoint({x:0,y:mid},pose).y<destY)low=mid;else high=mid;}
  const sy=(low+high)/2;if(sy<0||sy>=192)continue;
  const left=modernReceiptPoint({x:0,y:sy},pose),right=modernReceiptPoint({x:192,y:sy},pose),scale=(right.x-left.x)/192;
  const sourceY=Math.min(383,Math.floor(sy*2));
  for(let col=0;col<384;col++){
   const sx=((col+.5)/2-left.x)/scale;if(sx<0||sx>=192)continue;
   const from=(sourceY*384+Math.min(383,Math.floor(sx*2)))*4,to=(row*384+col)*4;
   target[to]=source[from];target[to+1]=source[from+1];target[to+2]=source[from+2];target[to+3]=source[from+3];
  }
 }
 return target;
}
