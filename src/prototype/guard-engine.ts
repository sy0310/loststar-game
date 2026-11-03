import {nightAt,nightResult,type NightResult} from './night-model';
export const GUARD_KEY='loststar.prototype.guard.v1';
export const guardItems=['tape','bell'] as const;
export type GuardItem=typeof guardItems[number];
export type GuardSlots=[GuardItem|null,GuardItem|null];
export interface GuardState {
  version:1;enabled:boolean;lastAt:number;elapsedMs:number;dayMs:number;nightMs:number;
  owned:GuardItem[];slots:GuardSlots;strengths:[number,number];activeNight:{index:number;slots:GuardSlots;strengths?:[number,number]}|null;
  settledNights:number;reports:{nights:number;clues:number;intercepted:number;arrived:number;verifiedNights:number};
  lastReport:{number:number;clues:number;intercepted:number;arrived?:number;summary:string;result?:NightResult}|null;
}
export const guardEvent={id:'keep-the-door',name:'请替宇宙看一会儿门',line:'三份没有收件人的影子，在夜色里等一枚温柔的退回章。'};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const eligible=(owned:string[])=>guardItems.filter(id=>owned.includes(id));
export function createGuard(now:number,owned:string[],strengths:[number,number]=[0,0]):GuardState {
  return {version:1,enabled:false,lastAt:now,elapsedMs:0,dayMs:240000,nightMs:60000,owned:eligible(owned),slots:[null,null],strengths:[...strengths],activeNight:null,settledNights:0,reports:{nights:0,clues:0,intercepted:0,arrived:0,verifiedNights:0},lastReport:null};
}
export function equipGuard(s:GuardState,slot:0|1,item:GuardItem|null):GuardState {
  if((slot!==0&&slot!==1)||(item!==null&&!s.owned.includes(item)))return s;
  const next=structuredClone(s);
  if(item!==null){const other=slot===0?1:0;if(next.slots[other]===item)next.slots[other]=null;}
  next.slots[slot]=item;return next;
}
export function advanceGuard(s:GuardState,now:number,maxMs=43200000):GuardState {
  if(!Number.isFinite(now)||now<=s.lastAt)return s;
  const next=structuredClone(s),cycle=s.dayMs+s.nightMs;
  next.lastAt=now;if(!s.enabled)return next;
  next.elapsedMs+=Math.min(now-s.lastAt,maxMs);
  const completed=Math.floor(next.elapsedMs/cycle);
  function settle(config:{slots:GuardSlots;strengths:[number,number]},count:number,number:number){if(count<=0)return;const result=nightResult(config);next.reports.nights+=count;next.reports.verifiedNights+=count;next.reports.clues+=result.clues*count;next.reports.intercepted+=result.intercepted*count;next.reports.arrived+=result.arrived*count;next.lastReport={number,clues:result.clues,intercepted:result.intercepted,arrived:result.arrived,summary:`${result.intercepted} 位在抵站前完成核对，${result.arrived} 位抵站后由咔哒安全送回。收藏完好，留下${result.quality}。`,result};}
  const first=s.settledNights+1,hasSnapshot=s.activeNight?.index===first&&completed>=first;
  if(hasSnapshot)settle({slots:s.activeNight!.slots,strengths:s.activeNight!.strengths??s.strengths},1,first);
  settle({slots:s.slots,strengths:s.strengths},completed-s.settledNights-(hasSnapshot?1:0),completed);
  next.settledNights=completed;
  const phase=next.elapsedMs%cycle,index=completed+1;
  next.activeNight=phase>=s.dayMs?(s.activeNight?.index===index?structuredClone(s.activeNight):{index,slots:[...s.slots],strengths:[...s.strengths]}):null;
  return next;
}
export function setGuardEnabled(s:GuardState,enabled:boolean,now:number):GuardState {
  const next=advanceGuard(s,now);return {...next,enabled,lastAt:Math.max(now,next.lastAt)};
}
export function previewNight(s:GuardState,now:number):GuardState {
  const next=structuredClone(s);next.elapsedMs=next.settledNights*(s.dayMs+s.nightMs)+s.dayMs;
  next.lastAt=now;next.enabled=true;next.activeNight={index:next.settledNights+1,slots:[...next.slots],strengths:[...next.strengths]};return next;
}
export function guardView(s:GuardState){
  const cycle=s.dayMs+s.nightMs,phaseMs=s.enabled?s.elapsedMs%cycle:0,duskMs=Math.min(12000,s.dayMs/4);
  const phase:'day'|'dusk'|'night'=phaseMs>=s.dayMs?'night':phaseMs>=s.dayMs-duskMs?'dusk':'day';
  const nightBase=(phaseMs-s.dayMs)/s.nightMs*60;
  const light=phase==='night'?Math.min(.65+clamp(nightBase/3)*.35,clamp((60-nightBase)/4)):phase==='dusk'?clamp((phaseMs-s.dayMs+duskMs)/duskMs)*.65:0;
  const activeSlots=phase==='night'?(s.activeNight?.slots??s.slots):s.slots;
  const strengths=phase==='night'?(s.activeNight?.strengths??s.strengths):s.strengths;
  const tape=activeSlots.includes('tape'),bell=activeSlots.includes('bell');
  const timeline=nightAt({slots:activeSlots,strengths},Math.max(0,nightBase));
  const intruders=phase==='night'?timeline.actors:[];
  return {phase,light,nightBase,nightNumber:Math.floor(s.elapsedMs/cycle)+1,untilNextMs:phase==='night'?cycle-phaseMs:s.dayMs-phaseMs,activeSlots,strengths,tape,bell,intruders,nightStatus:timeline,event:phase==='night'?guardEvent:null};
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
    if(s.lastReport!==null&&(!s.lastReport||s.lastReport.number!==s.settledNights||!finite(s.lastReport.clues,4)||!finite(s.lastReport.intercepted,3)||typeof s.lastReport.summary!=='string'||s.lastReport.summary.length>120))return createGuard(now,owned);
    const strengths=Array.isArray(s.strengths)&&s.strengths.length===2&&s.strengths.every((v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=3)?s.strengths:[0,0];
    if(s.activeNight?.strengths&&!s.activeNight.strengths.every((v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=3))return createGuard(now,owned);
    const arrived=s.reports.arrived??0,verifiedNights=s.reports.verifiedNights??0;
    if(!finite(arrived,1e9)||!Number.isInteger(verifiedNights)||verifiedNights<0||verifiedNights>s.reports.nights)return createGuard(now,owned);
    if(s.lastReport?.result){const config=s.lastReport.result.configuration;if(!config||!validSlots(config.slots,items)||!Array.isArray(config.strengths)||config.strengths.length!==2||!config.strengths.every((v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=3))return createGuard(now,owned);const result=nightResult(config);s.lastReport={...s.lastReport,result,clues:result.clues,intercepted:result.intercepted,arrived:result.arrived};}
    return advanceGuard({...s,owned:items,strengths,reports:{...s.reports,arrived,verifiedNights}},now);
  }catch{return createGuard(now,owned);}
}
