import './style.css';
import { icon } from './icons';
import {openSave,commitSave,type StorageLike} from './game/persistence';
import {newGame,advance,restore,claimReturn,upgrade,cost,tuning,publicRadar,dismissSurvey,upgradeIds,MAX_LEVEL,SAVE_KEY,pendingPresentations,markPresented,publicPlanets,type SaveData,type UpgradeId} from './game/engine';
import { discoveries, discoveryById } from './content/catalog';
import { BaseArrival } from './ui/base';
import { readPreferences, savePreferences } from './ui/preferences';
import { SoundDesk } from './ui/audio';
import { parcelJournal, currentJournalId } from './content/parcel-journal';
import type {RadarMode} from './game/radar';
import { parcelSignals } from './content/parcel';
import type { DiscoveryKind } from './content/types';
import { ExpeditionScene } from './render/scene';
import { RadarScene } from './render/radar-scene';
import { InteractionDirector } from './ui/interaction';
import { robotPose, actionText } from './render/motion';
import { equipment, itemArt } from './ui/art';
import { DiscoveryDirector, soundCue } from './ui/discovery';
import globeUrl from '../assets/runtime/parcel-globe.webp';
import robotUrl from '../assets/runtime/robot.webp';
import shipUrl from '../assets/runtime/ship.webp';

const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const storage:StorageLike={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const initial=openSave(storage,Date.now());
let state=initial.state,storageOK=initial.persisted;
const preferences=readPreferences();
savePreferences(preferences);
const sounds=new SoundDesk(preferences.muted);
const requestedStart=new URLSearchParams(location.search).get('start');
let tab:string=requestedStart==='expedition'||requestedStart==='base'?requestedStart:preferences.startPage;
let radarMode:RadarMode='local',lastJournal='',lastAction='';
let filter:DiscoveryKind|'planet'|'all'='all';
let lastRadar='',lastCollection='',lastBase='',lastRecent='';
let modalKind='',presenting=false,ticking=false,reviewTime:number|null=null,toastTimer:ReturnType<typeof setTimeout>;
const kindName={artifact:'奇物',creature:'居民',event:'异闻'};
const heading=(eyebrow:string,title:string,subtitle:string,extra='')=>`<header class="page-heading"><div class="eyebrow">${eyebrow}</div><div class="heading-line"><h1>${title}</h1>${extra}</div><p>${subtitle}</p></header>`;
const closeButton=(label:string)=>`<button class="icon-button" data-action="close" aria-label="${label}">${icon('close')}</button>`;
const app=$('#app');
document.documentElement.dataset.build=`${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty?' (本地修改中)':''}`;
app.innerHTML=`
<aside class="desktop-intro"><div class="edition">LR–01 / 宇宙失物招领处</div><div class="wordmark">失物<br>星球<span>LOSTSTAR</span></div><p>每一次归航，<br>都带回一点不明所以。</p><div class="intro-line"></div><small>有些地方，是因为你来过，<br>才有了收件人。</small><div class="postal-stamp">退件平原<br><b>航程进行中</b></div></aside>
<div class="device">
  <header class="topbar"><a class="brand" href="#" aria-label="失物星球首页">${icon('planet')}<span>失物星球<small>宇宙失物招领处</small></span></a><div class="header-actions"><div class="currency">${icon('cube')}<span><strong id="balance">120</strong><small>可用零件</small></span></div><button class="icon-button" data-action="settings" aria-label="界面与声音设置">${icon('gear')}</button></div></header>
  <main id="page-scroll">
    <section id="expedition" class="view">
      ${heading('FIELD EXPEDITION / LR–01','退货箱星','退件平原 · 一切都能退回，除了好奇心。','<span class="tiny-tag">自动勘察</span>')}
      <div class="scene-wrap"><div class="scene-top"><span><i class="live-dot"></i>地表通信正常</span><span class="scene-serial">KADA–07 / 自动探索</span></div><div id="planet-scene"></div><div class="scene-bottom"><span>退件平原 · 收件站</span><span>LR–01 ${icon('rocket')}</span></div></div>
      <div class="exploration-panel game-panel"><div class="status-head"><div class="unit-portrait"><img src="${robotUrl}" alt=""></div><div><span class="micro-label">咔哒–07 的作业频道</span><strong id="robot-action"></strong></div><span class="pulse-bars" aria-hidden="true"><i></i><i></i><i></i></span></div><div class="action-track" aria-label="自动探索流程">${[['walk','行走'],['scan','扫描'],['pickup','拾取'],['return','回仓'],['unload','卸货']].map(([id,text])=>`<span data-phase="${id}"><i></i>${text}</span>`).join('')}</div><div class="progress"><span id="cycle-progress"></span></div><div class="status-foot"><span>下一次归舱 <b id="cycle-remaining">12</b>s</span><span>已完成 <b id="cycles">0</b> 次回收</span></div></div>
      <div id="recent" class="recent game-panel"></div><div id="journal-teaser" hidden></div>
      <div class="quick-actions"><button class="utility-button" data-action="workshop">${icon('gear')}<span>设备工坊<small>把零件变成好奇心</small></span>${icon('arrow')}</button><button class="utility-button" data-go="collection">${icon('book')}<span>首星档案<small id="field-count">正在记录</small></span>${icon('arrow')}</button></div>
      <p class="quiet-note">关掉屏幕也没关系，失物号会继续前行。</p>
    </section>
    <section id="radar" class="view" hidden>
      ${heading('SIGNAL ROOM / 本地勘测','星域雷达','先把脚下这颗星球，认真听清楚。','<span class="tiny-tag cyan-tag">信道已接通</span>')}
      <div class="radar-channels" role="group" aria-label="雷达频道"><button data-radar-mode="local" aria-pressed="true">地表勘测</button><button data-radar-mode="interstellar" aria-pressed="false">星际监听</button></div><div id="interstellar-status" class="game-panel" hidden><span class="micro-label">深空接收器 / 待接通</span><h2>先听完这颗星球的故事</h2><p>地表勘测仍在自动进行。星际频道接通后，将从捕获真实信号开始逐步定位。</p></div><div id="local-radar"><div class="radar-screen game-panel"><div class="radar-top"><span>RETURNS PLAIN / 地表回波</span><span class="live-label"><i class="live-dot"></i>持续监听</span></div><div class="radar-rings"><i></i><i></i><i></i><div class="sweep"></div><img class="radar-planet" loading="lazy" src="${globeUrl}" alt="已知退货箱星"><div id="radar-signal"></div></div><div class="radar-crosshair-x"></div><div class="radar-crosshair-y"></div><span class="radar-scale scale-left">01<br>··<br>02<br>··<br>03</span><span class="radar-corner">地表信道 / K–07</span><span class="radar-noise">RX <b>▂ ▅ ▃ ▆</b></span></div>
      <div class="telemetry"><span>轨道 <b>稳定</b></span><span>地表 <b>有回应</b></span><span>自动 <b>归档中</b></span></div><div id="radar-status"></div>
      <div class="section-title"><span>退件平原 · 现场记录</span><small id="survey-count"></small></div><div id="survey-records"></div>
      <div class="section-title"><span>已记录的航路</span><small>归处始终在线</small></div><div id="known-planets"></div></div>
    </section>
    <section id="collection" class="view" hidden>
      ${heading('PLANET ARCHIVE / 失物档案室','宇宙图鉴','用途不明。喜欢它的理由，也不明。','<span class="archive-seal">已收录</span>')}
      <div class="archive-overview game-panel"><img loading="lazy" src="${globeUrl}" alt=""><div><span class="micro-label">退件平原 · 首轮田野档案</span><strong id="archive-title">故事正在慢慢长出来</strong><div class="progress"><span id="archive-progress"></span></div><small id="collection-count"></small></div></div>
      <div class="filters" role="group" aria-label="图鉴分类">${[['all','全部'],['artifact','奇物'],['creature','生物'],['event','事件'],['planet','星球']].map(([id,name])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${name}<small data-filter-count="${id}"></small></button>`).join('')}</div><div id="collection-items"></div>
    </section>
    <section id="base" class="view" hidden>
      ${heading('HOME / 失物号收件站','欢迎归航，管理员。','有热茶，也有一些无法解释的收藏。')}
      <div class="base-scene" data-background-state="loading" aria-busy="true"><img id="base-background" fetchpriority="high" decoding="async" class="base-background pixel-art" alt="失物号收件站：展柜、停泊区与工作台"><div class="base-loading" role="status"><span class="loading-postmark" aria-hidden="true">LR–01</span><strong class="loading-message">收件站正在接通</strong><p>正在展开收藏室，请稍候片刻。</p><button class="secondary" data-action="retry-base">重新接通收件站</button></div><span class="base-window-light"></span><div id="display-items"></div><div class="base-rover"><div class="base-robot" role="img" aria-label="咔哒在基地整理收藏"></div><span class="rover-note">整理中 · · ·</span></div><span class="base-label">失物收藏室 <b>LR–01</b></span><span class="base-lamp"></span></div>
      <div class="base-caption"><span><i class="live-dot"></i>失物号仍在自动探索</span><span id="display-count"></span></div><button class="primary" data-go="expedition">${icon('rocket')}继续远征${icon('arrow')}</button>
      <div class="quick-actions"><button class="utility-button" data-action="workshop">${icon('gear')}<span>设备工坊<small>让每次出发更从容</small></span>${icon('arrow')}</button><button class="utility-button" data-go="collection">${icon('book')}<span>收藏档案<small>看看带回了什么</small></span>${icon('arrow')}</button></div><div class="section-title"><span>住在这里的邻居</span><small id="resident-count"></small></div><div id="base-collection"></div><div class="section-title"><span>邻居来信 · 田野续记</span><small id="journal-count"></small></div><div id="field-journal"></div>
    </section>
  </main>
  <nav aria-label="主导航">${[['expedition','rocket','远征'],['radar','radar','星图'],['collection','book','图鉴'],['base','base','基地']].map(([id,img,name])=>`<button data-go="${id}" aria-current="${id===tab?'page':'false'}"><span class="nav-icon">${icon(img)}</span><span>${name}</span><i></i></button>`).join('')}</nav>
  <div id="discovery-stage" role="status" aria-live="polite" aria-atomic="true" hidden></div>
</div>
<aside class="desktop-note"><span class="orbit-mark">✦</span><p>一只拆箱的小鼠。<br>一封没有地址的信。<br>宇宙的惊喜，往往很小。</p><small>退件平原 · 首轮田野档案<br>低频操作 / 自动探索</small></aside>
<dialog id="modal"><div id="modal-body"></div></dialog><div id="toast" role="status"></div>`;

const scene=new ExpeditionScene($('#planet-scene'),()=>state);
const modal=$<HTMLDialogElement>('#modal');
const radarScene=new RadarScene($('.radar-rings'),()=>publicRadar(state));
const interactions=new InteractionDirector($('#modal-body'));
let lastPointerType='mouse';
app.addEventListener('pointerup',event=>{lastPointerType=event.pointerType||'mouse';},{passive:true});
const baseArrival=new BaseArrival($('.base-scene'),$<HTMLImageElement>('#base-background'));
const director=new DiscoveryDirector($('#discovery-stage'),()=>{presenting=false;queueMicrotask(()=>void maybePresent());});
function toast(text:string){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function showModal(kind:string,html:string){interactions.hide();modal.dataset.kind=kind;modalKind=kind;$('#modal-body').innerHTML=html;if(!modal.open)modal.showModal();}
function closeModal(){interactions.hide();modal.close();modalKind='';void maybePresent();}
modal.addEventListener('cancel',()=>{interactions.hide();modalKind='';setTimeout(()=>void maybePresent(),0);});
async function transact(fn:(s:SaveData)=>SaveData){
  const run=()=>{
    const result=commitSave(storage,state,fn,Date.now());state=result.state;
    if(!result.persisted&&storageOK)toast('暂时只能保留本次打开的进度。请留意浏览器的存储空间。');
    storageOK=result.persisted;
    update();
  };
  if(navigator.locks)await navigator.locks.request('loststar-save',run);else run();
}
async function maybePresent(){
  if(presenting||director.active||modal.open||tab!=='expedition')return;
  const unseen=pendingPresentations(state),id=unseen.at(-1);if(!id)return;
  presenting=true;let claimed=false;
  await transact(s=>{claimed=pendingPresentations(s).includes(id);return claimed?unseen.reduce((next,key)=>markPresented(next,key),s):s;});
  if(claimed&&tab==='expedition'&&!modal.open){const d=discoveryById(id)!;scene.celebrate(d.presentation.cue);director.show(d,unseen.length-1);}
  else presenting=false;
}
function go(id:string){
  if(!['expedition','radar','collection','base'].includes(id))return;
  tab=id;if(id==='base')void baseArrival.load();document.querySelectorAll<HTMLElement>('.view').forEach(view=>view.hidden=view.id!==id);
  document.querySelectorAll('[data-go]').forEach(button=>button.setAttribute('aria-current',button.getAttribute('data-go')===id?'page':'false'));
  $('#page-scroll').scrollTo(0,0);scene.setActive(id==='expedition');radarScene.setActive(id==='radar'&&radarMode==='local');if(id!=='expedition')director.hide();update();void maybePresent();
}
function renderCollection(){
  const list=state.collection.map(id=>discoveryById(id)!);
  $('#collection-count').textContent=`${list.length} / ${discoveries.length} 份首星记录`;
  $('#archive-title').textContent=list.length===discoveries.length?'这一回，不必退回。':list.length>=7?'这里的怪事，开始彼此回应。':list.length>=3?'认识这里，先认识它的邻居。':'故事正在慢慢长出来';
  $('#archive-progress').style.width=`${list.length/discoveries.length*100}%`;
  for(const id of ['all','artifact','creature','event','planet']){
    $(`[data-filter-count="${id}"]`).textContent=String(id==='all'?list.length+publicPlanets(state).length:id==='planet'?publicPlanets(state).length:list.filter(d=>d.kind===id).length);
  }
  let html=list.filter(d=>filter==='all'||filter===d.kind).map(d=>`<button class="discovery-card ${d.kind}" data-detail="${d.id}" aria-label="${d.name}，${kindName[d.kind]}"><span class="card-code">${kindName[d.kind]} <b>${String(d.milestone).padStart(2,'0')}</b></span><span class="artifact-art">${itemArt(d.id)}</span><span class="card-title">${d.name}</span><span class="card-rarity">${d.rarity}</span><p>${d.description}</p><span class="card-foot">退件平原 ${icon('arrow')}</span></button>`).join('');
  if(filter==='all'||filter==='planet')html+=publicPlanets(state).map(p=>`<button class="discovery-card planet-card" data-planet="${p.id}"><span class="artifact-art"><img class="pixel-art" src="${globeUrl}" alt=""></span><span><small>已发现星球 · 现场档案</small><strong>${p.name}</strong><p>${p.subtitle}</p><span class="card-foot">返回退件平原 ${icon('arrow')}</span></span></button>`).join('');
  $('#collection-items').innerHTML=html||`<div class="empty-state game-panel">${icon('book')}<span class="micro-label">空白的那一页，留给下一次发现</span><h2>故事还在路上</h2><p>咔哒正在认真寻找。<br>每次归舱，都会多懂这里一点。</p><span class="empty-stamp">等待宇宙回信</span></div>`;
}
function settings(){
  showModal('settings',`<div class="modal-heading"><h2>界面与声音</h2>${closeButton('关闭设置')}</div><p class="modal-subtitle">收件站按你的习惯亮灯。所有设置会保存在本机。</p><div class="settings-group"><h3>无线电声音</h3><p>原创像素短音效；首次默认静音，开启后才接通。</p><button class="secondary" data-preference="sound" aria-pressed="${!preferences.muted}">${preferences.muted?'开启声音':'静音'}</button></div><div class="settings-group"><h3>文字大小</h3><div class="settings-options">${[['normal','标准字号'],['large','大字号']].map(([id,label])=>`<button class="secondary" data-preference="text" data-value="${id}" aria-pressed="${preferences.textSize===id}">${label}</button>`).join('')}</div></div><div class="settings-group"><h3>打开游戏时</h3><div class="settings-options">${[['base','基地作为首页'],['expedition','远征作为首页']].map(([id,label])=>`<button class="secondary" data-preference="start" data-value="${id}" aria-pressed="${preferences.startPage===id}">${label}</button>`).join('')}</div><p>首页只影响下次打开，不改变探索进度。</p></div><p class="build-info">首星测试 v${__BUILD_INFO__.version} · Git ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty?' · 本地修改中':''}</p>`);
}
function renderJournal(){
  const current=currentJournalId(state.journal.shift),notes=parcelJournal.filter(note=>state.journal.entries.includes(note.id));
  const latest=notes.find(note=>note.id===current)??notes.at(-1);$('#journal-teaser').hidden=!latest;$('#journal-teaser').innerHTML=latest?`<button class="journal-preview game-panel" data-go="base"><span><small>邻居给你留了一封信</small><strong>${latest.title}</strong></span>${icon('arrow')}</button>`:'';
  $('#journal-count').textContent=`${notes.length} 篇来信`;
  $('#field-journal').innerHTML=notes.length?`<p class="journal-intro">第 ${state.journal.shift} 次邻居接力 · 自动记下，不必领取。</p>${[...notes].reverse().map(note=>`<article class="journal-note game-panel ${note.id===current?'latest-note':''}">${itemArt(note.art)}<div><small>${note.id===current?'最近收到的回信':'退件平原 · 居民联动'}</small><h3>${note.title}</h3><p>${note.text}</p></div></article>`).join('')}`:`<div class="home-note game-panel"><p>居民们还在慢慢熟悉彼此。继续探索，偶尔回来看看它们的来信。</p></div>`;
}
function renderBase(){
  const artifacts=state.collection.filter(id=>discoveryById(id)!.kind==='artifact');
  $('#display-items').innerHTML=artifacts.map((id,i)=>`<button class="display-object slot-${i}" aria-label="查看 ${discoveryById(id)!.name}" data-detail="${id}">${itemArt(id)}</button>`).join('');
  $('#display-count').textContent=artifacts.length?`${artifacts.length} 件奇物已安顿`:'给惊喜留了位置';
  const residents=state.collection.filter(id=>discoveryById(id)!.kind==='creature');$('#resident-count').textContent=`${residents.length} 位邻居`;
  $('#base-collection').innerHTML=residents.length?residents.map(id=>{const d=discoveryById(id)!;return `<button class="resident game-panel" data-detail="${id}">${itemArt(id)}<span><small>这里也是它的归处</small><strong>${d.name}</strong><p>${id==='mouse'?'正在帮你检查每一个空箱子。':id==='hermit'?'挑了一间刚好合身的纸箱小屋。':'它把今天的好天气贴在了窗外。'}</p></span>${icon('arrow')}</button>`;}).join(''):`<div class="home-note game-panel"><span class="micro-label">收件站的灯一直亮着</span><p>外面的居民偶尔会来。先留几个空纸箱，等它们慢慢熟悉这里。</p></div>`;
}
function renderRadar(){
  $('#local-radar').hidden=radarMode!=='local';$('#interstellar-status').hidden=radarMode!=='interstellar';
  $('#interstellar-status').dataset.stage=publicRadar(state,'interstellar').stage;
  document.querySelectorAll('[data-radar-mode]').forEach(button=>button.setAttribute('aria-pressed',String((button as HTMLElement).dataset.radarMode===radarMode)));
  radarScene.setActive(tab==='radar'&&radarMode==='local');
  const radar=publicRadar(state),stage=radar.stage;
  const text={searching:['正在监听退件平原','咔哒会自动核对地表回波，不必守着雷达。'],anomaly:['捕获本地异常','纸层与旧机器之间，传来一段不同寻常的回应。'],locking:['正在核对回波','正在分离现场杂音，记录只来自真实勘测。'],surveyed:['现场回波已归档','这颗小星球，刚刚多讲了一点自己的故事。']}[stage];
  $('#radar-signal').innerHTML=stage==='anomaly'||stage==='locking'?`<span data-signal class="signal ${stage}" style="--signal-x:${54+(state.surveyCount%3)*7}%;--signal-y:${25+(state.surveyCount%2)*13}%"></span>`:'';
  $('#radar-status').innerHTML=`<div class="radar-status game-panel"><span class="micro-label">K–07 地表勘测频道</span><div class="radar-status-heading"><i class="live-dot"></i><h2>${text[0]}</h2><span class="radar-level">Lv.${state.upgrades.radar+1}</span></div><p>${text[1]}</p>${stage==='surveyed'&&radar.signal?`<div class="survey-reveal"><small>退件平原 / 已核实现场</small><h3>${radar.signal.name}</h3><p>${radar.signal.description}</p><div class="survey-reward">${icon('cube')}勘测补给${state.pendingReturn?'待归航结算':'已自动入账'} <b>+6</b></div><button class="secondary" data-action="record">收录现场记录 ${icon('arrow')}</button></div>`:`<div class="progress"><span style="width:${Math.max(2,radar.progress)}%"></span></div><div class="status-foot"><span>${stage==='searching'?'自动勘测中':`核对进度 ${radar.progress}%`}</span><span>完成一次勘测 +6 零件</span></div>`}</div>`;
  const recorded=parcelSignals.slice(0,Math.min(state.surveyCount,parcelSignals.length));
  $('#survey-count').textContent=`${recorded.length} 份已核实`;
  $('#survey-records').innerHTML=recorded.length?recorded.map((r,i)=>`<article class="survey-record"><span class="record-number">${String(i+1).padStart(2,'0')}</span><div><strong>${r.name}</strong><p>${r.description}</p><small>${r.fieldNote}</small></div><span class="record-check">✓</span></article>`).join(''):`<div class="local-note"><span class="record-number">··</span><p>尚无现场记录。<br><small>没有捕获的回波，不会被填进档案。</small></p></div>`;
  $('#known-planets').innerHTML=publicPlanets(state).map(p=>`<button class="known-planet game-panel" data-planet="${p.id}"><span class="planet-dot"><img src="${globeUrl}" alt=""></span><span><strong>${p.name}</strong><small>退件平原 · 失物号正在工作</small></span>${icon('arrow')}</button>`).join('');
}
const upgradeInfo:Record<UpgradeId,{name:string;desc:string;effect:(s:SaveData)=>string}>={
  radar:{name:'星域雷达',desc:'听见更多退件平原的现场回波。',effect:s=>`勘测速度 ×${tuning(s).radar.toFixed(2)}`},
  scanner:{name:'扫描仪',desc:'让咔哒更快完成一轮地表探索。',effect:s=>`${(tuning(s).scanner/1000).toFixed(1)} 秒 / 次探索`},
  recycler:{name:'回收装置',desc:'把废旧包装变成下一次航程的零件。',effect:s=>`${tuning(s).recycler} 零件 / 次回收`},
  cargo:{name:'飞船货舱',desc:'屏幕关掉以后，仍能安心航行。',effect:s=>`${tuning(s).cargo/3600} 小时离线上限`},
};
function workshop(){
  showModal('workshop',`<div class="modal-heading"><div><div class="eyebrow">LR–01 / ENGINEERING BAY</div><h2>设备工坊</h2></div>${closeButton('关闭工坊')}</div><p class="modal-subtitle">捡来的小零件，会让下一次出发更从容。</p><div class="workshop-balance">${icon('cube')}工坊零件储备 <b>${Math.floor(state.resources)}</b></div><div class="upgrade-grid">${upgradeIds.map(id=>{
    const info=upgradeInfo[id],level=state.upgrades[id],max=level>=MAX_LEVEL,next={...state,upgrades:{...state.upgrades,[id]:level+1}};
    return `<article class="upgrade-card game-panel" data-upgrade="${id}"><header><h3>${info.name}</h3><span>Lv.${level+1}</span></header><img class="equipment-art pixel-art" src="${equipment[id]}" alt=""><div class="level-notches" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i class="${i<=level?'filled':''}"></i>`).join('')}</div><strong class="upgrade-effect">${info.effect(state)}</strong><p>${info.desc}</p><small class="upgrade-next">${max?'已达当前设备上限':`下一级 ${info.effect(next)}`}</small><button class="upgrade-buy" data-upgrade-buy="${id}" aria-label="升级${info.name}" ${max||state.resources<cost(state,id)?'disabled':''}>${max?'已满级':`${icon('cube')}${cost(state,id)} 零件 ${icon('arrow')}`}</button></article>`;
  }).join('')}</div><p class="quiet-note">每一级都有实际效果，咔哒会认真使用。</p>`);
}
function detail(id:string){
  const d=discoveryById(id);if(!d||!state.collection.includes(id))return;
  director.hide();const recorded=state.discoveryAt[id];
  showModal('detail',`<div class="modal-heading detail-dialog-header"><div><div class="eyebrow">FIELD ARCHIVE / ${kindName[d.kind]}</div><span class="detail-serial">RETURNS PLAIN · ${String(d.milestone).padStart(3,'0')}</span></div>${closeButton('关闭详情')}</div><div class="detail-scroll"><div class="detail-art ${d.kind}"><div class="artifact-orbit"></div>${itemArt(id)}<span class="rarity-stamp">${d.rarity}<small>已入档</small></span></div><small class="detail-kind">${d.kind==='artifact'?'用途不明的宇宙奇物':d.kind==='creature'?'住在纸箱平原的小居民':'一份尚不能完全解释的现场记录'}</small><h2 class="detail-title">${d.name}</h2><p class="detail-description">${d.description}</p><div class="field-note"><span class="micro-label">咔哒的田野笔记</span><p>${d.fieldNote}</p></div><div class="detail-source"><span>退货箱星 / 退件平原</span><small>${recorded?new Date(recorded).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'旧档案'} 入档</small></div></div><div class="interaction-dock"><div id="interaction-feedback" class="interaction-feedback" role="status" aria-live="polite" hidden><canvas width="320" height="180" aria-label="${d.name}的独特互动演出" role="img"></canvas><p id="interaction"></p><button class="icon-button" data-action="dismiss-interaction" aria-label="收起互动反馈">${icon('close')}</button></div><button class="primary" data-interact="${id}">试一试 ${icon('arrow')}</button><small class="interaction-hint">可以反复试试 · 不消耗藏品，不产生奖励</small></div>`);
}
function offline(){
  const cargo=state.pendingReturn;if(!cargo)return;
  director.hide();
  showModal('offline',`<div class="return-header"><div class="eyebrow">LR–01 / ARRIVAL MANIFEST</div><span class="return-status">已安全抵达</span></div><div class="return-hero"><span class="return-orbit"></span><img class="pixel-art" src="${shipUrl}" alt="失物号归航"></div><h2 class="detail-title">离线归航</h2><p class="return-line">你不在的时候，宇宙替你保管了一点惊喜。</p><div class="cargo-stats"><div><small>有效探索时长</small><b>${Math.floor(cargo.seconds/60)}<span> 分钟</span></b></div><div><small>带回可用零件</small><b class="reward-number">+${cargo.resources}</b></div></div><div class="return-found-heading"><span>${cargo.discoveries.length?'第一次带回的发现':'这次带回熟悉的日常'}</span><small>${cargo.discoveries.length?`${cargo.discoveries.length} 份新档案`:'所有回收都已认真记录'}</small></div>${cargo.discoveries.length?`<div class="cargo-found">${cargo.discoveries.map(id=>`<div class="cargo-item">${itemArt(id)}<span>${discoveryById(id)!.name}</span></div>`).join('')}</div>`:`<div class="return-note">零件来自日常回收与现场勘测。<br>老邻居们，也都过得很好。</div>`}${state.journal.entries.length?`<div class="return-note journal-return">邻居给你留了 ${state.journal.entries.length} 篇来信。<br>安顿好货物后，去基地读一读。</div>`:''}<div class="manifest-footer"><span>货舱离线上限 ${tuning(state).cargo/3600} 小时</span><span>入账后自动留存</span></div><button class="primary" data-action="claim">收下这次远行 ${icon('arrow')}</button>`);
}
function update(){
  $('#balance').textContent=Math.floor(state.resources).toLocaleString('zh-CN');
  const fraction=reviewTime===null?state.cycleMs/tuning(state).scanner:((reviewTime%12)+12)%12/12,action=robotPose(fraction).action;
  $('#cycle-progress').style.width=`${fraction*100}%`;$('#cycle-remaining').textContent=String(Math.ceil((reviewTime===null?tuning(state).scanner-state.cycleMs:tuning(state).scanner*(1-fraction))/1000));$('#cycles').textContent=String(state.cycles);$('#robot-action').textContent=actionText[action];
  if(lastAction!==action){if(tab==='expedition'){if(action==='scan')soundCue('scan');if(action==='return')soundCue('pickup');}lastAction=action;}
  document.querySelectorAll<HTMLElement>('[data-phase]').forEach(el=>el.classList.toggle('active',el.dataset.phase===action));
  $('#field-count').textContent=`已记录 ${state.collection.length} / ${discoveries.length}`;
  const latest=state.collection.at(-1),d=latest?discoveryById(latest):null;
  if(lastRecent!==(latest??'none')){
    lastRecent=latest??'none';$('#recent').innerHTML=d?`<button data-detail="${d.id}"><span class="recent-symbol">${itemArt(d.id)}</span><span><small>最近带回的${kindName[d.kind]}</small><strong>${d.name}</strong><em>${d.rarity} · 已收入首星档案</em></span>${icon('arrow')}</button>`:`<span class="recent-symbol empty-recent">${icon('receipt')}</span><span><small>收件站正在等第一份惊喜</small><strong>宇宙的第一张小票，正在路上。</strong><em>不必点击，咔哒会自己带回来。</em></span>`;
  }
  const radarKey=JSON.stringify([publicRadar(state),state.surveyCount,state.upgrades.radar,state.planets,!!state.pendingReturn]);if(radarKey!==lastRadar){lastRadar=radarKey;renderRadar();}
  const collectionKey=JSON.stringify([state.collection,state.discoveryAt,filter]);if(collectionKey!==lastCollection){lastCollection=collectionKey;renderCollection();}
  const journalKey=JSON.stringify(state.journal);if(journalKey!==lastJournal){lastJournal=journalKey;renderJournal();}
  const baseKey=state.collection.join(',');if(baseKey!==lastBase){lastBase=baseKey;renderBase();}
}
app.addEventListener('click',async event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
  if(button.dataset.go)go(button.dataset.go);
  if(button.dataset.radarMode){radarMode=button.dataset.radarMode as RadarMode;renderRadar();}
  if(button.dataset.preference){
    if(button.dataset.preference==='sound'){preferences.muted=!preferences.muted;await sounds.setMuted(preferences.muted);if(!preferences.muted)soundCue('interaction');}
    if(button.dataset.preference==='text')preferences.textSize=button.dataset.value as typeof preferences.textSize;
    if(button.dataset.preference==='start')preferences.startPage=button.dataset.value as typeof preferences.startPage;
    if(!savePreferences(preferences))toast('设置暂时无法保存，但本次打开仍然生效。');settings();
  }
  if(button.dataset.filter){filter=button.dataset.filter as typeof filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));update();}
  if(button.dataset.detail)detail(button.dataset.detail);
  if(button.dataset.interact){
    interactions.show(button.dataset.interact,lastPointerType);soundCue('interaction',button.dataset.interact);
  }
  if(button.dataset.planet)go('expedition');
  if(button.dataset.upgradeBuy){
    const id=button.dataset.upgradeBuy as UpgradeId,oldLevel=state.upgrades[id];button.disabled=true;
    await transact(s=>upgrade(s,id));workshop();
    if(state.upgrades[id]>oldLevel){soundCue('upgrade',id);toast(`${upgradeInfo[id].name}升至 Lv.${state.upgrades[id]+1} · ${upgradeInfo[id].effect(state)}`);$(`[data-upgrade="${id}"]`).classList.add('just-upgraded');}
  }
  switch(button.dataset.action){
    case 'workshop':workshop();break;
    case 'settings':settings();break;
    case 'retry-base':void baseArrival.load();break;
    case 'close':closeModal();break;
    case 'record':await transact(dismissSurvey);toast('现场记录已收录。自动监听继续。');break;
    case 'dismiss-discovery':director.hide();break;
    case 'dismiss-interaction':interactions.hide();break;
    case 'claim':button.disabled=true;await transact(claimReturn);closeModal();soundCue('return');toast('奇物已安顿。欢迎回来，管理员。');break;
  }
});
$('.brand').addEventListener('click',event=>{event.preventDefault();go('base');});
async function tick(){
  if(ticking)return;ticking=true;const hadCargo=!!state.pendingReturn;
  try{await transact(s=>advance(s,Date.now(),Date.now()-s.lastAt>=30000));if(!hadCargo&&state.pendingReturn&&!modal.open)offline();else void maybePresent();}
  finally{ticking=false;}
}
setInterval(()=>{if(document.visibilityState==='visible')void tick();},250);
window.addEventListener('storage',event=>{
  if(event.key!==SAVE_KEY)return;
  state=restore(event.newValue);update();
  if(modal.open&&modalKind==='offline'&&!state.pendingReturn)closeModal();
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void tick();});
go(tab);renderBase();if(state.pendingReturn)offline();else void maybePresent();
if(!storageOK)toast('浏览器暂时无法保存。当前进度会在本次打开期间保留。');
if(new URLSearchParams(location.search).has('review'))Object.assign(window,{__review:{scene,radarScene,freeze:(t:number|null)=>{reviewTime=t;scene.freeze(t);update();},state:()=>structuredClone(state)}});
