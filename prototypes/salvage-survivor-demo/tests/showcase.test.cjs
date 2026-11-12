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
    const game=start();assert.equal(game.rules.combatVersion,4);assert.equal(game.endTime,900);Q.validate(Q.snapshot());
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
  await test('new boss silhouettes and half-health patterns persist independently',()=>{
    const details=[];
    for(const [profile,first,second] of [['weaver','spiral','hook'],['ark','siege','cross'],['judicator','pincer','dualburst']]) {
      const game=start();const id=Q.enemy('boss',0,-140,10000,profile);const enemy=game.enemy.find(e=>e.id===id);
      assert.equal(enemy.bossProfile,profile);enemy.pattern=1;enemy.aim=Math.PI/2;enemy.targetX=0;enemy.targetY=0;enemy.warn=.001;
      Q.step(.01);assert(game.metrics.shots['hostile-'+first]>0,first);Q.validate(Q.snapshot());
      enemy.hp=4000;enemy.pattern=3;enemy.warn=.001;Q.step(.01);assert(game.metrics.shots['hostile-'+second]>0,second);Q.validate(Q.snapshot());
      details.push({profile,first,second});
    }return details;
  });
  await test('hive launches visible finite escorts and preserves launch budget on refresh',()=>{
    const game=start();const id=Q.enemy('elite',0,-140,10000,'hive');const enemy=game.enemy.find(e=>e.id===id);
    for(let i=0;i<5;i++){enemy.pattern=1;enemy.aim=Math.PI/2;enemy.warn=.001;Q.step(.01);Q.validate(Q.snapshot());for(const e of game.enemy)if(e.ownerId===id)e.hp=0;}
    assert.equal(enemy.summonsLeft,0);assert.equal(game.metrics.shots['hostile-escort-launched'],4);
    assert.equal(Q.snapshot().game.enemy.find(e=>e.id===id).summonsLeft,0);
  });
  await test('pincer leaves its center safe and damages a player in the closing wall',()=>{
    for(const [x,expected] of [[0,false],[86,true]]) {
      const game=start();game.p.inv=0;const hp=game.p.hp;game.p.x=x;
      game.hazards=[{kind:'pincer',x:0,y:0,heading:Math.PI/2,age:1.1,duration:2.6,warning:1.1,damage:9}];
      Q.step(.02);assert.equal(game.p.hp<hp,expected);Q.validate(Q.snapshot());
    }
  });
  await test('siege rounds detonate once at their locked destination and survive snapshot validation',()=>{
    const game=start();const id=Q.enemy('boss',0,-140,10000,'ark');const enemy=game.enemy.find(e=>e.id===id);
    enemy.pattern=1;enemy.aim=Math.PI/2;enemy.targetX=0;enemy.targetY=0;enemy.warn=.001;Q.step(.01);
    assert(game.enemyShots.some(s=>s.kind==='siege'));Q.validate(Q.snapshot());Q.step(2);
    assert.equal(game.metrics.shots['hostile-siege-detonation'],3);const count=game.metrics.shots['hostile-siege-detonation'];Q.step(.5);assert.equal(game.metrics.shots['hostile-siege-detonation'],count);
  });
  await test('all five elites and legacy combat3 remain valid without rewriting old rules',()=>{
    const game=start();for(const profile of ['hunter','raider','warden','reaver','hive'])Q.enemy('elite',0,-140,10000,profile);Q.validate(Q.snapshot());
    const legacy=start();Q.legacyV064();assert.equal(legacy.rules.combatVersion,3);Q.validate(Q.snapshot());
  });
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
