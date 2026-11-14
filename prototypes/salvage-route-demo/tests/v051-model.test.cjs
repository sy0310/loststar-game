/* New feedback regressions. QA overrides are explicitly separate from natural-model replay. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../src/engine.js');
const O=require('./legacy-engine.cjs')('842dc6afcfc3da079c40dc996a4dd346769d62e0');
const {act,safePort}=require('./v051-fixtures.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));
let passed=0;
const measurements={safetyVoyages:0,naturalPityVoyages:0,legacySnapshots:0};
function test(name,run){try{run();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name,error);process.exitCode=1;}}
function steps(state,depth,model=E){
 while(state.depth<depth){
  if(state.phase==='result')state=act(state,'continue',{},model);
  state=act(state,'travel',{id:state.route[0].uid},model);
  state=act(state,'choose',{id:'leave',nonce:state.event.nonce},model);
 }
 return state;
}
function goods(state,model=E){
 state.cargo=[{uid:state.nextUid++,itemId:'metal_crate',shapeId:'point1',shapeVersion:1,name:'显式QA普通货',cells:1,value:50,acquiredRun:0},
 {uid:state.nextUid++,itemId:'time_measure',shapeId:'line2',shapeVersion:1,name:'显式QA计量盒',cells:2,value:100,acquiredRun:0}];
 state.cargoGrid.placements=model.Cargo.solve(state.cargo,[],model.cargoSpace(state));
 model.assertState(state);
 return state;
}

test('minimum60 fuel reaches station5 with real14/19/25 normal prices and8 gate',()=>{
 let state=act(E.create(52),'depart');
 for(let depth=1;depth<=5;depth++){
  if(state.phase==='result')state=act(state,'continue');
  const q=E.quote(state,state.route[0]);
  assert(q.enabled);
  state=act(state,'travel',{id:state.route[0].uid});
  assert.equal(state.fuel,q.arrival);
  assert.equal(E.safeReturnReserve(state),q.returnCost);
  assert.equal(E.homeCost(state),q.normalReturnCost);
  if(depth===3)assert.deepEqual(E.returnQuotes(state),[{method:'normal',cost:14},{method:'gate',cost:8}]);
  if(depth===4)assert.deepEqual(E.returnQuotes(state),[{method:'normal',cost:19}]);
  if(depth===5){assert.equal(state.fuel,17);assert.equal(E.homeCost(state),25);}
  state=act(state,'choose',{id:'leave',nonce:state.event.nonce});
 }
 const before=copy(state);
 assert(!E.dispatch(state,{type:'return'}).ok);
 assert(!E.dispatch(state,{type:'rescue'}).ok);
 state=act(state,'return',{method:'gate'});
 assert.equal(state.fuel,9);
 assert.equal(state.summary.returnFuel,8);
 assert.equal(state.summary.returnMethod,'gate');
 assert.deepEqual(state.cargo,before.cargo);
 assert(!E.dispatch(state,{type:'return',method:'gate'}).ok);
 assert.deepEqual(E.restore(state),state);
});

test('station4 keeps its own normal reserve and projected station5 alone uses guaranteed gate',()=>{
 let state=steps(act(E.create(92),'depart'),4);
 const normal=E.homeCost(state);
 assert.equal(E.safeReturnReserve(state),normal);
 assert(!E.dispatch(state,{type:'return',method:'gate'}).ok);
 state=act(state,'continue');
 const q=E.quote(state,state.route[0]);
 assert.equal(q.gateReturnCost,8);
 assert.equal(q.normalReturnCost,25);
 assert.equal(q.returnCost,8);
 assert(q.enabled);
 const exported=copy(state);E.returnQuotes(state,5,state.distance+q.out);assert.deepEqual(state,exported);
});

test('every enabled branch reserves an actual escape across all ships, fuel levels and3 candidate costs',()=>{
 const original=E.V051.gate.fuel;
 try{
  for(const cost of[8,10,12]){E.V051.gate.fuel=cost;
   for(const [shipId,spec]of Object.entries(E.PORT.ships))for(let level=0;level<=spec.fuelUpgradeCosts.length;level++)for(let seed=1;seed<=16;seed++){
    let state=E.create(seed);state.money=27049;
    if(shipId!=='starter'){state=act(state,'buyShip',{id:shipId});state=act(state,'equipShip',{id:shipId});}
    for(let i=0;i<level;i++)state=act(state,'upgradeShip',{kind:'fuel'});
    state=act(state,'fillFuel');state=act(state,'depart');
    while(state.depth<8){
     const valid=state.route.filter(route=>E.quote(state,route).enabled);
     if(!valid.length)break;
     for(const branch of valid){const next=act(state,'travel',{id:branch.uid});assert(next.fuel>=E.safeReturnReserve(next));}
     state=act(state,'travel',{id:valid[(seed+state.depth)%valid.length].uid});
     const options=E.encounter(state).choices;
     for(const choice of options){if(E.checkChoice(state,choice))continue;const next=E.dispatch(state,{type:'choose',id:choice.id,nonce:state.event.nonce});assert(next.ok,next.message);if(next.state.phase!=='summary')assert(next.state.fuel>=E.safeReturnReserve(next.state));}
     state=act(state,'choose',{id:'leave',nonce:state.event.nonce});state=act(state,'continue');
    }
    const method=E.returnQuotes(state).sort((a,b)=>a.cost-b.cost)[0].method;
    const fuel=state.fuel;const quote=E.returnQuotes(state).find(q=>q.method===method);
    state=act(state,'return',{method});assert.equal(fuel-state.fuel,quote.cost);
    assert.equal(state.telemetry.filter(row=>row.kind==='return').length,1);
    measurements.safetyVoyages++;
   }
  }
 }finally{E.V051.gate.fuel=original;}
});

test('stored gate quote survives refresh, cancel-equivalent read, and malformed receipts reject',()=>{
 const state=steps(act(E.create(42),'depart'),3);
 assert.deepEqual(E.returnQuotes(E.restore(state)),E.returnQuotes(state));
 const returned=act(state,'return',{method:'gate'});
 for(const corrupt of [value=>value.summary.returnFuel++,value=>value.summary.returnMethod='normal',value=>value.run.returnRules.gateFuel=1]){const bad=copy(returned);corrupt(bad);assert.throws(()=>E.restore(bad));}
});

test('gate settlement completes one real commission and does not automatically sell, repair or repay',()=>{
 let state=goods(E.create(51));state=act(state,'acceptMission',{id:'survey'});state=steps(act(state,'depart'),3);
 const before=copy(state);state=act(state,'return',{method:'gate'});
 assert.equal(E.activeMission(state).status,'complete');assert.equal(state.money,before.money);assert.equal(state.hull,before.hull);assert.equal(state.debt,before.debt);assert.deepEqual(state.cargo,before.cargo);
 const id=E.activeMission(state).uid;state=act(state,'claimMission',{id});assert(!E.dispatch(state,{type:'claimMission',id}).ok);
});

test('schema7 ongoing route/event/result snapshots keep exact old route,RNG and return reserve',()=>{
 for(const depth of[1,3,5]){
  let old=O.create(73);old.money=27049;old=act(old,'fillFuel',{},O);old=act(old,'depart',{},O);
  for(let n=0;n<depth;n++){
   if(old.phase==='result')old=act(old,'continue',{},O);
   old=act(old,'travel',{id:old.route[0].uid},{...O});
   if(n===depth-1){
    for(const phase of['event','result','route']){
     if(phase==='result')old=act(old,'choose',{id:'leave',nonce:old.event.nonce},O);
     if(phase==='route')old=act(old,'continue',{},O);
     const state=E.restore(old);assert.equal(state.run.returnRules.version,'v05');assert.equal(E.returnQuotes(state).length,1);
     for(const key of['rng','fuel','money','debt','route','event','result','cargo','cargoGrid','ledger','fleet','missions'])assert.deepEqual(copy(state[key]),copy(old[key]),key);
     if(phase==='route'&&old.route.length)for(let i=0;i<2;i++)for(const key of['out','returnCost','arrival','free','enabled'])assert.equal(E.quote(state,state.route[i])[key],O.quote(old,old.route[i])[key]);
     assert(!E.dispatch(state,{type:'return',method:'gate'}).ok);measurements.legacySnapshots++;
    }
   }else old=act(old,'choose',{id:'leave',nonce:old.event.nonce},O);
  }
 }
});

test('market opportunity is granted only by actual safe return; abort and rescue never refill it',()=>{
 let state=goods(E.create(17));assert(!E.Market.available(state));assert(!E.dispatch(state,{type:'marketQuote',uid:1,style:'bold'}).ok);
 state=act(state,'depart');state=act(state,'abort');assert(!E.Market.available(state));
 state=goods(safePort(17,454));assert(E.Market.available(state));state=act(state,'marketQuote',{uid:1,style:'bold'});const key=state.market.quota.key;
 state=act(state,'depart');state=act(state,'abort');assert.equal(state.market.quota.key,key);assert(!E.Market.available(state));
 state=act(state,'depart');state=act(state,'travel',{id:state.route[0].uid});state.hull=0;state=act(state,'rescue');state=act(state,'port');assert(!E.Market.available(state));
 state=act(state,'depart');state=act(state,'travel',{id:state.route[0].uid});state=act(state,'return');state=act(state,'port');assert(E.Market.available(state));assert.notEqual(state.market.quota.key,key);
});

test('all market styles share one chance even after keep, noSale, normal selling and rebuying',()=>{
 for(const style of['cautious','bold','auction'])for(let seed=1;seed<=64;seed++){
  let state=goods(safePort(seed,454));const before=copy(state);
  state=act(state,'marketQuote',{uid:1,style,reservePercent:110});assert(state.market.quota.used);assert.equal(state.rng,before.rng);
  const offer=state.market.offers[0];state=act(state,'marketKeep',{id:offer.id});
  assert(!E.dispatch(state,{type:'marketQuote',uid:2,style:'bold'}).ok);
  state=act(state,'sell',{id:1});state=act(state,'buyProduct',{id:Object.keys(E.PORT.products)[0]});
  assert(!E.dispatch(state,{type:'marketQuote',uid:state.cargo.at(-1).uid,style:'cautious'}).ok);
  assert.deepEqual(E.restore(state),state);
 }
});

test('schema7 preserves old quotes and consumes migration quota without granting a second chance',()=>{
 let old=safePort(12,454,O);old=goods(old,O); // Shapes and paid capacities are unchanged.
 old=act(old,'marketQuote',{uid:1,style:'bold'},O);
 const migrated=E.restore(old);assert(migrated.market.quota.used);
 assert.deepEqual(copy(migrated.market.offers),copy(old.market.offers));assert.equal(migrated.market.rng,old.market.rng);
 assert(!E.dispatch(migrated,{type:'marketQuote',uid:2,style:'cautious'}).ok);
 const sold=act(migrated,'marketAccept',{id:old.market.offers[0].id});assert.equal(sold.money,old.money+old.market.offers[0].amount);
});

test('same-return import cannot replenish a spent quota, different archives remain importable',()=>{
 const state=goods(safePort(51,454));const quoted=act(state,'marketQuote',{uid:1,style:'bold'});
 const merged=E.preserveMarketQuota(E.restore(state),quoted);assert(merged.market.quota.used);assert(!E.dispatch(merged,{type:'marketQuote',uid:2,style:'cautious'}).ok);
 const other=safePort(55,454);assert.notEqual(other.market.quota.key,quoted.market.quota.key);assert.deepEqual(E.preserveMarketQuota(copy(other),quoted),other);
});

test('two qualifying natural-model voyages expose an optional unseen signal and compatible egg for256seeds',()=>{
 for(let seed=1;seed<=256;seed++){
  let state=E.create(seed);let offered=false;let anomalyShown=false;
  for(let voyage=1;voyage<=2;voyage++){
   if(state.phase==='summary')state=act(state,'port');
   if(state.fuel<30)state=act(state,'buyFuel');
   state=act(state,'depart');
   state=act(state,'travel',{id:state.route[0].uid});anomalyShown||=!!E.encounter(state).eggText;state=act(state,'choose',{id:'leave',nonce:state.event.nonce});state=act(state,'continue');
   const signals=state.route.filter(route=>E.NewEncounters.metadata[route.id]&&!state.discoveries.encounters.some(seen=>seen.id===route.id)&&E.quote(state,route).enabled);
   offered||=signals.length>0;
   // Deliberately choose the other option when possible. No forced route selection.
   const route=state.route.find(route=>!signals.includes(route)&&E.quote(state,route).enabled)||state.route[1];
   state=act(state,'travel',{id:route.uid});
   anomalyShown||=!!E.encounter(state).eggText;
   assert(state.run.discovery.eligible);assert.equal(state.progress.eligibleVoyages,voyage);
   if(voyage===2){assert(state.progress.eggSeen);assert(state.discoveries.eggs.length>0);assert(anomalyShown);}
   state=act(state,'return');measurements.naturalPityVoyages++;
  }
  assert(offered);assert.deepEqual(E.restore(state),state);
 }
});

test('shallow voyages and aborted departures do not fabricate eligibility or discovered rewards',()=>{
 let state=E.create(3);for(let i=0;i<3;i++){state=act(state,'depart');state=act(state,'abort');}
 assert.equal(state.progress.eligibleVoyages,0);assert.equal(state.progress.eggSeen,false);assert.equal(state.discoveries.eggs.length,0);
 state=act(state,'depart');state=act(state,'travel',{id:state.route[0].uid});assert.equal(state.progress.eligibleVoyages,0);
});

test('received image snapshots correspond exactly to committed UIDs and whole-item identity',()=>{
 let state=act(E.create(2),'depart');state=act(state,'travel',{id:state.route[0].uid});const old=copy(state);
 const draft=E.cargoDraft(state,{type:'choose',id:'force',nonce:state.event.nonce});assert.deepEqual(state,old);
 state=act(state,'choose',{id:'force',nonce:state.event.nonce});
 for(const added of state.result.cargoChanges.added){const item=state.cargo.find(item=>item.uid===added.uid);assert(item);assert.equal(added.itemId,item.itemId);assert.equal(added.shapeId,item.shapeId);assert.equal(added.shapeVersion,1);assert.equal(added.rotation,state.cargoGrid.placements.find(p=>p.uid===item.uid).rotation);}
 assert.equal(state.result.cargoChanges.added.length,draft.newUids.length);
});

const output=path.resolve(__dirname,'../../../releases/v051-model-results.json');fs.writeFileSync(output,JSON.stringify({passed,...measurements,failed:!!process.exitCode,scope:'Actual model transactions; fixed seeds and QA archive/event overrides explicitly isolated.'},null,2)+'\n');
if(process.exitCode)process.exit(process.exitCode);
