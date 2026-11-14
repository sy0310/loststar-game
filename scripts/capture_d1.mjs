import {chromium,webkit} from '@playwright/test';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {basename} from 'node:path';

// Discover → Rehearse → Record. D1 has its own narrative captions, so the mobile
// adaptation uses native touch rings rather than a desktop mouse/subtitle layer.
const base=process.env.BASE_URL??'http://127.0.0.1:4187';
const outputIndex=process.argv.indexOf('--output');
const outputArgument=outputIndex<0?undefined:process.argv[outputIndex+1];
if(outputIndex>=0&&(!outputArgument||outputArgument.startsWith('--')))throw Error('--output requires a directory.');
const out=outputArgument??'artifacts/d1';
const raw=`artifacts/raw-video/${basename(out)}`;
const rehearse=process.argv.includes('--rehearse');
const options={viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourcePaths=['src','assets','package.json','package-lock.json','index.html','vite.config.ts','vite.d1.config.ts','scripts/capture_d1.mjs'];
const dirtySource=()=>execFileSync('git',['status','--porcelain','--',...sourcePaths],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const errors=[],clicks=[];
const fixtures={save:'D1-PRESERVE-EXISTING-SAVE-STRING',preferences:'D1-PRESERVE-EXISTING-PREFERENCES-STRING'};
await mkdir(out,{recursive:true});await mkdir(raw,{recursive:true});
const priorDiscovery=JSON.parse(await readFile(`${out}/discovery.json`,'utf8'));
if(!priorDiscovery.fields?.length||!priorDiscovery.receiptFields?.length)throw Error(`Discover both D1 tabs before rehearsal. Expected ${out}/discovery.json.`);

function assert(value,message){if(!value)throw Error(message);}
function escape(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function ensureVisible(page,selector,label){
  const target=page.locator(selector),count=await target.count();
  if(count!==1||!await target.isVisible()){
    const available=await page.locator('button:visible').allTextContents();
    throw Error(`REHEARSAL FAIL ${label}: ${selector} resolved ${count}; visible=${JSON.stringify(available)}`);
  }
  const box=await target.boundingBox();
  assert(box&&box.width>=44&&box.height>=44,`${label} touch target below 44×44`);
  console.log(`REHEARSAL OK: ${label}`);
  return target;
}
async function tap(page,selector,label){
  const target=await ensureVisible(page,selector,label);await target.scrollIntoViewIfNeeded();
  const box=await target.boundingBox();assert(box,`Missing native touch target: ${label}`);
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.touchscreen.tap(x,y);clicks.push({label,selector,x,y,wallAt:new Date().toISOString(),input:'Playwright native touchscreen.tap'});
}
async function guardStorage(page){
  await page.addInitScript(fixtures=>{
    const get=Storage.prototype.getItem;
    localStorage.setItem('loststar.save.v1',fixtures.save);
    localStorage.setItem('loststar.preferences.v1',fixtures.preferences);
    const calls=[];
    for(const name of ['getItem','setItem','removeItem','clear']){
      const fn=Storage.prototype[name];
      Storage.prototype[name]=function(...args){calls.push({method:name,key:args[0]??null});return fn.apply(this,args);};
    }
    window.__D1_STORAGE_AUDIT__={calls,read:()=>({save:get.call(localStorage,'loststar.save.v1'),preferences:get.call(localStorage,'loststar.preferences.v1')})};
    document.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='touch')return;
      const dot=document.createElement('div');dot.setAttribute('aria-hidden','true');
      dot.style.cssText=`position:fixed;left:${event.clientX-12}px;top:${event.clientY-12}px;width:24px;height:24px;border:2px solid #ffefc0;border-radius:50%;background:#ffe3a522;pointer-events:none;z-index:99999`;
      document.body.append(dot);dot.animate([{opacity:1,transform:'scale(.75)'},{opacity:0,transform:'scale(1.4)'}],{duration:350,fill:'forwards'});setTimeout(()=>dot.remove(),360);
    });
  },fixtures);
}
async function auditSave(page,label){
  const result=await page.evaluate(()=>({strings:window.__D1_STORAGE_AUDIT__.read(),calls:window.__D1_STORAGE_AUDIT__.calls}));
  assert(result.strings.save===fixtures.save&&result.strings.preferences===fixtures.preferences,`${label}: preservation sentinel changed`);
  assert(result.calls.length===0,`${label}: D1 accessed storage: ${JSON.stringify(result.calls)}`);
  return {label,fixture:'Synthetic existing save/preferences strings in a fresh browser context; not a real player save.',unchanged:true,calls:result.calls,strings:result.strings};
}
async function boot(browser,study,{record=false,label=study}={}){
  const context=await browser.newContext({...options,...(record?{recordVideo:{dir:raw,size:options.viewport}}:{})});
  const page=await context.newPage();await guardStorage(page);
  page.on('pageerror',error=>errors.push({label,type:'JavaScript',message:error.message}));
  page.on('response',response=>{if(response.status()>=400)errors.push({label,type:'HTTP',status:response.status(),url:response.url()});});
  page.on('requestfailed',request=>errors.push({label,type:'network',url:request.url(),message:request.failure()?.errorText}));
  const began=Date.now();await page.goto(`${base}/?sample=${study}-d1`,{waitUntil:'domcontentloaded'});
  await page.locator(study==='night'?'#d1-scene canvas[data-ready=true]':'#receipt-focus[data-ready=true]').waitFor({timeout:45000});
  const build=await page.locator('html').getAttribute('data-build');assert(build,'D1 build metadata is missing');
  if(!rehearse){assert(!build.includes('本地修改'),`Refusing dirty production evidence: ${build}`);assert(build.includes(sourceCommit.slice(0,7)),`Preview build ${build} does not match ${sourceCommit}`);}
  return {context,page,build,loadWallMs:Date.now()-began};
}
async function fields(page){return page.locator('button:visible').evaluateAll(nodes=>nodes.map(node=>({tag:node.tagName,id:node.id,text:node.textContent.trim(),study:node.dataset.study??null,tier:node.dataset.tier??null})));}
async function screenshot(page,name,{fullPage=false}={}){await page.screenshot({path:`${out}/${name}.png`,scale:'css',fullPage});return `${name}.png`;}
async function nightData(page){return page.locator('#d1-scene canvas').evaluate(canvas=>({
  seconds:Number(canvas.dataset.studySeconds),phase:canvas.dataset.studyPhase,
  robot:{x:Number(canvas.dataset.robotX),y:Number(canvas.dataset.robotY)},target:{x:Number(canvas.dataset.targetX),y:Number(canvas.dataset.targetY)},
  ship:canvas.dataset.ship,beam:canvas.dataset.beam==='true',action:canvas.dataset.action,
}));}
async function receiptData(page){return page.locator('#receipt-focus').evaluate(canvas=>({
  tier:Number(canvas.dataset.tier),install:Number(canvas.dataset.install),view:canvas.dataset.view,camera:canvas.dataset.camera,
  anchor:{x:Number(canvas.dataset.anchorX),y:Number(canvas.dataset.anchorY)},item:{x:Number(canvas.dataset.itemX),y:Number(canvas.dataset.itemY),size:Number(canvas.dataset.itemSize)},
  specimenTier:Number(canvas.dataset.specimenTier),paperBbox:canvas.dataset.paperBbox,
  paperReveal:Number(canvas.dataset.paperReveal),frame:Number(canvas.dataset.frame),drawMs:Number(canvas.dataset.drawMs),
}));}
async function waitNight(page,seconds){await page.waitForFunction(seconds=>Number(document.querySelector('#d1-scene canvas').dataset.studySeconds)>=seconds,seconds,{timeout:40000});}
async function finishVideo(page,context,name){
  const video=page.video();assert(video,`No recorded video for ${name}`);await context.close();
  const rawPath=await video.path(),destination=`${out}/${name}.mp4`;
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',rawPath,'-r','30','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',destination]);
  const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',destination],{encoding:'utf8'}).trim());
  return {file:`${name}.mp4`,bytes:(await stat(destination)).size,videoSeconds:duration,playbackRate:1,source:'Real-time Playwright video encoded as H.264 at 30 video frames per second. Runtime rendering frequency is measured separately.'};
}

function assertReceiptAlignment(frames){
  for(const frame of frames){
    assert(frame.camera===frames[0].camera,'Receipt camera changed between tiers.');
    assert(JSON.stringify(frame.anchor)===JSON.stringify(frames[0].anchor),'Receipt shelf anchor changed.');
    assert(JSON.stringify(frame.item)===JSON.stringify(frames[0].item),'Receipt item center or envelope changed.');
  }
}

async function specimenView(page){
  await tap(page,'#receipt-specimen-view','Observe the receipt itself');
  await page.waitForFunction(()=>document.querySelector('#receipt-focus').dataset.view==='specimen');
}

async function selectReceiptTier(page,tier,{settleMs=1250}={}){
  await tap(page,`button[data-tier="${tier}"]`,`Observe receipt tier ${tier}`);
  await page.waitForFunction(tier=>Number(document.querySelector('#receipt-focus').dataset.specimenTier)===tier,tier);
  await page.waitForTimeout(settleMs);
  const data=await receiptData(page);
  assert(data.paperReveal===1,`Receipt tier ${tier} has not finished revealing its details.`);
  assert(data.paperBbox?.split(',').map(Number).every(Number.isFinite),'Receipt visible bounds are missing.');
  return data;
}

async function measurePaper(page){
  return page.evaluate(async()=>{
    const canvas=document.querySelector('#receipt-focus');
    const start=performance.now();
    let previousFrame=Number(canvas.dataset.frame),polls=0;
    const samples=[];
    await new Promise(resolve=>{
      function observe(now){
        polls++;
        const frame=Number(canvas.dataset.frame);
        if(frame!==previousFrame){
          samples.push({frame,atMs:now-start,drawMs:Number(canvas.dataset.drawMs)});
          previousFrame=frame;
        }
        if(now-start>=6000)resolve();
        else requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
    const windowMs=performance.now()-start;
    const sorted=samples.map(sample=>sample.drawMs).sort((a,b)=>a-b);
    return {
      windowMs,pollRafSamples:polls,renderedFrames:samples.length,
      actualHz:samples.length/(windowMs/1000),
      meanDrawMs:sorted.reduce((sum,value)=>sum+value,0)/sorted.length,
      p95DrawMs:sorted[Math.floor(sorted.length*.95)],maxDrawMs:sorted.at(-1),
      scope:'CPU duration of the complete MuseumScene.renderFocused call including paper, lighting and cabinet commands. GPU presentation and phone performance require separate measurement.',
      final:{view:canvas.dataset.view,tier:Number(canvas.dataset.specimenTier),camera:canvas.dataset.camera},
      samples,
    };
  });
}

async function writeGallery(result){
  const nightGallery=result.nightKeyframes.map(frame=>`
    <figure>
      <a href="${frame.file}"><img src="${frame.file}" alt="夜巡 ${frame.seconds.toFixed(1)} 秒 ${escape(frame.phase)}"></a>
      <figcaption>${frame.seconds.toFixed(1)}s · ${escape(frame.phase)} · 飞船${frame.ship==='back'?'背轨':'前轨'}</figcaption>
    </figure>`).join('');
  const cabinetGallery=result.receiptTiers.map(frame=>`
    <figure>
      <a href="${frame.file}"><img src="receipt-lv${frame.tier}-focus-canvas.png" alt="收据柜 Lv${frame.tier} 实际运行画面"></a>
      <figcaption>Lv${frame.tier} · 同台面与柜体镜头</figcaption>
    </figure>`).join('');
  const paperGallery=result.specimenTiers.map(frame=>`
    <figure>
      <a href="${frame.file}"><img src="${frame.canvasFile}" alt="收据本体 Lv${frame.specimenTier} 实际运行近景"></a>
      <figcaption>Lv${frame.specimenTier} · 原生比例 · 点击查看390整页</figcaption>
    </figure>`).join('');
  const nightRows=result.performanceSamples.map(sample=>`
    <tr><td>${escape(sample.engine)}</td><td>${sample.windowMs.toFixed(0)}ms / ${sample.rafSamples}</td>
      <td>${sample.medianMs.toFixed(2)} / ${sample.p95Ms.toFixed(2)}ms</td>
      <td>${sample.scene.meanDrawMs.toFixed(2)}ms</td></tr>`).join('');
  const paperRows=result.performanceSamples.map(sample=>`
    <tr><td>${escape(sample.engine)}</td><td>${sample.paper.windowMs.toFixed(0)}ms</td>
      <td>${sample.paper.renderedFrames} / ${sample.paper.actualHz.toFixed(2)}Hz</td>
      <td>${sample.paper.meanDrawMs.toFixed(2)} / ${sample.paper.p95DrawMs.toFixed(2)}ms</td></tr>`).join('');
  const previous=basename(out)==='d1'?'':`
    <p><a href="../d1/">查看0.3.1旧版实际录像和截图，对照本轮纸卷与夜巡变化</a></p>`;
  const html=`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>失物星球 D1 本体与动作精修</title>
  <style>
    body{margin:0;background:#171225;color:#eadcc8;font:15px/1.7 system-ui,sans-serif}
    main{max-width:1080px;margin:auto;padding:28px 18px}
    h1{font-size:25px}h2{margin:30px 0 12px;font-size:20px}
    a{color:#b6e3d3}p{color:#bdacc8}
    .notice{padding:12px 16px;border:1px solid #a38361;background:#34263c}
    video{display:block;width:min(100%,390px);max-height:78vh;background:#0e0b18}
    .videos{display:flex;gap:24px;flex-wrap:wrap}.videos article{flex:1;min-width:280px}
    .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
    figure{margin:0;background:#211a31;border:1px solid #69546b;padding:8px}
    img{width:100%;display:block;image-rendering:pixelated}
    figcaption{font-size:12px;color:#c3b0c8;padding:7px 2px 2px}
    code{overflow-wrap:anywhere}.meta{font-size:13px}.table-wrap{overflow-x:auto}
    table{border-collapse:collapse;width:100%;font-size:13px}
    td,th{border:1px solid #685269;padding:8px;text-align:left}
  </style>
</head>
<body><main>
  <h1>失物星球 · D1 本体与动作精修</h1>
  <p class="meta">${escape(result.build)} · <a href="https://github.com/sy0310/loststar-game/commit/${sourceCommit}"><code>${sourceCommit}</code></a></p>
  <p class="notice">三个样板均由实际运行画面按墙钟连续录制。画面使用390×844桌面浏览器原生触控仿真，TapTap手机表现仍需扫码复审。</p>
  ${previous}
  <div class="videos">
    <article>
      <h2>完整球体 · 30秒夜间处置</h2>
      <video controls playsinline preload="metadata" src="night-operations-real-30s.mp4"></video>
      <p>咔哒沿邮路出站，核验纸影、收容并返回原仓库。飞船维持绕轨飞行，在前轨提供搜照。</p>
    </article>
    <article>
      <h2>同一展柜 · 四档结构安装</h2>
      <video controls playsinline preload="metadata" src="receipt-installation-real-12s.mp4"></video>
      <p>黄铜台座、邮政微景观与典藏舱依次安装，镜头、台面和奇物注册位置一致。</p>
    </article>
    <article>
      <h2>观察收据 · 四档本体连续演示</h2>
      <video controls playsinline preload="metadata" src="receipt-specimen-four-tiers-real-12s.mp4"></video>
      <p>每档停留约3秒。纸卷以原生比例展示，显影、墨层、卷边与柜内光照共同运动。</p>
    </article>
  </div>
  <h2>四档收据本体近景</h2>
  <div class="gallery">${paperGallery}</div>
  <h2>四档同柜镜头</h2>
  <div class="gallery">${cabinetGallery}</div>
  <h2>Lv3在原收藏室</h2>
  <a href="${result.room.file}"><img style="max-width:390px" src="${result.room.file}" alt="典藏舱在原收藏室的位置"></a>
  <h2>夜巡关键帧</h2>
  <div class="gallery">${nightGallery}</div>
  <h2>收据实际绘制采样</h2>
  <div class="table-wrap"><table>
    <tr><th>桌面引擎</th><th>采样窗口</th><th>独立绘制帧 / 实际频率</th><th>CPU均值 / P95</th></tr>
    ${paperRows}
  </table></div>
  <p>收据频率按输出画布递增的data-frame去重计数。CPU数值覆盖完整renderFocused调用，包括纸面、光照和柜体绘制命令。GPU呈现时间和手机发热需另行测量。</p>
  <h2>夜巡浏览器与场景采样</h2>
  <div class="table-wrap"><table>
    <tr><th>桌面引擎</th><th>窗口 / rAF回调</th><th>rAF中位 / P95</th><th>场景绘制CPU均值</th></tr>
    ${nightRows}
  </table></div>
  <p>这组采样来自${escape(result.host.cpu)}。rAF记录浏览器回调间隔，纸面实际绘制频率由上表单独报告。</p>
  <h2>本轮已知事项</h2>
  <p>Lv0到Lv1的纸张变化仍较克制，后续将结合手机观察反馈评估。当前六秒采样覆盖桌面Chromium与WebKit的移动触控仿真，长时间发热和真实WebView仍待验证。</p>
  <p>${result.saveAudits.length}个独立上下文均核对了合成存档与偏好哨兵，应用运行期间记录的Storage访问为0。完整原始记录包含每次触控、构建、时间和错误审计。</p>
  <p><a href="recordings.json">原始录制与采样记录</a> · <a href="rehearsal.json">触控彩排</a> · <a href="discovery.json">交互发现</a></p>
</main></body></html>`;
  await writeFile(`${out}/index.html`,html);
}

const browser=await chromium.launch();
try{
  if(rehearse){
    const {page,context,build}=await boot(browser,'night',{label:'rehearsal'}),discovery={night:await fields(page)};
    await tap(page,'#d1-replay','Replay night');await waitNight(page,.12);
    await tap(page,'button[data-study=receipt]','Open receipt study');await page.locator('#receipt-focus[data-ready=true]').waitFor({timeout:45000});
    discovery.receipt=await fields(page);
    for(const tier of [0,1,2,3]){await tap(page,`button[data-tier="${tier}"]`,`Receipt tier ${tier}`);await page.waitForFunction(tier=>Number(document.querySelector('#receipt-focus').dataset.tier)===tier,tier);}
    await tap(page,'#receipt-install','Play 0→3 installation');await page.waitForFunction(()=>Number(document.querySelector('#receipt-focus').dataset.tier)===1&&Number(document.querySelector('#receipt-focus').dataset.install)>.15,{},{timeout:5000});
    const installation=await receiptData(page);assert(installation.install<1,'Rehearsal missed intermediate installation');
    await tap(page,'#receipt-view','Switch to room camera');await page.waitForFunction(()=>document.querySelector('#receipt-focus').dataset.view==='room');
    await specimenView(page);
    const specimenTiers=[];
    for(const tier of [0,1,2,3])specimenTiers.push(await selectReceiptTier(page,tier));
    assertReceiptAlignment(specimenTiers);
    const paperStart=await receiptData(page);
    await page.waitForTimeout(650);
    const paperEnd=await receiptData(page);
    assert(paperEnd.frame>paperStart.frame&&Number.isFinite(paperEnd.drawMs),'Paper frame counter or CPU timer is unavailable.');
    const paperMeasurements=[{engine:'chromium',build,...await measurePaper(page)}];
    const rehearsalWebKit=await webkit.launch();
    try{
      const probe=await boot(rehearsalWebKit,'receipt',{label:'webkit-paper-rehearsal'});
      await specimenView(probe.page);
      await selectReceiptTier(probe.page,3);
      paperMeasurements.push({engine:'webkit',build:probe.build,...await measurePaper(probe.page)});
      await auditSave(probe.page,'WebKit paper rehearsal');
      await probe.context.close();
    }finally{await rehearsalWebKit.close();}
    await tap(page,'button[data-study=night]','Return to night study');await tap(page,'#d1-replay','Replay after tab return');await waitNight(page,.1);
    const saveAudit=await auditSave(page,'rehearsal');assert(errors.length===0,`Rehearsal errors: ${JSON.stringify(errors)}`);
    const result={at:new Date().toISOString(),sourceCommit,build,base,output:out,rawDirectory:raw,passed:true,mode:'Discovery and native-touch rehearsal. Formal recording follows a clean-build rehearsal.',dirtySource:dirtySource(),discovery,installation,specimenTiers,paperProbe:{start:paperStart,end:paperEnd},paperMeasurements,saveAudit,clicks,errors};
    await writeFile(`${out}/rehearsal.json`,JSON.stringify(result,null,2)+'\n');await context.close();
    console.log(`D1 REHEARSAL PASSED: ${build}`);
  }else{
    const prior=JSON.parse(await readFile(`${out}/rehearsal.json`,'utf8'));
    assert(prior.passed===true,'Run --rehearse successfully before formal recording.');
    assert(prior.sourceCommit===sourceCommit,'Rehearsal belongs to another source commit; rehearse the clean production build again.');
    assert(!prior.build.includes('本地修改'),'Production recording requires a clean-build rehearsal.');
    assert(prior.dirtySource.length===0,'Formal recording requires a rehearsal with clean source files.');
    assert(dirtySource().length===0,`Refusing dirty source recording:\n${dirtySource().join('\n')}`);
    const records=[],saveAudits=[],nightKeyframes=[],receiptTiers=[],specimenTiers=[],performanceSamples=[];
    console.log('RECORD: real wall-clock night, no time acceleration');
    const night=await boot(browser,'night',{record:true,label:'night-real-time'});const recordingBegan=Date.now();
    await tap(night.page,'#d1-replay','Start continuous 30-second night');const replayAt=Date.now();
    for(const seconds of [0,6,12,17,23,27,30.2]){
      if(seconds)await waitNight(night.page,seconds);else await waitNight(night.page,.04);
      const data=await nightData(night.page),name=`night-${seconds.toFixed(1).padStart(4,'0')}-390`;
      const file=await screenshot(night.page,name);nightKeyframes.push({requestedSeconds:seconds,wallFromReplayMs:Date.now()-replayAt,file,...data});console.log(`Night ${data.seconds.toFixed(2)}s: ${data.phase}`);
    }
    assert(nightKeyframes.at(-1).phase==='done','Night did not finish its return');
    const start=nightKeyframes[0],end=nightKeyframes.at(-1),elapsedStoryMs=(end.seconds-start.seconds)*1000,elapsedWallMs=end.wallFromReplayMs-start.wallFromReplayMs;
    assert(Math.abs(elapsedStoryMs-elapsedWallMs)<1000,'Night storyboard time differs from wall clock');
    saveAudits.push(await auditSave(night.page,'night real time'));await night.page.waitForTimeout(800);
    records.push({study:'night',build:night.build,loadWallMs:night.loadWallMs,wallFromLoadedMs:Date.now()-recordingBegan,eventWallMs:elapsedWallMs,eventStoryMs:elapsedStoryMs,...await finishVideo(night.page,night.context,'night-operations-real-30s')});
    console.log('RECORD: real wall-clock receipt installation');
    const receipt=await boot(browser,'receipt',{record:true,label:'receipt-real-time'});const receiptBegan=Date.now();
    await tap(receipt.page,'#receipt-install','Start 11.8-second receipt installation');const installAt=Date.now();
    await receipt.page.waitForFunction(()=>document.querySelector('#receipt-install').dataset.playing==='false',{},{timeout:16000});
    const installationWallMs=Date.now()-installAt,installed=await receiptData(receipt.page);
    assert(installationWallMs>=11700&&installed.tier===3&&installed.install===1,'Receipt did not complete all four installation stages in real time');
    saveAudits.push(await auditSave(receipt.page,'receipt real time'));await receipt.page.waitForTimeout(900);
    records.push({study:'receipt',build:receipt.build,loadWallMs:receipt.loadWallMs,wallFromLoadedMs:Date.now()-receiptBegan,installationWallMs,final:installed,...await finishVideo(receipt.page,receipt.context,'receipt-installation-real-12s')});
    console.log('RECORD four receipt specimens in one continuous observation');
    const specimen=await boot(browser,'receipt',{record:true,label:'receipt-specimen-real-time'});
    await specimenView(specimen.page);
    const specimenAt=Date.now(),specimenStages=[];
    for(const tier of [0,1,2,3]){
      const began=Date.now();
      const data=await selectReceiptTier(specimen.page,tier,{settleMs:3000});
      specimenStages.push({requestedTier:tier,fromStartMs:began-specimenAt,heldWallMs:Date.now()-began,...data});
    }
    const observationWallMs=Date.now()-specimenAt;
    assert(observationWallMs>=12000&&observationWallMs<16000,'Four-tier paper observation must run for 12 to 16 real seconds.');
    assertReceiptAlignment(specimenStages);
    saveAudits.push(await auditSave(specimen.page,'four-tier paper real time'));
    records.push({study:'receipt-specimen',build:specimen.build,loadWallMs:specimen.loadWallMs,observationWallMs,stages:specimenStages,...await finishVideo(specimen.page,specimen.context,'receipt-specimen-four-tiers-real-12s')});
    console.log('CAPTURE: same-camera tier comparisons');
    const stills=await boot(browser,'receipt',{label:'receipt-stills'});
    for(const tier of [0,1,2,3]){
      await selectReceiptTier(stills.page,tier);
      const file=await screenshot(stills.page,`receipt-lv${tier}-focus-390`),data=await receiptData(stills.page);receiptTiers.push({file,...data});
      await stills.page.locator('#receipt-focus').screenshot({path:`${out}/receipt-lv${tier}-focus-canvas.png`,scale:'css'});
    }
    assertReceiptAlignment(receiptTiers);
    await tap(stills.page,'#receipt-view','Show tier 3 in original room');await stills.page.waitForFunction(()=>document.querySelector('#receipt-focus').dataset.view==='room');await stills.page.waitForTimeout(450);
    const room={file:await screenshot(stills.page,'receipt-lv3-room-390'),...await receiptData(stills.page)};
    await specimenView(stills.page);
    for(const tier of [0,1,2,3]){
      const data=await selectReceiptTier(stills.page,tier);
      const file=await screenshot(stills.page,`receipt-lv${tier}-specimen-390`,{fullPage:true});
      const canvasFile=`receipt-lv${tier}-specimen-canvas.png`;
      await stills.page.locator('#receipt-focus').screenshot({path:`${out}/${canvasFile}`,scale:'css'});
      specimenTiers.push({file,canvasFile,...data});
    }
    assertReceiptAlignment(specimenTiers);
    saveAudits.push(await auditSave(stills.page,'receipt cabinet and specimen comparisons'));
    await stills.context.close();
    for(const engine of [chromium,webkit]){
      console.log(`MEASURE: ${engine.name()} 6-second desktop mobile emulation`);
      const measurementBrowser=await engine.launch(),probe=await boot(measurementBrowser,'night',{label:`performance-${engine.name()}`});
      const measured=await probe.page.evaluate(async()=>{
        window.__D1_REVIEW__.resetMetrics();const intervals=[];let start=performance.now(),last=start;
        await new Promise(resolve=>{function frame(now){intervals.push(now-last);last=now;if(now-start<6000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
        const sorted=[...intervals].sort((a,b)=>a-b);
        return {windowMs:performance.now()-start,rafSamples:intervals.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...intervals),over50ms:intervals.filter(x=>x>50).length,scene:window.__D1_REVIEW__.metrics()};
      });
      saveAudits.push(await auditSave(probe.page,`6-second ${engine.name()} night probe`));
      await probe.context.close();
      const paperProbe=await boot(measurementBrowser,'receipt',{label:`paper-performance-${engine.name()}`});
      await specimenView(paperProbe.page);
      await selectReceiptTier(paperProbe.page,3);
      const paper=await measurePaper(paperProbe.page);
      assert(paper.renderedFrames>0&&paper.samples.every(sample=>Number.isFinite(sample.drawMs)),'Paper renderer did not provide valid unique-frame samples.');
      assert(paper.samples.every((sample,index)=>index===0||sample.frame>paper.samples[index-1].frame),'Paper frame counter reset during measurement.');
      assert(paper.final.view==='specimen'&&paper.final.tier===3,'Paper probe left the Lv3 observation camera.');
      performanceSamples.push({engine:engine.name(),desktopMobileEmulation:true,...measured,paper});
      saveAudits.push(await auditSave(paperProbe.page,`6-second ${engine.name()} paper probe`));
      await paperProbe.context.close();
      await measurementBrowser.close();
    }
    assert(errors.length===0,`Capture errors: ${JSON.stringify(errors)}`);assert(dirtySource().length===0,'Source changed during recording; repeat with a stable build.');
    const finalCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    assert(finalCommit===sourceCommit,'Source commit changed during recording. Rehearse and record the final commit again.');
    const result={at:new Date().toISOString(),sourceCommit,build:night.build,base,output:out,rawDirectory:raw,method:'390×844, 2× device scale, desktop native-touch emulation. Videos follow real wall-clock animation with native taps. Runtime paper frequency is counted from unique data-frame values. Existing in-game captions remain visible.',phone:'Physical TapTap/WebView review is pending. These records use desktop browser mobile emulation.',host:{cpu:os.cpus()[0].model,platform:os.platform(),release:os.release()},viewport:options.viewport,deviceScaleFactor:2,hasTouch:true,rehearsal:{sourceCommit:prior.sourceCommit,build:prior.build,at:prior.at,passed:prior.passed},records,nightKeyframes,receiptTiers,specimenTiers,room,performanceSamples,saveAudits,clicks,errors};
    await writeFile(`${out}/recordings.json`,JSON.stringify(result,null,2)+'\n');
    await writeGallery(result);
    console.log(`D1 CAPTURE COMPLETE: ${night.build}`);
  }
}finally{await browser.close();}
