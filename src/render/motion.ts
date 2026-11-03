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
function shipOrbit(seconds:number) {
  const angle=seconds/14*Math.PI*2-.8,rx=350,ry=175,tilt=-.18;
  const x=rx*Math.cos(angle),y=ry*Math.sin(angle);
  const dx=-rx*Math.sin(angle)*Math.cos(tilt)-ry*Math.cos(angle)*Math.sin(tilt);
  const dy=-rx*Math.sin(angle)*Math.sin(tilt)+ry*Math.cos(angle)*Math.cos(tilt);
  const heading=Math.atan2(dy,dx),direction=(heading/(Math.PI/2)+4)%4;
  const view=['starboard','bow','port','stern'][Math.round(direction)%4];
  return {x:384+x*Math.cos(tilt)-y*Math.sin(tilt),y:365+x*Math.sin(tilt)+y*Math.cos(tilt),back:Math.sin(angle)<0,scale:.78+Math.sin(angle)*.3,angle,heading,view,direction,bank:Math.sin(angle*2)*.12,speed:Math.hypot(dx,dy)*Math.PI*2/14};
}
// Calibrated against the 256px runtime cells, NOT the atlas's transparent center.
// Nose-to-nozzle axes include each drawing's 3/4 perspective.
export const shipViews=[
  {cell:0,anchor:{x:9,y:139},nose:{x:246,y:169}},
  {cell:1,anchor:{x:128,y:66},nose:{x:128,y:224}},
  {cell:2,anchor:{x:247,y:141},nose:{x:10,y:181}},
  {cell:3,anchor:{x:132,y:223},nose:{x:128,y:31}},
];
function shipBody(seconds:number){
  const p=shipOrbit(seconds),width=112*p.scale,center={x:p.x,y:p.y-width*.28};
  const first=Math.floor(p.direction),blend=Math.max(0,Math.min(1,(p.direction-first-.47)/.06));
  const candidates=[{view:shipViews[first%4],alpha:1-blend},{view:shipViews[(first+1)%4],alpha:blend}].filter(layer=>layer.alpha>0);
  const layers=candidates.map(({view,alpha})=>{
    const nativeHeading=Math.atan2(view.nose.y-view.anchor.y,view.nose.x-view.anchor.x),rotation=p.heading-nativeHeading+p.bank;
    const x=(view.anchor.x-128)*width/256,y=(view.anchor.y-128)*width/256;
    return {...view,alpha,nativeHeading,rotation,offset:{x:x*Math.cos(rotation)-y*Math.sin(rotation),y:x*Math.sin(rotation)+y*Math.cos(rotation)}};
  });
  const nozzle={x:center.x+layers.reduce((s,l)=>s+l.offset.x*l.alpha,0),y:center.y+layers.reduce((s,l)=>s+l.offset.y*l.alpha,0)};
  return {...p,width,nozzle,exhaustHeading:p.heading+p.bank+Math.PI,
    // Register both crossfaded sprites at the same engine mouth. The flame cannot detach.
    layers:layers.map(layer=>({...layer,x:nozzle.x-layer.offset.x,y:nozzle.y-layer.offset.y}))};
}
export function shipPose(seconds:number){
  const p=shipBody(seconds);
  const trail=Array.from({length:8},(_,i)=>{
    const age=.035+i*.042,old=shipBody(seconds-age),drift=age*(22+p.speed*.12),side=Math.sin(i*2.7+seconds*3)*age*7;
    return {x:old.nozzle.x+Math.cos(old.exhaustHeading)*drift-Math.sin(old.exhaustHeading)*side,
      y:old.nozzle.y+Math.sin(old.exhaustHeading)*drift+Math.cos(old.exhaustHeading)*side,
      alpha:(1-age/.4)**2,size:i<3?3:2,back:p.back};
  });
  return {...p,trail,flameFrame:Math.floor(seconds*16)%4,flameLength:(10+p.speed*.07)*p.scale};
}
export const actionText = {walk:'绕过仓库，寻找奇怪的小包裹',scan:'扫描中 · 这里面好像有回声',pickup:'轻轻捡起，暂时不要拆封',return:'带着新发现，从前庭返回',unload:'归舱卸货 · 奇物正在登记'};
