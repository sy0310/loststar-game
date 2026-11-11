/* Render the actual WebAudio bank offline. No external music is decoded here. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const http=require('node:http');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../../../..');
const {chromium}=require(path.join(ROOT,'node_modules/@playwright/test'));
const engine=path.join(ROOT,'prototypes/salvage-survivor-demo/src/audio-engine.js');
const output=path.join(__dirname,'auditions');
const weapons=['cannon','drone','arc','missile','blade','shield','prism','gravity'];
const events=['hit','explosion','pickup','scrap','heal','hurt','upgrade','evolution','fusion','boss','victory','defeat'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const server=http.createServer((request,response)=>{
 if(request.url==='/audio-engine.js'){
  response.setHeader('Content-Type','application/javascript');response.end(fs.readFileSync(engine));
 }else{
  response.setHeader('Content-Type','text/html');response.end('<!doctype html><meta charset="utf-8"><script src="/audio-engine.js"></script>');
 }
});
async function render(page,id,options){
 return page.evaluate(async({id,options})=>{
  const result=await SurvivorAudio.renderOffline(id,options);
  const buffer=result.buffer,channels=buffer.numberOfChannels,length=buffer.length;
  const wav=new ArrayBuffer(44+length*channels*2),view=new DataView(wav);
  const text=(offset,value)=>{for(let index=0;index<value.length;index++)view.setUint8(offset+index,value.charCodeAt(index));};
  text(0,'RIFF');view.setUint32(4,36+length*channels*2,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
  view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*channels*2,true);
  const data=Array.from({length:channels},(_,index)=>buffer.getChannelData(index));
  let peak=0,squares=0,sum=0,offset=44;
  for(let frame=0;frame<length;frame++)for(let channel=0;channel<channels;channel++){
   const value=Math.max(-1,Math.min(1,data[channel][frame]));peak=Math.max(peak,Math.abs(value));squares+=value*value;sum+=value;
   view.setInt16(offset,Math.round(value*(value<0?32768:32767)),true);offset+=2;
  }
  let binary='';const bytes=new Uint8Array(wav);
  for(let index=0;index<bytes.length;index+=8192)binary+=String.fromCharCode(...bytes.subarray(index,index+8192));
  return{base64:btoa(binary),duration:buffer.duration,sampleRate:buffer.sampleRate,channels,
   peak,peakDbfs:20*Math.log10(Math.max(peak,1e-9)),rms:Math.sqrt(squares/(length*channels)),dcMean:sum/(length*channels),stats:result.stats};
 },{id,options});
}
(async()=>{
 const engineSha=hash(fs.readFileSync(engine));
 fs.mkdirSync(output,{recursive:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch();
 const rows=[];
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const cues=[...weapons.map(id=>({id,name:id,options:{seconds:1.3}})),
   ...weapons.map(id=>({id,name:id+'-evolved',options:{seconds:1.3,evolved:true}})),
   ...events.map(id=>({id,name:id,options:{seconds:1.3}})),
   {id:'music',name:'original-fallback-music-44s',options:{seconds:43.636364}},
   {id:'stress',name:'bounded-polyphony-stress',options:{seconds:4}}];
  for(const cue of cues){
   const rendered=await render(page,cue.id,cue.options);
   const data=Buffer.from(rendered.base64,'base64');delete rendered.base64;
   assert(rendered.peak>0.0001&&rendered.peak<0.98,cue.name+' peak');
   assert(rendered.stats.maxVoices<=24&&rendered.stats.maxSfx<=18&&rendered.stats.maxMusic<=8,cue.name+' voices');
   const file=path.join(output,cue.name+'.wav');fs.writeFileSync(file,data);
   rows.push({id:cue.id,variant:cue.name,options:cue.options,path:path.relative(ROOT,file),bytes:data.length,sha256:hash(data),...rendered});
   console.log(cue.name,rendered.duration.toFixed(3),'s',rendered.peakDbfs.toFixed(1),'dBFS');
  }
  const state=await page.evaluate(()=>SurvivorAudio.inspect());assert.equal(state.contextCreated,false);
  const report={source:'Actual runtime WebAudio bank rendered with OfflineAudioContext; no playback context or autoplay created.',
   sourcePath:path.relative(ROOT,engine),sourceSha256:engineSha,
   hearingReview:'PENDING_USER',physicalPhoneTested:false,playbackContextCreated:false,cues:rows};
  assert.equal(hash(fs.readFileSync(engine)),engineSha,'Audio source changed while rendering auditions');
  fs.writeFileSync(path.join(__dirname,'audition-report.json'),JSON.stringify(report,null,2)+'\n');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
