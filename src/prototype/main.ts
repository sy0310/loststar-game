import '../style.css';
import './style.css';
import {tapeSpeed,bellHoldMs} from '../game/guard-tuning';
import {growthEffects} from '../game/growth';
import {icon} from '../icons';
import {newGame,restore,advance,tuning,SAVE_KEY,type SaveData} from '../game/engine';
import {ExpeditionScene} from '../render/scene';
import {guardLayer} from '../render/guard-scene';
import {itemArt} from '../ui/art';
import {createGuard,restoreGuard,advanceGuard,equipGuard,setGuardEnabled,previewNight,guardView,guardEvent,guardItems,GUARD_KEY,type GuardItem,type GuardState} from './guard-engine';

const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
let storageOK=true;
function read(key:string){try{return localStorage.getItem(key);}catch{storageOK=false;return null;}}
// Read the validated collection at its original timestamp. No openSave/commitSave,
// no catch-up, no claim and NO writes to the production key from this entry.
function sourceSnapshot():SaveData {
  const raw=read(SAVE_KEY);let at=Date.now();try{const input=JSON.parse(raw??'{}');if(Number.isFinite(input.lastAt))at=input.lastAt;}catch{/* New lab snapshot only. */}
  const s=restore(raw,at);return {...s,lastAt:Date.now(),pendingReturn:null,seenDiscoveries:[...s.collection]};
}
let expedition=sourceSnapshot(),sample=false;
const raw=read(GUARD_KEY);let guard:GuardState;
try {
  const saved=JSON.parse(raw??'null');
  if(saved?.labExpedition&&Number.isFinite(saved.labExpedition.lastAt))expedition=restore(JSON.stringify(saved.labExpedition),saved.labExpedition.lastAt);
  sample=saved?.sample===true;
  guard=restoreGuard(raw,Date.now(),expedition.collection);guard.strengths=growthEffects(sourceSnapshot()).guard;
  if(saved&&guard.enabled){const dayDelta=dayTime(guard.elapsedMs,guard)-dayTime(saved.elapsedMs,guard);expedition=advance(expedition,expedition.lastAt+Math.max(0,dayDelta));}
}catch{guard=createGuard(Date.now(),expedition.collection,growthEffects(expedition).guard);}
let lastSaved=0,lastUI='',notice='';
const phaseNames={day:'白天 · 自动探索',dusk:'黄昏 · 收件站亮灯',night:'夜晚 · 奇物自动守护'};
const itemNames:Record<GuardItem,string>={tape:'道歉胶带',bell:'无人签收铃'};
$('#app').innerHTML=`<div class="device lab-device"><header class="topbar"><div class="brand">${icon('planet')}<span>失物星球<small>退件平原 · 单星实验室</small></span></div><span class="tiny-tag">独立原型</span></header><main><a class="lab-exit secondary" href="./index.html?start=base" aria-label="返回收件站">← 返回收件站</a><header class="page-heading"><span class="eyebrow">NIGHT WATCH / 可关闭实验</span><h1>夜晚，替宇宙看门。</h1><p>两件旧奇物，和一盏不必守着的灯。</p></header><div class="lab-notice game-panel">此页使用独立实验存档。正常探索与收藏保持原样。</div><div class="lab-controls"><button id="guard-toggle" class="primary">开启夜间实验</button><button id="guard-preview" class="secondary">预演夜晚</button></div><div class="guard-phase" id="guard-phase" data-phase="day"><strong></strong><span id="guard-countdown"></span></div><div class="progress lab-progress"><span id="guard-progress"></span></div><div class="scene-wrap lab-scene"><div class="scene-top"><span><i class="live-dot"></i><b id="guard-channel">实验待命</b></span><span>退件平原 / 守护预演</span></div><div id="night-scene"></div><div class="scene-bottom"><span>收藏不会丢失</span><span>自动守护 · 无需连点</span></div></div><div id="guard-live" class="guard-live game-panel" hidden></div><section class="guard-equipment"><div class="section-title"><span>让奇物照看两个位置</span><small id="guard-source"></small></div><div class="guard-slot-grid">${[0,1].map(i=>`<label class="guard-slot game-panel"><span>守护位 ${i===0?'A':'B'}</span><span class="guard-slot-art" id="guard-art-${i}"></span><select id="guard-slot-${i}" aria-label="守护位${i===0?'A':'B'}"></select><small id="guard-effect-${i}"></small></label>`).join('')}</div><p class="lab-note" id="guard-equipped-note"></p></section><section id="guard-event" class="game-panel guard-event" hidden><span class="micro-label">本原型唯一夜间事件</span><h2>${guardEvent.name}</h2><p>${guardEvent.line}</p><small>咔哒递回封条，失物号照亮返程。不用准时上线。</small></section><div id="guard-report" class="game-panel guard-report"></div><p class="lab-note" id="lab-exploration"></p><div class="lab-tools"><label>实验节奏<select id="guard-pacing"><option value="standard">白天4分钟 / 夜晚1分钟</option><option value="short">白天20秒 / 夜晚10秒（演示）</option></select></label><button id="guard-sample" class="secondary">用两件示例奇物体验</button><button id="guard-reload-source" class="secondary">重新读取正常收藏</button></div><p class="lab-note" id="lab-message" role="status"></p><p class="build-info">夜守独立原型 · v${__BUILD_INFO__.version} · Git ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty?' · 本地修改中':''}</p></main></div>`;
function dayTime(ms:number,s:GuardState){const period=s.dayMs+s.nightMs;return Math.floor(ms/period)*s.dayMs+Math.min(ms%period,s.dayMs);}
function visual(){return guardView({...guard,elapsedMs:guard.elapsedMs+(guard.enabled?Math.max(0,Date.now()-guard.lastAt):0)});}
const scene=new ExpeditionScene($('#night-scene'),()=>{
  const v=visual();
  return {...expedition,cycleMs:!guard.enabled?tuning(expedition).scanner*.999:v.phase==='night'?v.nightBase*1000%tuning(expedition).scanner:expedition.cycleMs};
},guardLayer(visual));scene.setActive(true);
function persist(force=false){
  const now=Date.now();if(!force&&now-lastSaved<1000)return;
  try{localStorage.setItem(GUARD_KEY,JSON.stringify({...guard,labExpedition:expedition,sample}));lastSaved=now;storageOK=true;}catch{storageOK=false;}
}
function advanceLab(now=Date.now()){
  const previous=guard;guard=advanceGuard(guard,now);
  const dayDelta=dayTime(guard.elapsedMs,guard)-dayTime(previous.elapsedMs,previous);
  if(previous.enabled&&dayDelta>0)expedition=advance(expedition,expedition.lastAt+dayDelta);
  guard.owned=guardItems.filter(id=>expedition.collection.includes(id));
}
function update(){
  const v=visual();$('#guard-phase').dataset.phase=v.phase;$('#guard-phase strong').textContent=guard.enabled?phaseNames[v.phase]:'实验关闭 · 灯仍为你留着';
  $('#guard-countdown').textContent=guard.enabled?`${Math.ceil(v.untilNextMs/1000)} 秒后${v.phase==='night'?'天亮':'入夜'}`:'开启后才计时';
  $('#guard-progress').style.width=guard.enabled?`${(1-v.untilNextMs/(v.phase==='night'?guard.nightMs:guard.dayMs))*100}%`:'0%';
  $('#guard-channel').textContent=guard.enabled?(v.phase==='night'?'失物号与咔哒正在巡守':'咔哒正在自动收集'):'默认关闭 / 独立预演';
  $('#guard-toggle').textContent=guard.enabled?'暂停夜间实验':'开启夜间实验';
  const controls=JSON.stringify([guard.slots,guard.owned,guard.strengths,sample]);
  if(controls!==lastUI){
    lastUI=controls;
    for(let i=0;i<2;i++){
      const select=$<HTMLSelectElement>(`#guard-slot-${i}`);select.innerHTML=`<option value="">空位 · 由老搭档照看</option>${guard.owned.map(id=>`<option value="${id}">${itemNames[id]}</option>`).join('')}`;select.value=guard.slots[i]??'';
      const id=guard.slots[i];$(`#guard-art-${i}`).innerHTML=id?itemArt(id):icon('rocket');
      $(`#guard-effect-${i}`).textContent=id==='tape'?`区域减速 ${Math.round((1-tapeSpeed(guard.strengths[i]))*100)}% · 延长封条核对时间`:id==='bell'?`每6秒震荡 · 停顿 ${(bellHoldMs(guard.strengths[i])/1000).toFixed(1)} 秒`:'失物号巡灯，咔哒礼貌送回';
    }
  }
  $('#guard-source').textContent=sample?'示例收藏':`收藏快照 · 装置 ${guard.strengths[0]} / ${guard.strengths[1]}`;
  $('#guard-equipped-note').textContent=v.phase==='night'?'夜间调整将在下一夜生效；此刻按入夜配置自动照看。':'白天可以慢慢调整。关掉屏幕，也会按配置自动守护。';
  $('#guard-event').hidden=v.phase!=='night';
  const live=$('#guard-live');live.hidden=v.phase!=='night';live.dataset.intercepted=String(v.nightStatus.intercepted);live.dataset.arrived=String(v.nightStatus.arrived);
  live.innerHTML=`<span>提前核验 <b>${v.nightStatus.intercepted} / 3</b></span><span>抵站访客 <b>${v.nightStatus.arrived}</b></span><small>封条核对满 10.5 秒即提前拦退；抵站也会安全送回。</small>`;
  const report=guard.lastReport,result=report?.result;
  $('#guard-report').dataset.intercepted=String(report?.intercepted??0);
  $('#guard-report').innerHTML=report?`<span class="micro-label">清晨自动记入实验日志 · 无需领取</span><h2>第 ${report.number} 夜 · 已平安归航</h2><p>${report.summary}</p>${result?`<strong class="guard-quality">${result.quality} · +${result.clues} 实验线索</strong><div class="visitor-results">${result.actors.map(a=>`<div data-visitor-result="${a.id}"><span>影子 ${String(a.id+1).padStart(2,'0')}<small>夜间 ${(a.atMs/1000).toFixed(1)}s</small></span><strong>${a.outcome==='intercepted'?'抵站前核验':'抵站后安全送回'}</strong><small>减速 ${(a.slowMs/1000).toFixed(1)}s · 停顿 ${(a.stunMs/1000).toFixed(1)}s<br>封条核对 ${(a.verificationMs/1000).toFixed(1)}s</small></div>`).join('')}</div>`:`<p class="legacy-night-note">这是旧版演示日志，历史线索已保留；下一夜按新模型逐个核验。</p>`}<div class="guard-stats"><span>新模型核验 <b>${guard.reports.verifiedNights} 夜</b></span><span>累计实验线索 <b>${guard.reports.clues}</b></span></div>`:`<span class="micro-label">收件站值班簿</span><h2>还没有夜间记录</h2><p>减速和声波争取核对封条的时间。没有奇物，也会由老搭档安全送回。</p>`;
  $('#lab-exploration').textContent=`实验白天完成 ${expedition.cycles} 次巡回 · 收录 ${expedition.collection.length} 份首星档案。新增记录只留在本实验。`;
  $('#lab-message').textContent=storageOK?notice:'浏览器暂时无法保存实验进度，本次打开仍可继续。正常存档未被写入。';
}
for(let i=0;i<2;i++)$(`#guard-slot-${i}`).addEventListener('change',()=>{advanceLab();guard=equipGuard(guard,i as 0|1,($<HTMLSelectElement>(`#guard-slot-${i}`).value||null) as GuardItem|null);persist(true);update();});
$('#guard-toggle').addEventListener('click',()=>{advanceLab();guard=setGuardEnabled(guard,!guard.enabled,Date.now());notice=guard.enabled?'实验开始。白天收集，夜间自动照看。':'实验暂停。正常探索不受影响。';persist(true);update();});
$('#guard-preview').addEventListener('click',()=>{advanceLab();guard=previewNight(guard,Date.now());notice='已进入夜晚预演；跳过的白天不发奖励，不改变正常收藏。';persist(true);update();});
function resetSource(useSample:boolean){
  expedition=sourceSnapshot();sample=useSample;
  if(sample){expedition.collection=[...new Set([...expedition.collection,'tape','bell'])];expedition.seenDiscoveries=[...expedition.collection];}
  guard=createGuard(Date.now(),expedition.collection,growthEffects(expedition).guard);lastUI='';notice=sample?'已载入两件示例奇物，仅用于本实验。先配置守护位，再预演夜晚。':'已重新读取正常收藏的快照，实验仍然关闭。';persist(true);update();
}
$('#guard-sample').addEventListener('click',()=>resetSource(true));$('#guard-reload-source').addEventListener('click',()=>resetSource(false));
$<HTMLSelectElement>('#guard-pacing').value=guard.dayMs===20000?'short':'standard';
$('#guard-pacing').addEventListener('change',()=>{
  const slots=guard.slots;guard=createGuard(Date.now(),expedition.collection,growthEffects(expedition).guard);guard.slots=slots;
  if($<HTMLSelectElement>('#guard-pacing').value==='short'){guard.dayMs=20000;guard.nightMs=10000;}
  notice='实验节奏已重置，请重新开启；正常探索没有变化。';persist(true);update();
});
setInterval(()=>{if(!document.hidden&&guard.enabled){advanceLab();persist();update();}},250);
document.addEventListener('visibilitychange',()=>{if(guard.enabled){advanceLab();persist(true);update();}});
if(raw&&guard.enabled)persist(true);update();
if(new URLSearchParams(location.search).has('review'))Object.assign(window,{__nightReview:{state:()=>structuredClone(guard),scene}});
