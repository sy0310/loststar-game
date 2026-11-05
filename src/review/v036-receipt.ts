import {createV036ReceiptTable, v036ReceiptFrame, type V036ReceiptTable, type V036ReceiptPhase} from '../render/receipt-table';
export {V036ReceiptTable, createV036ReceiptTable, v036ReceiptFrame, v036ReceiptGlassPlacement, v036BrushPose, v036BrushToolTransform, v037ReceiptFrame, type V036ReceiptPhase} from '../render/receipt-table';

const DURATION = 28;

const labels: Record<V036ReceiptPhase, string> = {
  soil: '先松土，别扯坏纸角',
  release: '纸角松了，托住卷根',
  support: '轻轻展开，碎土落回托盘',
  dirty: '未购买的退货收据 · 原状',
  cleaning: '刷过哪里，哪里露出原字',
  clean: '泥已去，旧缺口还在',
  repairing: '补纸压合，保留原来的缺口',
  display: '灯亮了，给旧物留个位置',
  trying: '您尚未购买任何商品',
  complete: '订单还没下，退货先到了',
};

export function mountV036Receipt(root: HTMLElement) {
  root.innerHTML = '<canvas width="640" height="700" aria-label="同一收据的松土、托起、刷洗、压补与玻璃陈列动画"></canvas><p class="v036-sample-status" role="status">整理台正在点灯</p><button type="button" class="v036-try" disabled>试一试 · 免费</button>';
  const canvas = root.querySelector('canvas')!;
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const tryButton = root.querySelector<HTMLButtonElement>('button')!;
  const context = canvas.getContext('2d')!;
  let table: V036ReceiptTable | undefined;
  let destroyed = false;
  let ready = false;
  let paused = false;
  let elapsed = 0;
  let ambience = 0;
  let trialElapsed: number | undefined;
  let trialCount = 0;
  let frameId = 0;
  let previous = performance.now();
  let lastDraw = previous;
  let intervals: number[] = [];
  let drawCount = 0;
  let lastResult: ReturnType<V036ReceiptTable['draw']> | undefined;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let lastPhase = '';
  let lastBrushCoverage = -1;
  const cleanSamples: {seconds: number; coverage: number; pressed: boolean}[] = [];
  const pausedNow = () => paused || document.visibilityState === 'hidden';
  const syncTryButton = () => {
    tryButton.disabled = !ready || pausedNow() || elapsed < DURATION || trialElapsed !== undefined;
  };
  const tick = (now: number) => {
    if (destroyed) return;
    frameId = requestAnimationFrame(tick);
    const delta = Math.max(0, Math.min(.1, (now - previous) / 1000));
    previous = now;
    if (!ready || !table || pausedNow()) return;
    const target = reduced.matches ? 1000 / 30 : 1000 / 60;
    if (now - lastDraw + 1 < target) return;
    const interval = now - lastDraw;
    const advanced = delta + Math.max(0, interval / 1000 - delta);
    elapsed = Math.min(DURATION, elapsed + advanced);
    ambience += advanced;
    if (trialElapsed !== undefined) {
      trialElapsed = Math.min(4.5, trialElapsed + interval / 1000);
      if (trialElapsed >= 4.5) trialElapsed = undefined;
    }
    if (drawCount > 0 && intervals.length < 1800) intervals.push(interval);
    lastDraw = now;
    const frame = v036ReceiptFrame(elapsed, trialElapsed);
    lastResult = table.draw(context, frame, reduced.matches, ambience);
    drawCount++;
    canvas.dataset.phase = frame.phase;
    canvas.dataset.cleanCoverage = lastResult.cleanCoverage.toFixed(4);
    if (frame.phase !== lastPhase) {status.textContent = labels[frame.phase];lastPhase = frame.phase;}
    syncTryButton();
    if (lastResult.cleanCoverage - lastBrushCoverage > .10) {
      cleanSamples.push({seconds: elapsed, coverage: lastResult.cleanCoverage, pressed: lastResult.contact?.pressed ?? false});
      lastBrushCoverage = lastResult.cleanCoverage;
    }
  };
  const visibility = () => {previous = performance.now();lastDraw = previous;syncTryButton();};
  const tryIt = () => {
    if (!ready || pausedNow() || elapsed < DURATION || trialElapsed !== undefined) return;
    trialElapsed = 0;trialCount++;status.textContent = labels.trying;lastPhase = '';syncTryButton();
  };
  tryButton.addEventListener('click', tryIt);
  document.addEventListener('visibilitychange', visibility);
  void createV036ReceiptTable().then(loaded => {
    if (destroyed) return;
    table = loaded;
    ready = true;canvas.dataset.ready = 'true';
    // A paused or hidden first load still receives its zero-time material frame.
    // Readiness never advances the storyboard clock.
    const firstFrame = v036ReceiptFrame(0);
    lastResult = table.draw(context, firstFrame, reduced.matches, 0);
    canvas.dataset.phase = firstFrame.phase;
    canvas.dataset.cleanCoverage = lastResult.cleanCoverage.toFixed(4);
    status.textContent = labels[firstFrame.phase];lastPhase = firstFrame.phase;
    drawCount++;syncTryButton();
    previous = performance.now();lastDraw = previous;
  }).catch(() => {if (!destroyed) status.textContent = '素材未接通，请刷新重试';});
  frameId = requestAnimationFrame(tick);
  return {
    destroy() {
      destroyed = true;cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', visibility);
      tryButton.removeEventListener('click', tryIt);root.replaceChildren();
    },
    replay() {
      elapsed = 0;ambience = 0;trialElapsed = undefined;trialCount = 0;intervals = [];drawCount = 0;
      lastPhase = '';cleanSamples.length = 0;lastBrushCoverage = -1;
      previous = performance.now();lastDraw = previous;syncTryButton();
    },
    pause(value: boolean) {paused = value;previous = performance.now();lastDraw = previous;syncTryButton();},
    metrics() {
      return {
        ready, paused: pausedNow(), elapsed, ambience, duration: DURATION, phase: v036ReceiptFrame(elapsed, trialElapsed).phase,
        cleanCoverage: lastResult?.cleanCoverage ?? 0, contact: lastResult?.contact ?? null,
        cleanSamples: cleanSamples.map(sample => ({...sample})),
        paperFoot: lastResult?.paperFoot, trayReceiver: lastResult?.trayReceiver,
        glassReceiver: lastResult?.glassReceiver, glassFrontReceiver: lastResult?.glassFrontReceiver,
        glassRect: lastResult?.glassRect, glassSourceReceiver: lastResult?.glassSourceReceiver,
        glassTextureSize: lastResult?.glassTextureSize, trialCount,
        missingSignature: true, originalCode: 'RET-031', evidenceCount: 0,
        walletTransactions: 0, archiveWrites: 0, reducedMotion: reduced.matches,
        drawCount, intervals: [...intervals],
      };
    },
  };
}
