import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';
import {feedbackFixture} from '../releases/feedback-fixtures/feedback_fixtures.js';
import {collectRuntimeBinding, readZipEntries, RUNTIME_ROOTS} from './execution_acceptance.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(value,message)=>{if(!value)throw Error(message);};
const metadataRaw=await readFile(path.join(root,'releases/taptap/package-info-fusion.json'));
const metadata=JSON.parse(metadataRaw),aVersion=metadata.version==='0.4.5';
if(aVersion&&!process.env.RENEWAL_URL)throw Error('RENEWAL_URL must identify the frozen V045 extracted package');
const base=process.env.RENEWAL_URL??'http://127.0.0.1:4226/',url=new URL(base),servedRoot=new URL('./',url);
check(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash,'Use an immutable package URL without credentials/query/fragment');
const output=path.resolve(root,process.env.RENEWAL_OUTPUT??(aVersion?'artifacts/v045-a-exploration':'artifacts/visual-renewal'));
const runtimePaths=[...RUNTIME_ROOTS,'index.html','package.json','package-lock.json','tsconfig.json',':(top,glob)vite*.ts'];
const checkout=git(['rev-parse','HEAD']),collectorSha=sha(await readFile(fileURLToPath(import.meta.url)));
const fixtureModules=Object.fromEntries(await Promise.all(['firstplanet-fixtures/firstplanet_fixtures.js','feedback-fixtures/feedback_fixtures.js'].map(async name=>[name,sha(await readFile(path.join(root,'releases',name)))])));
async function guard(){
 check(git(['rev-parse','HEAD'])===checkout,'Evidence checkout changed while measuring');
 check(!git(['status','--porcelain','--',...runtimePaths])&&!git(['diff','--name-only',metadata.sourceCommit,checkout,'--',...runtimePaths]),'Performance capture requires unchanged frozen runtime/source originals');
 execFileSync('git',['merge-base','--is-ancestor',metadata.sourceCommit,checkout],{cwd:root});
 check((await readFile(path.join(root,'releases/taptap/package-info-fusion.json'))).equals(metadataRaw),'Package metadata changed while measuring');
 const bytes=await readFile(path.resolve(root,metadata.archive));
 check(bytes.length===metadata.bytes&&sha(bytes)===metadata.sha256,'Actual ZIP hash/bytes differ');
 check(sha(await readFile(fileURLToPath(import.meta.url)))===collectorSha,'Performance collector changed while measuring');
 for(const [name,digest]of Object.entries(fixtureModules))check(sha(await readFile(path.join(root,'releases',name)))===digest,`Fixture module changed: ${name}`);
 return collectRuntimeBinding(root,metadata.sourceCommit);
}
const initialGuard=await guard(),zip=readZipEntries(await readFile(path.resolve(root,metadata.archive)));
check(zip.has(metadata.entry),'Package entry missing from actual ZIP');
const entryRoot=`${path.posix.dirname(metadata.entry)}/`,entryHash=sha(zip.get(metadata.entry));
const summarize=values=>{const a=[...values].sort((x,y)=>x-y);return{samples:a.length,medianMs:a[Math.floor(a.length*.5)]??null,p95Ms:a[Math.floor(a.length*.95)]??null,over100Ms:a.filter(x=>x>100).length};};
const report={schema:1,version:metadata.version,sourceCommit:metadata.sourceCommit,evidenceCheckoutCommit:checkout,base,zipSha256:metadata.sha256,sourceClean:true,initialGuard,collectorSha256:collectorSha,fixtureModules,physicalPhone:false,textureMemory:'Not measured. Decoded image, GPU and total-process residency are not inferred from the JavaScript heap.',host:{cpu:os.cpus()[0].model,platform:os.platform(),architecture:os.arch()},
 method:{viewport:{width:390,height:844},dpr:2,concurrency:1,recording:false,warmupMs:1500,sampleMs:10000,clockOverrides:false,heap:'Chromium coarse JS heap only; excludes texture, GPU and process memory.'},cases:[]};
const defaults=aVersion?'explore,night,collection,receipt,tape-ii,bell-active':'explore,field,collection,receipt,tape,bell';
const views=(process.env.RENEWAL_PERF_VIEWS??defaults).split(',');
const engines=process.env.RENEWAL_PERF_ENGINES?.split(',')??['chromium','webkit'];
if(!engines.length||new Set(engines).size!==engines.length||engines.some(engine=>!['chromium','webkit'].includes(engine)))throw Error('Unsupported/duplicate performance engine');
if(!views.length||new Set(views).size!==views.length||views.some(view=>!['explore','field','night','collection','base','receipt','tape','bell','tape-ii','bell-active'].includes(view)))throw Error('Unsupported/duplicate performance view');
report.method.requestedEngines=engines;report.method.requestedViews=views;
const nav=name=>`#fusion-app > .fu-nav [data-tab="${name}"]`;
async function openCollectionIndex(page){
 const index=page.locator('#fusion-collection-index');
 if(await index.count()&&!await index.evaluate(node=>node.open))await index.locator(':scope > summary').tap();
 if(aVersion)check(await index.count()===1&&await index.evaluate(node=>node.open),'Actual A collection index did not open');
}
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 if(!engines.includes(engine))continue;
 const browser=await type.launch();
 try{for(const view of views){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  try{
   const page=await context.newPage(),errors=[],loadedScripts=[],pending=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('response',response=>{
    const resource=new URL(response.url());if(response.status()>=400)errors.push(`${response.status()} ${resource.pathname}`);
    if(response.request().resourceType()!=='script'&&!resource.pathname.endsWith('.js'))return;
    pending.push((async()=>{
     check(resource.origin===url.origin&&resource.pathname.startsWith(servedRoot.pathname),'Loaded JS outside immutable package');
     const member=entryRoot+decodeURIComponent(resource.pathname.slice(servedRoot.pathname.length)),raw=await response.body();
     check(zip.has(member)&&sha(raw)===sha(zip.get(member)),`Actually loaded JS differs from ZIP: ${member}`);
     loadedScripts.push({member,bytes:raw.length,sha256:sha(raw)});
    })().catch(error=>errors.push(error.message)));
   });
   let fixture;
   if(['night','collection','base','receipt','tape','bell','tape-ii','bell-active'].includes(view)){
    const seed=await context.newPage();await seed.route('**/*.js',r=>r.abort());await seed.goto(base,{waitUntil:'domcontentloaded'});
    fixture=view==='night'?feedbackFixture('night',Date.now()):firstPlanetFixture(Date.now(),view==='base'?3:0,'stabilized',{receiptAbility:0,tapeAbility:view==='tape-ii'?2:0});
    await seed.evaluate(save=>new Promise((resolve,reject)=>{const r=indexedDB.open('loststar.fusion.firstplanet.v037',1);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite');t.objectStore('archive').put(save,'current');t.oncomplete=()=>{d.close();localStorage.setItem('loststar.ui.firstplanet.v037.intro',String(save.journey.seed));resolve();};t.onerror=()=>{d.close();reject(t.error);};};}),fixture.state);await seed.close();
   }
   const response=await page.goto(base);check(response&&sha(await response.body())===entryHash,'Actually served HTML differs from fixed ZIP');await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
   // A removed the floating intro rather than replacing it with a scripted dismissal.
   if(!aVersion){const dismiss=page.locator('#fusion-dismiss-intro');if(await dismiss.isVisible())await dismiss.tap();}
   if(view==='field'||view==='night')await page.locator('#fusion-observe').tap();
   if(view==='night'){await page.locator('#fusion-period[data-period="night"]').waitFor();await page.locator('#fusion-field-drawer:not([hidden])').waitFor();}
   if(view==='collection'||view==='base'){await page.locator(nav(view)).tap();await page.locator('#museum-canvas[data-ready="true"]').waitFor({state:'visible'});}
   if(['receipt','tape','bell','tape-ii','bell-active'].includes(view)){
    const id=view==='tape-ii'?'tape':view==='bell-active'?'bell':view;
    await page.locator(nav('collection')).tap();await openCollectionIndex(page);await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
    await page.locator(id==='receipt'?'#fusion-paper-focus[data-ready="true"]':'#fusion-exhibit-focus[data-ready="true"]').waitFor();
    if(view==='tape-ii'||view==='bell-active'){await page.locator('#fusion-try:not([disabled])').waitFor({state:'visible'});await page.evaluate(()=>{window.__renewalPerfTrials=setInterval(()=>{const button=document.querySelector('#fusion-try');if(button&&!button.disabled)button.click();},2800);});}
   }
   await page.waitForLoadState('networkidle');await Promise.all(pending);check(loadedScripts.length>0,'No actually loaded JS checked against ZIP');
   const build=await page.locator('.fu-build').innerText();if(!build.includes(metadata.version)||!build.includes(metadata.sourceCommit.slice(0,7))||build.includes('dirty'))throw Error(`Unexpected build ${build}`);
   await page.waitForTimeout(1500);await page.evaluate(()=>{window.__FUSION__.resetMetrics();window.__FUSION__.resetUiMetrics();window.__v039Heap=[];window.__v039HeapTimer=setInterval(()=>{if(performance.memory)window.__v039Heap.push(performance.memory.usedJSHeapSize);},100);});
   const sample=await page.evaluate(async()=>{const intervals=[],activities=[],periods=new Set();let previous=performance.now(),start=previous;
    await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;periods.add(document.querySelector('#fusion-world canvas')?.dataset.period);const c=document.querySelector('#fusion-exhibit-focus');if(c)activities.push({ms:now-start,playing:c.dataset.experimentPlaying,replay:c.dataset.replay,mechanism:c.dataset.mechanism,phase:c.dataset.mechanismPhase});if(now-start<10000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    clearInterval(window.__v039HeapTimer);return{raf:intervals.slice(1),world:window.__FUSION__.metrics(),ui:window.__FUSION__.uiMetrics(),heap:window.__v039Heap,activities,periods:[...periods]};});
   await Promise.all(pending);
   const field=['explore','field','night'].includes(view),museum=['collection','base'].includes(view),actualIntervals=field?null:museum?sample.ui.museum.intervalsMs??[]:sample.ui.focus.intervalsMs;
   const activeView=['tape-ii','bell-active'].includes(view),activeFrames=sample.activities.filter(a=>a.playing==='true'),replays=[...new Set(activeFrames.map(a=>a.replay))];
   if(activeView&&(activeFrames.length<10||replays.length<2))errors.push('Active performance view failed to observe two real rendered mechanism replays');
   if(view==='night'&&(sample.periods.length!==1||sample.periods[0]!=='night'))errors.push('Actual 10s night sample crossed another world period');
   const actualPaint=field?{samples:sample.world.frames,medianMs:sample.world.medianFrameMs,p95Ms:sample.world.p95FrameMs}:summarize(actualIntervals);
   if(!(actualPaint.samples>0&&actualPaint.p95Ms>0))errors.push('Actual paint samples missing');
   report.cases.push({engine,view,build,fixtureAudit:fixture?.audit,loadedScripts,periods:sample.periods,automaticTrialInputs:activeView,activity:{activeFrames:activeFrames.length,replays,phases:[...new Set(activeFrames.map(a=>a.phase))],samples:sample.activities},raf:summarize(sample.raf),actualPaint,
    meanDrawMs:field?sample.world.meanDrawMs:(museum?sample.ui.museum.costsMs:sample.ui.focus.costsMs).reduce((a,b)=>a+b,0)/Math.max(1,(museum?sample.ui.museum.costsMs:sample.ui.focus.costsMs).length),
    timing:process.env.RENEWAL_PERF_TRACE==='1'?{rafIntervalsMs:sample.raf,paintIntervalsMs:actualIntervals}:undefined,
    heap:{samples:sample.heap.length,maximumBytes:sample.heap.length?Math.max(...sample.heap):null},errors});
   if(errors.length)throw Error(JSON.stringify(errors));
  }finally{await context.close();}
 }}finally{await browser.close();}
}
report.finalGuard=await guard();check(report.initialGuard.runtimeTreeHash===report.finalGuard.runtimeTreeHash,'Runtime changed during sampling');
await mkdir(output,{recursive:true});await writeFile(path.join(output,'performance.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.cases.map(({engine,view,actualPaint,errors})=>({engine,view,actualPaint,errors}))));
