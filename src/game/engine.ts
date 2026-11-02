import { discoveries, planets, planetById } from '../content/catalog';

export type UpgradeId = 'radar' | 'scanner' | 'recycler' | 'cargo';
export interface ReturnCargo { id:string; seconds:number; resources:number; discoveries:string[]; }
export interface SaveData {
  version:1; lastAt:number; resources:number; cycles:number; cycleMs:number;
  radarMs:number; reveal:string|null; planets:string[]; collection:string[];
  upgrades:Record<UpgradeId,number>; pendingReturn:ReturnCargo|null;
}
export const SAVE_KEY = 'loststar.save.v1';
export const upgradeIds: UpgradeId[] = ['radar','scanner','recycler','cargo'];
export const MAX_LEVEL = 5;
export function newGame(now=Date.now()):SaveData {
  return {version:1,lastAt:now,resources:120,cycles:0,cycleMs:0,radarMs:0,reveal:null,planets:['parcel'],collection:[],upgrades:{radar:0,scanner:0,recycler:0,cargo:0},pendingReturn:null};
}
// Tuning is deliberately quick for a reviewable vertical slice; not final economy balance.
export function tuning(s:SaveData) {
  return { radar:1+s.upgrades.radar*.25, scanner:12000/(1+s.upgrades.scanner*.22), recycler:8+s.upgrades.recycler*3, cargo:7200+s.upgrades.cargo*3600 };
}
export function cost(s:SaveData,id:UpgradeId) { return Math.round(45*1.7**s.upgrades[id]); }
export function upgrade(s:SaveData,id:UpgradeId):SaveData {
  if (s.upgrades[id]>=MAX_LEVEL || s.resources<cost(s,id)) return s;
  const next=structuredClone(s); next.resources-=cost(s,id); next.upgrades[id]++;
  // Preserve fraction through a speed upgrade instead of awarding a free cycle.
  next.cycleMs=s.cycleMs/tuning(s).scanner*tuning(next).scanner;
  return next;
}
export function advance(s:SaveData,now:number,offline=false):SaveData {
  if (!Number.isFinite(now) || now<=s.lastAt) return s;
  const next=structuredClone(s), values=tuning(s);
  const ms=Math.min(now-s.lastAt,values.cargo*1000);
  next.lastAt=now;
  const target=planets.find(p=>!s.planets.includes(p.id));
  if (target) {
    next.radarMs=Math.min(120000,s.radarMs+ms*values.radar);
    if (next.radarMs>=120000) {next.planets.push(target.id);next.reveal=target.id;}
  }
  const cycleTotal=s.cycleMs+ms;
  const earned=Math.floor(cycleTotal/values.scanner);
  next.cycles+=earned; next.cycleMs=cycleTotal%values.scanner;
  const known=new Set([...s.collection,...(s.pendingReturn?.discoveries??[])]);
  const found=discoveries.filter(d=>d.milestone<=next.cycles && !known.has(d.id)).map(d=>d.id);
  const resources=earned*values.recycler;
  if (offline && ms>=30000) {
    const old=s.pendingReturn;
    next.pendingReturn={ id:old?.id??`return-${s.lastAt}`, seconds:(old?.seconds??0)+Math.floor(ms/1000), resources:(old?.resources??0)+resources, discoveries:[...(old?.discoveries??[]),...found] };
  } else {
    next.resources+=resources; next.collection.push(...found);
  }
  return next;
}
export function claimReturn(s:SaveData):SaveData {
  if (!s.pendingReturn) return s;
  const next=structuredClone(s), cargo=s.pendingReturn;
  next.resources+=cargo.resources;
  next.collection=[...new Set([...next.collection,...cargo.discoveries])];
  next.pendingReturn=null;
  return next;
}
export function dismissReveal(s:SaveData):SaveData { return {...s,reveal:null,radarMs:0}; }
export function publicRadar(s:SaveData) {
  if (s.reveal) return {stage:'revealed' as const,progress:100,planet:planetById(s.reveal)!};
  const stage:'searching'|'anomaly'|'locking'=s.radarMs<60000?'searching':s.radarMs<90000?'anomaly':'locking';
  return {stage,progress:Math.floor(s.radarMs/1200)};
}
const finite=(x:unknown,max=1e12):x is number => typeof x==='number' && Number.isFinite(x) && x>=0 && x<=max;
const ids=(x:unknown,valid:string[]):x is string[] => Array.isArray(x) && x.every(id=>typeof id==='string' && valid.includes(id)) && new Set(x).size===x.length;
export function restore(raw:string|null,now=Date.now()):SaveData {
  if (!raw) return newGame(now);
  try {
    const s=JSON.parse(raw) as SaveData;
    if(s.version!==1 || !finite(s.lastAt,1e15) || !finite(s.resources,1e9) || !finite(s.cycles,1e9) || !finite(s.cycleMs,12000) || !finite(s.radarMs,120000) ||
      !ids(s.planets,planets.map(p=>p.id)) || !s.planets.includes('parcel') || !ids(s.collection,discoveries.map(d=>d.id)) ||
      !s.upgrades || !upgradeIds.every(id=>finite(s.upgrades[id],5) && Number.isInteger(s.upgrades[id])) ||
      (s.reveal!==null && !s.planets.includes(s.reveal))) return newGame(now);
    if(s.pendingReturn && (!finite(s.pendingReturn.resources,1e9) || !finite(s.pendingReturn.seconds,1e9) || typeof s.pendingReturn.id!=='string' || !ids(s.pendingReturn.discoveries,discoveries.map(d=>d.id)))) return newGame(now);
    return advance(s,now,now-s.lastAt>=30000);
  } catch { return newGame(now); }
}
