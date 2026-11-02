export type Action = 'walk' | 'scan' | 'pickup' | 'return' | 'unload';
type Point = readonly [number, number];
const OUTBOUND: Point[] = [[327,454],[225,435],[226,370],[310,340],[474,356]];
const INBOUND: Point[] = [[474,356],[497,403],[448,471],[365,475],[327,454]];
function pointOnPath(path: Point[], fraction: number) {
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],p[1]-path[i][1]));
  let left=Math.max(0,Math.min(1,fraction))*lengths.reduce((a,b)=>a+b,0),index=0;
  while(index<lengths.length-1&&left>lengths[index])left-=lengths[index++];
  const u=Math.min(1,left/lengths[index]),a=path[Math.max(0,index-1)],b=path[index],c=path[index+1],d=path[Math.min(path.length-1,index+2)];
  const cat=(v:number)=>.5*((2*b[v])+(-a[v]+c[v])*u+(2*a[v]-5*b[v]+4*c[v]-d[v])*u*u+(-a[v]+3*b[v]-3*c[v]+d[v])*u*u*u);
  return {x:cat(0),y:cat(1),facing:c[0]<b[0]?'left' as const:'right' as const};
}
export function robotPose(fraction:number) {
  const f=((fraction%1)+1)%1;
  let action:Action,point:{x:number;y:number;facing:'left'|'right'};
  if(f<.30){action='walk';point=pointOnPath(OUTBOUND,f/.30);}
  else if(f<.49){action='scan';point={x:474,y:356,facing:'left'};}
  else if(f<.64){action='pickup';point={x:474,y:356,facing:'left'};}
  else if(f<.91){action='return';point=pointOnPath(INBOUND,(f-.64)/.27);}
  else{action='unload';point={x:327,y:454,facing:'left'};}
  return {action,...point,carrying:action==='return'||action==='unload'};
}
export function shipPose(seconds:number) {
  const angle=seconds/14*Math.PI*2-.8,rx=350,ry=175,tilt=-.18;
  const x=rx*Math.cos(angle),y=ry*Math.sin(angle);
  const dx=-rx*Math.sin(angle)*Math.cos(tilt)-ry*Math.cos(angle)*Math.sin(tilt);
  const dy=-rx*Math.sin(angle)*Math.sin(tilt)+ry*Math.cos(angle)*Math.cos(tilt);
  return {x:384+x*Math.cos(tilt)-y*Math.sin(tilt),y:365+x*Math.sin(tilt)+y*Math.cos(tilt),back:Math.sin(angle)<0,scale:.78+Math.sin(angle)*.3,angle,heading:Math.atan2(dy,dx)};
}
export const actionText = {walk:'绕过仓库，寻找奇怪的小包裹',scan:'扫描中 · 这里面好像有回声',pickup:'轻轻捡起，暂时不要拆封',return:'带着新发现，从前庭返回',unload:'归舱卸货 · 奇物正在登记'};
