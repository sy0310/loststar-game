import './v034.css';
import {icon} from '../icons';
import {newGame} from '../game/engine';
import {MuseumScene} from '../render/museum';
import {ExpeditionScene, type SceneExtension} from '../render/scene';
import {createDailyResidentRenderer} from '../render/v034-residents';
import {residentDailyPose} from './resident-daily';
import {createV034NightScene} from './v034-night-scene';
import {createV034NightModel} from './v034-night-model';
import {v034NightCamera} from './v034-night-stage';
import {v034ShipPose} from './v034-camera';
import {studyCandidates} from './v034-budget';
import type {V034NightMode, V034NightPreset, V034NightSnapshot} from './v034-night-model';
import {
  advanceReceiptRestoration, beginReceiptRestoration, createReceiptRestorationState,
  observeReceiptEvidence, receiptRestorationFrame, receiptRestorationMainAction,
  type ReceiptRestorationKind,
} from './receipt-restoration';

type View = 'night' | 'receipt' | 'life';
type Drawer = 'security' | 'research' | 'repair';

const phaseLabels = {
  buried: '原状土样，尚未剥离', excavating: '正在剥离原状土样', found: '泥污与缺口仍在',
  cleaning: '刷去独立泥层', clean: '已清洁，缺口仍在', repairing: '透明补纸加固中',
  stabilized: '结构已稳定，补痕保留', identifying: '正在核验现有观察', trying: '旧纸轻轻舒卷',
};

function sceneCaption(snapshot: V034NightSnapshot) {
  const nightSummary = snapshot.morning ? `本夜核验${snapshot.morning.intercepted}位，抵站${snapshot.morning.arrived}位。` : '';
  if (snapshot.repair.active) return ['修复工位正在焊补收件站。', `${nightSummary}本次实际修复${snapshot.repair.points}点，已支出${snapshot.repair.spent}零件。`];
  const captions = {
    day: ['白天，平原各自忙着收件。', '居民觅纸、搬壳和巡飞，咔哒继续自动探索。'],
    dusk: ['仓库灯逐个亮起，居民慢慢归巢。', '同一颗星球进入夜班，安保开始值守。'],
    patrol: ['夜班巡守中，前两次异常正在处理。', '访客位置和核验结果沿用原确定性模型。'],
    appear: ['管道边箱堆，一道纸影滑出了纸层。', '第三次夜间处置，警戒灯与失物号搜索现场。'],
    track: ['咔哒离站，沿球面追踪异常。', '前轨搜索光跟随，进入球后时正确遮挡。'],
    identify: ['正在核对纸影和 P03 现场标记。', '字码扫描形成来源观察，签收事实仍待证明。'],
    contain: ['灯束引导，隔离门争取核验时间。', '设备响应由实际引导区与停顿状态驱动。'],
    result: snapshot.actor.outcome === 'arrived'
      ? ['纸影抵达收件站，护板受损。', '本次真实损伤6点，清晨按实际修复点结算。']
      : snapshot.actor.outcome === 'intercepted'
        ? ['核验完成，咔哒封好收容匣。', '本次抵站前完成核验，护板保持完好。']
        : ['核验还在继续，收容匣正在准备。', '结果取决于同一条访客时间轴与设备配置。'],
    return: snapshot.actor.outcome === 'intercepted'
      ? ['咔哒携匣返回原收件站。', '承重步伐、收容匣和原门洞共用空间。']
      : ['咔哒带空匣返回，准备清晨检修。', '护板损伤已记录，永久藏品仍在收藏室。'],
    dawn: snapshot.repairSpent > 0
      ? ['清晨修复完成，收件站继续运行。', `${nightSummary}本次修复已支出${snapshot.repairSpent}零件。`]
      : [snapshot.actor.outcome === 'intercepted' ? '核验完成，收件站保持完好。' : '清晨，夜间记录已经归档。', nightSummary + (snapshot.repairDue > 0 ? '自动维修关闭，可安排修复。' : '损伤0点，维修支出为0。')],
    done: ['夜班记录已归档。', nightSummary + (snapshot.repairDue > 0 ? '仍有可修设施，探索继续。' : '咔哒准备恢复探索，等待下一条真实线索。')],
  };
  return captions[snapshot.phase];
}

export function mountV034() {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.innerHTML = `
    <div id="week1-app">
      <header class="week-header">
        <div><div class="week-kicker">LOSTSTAR / WEEK 01 · 设计候选</div><h1>失物星球</h1></div>
        <div class="week-wallet"><span id="week1-parts">360</span><small id="week1-budget-label">整理样板预算 · 零件</small></div>
      </header>
      <main class="week-main">
        <section id="week1-world-panel">
          <div class="week-location"><strong id="week1-place">退货箱星 · 夜班</strong><span id="week1-clock">00 / 30 秒</span></div>
          <div class="week-scene">
            <div class="week-orbit-frame"><small id="week1-scene-label">退件平原 / 第3次处置片段</small><div id="week1-world"></div><div class="week-integrity" id="week1-integrity" data-value="100">完整度 100</div></div>
            <div class="week-inspection"><canvas id="week1-inspection" width="780" height="208" role="img" aria-label="与上方球体同步的现场观察近景"></canvas><small>LR–01 / 现场镜 <span>实景同步</span></small></div>
          </div>
          <div class="week-caption"><strong id="week1-world-result"></strong><p id="week1-world-detail"></p></div>
          <div class="week-tools">
            <button data-drawer="security">${icon('radar', 'week-icon')}安保</button>
            <button data-drawer="research">${icon('book', 'week-icon')}科研</button>
            <button data-drawer="repair">${icon('gear', 'week-icon')}维修</button>
          </div>
          <div class="week-playback"><span id="week1-field-record" data-recorded="false">P03 · 等待现场观察</span><button id="week1-cycle">完整昼夜5分钟</button><button id="week1-replay">重播</button></div>
          <p class="week-note" id="week1-scene-note">30秒第三次处置＋6秒晨间。只读内存预览，账目由原夜班模型计算。</p>
          <span id="week1-repair-spent" data-value="0" hidden></span>
        </section>
        <section id="week1-receipt-panel" hidden>
          <div class="week-location"><strong>未购买的退货收据</strong><span id="week1-paper-code">原状土样 / 整理罩</span></div>
          <div class="week-paper-frame"><canvas id="week1-paper" width="400" height="584" role="img" aria-label="原状土样中的同一张破损收据，清洁与修补分层预览"></canvas><div class="week-paper-stamp">PARCEL / 01<br>原状土样 · 独立泥层</div></div>
          <div class="week-paper-meta"><span id="week1-condition">等待素材解码</span><span id="week1-missing" data-count="2">尚缺2项证据</span></div>
          <div class="week-progress" aria-hidden="true"><i id="week1-action-progress"></i></div>
          <div class="week-paper-actions"><button id="week1-primary" disabled>载入原件</button><button id="week1-try" disabled>试一试</button></div>
          <div class="week-evidence" id="week1-evidence-list" aria-live="polite"></div>
          <p class="week-note" id="week1-paper-note">带回的原状土样在封闭整理罩内剥离。基础陈列与试验免费，修补保留缺字。</p>
        </section>
        <p class="week-note" id="week1-error" role="status" hidden>素材暂未接通，请重新载入样板。<button id="week1-resource-retry">重新载入</button></p>
        <p class="week-build">V${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty ? ' · 本地修改' : ''} · 隔离只读审核</p>
      </main>
      <nav class="week-footer" aria-label="切换首周样板">
        <button data-week-tab="night" aria-pressed="true">${icon('planet', 'week-icon')}球面夜班</button>
        <button data-week-tab="receipt" aria-pressed="false">${icon('receipt', 'week-icon')}奇物整理</button>
        <button data-week-tab="life" aria-pressed="false">${icon('mouse', 'week-icon')}居民日常</button>
      </nav>
      <div id="week1-museum-source" hidden></div>
    </div>
    <dialog id="week1-drawer" aria-labelledby="week1-drawer-title">
      <header class="week-drawer-heading"><div><div class="week-kicker">LR–01 / 站务台</div><h2 id="week1-drawer-title"></h2></div><button id="week1-close" aria-label="关闭抽屉">${icon('close', 'week-icon')}</button></header>
      <div class="week-drawer-body" id="week1-drawer-body"></div>
    </dialog>`;
  document.documentElement.dataset.build = `${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty ? ' · 本地修改' : ''}`;
  const query = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
  const requested = new URLSearchParams(location.search).get('view');
  let view: View = requested === 'receipt' || requested === 'life' ? requested : 'night';
  let preset: V034NightPreset = 'basic';
  let mode: V034NightMode = 'event';
  let autoRepair = true;
  let paper = createReceiptRestorationState(360);
  let actionNumber = 0;
  let lifeStarted = 0;
  let museum: MuseumScene | undefined;
  let museumReady = false;
  let museumLoading: Promise<void> | undefined;
  let drawerKind: Drawer = 'security';
  let lastPaint = 0;
  let started = false;
  let inspectionTarget = {x: 416, y: 350};
  let inspectionCenter = inspectionTarget;
  const controller = createV034NightModel();
  const nightLayer = createV034NightScene(controller, {camera: v034NightCamera});
  const daily = createDailyResidentRenderer();
  const extension: SceneExtension = {
    ...nightLayer,
    shipPose: v034ShipPose,
    ready: Promise.all([nightLayer.ready, daily.ready]).then(() => {}),
    drawResident: daily.draw,
    residentPose: residentDailyPose,
    environment: seconds => view === 'life'
      ? {period: 'day', rest: 0, light: 0, seconds: seconds - lifeStarted}
      : controller.snapshot(seconds).environment,
    cycleFraction: (base, seconds) => view === 'life'
      ? ((seconds - lifeStarted) % 12) / 12
      : nightLayer.cycleFraction?.(base, seconds) ?? base,
    robotPose: (base, seconds) => view === 'life' ? undefined : nightLayer.robotPose?.(base, seconds),
    drawRobot: (context, frame, atlas) => view === 'life' ? false : nightLayer.drawRobot?.(context, frame, atlas),
    worldEntities: (context, frame) => view === 'life' ? [] : nightLayer.worldEntities?.(context, frame) ?? [],
    afterWorld: (context, frame) => {
      if (view !== 'life') nightLayer.afterWorld(context, frame);
      let focus = {x: frame.robot.x, y: frame.robot.y - 48};
      if (view === 'life') {
        const resident = (['mouse', 'hermit', 'tagbird'] as const)[Math.floor(Math.max(0, frame.t - lifeStarted) / 5) % 3];
        const pose = residentDailyPose(resident, frame.environment);
        focus = {x: pose.x, y: pose.y - 24};
      }
      inspectionTarget = {
        x: 32 + v034NightCamera.x + (focus.x - v034NightCamera.x) * v034NightCamera.scale + v034NightCamera.offsetX,
        y: v034NightCamera.y + (focus.y - v034NightCamera.y) * v034NightCamera.scale + v034NightCamera.offsetY,
      };
    },
  };
  const world = new ExpeditionScene(query('#week1-world'), () => {
    const state = controller.getState(world.elapsedSeconds());
    return {...state, collection: [...new Set([...state.collection, 'mouse', 'hermit', 'tagbird'])]};
  }, extension);
  const canvas = query<HTMLCanvasElement>('#week1-paper');
  const dialog = query<HTMLDialogElement>('#week1-drawer');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  void extension.ready!.catch(() => {query('#week1-error').hidden = false;});

  async function prepareMuseum() {
    if (museumLoading) return museumLoading;
    museumLoading = (async () => {
      const specimen = newGame(0);
      specimen.collection = ['receipt'];
      museum = new MuseumScene(query('#week1-museum-source'), () => specimen, () => 0,
        () => performance.now() / 1000, {receiptStudy: true});
      await museum.ready;
      await museum.prepareReceiptRestoration();
      museumReady = true;
      updatePaper(performance.now());
    })().catch(() => {
      query('#week1-error').hidden = false;
      museumLoading = undefined;
    });
    return museumLoading;
  }

  function selectView(next: View) {
    if (next === 'life' && view !== 'life') lifeStarted = world.elapsedSeconds();
    view = next;
    query('#week1-world-panel').hidden = next === 'receipt';
    query('#week1-receipt-panel').hidden = next !== 'receipt';
    for (const button of app.querySelectorAll<HTMLButtonElement>('[data-week-tab]')) {
      button.setAttribute('aria-pressed', String(button.dataset.weekTab === next));
    }
    world.setActive(next !== 'receipt');
    if (next === 'receipt') void prepareMuseum();
  }

  function replay() {
    controller.replay(preset, {mode, autoRepair});
    world.restart();
    lifeStarted = 0;
    started = world.ready;
  }

  function updatePaper(now: number) {
    paper = advanceReceiptRestoration(paper, now / 1000);
    const frame = receiptRestorationFrame(paper, now / 1000);
    const main = receiptRestorationMainAction(paper);
    if (museumReady && view === 'receipt') {
      museum!.renderFocused(canvas, 'receipt', 0, now / 1000, 1, 'specimen', undefined, frame);
      canvas.dataset.restorationReady = String(canvas.dataset.restorationPhase !== 'idle');
      canvas.dataset.originalCode = canvas.dataset.restorationOriginalCode;
    }
    const primary = query<HTMLButtonElement>('#week1-primary');
    primary.dataset.kind = main.kind;
    primary.textContent = paper.activeAction ? '正在处理…' : main.label;
    primary.disabled = !museumReady || main.disabled;
    const trial = query<HTMLButtonElement>('#week1-try');
    trial.disabled = !museumReady || paper.stage === 'buried' || !!paper.activeAction;
    query('#week1-condition').textContent = phaseLabels[frame.phase];
    const readable = frame.condition !== 'found';
    query('#week1-paper-code').textContent = readable ? 'RET-031 / 整理罩' : '原状土样 / 整理罩';
    query('#week1-missing').textContent = readable ? `尚缺${frame.reading.missingCount}项证据` : '其余字迹尚无法辨认';
    query('#week1-missing').dataset.count = String(frame.reading.missingCount);
    query('#week1-action-progress').style.width = `${paper.activeAction ? frame.progress * 100 : 0}%`;
    const origin = frame.reading.items[0];
    const evidenceText = readable
      ? `<p><strong>原件 RET-031 · 箱标 P03</strong></p><p>${origin.status === 'confirmed' ? '来源已核对，现场标记与原码相符。' : '箱堆来源待核对。'}</p><p>签收记录仍缺失，费用与修补均不会补出签名。</p>`
      : '<p><strong>残留字码 RET…</strong></p><p>泥膜遮住余字，破口保留原状。</p><p>免费暂存或试一试，可稍后再整理。</p>';
    if (query('#week1-evidence-list').innerHTML !== evidenceText) query('#week1-evidence-list').innerHTML = evidenceText;
    query('#week1-paper-note').textContent = main.reason ?? (paper.stage === 'buried'
      ? '原状土样带回后在封闭整理罩内剥离，免费发掘与暂存。'
      : '清洁与修补各一次。新观察只在辨识时核验，原件签收空白始终保留。');
  }

  function startPaperAction(kind: ReceiptRestorationKind) {
    const result = beginReceiptRestoration(paper, kind, `week1/${++actionNumber}/${kind}`, performance.now() / 1000);
    paper = result.state;
    updatePaper(performance.now());
  }

  function openDrawer(kind: Drawer) {
    drawerKind = kind;
    const snapshot = controller.snapshot(world.elapsedSeconds());
    query('#week1-drawer-title').textContent = {security: '夜班安保', research: '现场科研', repair: '收件站维修'}[kind];
    const body = query('#week1-drawer-body');
    if (kind === 'security') body.innerHTML = `
      <div class="week-device">${icon('radar', 'week-icon')}<div><strong>警戒探照灯 · Lv${preset === 'basic' ? 0 : 3}</strong><p>光束引导让纸影在核验走廊中停留，延长可读时间。</p></div></div>
      <div class="week-device">${icon('base', 'week-icon')}<div><strong>自动隔离门 · Lv${preset === 'basic' ? 0 : 3}</strong><p>每6秒形成阻挡窗口，基础1.1秒，完善1.7秒。</p></div></div>
      <div class="week-configs"><button data-week-config="basic" aria-pressed="${preset === 'basic'}">基础设备<br>Lv0 / Lv0</button><button data-week-config="complete" aria-pressed="${preset === 'complete'}">完善设备<br>Lv3 / Lv3</button></div>
      <p>切换后从同一夜班片段重新运行，可观察本次6点损伤与0损伤的差异。</p><p>此处为只读配置对照，正式设备等级与费用保留原存档。</p>`;
    if (kind === 'research') body.innerHTML = `
      <section class="week-field-ticket" aria-label="可试玩的现场核对">
        <span class="week-ticket-status">可实测 · 免费</span>
        <h3>P03 来源核对</h3>
        <p>咔哒扫描现场箱标，与原件 RET-031 对照。实际观察收录后，回整理台辨识来源。</p>
        <p>${paper.evidenceIds.includes('field-pipe-scan') ? '现场观察已收录，签收记录仍待证。' : '等待现场扫描，签收记录仍待证。'}</p>
        <button class="week-drawer-action" id="week1-visit-field">前往 P03 现场核对</button>
      </section>
      <h3>科研预算方案</h3>
      <p>以下任务票用于审核费用与增效。内容目标、取消退款及正式接入仍待审核。</p>
      ${studyCandidates.map(project => `<article class="week-project" data-study-candidate="${project.id}">
        <header><strong>${project.title}</strong><span>${project.price}零件</span></header>
        <small>${project.minutes}分钟 · 预算预览</small>
        <details><summary>查看任务票</summary>
          <dl class="week-ticket-details">
            <dt>目标与预计效果</dt><dd>${project.result}</dd>
            <dt>首星记录已齐</dt><dd>复核已有记录与统计真实采样，未知奇物仍须实际取得。</dd>
            <dt>用时与离线</dt><dd>${project.minutes}分钟，原引擎按有效货舱时间完成已资助的一单。</dd>
            <dt>开工与取消</dt><dd>当前为候选任务票，取消退款规则随任务内容一并审核。</dd>
          </dl>
          <button class="week-drawer-action" disabled>待任务内容审核</button>
        </details>
      </article>`).join('')}`;
    if (kind === 'repair') body.innerHTML = `
      <div class="week-repair-total"><div><b id="week1-drawer-integrity">${snapshot.integrity}/100</b><small>收件站完整度</small></div><div><b id="week1-drawer-due">${snapshot.repairDue}</b><small>当前待修零件</small></div></div>
      <label class="week-switch">清晨自动维修<input type="checkbox" id="week1-auto-repair" ${autoRepair ? 'checked' : ''}></label>
      <p>仅真实损伤收费，每点3零件。预算不足可部分修复，未修复时仍保持至少80%探索效率。</p>
      <p id="week1-drawer-repair-log">本次已付${snapshot.repairSpent}零件。</p>
      <button id="week1-manual-repair" class="week-drawer-action">维修现有损伤</button>`;
    if (!dialog.open) dialog.showModal();
    updateRepairDrawer(snapshot);
  }

  function updateRepairDrawer(snapshot: V034NightSnapshot) {
    if (!dialog.open || drawerKind !== 'repair') return;
    query('#week1-drawer-integrity').textContent = `${snapshot.integrity}/100`;
    query('#week1-drawer-due').textContent = String(snapshot.repairDue);
    query('#week1-drawer-repair-log').textContent = `本次已付${snapshot.repairSpent}零件，剩余${snapshot.resources}零件。`;
    const manual = query<HTMLButtonElement>('#week1-manual-repair');
    const daylight = snapshot.environment.period === 'day' || snapshot.environment.period === 'dawn';
    manual.disabled = !daylight || snapshot.repairDue === 0 || snapshot.resources < 3;
    manual.textContent = daylight ? '维修现有损伤' : '等待清晨维修';
  }

  function visitField() {
    if (dialog.open) dialog.close();
    preset = 'complete';
    mode = 'event';
    selectView('night');
    replay();
  }

  function paintInspection() {
    if (!world.ready || view === 'receipt') return;
    const canvas = query<HTMLCanvasElement>('#week1-inspection');
    const context = canvas.getContext('2d')!;
    inspectionCenter = {
      x: inspectionCenter.x + (inspectionTarget.x - inspectionCenter.x) * .18,
      y: inspectionCenter.y + (inspectionTarget.y - inspectionCenter.y) * .18,
    };
    const width = 430;
    const height = width * canvas.height / canvas.width;
    const left = Math.round(Math.max(0, Math.min(world.canvas.width - width, inspectionCenter.x - width / 2)));
    const top = Math.round(Math.max(0, Math.min(world.canvas.height - height, inspectionCenter.y - height / 2)));
    context.imageSmoothingEnabled = false;
    context.drawImage(world.canvas, left, top, width, height, 0, 0, canvas.width, canvas.height);
    canvas.dataset.source = 'week1-world';
    canvas.dataset.left = String(left);
    canvas.dataset.top = String(top);
    canvas.dataset.width = String(width);
    canvas.dataset.height = String(height);
  }

  app.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.weekTab) selectView(button.dataset.weekTab as View);
    if (button.dataset.drawer) openDrawer(button.dataset.drawer as Drawer);
    if (button.id === 'week1-close') dialog.close();
    if (button.dataset.weekConfig) {
      preset = button.dataset.weekConfig as V034NightPreset;
      replay();
      openDrawer('security');
    }
    if (button.id === 'week1-replay') replay();
    if (button.id === 'week1-cycle') {mode = mode === 'event' ? 'cycle' : 'event'; replay();}
    if (button.id === 'week1-primary') {
      const action = receiptRestorationMainAction(paper);
      if (action.kind === 'visit-field') visitField();
      else startPaperAction(action.kind);
    }
    if (button.id === 'week1-try') startPaperAction('try');
    if (button.id === 'week1-visit-field') visitField();
    if (button.id === 'week1-manual-repair') controller.repair(world.elapsedSeconds(), controller.snapshot(world.elapsedSeconds()).integrity);
    if (button.id === 'week1-resource-retry') location.reload();
  });
  app.addEventListener('change', event => {
    if ((event.target as Element).id !== 'week1-auto-repair') return;
    autoRepair = (event.target as HTMLInputElement).checked;
    controller.setAutoRepair(autoRepair, world.elapsedSeconds());
  });
  dialog.addEventListener('click', event => {if (event.target === dialog) dialog.close();});

  selectView(view);
  function paint(now: number) {
    if (world.ready && !started) {replay(); lifeStarted = 0;}
    if (now - lastPaint >= (reducedMotion.matches ? 100 : 50)) {
      lastPaint = now;
      updatePaper(now);
      const snapshot = controller.snapshot(world.elapsedSeconds());
      if (view === 'night' && world.ready && document.visibilityState === 'visible') {
        for (const observation of snapshot.observations) paper = observeReceiptEvidence(paper, observation);
      }
      query('#week1-parts').textContent = String(view === 'receipt' ? paper.parts : snapshot.resources);
      query('#week1-budget-label').textContent = view === 'receipt' ? '整理样板预算 · 零件' : '夜班片段账本 · 零件';
      query('#week1-integrity').dataset.value = String(snapshot.integrity);
      query('#week1-integrity').textContent = `完整度 ${snapshot.integrity}`;
      query('#week1-repair-spent').dataset.value = String(snapshot.repairSpent);
      query('#week1-field-record').dataset.recorded = String(paper.evidenceIds.includes('field-pipe-scan'));
      query('#week1-field-record').textContent = paper.evidenceIds.includes('field-pipe-scan') ? 'P03 · 现场观察已收录' : 'P03 · 等待现场观察';
      const caption = view === 'life' ? ['白天，居民停下来做自己的事。', '嗅纸、啃食、抖壳、探头、落杆梳理与真正扑翼。'] : sceneCaption(snapshot);
      query('#week1-world-result').textContent = caption[0];
      query('#week1-world-detail').textContent = caption[1];
      query('#week1-place').textContent = view === 'life' ? '退货箱星 · 居民日常' : `退货箱星 · ${snapshot.environment.period === 'day' ? '白天' : snapshot.environment.period === 'dusk' ? '黄昏' : snapshot.environment.period === 'dawn' ? '清晨' : '夜间'}`;
      query('#week1-clock').textContent = view === 'life' ? '15秒生活循环' : `${Math.floor(snapshot.seconds).toString().padStart(2, '0')} / ${snapshot.duration} 秒`;
      query('#week1-scene-label').textContent = view === 'life' ? '退件平原 / 原足点生活观察' : mode === 'cycle' ? '退件平原 / 完整昼夜预览' : '退件平原 / 第3次处置片段';
      query('#week1-cycle').hidden = view === 'life';
      query('#week1-cycle').textContent = mode === 'cycle' ? '返回30秒事件' : '完整昼夜5分钟';
      query('#week1-scene-note').textContent = view === 'life' ? '少量真实部位动作帧与状态停顿，三居民共用场景时钟。'
        : mode === 'cycle' ? '240秒白天＋60秒夜晚＋8秒晨间，真实时间运行。隔离内存预览。'
          : '30秒第三次处置＋6秒晨间。只读内存预览，账目由原夜班模型计算。';
      updateRepairDrawer(snapshot);
      paintInspection();
    }
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
  Object.assign(window, {__WEEK1__: {metrics: () => world.metrics(), resetMetrics: () => world.resetMetrics()}});
}
