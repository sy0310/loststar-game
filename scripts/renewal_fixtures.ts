import {firstPlanetFixture} from './firstplanet_fixtures';
import {advanceFusion,reduceFusion} from '../src/fusion/domain';
/** Disposable evidence archives. Every owned right and expense comes from ordinary reducers. */
export function renewalFixture(now:number,kind:'funded'|'return'){
 const elapsed=24*60*1000;
 const parent=firstPlanetFixture(now-elapsed,0,'stabilized',{receiptAbility:0,tapeAbility:0});
 let state=advanceFusion(parent.state,now,true);
 const pending=state.game.pendingReturn?.resources??0;
 if(kind==='funded'&&state.game.pendingReturn){const result=reduceFusion(state,{type:'claim'},now);if(!result.result.ok)throw Error('Fixture return claim failed');state=result.state;}
 return {state,audit:{kind,method:'ordinary-model-offline-earning',parent:parent.audit,elapsedMs:elapsed,pendingResources:pending,claim:kind==='funded',balance:state.game.resources,worldMs:state.game.world.elapsedMs}};
}
