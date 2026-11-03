import {chromium, webkit} from '@playwright/test';
import {mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4187';
const out = 'artifacts/v033';
const raw = 'artifacts/raw-video/v033';
const mode = process.argv.includes('--discover') ? 'discover' : process.argv.includes('--rehearse') ? 'rehearse' : 'record';
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const sourcePaths = ['src','assets','package.json','package-lock.json','index.html','vite.config.ts','vite.d1.config.ts','scripts/capture_v033.mjs'];
const dirtySource = () => execFileSync('git', ['status','--porcelain','--',...sourcePaths], {encoding:'utf8'}).trim().split('\n').filter(Boolean);
const options = {viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const errors = [], inputs = [], audits = [];
await mkdir(out, {recursive:true});
await mkdir(raw, {recursive:true});
function assert(value, message) { if (!value) throw Error(message); }
async function boot(browser, study, record=false) {
  const context = await browser.newContext({...options,...(record ? {recordVideo:{dir:raw,size:options.viewport}} : {})});
  const page = await context.newPage();
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    localStorage.setItem('loststar.save.v1','V033-PRESERVE-SAVE');
    localStorage.setItem('loststar.preferences.v1','V033-PRESERVE-PREFERENCES');
    const calls = [];
    for (const key of ['getItem','setItem','removeItem','clear']) {
      const original = Storage.prototype[key];
      Storage.prototype[key] = function(...args) { calls.push({method:key,key:args[0]}); return original.apply(this,args); };
    }
    window.__v033Audit = {calls,strings:()=>[get.call(localStorage,'loststar.save.v1'),get.call(localStorage,'loststar.preferences.v1')]};
    document.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      const ring = document.createElement('i');
      ring.style.cssText = `position:fixed;left:${event.clientX-10}px;top:${event.clientY-10}px;width:20px;height:20px;border:2px solid #ffe5ab;border-radius:50%;pointer-events:none;z-index:99999`;
      document.body.append(ring);
      ring.animate([{opacity:1,transform:'scale(.7)'},{opacity:0,transform:'scale(1.5)'}],{duration:350});
      setTimeout(()=>ring.remove(),360);
    });
  });
  page.on('pageerror', error => errors.push({study,message:error.message}));
  page.on('response', response => {if(response.status()>=400) errors.push({study,status:response.status(),url:response.url()});});
  page.on('requestfailed', request => errors.push({study,url:request.url(),message:request.failure()?.errorText}));
  await page.goto(`${base}/?sample=${study}-d1`, {waitUntil:'domcontentloaded'});
  await page.locator(study==='night'?'#d1-scene canvas[data-ready=true]':'#receipt-focus[data-ready=true]').waitFor({timeout:45000});
  const build = await page.locator('html').getAttribute('data-build');
  if (mode==='record') {
    assert(build.includes(sourceCommit.slice(0,7))&&!build.includes('本地修改'),`Wrong or dirty build ${build}`);
  }
  return {context,page,build};
}
async function audit(page, label) {
  const result = await page.evaluate(()=>({calls:window.__v033Audit.calls,strings:window.__v033Audit.strings()}));
  assert(result.calls.length===0,`${label} accessed Storage`);
  assert(result.strings.join('|')==='V033-PRESERVE-SAVE|V033-PRESERVE-PREFERENCES',`${label} changed sentinels`);
  audits.push({label,...result});
}
async function tap(page, selector) {
  const target = page.locator(selector);
  assert(await target.count()===1,`Ambiguous target ${selector}`);
  await target.scrollIntoViewIfNeeded();
  const bounds = await target.boundingBox();
  assert(bounds&&bounds.width>=44&&bounds.height>=44,`Small touch target ${selector}`);
  await target.tap();
  inputs.push({selector,at:new Date().toISOString(),method:'native touchscreen tap'});
}
async function frame(page, selector) { return page.locator(selector).evaluate(canvas=>({...canvas.dataset})); }
async function screenshot(page, file) { await page.screenshot({path:`${out}/${file}`,scale:'css'}); return file; }
async function video(page, context, file) {
  const recording = page.video();
  await context.close();
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',await recording.path(),'-r','30','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${file}`]);
  const seconds = Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',`${out}/${file}`],{encoding:'utf8'}));
  return {file,seconds,bytes:(await stat(`${out}/${file}`)).size,playbackRate:1};
}
async function research(page, level) {
  await tap(page,`button[data-research-tier="${level}"]`);
  await tap(page,'#receipt-experiment');
}
async function complete(page) {
  await page.locator('#receipt-reading-result[data-phase=done]').waitFor({timeout:7000});
}
async function paperMetrics(page) {
  return page.evaluate(async()=>{
    const canvas=document.querySelector('#receipt-focus'),start=performance.now(),samples=[];
    let previous=Number(canvas.dataset.frame);
    await new Promise(resolve=>{function poll(now){
      const value=Number(canvas.dataset.frame);
      if(value!==previous){samples.push(Number(canvas.dataset.drawMs));previous=value;}
      if(now-start>=6000)resolve();else requestAnimationFrame(poll);
    }requestAnimationFrame(poll);});
    const windowMs=performance.now()-start,sorted=[...samples].sort((a,b)=>a-b);
    return {windowMs,uniqueFrames:samples.length,actualHz:samples.length/(windowMs/1000),meanDrawMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95DrawMs:sorted[Math.floor(sorted.length*.95)],maxDrawMs:sorted.at(-1),scope:'Complete MuseumScene.renderFocused CPU calls during one real 3.8-second research trial and the remaining idle portion of a six-second window.',samples};
  });
}
const browser=await chromium.launch();
try {
  if(mode==='discover'){
    const probe=await boot(browser,'night');
    const night=await probe.page.locator('button,summary,select').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().height>0).map(node=>({tag:node.tagName,id:node.id,text:node.textContent.trim()})));
    await tap(probe.page,'button[data-study=receipt]');
    await probe.page.locator('#receipt-focus[data-ready=true]').waitFor();
    await tap(probe.page,'#receipt-research summary');
    const receipt=await probe.page.locator('button,summary,select').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().height>0).map(node=>({tag:node.tagName,id:node.id,text:node.textContent.trim(),researchLevel:node.dataset.researchTier})));
    await audit(probe.page,'discovery');
    await writeFile(`${out}/discovery.json`,JSON.stringify({at:new Date().toISOString(),sourceCommit,build:probe.build,night,receipt,inputs,errors},null,2));
    await probe.context.close();
  }else if(mode==='rehearse'){
    const discovered=JSON.parse(await readFile(`${out}/discovery.json`,'utf8'));
    assert(discovered.receipt.length>0,'Discover the current UI first');
    const probe=await boot(browser,'night');
    await tap(probe.page,'#d1-environment');
    await probe.page.locator('#d1-scene canvas[data-period=day]').waitFor();
    await tap(probe.page,'#d1-environment');
    await tap(probe.page,'button[data-study=receipt]');
    await probe.page.locator('#receipt-focus[data-ready=true]').waitFor();
    await tap(probe.page,'#receipt-research summary');
    await research(probe.page,3);await complete(probe.page);
    assert(await probe.page.locator('#receipt-reading-result').getAttribute('data-pending')==='2','A result is wrong');
    await probe.page.locator('#receipt-sample').selectOption('B');
    await research(probe.page,3);await complete(probe.page);
    assert(await probe.page.locator('#receipt-reading-result').getAttribute('data-pending')==='1','B result is wrong');
    await audit(probe.page,'rehearsal');
    assert(errors.length===0,'Rehearsal errors');
    await writeFile(`${out}/rehearsal.json`,JSON.stringify({at:new Date().toISOString(),sourceCommit,build:probe.build,dirtySource:dirtySource(),passed:true,inputs,audits,errors},null,2));
    await probe.context.close();
  }else{
    const prior=JSON.parse(await readFile(`${out}/rehearsal.json`,'utf8'));
    assert(prior.passed&&prior.sourceCommit===sourceCommit&&!prior.build.includes('本地修改')&&prior.dirtySource.length===0,'Rehearse this clean production commit first');
    assert(dirtySource().length===0,'Dirty source');
    const night=await boot(browser,'night',true),nightFrames=[];
    await tap(night.page,'#d1-environment');const nightStart=Date.now();
    for(const target of [.2,5,11,18,30,42,47,54.2]){
      await night.page.waitForTimeout(Math.max(0,target*1000-(Date.now()-nightStart)));
      const file=await screenshot(night.page,`world-${target}-390.png`);
      nightFrames.push({target,wallMs:Date.now()-nightStart,file,...await frame(night.page,'#d1-scene canvas')});
    }
    assert(new Set(nightFrames.map(item=>item.period)).size===4,'Missing a day/night phase');
    await audit(night.page,'real 54-second resident cycle');
    const cycleVideo=await video(night.page,night.context,'resident-cycle-live.mp4');
    const receipt=await boot(browser,'receipt',true),researchFrames=[];
    await tap(receipt.page,'#receipt-research summary');
    for(const level of [0,1,2,3]){
      await research(receipt.page,level);const began=Date.now();
      for(const target of [.3,1.8,2.75,4]){
        await receipt.page.waitForTimeout(Math.max(0,target*1000-(Date.now()-began)));
        const file=await screenshot(receipt.page,`research-${level}-${target}-390.png`);
        researchFrames.push({level,target,wallMs:Date.now()-began,file,...await frame(receipt.page,'#receipt-focus')});
      }
    }
    assert(await receipt.page.locator('#receipt-reading-result').getAttribute('data-pending')==='2','A result is wrong');
    await receipt.page.locator('#receipt-sample').selectOption('B');
    inputs.push({selector:'#receipt-sample',value:'B',method:'Playwright selectOption on native HTML select',at:new Date().toISOString()});
    await research(receipt.page,3);await complete(receipt.page);
    const comparison={file:await screenshot(receipt.page,'research-3-B-390.png'),text:await receipt.page.locator('#receipt-reading-result').textContent(),pending:await receipt.page.locator('#receipt-reading-result').getAttribute('data-pending')};
    assert(comparison.pending==='1','B result is wrong');
    await audit(receipt.page,'real receipt capability interaction');
    const receiptVideo=await video(receipt.page,receipt.context,'receipt-capability-live.mp4');
    const performance=[];
    for(const engine of [chromium,webkit]){
      const measurementBrowser=await engine.launch(),world=await boot(measurementBrowser,'night');
      const worldMetrics=await world.page.evaluate(async()=>{
        window.__D1_REVIEW__.resetMetrics();const start=performance.now(),intervals=[];let last=start;
        await new Promise(resolve=>{function poll(now){intervals.push(now-last);last=now;if(now-start>=6000)resolve();else requestAnimationFrame(poll);}requestAnimationFrame(poll);});
        const sorted=[...intervals].sort((a,b)=>a-b);
        return {windowMs:performance.now()-start,rafSamples:intervals.length,p95RafMs:sorted[Math.floor(sorted.length*.95)],over50ms:intervals.filter(x=>x>50).length,scene:window.__D1_REVIEW__.metrics()};
      });
      await audit(world.page,`${engine.name()} world metrics`);await world.context.close();
      const paper=await boot(measurementBrowser,'receipt');await tap(paper.page,'#receipt-research summary');await research(paper.page,3);
      const paperMeasured=await paperMetrics(paper.page);
      assert(paperMeasured.uniqueFrames>0&&Number.isFinite(paperMeasured.meanDrawMs),'Missing actual paper render samples');
      await audit(paper.page,`${engine.name()} paper metrics`);
      performance.push({engine:engine.name(),world:worldMetrics,paper:paperMeasured});
      await paper.context.close();await measurementBrowser.close();
    }
    assert(errors.length===0,'Recording errors');
    assert(dirtySource().length===0&&execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===sourceCommit,'Source changed during recording');
    const result={at:new Date().toISOString(),sourceCommit,build:night.build,method:'390×844 desktop mobile touch emulation, actual wall-clock videos. D1 intentionally compresses day/dusk/night/dawn to 54 seconds, while all poses run at normal animation speed. Ordinary gameplay keeps its persistent four-minute day and one-minute night.',physicalPhone:'Pending TapTap QR review',host:{cpu:os.cpus()[0].model,platform:os.platform()},cycleVideo,receiptVideo,nightFrames,researchFrames,comparison,performance,inputs,audits,errors};
    await writeFile(`${out}/recordings.json`,JSON.stringify(result,null,2));
    const images=nightFrames.map(item=>`<figure><img src="${item.file}" alt="${item.period}"><figcaption>${item.target}s · ${item.period}</figcaption></figure>`).join('');
    const papers=researchFrames.filter(item=>item.target===1.8).map(item=>`<figure><img src="${item.file}" alt="收据研究${item.level}"><figcaption>研究${item.level} · 同一免费玻璃罩</figcaption></figure>`).join('');
    const gallery = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>失物星球 · 居民作息与收据能力</title>
  <style>
    body { margin:0; background:#171225; color:#eadcc8; font:15px/1.7 system-ui }
    main { max-width:1050px; margin:auto; padding:24px 16px }
    h1 { font-size:25px } h2 { font-size:19px; margin-top:30px }
    p { color:#bcadc6 } a { color:#b5ddcb }
    video { display:block; width:min(100%,390px); max-height:80vh; background:#0b0916 }
    .videos { display:flex; gap:22px; flex-wrap:wrap }
    .gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(185px,1fr)); gap:12px }
    figure { margin:0; padding:8px; border:1px solid #766078 }
    img { display:block; width:100%; image-rendering:pixelated }
    figcaption { font-size:12px; color:#c1aec8 } code { overflow-wrap:anywhere }
  </style>
</head>
<body><main>
  <h1>失物星球 · 居民作息与收据能力</h1>
  <p>${night.build} · <code>${sourceCommit}</code></p>
  <p>以下均为真实墙钟桌面移动触控仿真。TapTap手机视觉与长时表现待扫码复审。</p>
  <p><a href="../d1-refinement/">0.3.2旧版对照</a> · <a href="recordings.json">原始录制与采样</a> · <a href="validation.json">测试记录</a></p>
  <div class="videos">
    <article>
      <h2>54秒居民昼夜对照</h2>
      <video controls playsinline src="${cycleVideo.file}"></video>
      <p>D1缩短阶段长度以便比较，角色动作速度保持真实时间。</p>
    </article>
    <article>
      <h2>收据自身能力与输入核验</h2>
      <video controls playsinline src="${receiptVideo.file}"></video>
      <p>四级研究与柜体独立，样例增补签收后，未发生事项由2变为1。</p>
    </article>
  </div>
  <h2>原远征真实持续游玩</h2>
  <video controls playsinline src="main-resident-cycle-real-310s.mp4"></video>
  <p>新浏览器自然游玩并发现居民，随后保留该存档录制完整310秒。普通游戏维持4分钟白天与1分钟夜晚。</p>
  <h2>昼夜关键帧</h2>
  <div class="gallery">${images}</div>
  <h2>同一免费玻璃罩中的四级能力</h2>
  <div class="gallery">${papers}</div>
  <h2>审核边界</h2>
  <p>收据研究为D1本体能力样板，使用本地样例回执。正式研究成长存档的接入遵循样板审核门槛。居民作息已接普通远征持久世界时钟。</p>
</main></body></html>`;
    await writeFile(`${out}/index.html`,gallery);
    console.log(JSON.stringify({sourceCommit,cycleVideo,receiptVideo,audits:audits.length,errors}));
  }
} finally { await browser.close(); }
