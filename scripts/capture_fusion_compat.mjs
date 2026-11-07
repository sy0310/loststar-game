import {chromium,webkit} from '@playwright/test';
import {captureFixture} from '../releases/fusion-capture/fusion_capture_fixtures.js';
import {readFileSync,writeFileSync} from 'node:fs';
const output='artifacts/fusion', base='http://127.0.0.1:4207';
const record=JSON.parse(readFileSync(`${output}/recordings.json`,'utf8'));
for(const [engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{for(const width of[360,390]){
  const context=await browser.newContext({viewport:{width,height:width===360?800:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const seed=await context.newPage();await seed.route('**/*.js',r=>r.abort());await seed.goto(base,{waitUntil:'domcontentloaded'});
  await seed.evaluate(value=>new Promise(resolve=>{const r=indexedDB.open('loststar.fusion.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite');t.objectStore('archive').put(value,'current');t.oncomplete=()=>{d.close();resolve();};};}),captureFixture('base',Date.now()));await seed.close();
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();await page.waitForFunction(()=>document.querySelector('#fusion-tap').getAttribute('aria-disabled')==='false');
  const build=await page.locator('.fu-build').textContent();if(!build.includes(record.sourceCommit.slice(0,7)))throw Error('Runtime version changed');
  const start=Date.now();
  await page.screenshot({path:`${output}/${width}-${engine}-explore.png`});
  await page.locator('[data-tab="base"]').tap();await page.locator('#fusion-base-dock canvas[data-ready="true"]').waitFor();await page.waitForTimeout(250);await page.screenshot({path:`${output}/${width}-${engine}-base.png`});
  for(const shot of record.shots)if(shot.file===`${width}-${engine}-explore.png`||shot.file===`${width}-${engine}-base.png`){shot.at=shot.file.endsWith('-base.png')?Date.now()-start:0;shot.resampledAt=new Date().toISOString();shot.note='Supplemental readiness-gated capture; avoids first200ms hint update lag after Canvas decode.';}
  const entry=record.entries.find(e=>e.name===`compat-${engine}-${width}`);entry.readinessGateRecapture={at:new Date().toISOString(),build,errors};
  const saved=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('loststar.fusion.v1',1);r.onsuccess=()=>{const d=r.result,g=d.transaction('archive','readonly').objectStore('archive').get('current');g.onsuccess=()=>{resolve(g.result);d.close();};};}));
  Object.assign(entry,{wallMs:Date.now()-start,worldMs:saved.game.world.elapsedMs,balance:saved.game.resources,transactions:saved.receipt.transactions,projects:saved.projects,records:saved.records,assist:saved.game.assist,errors});
  if(errors.length)throw Error(errors.join('\n'));await context.close();
 }}finally{await browser.close();}
}
writeFileSync(`${output}/recordings.json`,JSON.stringify(record,null,2)+'\n');console.log('Eight compatibility screenshots replaced after actual scene and UI readiness; source unchanged.');
