/** Source-bound 1x recordings for the post-439336 physical space/mechanism review. */
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';
import {physicalMuseumFixture,advanceFusion} from '../releases/physical-fixtures/physical_review_fixtures.js';
const mode=process.argv[2]??'museum';
if(!['museum','mechanisms'].includes(mode))throw Error('Expected museum or mechanisms');
const output=process.env.RENEWAL_OUTPUT??'artifacts/v042-physical-review',base=process.env.RENEWAL_URL;
if(!base)throw Error('RENEWAL_URL must point to the immutable extracted package');
const metadata=JSON.parse(await readFile('releases/taptap/package-info-fusion.json','utf8'));
const expectedVersion=process.env.RENEWAL_VERSION??'0.4.2';
if(metadata.version!==expectedVersion)throw Error(`Build the ${expectedVersion} source/package first`);
const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),paths=['src','assets/runtime','package.json','package-lock.json','vite.config.ts','vite.fusion.config.ts'];
if(execFileSync('git',['status','--porcelain','--',...paths],{encoding:'utf8'}).trim()||execFileSync('git',['diff','--name-only',metadata.sourceCommit,checkout,'--',...paths],{encoding:'utf8'}).trim())throw Error('Dirty or different runtime');
execFileSync('git',['merge-base','--is-ancestor',metadata.sourceCommit,checkout]);
const zip=await readFile(metadata.archive);if(zip.length!==metadata.bytes||createHash('sha256').update(zip).digest('hex')!==metadata.sha256)throw Error('ZIP mismatch');
await mkdir(`${output}/raw`,{recursive:true});await mkdir(`${output}/screens`,{recursive:true});
const report={mode,sourceCommit:metadata.sourceCommit,evidenceCheckoutCommit:checkout,package:metadata,zipSha256:metadata.sha256,sourceClean:true,base,physicalPhone:false,touchEmulation:true,clockOverrides:false,cases:[],screenshots:[],videos:[],errors:[]};
report.collectorSha256=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const database='loststar.fusion.firstplanet.v037',browser=await chromium.launch();
const until=async time=>{while(Date.now()<time)await new Promise(r=>setTimeout(r,Math.min(200,time-Date.now())));};
async function archive(page){return page.evaluate(name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,g=d.transaction('archive').objectStore('archive').get('current');g.onsuccess=()=>{d.close();resolve(g.result);};g.onerror=()=>reject(g.error);};}),database);}
async function open(name,fixture){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,recordVideo:{dir:`${output}/raw`,size:{width:390,height:844}}});
 const seed=await context.newPage();await seed.route('**/*.js',r=>r.abort());await seed.goto(base,{waitUntil:'domcontentloaded'});
 await seed.evaluate(({name,state})=>new Promise((resolve,reject)=>{localStorage.setItem('loststar.ui.firstplanet.v037.intro',String(state.journey.seed));const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,t=d.transaction('archive','readwrite');t.objectStore('archive').put(state,'current');t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);};}),{name:database,state:fixture.state});
 const unused=seed.video();await seed.close();if(unused)await unlink(await unused.path());
 const createdBefore=Date.now(),page=await context.newPage(),createdAfter=Date.now(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(base);await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();await page.waitForLoadState('networkidle');
 const build=await page.locator('.fu-build').innerText();if(!build.includes(expectedVersion)||!build.includes(metadata.sourceCommit.slice(0,7))||build.includes('dirty'))throw Error(`Build mismatch ${build}`);
 return{name,context,page,createdBefore,createdAfter,build,errors,fixtureAudit:fixture.audit,initial:await archive(page)};
}
async function shot(s,name,kind='actual-page'){
 const file=`screens/${name}.png`;await s.page.screenshot({path:`${output}/${file}`,scale:'css'});
 const entry={name,file,kind,engine:'chromium',width:390,height:844,at:Date.now(),build:s.build};report.screenshots.push(entry);return entry;
}
async function close(s,file,start,duration){
 const video=s.page.video();await s.context.close();const raw=await video.path(),lead=(start-s.createdAfter)/1000;
 execFileSync('ffmpeg',['-y','-i',raw,'-vf',`trim=start=${Math.max(0,lead)}:duration=${duration},setpts=PTS-STARTPTS`,'-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${file}`],{stdio:'ignore'});
 const bytes=await readFile(`${output}/${file}`),probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',`${output}/${file}`],{encoding:'utf8'}));
 const entry={file,durationSeconds:duration,speed:1,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),probe,leadInSeconds:lead,alignment:{createdBefore:s.createdBefore,createdAfter:s.createdAfter},audioRecorded:false};report.videos.push(entry);return entry;
}
async function museum(){
 if(process.env.PHYSICAL_MUSEUM_RESUME==='1'){
  const file=`${output}/museum-capture-attempt1.json`,raw=await readFile(file),prior=JSON.parse(raw);
  if(prior.sourceCommit!==metadata.sourceCommit||prior.zipSha256!==metadata.sha256)throw Error('Cannot resume a different source/package');
  const good=prior.cases.filter(c=>c.kind==='museum-continuous'&&c.targets.length===6&&c.minBodyClearance>=6&&c.maxHandReach<=85&&!c.errors.length);
  report.cases.push(...good);report.videos.push(...good.map(c=>c.video));report.screenshots.push(...prior.screenshots.filter(s=>good.some(c=>s.name.startsWith(c.name+'-'))));
  report.resumedFrom={file:'museum-capture-attempt1.json',sha256:createHash('sha256').update(raw).digest('hex'),retainedCases:good.map(c=>c.name),previousCollectorErrors:prior.errors,note:'Only complete source/ZIP-bound recordings are reused. The first collector used an impossible X-only clear test for the centre cabinet; remaining groups and full native crops are recaptured using real 2D bounds.'};
 }
 for(const kind of (process.env.RENEWAL_MUSEUM_CASES??'all-0,all-3,mixed').split(',')){
  if(!['all-0','all-3','mixed'].includes(kind))throw Error('Unknown physical museum fixture');
  if(report.cases.some(c=>c.name===`museum-${kind}`))continue;
  const fixture=kind==='mixed'?physicalMuseumFixture(Date.now()):firstPlanetFixture(Date.now(),kind==='all-3'?3:0,'stabilized');
  const s=await open(`museum-${kind}`,fixture);await s.page.locator('[data-tab="base"]').tap();await s.page.locator('#museum-canvas[data-ready="true"]').waitFor();
  const start=Date.now(),trace=[],shots=new Set();
  for(let i=0;i<=1000;i++){
   await until(start+i*100);const data=await s.page.locator('#museum-canvas').evaluate(c=>({...c.dataset}));trace.push({ms:Date.now()-start,...data});
   const key=`${data.robotTarget}-${data.servicePhase}`;
   if(['inspect','grip','walk','extend-tray','close'].includes(data.servicePhase)&&!shots.has(key)){shots.add(key);await shot(s,`museum-${kind}-${key}`);}
  }
  if(kind==='all-3')for(const [index,id]of ['receipt','tape','nested','stamp','cosmic-parcel','bell'].entries()){
   const x=[104,384,664][index%3],y=index<3?500:825;
   // The centre column cannot be cleared with an X-only test: both real
   // aisles are 140px from it. Use the whole actual actor rectangle and the
   // complete case crop, including the taller hood and floor shadow.
   await s.page.waitForFunction(({x,y,id})=>{
    const c=document.querySelector('#museum-canvas'),a=JSON.parse(c.dataset.actorBounds),r={left:x-98,right:x+98,top:y-300,bottom:y+20};
    const disjoint=a.right<r.left||a.left>r.right||a.bottom<r.top||a.top>r.bottom;
    return disjoint&&(c.dataset.robotTarget!==id||['walk','return','observe'].includes(c.dataset.servicePhase));
   },{x,y,id},{timeout:30000});
   const data=await s.page.locator('#museum-canvas').evaluate((room,{x,y})=>{const c=document.createElement('canvas');c.width=196;c.height=320;c.getContext('2d').drawImage(room,x-98,y-300,196,320,0,0,196,320);return c.toDataURL('image/png');},{x,y});
   const file=`screens/glass-cabinet-${id}-native.png`;await writeFile(`${output}/${file}`,Buffer.from(data.split(',')[1],'base64'));report.screenshots.push({name:`glass-cabinet-${id}`,file,kind:'native-canvas-crop',imagePixels:{width:196,height:320},engine:'chromium',width:390,height:844});
  }
  const actual=trace.filter(d=>d.spaceVersion),targets=[...new Set(actual.filter(d=>d.servicePhase==='inspect').map(d=>d.robotTarget))];
  const entry={name:s.name,kind:'museum-continuous',fixtureAudit:fixture.audit,trace,initial:s.initial,final:await archive(s.page),targets,minBodyClearance:Math.min(...actual.map(d=>Number(d.bodyClearance))),maxHandReach:Math.max(...actual.map(d=>Number(d.handReach))),errors:s.errors};
  if(targets.length!==6||entry.minBodyClearance<6||entry.maxHandReach>85||s.errors.length)report.errors.push(`${kind}: six physical cabinet visits not verified`);
  entry.video=await close(s,`museum-${kind}-100s.mp4`,start,100);report.cases.push(entry);
 }
}
async function mechanisms(){
 for(const id of ['tape','bell'])for(const level of id==='tape'?[0,1,2]:[0]){
  const fixture=firstPlanetFixture(Date.now(),1,'stabilized',{receiptAbility:0,tapeAbility:level});const s=await open(`${id}-ability-${level}`,fixture);
  await s.page.locator('[data-tab="collection"]').tap();await s.page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();const canvas=s.page.locator('#fusion-exhibit-focus');await canvas.locator('xpath=..').waitFor();await s.page.locator('#fusion-try:not([disabled])').waitFor();
  await shot(s,`${id}-ability-${level}-idle`);const before=await archive(s.page),start=Date.now(),trace=[];
  for(let replay=0;replay<2;replay++){
   const pressed=Date.now();await s.page.locator('#fusion-try').tap();
   for(let i=0;i<=65;i++){await until(pressed+i*40);const data=await canvas.evaluate(c=>({...c.dataset}));trace.push({ms:Date.now()-start,replay,...data});}
   await s.page.locator('#fusion-try:not([disabled])').waitFor();
  }
  const end=Date.now(),after=await archive(s.page),automatic=advanceFusion(before,after.game.lastAt);
  const normalized=state=>JSON.parse(JSON.stringify(state,(key,value)=>key==='storageRevision'?undefined:value));
  const replayIds=[...new Set(trace.filter(d=>d.experimentPlaying==='true').map(d=>d.replay))];
  const phases=[...new Set(trace.map(d=>d.mechanismPhase))];
  const required=id==='tape'?['feed','hold','return']:['reach','press','hold','release','return'];
  const archiveMatchesAutomatic=isDeepStrictEqual(normalized(after),normalized(automatic));
  const entry={name:s.name,kind:'mechanism-trial',id,abilityLevel:level,fixtureAudit:fixture.audit,before,after,trace,replayIds,phases,archiveMatchesAutomatic,errors:s.errors};
  if(replayIds.length!==2||!required.every(p=>phases.includes(p))||!archiveMatchesAutomatic||s.errors.length)report.errors.push(`${s.name}: incomplete physical phases/replay, archive mismatch or browser errors`);
  entry.video=await close(s,`${id}-ability-${level}-two-trials.mp4`,start,(end-start)/1000);report.cases.push(entry);
 }
}
try{if(mode==='museum')await museum();else await mechanisms();}catch(error){report.errors.push(error.stack??String(error));process.exitCode=1;}finally{await browser.close();if(report.errors.length)process.exitCode=1;await writeFile(`${output}/${mode}-physical-evidence.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({mode,cases:report.cases.length,videos:report.videos.length,errors:report.errors}));}
