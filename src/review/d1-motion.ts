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
  const base=robotPose(fraction);
  const emerge=smoothInstall(t/2),settle=1-smoothInstall((t-8)/2);
  // Keep a readable gap beside Kada's original (474,356) scan stance.
  const free={x:523+Math.sin(t*1.25)*10*settle,y:372+Math.sin(t*1.7)*4*settle};
  const hand={x:base.x-22,y:base.y-28};
  const collected={x:lerp(523,hand.x,base.lift),y:lerp(372,hand.y,base.lift)};
  const target=phase==='signal'||phase==='travel'||phase==='identify'?free:
    phase==='contain'?collected:phase==='done'?{x:291,y:435}:{x:base.parcel.x,y:base.parcel.y};
  const robot={...base,parcel:{...base.parcel,x:target.x,y:target.y,visible:false}};
  return {seconds:t,phase,progress:clamp(progress),fraction,robot,target,emerge,
    fold:phase==='contain'?smoothInstall((progress-.12)/.62):phase==='escort'||phase==='dock'||phase==='done'?1:0,
    gate:phase==='dock'?smoothInstall(progress/.25)*(1-smoothInstall((progress-.70)/.30)):0,
    beamVisible:(shipBack:boolean)=>!shipBack};
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
  signal:{title:'箱堆里，多了一封没有地址的影子。',detail:'原分拣站顶灯标记回波 · 失物号继续轨道搜索'},
  travel:{title:'咔哒离站，绕过仓库前往管道区。',detail:'沿原球面邮路追踪 · 飞船前轨探照跟随异常'},
  identify:{title:'核验中：漂行纸影，不是待销毁退件。',detail:'咔哒扫描折痕与收件标记 · 保持安全距离'},
  contain:{title:'折成小小一封，暂存进透明收容匣。',detail:'温和收容 · 奇物留在收藏室，不参与攻击'},
  escort:{title:'咔哒携匣返回，失物号照亮回站路线。',detail:'沿前庭连续护送 · 设备恢复低亮警戒'},
  dock:{title:'收件站开闸，接回迷路的纸影。',detail:'原仓库门完成交接 · 隔离闸门随交接关闭'},
  done:{title:'巡守完成。它终于有了临时收件人。',detail:'D1 动作样板结束 · 未扣零件、未改收藏与原存档'},
};
