import {tuning,SURVEY_DURATION,type SaveData} from './engine';
import {advanceWorld,dayTimeBetween} from './world';
import {nightResult,type NightResult} from '../prototype/night-model';
import {discoveries,planets} from '../content/catalog';
import {parcelSignals} from '../content/parcel';
import {parcelJournal,journalShift} from '../content/parcel-journal';
import {stepStarChart} from './star-chart';
import {growthEffects,growthLevel} from './growth';
export interface StationReceipt {number:number;damage:number;required:number;repaired:number;spent:number;unrepaired:number;intercepted:number;arrived:number;balance:number;}
export interface StationState {version:1;integrity:number;autoRepair:boolean;autoBudgetTenths:number;grossIncome:number;repairSpent:number;repairPoints:number;repairCount:number;damageTotal:number;protectedNights:number;migrated:boolean;currentDamage:{number:number;points:number};lastHitAt:number|null;lastHitPoints:number;lastRepair:{at:number;from:number;to:number;points:number;cost:number;automatic:boolean}|null;lastNight:StationReceipt|null;}
export type StudyKind='artifact'|'creature'|'event';
export const planCatalog=[{id:'field',name:'定向现场调查',cost:90,duration:300000,boost:.10,needsCurio:false},{id:'study',name:'奇物启发科研',cost:1200,duration:900000,boost:.25,needsCurio:true},{id:'deep',name:'深层联合勘察',cost:4800,duration:1800000,boost:.40,needsCurio:true}] as const;
export interface ResearchState {started:number;completed:number;spent:number;active:{id:string;plan:string;kind:StudyKind;source:string|null;end:number}|null;notes:{id:number;kind:StudyKind;source:string|null;title:string;text:string;at:number}[];}
export const createStation=(migrated=false):StationState=>({version:1,integrity:100,autoRepair:true,autoBudgetTenths:0,grossIncome:0,repairSpent:0,repairPoints:0,repairCount:0,damageTotal:0,protectedNights:0,migrated,currentDamage:{number:0,points:0},lastHitAt:null,lastHitPoints:0,lastRepair:null,lastNight:null});
export const createResearch=():ResearchState=>({started:0,completed:0,spent:0,active:null,notes:[]});
export const repairPrice=(s:Pick<SaveData,'growth'>)=>3-growthLevel(s,'repair-bay');
export const explorationFactor=(s:Pick<SaveData,'station'>)=>.8+s.station.integrity*.002;
export function planBoost(s:Pick<SaveData,'research'>){return planCatalog.find(p=>p.id===s.research.active?.plan)?.boost??0;}
const day=(s:SaveData)=>s.world.elapsedMs%300000<240000;
function repair(s:SaveData,automatic:boolean,at:number){
 if(!day(s)||s.station.integrity>=100)return false;const price=repairPrice(s),points=Math.min(100-s.station.integrity,Math.floor(s.resources/price),automatic?Math.floor(s.station.autoBudgetTenths/(price*10)):100);if(points<=0)return false;
 const before=s.station.integrity,cost=points*price;s.resources-=cost;s.station.integrity+=points;s.station.repairSpent+=cost;s.station.repairPoints+=points;s.station.repairCount++;if(automatic)s.station.autoBudgetTenths-=cost*10;
 s.station.lastRepair={at,from:before,to:s.station.integrity,points,cost,automatic};const r=s.station.lastNight;if(r&&s.world.elapsedMs<r.number*300000+240000){r.repaired+=points;r.spent+=cost;r.unrepaired=100-s.station.integrity;r.balance=s.resources;}return true;
}
export function repairStation(s:SaveData,expected=s.station.integrity){if(expected!==s.station.integrity||!day(s)||s.station.integrity>=100||s.resources<repairPrice(s))return s;const next=structuredClone(s);repair(next,false,s.lastAt);return next;}
export function setAutoRepair(s:SaveData,enabled:boolean){if(s.station.autoRepair===enabled)return s;const next=structuredClone(s);next.station.autoRepair=enabled;if(enabled)repair(next,true,s.lastAt);return next;}
export function startPlan(s:SaveData,id:string,kind:StudyKind,expected:string|null){
 const p=planCatalog.find(p=>p.id===id);if(!p||(s.research.active?.id??null)!==expected||s.research.active||!['artifact','creature','event'].includes(kind)||s.resources<p.cost)return s;
 const curios=s.collection.filter(id=>discoveries.some(d=>d.id===id&&d.kind==='artifact')),source=curios[s.research.started%curios.length]??null;if(p.needsCurio&&!source)return s;
 const next=structuredClone(s);next.resources-=p.cost;next.research.spent+=p.cost;next.research.started++;next.research.active={id:`plan-${next.research.started}`,plan:p.id,kind,source,end:s.world.elapsedMs+p.duration};return next;
}
const valid=(x:unknown,max=1e12):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max;
export function cleanStation(raw:unknown,migrated=false):StationState {
 const s=raw as StationState|undefined;if(!s||s.version!==1||!Number.isInteger(s.integrity)||!valid(s.integrity,100)||typeof s.autoRepair!=='boolean'||!Number.isInteger(s.autoBudgetTenths)||!valid(s.autoBudgetTenths,3000)||!['grossIncome','repairSpent','repairPoints','repairCount','damageTotal','protectedNights'].every(k=>valid((s as any)[k]))||!s.currentDamage||!valid(s.currentDamage.number)||!valid(s.currentDamage.points,100)||!(s.lastHitAt===null||valid(s.lastHitAt,1e15)))return createStation(migrated);
 if(s.lastRepair&&(!valid(s.lastRepair.at,1e15)||!valid(s.lastRepair.from,100)||!valid(s.lastRepair.to,100)||!valid(s.lastRepair.points,100)||!valid(s.lastRepair.cost,300)||typeof s.lastRepair.automatic!=='boolean'))return createStation(migrated);
 if(s.lastNight&&!['number','damage','required','repaired','spent','unrepaired','intercepted','arrived','balance'].every(k=>valid((s.lastNight as any)[k])))return createStation(migrated);
 return {...structuredClone(s),lastHitPoints:valid(s.lastHitPoints,6)?s.lastHitPoints:0};
}
export function cleanResearch(raw:unknown):ResearchState {
 const s=raw as ResearchState|undefined;if(!s||![s.started,s.completed,s.spent].every(x=>Number.isInteger(x)&&valid(x))||s.completed>s.started||!Array.isArray(s.notes)||s.notes.length>12||s.notes.some(n=>!valid(n.id)||!['artifact','creature','event'].includes(n.kind)||!valid(n.at,1e15)||typeof n.title!=='string'||n.title.length>80||typeof n.text!=='string'||n.text.length>300||(n.source!==null&&!discoveries.some(d=>d.id===n.source))))return createResearch();
 const a=s.active;if(a&&(!planCatalog.some(p=>p.id===a.plan)||a.id!==`plan-${s.started}`||!['artifact','creature','event'].includes(a.kind)||!valid(a.end,1e12)||(a.source!==null&&!discoveries.some(d=>d.id===a.source&&d.kind==='artifact'))))return createResearch();return structuredClone(s);
}
/** Bounded chronological cash-flow events, not frame simulation. World can advance further in protected mode. */
export function progressStation(s:SaveData,now:number,offline:boolean):SaveData {
 const next=structuredClone(s),values=tuning(s),ms=Math.min(now-s.lastAt,values.cargo*1000),start=s.world.elapsedMs,end=start+ms,packet=offline&&ms>=30000,baseCash=s.resources,old=s.pendingReturn,known=new Set([...s.collection,...(old?.discoveries??[])]),found:string[]=[];
 next.resources+=old?.resources??0;next.pendingReturn=null;let cursor=start,cachedIndex=-1,cached:NightResult|undefined;
 const discover=(id:string,at:number)=>{if(known.has(id))return;known.add(id);found.push(id);next.discoveryAt[id]=at;};
 function finishPlan(){const a=next.research.active;if(!a||cursor<a.end)return;const d=discoveries.find(d=>d.kind===a.kind&&!known.has(d.id));if(d)discover(d.id,s.lastAt+cursor-start);const source=a.source??next.collection.find(id=>discoveries.some(d=>d.id===id&&d.kind==='artifact'))??null;next.research.completed++;const lines={artifact:['玻璃里的小宇宙','它的异常波纹启发了新一轮扫描校准；物品仍留在收藏柜。'],creature:['居民的夜行路线','纸屑与足印拼成一条更省路的回收线路。'],event:['未寄出的现场记录','同一片平原在不同时间，留下了不一样的回声。']};const variants={artifact:['它每道歉三次，扫描仪就多读出一层旧地址。','昨天的邮戳在玻璃里转身，留下了可重复核对的时间偏差。','包裹的折痕与纸层地貌相似，下一次采样可以少绕一段路。'],creature:['拆封鼠把纸屑堆成了路标，咔哒终于学会绕开它的午睡角落。','箱寄居蟹每晚更换朝向，旧箱底露出了平原的微小温差。','标签鸟沿安全灯的边缘飞行，留下三段节省回收路程的轨迹。'],event:['反向分拣机在黄昏少转半圈，凌晨的回波于是有了解释。','影子的收件地址不是仓库，而是仓库门外那盏灯。','空白地址只在纸层反光时出现；这次已经把采样角度记下。']};const [title]=lines[a.kind],text=variants[a.kind][(next.research.completed-1)%3];next.research.notes.push({id:next.research.completed,kind:a.kind,source,title,text,at:s.lastAt+cursor-start});next.research.notes=next.research.notes.slice(-12);next.research.active=null;}
 while(cursor<end){
  finishPlan();const phase=cursor%300000,daytime=phase<240000,index=Math.floor(cursor/300000)+1,factor=explorationFactor(next)*(1+planBoost(next)),radar=values.radar*(1+planBoost(next));
  let hit=Infinity;if(!daytime){if(cachedIndex!==index){const active=next.world.activeNight;cached=nightResult({slots:active?.slots??next.world.slots,strengths:active?.strengths??next.world.strengths});cachedIndex=index;}for(const a of cached!.actors)if(a.outcome==='arrived'){const at=(index-1)*300000+240000+a.atMs;if(at>cursor+.00001)hit=Math.min(hit,at);}}
  const phaseEnd=(index-1)*300000+(daytime?240000:300000),cycleTime=daytime?Math.max(1,Math.ceil((values.scanner-next.cycleMs)/factor-1e-7)):Infinity,radarTime=Math.max(1,Math.ceil((SURVEY_DURATION-next.radarMs)/radar-1e-7)),researchEnd=next.research.active?.end??Infinity;
  const dt=Math.min(end-cursor,phaseEnd-cursor,hit-cursor,cycleTime,radarTime,researchEnd-cursor),at=s.lastAt+cursor+dt-start;
  const cycle=next.cycleMs+dayTimeBetween(cursor,dt)*factor,count=Math.floor((cycle+1e-7)/values.scanner);next.cycleMs=Math.max(0,cycle-count*values.scanner);next.cycles+=count;
  const totalRadar=next.radarMs+dt*radar,surveys=Math.floor((totalRadar+1e-7)/SURVEY_DURATION);next.radarMs=Math.max(0,totalRadar-surveys*SURVEY_DURATION);next.surveyCount+=surveys;if(surveys)next.surveyNotice=parcelSignals[(next.surveyCount-1)%parcelSignals.length].id;
  const income=count*values.recycler+surveys*6;next.resources+=income;next.station.grossIncome+=income;next.station.autoBudgetTenths=Math.min(3000,next.station.autoBudgetTenths+income*3);
  for(const d of discoveries)if(d.milestone<=next.cycles&&!known.has(d.id))discover(d.id,at);
  next.world=advanceWorld(next,at);next.lastAt=at;cursor+=dt;
  if(Math.abs(cursor-hit)<.00001){const damage=Math.min(6,next.station.integrity);next.station.integrity-=damage;next.station.damageTotal+=damage;next.station.lastHitAt=at;next.station.lastHitPoints=damage;if(next.station.currentDamage.number!==index)next.station.currentDamage={number:index,points:0};next.station.currentDamage.points+=damage;}
  if(cursor>0&&cursor%300000===0){const r=next.world.lastReport!;next.station.lastNight={number:r.number,damage:next.station.currentDamage.number===r.number?next.station.currentDamage.points:0,required:(100-next.station.integrity)*repairPrice(next),repaired:0,spent:0,unrepaired:100-next.station.integrity,intercepted:r.intercepted,arrived:r.arrived??0,balance:next.resources};}
  if(next.station.autoRepair&&day(next))repair(next,true,at);finishPlan();
 }
 next.journal.entries=[...new Set([...next.journal.entries,...parcelJournal.filter(note=>note.cycle<=next.cycles&&note.requires.every(id=>known.has(id))).map(note=>note.id)])];next.journal.shift=journalShift(next.cycles);
 next.chart=stepStarChart(s.chart,ms*growthEffects(s).interstellarSpeed,s.planets,planets,now);next.interstellar=next.chart.scan;next.planets=[...new Set([...s.planets,...next.chart.records.map(r=>r.id)])];
 if(now>next.lastAt){const before=next.world.settledNights;next.world=advanceWorld(next,now);next.station.protectedNights+=next.world.settledNights-before;next.lastAt=now;}
 const available=next.resources;if(packet){next.resources=Math.min(baseCash,available);next.pendingReturn={id:old?.id??`return-${s.lastAt}`,seconds:(old?.seconds??0)+Math.floor(ms/1000),resources:Math.max(0,available-baseCash),discoveries:[...(old?.discoveries??[]),...found],maintenance:(old?.maintenance??0)+next.station.repairSpent-s.station.repairSpent,gross:(old?.gross??old?.resources??0)+next.station.grossIncome-s.station.grossIncome};}
 else {const held=Math.min(old?.resources??0,available);next.resources=available-held;next.pendingReturn=old?{...old,resources:held}:null;next.collection.push(...found);}
 return next;
}
