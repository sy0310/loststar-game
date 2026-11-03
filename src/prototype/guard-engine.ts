export const GUARD_KEY='loststar.prototype.guard.v1';
export const guardItems=['tape','bell'] as const;
export type GuardItem=typeof guardItems[number];
export type GuardSlots=[GuardItem|null,GuardItem|null];
export interface GuardState {
  version:1;enabled:boolean;lastAt:number;elapsedMs:number;dayMs:number;nightMs:number;
  owned:GuardItem[];slots:GuardSlots;activeNight:{index:number;slots:GuardSlots}|null;
  settledNights:number;reports:{nights:number;clues:number;intercepted:number};
  lastReport:{number:number;clues:number;intercepted:number;summary:string}|null;
}
export const guardEvent={id:'keep-the-door',name:'请替宇宙看一会儿门',line:'三份没有收件人的影子，在夜色里等一枚温柔的退回章。'};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const eligible=(owned:string[])=>guardItems.filter(id=>owned.includes(id));
const count=(slots:GuardSlots)=>new Set(slots.filter(Boolean)).size;
export function createGuard(now:number,owned:string[]):GuardState {
  return {version:1,enabled:false,lastAt:now,elapsedMs:0,dayMs:240000,nightMs:60000,owned:eligible(owned),slots:[null,null],activeNight:null,settledNights:0,reports:{nights:0,clues:0,intercepted:0},lastReport:null};
}
export function equipGuard(s:GuardState,slot:0|1,item:GuardItem|null):GuardState {
  if((slot!==0&&slot!==1)||(item!==null&&!s.owned.includes(item)))return s;
  const next=structuredClone(s);
  if(item!==null){const other=slot===0?1:0;if(next.slots[other]===item)next.slots[other]=null;}
  next.slots[slot]=item;return next;
}
export function advanceGuard(s:GuardState,now:number):GuardState {
  if(!Number.isFinite(now)||now<=s.lastAt)return s;
  const next=structuredClone(s),cycle=s.dayMs+s.nightMs;
  next.lastAt=now;if(!s.enabled)return next;
  next.elapsedMs+=Math.min(now-s.lastAt,43200000);
  const completed=Math.floor(next.elapsedMs/cycle);
  for(let index=s.settledNights+1;index<=completed;index++){
    const slots=s.activeNight?.index===index?s.activeNight.slots:s.slots,n=count(slots),clues=1+n,intercepted=n?3:0;
    next.reports.nights++;next.reports.clues+=clues;next.reports.intercepted+=intercepted;
    next.lastReport={number:index,clues,intercepted,summary:n===2?'胶带留下脚印，签收铃替夜色点了头。':n===1?'一件奇物和两位老搭档，认真照看了收件站。':'咔哒与失物号把影子礼貌地送回原路。'};
  }
  next.settledNights=completed;
  const phase=next.elapsedMs%cycle,index=completed+1;
  next.activeNight=phase>=s.dayMs?(s.activeNight?.index===index?structuredClone(s.activeNight):{index,slots:[...s.slots]}):null;
  return next;
}
export function setGuardEnabled(s:GuardState,enabled:boolean,now:number):GuardState {
  const next=advanceGuard(s,now);return {...next,enabled,lastAt:Math.max(now,next.lastAt)};
}
export function previewNight(s:GuardState,now:number):GuardState {
  const next=structuredClone(s);next.elapsedMs=next.settledNights*(s.dayMs+s.nightMs)+s.dayMs;
  next.lastAt=now;next.enabled=true;next.activeNight={index:next.settledNights+1,slots:[...next.slots]};return next;
}
export function guardView(s:GuardState){
  const cycle=s.dayMs+s.nightMs,phaseMs=s.enabled?s.elapsedMs%cycle:0,duskMs=Math.min(12000,s.dayMs/4);
  const phase:'day'|'dusk'|'night'=phaseMs>=s.dayMs?'night':phaseMs>=s.dayMs-duskMs?'dusk':'day';
  const nightBase=(phaseMs-s.dayMs)/s.nightMs*60;
  const light=phase==='night'?Math.min(.65+clamp(nightBase/3)*.35,clamp((60-nightBase)/4)):phase==='dusk'?clamp((phaseMs-s.dayMs+duskMs)/duskMs)*.65:0;
  const activeSlots=phase==='night'?(s.activeNight?.slots??s.slots):s.slots;
  const tape=activeSlots.includes('tape'),bell=activeSlots.includes('bell');
  const sealAt=count(activeSlots)===2?11:count(activeSlots)===1?14:17;
  const accumulatedStun=(t:number)=>Math.floor(t/6)*1.1+Math.min(t%6,1.1);
  const intruders:Array<{id:number;progress:number;stunned:boolean;slowed:boolean;sealing:boolean;alpha:number}>=[];
  if(phase==='night')for(let i=0;i<3;i++){
    const spawn=4.2+i*18,age=nightBase-spawn;if(age<0||age>sealAt+1.2)continue;
    const stun=bell?accumulatedStun(nightBase)-accumulatedStun(spawn):0;
    const travel=Math.max(0,age-stun)/12*(tape?.56:1),returning=clamp((age-sealAt)/1.2);
    intruders.push({id:i,progress:Math.min(1,travel)*(1-returning),stunned:bell&&nightBase%6<1.1,slowed:tape,sealing:age>sealAt-.4,alpha:1-returning});
  }
  return {phase,light,nightBase,nightNumber:Math.floor(s.elapsedMs/cycle)+1,untilNextMs:phase==='night'?cycle-phaseMs:s.dayMs-phaseMs,activeSlots,tape,bell,intruders,event:phase==='night'?guardEvent:null};
}
const finite=(x:unknown,max=1e15):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max;
function validSlots(x:unknown,owned:GuardItem[]):x is GuardSlots {
  if(!Array.isArray(x)||x.length!==2||!x.every(v=>v===null||owned.includes(v)))return false;
  return x[0]===null||x[0]!==x[1];
}
export function restoreGuard(raw:string|null,now:number,owned:string[]):GuardState {
  if(!raw)return createGuard(now,owned);
  try {
    const s=JSON.parse(raw),items=eligible(owned);
    if(s.version!==1||typeof s.enabled!=='boolean'||!finite(s.lastAt)||!finite(s.elapsedMs,1e12)||!finite(s.dayMs,3600000)||s.dayMs<10000||!finite(s.nightMs,300000)||s.nightMs<10000||
      !validSlots(s.slots,items)||!Array.isArray(s.owned)||s.owned.length!==items.length||!s.owned.every((id:string)=>items.includes(id as GuardItem))||
      !Number.isInteger(s.settledNights)||s.settledNights<0||s.settledNights!==Math.floor(s.elapsedMs/(s.dayMs+s.nightMs))||
      !s.reports||s.reports.nights!==s.settledNights||!finite(s.reports.clues,1e9)||!finite(s.reports.intercepted,1e9))return createGuard(now,owned);
    if(s.activeNight!==null&&(!s.activeNight||s.activeNight.index!==s.settledNights+1||!validSlots(s.activeNight.slots,items)))return createGuard(now,owned);
    if(s.lastReport!==null&&(!s.lastReport||s.lastReport.number!==s.settledNights||!finite(s.lastReport.clues,3)||!finite(s.lastReport.intercepted,3)||typeof s.lastReport.summary!=='string'||s.lastReport.summary.length>120))return createGuard(now,owned);
    return advanceGuard({...s,owned:items},now);
  }catch{return createGuard(now,owned);}
}
