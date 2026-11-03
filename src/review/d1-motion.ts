import {robotPose} from '../render/motion';
import {exhibits,itemCenter} from '../render/museum-layout';

const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export const smoothInstall=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
const lerp=(a:number,b:number,u:number)=>a+(b-a)*u;
export type NightPhase='signal'|'travel'|'identify'|'contain'|'escort'|'dock'|'done';
export const nightCamera={scale:1.025,x:384,y:402,offsetX:0,offsetY:-28};
/** Includes ExpeditionScene's existing 32px world registration, before the camera. */
export function projectNight(point:{x:number;y:number}){
  return {x:32+nightCamera.x+(point.x-nightCamera.x)*nightCamera.scale+nightCamera.offsetX,
    y:nightCamera.y+(point.y-nightCamera.y)*nightCamera.scale+nightCamera.offsetY};
}

// Measured on robot-empty-v3, frame 5 (open pickup) and frame 6 (carry).
// Actor registration is (-.54w,-.97w), not the transparent cell centre.
export const nightRobotRegistration={
  width:144,
  sourceCell:160,
  pickupHands:[{x:40,y:129},{x:102,y:129}],
  carryHands:[{x:47,y:104},{x:73,y:110}],
  unloadHands:[{x:32,y:99},{x:57,y:106}],
  carryGrip:{x:-23.76,y:-43.38},
};
// Original 256×235 warehouse source, drawn at (230,261) with scale 170/256.
// The old (291,435) loading lip sits below this actual facade opening.
export const nightDoor={
  opening:[{x:258.55,y:365.22},{x:307.03,y:371.20},{x:307.03,y:404.39},{x:258.55,y:398.41}],
  light:{x:283,y:388},
};

/** Read-only storyboard time. It never advances a save, money or the night model. */
export function nightStage(seconds:number){
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  let phase:NightPhase,fraction:number,progress:number;
  if(t<4){phase='signal';fraction=.999999;progress=t/4;}
  else if(t<10){phase='travel';progress=(t-4)/6;fraction=progress*.30;}
  else if(t<15){phase='identify';progress=(t-10)/5;fraction=.30+progress*.19;}
  else if(t<20){phase='contain';progress=(t-15)/5;fraction=.49+progress*.15;}
  else if(t<26){phase='escort';progress=(t-20)/6;fraction=.64+progress*.27;}
  else if(t<29){phase='dock';progress=(t-26)/3;fraction=.91+progress*.09;}
  else{phase='done';fraction=.999999;progress=1;}
  // fraction=1 belongs to the next ordinary exploration cycle. Keep the dock's
  // completed pose instead; replay is explicit and cannot jump halfway round.
  fraction=Math.min(.999999,fraction);
  const pathPose=robotPose(fraction);
  const approach=smoothInstall((t-26)/1.1)*(1-smoothInstall((t-28.2)/.8));
  const base={...pathPose,x:pathPose.x-11*approach,y:pathPose.y-25*approach};
  const emerge=smoothInstall(t/2),settle=1-smoothInstall((t-8)/2);
  // Keep a readable gap beside Kada's original (474,356) scan stance.
  const free={x:425+Math.sin(t*1.25)*10*settle,y:372+Math.sin(t*1.7)*4*settle};
  const reach=smoothInstall((t-15)/.7);
  const paperFold=smoothInstall((t-15.8)/1.5);
  const intake=smoothInstall((t-16.6)/1.4);
  const raise=smoothInstall((t-18.5)/.9);
  const latch=smoothInstall((t-18)/.7);
  const open=smoothInstall((t-15.25)/.55)*(1-latch);
  const load=Math.sin(clamp((t-19.2)/.7)*Math.PI)*2.4;
  const walkingBob=phase==='travel'||phase==='escort'?Math.sin(t*12)*1.15:0;
  const bob=walkingBob+load;
  const grip=nightRobotRegistration.carryGrip;
  const holster={x:base.x+22,y:base.y-48+walkingBob};
  const lifted={x:base.x-13.86,y:base.y-37.58};
  const held={x:base.x+grip.x,y:base.y+grip.y+bob};
  let cargoGrip={
    x:lerp(lerp(holster.x,lifted.x,reach)+Math.sin(reach*Math.PI)*20,held.x,raise),
    y:lerp(lerp(holster.y,lifted.y,reach),held.y,raise),
  };
  const receiving=smoothInstall((t-27.15)/1.15);
  const handoff=smoothInstall((t-26)/1.15);
  const sideTurn=smoothInstall((t-26.25)/.85);
  const tilt=.17*handoff;
  const unloadNative={x:-37.71,y:-47.43};
  const unloadOffset={x:unloadNative.x*Math.cos(tilt)-unloadNative.y*Math.sin(tilt),
    y:unloadNative.x*Math.sin(tilt)+unloadNative.y*Math.cos(tilt)};
  if(t>=26){
    cargoGrip={
      x:base.x+lerp(grip.x,unloadOffset.x,handoff),
      y:base.y+lerp(grip.y,unloadOffset.y,handoff),
    };
    if(t>=27.15)cargoGrip={x:316+unloadOffset.x,y:429+unloadOffset.y-receiving*44};
  }
  const paperFreePivot={x:free.x,y:free.y-18.55-(1-intake)*(4+Math.sin(t*2)*1.1)};
  const paperInside={x:cargoGrip.x,y:cargoGrip.y+25.5};
  const paperPivot={x:lerp(paperFreePivot.x,paperInside.x,intake),y:lerp(paperFreePivot.y,paperInside.y,intake)};
  const paperGround={x:lerp(free.x,cargoGrip.x,intake),y:lerp(372,base.y+15,intake)};
  const paperBottom=paperPivot.y+(1-paperFold*.85)*18.55;
  const paperHeight=Math.max(0,paperGround.y-paperBottom);
  let target={x:lerp(free.x,cargoGrip.x,intake),y:lerp(free.y,cargoGrip.y+20,intake)};
  if(t>=26)target={x:lerp(base.x+grip.x,nightDoor.light.x,handoff),y:lerp(base.y+grip.y+20,nightDoor.light.y,handoff)};
  const robot={...base,parcel:{...base.parcel,x:target.x,y:target.y,visible:false}};
  return {
    seconds:t,phase,progress:clamp(progress),fraction,robot,target,emerge,
    fold:paperFold,
    handling:{reach,raise,latch,handoff},
    rig:{bob,load,tilt:tilt*(1-smoothInstall((t-27.8)/.8)),unload:handoff*(1-smoothInstall((t-27.8)/.8))},
    cargo:{grip:cargoGrip,open,latched:latch===1,receiving,yaw:1-sideTurn*.22,pitch:1-sideTurn*.08,angle:tilt,handleDown:sideTurn,visible:t<29},
    paper:{pivot:paperPivot,freePivot:paperFreePivot,ground:paperGround,height:paperHeight,fold:paperFold,intake,sourceScale:.35,alpha:emerge},
    gate:smoothInstall((t-26)/.4)*(1-smoothInstall((t-28.25)/.7)),
    beamVisible:(shipBack:boolean)=>!shipBack,
  };
}
export type NightStage=ReturnType<typeof nightStage>;

/** Same receipt specimen / shelf registration at every tier. Only the structure grows. */
export function receiptGeometry(level:number){
  const tier=Math.max(0,Math.min(3,Math.floor(level))),e=exhibits[0];
  return {anchor:{x:e.x,y:e.y},item:itemCenter(e),itemSize:e.item.size*e.scale,
    baseWidth:[98,124,124,136][tier],frameHeight:[172,172,172,218][tier]};
}
export function receiptStage(seconds:number){
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  const level=t<2?0:t<5?1:t<8?2:3;
  const start=[0,2,5,8][level];
  return {level,install:smoothInstall(t-start),seconds:t,done:t>=11.8};
}

export const nightCaption:Record<NightPhase,{title:string;detail:string}>={
  signal:{title:'管道旁，多了一封没有地址的影子。',detail:'原分拣站顶灯标记回波 · 失物号继续轨道搜索'},
  travel:{title:'咔哒离站，绕过仓库前往管道区。',detail:'沿原球面邮路追踪 · 飞船前轨探照跟随异常'},
  identify:{title:'核验中：漂行纸影，不是待销毁退件。',detail:'咔哒扫描折痕与收件标记 · 保持安全距离'},
  contain:{title:'折成小小一封，暂存进透明收容匣。',detail:'温和收容 · 奇物留在收藏室，不参与攻击'},
  escort:{title:'咔哒携匣返回，失物号照亮回站路线。',detail:'沿前庭连续护送 · 设备恢复低亮警戒'},
  dock:{title:'收件站开闸，接回迷路的纸影。',detail:'原仓库门完成交接 · 隔离闸门随交接关闭'},
  done:{title:'巡守完成。它终于有了临时收件人。',detail:'D1 动作样板结束 · 未扣零件、未改收藏与原存档'},
};
