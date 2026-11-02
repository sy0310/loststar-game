export type Action = 'walk'|'scan'|'pickup'|'return'|'unload';
export function robotPose(fraction:number) {
  const f=((fraction%1)+1)%1;
  let action:Action,progress:number;
  if(f<.28){action='walk';progress=f/.28;}
  else if(f<.5){action='scan';progress=1;}
  else if(f<.62){action='pickup';progress=1;}
  else if(f<.9){action='return';progress=1-(f-.62)/.28;}
  else{action='unload';progress=0;}
  return {action,x:255+220*progress,y:432-57*progress,carrying:action==='return'||action==='unload'};
}
export function shipPose(seconds:number) {
  const angle=seconds/10*Math.PI*2-.8;
  const x=320*Math.cos(angle),y=155*Math.sin(angle),tilt=-.19;
  return {x:384+x*Math.cos(tilt)-y*Math.sin(tilt),y:365+x*Math.sin(tilt)+y*Math.cos(tilt),back:Math.sin(angle)<0,scale:.82+Math.sin(angle)*.16,angle};
}
export const actionText = {walk:'沿球面寻找异常',scan:'扫描包裹里的回声',pickup:'发现奇物 · 正在拾取',return:'带着奇物返回收件站',unload:'卸下这次的小小发现'};
