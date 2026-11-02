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
  const smooth=(u:number)=>{const t=Math.max(0,Math.min(1,u));return t*t*(3-2*t);};
  const lift=smooth((f-.52)/.1),pass=smooth((f-.91)/.025),release=smooth((f-.935)/.04);
  const hand={x:point.x-22,y:point.y-28};
  const extended={x:293,y:419};
  const parcel=action==='walk'||action==='scan'?{x:465,y:357,held:false,delivered:false,visible:action==='scan'}:
    action==='pickup'?{x:465+(hand.x-465)*lift,y:357+(hand.y-357)*lift,held:lift>.95,delivered:false,visible:true}:
    action==='return'?{...hand,held:true,delivered:false,visible:true}:
    {x:f<.935?hand.x+(extended.x-hand.x)*pass:extended.x+(291-extended.x)*release,
      y:f<.935?hand.y+(extended.y-hand.y)*pass:extended.y+(435-extended.y)*release,held:release<1,delivered:release===1,visible:f<.995};
  return {action,...point,carrying:action==='return'||action==='unload',parcel,lift,release};
}
export function shipPose(seconds:number) {
  const angle=seconds/14*Math.PI*2-.8,rx=350,ry=175,tilt=-.18;
  const x=rx*Math.cos(angle),y=ry*Math.sin(angle);
  const dx=-rx*Math.sin(angle)*Math.cos(tilt)-ry*Math.cos(angle)*Math.sin(tilt);
  const dy=-rx*Math.sin(angle)*Math.sin(tilt)+ry*Math.cos(angle)*Math.cos(tilt);
  const heading=Math.atan2(dy,dx),direction=(heading/(Math.PI/2)+4)%4;
  const view=['starboard','bow','port','stern'][Math.round(direction)%4];
  return {x:384+x*Math.cos(tilt)-y*Math.sin(tilt),y:365+x*Math.sin(tilt)+y*Math.cos(tilt),back:Math.sin(angle)<0,scale:.78+Math.sin(angle)*.3,angle,heading,view,direction,bank:Math.sin(angle*2)*.12};
}
export const actionText = {walk:'绕过仓库，寻找奇怪的小包裹',scan:'扫描中 · 这里面好像有回声',pickup:'轻轻捡起，暂时不要拆封',return:'带着新发现，从前庭返回',unload:'归舱卸货 · 奇物正在登记'};
