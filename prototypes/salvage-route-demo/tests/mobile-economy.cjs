/* Developer-only comparison against the exact pre-grid rules. Not included in the player ZIP. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {createRequire} = require('node:module');
const current = require('../src/engine.js');
const root = path.resolve(__dirname, '../../..');
const BASELINE = 'b26455ada31fe1ab780905cdb1c26f1387c082bb';
const sourcePath = 'prototypes/salvage-route-demo/src/engine.js';
const baselineSource = execFileSync('git', ['show', `${BASELINE}:${sourcePath}`], {cwd:root, encoding:'utf8'});
const balancePath = 'design/star-salvage/BALANCE_V01.json';
const baselineBalance = execFileSync('git', ['show', `${BASELINE}:${balancePath}`], {cwd:root, encoding:'utf8'});
const currentBalance = fs.readFileSync(path.join(root,balancePath),'utf8');
assert.deepEqual(JSON.parse(currentBalance),JSON.parse(baselineBalance),'baseline and current must use the original prices and resource rules');
const baseline=require('./legacy-engine.cjs')();
const digest = value => createHash('sha256').update(value).digest('hex');
const currentSources = Object.fromEntries(['engine.js','cargo-layout.js','balance.js'].map(file => [file,digest(fs.readFileSync(path.join(__dirname,'../src',file)))]));
currentSources[balancePath]=digest(currentBalance);
const seeds = Number(process.env.SALVAGE_COMPARE_SEEDS || 32);
const voyageLimit = Number(process.env.SALVAGE_COMPARE_VOYAGES || 12);
const policies = {
  cautious:{limit:3, fuel:60, hull:90, tools:false},
  cargo:{limit:4, fuel:80, hull:90, tools:false},
  deep:{limit:8, fuel:100, hull:100, tools:false},
  equipped:{limit:5, fuel:80, hull:90, tools:true},
};
const asJson = value => JSON.parse(JSON.stringify(value));
function solve(E, draft) {
  const result = E.Cargo.solve(draft.items, draft.placements);
  if (Array.isArray(result)) return result;
  if (result?.ok) return result.placements;
  return null;
}
function score(choice) {
  const e=choice.effect;
  return (e.money||0)+(e.loot||[]).reduce((n,x)=>n+x.value,0)
    +(e.fuel||0)*2+(e.bonusFuel||0)*2+(e.hull||0)*2
    -(choice.risk ? choice.risk[0]+choice.risk[1] : 0);
}
function play(E, seed, policy, geometric) {
  let state=E.create(seed);
  const totals={voyages:0, depth:0, netCash:0, reward:0, goodsReturned:0, goodsSold:0,
    lootProposals:0,successfulLoads:0, repacks:0, geometricFailures:0, areaFailures:0,
    declinedLootChoices:0, replacements:0, rescues:0, aid:0, actions:0, returnedCells:0, selectedItems:0, peakCells:0, droppedItems:0, areaHistogram:{}};
  const rows=[];
  const act = action => {
    const result=E.dispatch(state, action);
    assert.equal(result.ok, true, `${action.type}: ${result.message}`);
    state=result.state; totals.actions++; E.assertState(state); return state;
  };
  const prepare=()=>{
    while(state.fuel<policy.fuel && E.portQuote(state,'buyFuel').amount)act({type:'buyFuel'});
    while(state.hull<policy.hull && E.portQuote(state,'repair').amount)act({type:'repair'});
    if(E.preparation(state).needsAid){act({type:'aid'});totals.aid++;}
  };
  for(let voyage=0;voyage<voyageLimit;voyage++) {
    if(state.phase==='summary')act({type:'port'});
    if(E.cargoValue(state))act({type:'sellAll'});
    const opening=state.money;
    if(policy.tools)for(const id of ['scanner','winch']) {
      if(!state.tools.includes(id)&&state.money>=E.BALANCE.tools[id]+200)act({type:'tool',id});
    }
    prepare();
    const depart={type:'depart'};
    if(geometric){const draft=E.cargoDraft(state,depart);assert(draft.ok,draft.message);depart.layout=solve(E,draft);assert(depart.layout);}
    act(depart);
    let guard=0;
    while(['route','event','result'].includes(state.phase)) {
      assert(++guard<100,'a voyage must terminate');
      if(state.phase==='route') {
        const routes=state.route.filter(route=>E.quote(state,route).enabled);
        if(state.depth>=policy.limit||!routes.length||(state.depth>0&&state.hull<26)||(state.depth>=3&&E.used(state)===(E.SCHEMA>=4?16:4))) {
          act({type:'return'}); continue;
        }
        routes.sort((a,b)=>(a.risk==='低'?-5:0)+a.fuel-((b.risk==='低'?-5:0)+b.fuel));
        act({type:'travel',id:routes[0].uid});
      } else if(state.phase==='event') {
        // The baseline predates ignoreCargo. A read-only enlarged capacity is
        // used only in this quotation so both policies count area rejects here.
        // Every real baseline action still commits against its original capacity.
        const choices=E.encounter(state).choices.filter(c=>!E.checkChoice(geometric?state:{...state,capacity:1e9},c,{ignoreCargo:true})).sort((a,b)=>score(b)-score(a));
        let chosen=null;
        for(const choice of choices) {
          const action={type:'choose',id:choice.id,nonce:state.event.nonce};
          if(choice.effect.loot?.length) {
            totals.lootProposals++;
            const area=state.cargo.reduce((n,x)=>n+E.Cargo.area(x),0)-(choice.effect.remove?E.Cargo.area(state.cargo.find(x=>x.uid===choice.effect.remove)):0)+choice.effect.loot.reduce((n,x)=>n+E.Cargo.area(x),0);
            if(area>16){totals.areaFailures++;totals.declinedLootChoices++;totals.droppedItems+=choice.effect.loot.length;continue;}
            if(geometric) {
              const draft=E.cargoDraft(state,action);assert(draft.ok,draft.message);
              const placements=solve(E,draft);
              if(!placements){totals.geometricFailures++;totals.declinedLootChoices++;continue;}
              if(!draft.complete||draft.requiresRepack)totals.repacks++;
              action.layout=placements;
            }
            totals.successfulLoads++;totals.selectedItems+=choice.effect.loot.length;for(const item of choice.effect.loot){const area=E.Cargo.area(item);totals.areaHistogram[area]=(totals.areaHistogram[area]||0)+1;}
          } else if(E.checkChoice(state,choice))continue;
          chosen=action; break;
        }
        assert(chosen,'a visible safe option must remain');
        act(chosen);totals.peakCells=Math.max(totals.peakCells,state.cargo.reduce((n,x)=>n+E.Cargo.area(x),0));
      } else act({type:'continue'});
      if(['route','event','result'].includes(state.phase))assert(state.fuel>=E.homeCost(state),'return reserve');
    }
    assert.equal(state.phase,'summary');
    const depth=state.depth, reward=state.summary.reward, goods=state.cargo.filter(x=>!x.contract).length;
    totals.returnedCells+=state.cargo.filter(x=>!x.contract).reduce((n,x)=>n+E.Cargo.area(x),0);totals.depth+=depth;totals.reward+=reward;totals.goodsReturned+=goods;totals.rescues+=Number(state.summary.rescue);
    if(E.cargoValue(state)){totals.goodsSold+=state.cargo.filter(x=>!x.contract).length;act({type:'sellAll'});}
    act({type:'port'});prepare();
    const netCash=state.money-opening;totals.netCash+=netCash;totals.voyages++;
    rows.push({voyage:state.runNo,depth,reward,goodsReturned:goods,netCash,cash:state.money,fuel:state.fuel,hull:state.hull});
  }
  return {seed,totals,final:{money:state.money,fuel:state.fuel,hull:state.hull,debt:state.debt},rows};
}

function aggregate(runs) {
  const totals=Object.fromEntries(Object.keys(runs[0].totals).filter(k=>k!=='areaHistogram').map(k=>[k,runs.reduce((n,r)=>n+r.totals[k],0)]));
  const round=n=>+n.toFixed(3);
  return {runs:runs.length,...totals,areaHistogram:Object.fromEntries(Array.from({length:16},(_,i)=>[i+1,runs.reduce((n,r)=>n+(r.totals.areaHistogram[i+1]||0),0)])),meanReturnedCells:round(totals.returnedCells/totals.voyages),meanPeakOccupancy:round(totals.peakCells/(16*runs.length)),meanDepth:round(totals.depth/totals.voyages),
    meanNetPerVoyage:round(totals.netCash/totals.voyages),meanGoodsPerVoyage:round(totals.goodsReturned/totals.voyages),
    contractCompletionRate:round(totals.reward/(180*totals.voyages)),
    geometricFailureRateAmongAreaFits:round(totals.geometricFailures/Math.max(1,totals.successfulLoads+totals.geometricFailures)),
    meanFinalMoney:round(runs.reduce((n,r)=>n+r.final.money,0)/runs.length)};
}
const report={baseline:BASELINE,baselineEngineSha256:digest(baselineSource),baselineSchema:baseline.SCHEMA,currentSchema:current.SCHEMA,currentSources,seeds,voyagesPerSeed:voyageLimit,
  scope:'Schema3 real 0.2 versus schema4 real 0.3; developer simulation, no human play or enjoyment claim. Four fixed visible-information policies; geometry uses optional complete auto-arrange. Net cash includes actual tool purchases, services and sales in each voyage; no debt repayments are made. No old-cargo replacement policy; replacements=0 by construction. Counts of declined loot refer to proposed choices, not distinct physical items. No price/fuel tuning. Both models use real geometry. Splitting value into small pieces changes top-item trades; policy paths may diverge. Declined loot choices count opportunities, not destroyed inventory; no physical discards by this policy.',policies:{}};
assert(current.Cargo&&current.cargoDraft,'grid model is required');
for(const [name,policy] of Object.entries(policies)) {
  const oldRuns=Array.from({length:seeds},(_,i)=>play(baseline,i+1,policy,true));
  const newRuns=Array.from({length:seeds},(_,i)=>play(current,i+1,policy,true));
  const oldSummary=aggregate(oldRuns),newSummary=aggregate(newRuns);
  report.policies[name]={policy,baseline:oldSummary,current:newSummary,
    difference:{meanDepth:+(newSummary.meanDepth-oldSummary.meanDepth).toFixed(3),meanNetPerVoyage:+(newSummary.meanNetPerVoyage-oldSummary.meanNetPerVoyage).toFixed(3),meanGoodsPerVoyage:+(newSummary.meanGoodsPerVoyage-oldSummary.meanGoodsPerVoyage).toFixed(3)},baselineRuns:oldRuns,currentRuns:newRuns};
}

const directory=path.resolve(process.env.SALVAGE_COMPARE_OUT||path.join(__dirname,'../verification'));
fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'mobile-policy-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,policies:Object.fromEntries(Object.entries(report.policies).map(([name,{baselineRuns,currentRuns,...row}])=>[name,row])),matchedCommands:undefined},null,2));
