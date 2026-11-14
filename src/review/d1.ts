import './d1.css';
import {newGame} from '../game/engine';
import {ExpeditionScene} from '../render/scene';
import {MuseumScene,exhibitIds,residentIds} from '../render/museum';
import {nightStage,nightCaption,receiptStage,reviewEnvironment} from './d1-motion';
import {createNightStudy} from './night-scene';
import {
  RECEIPT_RESEARCH_LEVELS, RECEIPT_SAMPLE_BATCHES,
  resolveReceiptReading, receiptExperimentFrame,
  type ReceiptResearchLevel, type ReceiptReading, type ReceiptExperimentFrame,
} from './receipt-reading';

type Study='night'|'receipt';
const tierNames=['基础玻璃罩','黄铜灯座','邮政微景观','典藏封存舱'];
const tierNotes=[
  '旧纸卷的纤维、磨边与退货印记，随轻微卷曲浮现。',
  '暖灯照进纸面，折痕、压印与卷边呈现更深的层次。',
  '邮政微景观衬托纸面暗纹，票据机械与墨迹缓缓呼应。',
  '典藏舱里的邮路暗纹渐渐显影，纸卷带着灯光轻轻回弹。',
];

/** Review-only entry: no persistence/preferences imports, no simulation/reward calls. */
export function mountD1(initial:Study='night'){
  const root=document.querySelector<HTMLElement>('#app')!;
  document.title='失物星球 · D1 动态样板';
  document.documentElement.dataset.build=`${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty?' (本地修改中)':''}`;
  root.innerHTML=`<main id="d1-app">
    <header class="d1-header"><div class="d1-mark" aria-hidden="true">LR<span>01</span></div><div><span class="d1-eyebrow">LOSTSTAR / 动态制作样板</span><h1>失物星球 <small>D1</small></h1></div><span class="d1-readonly">只读预览<br><b>不扣零件</b></span></header>
    <p class="d1-disclaimer">独立审核样板 · 不读取、不修改原存档</p>
    <section data-study-panel="night" aria-label="球面夜间处置样板">
      <div class="d1-section-heading"><div><span class="d1-eyebrow">RETURNS PLAIN / 原场景分层</span><h2>居民作息 · 夜间邮路</h2></div><span id="d1-duration" class="d1-tag">30 秒连续动作</span></div>
      <div class="d1-night-frame"><div class="d1-scene-label"><span><i></i><span id="d1-ecology-label">夜晚 · 居民休息</span></span><span>球面追踪 / LR–01</span></div><div id="d1-scene"></div></div>
      <div id="d1-status" class="d1-caption" role="status" data-phase="signal"><span class="d1-eyebrow">KADA–07 / 正在接通</span><strong>管道旁，多了一封没有地址的影子。</strong><p>加载原球体、咔哒与失物号图层。</p></div>
      <div class="d1-timeline" aria-hidden="true"><span></span></div><div class="d1-playback"><span id="d1-time">00 / 30 秒</span><button id="d1-environment" aria-pressed="false">昼夜对照</button><button id="d1-replay">↻ 重播</button></div>
      <p class="d1-note">原球体、原邮路、原绕轨飞船。只演示核验、收容与回站，不进行战果或维修结算。</p>
    </section>
    <section data-study-panel="receipt" aria-label="收据展柜四级结构样板" hidden>
      <div class="d1-section-heading"><div><span class="d1-eyebrow">CABINET STUDY / 同台面同奇物</span><h2>未购买的退货收据</h2></div><span class="d1-tag">四档结构对照</span></div>
      <div class="d1-receipt-frame"><canvas id="receipt-focus" width="660" height="930" role="img" aria-label="原收藏室中收据展柜的分层结构近景"></canvas><span class="d1-receipt-stamp">COLLECTION<br>LR–01 / RECEIPT</span></div>
      <div class="d1-tier-buttons" role="group" aria-label="选择展柜样板等级">${tierNames.map((label,i)=>`<button data-tier="${i}" aria-pressed="${i===0}"><small>Lv${i}</small>${label}</button>`).join('')}</div>
      <div id="receipt-status" class="d1-receipt-status" role="status"><strong>Lv0 · 基础玻璃罩</strong><p>${tierNotes[0]}</p></div>
      <div class="d1-receipt-controls"><button id="receipt-install">▶ 安装演示</button><button id="receipt-view" aria-pressed="false">房间视角</button><button id="receipt-specimen-view" aria-pressed="false">观察收据</button></div>
      <details id="receipt-research" class="d1-research">
        <summary>本体研究 · 折读未发生清单</summary>
        <p class="d1-research-note">研究等级独立于展柜。使用退件平原样例回执，观察收据能读出什么。</p>
        <div class="d1-research-levels" role="group" aria-label="收据本体研究等级">${RECEIPT_RESEARCH_LEVELS.map(item=>`<button data-research-tier="${item.level}" aria-pressed="${item.level===0}"><small>研究${item.level}</small>${item.name}</button>`).join('')}</div>
        <p id="receipt-research-state"></p>
        <label for="receipt-sample">交给收据核对的记录</label>
        <select id="receipt-sample">${Object.entries(RECEIPT_SAMPLE_BATCHES).map(([key,batch])=>`<option value="${key}">${batch.label}</option>`).join('')}</select>
        <button id="receipt-experiment">试一试</button>
        <output id="receipt-reading-result" role="status" aria-live="polite"></output>
      </details>
      <p class="d1-note">原台面坐标、收据中心与尺寸四档一致。基础陈列免费；此页不购买升级。</p>
    </section>
    <footer class="d1-footer" aria-label="切换动态样板"><button data-study="night" aria-pressed="true"><span>01</span> 球面夜巡</button><button data-study="receipt" aria-pressed="false"><span>02</span> 收据展柜</button></footer>
    <p class="d1-build">D1 / ${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty?' · 本地修改':''} · 开发审核</p>
    <div id="d1-museum-source" hidden></div>
  </main>`;
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  // Only in-memory scene inputs. Advancing or viewing the study never touches money.
  const dummy=newGame(0);dummy.collection=[...exhibitIds,...residentIds];
  let cycleEnvironment=false;
  const scene=new ExpeditionScene(q('#d1-scene'),()=>dummy,createNightStudy(time=>reviewEnvironment(time,cycleEnvironment)));
  Object.assign(window,{__D1_REVIEW__:{metrics:()=>scene.metrics(),resetMetrics:()=>scene.resetMetrics()}});
  scene.canvas.setAttribute('aria-label','D1完整退货箱星，三居民昼夜作息，咔哒沿邮路核验、收容并送回仓库，飞船前后绕轨');
  let museum:MuseumScene|undefined;
  const receiptCanvas=q<HTMLCanvasElement>('#receipt-focus');
  let study=initial,started=false,museumReady=false,level=0,view:'focus'|'room'|'specimen'='focus',installing=false,installStart=0,receiptTime=0,last=0;
  let lastPhase='',lastTier=-1;
  let researchLevel:ReceiptResearchLevel=0,sampleKey:'A'|'B'='A';
  let reading:ReceiptReading|undefined,experimentStart=0,lastExperimentKey='';
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
    for(const button of root.querySelectorAll<HTMLButtonElement>('button[data-tier]'))button.setAttribute('aria-pressed',String(Number(button.dataset.tier)===level));
    q('#receipt-status strong').textContent=`Lv${level} · ${tierNames[level]}`;q('#receipt-status p').textContent=tierNotes[level];lastTier=level;
  }
  q('#d1-replay').addEventListener('click',()=>{scene.restart();started=true;lastPhase='';});
  q('#d1-environment').addEventListener('click',()=>{
    cycleEnvironment=!cycleEnvironment;
    q('#d1-environment').setAttribute('aria-pressed',String(cycleEnvironment));
    q('#d1-environment').textContent=cycleEnvironment?'返回夜巡':'昼夜对照';
    q('#d1-duration').textContent=cycleEnvironment?'54 秒昼夜对照':'30 秒连续动作';
    scene.restart();started=true;lastPhase='';
  });
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-study]'))button.addEventListener('click',()=>selectStudy(button.dataset.study as Study));
  for(const button of root.querySelectorAll<HTMLButtonElement>('button[data-tier]'))button.addEventListener('click',()=>{installing=false;level=Number(button.dataset.tier);q('#receipt-install').textContent='▶ 安装演示';q('#receipt-install').dataset.playing='false';tierUI();});
  q('#receipt-install').addEventListener('click',()=>{installing=true;installStart=performance.now();level=0;q('#receipt-install').dataset.playing='true';q('#receipt-install').textContent='↻ 重播安装';tierUI();});
  function setReceiptView(next: 'focus' | 'room' | 'specimen') {
    view = next;
    q('#receipt-view').setAttribute('aria-pressed', String(view === 'room'));
    q('#receipt-view').textContent = view === 'room' ? '返回展柜' : '房间视角';
    q('#receipt-specimen-view').setAttribute('aria-pressed', String(view === 'specimen'));
    q('#receipt-specimen-view').textContent = view === 'specimen' ? '返回展柜' : '观察收据';
  }
  q('#receipt-view').addEventListener('click', () => setReceiptView(view === 'room' ? 'focus' : 'room'));
  q('#receipt-specimen-view').addEventListener('click', () => setReceiptView(view === 'specimen' ? 'focus' : 'specimen'));
  function resetResearch(){
    reading=undefined;lastExperimentKey='';
    const definition=RECEIPT_RESEARCH_LEVELS[researchLevel];
    q('#receipt-research summary').textContent=`本体研究${researchLevel} · 折读未发生清单`;
    q('#receipt-research-state').textContent=`研究${researchLevel} · ${definition.name}。${definition.description}`;
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-research-tier]'))button.setAttribute('aria-pressed',String(Number(button.dataset.researchTier)===researchLevel));
    q('#receipt-reading-result').textContent='点击试一试，收据会主动展开并留下本次读数。';
    q('#receipt-reading-result').dataset.phase='idle';
    q('#receipt-reading-result').dataset.pending='';
    q('#receipt-experiment').textContent='试一试';
  }
  function updateReading(experiment:ReceiptExperimentFrame){
    const key=`${experiment.reading.researchLevel}-${experiment.reading.batchId}-${experiment.phase}-${experiment.visibleLines.length}`;
    if(key===lastExperimentKey)return;
    lastExperimentKey=key;
    const output=q('#receipt-reading-result'),result=experiment.reading;
    const headings={opening:'收据正在主动展开卷边…',reading:'折层中的事项正在显影…',checking:'逐项核对回执，折回已完成事项…',printing:'正在打印本次读数…',closing:'读数已留下，收据慢慢合拢。',done:'本次折读完成。'};
    const lines=experiment.check>=.6?result.resultLines:experiment.visibleLines;
    const text=lines.map(line=>[line.title,line.address,line.nextStepLabel].filter(Boolean).join(' · '));
    const summary=result.pendingCount===null?`读出 ${result.lines.length} 项`:`未发生 ${result.pendingCount} 项 · 已核对 ${result.lines.length} 项`;
    output.textContent=[headings[experiment.phase],experiment.check>=.6?summary:'',...text,experiment.phase==='done'?result.ticketLines.join(' · '):''].filter(Boolean).join('\n');
    output.dataset.phase=experiment.phase;
    output.dataset.pending=result.pendingCount===null?'':String(result.pendingCount);
    q('#receipt-experiment').textContent='重播试验';
  }
  function focusResearch(){
    q('#d1-app').dataset.receiptResearch='true';
    setReceiptView('specimen');
    q('.d1-receipt-frame').scrollIntoView({block:'start',behavior:'auto'});
  }
  q('#receipt-research').addEventListener('toggle',()=>{
    const open=(q('#receipt-research') as HTMLDetailsElement).open;
    q('#d1-app').dataset.receiptResearch=String(open);
    if(open)focusResearch();else setReceiptView('focus');
  });
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-research-tier]'))button.addEventListener('click',()=>{
    researchLevel=Number(button.dataset.researchTier) as ReceiptResearchLevel;
    resetResearch();setReceiptView('specimen');
  });
  q<HTMLSelectElement>('#receipt-sample').addEventListener('change',event=>{
    sampleKey=(event.target as HTMLSelectElement).value as 'A'|'B';resetResearch();
  });
  q('#receipt-experiment').addEventListener('click',()=>{
    reading=resolveReceiptReading(researchLevel,RECEIPT_SAMPLE_BATCHES[sampleKey]);
    experimentStart=performance.now();lastExperimentKey='';focusResearch();
    updateReading(receiptExperimentFrame(reading,0));
  });
  resetResearch();
  selectStudy(initial);
  function frame(now:number){
    if(scene.ready&&!started){scene.restart();started=true;}
    if(now-last>=(reducedMotion.matches?100:45)){
      last=now;
      const seconds=started?scene.elapsedSeconds():0,timeline=reviewEnvironment(seconds,cycleEnvironment);
      const s=nightStage(timeline.nightSeconds??0),period=timeline.environment.period;
      const ecologyCaptions={
        day:{title:seconds>44?'天亮了，平原重新忙碌起来。':'白天，居民各自忙着收件。',detail:'拆封鼠收集纸屑 · 箱寄居蟹搬壳 · 标签鸟巡飞'},
        dusk:{title:'灯亮之前，居民沿熟悉的路归巢。',detail:'脚步逐渐放缓 · 纸屑收好 · 标签翼落回天线'},
        dawn:{title:'晨光回到纸层，居民慢慢苏醒。',detail:'拆封鼠醒来 · 箱壳重新探头 · 标签鸟离开栖点'},
      };
      const caption=period==='night'?nightCaption[s.phase]:ecologyCaptions[period];
      q('#d1-status').dataset.phase=s.phase;
      const captionKey=`${period}-${s.phase}`;
      const ecologyLabels={day:'白天 · 居民出勤',dusk:'黄昏 · 正在归巢',night:'夜晚 · 居民休息',dawn:'清晨 · 慢慢苏醒'};
      q('#d1-ecology-label').textContent=ecologyLabels[period];
      if(lastPhase!==captionKey){q('#d1-status .d1-eyebrow').textContent=`KADA–07 / ${period==='night'?'现场作业':'居民作息'}`;q('#d1-status strong').textContent=caption.title;q('#d1-status p').textContent=caption.detail;lastPhase=captionKey;}
      q('#d1-time').textContent=`${String(Math.floor(Math.min(timeline.duration,seconds))).padStart(2,'0')} / ${timeline.duration} 秒`;
      q('.d1-timeline span').style.width=`${Math.min(1,seconds/timeline.duration)*100}%`;
      receiptTime=(now-startedAt)/1000;
      let install=1;
      if(installing){const stage=receiptStage((now-installStart)/1000);level=stage.level;install=stage.install;if(stage.done){installing=false;q('#receipt-install').dataset.playing='false';q('#receipt-install').textContent='↻ 重播安装';}}
      if(lastTier!==level)tierUI();
      const experiment=reading?receiptExperimentFrame(reading,(now-experimentStart)/1000):undefined;
      if(experiment)updateReading(experiment);
      if(museumReady&&study==='receipt')museum?.renderFocused(receiptCanvas,'receipt',level,receiptTime,install,view,experiment);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
