import {settleRetiredFreeWait,type FreeReceiptReceipt} from './receipt-compat';
import type {FusionSave, FusionAction, FusionController, FusionResult} from '../../src/fusion/contracts';
import {createFusion, advanceFusion, reduceFusion} from '../../src/fusion/domain';
import {firstPlanetFixture} from '../../scripts/firstplanet_fixtures';
import {refinementView, sortingStudies} from '../../src/fusion/progression';
import {explorationFlowView} from '../../src/fusion/exploration-flow';
import {fusionNightSnapshot} from '../../src/fusion/runtime-night';
import {nightAt} from '../../src/prototype/night-model';
import {surfaceView} from '../../src/fusion/surface';

export const reviewProfiles = ['fresh', 'owned', 'treatment', 'restoration', 'facilities', 'return', 'night', 'repeat-night', 'morning', 'conclusion'] as const;
export type ReviewProfile = typeof reviewProfiles[number];

/** Isolated fixtures only. Every acquisition/expense in the earned fixture uses the unmodified ordinary reducers. */
export function makeReviewFixture(profile: ReviewProfile, now: number) {
  if (profile === 'fresh') return {state: createFusion(now, null, {journey:true, seed:317}), provenance: {kind:'ordinary-new-game', initial:120}};
  if (profile === 'treatment') {const fixture=firstPlanetFixture(now,0,'found',{receiptAbility:0,tapeAbility:0});return {state:fixture.state,provenance:fixture.audit};}
  if(profile==='return'){return{state:advanceFusion(createFusion(now-1200000,null,{journey:true,seed:317}),now,true),provenance:{kind:'ordinary-offline-return',seconds:1200}};}
  if(profile==='restoration'){const build=(at:number)=>{let fixture=firstPlanetFixture(at,0,'found',{receiptAbility:0,tapeAbility:0}),state=fixture.state;const claims:unknown[]=[];while(state.game.resources<2000){state=advanceFusion(state,state.game.lastAt+300000,true);if(state.game.pendingReturn){const r=reduceFusion(state,{type:'claim'},state.game.lastAt);claims.push({before:state.game.resources,after:r.state.game.resources});state=r.state;}}return{state,provenance:{kind:'ordinary-earned-treatment',initial:fixture.audit,claims}};};const one=build(now);return build(now-(one.state.game.lastAt-now));}
  if (profile === 'owned') {const fixture=firstPlanetFixture(now,3,'stabilized');return {state:fixture.state,provenance:fixture.audit};}
  if(profile==='facilities'){
    const build=(at:number)=>{const fixture=firstPlanetFixture(at,0,'stabilized');let state=fixture.state;const purchases:unknown[]=[];
      for(const id of ['evidence-bench','habitat-window','archive']){let attempts=0;while(true){const r=reduceFusion(state,{type:'project',id},state.game.lastAt);if(r.result.ok){purchases.push({id,before:state.game.resources,after:r.state.game.resources});state=r.state;break;}if(++attempts>100)throw Error('Facility fixture cannot earn purchase');state=advanceFusion(state,state.game.lastAt+300000,true);if(state.game.pendingReturn)state=reduceFusion(state,{type:'claim'},state.game.lastAt).state;}}
      return{state,provenance:{kind:'ordinary-earned-facilities',initial:fixture.audit,purchases}};};const first=build(now);return build(now-(first.state.game.lastAt-now));
  }
  if (profile !== 'conclusion') {
    const seconds=profile==='night'?283:profile==='repeat-night'?583:302;
    let state=createFusion(now-seconds*1000,null,{journey:true,seed:317});
    for(let second=1;second<=seconds;second++)state=advanceFusion(state,now-seconds*1000+second*1000);
    return {state,provenance:{kind:'ordinary-model-pre-roll',seconds,clockOverriddenDuringPlayback:false}};
  }
  function build(at:number) {
    let {state,audit}=firstPlanetFixture(at,0,'stabilized',{receiptAbility:1,tapeAbility:0});
    const actions: {action:FusionAction;at:number;before:number;after:number}[]=[];
    const act=(action:FusionAction)=>{const before=state.game.resources,r=reduceFusion(state,action,state.game.lastAt);if(!r.result.ok)throw Error(r.result.message);state=r.state;actions.push({action,at:state.game.lastAt,before,after:state.game.resources});};
    const work=(ms:number)=>{state=advanceFusion(state,state.game.lastAt+ms);};
    const earn=(price:number)=>{let guard=0;while(state.game.resources<price){if(++guard>100)throw Error('Fixture funding failed');state=advanceFusion(state,state.game.lastAt+300000,true);if(state.game.pendingReturn)act({type:'claim'});}};
    earn(3000);
    for(let guard=0;state.progression.sorting.phase!=='cleared';guard++) {
      if(guard>200)throw Error('Ordinary route did not complete');const v=refinementView(state);
      if(v.compareAction.enabled)act(v.compareAction.action);
      else if(v.mainAction.enabled){earn(v.mainAction.price);act(v.mainAction.action);}
      else work(12000);
    }
    for(const study of sortingStudies){earn(90);act({type:'sorting',kind:'research',target:study.id});for(let n=0;state.progression.sorting.activeStudy;n++){if(n>100)throw Error('Study stalled');work(12000);}}
    return {state,provenance:{kind:'ordinary-earned-route',initialFixture:audit,actions}};
  }
  const first=build(now),offset=first.state.game.lastAt-now;
  return build(now-offset);
}

/** No new quest, save field, conclusion fact or charge. A pure projection of existing records. */
export function referenceView(state:FusionSave) {
  const pending=state.game.pendingReturn;
  const flow=explorationFlowView(state),sort=refinementView(state).sorting,night=fusionNightSnapshot(state.game);
  const cleared=sort.phase==='cleared';
  const facts=sort.sourceFacts.map(fact=>({id:fact.id,text:fact.detail}));
  const direction=facts.find(fact=>fact.id==='study/belt-direction');
  const conclusion=cleared?{title:'纸路接通了',detail:direction?'箱子能沿纸路回到收件站。夜班原因仍待查。':'旧分拣站的纸路已接通。夜班原因仍待查。',
    evidence:direction??null,next:'继续自动探索，留意今晚灯下的来访。'}:null;
  const knownNight=state.game.world.settledNights>0;
  const site=surfaceView(state).find(site=>site.id==='receipt'&&site.progress>0);
  const guestId=flow.nightGuest;
  const actor=guestId===null?null:nightAt(night.configuration,night.sourceModelMs/1000).actors.find(actor=>actor.id===guestId)??null;
  const identified=guestId!==null&&(knownNight||(actor?.verification??0)>=1||guestId===2&&night.observations.length>0&&['identify','contain','result','return'].includes(night.phase));
  const markerVisible=!pending&&(flow.kind==='night'?!!actor&&actor.alpha>.1:!!site&&(!site.revealed||flow.waitingCurio==='receipt'&&state.receipt.stage==='buried'));
  const waitingCondition=flow.waitingCurio?(flow.waitingCurio==='receipt'?state.receipt.condition:state.curios[flow.waitingCurio]?.condition):undefined;
  const title=pending?'飞船回来了':flow.kind==='night'?(knownNight?'灯下的日常来访':'灯下有动静'):flow.kind==='dawn'?'昨夜的记录':flow.waitingCurio?(waitingCondition==='clean'?'有件失物，等你升级':'有件失物，等你安顿'):site&&!site.revealed?'箱堆里有回声':cleared?'纸路已接通':'咔哒正在探索';
  const eventId=pending?'return/awaiting-claim':flow.kind==='night'?`night/${Math.floor(state.game.world.elapsedMs/300000)+1}/${guestId??'waiting'}`:flow.waitingCurio?`curio/${flow.waitingCurio}`:site&&!site.revealed?`site/${site.id}`:'journal';
  return {flow,night,conclusion,guestId,identified,knownNight,title,eventId,site,markerVisible,
    objective:cleared?'纸路已接通':'调查旧分拣站',objectiveFull:'接通旧分拣站的纸路',
    summary:flow.kind==='night'?(knownNight?'熟悉的动静，咔哒会照看。':'咔哒正在辨认，点这里看看。'):flow.kind==='dawn'?`记录已收好${flow.previousNight?.maintenance?` · 照料实付${flow.previousNight.maintenance}零件`:''}`:flow.waitingCurio?'先看一眼，再放进收藏。':cleared?'夜班原因仍待查。':'不点也会继续探索。'};
}

/** Controller exists only in this tab's memory: no IDB, localStorage, import, migration or reset. */
export function createMemoryController(initial:FusionSave) {
  let state=structuredClone(initial);const compatibility:FreeReceiptReceipt[]=[];
  const adapt=()=>{const result=settleRetiredFreeWait(state,state.game.lastAt);state=result.state;if(result.receipt)compatibility.push(result.receipt);};adapt();
  const listeners=new Set<()=>void>();
  const trace:{action:FusionAction;at:number;before:number;after:number;ok:boolean}[]=[];
  const notify=()=>listeners.forEach(listener=>listener());
  const controller: FusionController={get state(){return state;},persisted:true,
    async act(action):Promise<FusionResult>{const at=Date.now();state=advanceFusion(state,at,at-state.game.lastAt>=30000);adapt();const before=state.game.resources;const r=reduceFusion(state,action,at);state=r.state;adapt();trace.push({action,at,before,after:state.game.resources,ok:r.result.ok});notify();return r.result;},
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}};
  const timer=setInterval(()=>{if(document.visibilityState!=='visible')return;const at=Date.now();state=advanceFusion(state,at,at-state.game.lastAt>=30000);adapt();notify();},250);
  return {controller,trace,compatibility,stop:()=>clearInterval(timer)};
}
