import {mountReferenceUi} from '../../prototypes/ref-ui/ui';
import {referenceView} from '../../prototypes/ref-ui/model';
import type {FusionController} from '../fusion/contracts';
import type {ExpeditionScene} from '../render/scene';
import {chapterSummary,chapterLinks,chapterKnown,chapterReturnView,type ChapterSave,type ChapterSource} from './model';
import {chapterContent,chapterLine,chapterReveal,chapterLetter,type ChapterCurio} from './content';
import {discoveryById} from '../content/catalog';
import {renewalArtUrl} from '../fusion/renewal-ui';
import {savedCurioCondition} from '../fusion/curio-state-images';
import {itemArt} from '../ui/art';
import mouseUrl from '../../assets/runtime/mouse.webp';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function mountChapterUi(controller:FusionController,scene:ExpeditionScene,focus:()=>{x:number;y:number},replay:(kind:'reveal'|'stop')=>void,qa:boolean,isReplaying:()=>boolean){
 const get=()=>controller.state as ChapterSave,session=crypto.randomUUID(),sent=new Set<string>();
 const record=(kind:'read'|'shown'|'open'|'try'|'conclusion'|'return-session',id:string,source:ChapterSource='manual')=>controller.act({type:'chapter',kind,id,source,session});
 let replaying=false,combo=false,letterOpen=false,lastClaimCurio:string|undefined,returnSnapshot:ChapterSave|null=null;
 const comboHtml='<div class="chapter-combo"><b>明天</b><span>胶带：“对不起……我先盖住它？”</span><span>收据：“遮住日期，不算解决问题。”</span></div>';
 const ref=mountReferenceUi(controller,scene,focus,{
  view(state){replaying=isReplaying();const v=referenceView(state),s=state as ChapterSave,summary=chapterSummary(s);return{...v,objective:s.chapter.endingWorldMs!==null?'退件平原 · 首轮发现完成':'看看旧分拣站又退回了什么',objectiveFull:'这里的包裹，总是早来一步。',eventId:summary.id,title:replaying?'只读回顾 · 返回此刻':summary.title,summary:s.chapter.endingWorldMs!==null?'首轮发现已完成，居民和日常夜访仍会继续。':'自动探索，不必一直点。',markerVisible:false,conclusion:null};},
  card(mode,state){const s=state as ChapterSave,c=s.chapter,summary=chapterSummary(s),label='退件平原 · 探索手记';
   if(mode==='residents')return null;
   if(letterOpen&&mode!=='settings')return{title:'留给管理员的空白地址',label,html:letterHtml()};
   if(mode==='settings')return{title:'设置',label:qa?'剧情开发自测 · QA隔离档':'剧情开发自测 · 自动保存',html:`<p>进度保存在本机独立剧情档，刷新继续。正式旧档不读取、不改写。</p><div class="ref-setting-row"><span>文字大小</span><button data-ref-size="normal">标准</button><button data-ref-size="large">大字</button></div><button data-chapter-log-toggle>${c.telemetry?'关闭':'开启'}本地行为记录</button><p class="ref-muted">只记本地操作，不上传，不采集身份。关闭会清空记录。</p><button data-chapter-export="logs">导出本地记录 JSON</button><button data-chapter-export="csv">导出本地记录 CSV</button><button data-chapter-export="save">导出剧情测试档</button>${qa?'<section class="chapter-qa-label"><p>QA跳转与自然游玩分开，不写自然测试档。</p><div class="chapter-qa-controls"><button data-chapter-qa="eligible">三物取得后</button><button data-chapter-qa="reveal">合法夜班前</button><button data-chapter-qa="ending">末条记录后</button></div><label>显式导入旧权益JSON副本<input id="chapter-import" type="file" accept="application/json"></label></section>':''}`};
   if(mode==='goal')return{title:'比寄出更早的退件',label,html:`<p>${c.endingWorldMs!==null?'退件平原 · 首轮发现完成':'看看旧分拣站又退回了什么。'}</p><p>这里的包裹，总是早来一步。</p>${c.revealWorldMs!==null?`<p class="chapter-note">${chapterReveal.conclusion}</p><button data-chapter-replay>回顾分拣机留下的纸条</button>`:''}${c.endingWorldMs!==null?'<button data-chapter-letter>再读那封信</button>':''}<p class="ref-muted">${c.endingWorldMs!==null?'这一轮发现到这里，居民和日常夜访会继续。':'咔哒会自动探索，整理与升级都随你。'}</p>`};
   if(s.game.pendingReturn&&get().game.pendingReturn?.id!==s.game.pendingReturn.id){
    const id=lastClaimCurio,owned=id&&get().game.collection.includes(id),attribute=id&&id in chapterContent?'data-ref-curio':id&&['mouse','hermit','tagbird'].includes(id)?'data-ref-resident':'data-detail';
    return{title:'成果已收好',label,html:'<p>发现与零件已入库。咔哒会继续探索。</p>'+(owned?`<button class="ref-primary ref-wide" ${attribute}="${id}">看看新发现</button>`:'')};
   }
   if(s.game.pendingReturn){
    const cargo=s.game.pendingReturn,view=chapterReturnView(returnSnapshot??s)!;let body='';
    if(view.kind==='curio'){const id=view.id as ChapterCurio;body=`<div class="ref-subject ref-curio"><img src="${renewalArtUrl(id,'found')}" alt=""><div><strong>${esc(discoveryById(id)!.name)}</strong><p>${chapterContent[id].states[0]}</p></div></div><p class="ref-muted">新发现还在货舱，收下后放进收藏。</p>`;}
    else if(view.kind==='reveal')body=`<div data-chapter-visible="reveal"><p class="chapter-slip">${chapterReveal.slip}</p><p>${chapterReveal.conclusion}</p></div><button data-chapter-replay>看看当时的现场 · 免费</button>`;
    else if(view.kind==='ending')body='<p>有一封留给愿意留下这些东西的人的信。</p><button data-chapter-letter>读信 · 免费</button>';
    else if(view.kind==='link')body='<p class="chapter-note" data-chapter-visible="link/stamp">这枚邮戳，和收据角上的印记一样。</p><button data-ref-curio="stamp">看看这枚邮戳</button>';
    else if(view.kind==='resident')body=`<div class="ref-subject">${itemArt(view.id)}<p>咔哒遇见了${esc(discoveryById(view.id)!.name)}。</p></div><p class="ref-muted">收下观察记录后，去居民观察看看它的住处。</p>`;
    else if(view.kind==='record')body=`<p>新记录：${esc(discoveryById(view.id)!.name)}。</p><p class="ref-muted">收下后可以慢慢看。</p>`;
    else body='<p>咔哒好好探索，也照看了这里。</p><p class="ref-muted">这次没有新的奇物，是日常收获。</p>';
    return{title:view.title,label,html:`<section data-chapter-visible="return/${esc(cargo.id)}">${body}</section><button class="ref-primary ref-wide" data-chapter-claim>${cargo.discoveries.length?'收下发现':'收下成果'}</button><p class="ref-muted">零件 ${cargo.resources} · 照料实付 ${cargo.maintenance??0}</p>`};
   }
   if(summary.kind==='curio'){const id=summary.curio as ChapterCurio,condition=savedCurioCondition(s,id);return{title:discoveryById(id)!.name,label,html:`<div class="ref-subject ref-curio" data-chapter-visible="curio/${id}"><img src="${renewalArtUrl(id,condition)}" alt=""><p>${chapterLine(id,condition)}</p></div><button class="ref-primary ref-wide" data-ref-curio="${id}">看看它</button>`};}
   if(summary.kind==='reveal')return{title:'分拣机留下的纸条',label,html:`<div data-chapter-visible="reveal"><p class="chapter-slip">${chapterReveal.slip}</p><p>${chapterReveal.conclusion}</p><p class="chapter-note">${chapterReveal.result}</p></div><button class="ref-primary ref-wide" data-chapter-replay>看看当时的现场</button><p class="ref-muted">免费回顾，可跳过；当前探索照常继续。</p>${c.endingWorldMs!==null?'<button data-chapter-letter>还有一封留给你的信</button>':''}`};
   if(summary.kind==='ending')return{title:'留给管理员的空白地址',label,html:letterHtml(true)};
   if(summary.kind==='complete')return{title:'退件平原 · 首轮发现完成',label,html:`<p>这一回，就留在这里吧。</p><p class="ref-muted">首轮发现已完成。熟悉的居民、失物和日常夜访会继续陪着你。</p><button data-chapter-replay>回顾分拣纸条</button><button data-chapter-letter>再读那封信</button>${s.projects.includes('archive')?'<button data-ref-replay>完整夜班归档（已购）</button>':''}`};
   return{title:summary.title,label,html:`<p>${s.game.world.elapsedMs%300000>=240000?(s.game.collection.includes('night-shift')?'没有人上班，机器却开始分拣了。':'灯下有些动静，咔哒在看。'):'咔哒正在找失物。不点击也会继续。'}</p>${chapterKnown(s,'link/stamp')?'<p class="chapter-note" data-chapter-visible="link/stamp">这枚邮戳，和收据角上的印记一样。</p>':''}${c.revealWorldMs!==null?'<button data-chapter-replay>回顾分拣机的纸条</button>':''}${s.game.station.lastNight?`<p class="ref-muted">上次照料实付 ${s.game.station.lastNight.spent} 零件</p>`:''}${s.projects.includes('archive')?'<button data-ref-replay>完整夜班归档（已购）</button>':''}`};
  },
  onOpen(mode,id){letterOpen=false;returnSnapshot=mode==='event'&&id.startsWith('return/')?structuredClone(get()):null;if(mode==='event')void record('open',id);},
  onCurio(id){void record('open','curio/'+id);},
  treatment:{line:chapterLine,reply:id=>chapterContent[id].reply,notes(id){const s=get();return chapterLinks(s,id).map(t=>`<p ${id==='stamp'?'data-chapter-visible="link/stamp"':''}>${esc(t)}</p>`).join('')+(id==='receipt'?'<p class="ref-muted">原件 RET-031 / P03 · 签收仍待证</p>':'')+(id==='tape'&&chapterKnown(s,'combo')?'<button data-chapter-combo>让胶带试着遮住“明天” · 免费</button>'+(combo?comboHtml:''):'');},trial(id){void record('try',id);},draw(c,id,trial){
   if(id==='stamp'&&trial>.3){c.save();c.fillStyle='#e7d5b5';c.fillRect(124,142,60,37);c.fillStyle='#9f4d66';c.font='bold 15px sans-serif';c.fillText('昨天',134,165);c.restore();}
   if(id==='receipt'&&trial>.45){c.save();c.fillStyle='#ead8b5';c.fillRect(24,151,145,25);c.fillStyle='#624461';c.font='12px sans-serif';c.fillText('请提前后悔。',35,168);c.restore();}
   if(id==='cosmic-parcel'){c.save();c.globalAlpha=.6+.4*Math.sin(trial*18);c.fillStyle='#f0ce7d';c.fillRect(126,48,3,9);c.fillRect(123,51,9,3);c.restore();}
  }}
 });
 function letterHtml(summary=false,room=false){return`<div class="chapter-letter" data-chapter-visible="ending">${!room?`<p class="ref-muted">${chapterReveal.result} ${chapterReveal.conclusion}</p>`:''}<article><p>${chapterLetter.front}</p><p>${chapterLetter.back}</p><p><b>${chapterLetter.end}</b></p></article><img class="chapter-friend" src="${mouseUrl}" alt="拆封鼠也来留一盏灯"></div><p class="ref-muted">留给管理员的空白地址 · 原记录</p>${room?'':'<button data-chapter-letter-scene>在收藏室读信</button>'}`;}
 document.addEventListener('click',async e=>{
  const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
  if(b.dataset.openProject==='archive'&&get().projects.includes('archive')){replay('stop');replaying=false;e.preventDefault();e.stopImmediatePropagation();document.querySelector<HTMLButtonElement>('.fu-nav [data-tab=explore]')!.click();const archive=document.querySelector<HTMLButtonElement>('#fusion-replay-night');if(archive)archive.click();else{document.querySelector<HTMLButtonElement>('#refui-objective')!.click();document.querySelector('#refui-card-body')!.innerHTML='<p>归档设施已保留。下一次真实夜班后，就能回看完整记录。</p>';}void record('open','night-shift','replay');return;}
  if((b.dataset.detail==='last-recipient'||b.dataset.exhibit==='last-recipient')&&get().chapter.endingWorldMs!==null){e.preventDefault();e.stopImmediatePropagation();document.querySelector<HTMLButtonElement>('#refui-objective')!.click();letterOpen=true;document.querySelector('#refui-card-body')!.innerHTML=letterHtml();document.querySelector('#refui-card-title')!.textContent='留给管理员的空白地址';void record('open','ending','replay');return;}
  if(b.hasAttribute('data-chapter-replay')){replaying=true;document.querySelector<HTMLButtonElement>('[data-ref-close]')?.click();replay('reveal');void record('open','reveal','replay');return;}
  if(b.id==='refui-event'&&isReplaying()){replay('stop');replaying=false;return;}
  if(b.hasAttribute('data-chapter-letter')){letterOpen=true;const body=document.querySelector('#refui-card-body');if(body){body.innerHTML=letterHtml();document.querySelector('#refui-card-title')!.textContent='留给管理员的空白地址';}void record('open','ending','replay');return;}
  if(b.hasAttribute('data-chapter-letter-scene')){document.querySelector<HTMLButtonElement>('[data-ref-close]')?.click();setTimeout(()=>{document.querySelector<HTMLButtonElement>('.fu-nav [data-tab=collection]')?.click();const root=document.querySelector('.fu-museum')??document.querySelector('#fusion-museum');if(root&&!root.querySelector('.chapter-letter-scene'))root.insertAdjacentHTML('beforeend',`<div class="chapter-letter-scene" style="position:absolute;bottom:105px;left:10px;right:10px;z-index:2">${letterHtml(false,true)}<button data-chapter-letter-close>收好这封信</button></div>`);},120);return;}
  if(b.hasAttribute('data-chapter-letter-close')){b.closest('.chapter-letter-scene')?.remove();return;}
  if(b.hasAttribute('data-chapter-claim')){const pending=get().game.pendingReturn;const fresh=pending?.discoveries.filter(id=>!get().game.collection.includes(id))??[];const id=fresh.find(id=>id in chapterContent)??fresh.find(id=>['mouse','hermit','tagbird'].includes(id))??fresh[0];lastClaimCurio=id;const r=await controller.act({type:'claim'});if(r.ok&&id&&id in chapterContent){document.querySelector('#refui-card-body')!.innerHTML=`<p>发现已收进收藏。</p><button data-ref-curio="${id}">看看新失物</button>`;}return;}
  if(b.hasAttribute('data-chapter-log-toggle')){await controller.act({type:'chapter',kind:'telemetry',id:'logs',enabled:!get().chapter.telemetry});return;}
  if(b.dataset.chapterExport){const kind=b.dataset.chapterExport,data=kind==='save'?get():get().chapter.logs;let text=JSON.stringify(data,null,2);if(kind==='csv')text='session,at,object,event,version,source\n'+get().chapter.logs.map(r=>[r.session,r.at,r.object,r.event,r.version,r.source].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download='loststar-chapter-'+kind+(kind==='csv'?'.csv':'.json');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(b.hasAttribute('data-chapter-combo')){combo=true;const host=document.querySelector('#lt-story-notes')!;if(!host.querySelector('.chapter-combo'))host.insertAdjacentHTML('beforeend',comboHtml);void record('try','combo');return;}
 },true);
 const visible=()=>{if(document.hidden)return;const roots=[...document.querySelectorAll<HTMLElement>('[data-chapter-visible]')];const img=document.querySelector<HTMLImageElement>('#refui-treatment[open] #lt-image[data-ready=true]');if(img){const id=img.dataset.stateImage?.replace(/-(found|clean|stabilized)\.webp$/,'');if(id)roots.push(Object.assign(img,{chapterVisibleId:'curio/'+id}));}for(const el of roots){const id=el.dataset.chapterVisible??(el as HTMLElement&{chapterVisibleId:string}).chapterVisibleId;if(!id||sent.has(id)||!el.getClientRects().length)continue;const r=el.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight)continue;sent.add(id);void record('shown',id).then(result=>{if(!result.ok){sent.delete(id);return;}void record('read',id);if(id==='reveal')void record('conclusion','reveal');});}};
 const star=document.createElement('i');star.id='chapter-box-star';star.setAttribute('aria-hidden','true');document.querySelector('.lt-picture')!.append(star);
 const timer=setInterval(()=>{visible();star.hidden=!document.querySelector<HTMLImageElement>('#lt-image')?.dataset.stateImage?.startsWith('cosmic-parcel-')||!document.querySelector('#refui-treatment[open]');replaying=isReplaying();const s=get();if(s.chapter.endingWorldMs!==null){for(const el of document.querySelectorAll<HTMLElement>('#fusion-collection-next p'))el.textContent='首轮发现已完成，日常探索继续。';}},250);
 void record('return-session','session','automatic');window.addEventListener('pageshow',e=>{if(e.persisted)void record('return-session','session','automatic');});
 return{...ref,stop:()=>clearInterval(timer)};
}
