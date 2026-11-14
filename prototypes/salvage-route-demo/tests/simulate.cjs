/* Developer-only policy comparison, never included in the blind player package. */
const E=require('../src/engine.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const policies={cautious:{limit:3,fuel:60,hull:90,reserve:200,tools:false},cargo:{limit:4,fuel:80,hull:90,reserve:250,tools:false},deep:{limit:8,fuel:100,hull:100,reserve:300,tools:false},equipped:{limit:5,fuel:80,hull:90,reserve:600,tools:true}};
const results={scope:'Deterministic scripted policies using legal actual transactions. Not human choice, optimum, enjoyment or balance acceptance.',seeds:32,maximumVoyages:80,policies:{}};
function play(seed,p){
 let s=E.create(seed),totals={eventIncome:0,reward:0,sales:0,eventSpent:0,supplySpent:0,repairSpent:0,rescueFee:0,toolSpent:0,debtPaid:0,forwardFuel:0,returnFuel:0,eventFuelSpent:0,eventFuelGained:0,portFuelGained:0,rescues:0,aid:0,depth:0},voyages=[];
 function act(type,extra={}){const r=E.dispatch(s,{type,...extra});assert(r.ok,r.message);const next=r.state;for(const row of next.ledger.filter(x=>x.seq===next.seq)){if(row.kind==='sale')totals.sales+=row.delta;else totals[row.kind]+=Math.abs(row.delta);}if(type==='travel')totals.forwardFuel+=s.fuel-next.fuel;if(type==='buyFuel')totals.portFuelGained+=next.fuel-s.fuel;if(type==='choose'){const e=E.encounter(s).choices.find(c=>c.id===extra.id).effect;let fuel=s.fuel;for(const delta of[e.fuel||0,e.bonusFuel||0]){const after=Math.max(0,Math.min(100,fuel+delta));if(after<fuel)totals.eventFuelSpent+=fuel-after;else totals.eventFuelGained+=after-fuel;fuel=after;}}if(type==='return')totals.returnFuel+=E.returnQuotes(s).find(q=>q.method===(extra.method||'normal')).cost;if(type==='aid')totals.aid++;s=next;E.assertState(s);}
 for(let run=0;run<results.maximumVoyages&&s.debt;run++){
  if(s.phase==='summary')act('port');if(E.cargoValue(s))act('sellAll');
  if(p.tools)for(const id of['scanner','winch'])if(!s.tools.includes(id)&&s.money>=E.BALANCE.tools[id]+200)act('tool',{id});
  while(s.fuel<p.fuel&&E.portQuote(s,'buyFuel').amount)act('buyFuel');
  while(s.hull<p.hull&&E.portQuote(s,'repair').amount)act('repair');
  if(E.preparation(s).needsAid)act('aid');
  while(s.money>=p.reserve+Math.min(100,s.debt)&&s.debt)act('repay',{amount:100});
  if(!s.debt)break;
  act('depart');let actions=0;
  while(['route','event','result'].includes(s.phase)&&actions++<80){
   if(s.phase==='route'){
    const valid=s.route.filter(r=>E.quote(s,r).enabled);
    if(s.depth>=p.limit||!valid.length||s.depth>0&&s.hull<26||s.depth>=3&&E.used(s)===16){act('return',{method:E.returnQuotes(s).sort((a,b)=>a.cost-b.cost)[0].method});continue;}
    // The policy only uses visible signal, cost and risk. No future encounters or RNG peeking.
    valid.sort((a,b)=>(a.risk==='低'?-5:0)+a.fuel-((b.risk==='低'?-5:0)+b.fuel));act('travel',{id:valid[0].uid});
   }else if(s.phase==='event'){
    const choices=E.encounter(s).choices.filter(c=>!E.checkChoice(s,c));
    function score(c){const e=c.effect;return(e.money||0)+(e.loot||[]).reduce((n,x)=>n+x.value,0)+(e.fuel||0)*2+(e.bonusFuel||0)*2+(e.hull||0)*2-(c.risk?(c.risk[0]+c.risk[1]):0);}
    choices.sort((a,b)=>score(b)-score(a));act('choose',{id:choices[0].id,nonce:s.event.nonce});
   }else act('continue');
   if(['route','event','result'].includes(s.phase))assert(s.fuel>=E.safeReturnReserve(s));
  }
  assert(actions<80);assert.equal(s.phase,'summary');totals.rescues+=Number(s.summary.rescue);const depth=s.depth;totals.depth+=depth;
  if(E.cargoValue(s))act('sellAll');act('port');
  // Pay for actual post-voyage preparation before reporting the row.
  while(s.fuel<p.fuel&&E.portQuote(s,'buyFuel').amount)act('buyFuel');while(s.hull<p.hull&&E.portQuote(s,'repair').amount)act('repair');
  while(s.money>=p.reserve+Math.min(100,s.debt)&&s.debt)act('repay',{amount:100});
  voyages.push({run:s.runNo,depth,cash:s.money,unsold:E.cargoValue(s),debt:s.debt,fuel:s.fuel,hull:s.hull,...totals});
 }
 assert.equal(s.money,120+totals.eventIncome+totals.reward+totals.sales-totals.eventSpent-totals.supplySpent-totals.repairSpent-totals.rescueFee-totals.toolSpent-totals.debtPaid);
 return{seed,paidOff:!s.debt,voyages:voyages.length,final:{cash:s.money,unsold:E.cargoValue(s),debt:s.debt,fuel:s.fuel,hull:s.hull},totals,checkpoints:voyages.filter(x=>[1,2,5,10,20,40,80].includes(x.run))};
}
for(const[name,p]of Object.entries(policies)){const runs=Array.from({length:results.seeds},(_,i)=>play(i+1,p));const mean=k=>+(runs.reduce((n,x)=>n+x.totals[k],0)/runs.length).toFixed(2);results.policies[name]={policy:p,completedDebt:runs.filter(x=>x.paidOff).length,meanDepth:+(runs.reduce((n,x)=>n+x.totals.depth,0)/runs.reduce((n,x)=>n+x.voyages,0)).toFixed(2),meanVoyages:+(runs.reduce((n,x)=>n+x.voyages,0)/runs.length).toFixed(2),meanFinalDebt:+(runs.reduce((n,x)=>n+x.final.debt,0)/runs.length).toFixed(2),meanActualCash:runs.reduce((n,x)=>n+x.final.cash,0)/runs.length,meanTotals:Object.fromEntries(Object.keys(runs[0].totals).map(k=>[k,mean(k)])),runs};}
const out=path.join(__dirname,'../verification');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'policy-economy.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(results.policies).map(([k,{runs,...v}])=>[k,v])),null,2));
