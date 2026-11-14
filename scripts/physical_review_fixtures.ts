import {renewalFixture} from './renewal_fixtures';
import {advanceFusion,reduceFusion} from '../src/fusion/domain';
export {advanceFusion} from '../src/fusion/domain';

/** Earned mixed-case archive, built twice to land exactly on a requested wall time.
 * It never rebases individual save fields or injects player currency. */
export function physicalMuseumFixture(now:number){
 function build(start:number){
  const parent=renewalFixture(start,'funded');let state=parent.state;
  const purchases:{index:number;level:number;before:number;after:number}[]=[];
  for(const [index,level]of [0,1,2,3,1,2].entries())for(let n=0;n<level;n++){
   let attempts=0;
   while(state.game.resources<2000){
    if(++attempts>100)throw Error('Mixed cabinet fixture earning exhausted');
    state=advanceFusion(state,state.game.lastAt+300000,true);
    if(state.game.pendingReturn)state=reduceFusion(state,{type:'claim'},state.game.lastAt).state;
   }
   const before=state.game.resources,result=reduceFusion(state,{type:'growth',id:`case-${index}`,expected:n},state.game.lastAt);
   if(!result.result.ok)throw Error(`Paid mixed cabinet rejected: ${index}/${n}`);
   state=result.state;purchases.push({index,level:n+1,before,after:state.game.resources});
  }
  return{state,audit:{method:'ordinary paid reducers and offline earning, no injected currency or timestamp overrides',parent:parent.audit,purchases}};
 }
 const reference=1800000000000,offset=build(reference).state.game.lastAt-reference;
 const result=build(now-offset);if(result.state.game.lastAt!==now)throw Error('Mixed cabinet fixture clock mismatch');return result;
}
