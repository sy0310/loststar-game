import {tapeSpeed,bellHoldMs} from '../game/guard-tuning';
import type {GuardSlots} from './guard-engine';
export interface NightConfig {slots:GuardSlots;strengths:[number,number];}
export type NightOutcome='intercepted'|'arrived'|'escorted';
export interface NightActorResult {id:number;outcome:NightOutcome;atMs:number;slowMs:number;stunMs:number;verificationMs:number;}
export interface NightResult {model:2;configuration:NightConfig;intercepted:number;arrived:number;escorted:number;safeReturned:number;clues:number;quality:string;actors:NightActorResult[];}
export interface NightEvent {atMs:number;id:number;kind:'spawn'|'tape'|'bell'|'intercept'|'arrival'|'escort'|'safe-return';}
export interface NightActorFrame {id:number;progress:number;verification:number;slowed:boolean;stunned:boolean;sealing:boolean;alpha:number;status:'approaching'|NightOutcome;}
export interface NightFrame {atMs:number;actors:NightActorFrame[];intercepted:number;arrived:number;escorted:number;}
export interface NightTimeline {frames:NightFrame[];events:NightEvent[];result:NightResult;}
export const nightRules={durationMs:60000,stepMs:100,verificationMs:10500,bellPeriodMs:6000,spawns:[{atMs:4200,travelMs:15000},{atMs:22200,travelMs:12000},{atMs:40200,travelMs:9600}]} as const;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const inside=(p:number,zone:readonly number[])=>p>=zone[0]&&p<=zone[1];
const tapeZones=[[.34,.58],[.64,.88]] as const,bellZones=[[.20,.80],[.50,1]] as const;
/** Fixed 100ms world ticks. This same immutable plan drives live poses and offline receipts. */
export function simulateNight(config:NightConfig):NightTimeline {
 const actors=nightRules.spawns.map((spawn,id)=>({id,...spawn,progress:0,verificationMs:0,slowMs:0,stunMs:0,stunUntil:0,outcome:null as NightOutcome|null,at:0,tapeSeen:false,returned:false}));
 const frames:NightFrame[]=[],events:NightEvent[]=[];
 const tapeSlot=config.slots.findIndex(id=>id==='tape'||id==='beacon'),bellSlot=config.slots.findIndex(id=>id==='bell'||id==='gate');
 let intercepted=0,arrived=0,escorted=0;
 for(let time=0;time<=nightRules.durationMs;time+=nightRules.stepMs){
  const visible:NightActorFrame[]=[];
  for(const a of actors){
   if(time<a.atMs)continue;
   if(time===a.atMs)events.push({atMs:time,id:a.id,kind:'spawn'});
   let slowed=false,stunned=false;
   if(time>a.atMs&&!a.outcome){
    slowed=tapeSlot>=0&&inside(a.progress,tapeZones[tapeSlot]);
    if(slowed){a.slowMs+=nightRules.stepMs;if(!a.tapeSeen){a.tapeSeen=true;events.push({atMs:time,id:a.id,kind:'tape'});}}
    if(bellSlot>=0&&time%nightRules.bellPeriodMs===0&&inside(a.progress,bellZones[bellSlot])){a.stunUntil=time+bellHoldMs(config.strengths[bellSlot]);events.push({atMs:time,id:a.id,kind:'bell'});}
    stunned=time<a.stunUntil;if(stunned)a.stunMs+=nightRules.stepMs;
    // The crew needs enough readable-label time in the approach corridor.
    // Slowing/stopping changes whether verification completes before the gate.
    if(a.progress>=.32)a.verificationMs+=nightRules.stepMs;
    a.progress=Math.min(1,a.progress+(stunned?0:nightRules.stepMs/a.travelMs*(slowed?tapeSpeed(config.strengths[tapeSlot]):1)));
    if(a.progress>=1){a.outcome='arrived';a.at=time;arrived++;events.push({atMs:time,id:a.id,kind:'arrival'});}
    else if(a.verificationMs>=nightRules.verificationMs){a.outcome='intercepted';a.at=time;intercepted++;events.push({atMs:time,id:a.id,kind:'intercept'});}
    else if(time===nightRules.durationMs){a.outcome='escorted';a.at=time;escorted++;events.push({atMs:time,id:a.id,kind:'escort'});}
   }
   const fade=a.outcome?clamp((time-a.at)/(a.outcome==='intercepted'?1200:2500)):0;
   if(a.outcome&&fade>=1){if(!a.returned){a.returned=true;events.push({atMs:time,id:a.id,kind:'safe-return'});}continue;}
   visible.push({id:a.id,progress:a.progress*(1-fade),verification:clamp(a.verificationMs/nightRules.verificationMs),slowed:slowed&&!a.outcome,stunned:stunned&&!a.outcome,sealing:a.outcome!==null,alpha:1-fade,status:a.outcome??'approaching'});
  }
  frames.push({atMs:time,actors:visible,intercepted,arrived,escorted});
 }
 const result:NightResult={model:2,configuration:structuredClone(config),intercepted,arrived,escorted,safeReturned:actors.filter(a=>a.outcome!==null).length,clues:1+intercepted,quality:['基础巡守','零散线索','清晰记录','完整封条档案'][intercepted],actors:actors.map(a=>({id:a.id,outcome:a.outcome!,atMs:a.at,slowMs:a.slowMs,stunMs:a.stunMs,verificationMs:a.verificationMs}))};
 return {frames,events,result};
}
// At most 24 three-visitor plans. Hidden pages never run a per-frame simulation.
const plans=new Map<string,NightTimeline>();
function plan(config:NightConfig){const key=JSON.stringify([config.slots,config.strengths]);let p=plans.get(key);if(!p){p=simulateNight(config);if(plans.size>=24)plans.delete(plans.keys().next().value!);plans.set(key,p);}return p;}
export function nightResult(config:NightConfig):NightResult{return structuredClone(plan(config).result);}
export function nightAt(config:NightConfig,seconds:number):NightFrame {
 const ms=Number.isFinite(seconds)?Math.max(0,Math.min(60000,seconds*1000)):0,p=plan(config),index=Math.floor(ms/nightRules.stepMs),frame=p.frames[index],next=p.frames[Math.min(index+1,p.frames.length-1)],blend=(ms-frame.atMs)/nightRules.stepMs;
 return {...frame,actors:frame.actors.map(a=>{const b=next.actors.find(b=>b.id===a.id);return {...a,progress:b?a.progress+(b.progress-a.progress)*blend:a.progress};})};
}
