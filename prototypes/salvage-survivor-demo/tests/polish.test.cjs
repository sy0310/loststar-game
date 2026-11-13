/* v068 requested regression gates, exercising the real combat controller. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createModel} = require('./model-harness.cjs');
(async () => {
  const context = await createModel(), Q = context.SurvivorQA;
  context.SurvivorArt.frameAt = () => 0;
  const file = path.resolve(process.env.SURVIVOR_MODEL_OUT || 'releases/survivor-v068-model.json');
  const report = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {passed:0,cases:[],errors:[]};
  function start(perks={}) {
    const g=Q.startModel(91,perks);
    g.active={}; g.spawnTime=9999; g.p.inv=9999; g.encounters.schedule=[];
    return g;
  }
  async function test(name,run) {
    try {const detail=await run();report.passed++;report.cases.push({name:'v068 '+name,detail:detail||null});console.log('PASS v068',name);}
    catch(error){report.errors.push({name:'v068 '+name,message:error.stack});console.error('FAIL v068',name,error.message);process.exitCode=1;}
  }
  function crystal(g,distance) {const p={x:g.p.x+distance,y:g.p.y,t:20,type:'xp',value:1};g.pickups.push(p);return p;}
  function evolve(w,p,e) {
    for(let i=0;i<5;i++){assert(Q.pick(w));assert(Q.pick(p));}
    Q.reward(true);assert(Q.pick(e));
  }
  function fuse(a,pa,ea,b,pb,eb,id){evolve(a,pa,ea);evolve(b,pb,eb);Q.reward(true);assert(Q.pick(id));}
  await test('new runs save version7 while v067 snapshots remain valid',()=>{
    const g=start();assert.equal(g.rules.combatVersion,7);Q.validate(Q.snapshot());
    g.rules.version='0.6.7';g.rules.combatVersion=6;Q.validate(Q.snapshot());
  });
  await test('fresh zero-upgrade ship attracts experience before physical contact',()=>{
    const g=start(),p=crystal(g,180),x=p.x;Q.step(0.05);assert(p.magnetized&&p.x<x,'crystal at180 must begin following');
    assert(g.p.x===0&&g.xp===0,'range pulls first, it does not award distant XP');Q.step(1);assert.equal(g.xp,1);
  });
  await test('initial attraction is bounded, engineering still extends it, old rule6 retains150',()=>{
    let g=start(),p=crystal(g,250);Q.step(.05);assert(!p.magnetized);
    g=start({engineering:{version:1,thrusters:0,salvage:6,plating:0}});p=crystal(g,225);Q.step(.05);assert(p.magnetized);
    g=start();g.rules.combatVersion=6;g.rules.version='0.6.7';p=crystal(g,180);Q.step(.05);assert(!p.magnetized);
  });
  await test('new prices span multiple real runs and keep all original effect caps',()=>{
    const B=context.SurvivorBalance;assert.deepEqual(Array.from(B.permanentCosts.hull),[400,1000,1800]);
    assert.deepEqual(Array.from(B.permanentCosts.gun),[500,1200,2100]);
    assert.equal(Array.from(B.engineering.costs).reduce((a,b)=>a+b,0),12150);
    assert.equal(B.engineering.maxLevel,6);assert.equal(B.engineering.launchCost,200);
    assert.equal(B.permanentMaxLevel,3);assert.equal(B.engineering.magnetPerLevel,8);
  });
  await test('star-ring singularity draws an independent core and accretion structure',()=>{
    const g=start();fuse('prism','refraction','kaleidoscope','gravity','singularity','collapse','eventhorizon');
    Q.enemy('tank',180,0,1e7);Q.step(.01);assert(g.wells.some(w=>w.fused));
    const calls=[];context.SurvivorArt.draw=(ctx,id,x,y,options)=>calls.push({id,x,y,options});Q.runRender();
    assert(calls.some(x=>x.id==='eventhorizon_core'),'fusion needs its own physical core');
    assert(calls.some(x=>x.id==='eventhorizon_ring'),'independently rotating accretion ring');
    assert(g.metrics.damage.eventhorizon>0);Q.validate(Q.snapshot());
    return {well:g.wells[0],uniqueArt:[...new Set(calls.map(x=>x.id))]};
  });
  await test('lightning fleet and explosive blades have separate physical fusion hardware',()=>{
    const g=start();fuse('drone','lock','hunterswarm','arc','capacitor','chainstorm','thunderhive');
    fuse('missile','cooler','meteorbarrage','blade','magnet','spiralsaw','blastwheel');
    Q.enemy('tank',150,0,1e7);Q.step(.05);
    const calls=[];context.SurvivorArt.draw=(ctx,id)=>calls.push(id);Q.runRender();
    assert(calls.includes('thunder_relay'));assert(calls.includes('blastwheel_hub'));
    assert(g.shots.some(s=>s.source==='thunderhive'||s.kind==='hive'));
    Q.validate(Q.snapshot());
  });
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2));
})();
