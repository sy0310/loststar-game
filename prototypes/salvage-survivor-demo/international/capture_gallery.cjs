/* Staged legal snapshots run through the unchanged player entry in private profiles. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve('releases/survivor-global-private/gallery');
const url = process.env.SURVIVOR_URL || 'http://127.0.0.1:4460/';
const build = JSON.parse(fs.readFileSync('releases/survivor-global/web-build-info.json'));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const report = { source: null, scope: 'Frozen international English runtime, same web payload bundled in the signed Android APK. Legal equipment and encounter snapshots prepared in QA, validated, then resumed using normal player entry in isolated fresh profiles. No user profile, runtime, image content, actor HP, speed, shot damage or VFX edited. Actual automatic combat and card draw. Not a natural-progression record.', scenes: [], errors: [] };
  try {
    const setup = await browser.newContext({ viewport:{width:390,height:844},hasTouch:true });
    const q = await setup.newPage();
    q.on('pageerror',e=>report.errors.push(String(e)));
    await q.goto(url+'?qa=1');
    await q.waitForFunction(()=>SurvivorDemo.ready());
    report.source = await q.evaluate(()=>SurvivorBuild);
    assert.equal(report.source.commit, build.sourceCommit);
    assert.equal(report.source.dirty, false);
    assert.equal(await q.evaluate(() => SurvivorI18n.getLocale()), 'en');
    for (const scene of ['horde','lightning','railboss','vortex','weapon-choice','fusion-choice']) {
      const fixture = await q.evaluate(scene => {
        const Q=SurvivorQA, g=Q.startModel(87);
        g.spawnTime=9999;
        g.encounters.schedule=[];
        g.anomalySeen=true;
        g.milestoneSeen=SurvivorBalance.showcase.milestones.map(m=>m.type+':'+m.at);
        function pick(id){if(!Q.pick(id))throw Error('Illegal equipment '+id);}
        function rank(id,n){while((g.active[id]||g.passive[id]||0)<n)pick(id);}
        function evolve(w,p,e){rank(w,5);rank(p,5);Q.reward(true);pick(e);}
        function fuse(a,p,e,b,pb,eb,f){evolve(a,p,e);evolve(b,pb,eb);Q.reward(true);pick(f);}
        if(scene==='lightning') {
          fuse('arc','capacitor','chainstorm','drone','lock','hunterswarm','thunderhive');
          rank('cannon',3);rank('prism',3);rank('blade',3);g.time=705;
        } else if(scene==='railboss') {
          fuse('cannon','lens','piercebeam','shield','armor','reactiveaegis','ionbastion');
          evolve('missile','cooler','meteorbarrage');rank('drone',2);rank('prism',2);g.time=860;
        } else if(scene==='vortex'||scene==='fusion-choice') {
          evolve('prism','refraction','kaleidoscope');evolve('gravity','singularity','collapse');
          rank('cannon',3);rank('missile',3);rank('drone',2);g.time=675;
          if(scene==='vortex'){Q.reward(true);pick('eventhorizon');rank('blade',3);}
        } else {
          rank('cannon',3);rank('arc',3);rank('drone',2);rank('blade',2);rank('prism',2);
          rank('lens',2);rank('capacitor',2);rank('lock',2);g.time=270;
        }
        const level=1+g.metrics.events.filter(e=>['active','passive','evo','fusion'].includes(e.kind)).length;
        while(g.level<level)Q.level();
        g.mode='play';g.presented=[];g.upgradeSource=null;g.celebration=null;g.p.inv=0;g.p.hp=g.p.maxhp;
        if(scene==='fusion-choice'){
          Q.reward(true);
          if(!g.presented.some(o=>o.id==='eventhorizon'))throw Error('Fusion not legitimately offered');
        } else if(scene==='weapon-choice') {
          Q.level();
        } else {
          const types=['skimmer','ranger','wisp','tank','lancer','sentinel','minelayer'];
          for(let i=0;i<25;i++){
            const enemy=Q.spawn(types[i%types.length]);
            const ring=i%2?210:275, a=(i/25)*Math.PI*2;
            enemy.x=Math.cos(a)*Math.min(175,ring);
            enemy.y=Math.sin(a)*ring+50;
            if(Math.hypot(enemy.x,enemy.y)<110)enemy.y+=130;
            enemy.fire=.1+(i%5)*.14;
          }
          if(scene!=='horde') {
            const profile=scene==='railboss'?'judicator':scene==='vortex'?'ark':'weaver';
            const boss=Q.spawn('boss',scene==='railboss'?4:scene==='vortex'?3:2,'hunter',profile);
            boss.x=scene==='railboss'?25:-40;boss.y=-145;boss.fire=.1;
          }else{
            const elite=Q.spawn('elite',2,'reaver');elite.x=95;elite.y=-180;elite.fire=.15;
          }
        }
        const snapshot=Q.snapshot();Q.validate(snapshot);
        return { snapshot, active:g.active, passive:g.passive,evolved:g.evolved,fused:g.fused, cards:g.presented, enemyCount:g.enemy.length };
      },scene);
      const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
      const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
      await page.goto(url);await page.waitForFunction(()=>SurvivorDemo.ready());
      assert(await page.evaluate(()=>!window.SurvivorQA));
      await page.evaluate(async snapshot=>{const store=await SurvivorPersistence.create();await store.begin('gallery-'+crypto.randomUUID(),snapshot);store.close();},fixture.snapshot);
      await page.reload();await page.waitForFunction(()=>SurvivorDemo.ready());
      await page.locator('#continueBtn').tap();
      if(scene.endsWith('choice')){
        await page.waitForFunction(() => !SurvivorDemo.saving());
        await page.waitForTimeout(250);
        await page.screenshot({path:path.join(out,scene+'.png')});
        report.scenes.push({scene,file:scene+'.png',fixture,actual:await page.evaluate(()=>SurvivorDemo.state())});
      }else{
        for(let i=0;i<4;i++){
          await page.waitForTimeout(i===0?450:300);
          await page.screenshot({path:path.join(out,scene+'-'+i+'.png')});
          const actual=await page.evaluate(()=>{const g=SurvivorDemo.state();return{mode:g.mode,time:g.time,hp:g.p.hp,kills:g.kills,enemies:g.enemy.length,enemyShots:g.enemyShots.length,beams:g.beams.length,arcs:g.arcs.length,wells:g.wells.length,damage:g.metrics.damage};});
          report.scenes.push({scene,file:scene+'-'+i+'.png',fixture:{active:fixture.active,evolved:fixture.evolved,fused:fixture.fused,enemyCount:fixture.enemyCount},actual});
        }
      }
      await context.close();
    }
    await setup.close();
    assert.deepEqual(report.errors,[]);
    fs.writeFileSync(path.join(out,'capture-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('Captured18 actual player-entry gallery candidates');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
