import './d1.css';
import {newGame} from '../game/engine';
import {ExpeditionScene} from '../render/scene';
import {MuseumScene,exhibitIds,residentIds} from '../render/museum';
import {nightStage,nightCaption,receiptStage} from './d1-motion';
import {createNightStudy} from './night-scene';

type Study='night'|'receipt';
const tierNames=['基础玻璃罩','黄铜灯座','邮政微景观','典藏封存舱'];
const tierNotes=[
  '免费玻璃罩与原台面 · 纸卷保留原尺寸、低频摆动。',
  '加厚黄铜台座、独立金属铭牌 · 暖灯随结构安装点亮。',
  '柜内邮政微景观、票据机械臂 · 票据沿专属装置循环。',
  '高耸典藏舱、展开外框与环绕机构 · 专属扫描标记持续运行。',
];

/** Review-only entry: no persistence/preferences imports, no simulation/reward calls. */
export function mountD1(initial:Study='night'){
  const root=document.querySelector<HTMLElement>('#app')!;
  document.title='失物星球 · D1 动态样板';
  root.innerHTML=`<main id="d1-app">
    <header class="d1-header"><div class="d1-mark" aria-hidden="true">LR<span>01</span></div><div><span class="d1-eyebrow">LOSTSTAR / 动态制作样板</span><h1>失物星球 <small>D1</small></h1></div><span class="d1-readonly">只读预览<br><b>不扣零件</b></span></header>
    <p class="d1-disclaimer">独立审核样板 · 不读取、不修改原存档</p>
    <section data-study-panel="night" aria-label="球面夜间处置样板">
      <div class="d1-section-heading"><div><span class="d1-eyebrow">RETURNS PLAIN / 原场景分层</span><h2>夜间邮路 · 漂行纸影</h2></div><span class="d1-tag">30 秒连续动作</span></div>
      <div class="d1-night-frame"><div class="d1-scene-label"><span><i></i>巡守通信接通</span><span>球面追踪 / LR–01</span></div><div id="d1-scene"></div></div>
      <div id="d1-status" class="d1-caption" role="status" data-phase="signal"><span class="d1-eyebrow">KADA–07 / 正在接通</span><strong>箱堆里，多了一封没有地址的影子。</strong><p>加载原球体、咔哒与失物号图层。</p></div>
      <div class="d1-timeline" aria-hidden="true"><span></span></div><div class="d1-playback"><span id="d1-time">00 / 30 秒</span><button id="d1-replay">↻ 重看 30 秒</button></div>
      <p class="d1-note">原球体、原邮路、原绕轨飞船。只演示核验、收容与回站，不进行战果或维修结算。</p>
    </section>
    <section data-study-panel="receipt" aria-label="收据展柜四级结构样板" hidden>
      <div class="d1-section-heading"><div><span class="d1-eyebrow">CABINET STUDY / 同台面同奇物</span><h2>未购买的退货收据</h2></div><span class="d1-tag">四档结构对照</span></div>
      <div class="d1-receipt-frame"><canvas id="receipt-focus" width="660" height="930" role="img" aria-label="原收藏室中收据展柜的分层结构近景"></canvas><span class="d1-receipt-stamp">COLLECTION<br>LR–01 / RECEIPT</span></div>
      <div class="d1-tier-buttons" role="group" aria-label="选择展柜样板等级">${tierNames.map((label,i)=>`<button data-tier="${i}" aria-pressed="${i===0}"><small>Lv${i}</small>${label}</button>`).join('')}</div>
      <div id="receipt-status" class="d1-receipt-status" role="status"><strong>Lv0 · 基础玻璃罩</strong><p>${tierNotes[0]}</p></div>
      <div class="d1-receipt-controls"><button id="receipt-install">▶ 播放 0→3 安装</button><button id="receipt-view" aria-pressed="false">切至房间视角</button></div>
      <p class="d1-note">原台面坐标、收据中心与尺寸四档一致。基础陈列免费；此页不购买升级。</p>
    </section>
    <footer class="d1-footer" aria-label="切换动态样板"><button data-study="night" aria-pressed="true"><span>01</span> 球面夜巡</button><button data-study="receipt" aria-pressed="false"><span>02</span> 收据展柜</button></footer>
    <p class="d1-build">D1 / ${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty?' · 本地修改':''} · 开发审核</p>
    <div id="d1-museum-source" hidden></div>
  </main>`;
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  // Only in-memory scene inputs. Advancing or viewing the study never touches money.
  const dummy=newGame(0);dummy.collection=[...exhibitIds,...residentIds];
  const scene=new ExpeditionScene(q('#d1-scene'),()=>dummy,createNightStudy());
  scene.canvas.setAttribute('aria-label','D1完整退货箱星：纸影出现，咔哒沿原邮路核验、收容并送回原仓库；飞船前后绕轨');
  let museum:MuseumScene|undefined;
  const receiptCanvas=q<HTMLCanvasElement>('#receipt-focus');
  let study=initial,started=false,museumReady=false,level=0,view:'focus'|'room'='focus',installing=false,installStart=0,receiptTime=0,last=0;
  let lastPhase='',lastTier=-1;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const startedAt=performance.now();
  function loadMuseum(){
    if(museum)return;
    try{
      museum=new MuseumScene(q('#d1-museum-source'),()=>dummy,()=>0,()=>performance.now()/1000,{receiptStudy:true});
      void museum.ready.then(()=>{museumReady=museum?.canvas.dataset.ready==='true';if(!museumReady)q('#receipt-status p').textContent='展柜素材暂未接通，请刷新重新载入。';});
    }catch{q('#receipt-status p').textContent='展柜素材尚未接通，可先查看球面夜巡样板；请刷新重试。';}
  }
  function selectStudy(next:Study){
    study=next;for(const node of root.querySelectorAll<HTMLElement>('[data-study-panel]'))node.hidden=node.dataset.studyPanel!==next;
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-study]'))button.setAttribute('aria-pressed',String(button.dataset.study===next));
    scene.setActive(next==='night');q('#d1-app').dataset.currentStudy=next;if(next==='receipt')loadMuseum();
  }
  function tierUI(){
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-tier]'))button.setAttribute('aria-pressed',String(Number(button.dataset.tier)===level));
    q('#receipt-status strong').textContent=`Lv${level} · ${tierNames[level]}`;q('#receipt-status p').textContent=tierNotes[level];lastTier=level;
  }
  q('#d1-replay').addEventListener('click',()=>{scene.restart();started=true;lastPhase='';});
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-study]'))button.addEventListener('click',()=>selectStudy(button.dataset.study as Study));
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-tier]'))button.addEventListener('click',()=>{installing=false;level=Number(button.dataset.tier);q('#receipt-install').textContent='▶ 播放 0→3 安装';q('#receipt-install').dataset.playing='false';tierUI();});
  q('#receipt-install').addEventListener('click',()=>{installing=true;installStart=performance.now();level=0;q('#receipt-install').dataset.playing='true';q('#receipt-install').textContent='↻ 重新播放安装';tierUI();});
  q('#receipt-view').addEventListener('click',()=>{view=view==='focus'?'room':'focus';q('#receipt-view').setAttribute('aria-pressed',String(view==='room'));q('#receipt-view').textContent=view==='focus'?'切至房间视角':'返回展柜近景';});
  selectStudy(initial);
  function frame(now:number){
    if(scene.ready&&!started){scene.restart();started=true;}
    if(now-last>=(reducedMotion.matches?100:45)){
      last=now;const seconds=started?scene.elapsedSeconds():0,s=nightStage(seconds),caption=nightCaption[s.phase];
      q('#d1-status').dataset.phase=s.phase;
      if(lastPhase!==s.phase){q('#d1-status .d1-eyebrow').textContent=`KADA–07 / ${s.phase==='done'?'巡守完成':'现场作业'}`;q('#d1-status strong').textContent=caption.title;q('#d1-status p').textContent=caption.detail;lastPhase=s.phase;}
      q('#d1-time').textContent=`${String(Math.floor(Math.min(30,seconds))).padStart(2,'0')} / 30 秒`;
      q('.d1-timeline span').style.width=`${Math.min(1,seconds/30)*100}%`;
      receiptTime=(now-startedAt)/1000;
      let install=1;
      if(installing){const stage=receiptStage((now-installStart)/1000);level=stage.level;install=stage.install;if(stage.done){installing=false;q('#receipt-install').dataset.playing='false';q('#receipt-install').textContent='↻ 重看 0→3 安装';}}
      if(lastTier!==level)tierUI();
      if(museumReady&&study==='receipt')museum?.renderFocused(receiptCanvas,'receipt',level,receiptTime,install,view);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
