import {chromium, webkit} from '@playwright/test';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {openReview, click, terrainTap, readArchive, oldDatabase} from './refinement_browser_helpers.mjs';
import {freshReviewFixture} from '../releases/refinement-fixtures/refinement_fixtures.js';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4207';
const output = process.env.OUTPUT_DIR ?? 'artifacts/refinement';
const requested = (process.env.CAPTURE_GROUPS ?? 'input,comparison,museum,abilities,evidence,branch,night,cycle,layouts').split(',');
mkdirSync(output, {recursive:true});
const source = JSON.parse(readFileSync('releases/taptap/package-info-fusion.json', 'utf8')).sourceCommit;
const verificationCommit = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser = await chromium.launch();
const entries = [], shots = [], videos = [], errors = [];
async function open(name, options = {}, engine = browser) {
  const session = await openReview(engine, base, {...options, output, record:true});
  const {page, context} = session;
  const started = Date.now();
  const build = await page.locator('.fu-build').textContent();
  if (!build.includes(source.slice(0,7))) throw Error('Captured package SHA mismatch');
  const states = [];
  const initial = await readArchive(page);
  const old = options.legacy ? await readArchive(page, oldDatabase) : null;
  const legacy = await page.evaluate(() => localStorage.getItem('loststar.save.v1'));
  async function shot(label) {
    await page.screenshot({scale:'css',path:`${output}/${label}.png`});
    shots.push({file:`${label}.png`,context:name,at:Date.now()-started,width:options.width??390,height:options.width===360?800:844});
    const state = await readArchive(page);
    const visual = await page.evaluate(() => Object.fromEntries(
      [...document.querySelectorAll('#fusion-world canvas,#museum-canvas,#fusion-paper-focus,#fusion-exhibit-focus')]
        .map(canvas => [canvas.id || 'world', {...canvas.dataset}])));
    states.push({label,worldMs:state.game.world.elapsedMs,cycles:state.game.cycles,balance:state.game.resources,
      gross:state.game.station.grossIncome,maintenance:state.game.station.repairSpent,progression:state.progression,visual});
  }
  async function close(videoName) {
    const final = await readArchive(page);
    const ui = await page.evaluate(() => window.__FUSION__.uiMetrics());
    const feedback = await page.evaluate(() => window.__FUSION__.feedbackMetrics());
    const originalUnchanged = !options.legacy || JSON.stringify(old) === JSON.stringify(await readArchive(page,oldDatabase));
    const localStorageUnchanged = legacy === await page.evaluate(() => localStorage.getItem('loststar.save.v1'));
    const raw = await page.video().path();
    entries.push({name,fixture:options.fixture??'fresh player',levels:options.levels??[2,2],engine:engine===browser?'chromium':'webkit',
      width:options.width??390,build,wallMs:Date.now()-started,initial,final,states,ui,feedback,originalUnchanged,localStorageUnchanged,errors:session.errors});
    errors.push(...session.errors);
    if (!originalUnchanged || !localStorageUnchanged) errors.push(`${name} changed original archive`);
    await context.close();
    videos.push({raw,file:`${videoName}.mp4`,context:name});
    console.log(`captured ${name}`);
  }
  return {page,shot,close,started,initial};
}
async function top(page) {
  await page.locator('#fusion-drawer').evaluate(node => node.scrollTo(0,0));
  await page.waitForTimeout(150);
}
async function waitPhase(page, phase, stage, timeout=60000) {
  const began=Date.now();
  while(Date.now()-began<timeout) {
    const value=(await readArchive(page)).progression.sorting;
    if(value.phase===phase&&(!stage||value.stage===stage)) return;
    await page.waitForTimeout(250);
  }
  throw Error(`Timed out waiting ${phase}/${stage??''}`);
}
async function input(width) {
  const run=await open(`input-${width}`,{width});
  const {page,shot}=run;
  await shot(`${width}-explore`);
  await terrainTap(page);await page.waitForTimeout(130);await shot(`${width}-accepted-contact`);await page.waitForTimeout(600);
  for(let i=0;i<4;i++) {await terrainTap(page);await page.waitForTimeout(700);}
  for(let i=0;i<5;i++) {await terrainTap(page);await page.waitForTimeout(100);}
  await shot(`${width}-assist-feedback`);
  await page.waitForTimeout(1300);
  await terrainTap(page);await page.waitForTimeout(180);await shot(`${width}-assist-work`);
  await page.waitForTimeout(13000);
  await shot(`${width}-real-unload`);
  await click(page,'#fusion-wallet');await shot(`${width}-wallet`);
  await click(page,'#fusion-close');await click(page,'#fusion-upgrades');await shot(`${width}-upgrades`);
  await run.close(`touch-feedback-${width}`);
}
async function museum() {
  const run=await open('museum-live',{fixture:'full',levels:[2,2]});
  const {page,shot,started}=run;
  await click(page,'[data-tab="base"]');await shot('390-base');
  for(const at of [6000,14000,22000,35000,42000,49000,52000,65000,78000,85000]){
    await page.waitForTimeout(Math.max(0,started+at-Date.now()));await shot(`museum-${at/1000}`);
  }
  await click(page,'[data-tab="collection"]');await shot('390-collection');
  for(const id of ['receipt','tape','nested','stamp','cosmic-parcel','bell']) {
    await click(page,`#fusion-collection-list [data-detail="${id}"]`);
    await page.waitForTimeout(700);await shot(`closeup-${id}`);
    await click(page,'#fusion-try');await top(page);await page.waitForTimeout(700);await shot(`try-${id}`);
    await page.waitForTimeout(2200);await click(page,'#fusion-close');
  }
  await run.close('museum-robot-six-curios-live');
}
async function comparison() {
  const startTime=Date.now();
  const initialState=freshReviewFixture(startTime);
  const idle=await open('comparison-idle',{initialState,startTime});
  const active=await open('comparison-active',{initialState,startTime});
  if(JSON.stringify(idle.initial)!==JSON.stringify(active.initial))throw Error('Comparison initial archives differ');
  await idle.shot('comparison-idle-start');await active.shot('comparison-active-start');
  await Promise.all([idle.page.clock.resume(),active.page.clock.resume()]);
  const began=Date.now();
  while(Date.now()-began<60000){await terrainTap(active.page);await active.page.waitForTimeout(1000);}
  await active.page.waitForTimeout(700);
  await idle.shot('comparison-idle-end');await active.shot('comparison-active-end');
  const passive=await readArchive(idle.page), assisted=await readArchive(active.page);
  const work=assisted.game.assist;
  if(work.appliedWorkMs>work.enqueuedWorkMs+.01||assisted.game.cycles<passive.game.cycles)throw Error('Comparison work ledger mismatch');
  await idle.close('idle-same-save-60s-live');await active.close('assist-same-save-60s-live');
}
async function abilities(id) {
  const run=await open(`${id}-growth`,{fixture:'full',levels:[0,0]});
  const {page,shot}=run;
  await click(page,'[data-tab="collection"]');
  await click(page,`#fusion-collection-list [data-detail="${id}"]`);
  await page.waitForTimeout(1300);await shot(`${id}-ability-0`);
  await click(page,'#fusion-try');await top(page);await page.waitForTimeout(1300);await shot(`${id}-try-0`);
  for(const level of [1,2]) {
    await click(page,'#fusion-ability-upgrade');await shot(`${id}-ability-${level}-cost`);await top(page);
    await page.waitForFunction(id=>Number(document.querySelector(id==='receipt'?'#fusion-paper-focus':'#fusion-exhibit-focus')?.dataset.abilityExtension)>.92,id,{timeout:15000});
    await shot(`${id}-ability-${level}`);
    await click(page,'#fusion-try');await top(page);await page.waitForTimeout(1400);await shot(`${id}-try-${level}`);
    await page.waitForTimeout(2500);
  }
  await run.close(`${id}-paid-ability-growth-live`);
}
async function actualEvidence() {
  const run=await open('actual-receipt-evidence',{fixture:'verify'});
  const {page,shot}=run;
  await page.waitForTimeout(1200);await shot('receipt-source-labels-world');
  await click(page,'[data-tab="collection"]');await click(page,'#fusion-collection-list [data-detail="receipt"]');
  await page.waitForFunction(()=>Number(document.querySelector('#fusion-paper-focus')?.dataset.abilityExtension)>.92,undefined,{timeout:15000});
  await shot('receipt-actual-two-records');await click(page,'#fusion-try');await top(page);await page.waitForTimeout(1200);await shot('receipt-actual-comparison');
  await page.waitForTimeout(3000);await run.close('receipt-real-field-records-live');
}
async function branch() {
  const run=await open('sorting-live',{fixture:'full',levels:[1,1],legacy:false});
  const {page,shot}=run;
  await shot('sorting-discovered');await click(page,'#fusion-wallet');await click(page,'#fusion-open-sorting');await shot('sorting-observed-ui');
  await click(page,'[data-refinement="main"]');await page.waitForTimeout(1700);await shot('sorting-survey');
  await waitPhase(page,'surveyed');await click(page,'#fusion-wallet');await click(page,'#fusion-open-sorting');await shot('sorting-build-quote');
  await click(page,'[data-refinement="main"]');await page.waitForTimeout(2000);await shot('sorting-construction');
  await waitPhase(page,'ready');await click(page,'#fusion-wallet');await click(page,'#fusion-open-sorting');await shot('sorting-ready-ui');
  await click(page,'[data-refinement="main"]');await page.waitForTimeout(3500);await shot('sorting-hauling');
  await waitPhase(page,'working','verify');await page.waitForTimeout(1700);await shot('sorting-actual-label');
  await click(page,'#fusion-wallet');await click(page,'#fusion-open-sorting');await shot('sorting-compare-ui');
  await click(page,'[data-refinement="compare"]');await shot('sorting-compared');
  await click(page,'#fusion-close');
  await waitPhase(page,'working','clear-paper');await page.waitForTimeout(1700);await shot('sorting-clearing');
  await waitPhase(page,'cleared');await shot('sorting-cleared');
  await click(page,'#fusion-wallet');await click(page,'#fusion-open-sorting');await shot('sorting-cleared-ui');
  await click(page,'[data-refinement="study"]');await page.waitForTimeout(1800);await shot('sorting-study');
  await click(page,'#fusion-wallet');await click(page,'#fusion-open-sorting');
  const cancel=page.locator('[data-cancel-sorting-study]');await cancel.scrollIntoViewIfNeeded();await cancel.tap();await shot('sorting-study-refunded');
  for (let index=0;index<3;index++) {
    await click(page,'[data-refinement="study"]');await page.waitForTimeout(2200);await shot(`sorting-study-${index+1}-scene`);
    const began=Date.now();
    while((await readArchive(page)).progression.sorting.activeStudy) {
      if(Date.now()-began>30000)throw Error('Observation study did not complete');
      await page.waitForTimeout(250);
    }
    await shot(`sorting-study-${index+1}-result`);
    await click(page,'#fusion-wallet');await click(page,'#fusion-open-sorting');
  }
  await click(page,'[data-refinement="main"]');await shot('sorting-free-record-review');
  await click(page,'#fusion-close');await page.reload();await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();await shot('sorting-permanent-refresh');
  await run.close('sorting-discovery-build-work-live');
}
async function night() {
  const run=await open('sorting-night',{fixture:'night-sorting'});
  const {page,shot,started}=run;
  for(const at of [500,8000,19000,32000,47000,54000,65000,76000]) {
    await page.waitForTimeout(Math.max(0,started+at-Date.now()));await shot(`sorting-night-${at/1000}`);
  }
  await run.close('sorting-night-defense-morning-resume-live');
}
async function cycle() {
  const run=await open('complete-cycle');
  const {page,shot,started}=run;
  for(const at of [1000,60000,229000,240500,254000,269000,287000,301000,309000]) {
    await page.waitForTimeout(Math.max(0,started+at-Date.now()));await shot(`cycle-${at/1000}`);
  }
  await run.close('complete-day-night-cycle-live');
}
async function layouts() {
  for(const width of [360,390]) {
    const engine=await webkit.launch();
    try {
      const run=await open(`webkit-${width}`,{fixture:'full',width},engine);
      const {page,shot}=run;
      await shot(`webkit-${width}-explore`);await click(page,'#fusion-map');await shot(`webkit-${width}-radar`);
      await page.waitForTimeout(3500);await click(page,'#fusion-close');
      await click(page,'[data-tab="base"]');await shot(`webkit-${width}-base`);
      await click(page,'[data-tab="collection"]');await shot(`webkit-${width}-collection`);
      await click(page,'#fusion-collection-list [data-detail="tape"]');await click(page,'#fusion-try');await top(page);await page.waitForTimeout(1400);await shot(`webkit-${width}-tape`);
      await run.close(`webkit-${width}-touch-live`);
    } finally {await engine.close();}
  }
  const run=await open('reduced-motion',{fixture:'full',reducedMotion:'reduce'});
  await click(run.page,'[data-tab="base"]');await run.page.waitForTimeout(10000);await run.shot('390-reduced-motion');
  await run.close('reduced-motion-live');
}
try {
  for(const group of requested) {
    console.log(`start ${group}`);
    if(group==='input'){await input(390);await input(360);}
    if(group==='comparison')await comparison();
    if(group==='museum')await museum();
    if(group==='abilities'){await abilities('receipt');await abilities('tape');}
    if(group==='evidence')await actualEvidence();
    if(group==='branch')await branch();
    if(group==='night')await night();
    if(group==='cycle')await cycle();
    if(group==='layouts')await layouts();
  }
} catch(error) {errors.push(error.stack??String(error));console.error(error);process.exitCode=1;}
finally {
  await browser.close();
  for(const video of videos) {
    execFileSync('ffmpeg',['-y','-i',video.raw,'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-an',`${output}/${video.file}`],{stdio:'ignore'});
    const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=width,height,r_frame_rate','-of','json',`${output}/${video.file}`],{encoding:'utf8'}));
    video.durationSeconds=Number(info.format.duration);video.bytes=Number(info.format.size);delete video.raw;
    video.streams=info.streams;
  }
  const manifest={sourceCommit:source,verificationCommit,base,method:'Uninterrupted native touchscreen-emulation recordings at normal runtime speed. Configured review fixtures are produced by real domain actions and work. The capture advances through the normal live game clock. Desktop emulation evidence only, pending physical TapTap review.',entries,shots,videos,errors};
  writeFileSync(`${output}/evidence-${requested.join('-')}.json`,JSON.stringify(manifest,null,2)+'\n');
}
