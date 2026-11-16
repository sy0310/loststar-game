import {firstPlanetFixture} from './firstplanet_fixtures';
import {advanceFusion,reduceFusion} from '../src/fusion/domain';
import {fusionProjects} from '../src/fusion/contracts';
/** Disposable evidence archives. Every owned right and expense comes from ordinary reducers. */
export function renewalFixture(now:number,kind:'funded'|'return'){
 const elapsed=24*60*1000;
 const parent=firstPlanetFixture(now-elapsed,0,'stabilized',{receiptAbility:0,tapeAbility:0});
 let state=advanceFusion(parent.state,now,true);
 const pending=state.game.pendingReturn?.resources??0;
 if(kind==='funded'&&state.game.pendingReturn){const result=reduceFusion(state,{type:'claim'},now);if(!result.result.ok)throw Error('Fixture return claim failed');state=result.state;}
 return {state,audit:{kind,method:'ordinary-model-offline-earning',parent:parent.audit,elapsedMs:elapsed,pendingResources:pending,claim:kind==='funded',balance:state.game.resources,worldMs:state.game.world.elapsedMs}};
}

/** Reachable paid project pages, funded only by ordinary first-planet work. */
export function renewalPagesFixture(now:number){
 function build(start:number){
  const parent=renewalFixture(start,'funded');let state=parent.state;
  const actions:{id:string;price:number;before:number;after:number}[]=[];
  for(const project of fusionProjects){
   let advances=0;
   while(state.game.resources<project.price){
    if(++advances>100)throw Error('Page fixture cannot fund a real project');
    state=advanceFusion(state,state.game.lastAt+300000,true);
    if(state.game.pendingReturn){const claimed=reduceFusion(state,{type:'claim'},state.game.lastAt);if(!claimed.result.ok)throw Error('Page fixture claim failed');state=claimed.state;}
   }
   const before=state.game.resources,result=reduceFusion(state,{type:'project',id:project.id},state.game.lastAt);
   if(!result.result.ok)throw Error(`Page fixture project blocked: ${project.id}`);
   state=result.state;actions.push({id:project.id,price:project.price,before,after:state.game.resources});
  }
  return{state,audit:{kind:'reachable-project-pages',method:'ordinary reducers and ordinary offline earning; no injected currency',parent:parent.audit,actions}};
 }
 const reference=1800000000000,offset=build(reference).state.game.lastAt-reference;
 const result=build(now-offset);if(result.state.game.lastAt!==now)throw Error('Page fixture clock mismatch');return result;
}
