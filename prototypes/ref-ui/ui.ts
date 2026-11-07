import type {FusionController} from '../../src/fusion/contracts';
import type {ExpeditionScene} from '../../src/render/scene';
import {latestNightHistory} from '../../src/fusion/domain';
import {PlanetTapGesture,type TapPointer} from '../../src/fusion/tap-gesture';
import {worldView} from '../../src/game/world';
import {renewalArtUrl,icon} from '../../src/fusion/renewal-ui';
import {discoveryById} from '../../src/content/catalog';
import {referenceView} from './model';
import boxUrl from '../../assets/runtime/visual-renewal/world/visitor-box-awake.webp';
import mothUrl from '../../assets/runtime/visual-renewal/world/visitor-moth-awake.webp';
import paperUrl from '../../assets/runtime/visual-renewal/world/visitor-paper-awake.webp';
import {savedCurioCondition} from '../../src/fusion/curio-state-images';
import {isRenewalCurio} from '../../src/fusion/curio-renewal-model';
import {v034NightCamera} from '../../src/review/v034-night-stage';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const guestNames=['会走的纸箱','纸翅蛾','同号纸影'],guestArt=[boxUrl,mothUrl,paperUrl];

export function mountReferenceUi(controller:FusionController,scene:ExpeditionScene,focus:()=>{x:number;y:number}) {
  document.body.dataset.referenceUi='candidate';
  const app=document.querySelector<HTMLElement>('#app')!,root=app.querySelector<HTMLElement>('#fusion-app')!;
  const header=root.querySelector('.fu-header')!;
  header.insertAdjacentHTML('beforeend',`<button id="refui-settings" class="ref-icon-button" data-ref-open="settings" aria-label="设置">${icon('gear')}</button>`);
  const explore=root.querySelector('#fusion-explore')!;
  explore.insertAdjacentHTML('afterbegin',`<button id="refui-objective" class="ref-goal" data-ref-open="goal"><span>当前调查</span><strong></strong>${icon('arrow')}</button>`);
  const shell=root.querySelector<HTMLElement>('.fu-world-shell')!;
  shell.insertAdjacentHTML('beforeend',`<button id="refui-marker" class="ref-marker" data-ref-open="event" hidden><span>${icon('radar')}</span><strong></strong></button><i id="refui-source" class="ref-source" aria-hidden="true" hidden></i>`);
  const oldEntry=root.querySelector('#fusion-observe')!;
  oldEntry.insertAdjacentHTML('afterend',`<button id="refui-event" class="ref-event" data-ref-open="event"><span class="ref-event-icon">${icon('book')}</span><span><small></small><strong></strong></span>${icon('arrow')}</button>`);
  app.insertAdjacentHTML('beforeend',`<dialog id="refui-card" class="ref-card" aria-labelledby="refui-card-title"><header><div><small id="refui-card-label"></small><h2 id="refui-card-title"></h2></div><button data-ref-close class="ref-icon-button" aria-label="关闭，返回现场">${icon('close')}</button></header><div id="refui-card-body"></div></dialog>`);
  const card=document.querySelector<HTMLDialogElement>('#refui-card')!,cardBody=document.querySelector<HTMLElement>('#refui-card-body')!;
  const summary=document.querySelector<HTMLElement>('#refui-event')!,marker=document.querySelector<HTMLButtonElement>('#refui-marker')!,source=document.querySelector<HTMLElement>('#refui-source')!;
  let layer:'none'|'card'|'drawer'|'preview'='none';
  let historyTravel=false;
  const travel=(steps:number)=>{if(!historyTravel){historyTravel=true;history.go(steps);}};
  let nativeClosing:Promise<void>|null=null,resolveNative:(()=>void)|null=null;
  let fieldContext:{scroll:number;panelScroll:number;details:{id:string;open:boolean}[]}|null=null;
  const native=document.querySelector<HTMLDialogElement>('#fusion-drawer')!;
  const replaying=()=>!document.querySelector<HTMLElement>('#fusion-flow-replay')!.hidden;
  let historyOwned=false,pendingClose:Promise<void>|null=null,resolveClose:(()=>void)|null=null;
  let mode:'event'|'goal'|'settings'='event',origin:HTMLElement|null=null,openedId='',openedState=structuredClone(controller.state),signature='',hold:{id:number;x:number;y:number;at:number}|null=null;
  const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
  function open(next:typeof mode,target:HTMLElement){
    if(pendingClose)return;
    // One object, one modal. Keep the original world clock and full globe dimensions.
    fieldContext=!$('#fusion-field-drawer').hidden?{scroll:$('#fusion-scroll').scrollTop,panelScroll:$('#fusion-field-drawer').scrollTop,details:[...$('#fusion-field-drawer').querySelectorAll('details')].map(d=>({id:d.id,open:d.open}))}:null;
    if(fieldContext)$('#fusion-field-close').click();
    mode=next;origin=target;openedId=referenceView(controller.state).eventId;openedState=structuredClone(controller.state);signature='';
    render();if(!card.open){history.pushState({...history.state,refUiCard:true},'');historyOwned=true;layer='card';card.showModal();}source.hidden=next!=='event';
  }
  function pushLayer(next:typeof layer){layer=next;history.pushState({...history.state,refUiLayer:next},'');}
  function finishClose(){
    card.close();source.hidden=true;historyOwned=false;layer='none';
    if(fieldContext&&!$('#fusion-explore').hidden){const context=fieldContext;fieldContext=null;$('#fusion-observe').click();for(const d of context.details){const el=document.getElementById(d.id) as HTMLDetailsElement|null;if(el)el.open=d.open;}$('#fusion-scroll').scrollTop=context.scroll;$('#fusion-field-drawer').scrollTop=context.panelScroll;}
    fieldContext=null;(origin?.isConnected&&!origin.hidden?origin:summary).focus({preventScroll:true});const resolve=resolveClose;resolveClose=null;pendingClose=null;resolve?.();
  }
  function close():Promise<void>{if(!card.open)return Promise.resolve();if(pendingClose)return pendingClose;if(!historyOwned){finishClose();return Promise.resolve();}pendingClose=new Promise<void>(resolve=>{resolveClose=resolve;});travel(-1);return pendingClose;}
  function closeNative():Promise<void>{if(!native.open)return Promise.resolve();if(layer==='none'){$('#fusion-close').click();return Promise.resolve();}if(nativeClosing)return nativeClosing;nativeClosing=new Promise<void>(resolve=>{resolveNative=resolve;});$('#fusion-close').click();return nativeClosing;}
  window.addEventListener('popstate',event=>{
    historyTravel=false;
    if(layer==='card'){finishClose();return;}
    if(layer==='preview'&&event.state?.refUiLayer==='drawer'&&native.open){layer='drawer';$('#fusion-state-preview-close').click();return;}
    if(layer==='drawer'||layer==='preview'){layer='none';if(native.open)$('#fusion-close').click();}
    const resolve=resolveNative;resolveNative=null;nativeClosing=null;resolve?.();
  });
  const nativeObserver=new MutationObserver(()=>{
    const preview=native.open&&$('#fusion-drawer-body').dataset.imagePreview==='true';
    if(native.open&&layer==='none'&&!nativeClosing)pushLayer('drawer');
    if(preview&&layer==='drawer')pushLayer('preview');
    if(!native.open&&(layer==='drawer'||layer==='preview'))travel(layer==='preview'?-2:-1);
    else if(native.open&&!preview&&layer==='preview')travel(-1);
  });
  nativeObserver.observe(native,{attributes:true,attributeFilter:['open']});nativeObserver.observe($('#fusion-drawer-body'),{attributes:true,attributeFilter:['data-image-preview']});
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&layer==='preview'){event.preventDefault();event.stopImmediatePropagation();travel(-1);}},true);
  function factsHtml(){const v=referenceView(controller.state);return v.flow.clues.length?`<details class="ref-records"><summary>已有的现场线索</summary>${v.flow.clues.map(c=>`<p>${escape(c.text)}</p>`).join('')}</details>`:'';}
  function renderCard(){
    const live=referenceView(controller.state);
    if(live.eventId===openedId)openedState=structuredClone(controller.state);
    const state=mode==='event'&&live.eventId!==openedId?openedState:controller.state,v=referenceView(state);
    const key=JSON.stringify([mode,v.eventId,v.title,v.identified,v.knownNight,v.guestId,v.flow.waitingCurio,v.flow.previousNight,v.conclusion,state.receipt.condition,state.game.pendingReturn?.resources,live.eventId===openedId]);
    if(key===signature)return;signature=key;
    $('#refui-card-label').textContent=mode==='goal'?'旧分拣站 · 当前调查':mode==='settings'?'UI隔离样板 · 只影响本次查看':v.flow.kind==='night'?(v.knownNight?'日常来访':'现场观察'):'退件平原 · 现场';
    $('#refui-card-title').textContent=mode==='goal'?(v.conclusion?.title??v.objectiveFull):mode==='settings'?'设置':v.title;
    if(mode==='settings'){
      cardBody.innerHTML='<p>正式存档和设置不会被这份样板修改。</p><div class="ref-setting-row"><span>文字大小</span><button data-ref-size="normal">标准</button><button data-ref-size="large">大字</button></div><p class="ref-muted">动态遵循系统“减少动态”；声音沿用当前静音偏好，本样板不保存设置。</p><details class="ref-records"><summary>切换隔离样板场景</summary><p class="ref-muted">仅切换内存示例，重开样板不影响正式存档。</p><div class="ref-profile-grid"><button data-ref-profile="fresh">初来探索</button><button data-ref-profile="owned">已购展柜</button><button data-ref-profile="night">首次夜访</button><button data-ref-profile="repeat-night">日常来访</button><button data-ref-profile="morning">清晨回看</button><button data-ref-profile="conclusion">纸路结论</button></div></details>';return;
    }
    if(mode==='goal'){
      const c=v.conclusion;
      cardBody.innerHTML=c?`<p class="ref-result">${escape(c.detail)}</p>${c.evidence?`<p class="ref-evidence"><small>已有事实</small>${escape(c.evidence.text)}</p>`:''}<p><small>接下来</small>${escape(c.next)}</p>${factsHtml()}`:`<p>沿着真实纸路，听清回声、核对箱标，把卡住的地方接通。</p><p class="ref-muted">${escape(v.flow.objectiveNote)}</p>${factsHtml()}`;return;
    }
    let html='';
    if(v.flow.kind==='night'){
      html=v.identified&&v.guestId!==null?`<div class="ref-subject"><img src="${guestArt[v.guestId]}" alt="${guestNames[v.guestId]}"><div><strong>${guestNames[v.guestId]}</strong><p>${v.knownNight?'熟悉的访客又来了。':'咔哒刚辨认了这位访客。'}</p></div></div>`:`<div class="ref-subject"><span class="ref-unknown">${icon('lantern')}</span><p>光束正在辨认来处，先不猜它是谁。</p></div>`;
      html+=`<p>${v.knownNight?'这是日常来访，照料仍会自动进行。':'咔哒、飞船和灯架会继续照看这里。'}</p><p class="ref-muted">${live.eventId===openedId?'关上卡片，继续看现场。':'现场已继续推进，结果会留在探索记录里。'}</p>`;
    }else if(v.flow.waitingCurio){
      const id=v.flow.waitingCurio,condition=isRenewalCurio(id)?savedCurioCondition(state,id):'found';
      html=`<div class="ref-subject ref-curio"><img src="${renewalArtUrl(id,condition)}" alt=""><div><strong>${escape(discoveryById(id)!.name)}</strong><p>刚获得 · 等你安顿</p></div></div><p>从这里取出，清理好，再放进收藏室。</p><button class="ref-primary ref-wide" data-ref-curio="${id}">进入整理 ${icon('arrow')}</button>`;
    }else html=`<p>${escape(v.summary)}</p>${v.conclusion?`<p class="ref-result">${escape(v.conclusion.detail)}</p>`:''}`;
    const morning=v.flow.previousNight;
    if(morning&&v.flow.kind!=='night')html+=`<section class="ref-morning"><small>第${morning.number}夜 · ${morning.number>1?'日常记录':'昨夜记录'}</small><p>${morning.visitors===null?'昨夜记录已收好。':`照看了${morning.visitors}位访客。`}</p><p>收件站照料实付 <b>${morning.maintenance}</b> 零件</p></section>`;
    if(state.game.pendingReturn)html+=`<p>离线带回${state.game.pendingReturn.resources}零件</p><button class="ref-primary ref-wide" data-ref-claim>收下发现</button>`;
    if(state.projects.includes('archive'))html+=latestNightHistory(state)?.world.lastReport?.result?'<button class="ref-primary ref-wide" data-ref-replay>看上一夜</button>':'<p class="ref-muted">还没有可回看的夜晚。</p>';
    cardBody.innerHTML=html+factsHtml();
  }
  function render(){
    const v=referenceView(controller.state);
    $('#refui-objective strong').textContent=v.objective;
    summary.querySelector('small')!.textContent=replaying()?'只读回看':v.flow.kind==='night'?(v.knownNight?'日常来访':'现场动静'):v.flow.kind==='dawn'?'清晨回看':'正在发生';
    summary.querySelector('strong')!.textContent=replaying()?'昨夜回看 · 回到此刻':v.title;summary.dataset.eventId=v.eventId;marker.dataset.eventId=v.eventId;
    marker.querySelector('strong')!.textContent=v.flow.kind==='night'?'灯下有动静':v.flow.waitingCurio?'看看失物':'箱堆有回声';
    marker.hidden=replaying()||!v.markerVisible;
    document.querySelectorAll<HTMLElement>('.fu-base-grow').forEach(b=>{for(const node of b.childNodes)if(node.nodeType===Node.TEXT_NODE)node.textContent=node.textContent?.replace('让探索轻松一点','升级设备')??'';});
    const title=$('#fusion-drawer-title');if(title.textContent==='让探索轻松一点')title.textContent='升级设备';
    if(card.open)source.hidden=mode!=='event'||v.eventId!==openedId;
    if(card.open||signature==='')renderCard();
  }
  // Intercept at window capture: the legacy scene gesture is registered on document capture.
  // Preserve sorting's actual paid work route; route other nighttime inspection through this same card.
  const nightGesture=new PlanetTapGesture(),nightPointers=new Set<number>(),hero=$('#fusion-tap');
  let nightClick:{x:number;y:number;at:number}|null=null;
  const sample=(event:PointerEvent):TapPointer=>({id:event.pointerId,primary:event.isPrimary,button:event.button,x:event.clientX,y:event.clientY,at:performance.now(),scroll:[$('#fusion-scroll').scrollTop,scrollX,scrollY,visualViewport?.offsetLeft??0,visualViewport?.offsetTop??0].join('/')});
  window.addEventListener('pointerdown',event=>{
    if(card.open||replaying()||!scene.ready||worldView(controller.state.game).phase!=='night'||!hero.contains(event.target as Node))return;
    const hit=scene.pickAtClient(event.clientX,event.clientY);if(hit.id==='sorting')return;
    nightPointers.add(event.pointerId);nightGesture.down(sample(event),hit.kind!=='space');event.stopImmediatePropagation();
  },true);
  window.addEventListener('pointermove',event=>{if(nightPointers.has(event.pointerId)){nightGesture.move(sample(event));event.stopImmediatePropagation();}},true);
  window.addEventListener('pointerup',event=>{if(!nightPointers.delete(event.pointerId))return;const accepted=nightGesture.up(sample(event));event.stopImmediatePropagation();nightClick={x:event.clientX,y:event.clientY,at:performance.now()};if(accepted)open('event',hero);},true);
  window.addEventListener('pointercancel',event=>{if(nightPointers.delete(event.pointerId)){nightGesture.pointerCancel(event.pointerId);event.stopImmediatePropagation();}},true);
  window.addEventListener('click',event=>{if(nightClick&&event.detail>0&&performance.now()-nightClick.at<600&&Math.hypot(event.clientX-nightClick.x,event.clientY-nightClick.y)<12){nightClick=null;event.preventDefault();event.stopImmediatePropagation();}},true);
  window.addEventListener('keydown',event=>{if(event.target===hero&&!replaying()&&worldView(controller.state.game).phase==='night'&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)open('event',hero);}},true);
  const resetNight=()=>{nightGesture.reset();nightPointers.clear();nightClick=null;};
  window.addEventListener('blur',resetNight);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetNight();});
  window.addEventListener('scroll',()=>nightGesture.cancel(),true);visualViewport?.addEventListener('scroll',()=>nightGesture.cancel());
  const gestures=new WeakMap<HTMLElement,{valid:boolean}>();
  app.addEventListener('pointerdown',e=>{const target=(e.target as Element).closest<HTMLElement>('[data-ref-open]');if(!target)return;e.stopPropagation();hold=e.isPrimary?{id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()}:null;gestures.set(target,{valid:e.isPrimary});},true);
  app.addEventListener('pointerup',e=>{const target=(e.target as Element).closest<HTMLElement>('[data-ref-open]');if(!target)return;e.stopPropagation();gestures.set(target,{valid:!!hold&&hold.id===e.pointerId&&performance.now()-hold.at<450&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)<8});hold=null;},true);
  app.addEventListener('click',event=>{
    const target=(event.target as Element).closest<HTMLButtonElement>('button');if(!target)return;
    if(target.id==='fusion-assist'&&!replaying()&&worldView(controller.state.game).phase==='night'){event.preventDefault();event.stopImmediatePropagation();open('event',target);return;}
    if(target.dataset.refOpen==='event'&&replaying()){event.preventDefault();event.stopImmediatePropagation();if(event.detail===0||gestures.get(target)?.valid){$('#fusion-assist').click();render();}return;}
    if(target.dataset.project==='archive'){event.preventDefault();event.stopImmediatePropagation();void controller.act({type:'project',id:'archive'}).then(async result=>{if(!result.ok)return;await closeNative();document.querySelector<HTMLButtonElement>('.fu-nav [data-tab="explore"]')!.click();open('event',summary);});return;}
    if(target.dataset.openProject==='archive'||target.dataset.detail==='night-shift'||target.dataset.exhibit==='night-shift'){event.preventDefault();event.stopImmediatePropagation();void closeNative().then(()=>{document.querySelector<HTMLButtonElement>('.fu-nav [data-tab="explore"]')!.click();open('event',summary);});return;}
    if(target.hasAttribute('data-ref-replay')){event.preventDefault();event.stopImmediatePropagation();void close().then(()=>{$('#fusion-replay-night').click();render();});return;}
    if(target.dataset.refOpen){event.preventDefault();event.stopImmediatePropagation();if(event.detail===0||gestures.get(target)?.valid)open(target.dataset.refOpen as typeof mode,target);return;}
    if(target.hasAttribute('data-ref-close')){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(target.dataset.refCurio){event.preventDefault();event.stopImmediatePropagation();const id=target.dataset.refCurio;void close().then(()=>document.querySelector<HTMLButtonElement>(`#fusion-collection-list [data-detail="${id}"]`)?.click());return;}
    if(target.hasAttribute('data-ref-claim')){event.preventDefault();event.stopImmediatePropagation();void controller.act({type:'claim'}).then(()=>{signature='';renderCard();});return;}
    if(target.dataset.refProfile){event.preventDefault();event.stopImmediatePropagation();const url=new URL(location.href);url.searchParams.set('profile',target.dataset.refProfile);location.assign(url);return;}
    if(target.dataset.refSize){event.preventDefault();event.stopImmediatePropagation();document.documentElement.dataset.textSize=target.dataset.refSize;return;}
    // Existing settings entry routes to the same transient card; preferences never save from this sample.
    if(target.id==='fusion-settings'||target.dataset.drawer==='settings'){event.preventDefault();event.stopImmediatePropagation();open('settings',target);return;}
    if(target.dataset.preference){event.preventDefault();event.stopImmediatePropagation();return;}
  },true);
  card.addEventListener('cancel',event=>{event.preventDefault();close();});
  card.addEventListener('click',event=>{if(event.target===card){const b=card.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)close();}});
  const observer=new MutationObserver(()=>{const t=$('#fusion-drawer-title');if(t.textContent==='让探索轻松一点')t.textContent='升级设备';});observer.observe($('#fusion-drawer-title'),{childList:true});
  controller.subscribe(render);render();
  function position(){
    const v=referenceView(controller.state),point=v.flow.kind==='night'?focus():v.site?{
      x:32+v034NightCamera.x+(v.site.anchor.x-v034NightCamera.x)*v034NightCamera.scale+v034NightCamera.offsetX,
      y:v034NightCamera.y+(v.site.anchor.y-v034NightCamera.y)*v034NightCamera.scale+v034NightCamera.offsetY}:focus();
    const b=scene.canvas.getBoundingClientRect(),s=shell.getBoundingClientRect(),scale=Math.min(b.width/scene.canvas.width,b.height/scene.canvas.height);
    const x=b.left-s.left+(b.width-scene.canvas.width*scale)/2+point.x*scale,y=b.top-s.top+(b.height-scene.canvas.height*scale)/2+point.y*scale;
    const w=marker.offsetWidth||122;marker.style.left=`${Math.max(8,Math.min(s.width-w-8,x-w/2))}px`;marker.style.top=`${Math.max(12,Math.min(s.height-54,y-108))}px`;
    source.style.left=`${x}px`;source.style.top=`${y}px`;
    requestAnimationFrame(position);
  }
  requestAnimationFrame(position);
}
