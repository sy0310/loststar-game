import {securityStrengths} from './guard-tuning';
import {createGuard,restoreGuard,advanceGuard,equipGuard,guardView,type GuardItem,type GuardState} from '../prototype/guard-engine';
import type {SaveData} from './engine';
import {growthEffects} from './growth';
const devices:GuardItem[]=['beacon','gate'];
const convert=(id:GuardItem|null):GuardItem|null=>id==='tape'?'beacon':id==='bell'?'gate':id;
export function createWorld(now:number,collection:string[]=[],strengths:[number,number]=[0,0]):GuardState{return {...createGuard(now,devices,strengths),slots:['beacon','gate'],enabled:true};}
export function restoreWorld(raw:unknown,at:number,collection:string[],strengths:[number,number]){
 const s=raw as GuardState|undefined;if(!s||s.lastAt!==at||s.dayMs!==240000||s.nightMs!==60000)return createWorld(at,collection,strengths);
 try {const mapped={...s,owned:devices,slots:s.slots?.map(convert),activeNight:s.activeNight?{...s.activeNight,slots:s.activeNight.slots.map(convert)}:null,lastReport:s.lastReport?.result?{...s.lastReport,result:{...s.lastReport.result,configuration:{...s.lastReport.result.configuration,slots:s.lastReport.result.configuration.slots.map(convert)}}}:s.lastReport};
 const restored=restoreGuard(JSON.stringify(mapped),at,devices);return {...restored,enabled:true,strengths:securityStrengths(restored.slots,strengths)};}catch{return createWorld(at,collection,strengths);}
}
export function advanceWorld(s:SaveData,now:number){return advanceGuard({...s.world,owned:devices,strengths:securityStrengths(s.world.slots,growthEffects(s).guard),enabled:true},now,Math.max(0,1e12-s.world.elapsedMs));}
function dayAt(ms:number){return Math.floor(ms/300000)*240000+Math.min(ms%300000,240000);}
export const dayTimeBetween=(elapsed:number,ms:number)=>dayAt(elapsed+ms)-dayAt(elapsed);
export function wallForDayTime(elapsed:number,needed:number,limit:number){let lo=0,hi=Math.ceil(limit);while(lo<hi){const mid=Math.floor((lo+hi)/2);if(dayTimeBetween(elapsed,mid)>=needed)hi=mid;else lo=mid+1;}return lo;}
export function worldView(s:Pick<SaveData,'world'>){const v=guardView(s.world),offset=s.world.elapsedMs%300000;const period:'day'|'dusk'|'night'|'dawn'=v.phase==='day'&&s.world.settledNights>0&&offset<8000?'dawn':v.phase;return {...v,period};}
export function setWorldSlot(s:SaveData,slot:0|1,item:GuardItem|null){if(worldView(s).phase==='night'||item!==null&&!devices.includes(item))return s;const world=equipGuard({...s.world,owned:devices},slot,item);return world.slots.every((id,i)=>id===s.world.slots[i])?s:{...s,world};}
