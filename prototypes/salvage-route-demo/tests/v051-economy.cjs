/* Developer-only actual-transaction comparison. No optimal-route or human pacing claim. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const E=require('../src/engine.js');
const O=require('./legacy-engine.cjs')('842dc6afcfc3da079c40dc996a4dd346769d62e0');
const {play}=require('./port-economy.cjs');
const {safePort}=require('./v051-fixtures.cjs');
const round=n=>+n.toFixed(3);
const policies={noMission:{depth:3},manualSurvey:{mission:'survey',depth:3},cargoGrowth:{mission:'survey',depth:4,ship:'cargo',full:true},scoutGrowth:{mission:'deep',depth:5,ship:'scout',full:true},heavyGrowth:{mission:'survey',depth:4,ship:'heavy',full:true},starterEngineering:{mission:'survey',depth:6,mods:true,full:true}};
const report={baseline:'0.5.0/842dc6a',seedCount:24,voyagesPerSeed:16,scope:'Actual dispatch and cash ledger. Fixed synthetic policies evaluate current options without inspecting future RNG. Automated action counts are separate from recorded browser taps. No player-time or enjoyment claim.',comparisons:{},marketLots:{},debtRepayment:{}};
function market(model,get,act,style,stats){
 const goods=[...get().cargo].sort((a,b)=>b.value-a.value);
 for(const item of goods){
  if(model.Market.available&&!model.Market.available(get()))break;
  if(model.Market.offerFor(get(),item.uid))continue;
  const fee=style==='auction'?model.Market.listingFee(item):0;
  if(get().money<fee)continue;
  act('marketQuote',{uid:item.uid,style,reservePercent:100});stats.commands++;stats.quotes++;
  const offer=model.Market.offerFor(get(),item.uid);stats.amounts.push(offer.amount);stats.fees+=offer.fee;
  if(offer.status==='open'&&offer.amount>item.value){act('marketAccept',{id:offer.id});stats.accepted++;}
  else{act('marketKeep',{id:offer.id});stats.kept++;if(offer.status==='noSale')stats.noSale++;}
  stats.commands++;
 }
}
const repo=path.resolve(__dirname,'../../..');
const inputs=['src/engine.js','src/market-v05.js','src/encounters-v05.js','src/cargo-layout.js','src/ship-holds.js','tests/v051-economy.cjs','tests/v051-fixtures.cjs','tests/port-economy.cjs'].map(name=>'prototypes/salvage-route-demo/'+name).concat(['design/star-salvage/v051/BALANCE_V051.json','design/star-salvage/v05/BALANCE_V05.json','design/star-salvage/v041/BALANCE_V041.json','design/star-salvage/BALANCE_V01.json']);
const inputFiles=inputs.map(name=>{const raw=fs.readFileSync(path.join(repo,name));return{path:name,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')};});
for(const variant of['v050','v051NoGate','gate8','gate10','gate12']){
 const model=variant==='v050'?O:E;
 const originalDepths=E.V051.gate.depths,originalFuel=E.V051.gate.fuel;
 E.V051.gate.depths=variant==='v051NoGate'?[]:[3,5];
 E.V051.gate.fuel=variant.startsWith('gate')?Number(variant.slice(4)):8;
 try{
  for(const [name,policy]of Object.entries(policies)){
   const returns=[],arrivals=[],runs=[];
   for(let seed=1;seed<=24;seed++)runs.push(play(seed,policy,120,16,model,{
    onArrival:(engine,state)=>arrivals.push({run:state.runNo,depth:state.depth,newEvent:!!engine.NewEncounters.metadata[state.event.id],fuel:state.fuel,reserve:engine.safeReturnReserve?.(state)??engine.homeCost(state)}),
    onReturn:(engine,get)=>{const state=get();returns.push({depth:state.depth,returnFuel:state.summary.returnFuel,method:state.summary.returnMethod??'normal',distance:state.distance,ordinaryReturn:engine.homeCost(state),account:state.run.account});}
   }));
   const rows=runs.flatMap(run=>run.rows),average=fn=>round(rows.reduce((sum,row)=>sum+fn(row),0)/rows.length);
   report.comparisons[name]??={};
   report.comparisons[name][variant]={voyages:rows.length,meanNetCash:average(row=>row.netCash),meanGoods:average(row=>row.goodsReturned),meanDepth:average(row=>row.depth),meanActualReturnFuel:round(returns.reduce((sum,row)=>sum+row.returnFuel,0)/returns.length),gate3:returns.filter(row=>row.depth===3&&row.method==='gate').length,gate5:returns.filter(row=>row.depth===5&&row.method==='gate').length,rescues:runs.reduce((sum,run)=>sum+run.counts.rescues,0),aid:runs.reduce((sum,run)=>sum+run.counts.aid,0),newEventVisitPercent:round(100*arrivals.filter(row=>row.newEvent).length/arrivals.length),runs,returns,arrivals};
   assert(returns.every(row=>row.returnFuel<=(row.method==='gate'?E.V051.gate.fuel:row.ordinaryReturn)));
   assert(arrivals.every(row=>row.fuel>=row.reserve));
  }
 }finally{E.V051.gate.depths=originalDepths;E.V051.gate.fuel=originalFuel;}
}
for(const [version,model]of[['v050',O],['v051',E]])for(const style of['ordinary','cautious','bold','auction','keep']){
 const samples=[],stats={commands:0,quotes:0,accepted:0,kept:0,noSale:0,fees:0,amounts:[]};
 for(let seed=1;seed<=512;seed++){
  let state=safePort(seed,27049,model);
  state.cargo=[{uid:1,itemId:'broken_engine',shapeId:'line2',cells:2,name:'QA普通件',value:22},...Object.entries(E.NewEncounters.curios).map(([itemId,item],index)=>({...item,itemId,uid:index+2,value:item.value+24}))].map(item=>({...item,shapeVersion:1,acquiredRun:0}));
  state.nextUid=6;state.cargoGrid.placements=model.Cargo.solve(state.cargo,[],model.cargoSpace(state));model.assertState(state);
  const get=()=>state;
  const act=(type,extra={})=>{const result=model.dispatch(state,{type,...extra});assert(result.ok,result.message);state=result.state;};
  if(!['ordinary','keep'].includes(style))market(model,get,act,style,stats);
  if(style!=='keep'&&state.cargo.length){act('sellAll');stats.commands++;}
  samples.push(state.money-27049);
  if(version==='v051')assert(state.market.offers.length<=1);
 }
 const mean=samples.reduce((sum,value)=>sum+value,0)/samples.length;
 const quoteMean=stats.amounts.reduce((sum,value)=>sum+value,0)/(stats.amounts.length||1);
 report.marketLots[version+'-'+style]={seeds:512,itemsPerLot:5,ordinaryValue:438,meanActualCash:round(mean),variance:round(samples.reduce((sum,value)=>sum+(value-mean)**2,0)/samples.length),minimumCash:Math.min(...samples),maximumCash:Math.max(...samples),meanQuotes:stats.quotes/512,meanEconomicCommands:stats.commands/512,meanFees:stats.fees/512,meanQuotedAmount:round(quoteMean),accepted:stats.accepted,kept:stats.kept,noSale:stats.noSale,ordinaryFallbackItems:style==='keep'?0:5-stats.accepted/512};
}
// Same real policies with the new single opportunity, including listing fees.
report.marketVoyages={};
for(const style of['cautious','bold','auction']){
 const stats={commands:0,quotes:0,accepted:0,kept:0,noSale:0,fees:0,amounts:[]};const rows=[];
 for(const [name,policy]of Object.entries(policies))for(let seed=1;seed<=12;seed++)rows.push(...play(seed,policy,120,12,E,{onReturn:(model,get,act)=>market(model,get,act,style,stats)}).rows);
 report.marketVoyages[style]={voyages:rows.length,meanNetCash:round(rows.reduce((sum,row)=>sum+row.netCash,0)/rows.length),meanQuotes:round(stats.quotes/rows.length),meanFees:round(stats.fees/rows.length),meanEconomicCommands:round(stats.commands/rows.length)};
}
for(const [name,policy]of Object.entries(policies).slice(0,4)){
 const rows=[];
 for(let seed=1;seed<=8;seed++){
  let firstPaidOff=null,returned=0;
  const run=play(seed,policy,120,80,E,{afterPrepare:(model,get,act)=>{returned++;while(get().debt&&get().money>=400+Math.min(100,get().debt))act('repay',{amount:100});if(!get().debt&&firstPaidOff===null)firstPaidOff=returned;}});
  rows.push({seed,firstPaidOff,debtAfter80:run.final.debt,cashAfter80:run.final.money});
 }
 report.debtRepayment[name]=rows;
}
let old=O.create(19);old.money=55499;
const oldAct=(type,extra={})=>{const result=O.dispatch(old,{type,...extra});assert(result.ok,result.message);old=result.state;};
for(const id of Object.keys(O.PORT.ships)){if(id!=='starter'){oldAct('buyShip',{id});oldAct('equipShip',{id});}while(O.cargoUpgradeQuote(old).cost!==null)oldAct('upgradeCargo');for(const kind of['fuel','hull'])while(O.shipUpgradeQuote(old,kind).cost!==null)oldAct('upgradeShip',{kind});}
assert.equal(old.money,27049);const next=E.restore(old);for(const key of['money','debt','fleet','cargo','cargoGrid','tools','ledger'])assert.deepEqual(JSON.parse(JSON.stringify(next[key])),JSON.parse(JSON.stringify(old[key])));
report.oldWallet={opening:27049,afterMigration:next.money,debt:next.debt,paidRightsPreserved:true,ledgerPreserved:true};
report.config=JSON.parse(JSON.stringify(E.V051));
for(const file of inputFiles)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file.path))).digest('hex'),file.sha256,'Input changed during economic replay: '+file.path);
report.inputFiles=inputFiles;
const output=path.resolve(__dirname,'../../../releases/v051-economy.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({comparison:Object.fromEntries(Object.entries(report.comparisons).map(([key,versions])=>[key,Object.fromEntries(Object.entries(versions).map(([name,row])=>[name,{cash:row.meanNetCash,depth:row.meanDepth,returnFuel:row.meanActualReturnFuel,gates:row.gate3+row.gate5,rescues:row.rescues}]))])),marketLots:report.marketLots,marketVoyages:report.marketVoyages,oldWallet:report.oldWallet},null,2));
