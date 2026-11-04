import {chromium,webkit} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {openReview,click,readArchive,oldDatabase} from './refinement_browser_helpers.mjs';
const base=process.env.BASE_URL??'http://127.0.0.1:4185/loststar-fusion/index.html';
const info=JSON.parse(readFileSync('releases/taptap/package-info-fusion.json','utf8'));
const results=[];
for(const [name,type,width]of[['chromium360',chromium,360],['chromium390',chromium,390],['webkit390',webkit,390]]){
 const browser=await type.launch();
 try{
  const context=await browser.newContext({viewport:{width,height:width===360?800:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
  const build=await page.locator('.fu-build').textContent();
  if(!build.includes(info.sourceCommit.slice(0,7)))throw Error('Package SHA mismatch');
  await page.locator('#fusion-upgrades').tap();await page.locator('[data-upgrade="scanner"]').tap();await page.locator('#fusion-close').tap();
  await page.waitForTimeout(13000);
  await page.locator('[data-tab="collection"]').tap();await page.locator('#fusion-collection-list [data-detail="receipt"]').tap();
  await page.locator('#fusion-paper-primary').tap();await page.waitForTimeout(6800);await page.locator('#fusion-try').tap();
  await page.waitForTimeout(400);
  await page.reload();await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
  const state=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open(window.__FUSION__.databaseName,1);r.onsuccess=()=>{const db=r.result,g=db.transaction('archive','readonly').objectStore('archive').get('current');g.onsuccess=()=>{resolve(g.result);db.close();};};}));
  if(state.game.upgrades.scanner!==1||!state.game.collection.includes('receipt')||state.receipt.condition!=='found')throw Error('Saved play flow failed');
  const noSpoiler=!/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗/.test(await page.locator('body').ariaSnapshot());
  if(!noSpoiler||errors.length)throw Error(JSON.stringify(errors));
  results.push({name,build,upgrade:state.game.upgrades.scanner,receipt:state.receipt.condition,balance:state.game.resources,originalSave:await page.evaluate(()=>localStorage.getItem('loststar.save.v1')),noSpoiler,errors});

  await context.close();
  const migrated=await openReview(browser,base,{fixture:'full',levels:[0,0],width,legacy:true});
  const before=await readArchive(migrated.page);
  const original=await readArchive(migrated.page,oldDatabase);
  const rawLegacy=await migrated.page.evaluate(()=>localStorage.getItem('loststar.save.v1'));
  await click(migrated.page,'[data-tab="collection"]');
  await click(migrated.page,'#fusion-collection-list [data-detail="tape"]');
  await click(migrated.page,'#fusion-ability-upgrade');
  await migrated.page.reload();await migrated.page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
  const after=await readArchive(migrated.page);
  const originalUnchanged=JSON.stringify(original)===JSON.stringify(await readArchive(migrated.page,oldDatabase));
  const legacyUnchanged=rawLegacy===await migrated.page.evaluate(()=>localStorage.getItem('loststar.save.v1'));
  const paid=after.progression.payments.find(payment=>payment.id==='ability/tape/1');
  if(before.game.resources!==27049||after.progression.abilities.tape!==1||paid?.amount!==240||!originalUnchanged||!legacyUnchanged||migrated.errors.length)throw Error('Packaged migration failed');
  results.push({name:`${name}-old27049`,build,originalUnchanged,legacyUnchanged,initial:before.game.resources,payment:paid,level:after.progression.abilities.tape,errors:migrated.errors});
  await migrated.context.close();
 }finally{await browser.close();}
}
writeFileSync('artifacts/refinement/package-smoke.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),base,package:info,method:'Real wall-clock native-touch Chromium/WebKit desktop mobile emulation, relative-path release package. Upgrade, discovery, excavate, interaction, reload persistence and read-only27049 migration with actual new ability payment; physical TapTap validation pending.',results},null,2)+'\n');console.log(JSON.stringify(results));
