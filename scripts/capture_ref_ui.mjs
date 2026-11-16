/** Fixed, isolated UI sample evidence. Never opens the formal Fusion database. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from '@playwright/test';
import {makeReviewFixture,referenceView} from '../releases/ref-ui-fixtures/model.js';
const root=process.cwd(),out='artifacts/ref-ui-sample',meta=JSON.parse(await fs.readFile('releases/ref-ui-package.json'));
const base=process.env.REF_UI_URL??'http://127.0.0.1:4258/loststar-ui-review/';
const sha=x=>createHash('sha256').update(x).digest('hex'),check=(x,m)=>{if(!x)throw Error(m)};
const head=()=>execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
check(head()===meta.sourceCommit,'Freeze source before sample evidence');
check(sha(await fs.readFile(meta.archive))===meta.sha256,'Frozen sample archive differs');
await fs.mkdir(out+'/screens',{recursive:true});await fs.mkdir(out+'/videos',{recursive:true});await fs.mkdir('releases/ref-ui-raw',{recursive:true});
const report={schema:1,version:meta.version,sourceCommit:meta.sourceCommit,zipSha256:meta.sha256,startedAt:new Date().toISOString(),physicalPhone:false,formalIntegration:false,
 policy:'One new/owned/night ordinary-model snapshot per exact baseline/candidate pair. Natural wall-clock advancement; shared original mountFusion, sprites, whole states and reducers. All purchases and settings remain isolated; no IDB open. Native silent 1x films; no rewards or clock overrides. Actual elapsed page/render times differ slightly between pair members and are recorded.',package:meta,pairs:[],extras:[],videos:[],screenshots:[],errors:[]};
async function png(page,file){await page.screenshot({path:out+'/'+file,scale:'css'});const raw=await fs.readFile(out+'/'+file);const row={file,bytes:raw.length,sha256:sha(raw),width:page.viewportSize().width,height:page.viewportSize().height};report.screenshots.push(row);return row;}
async function context(browser,viewport,fixture,video=false){
 const c=await browser.newContext({viewport,hasTouch:true,deviceScaleFactor:1,...(video?{recordVideo:{dir:'releases/ref-ui-raw',size:viewport}}:{})});
 await c.addInitScript(({fixture})=>{if(fixture)Object.assign(window,{__REFUI_INITIAL__:fixture});localStorage.setItem('loststar.source-sentinel','UNCHANGED');const before={...localStorage};let opens=0;const original=indexedDB.open.bind(indexedDB);indexedDB.open=function(...args){opens++;return original(...args)};Object.assign(window,{__REFUI_STORAGE__:()=>({opens,unchanged:JSON.stringify({...localStorage})===JSON.stringify(before)})});},{fixture});
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));return {c,p};
}
async function ready(p,profile,look='candidate'){
 await p.goto(base+`?profile=${profile}&look=${look}`);await p.waitForFunction(()=>!!window.__REFUI__);await p.waitForFunction(()=>document.querySelector('#fusion-world canvas')?.dataset.fusionPhase);
 const actual=await p.evaluate(()=>window.__REFUI__.build);check(actual.commit===meta.sourceCommit&&!actual.dirty,'Actual served sample source is dirty/different');
 await p.waitForTimeout(350);
}
async function info(p){return p.evaluate(()=>{const a=window.__REFUI__,g=a.state().game;return {build:a.build,initialShaInput:a.initial,state:a.state(),trace:a.trace(),storage:window.__REFUI_STORAGE__(),worldBox:document.querySelector('.fu-world-shell').getBoundingClientRect().toJSON(),canvas:{width:document.querySelector('#fusion-world canvas').width,height:document.querySelector('#fusion-world canvas').height},overflow:document.documentElement.scrollWidth>innerWidth,openLayers:document.querySelectorAll('dialog[open]').length};});}
async function assertMemory(p){const x=await info(p);check(x.storage.opens===0&&x.storage.unchanged,'Formal/preference storage touched');check(!x.overflow,'Page overflow');return x;}
for(const [engine,driver,viewport] of [['chromium',chromium,{width:360,height:800}],['chromium',chromium,{width:390,height:844}],['webkit',webkit,{width:390,height:844}],['chromium',chromium,{width:1440,height:1000}]]){
 const browser=await driver.launch();try{
  for(const [profile,view] of [['fresh','home'],['night','event'],['owned','curio']]){
   const fixture=makeReviewFixture(profile,Date.now()),initialHash=sha(JSON.stringify(fixture.state)),pair={engine,viewport,profile,view,initialHash,provenance:fixture.provenance,members:[]};report.pairs.push(pair);
   // Open both from the SAME immutable state, without granting items or editing user saves.
   for(const look of ['baseline','candidate']){
    const {c,p}=await context(browser,viewport,fixture);try{
     await ready(p,profile,look);
     if(view==='event'){await p.locator(look==='candidate'?'#refui-marker':'#fusion-observe').tap();await p.waitForTimeout(200);}
     if(view==='curio'){await p.locator('.fu-nav [data-tab="collection"]').tap();await p.locator('#fusion-collection-index summary').tap();await p.locator('#fusion-collection-list [data-detail="receipt"]').tap();await p.waitForFunction(()=>document.querySelector('#fusion-paper-focus')?.dataset.stateRenderer==='whole-image-v043');await p.waitForTimeout(150);}
     const data=await assertMemory(p);check(sha(data.initialShaInput)===initialHash,'Pair initial archive differs');const image=await png(p,`screens/${engine}-${viewport.width}-${look}-${view}-${profile}.png`);
     delete data.initialShaInput;pair.members.push({look,...data,image});
    }finally{await c.close();}
   }
  }
  const {c,p}=await context(browser,viewport,makeReviewFixture('fresh',Date.now()));try{
   await ready(p,'fresh');await p.locator('.fu-nav [data-tab="base"]').tap();await p.locator('.fu-base-grow').tap();report.extras.push({kind:'actual-upgrade-effects',engine,viewport,info:await assertMemory(p),image:await png(p,`screens/${engine}-${viewport.width}-equipment.png`)});
  }finally{await c.close();}
 }finally{await browser.close();}
}
for(const profile of ['conclusion','repeat-night','morning']){
 const browser=await chromium.launch(),fixture=makeReviewFixture(profile,Date.now());const {c,p}=await context(browser,{width:390,height:844},fixture);try{
  await ready(p,profile);await p.locator(profile==='conclusion'?'#refui-objective':'#refui-event').tap();await p.waitForTimeout(200);const actual=await assertMemory(p);report.extras.push({kind:profile,view:referenceView(actual.state),provenance:fixture.provenance,info:actual,image:await png(p,`screens/chromium-390-${profile}.png`)});
 }finally{await c.close();await browser.close();}
}
async function film(profile,name,seconds,work){
 const browser=await chromium.launch();const fixture=makeReviewFixture(profile,Date.now()),{c,p}=await context(browser,{width:390,height:844},fixture,true),video=p.video();const began=Date.now(),trace=[];
 let timer;try{await ready(p,profile);const initial=await info(p);timer=setInterval(async()=>{try{trace.push(await p.evaluate(()=>{const a=window.__REFUI__,s=a.state();return{at:Date.now(),worldMs:s.game.world.elapsedMs,condition:s.receipt.condition,resources:s.game.resources,layer:document.querySelector('#refui-card')?.open?'event':document.querySelector('#fusion-drawer')?.open?'workbench':'world',event:document.querySelector('#refui-event')?.dataset.eventId};}));}catch{}},250);
 await work(p);const wait=Math.max(0,seconds*1000-(Date.now()-began));await p.waitForTimeout(wait);clearInterval(timer);timer=undefined;
 const final=await assertMemory(p);check(final.trace.every(t=>t.action.type!=='paper'||t.action.kind!=='repair'||t.before-t.after===120),'Repair quote differs');report.videos.push({name,profile,initial,final,trace,clockOverrides:false,speed:1,audioRecorded:false});
 }finally{if(timer)clearInterval(timer);await c.close();await browser.close();}
 const rawPath=await video.path(),file=`videos/${name}.mp4`;execFileSync('ffmpeg',['-y','-loglevel','error','-i',rawPath,'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-an','-movflags','+faststart',out+'/'+file]);const raw=await fs.readFile(out+'/'+file),probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',out+'/'+file],{encoding:'utf8'}));const r=report.videos.at(-1);Object.assign(r,{file,bytes:raw.length,sha256:sha(raw),durationSeconds:Number(probe.format.duration),probe});check(Number(probe.format.duration)>0,'Empty actual film');
}
await film('fresh','fresh-discovery-to-cleaning',42,async p=>{
 await p.locator('#refui-marker').tap();await p.waitForTimeout(1300);await p.locator('[data-ref-close]').tap();for(let i=0;i<3;i++){await p.locator('#fusion-assist').tap();await p.waitForTimeout(320);}
 await p.waitForFunction(()=>window.__REFUI__.state().game.collection.includes('receipt'));await p.locator('#refui-event').tap();await p.waitForTimeout(900);await p.locator('[data-ref-curio="receipt"]').tap();await p.locator('#fusion-paper-primary').tap();await p.waitForFunction(()=>window.__REFUI__.state().receipt.stage==='displayed');await p.locator('#fusion-paper-primary').tap();await p.waitForFunction(()=>window.__REFUI__.state().receipt.condition==='clean');await p.waitForTimeout(800);await p.locator('#fusion-back-to-collection').tap();await p.waitForTimeout(700);await p.locator('.fu-nav [data-tab="explore"]').tap();
});
await film('repeat-night','daily-visit-and-morning',23,async p=>{
 await p.locator('#refui-marker').tap();await p.waitForTimeout(1800);await p.locator('[data-ref-close]').tap();await p.waitForFunction(()=>window.__REFUI__.state().game.world.elapsedMs%300000<8000);await p.locator('#refui-event').tap();await p.waitForTimeout(1200);await p.locator('[data-ref-close]').tap();
});
await film('treatment','original-price-complete-states',20,async p=>{
 await p.locator('#refui-event').tap();await p.locator('[data-ref-curio="receipt"]').tap();await p.locator('#fusion-paper-primary').tap();await p.waitForFunction(()=>window.__REFUI__.state().receipt.condition==='clean');await p.locator('#fusion-paper-primary').tap();await p.waitForFunction(()=>window.__REFUI__.state().receipt.condition==='stabilized');await p.locator('#fusion-try').tap();await p.waitForTimeout(3500);await p.locator('#fusion-back-to-collection').tap();
});
check(report.videos[0].durationSeconds>=30&&report.videos[0].durationSeconds<=45,'Requested discovery demonstration must be 30–45 seconds');
check(head()===meta.sourceCommit&&sha(await fs.readFile(meta.archive))===meta.sha256,'Source or frozen archive changed during recording');check(report.errors.length===0,'Actual browser errors');
report.completedAt=new Date().toISOString();report.complete=true;await fs.writeFile(out+'/evidence.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pairs:report.pairs.length,pages:report.screenshots.length,films:report.videos.map(v=>v.durationSeconds),errors:report.errors}));
