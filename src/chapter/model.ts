import type {FusionSave,FusionAction,FusionResult} from '../fusion/contracts';
import {advanceFusion,createFusion,restoreFusion,reduceFusion} from '../fusion/domain';
import {settleRetiredFreeWait} from '../../prototypes/ref-ui/receipt-compat';
import {settleInstantCleaning} from '../../prototypes/ref-ui/instant-clean';
import {chapterCurios} from './content';
export const STORY_DATABASE='loststar.review.parcel-story.v1';
export type ChapterSource='manual'|'automatic'|'replay'|'qa';
export interface ChapterLog {session:string;at:number;object:string;event:string;version:1;source:ChapterSource}
export interface ChapterState {version:1;baselineOwned:string[];eligibleWorldMs:number|null;revealWorldMs:number|null;endingWorldMs:number|null;read:string[];shown:string[];telemetry:boolean;logs:ChapterLog[];qa:boolean}
export type ChapterSave=FusionSave&{chapter:ChapterState};
export type ChapterAction={type:'chapter';kind:'read'|'shown'|'open'|'try'|'conclusion'|'return-session'|'telemetry';id:string;source?:ChapterSource;session?:string;enabled?:boolean};
export const emptyChapter=():ChapterState=>({version:1,baselineOwned:[],eligibleWorldMs:null,revealWorldMs:null,endingWorldMs:null,read:[],shown:[],telemetry:true,logs:[],qa:false});
const qualified=(s:FusionSave)=>['receipt','stamp','cosmic-parcel'].every(id=>s.game.collection.includes(id));
export const hasChapter=(s:FusionSave):s is ChapterSave=>!!s.chapter;
export function chapterSchedule(s:ChapterSave){const at=s.chapter.eligibleWorldMs;if(at===null)return null;let start=Math.floor(at/300000)*300000+260000;if(start<=at)start+=300000;return{start,end:start+8000};}
function log(s:ChapterSave,event:string,object:string,at:number,source:ChapterSource='automatic',session='world'){
 if(!s.chapter.telemetry)return;
 s.chapter.logs.push({session,at,object,event,version:1,source:s.chapter.qa?'qa':source});s.chapter.logs=s.chapter.logs.slice(-512);
}
function adapt(s:FusionSave){return settleInstantCleaning(settleRetiredFreeWait(s,s.game.lastAt).state,s.game.lastAt).state as ChapterSave;}
/** Facts belong to this independent save and are committed with its actual game ledger. */
function reconcile(before:ChapterSave,next:ChapterSave){
 const c=next.chapter;
 for(const id of next.game.collection)if(!before.game.collection.includes(id))log(next,'obtained',id,next.game.lastAt);
 if(c.eligibleWorldMs===null&&qualified(next)){
  // Pending cargo isn't ownership. A claim becomes eligible now, not at an invented past night.
  const already=qualified(before);
  const times=['receipt','stamp','cosmic-parcel'].map(id=>next.game.discoveryAt[id]??next.game.lastAt);
  const actual=next.game.world.elapsedMs-(next.game.lastAt-Math.max(...times));
  c.eligibleWorldMs=already?before.game.world.elapsedMs:next.game.pendingReturn?next.game.world.elapsedMs:Math.max(before.game.world.elapsedMs,Math.min(next.game.world.elapsedMs,actual));
 }
 const schedule=chapterSchedule(next);
 if(c.revealWorldMs===null&&schedule&&next.game.world.elapsedMs>=schedule.end){c.revealWorldMs=schedule.end;log(next,'chapter-occurred','reveal',next.game.lastAt);}
 if(c.endingWorldMs===null&&c.revealWorldMs!==null&&next.game.collection.includes('last-recipient')){c.endingWorldMs=next.game.world.elapsedMs;log(next,'chapter-occurred','ending',next.game.lastAt);}
 return next;
}
export function createChapter(now:number):ChapterSave{return{...createFusion(now,null,{journey:true,seed:317}),chapter:emptyChapter()};}
export function advanceChapter(input:FusionSave,now:number,offline=false):ChapterSave{
 const before=input as ChapterSave;if(now<before.game.lastAt||!Number.isFinite(now))return before;
 return reconcile(before,adapt(advanceFusion(before,now,offline)));
}
export function attachChapter(input:FusionSave,qa=false):ChapterSave{
 const copy=structuredClone(input) as ChapterSave;copy.chapter=emptyChapter();copy.chapter.baselineOwned=[...copy.game.collection];copy.chapter.qa=qa;
 // Existing ownership grants eligibility only. Never infer an old reveal/ending.
 if(qualified(copy))copy.chapter.eligibleWorldMs=copy.game.world.elapsedMs;
 return adapt(copy);
}
export function restoreChapter(raw:string,now:number):ChapterSave{
 const input=JSON.parse(raw) as ChapterSave,c=input.chapter;
 if(!c||c.version!==1||!Array.isArray(c.read)||!Array.isArray(c.shown)||!Array.isArray(c.logs))throw Error('剧情档案无法读取，原档保留');
 const core=restoreFusion(raw,input.game.lastAt) as ChapterSave;
 const validWorld=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=core.game.world.elapsedMs;
 if(![c.eligibleWorldMs,c.revealWorldMs,c.endingWorldMs].every(validWorld))throw Error('剧情时点无法读取');
 core.chapter={...emptyChapter(),...structuredClone(c),baselineOwned:Array.isArray(c.baselineOwned)?c.baselineOwned.filter(id=>core.game.collection.includes(id)):[],read:cleanChapterMarks(c.read),shown:cleanChapterMarks(c.shown),logs:c.logs.slice(-512)};
 return advanceChapter(core,now,now-core.game.lastAt>=30000);
}
export function chapterKnown(s:ChapterSave,id:string){
 if(id.startsWith('return/'))return 'return/'+s.game.pendingReturn?.id===id;
 if(id==='daily'||id==='complete')return true;
 if(id==='reveal')return s.chapter.revealWorldMs!==null;
 if(id==='ending')return s.chapter.endingWorldMs!==null;
 if(id==='link/stamp')return s.game.collection.includes('receipt')&&s.game.collection.includes('stamp');
 if(id==='combo')return s.game.collection.includes('receipt')&&s.game.collection.includes('tape');
 return s.game.collection.includes(id.replace('curio/',''));
}
export function reduceChapter(previous:FusionSave,action:FusionAction,now:number):{state:ChapterSave;result:FusionResult}{
 const before=advanceChapter(previous,now,now-previous.game.lastAt>=30000);
 if(action.type==='chapter'){
  const state=structuredClone(before),c=state.chapter;
  if(action.kind==='telemetry'){c.telemetry=action.enabled===true;if(!c.telemetry)c.logs=[];return{state,result:{ok:true}};}
  if(action.kind!=='return-session'&&!chapterKnown(state,action.id))return{state,result:{ok:false}};
  if(action.kind==='read'||action.kind==='shown'){
   const list=action.kind==='read'?c.read:c.shown;if(list.includes(action.id))return{state,result:{ok:true}};list.push(action.id);c[action.kind==='read'?'read':'shown']=cleanChapterMarks(list);
  }
  log(state,action.kind,action.id,now,action.source??'manual',action.session??'local');return{state,result:{ok:true}};
 }
 const result=reduceFusion(before,action,now),adapted=adapt(result.state);
 // Establish claim ownership time before reconciliation, so no phantom fact/log
 // is briefly produced from historical unclaimed discovery timestamps.
 if(action.type==='claim'&&result.result.ok&&before.chapter.eligibleWorldMs===null&&qualified(adapted))adapted.chapter.eligibleWorldMs=adapted.game.world.elapsedMs;
 const next=reconcile(before,adapted);
 return{state:next,result:result.result};
}
export function chapterLinks(s:ChapterSave,id:string){
 if(id==='receipt')return['票角盖着一个旧邮戳，印记有些眼熟。'];
 if(id==='stamp'&&chapterKnown(s,'link/stamp'))return['这枚邮戳，和收据角上的印记一样。'];
 if(id==='cosmic-parcel')return[s.chapter.revealWorldMs!==null?'咦，这颗星，刚才在箱子里见过。':'箱缝里，有一颗暖色的星。'];
 return[];
}
export function chapterReturnView(s:ChapterSave){
 const cargo=s.game.pendingReturn;if(!cargo)return null;
 const fresh=cargo.discoveries.filter(id=>!s.game.collection.includes(id));
 const item=fresh.find(id=>chapterCurios.includes(id as typeof chapterCurios[number]));
 if(item)return{kind:'curio' as const,id:item,title:'你不在时，有一件新发现'};
 if(s.chapter.revealWorldMs!==null&&!s.chapter.read.includes('reveal'))return{kind:'reveal' as const,id:'reveal',title:'昨夜，分拣机留下了纸条'};
 if(s.chapter.endingWorldMs!==null&&!s.chapter.read.includes('ending'))return{kind:'ending' as const,id:'ending',title:'有一封信，等你回来'};
 if(chapterKnown(s,'link/stamp')&&!s.chapter.read.includes('link/stamp'))return{kind:'link' as const,id:'stamp',title:'收据与邮戳，似乎有关联'};
 const resident=fresh.find(id=>['mouse','hermit','tagbird'].includes(id));
 if(resident)return{kind:'resident' as const,id:resident,title:'咔哒遇见了一位新朋友'};
 const entry=fresh[0];if(entry)return{kind:'record' as const,id:entry,title:'咔哒带回了一页新记录'};
 return{kind:'daily' as const,id:'daily',title:'日常收获，已好好收在船上'};
}

/** Permanent reading marks never fall out behind a long sequence of return IDs. */
export function cleanChapterMarks(values:unknown[]){
 const ids=values.filter((x):x is string=>typeof x==='string'&&x.length<180);
 const permanent=ids.filter(id=>['reveal','ending','link/stamp','combo'].includes(id)||chapterCurios.some(item=>id==='curio/'+item));
 const returns=ids.filter(id=>id.startsWith('return/')).slice(-8);
 return[...new Set([...permanent,...returns])];
}
export function chapterSummary(s:ChapterSave){
 const pending=s.game.pendingReturn;
 const byTime=[...chapterCurios].sort((a,b)=>(s.game.discoveryAt[a]??Infinity)-(s.game.discoveryAt[b]??Infinity));
 const fresh=byTime.find(id=>pending?.discoveries.includes(id))??byTime.find(id=>s.game.collection.includes(id)&&!s.chapter.baselineOwned.includes(id)&&!s.chapter.read.includes('curio/'+id));
 if(pending)return{id:'return/'+pending.id,title:chapterReturnView(s)!.title,kind:'return',curio:fresh};
 if(fresh)return{id:'curio/'+fresh,title:'有件新失物，看看它',kind:'curio',curio:fresh};
 if(s.chapter.revealWorldMs!==null&&!s.chapter.read.includes('reveal'))return{id:'reveal',title:'分拣机吐出了一张纸条 · 查看',kind:'reveal'};
 if(s.chapter.endingWorldMs!==null&&!s.chapter.read.includes('ending'))return{id:'ending',title:'有一封留给你的信 · 查看',kind:'ending'};
 if(s.chapter.endingWorldMs!==null)return{id:'complete',title:'退件平原 · 首轮发现完成',kind:'complete'};
 return{id:'daily',title:s.game.world.elapsedMs%300000>=240000?'灯下有动静 · 看看':'咔哒正在探索',kind:'daily'};
}

/** Developer-only jumps use the same ordinary, unpaid model and stay in the QA database. */
export function chapterQaFixture(kind:'eligible'|'reveal'|'ending',now:number){
 const build=(epoch:number)=>{let state=createChapter(epoch),steps=0;
  while(steps++<1800){state=advanceChapter(state,state.game.lastAt+1000);if(kind==='eligible'&&state.chapter.eligibleWorldMs!==null)break;if(kind==='reveal'&&chapterSchedule(state)&&state.game.world.elapsedMs>=chapterSchedule(state)!.start-2000)break;if(kind==='ending'&&state.chapter.endingWorldMs!==null)break;}
  if(steps>=1800)throw Error('普通路线未到达QA点');state.chapter.qa=true;state.chapter.logs=state.chapter.logs.map(l=>({...l,source:'qa'}));return state;
 };const first=build(now);return build(now-(first.game.lastAt-now));
}
