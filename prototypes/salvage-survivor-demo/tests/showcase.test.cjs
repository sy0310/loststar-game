/* Real combat functions in the existing unit adapter. Rendered geometry has HTTP tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createModel } = require('./model-harness.cjs');
const output = path.resolve(process.env.SURVIVOR_MODEL_OUT || 'releases/survivor-v065-model.json');
(async () => {
  const context = await createModel();
  const Q = context.SurvivorQA;
  const report = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output)) : {passed:0,cases:[],errors:[]};
  function start() {
    const game=Q.startModel(91);game.active={};game.spawnTime=9999;game.p.inv=10000;game.encounters.schedule=[];return game;
  }
  function equip(id) {for(let i=0;i<5;i++)assert(Q.pick(id));}
  function evolve(id,passive,result) {equip(id);equip(passive);Q.reward(true);assert(Q.pick(result));}
  async function test(name,run) {
    try {const detail=await run();report.passed++;report.cases.push({name:'v065 '+name,detail:detail||null});console.log('PASS v065',name);}
    catch(error){report.errors.push({name:'v065 '+name,message:error.stack});console.error('FAIL v065',name,error.message);process.exitCode=1;}
  }
  await test('new fifteen-minute runs have independently saved version4 combat',()=>{
    const game=start();assert.equal(game.rules.combatVersion,4);assert.equal(game.endTime,900);
  });
  await test('actual drone and crystal launch origins occupy distinct inner and outer bands',()=>{
    const game=start();assert(Q.pick('drone'));assert(Q.pick('prism'));Q.enemy('skimmer',0,-220,100000);Q.step(.001);
    const drone=game.shots.find(s=>s.kind==='drone');const crystal=game.shots.find(s=>s.kind==='crystal');assert(drone&&crystal);
    const outer=Math.hypot(drone.x-game.p.x,drone.y-game.p.y);const inner=Math.hypot(crystal.x-game.p.x,crystal.y-game.p.y);
    assert(outer>100,'Drone outer band '+outer);assert(inner<62,'Crystal inner band '+inner);assert(outer-inner>45);
    return {outer,inner};
  });
  await test('legal final cannon fusion emits a dedicated saved visual beam source',()=>{
    const game=start();evolve('cannon','lens','piercebeam');evolve('shield','armor','reactiveaegis');Q.reward(true);assert(Q.pick('ionbastion'));
    Q.enemy('skimmer',0,-180,100000);Q.step(.001);assert(game.beams.length);assert.equal(game.beams[0].source,'ionbastion');assert(game.beams[0].t>.2);
    assert(game.metrics.damage.ionbastion>0);return {beam:game.beams[0]};
  });
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
