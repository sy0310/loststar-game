import './style.css';
import {icon} from './icons';
import {newGame,advance,restore,claimReturn,upgrade,cost,tuning,publicRadar,dismissReveal,upgradeIds,MAX_LEVEL,SAVE_KEY,type SaveData,type UpgradeId} from './game/engine';
import {discoveries,discoveryById,planetById} from './content/catalog';
import type {DiscoveryKind} from './content/types';
import {ExpeditionScene} from './render/scene';
import {robotPose,actionText} from './render/motion';
import globeUrl from '../assets/runtime/parcel-globe.webp';
import robotUrl from '../assets/runtime/robot.webp';
import mouseUrl from '../assets/runtime/mouse.webp';
import receiptUrl from '../assets/runtime/receipt.webp';
import tapeUrl from '../assets/runtime/tape.webp';
import nestedUrl from '../assets/runtime/nested.webp';
import signalUrl from '../assets/runtime/signal.webp';

const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
let state:SaveData;let storageOK=true;
try{state=restore(localStorage.getItem(SAVE_KEY));localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{state=newGame();storageOK=false;}
let tab='expedition',filter:DiscoveryKind|'planet'|'all'='all',lastRadar='',lastCollection='',lastBase='';
let interaction='';
const app=$('#app');
app.innerHTML=`<aside class="desktop-intro"><div class="edition">LOST PROPERTY OFFICE / 01</div><div class="wordmark">失物<br>星球<span>LOSTSTAR</span></div><p>每一次归航，<br>都带回一点不明所以。</p><div class="intro-line"></div><small>宇宙很大。<br>总有一些东西，正在等你捡到。</small></aside>
<div class="device"><header class="topbar"><a class="brand" href="#" aria-label="失物星球首页">${icon('planet')}<span>失物星球<small>宇宙失物招领处</small></span></a><div class="currency">${icon('cube')}<strong id="balance">120</strong><span>零件</span></div></header>
<main>
<section id="expedition" class="view"><div class="page-heading"><div><div class="eyebrow">EXPEDITION / 001</div><h1>退货箱星<span class="tiny-tag">已记录</span></h1><p>退件平原 · 一切都可以退回，除了好奇心。</p></div></div>
<div class="scene-wrap"><div class="scene-top"><span><i class="live-dot"></i>自动探索中</span><span>LR–01 / 咔哒–07</span></div><div id="planet-scene"></div><div class="scene-bottom"><span>PARCEL RETURN PLANET</span><span>轨道通信正常 ${icon('signal')}</span></div></div>
<div class="exploration-panel"><div class="status-head"><div class="unit-portrait"><img src="${robotUrl}" alt=""></div><div><small>咔哒–07 的工作日志</small><strong id="robot-action">沿球面寻找异常</strong></div><span class="pulse-bars"><i></i><i></i><i></i></span></div><div class="progress"><span id="cycle-progress"></span></div><div class="status-foot"><span>下一次归舱 <b id="cycle-remaining">12</b>s</span><span>已完成 <b id="cycles">0</b> 次回收</span></div></div>
<div id="recent" class="recent"></div><button class="workshop-link" data-action="workshop">${icon('gear')}<span>设备工坊<small>让好奇心走得更远</small></span>${icon('arrow')}</button><p class="quiet-note">关掉屏幕也没关系，失物号会继续前行。</p></section>
<section id="radar" class="view" hidden><div class="page-heading"><div class="eyebrow">THE UNKNOWN / RADAR</div><h1>星域雷达</h1><p>在宇宙回答之前，保持好奇。</p></div><div class="radar-screen"><div class="radar-rings"><i></i><i></i><i></i><div class="sweep"></div><div class="radar-origin"></div><div id="radar-signal"></div></div><span class="radar-corner">LR–01 · 深空频道</span><span class="radar-noise">· · · 接收中</span></div><div id="radar-status"></div><div class="section-title"><span>已记录的航路</span><small>永久星图</small></div><div id="known-planets"></div><p class="quiet-note">雷达只记录真实接收到的信号。</p></section>
<section id="collection" class="view" hidden><div class="page-heading"><div class="eyebrow">ARCHIVE / LITTLE MYSTERIES</div><h1>宇宙图鉴<span class="tiny-tag" id="collection-count">0 个发现</span></h1><p>用途不明。来历不明。喜欢的理由也不明。</p></div><div class="filters" role="group" aria-label="图鉴分类">${[['all','全部'],['artifact','奇物'],['creature','生物'],['event','事件'],['planet','星球']].map(([id,name])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${name}</button>`).join('')}</div><div id="collection-items"></div></section>
<section id="base" class="view" hidden><div class="page-heading"><div class="eyebrow">HOME / LOST PROPERTY OFFICE</div><h1>欢迎归航，管理员。</h1><p>这里有热茶，也有暂时无法解释的收藏。</p></div><div class="base-scene"><div id="display-items"></div><img class="base-robot" src="${robotUrl}" alt="咔哒机器人正在整理收藏"><span class="base-label">失物收藏室 / LR–01</span></div><div class="base-caption"><span><i class="live-dot"></i>失物号仍在自动探索</span><span id="display-count">展柜等待新发现</span></div><button class="primary" data-go="expedition">${icon('rocket')}继续远征${icon('arrow')}</button><button class="workshop-link" data-action="workshop">${icon('gear')}<span>设备工坊<small>雷达 · 扫描 · 回收 · 货舱</small></span>${icon('arrow')}</button><div id="base-collection"></div></section>
</main><nav aria-label="主导航">${[['expedition','rocket','远征'],['radar','radar','星图'],['collection','book','图鉴'],['base','base','基地']].map(([id,img,name])=>`<button data-go="${id}" aria-current="${id===tab?'page':'false'}">${icon(img)}<span>${name}</span><i></i></button>`).join('')}</nav></div><aside class="desktop-note"><span class="orbit-mark">✦</span><p>你不必一直盯着宇宙。<br>它也会偷偷给你惊喜。</p><small>V0.1 · 退件平原<br>动态可玩样板</small></aside><dialog id="modal"><div id="modal-body"></div></dialog><div id="toast" role="status"></div>`;
const scene=new ExpeditionScene($('#planet-scene'),()=>state);
const modal=$<HTMLDialogElement>('#modal');
const showModal=(html:string)=>{$('#modal-body').innerHTML=html;if(!modal.open)modal.showModal();};
function toast(text:string){$('#toast').textContent=text;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
async function transact(fn:(s:SaveData)=>SaveData){
  const run=()=>{try{const latest=restore(localStorage.getItem(SAVE_KEY));state=fn(latest);localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{state=fn(state);storageOK=false;}update();};
  if(navigator.locks)await navigator.locks.request('loststar-save',run);else run();
}
function go(id:string){tab=id;document.querySelectorAll<HTMLElement>('.view').forEach(v=>v.hidden=v.id!==id);document.querySelectorAll('[data-go]').forEach(b=>b.setAttribute('aria-current',b.getAttribute('data-go')===id?'page':'false'));window.scrollTo(0,0);update();}
const itemTextures:Record<string,string>={receipt:receiptUrl,tape:tapeUrl,nested:nestedUrl,mouse:mouseUrl,'return-request':signalUrl};
const itemImage=(id:string)=>`<img src="${itemTextures[id]}" alt="">`;
function renderCollection(){
  const list=state.collection.map(id=>discoveryById(id)!);
  const filtered=list.filter(d=>filter==='all'||d.kind===filter);
  $('#collection-count').textContent=`${list.length} 个发现`;
  let html=filtered.map(d=>`<button class="discovery-card ${d.kind}" data-detail="${d.id}"><span class="artifact-art ${d.icon}">${itemImage(d.id)}</span><span><small>${d.kind==='artifact'?'宇宙奇物':d.kind==='creature'?'星球居民':'异常记录'} · ${d.rarity}</small><strong>${d.name}</strong><p>${d.description}</p></span>${icon('arrow')}</button>`).join('');
  if(filter==='all'||filter==='planet')html+=state.planets.map(id=>{const p=planetById(id)!;return `<button class="discovery-card" data-planet="${id}"><span class="artifact-art planet-art">${id==='parcel'?`<img src="${globeUrl}" alt="">`:icon('planet')}</span><span><small>已发现星球</small><strong>${p.name}</strong><p>${p.subtitle}</p></span>${icon('arrow')}</button>`;}).join('');
  $('#collection-items').innerHTML=html||`<div class="empty-state">${icon('book')}<h2>故事还在路上</h2><p>咔哒正在认真地寻找。<br>第一次归舱后，新的发现会留在这里。</p></div>`;
}
function renderBase(){
  const artifacts=state.collection.filter(id=>discoveryById(id)!.kind==='artifact');
  $('#display-items').innerHTML=artifacts.map((id,i)=>`<button class="display-object slot-${i}" aria-label="查看 ${discoveryById(id)!.name}" data-detail="${id}">${itemImage(id)}</button>`).join('');
  $('#display-count').textContent=artifacts.length?`${artifacts.length} 件奇物已入柜`:'展柜等待新发现';
  $('#base-collection').innerHTML=state.collection.includes('mouse')?`<div class="resident"><img src="${mouseUrl}" alt="拆封鼠"><span><small>新来的邻居</small><strong>拆封鼠住下了。</strong><p>它正在帮你检查每一个空箱子。</p></span></div>`:'';
}
function renderRadar(){const r=publicRadar(state);const stage=r.stage;
  const text={searching:['正在聆听宇宙','远方还很安静，扫描会自动继续。'],anomaly:['捕获异常信号','那里有什么正在回应。还无法判断是什么。'],locking:['正在锁定坐标','信号逐渐清晰，正在建立一条新航路。'],revealed:['发现一条新航路','这一次，宇宙回了信。']}[stage];
  $('#radar-signal').innerHTML=stage==='anomaly'||stage==='locking'?`<span data-signal class="signal ${stage}"></span>`:'';
  $('#radar-status').innerHTML=`<div class="radar-status"><div><i class="live-dot"></i><h2>${text[0]}</h2></div><p>${text[1]}</p>${stage==='revealed'&&r.planet?`<div class="reveal-planet">${icon('planet')}<h3>${r.planet.name}</h3><p>${r.planet.subtitle}</p><button class="primary" data-action="record">记录新航路${icon('arrow')}</button></div>`:`<div class="progress"><span style="width:${Math.max(3,r.progress)}%"></span></div><small>${stage==='searching'?'持续扫描中':`定位进度 ${r.progress}%`} · 雷达 Lv.${state.upgrades.radar+1}</small>`}</div>`;
  $('#known-planets').innerHTML=state.planets.map(id=>{const p=planetById(id)!;return `<button class="known-planet" data-planet="${id}"><span class="planet-dot" style="--planet:${p.color}">${id==='parcel'?`<img src="${globeUrl}" alt="">`:icon('planet')}</span><span><strong>${p.name}</strong><small>${p.playable?'退件平原 · 正在探索':'已记录坐标 · 等待勘测'}</small></span>${icon('arrow')}</button>`;}).join('');
}
const upgradeInfo:Record<UpgradeId,{name:string;desc:string;icon:string;effect:(s:SaveData)=>string}>={
 radar:{name:'星域雷达',desc:'更快地捕获与定位真实信号',icon:'radar',effect:s=>`定位速度 ×${tuning(s).radar.toFixed(2)}`},
 scanner:{name:'扫描仪',desc:'缩短机器人每次探索的周期',icon:'radar',effect:s=>`${(tuning(s).scanner/1000).toFixed(1)} 秒 / 次探索`},
 recycler:{name:'回收装置',desc:'每次卸货带回更多可用零件',icon:'gear',effect:s=>`${tuning(s).recycler} 零件 / 次回收`},
 cargo:{name:'飞船货舱',desc:'让失物号在离线时航行更久',icon:'rocket',effect:s=>`${tuning(s).cargo/3600} 小时离线上限`},
};
function workshop(){showModal(`<div class="modal-heading"><div><div class="eyebrow">ENGINEERING / LR–01</div><h2>设备工坊</h2></div><button class="icon-button" data-action="close" aria-label="关闭工坊">${icon('close')}</button></div><p class="modal-subtitle">把捡来的零件，变成下一次发现的可能。</p><div class="workshop-balance">${icon('cube')}可用零件 <b>${Math.floor(state.resources)}</b></div>${upgradeIds.map(id=>{const info=upgradeInfo[id],lv=state.upgrades[id],max=lv>=MAX_LEVEL,next={...state,upgrades:{...state.upgrades,[id]:lv+1}};return `<div class="upgrade-row" data-upgrade="${id}"><span class="upgrade-icon">${icon(info.icon)}</span><div><h3>${info.name} <small>Lv.${lv+1}</small></h3><p>${info.effect(state)}</p><small>${max?'已达到当前设备上限':`下一级：${info.effect(next)}`}</small></div><button data-upgrade-buy="${id}" aria-label="升级${info.name}" ${max||state.resources<cost(state,id)?'disabled':''}>${max?'已满级':`${cost(state,id)} ${icon('cube')}`}</button></div>`;}).join('')}<p class="quiet-note">V0.1 体验数值，可随试玩反馈调整。</p>`);}
function detail(id:string){const d=discoveryById(id);if(!d||!state.collection.includes(id))return;interaction='';showModal(`<div class="modal-heading"><span class="eyebrow">FIELD NOTES / ${d.rarity}</span><button class="icon-button" data-action="close" aria-label="关闭详情">${icon('close')}</button></div><div class="detail-art artifact-art ${d.icon}">${itemImage(id)}</div><small class="detail-kind">${d.kind==='artifact'?'用途不明的宇宙奇物':d.kind==='creature'?'来自远方的小居民':'一次难以解释的遭遇'}</small><h2 class="detail-title">${d.name}</h2><p class="detail-description">${d.description}</p><div class="detail-source">发现于：退货箱星 / 退件平原</div><div class="interaction" id="interaction">已收入图鉴与基地档案。</div><button class="primary" data-interact="${id}">试一试 ${icon('arrow')}</button>`);}
function offline(){const cargo=state.pendingReturn;if(!cargo)return;showModal(`<div class="eyebrow">WELCOME BACK / LR–01</div><div class="return-emblem">${icon('rocket')}</div><h2 class="detail-title">离线归航</h2><p class="detail-description">你不在的时候，宇宙替你保管了一点惊喜。</p><div class="cargo-stats"><div><small>本次有效探索</small><b>${Math.floor(cargo.seconds/60)} 分钟</b></div><div><small>带回零件</small><b>+${cargo.resources}</b></div></div>${cargo.discoveries.length?`<p class="cargo-found">${cargo.discoveries.map(id=>discoveryById(id)!.name).join(' · ')}</p>`:''}<p class="quiet-note">货舱离线结算上限 ${tuning(state).cargo/3600} 小时</p><button class="primary" data-action="claim">收下这次远行${icon('arrow')}</button>`);}
function update(){
 $('#balance').textContent=Math.floor(state.resources).toLocaleString('zh-CN');
 const fraction=state.cycleMs/tuning(state).scanner;$('#cycle-progress').style.width=`${fraction*100}%`;$('#cycle-remaining').textContent=Math.ceil((tuning(state).scanner-state.cycleMs)/1000).toString();$('#cycles').textContent=state.cycles.toString();$('#robot-action').textContent=actionText[robotPose(fraction).action];
 const latest=state.collection.at(-1),d=latest?discoveryById(latest):null;
 const recent=$('#recent');if(recent.dataset.item!==(latest??'none')){recent.dataset.item=latest??'none';recent.innerHTML=d?`<button data-detail="${d.id}"><span class="recent-symbol">${icon(d.icon)}</span><span><small>最近带回的小小发现</small><strong>${d.name}</strong></span>${icon('arrow')}</button>`:`<span class="recent-symbol">${icon('receipt')}</span><span><small>收件箱里还很安静</small><strong>第一份宇宙奇物，正在路上。</strong></span>`;}
 const rc=JSON.stringify([publicRadar(state),state.planets,state.upgrades.radar]);if(rc!==lastRadar){lastRadar=rc;renderRadar();}
 const cc=JSON.stringify([state.collection,state.planets,filter]);if(cc!==lastCollection){lastCollection=cc;renderCollection();}
 const bc=state.collection.join(',');if(bc!==lastBase){lastBase=bc;renderBase();}
}
app.addEventListener('click',async e=>{
 const button=(e.target as HTMLElement).closest<HTMLElement>('button');if(!button)return;
 if(button.dataset.go)go(button.dataset.go);
 if(button.dataset.filter){filter=button.dataset.filter as typeof filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));update();}
 if(button.dataset.detail)detail(button.dataset.detail);
 if(button.dataset.interact){const d=discoveryById(button.dataset.interact)!;interaction=d.interaction;$('#interaction').textContent=interaction;button.classList.add('used');}
 if(button.dataset.planet){if(button.dataset.planet==='parcel')go('expedition');else{const p=planetById(button.dataset.planet)!;showModal(`<div class="modal-heading"><span class="eyebrow">NEW COORDINATES</span><button class="icon-button" data-action="close" aria-label="关闭详情">${icon('close')}</button></div><div class="return-emblem">${icon('planet')}</div><h2 class="detail-title">${p.name}</h2><p class="detail-description">${p.subtitle}</p><p class="interaction">航路已记录。失物号正在退件平原工作；这片生态的远征内容将在后续独立航程开放。</p><button class="primary" data-action="close">继续收听宇宙</button>`);}}
 if(button.dataset.upgradeBuy){const id=button.dataset.upgradeBuy as UpgradeId;await transact(s=>upgrade(s,id));workshop();}
 switch(button.dataset.action){case'workshop':workshop();break;case'close':modal.close();break;case'record':await transact(dismissReveal);toast('新坐标已加入永久星图。');break;case'claim':await transact(claimReturn);modal.close();toast('奇物已归档。欢迎回来，管理员。');break;}
});
$('.brand').addEventListener('click',e=>{e.preventDefault();go('base');});
let ticking=false;
async function tick(){if(ticking)return;ticking=true;const hadCargo=!!state.pendingReturn;try{await transact(s=>advance(s,Date.now(),Date.now()-s.lastAt>=30000));if(!hadCargo&&state.pendingReturn&&!modal.open)offline();}finally{ticking=false;}}
setInterval(()=>{if(document.visibilityState==='visible')void tick();},250);
window.addEventListener('storage',e=>{if(e.key===SAVE_KEY){try{state=restore(e.newValue);update();if(modal.open&&$('#modal-body').textContent?.includes('离线归航')&&!state.pendingReturn)modal.close();}catch{/* Keep current valid in-memory state. */}}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void tick();});
update();renderBase();if(state.pendingReturn)offline();if(!storageOK)toast('浏览器暂时无法保存。当前进度会在本次打开期间保留。');
if(new URLSearchParams(location.search).has('review')){
 Object.assign(window,{__review:{scene,freeze:(t:number|null)=>scene.freeze(t),state:()=>structuredClone(state)}});
}
