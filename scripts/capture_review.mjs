import {chromium,webkit} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const base=process.env.BASE_URL??'http://127.0.0.1:4173';
const out='artifacts/phase1-5';await mkdir(out,{recursive:true});await mkdir(`${out}/audio`,{recursive:true});
const browser=await chromium.launch();
const options={viewport:{width:390,height:844},deviceScaleFactor:2};
// A real cold context with cache disabled and a measured, throttled network. No seeded save.
const cold=await browser.newContext({...options,recordVideo:{dir:'artifacts/raw-video',size:options.viewport}});
const page=await cold.newPage(),cdp=await cold.newCDPSession(page),requests=new Map();
await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:180,downloadThroughput:96*1024,uploadThroughput:64*1024,connectionType:'cellular3g'});
cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{path:new URL(e.request.url).pathname,start:e.timestamp}));
cdp.on('Network.responseReceived',e=>Object.assign(requests.get(e.requestId)??{},{status:e.response.status,fromDiskCache:!!e.response.fromDiskCache,mime:e.response.mimeType}));
cdp.on('Network.loadingFinished',e=>Object.assign(requests.get(e.requestId)??{},{end:e.timestamp,encodedBytes:e.encodedDataLength}));
const began=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});
await page.locator('.base-scene[data-background-state=loading]').waitFor();await page.screenshot({path:`${out}/cold-base-loading.png`,scale:'css'});
await page.locator('.base-scene[data-background-state=ready]').waitFor({timeout:45000});
await page.locator('.base-scene').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
const readyMs=Date.now()-began;await page.screenshot({path:`${out}/cold-base-ready.png`,scale:'css'});await page.waitForTimeout(2000);
const coldVideo=page.video();await writeFile(`${out}/cold-network.json`,JSON.stringify({conditions:{cache:false,latencyMs:180,downloadBytesPerSec:96*1024,uploadBytesPerSec:64*1024},baseReadyWallMs:readyMs,requests:[...requests.values()]},null,2)+'\n');await cold.close();
execFileSync('ffmpeg',['-y','-loglevel','error','-i',await coldVideo.path(),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/cold-base-first-visit.mp4`]);
console.log(`Real cold base ready in ${readyMs}ms under desktop network throttling.`);
for(const width of [360,390]){
 const cx=await browser.newContext({viewport:{width,height:width===360?800:844}}),p=await cx.newPage();await p.goto(base+'/?start=expedition&review=1');await p.locator('canvas[data-ready]').waitFor();await p.evaluate(()=>window.__review.freeze(4.8));
 for(const textSize of ['normal','large','system150']){
  if(textSize!=='system150')await p.evaluate(v=>document.documentElement.dataset.textSize=v,textSize);else await p.addStyleTag({content:'html{font-size:150%!important}'});
  for(const [name,id] of [['远征','expedition'],['星图','radar']]){await p.getByRole('button',{name,exact:true}).click();await p.screenshot({path:`${out}/${width}-${id}-${textSize}.png`,scale:'css'});}
 }
 await cx.close();
}
// Simulated effective-time milestones are explicitly separate from the continuous recording.
const cx=await browser.newContext(options),p=await cx.newPage();await p.clock.install({time:new Date('2026-11-02T19:00:00Z')});await p.goto(base);
const milestones=[];let last=0;
for(const minute of [15,30,60]){
 let ms=minute*60000-last;for(;ms>0;ms-=10000){await p.clock.fastForward(Math.min(ms,10000));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('loststar.save.v1')).lastAt>=Date.now()-500);}last=minute*60000;
 await p.locator('#field-journal').screenshot({path:`${out}/journal-${minute}min.png`,scale:'css'});
 milestones.push({effectiveMinutes:minute,...await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('loststar.save.v1'));return {cycles:s.cycles,journal:s.journal,collectionCount:s.collection.length,planets:s.planets};})});
}
await writeFile(`${out}/pacing.json`,JSON.stringify({method:'Playwright simulated effective time, no upgrades. Not a real-time 60-minute stability test.',milestones},null,2)+'\n');await cx.close();
// Render exactly the same original code motifs to reviewable WAV files without autoplay.
const audio=await browser.newPage();await audio.goto('http://127.0.0.1:5173/');
const audioMetadata=[];
for(const cue of ['scan','pickup','discovery-glitch','return']){
 const samples=await audio.evaluate(async cue=>{const {scheduleMotif}=await import('/src/ui/audio.ts');const ctx=new OfflineAudioContext(1,44100,44100);scheduleMotif(ctx,ctx.destination,cue,0);return [...(await ctx.startRendering()).getChannelData(0)];},cue);
 const pcm=Buffer.alloc(44+samples.length*2);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(44100,24);pcm.writeUInt32LE(88200,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));await writeFile(`${out}/audio/${cue}.wav`,pcm);
 audioMetadata.push({cue,sampleRate:44100,seconds:1,peak:Math.max(...samples.map(Math.abs)),bytes:pcm.length});
}
await writeFile(`${out}/audio/metadata.json`,JSON.stringify(audioMetadata,null,2)+'\n');await browser.close();
// Keep the anomalous first WebKit sample in the main report; independently probe
// a full six-second wall-clock window rather than inferring FPS from a median.
const safari=await webkit.launch(),probe=await safari.newPage(options);
await probe.goto(base+'/?review=1&start=expedition');await probe.locator('canvas[data-ready]').waitFor();
await probe.evaluate(()=>{window.__review.scene.resetMetrics();window.__frameProbe={start:performance.now(),last:performance.now(),intervals:[],running:true};function frame(now){const r=window.__frameProbe;if(!r.running)return;r.intervals.push(now-r.last);r.last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
await probe.waitForTimeout(6000);
const diagnostic=await probe.evaluate(()=>{const r=window.__frameProbe;r.running=false;const a=r.intervals;return {wallMs:performance.now()-r.start,count:a.length,meanMs:a.reduce((s,v)=>s+v,0)/a.length,maxMs:Math.max(...a),over50ms:a.filter(v=>v>50).length,over100ms:a.filter(v=>v>100).length,scene:window.__review.scene.metrics()};});
await writeFile(`${out}/webkit-diagnostic.json`,JSON.stringify(diagnostic,null,2)+'\n');await safari.close();
// Enlargements come from the new unsped runtime source, not posed screenshots.
for(const [name,start,duration,crop] of [['warehouse-exit',0,3,'210:165:70:265'],['pickup-handoff',5.5,2.5,'170:160:165:230'],['unload-handoff',10.6,2.4,'170:160:95:275'],['ship-orbit',0,14,'390:350:0:180']]){
 execFileSync('ffmpeg',['-y','-loglevel','error','-ss',String(start),'-i','artifacts/phase1/expedition-42s.mp4','-t',String(duration),'-vf',`crop=${crop},scale=iw*3:ih*3:flags=neighbor`,'-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${name}-zoom.mp4`]);
}
// A frame-by-frame contact sheet preserves real-time labels and links back to the source video.
const frames=[];
for(const [i,t] of [5.6,5.9,6.3,6.7,7.1,7.5,10.9,11.2,11.5,11.8,12.1,12.4].entries()){
 const file=`${out}/frame-${i}.png`;execFileSync('ffmpeg',['-y','-loglevel','error','-ss',String(t),'-i','artifacts/phase1/expedition-42s.mp4','-frames:v','1','-vf','crop=240:230:80:225,scale=480:460:flags=neighbor',file]);
 const caption=Buffer.from(`<svg width="480" height="32"><rect width="480" height="32" fill="#211a30"/><text x="12" y="23" fill="#f7dcac" font-size="18">Runtime source ${t.toFixed(1)}s</text></svg>`);
 const tile=await sharp({create:{width:480,height:492,channels:4,background:'#211a30'}}).composite([{input:file,top:32,left:0},{input:caption,top:0,left:0}]).png().toBuffer();frames.push({input:tile,left:i%4*480,top:Math.floor(i/4)*492});
}
await sharp({create:{width:1920,height:1476,channels:4,background:'#211a30'}}).composite(frames).png().toFile(`${out}/contact-sheet.png`);
console.log('Cold loading, 125%/150% typography, journal, original audio, and continuous-source zoom evidence captured.');

execFileSync('ffmpeg',['-y','-loglevel','error','-i','artifacts/phase1/expedition-42s.mp4','-vf','fps=1/3,scale=195:422,tile=7x2','-frames:v','1','-q:v','3','artifacts/phase1/continuous-contact-sheet.jpg']);
