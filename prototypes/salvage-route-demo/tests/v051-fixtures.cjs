/* Explicit QA helpers. They use real transactions and never touch the user profile. */
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
function act(state,type,extra={},model=E){const result=model.dispatch(state,{type,...extra});assert(result.ok,type+': '+result.message);return result.state;}
function safePort(seed=12,money=120,model=E){
 let state=model.create(seed);
 state.money=money;
 state=act(state,'depart',{},model);
 state=act(state,'travel',{id:state.route[0].uid},model);
 state=act(state,'choose',{id:'leave',nonce:state.event.nonce},model);
 state=act(state,'return',{},model);
 return act(state,'port',{},model);
}
function returnAction(model,state){
 const method=model.returnQuotes?.(state).sort((a,b)=>a.cost-b.cost)[0].method;
 return {type:'return',...(method?{method}:{})};
}
module.exports={act,safePort,returnAction};
