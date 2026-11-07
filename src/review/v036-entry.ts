import './v036.css';
import {mountV036Fog} from './v036-fog';
import {mountV036Receipt} from './v036-receipt';

type Study = 'fog' | 'receipt';
type MountedStudy = {
  destroy(): void;
  replay(): void;
  pause(paused: boolean): void;
  metrics(): unknown;
};

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <main class="v036-app">
    <header class="v036-header">
      <span class="v036-postmark" aria-hidden="true">LR<br>01</span>
      <div><span class="v036-eyebrow">失物星球 · 美术审阅</span><h1>退件平原</h1></div>
      <span class="v036-edition">036<small>动作样板</small></span>
    </header>
    <nav class="v036-tabs" aria-label="选择视觉样板">
      <button type="button" data-study="fog" aria-pressed="false">拨开星雾</button>
      <button type="button" data-study="receipt" aria-pressed="false">整理收据</button>
    </nav>
    <section class="v036-frame" aria-label="隔离视觉演示">
      <div class="v036-stage"></div>
    </section>
    <div class="v036-playback">
      <button type="button" data-control="pause">暂停观察</button>
      <button type="button" data-control="replay">重新播放</button>
    </div>
    <footer class="v036-footer"><span>隔离演示 · 不读取玩家存档</span><span>${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty ? ' · 审阅中' : ''}</span></footer>
  </main>`;

const root = app.querySelector<HTMLElement>('.v036-stage')!;
const pauseButton = app.querySelector<HTMLButtonElement>('[data-control="pause"]')!;
let view: Study = new URLSearchParams(location.search).get('view') === 'receipt' ? 'receipt' : 'fog';
let mounted: MountedStudy;
let paused = false;

function select(study: Study) {
  mounted?.destroy();
  root.replaceChildren();
  delete root.dataset.error;
  delete root.dataset.phase;
  view = study;
  paused = false;
  pauseButton.textContent = '暂停观察';
  pauseButton.setAttribute('aria-pressed', 'false');
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-study]')) {
    button.setAttribute('aria-pressed', String(button.dataset.study === view));
  }
  mounted = view === 'fog' ? mountV036Fog(root) : mountV036Receipt(root);
  app.dataset.study = view;
}

app.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.study) select(button.dataset.study as Study);
  if (button.dataset.control === 'pause') {
    paused = !paused;
    mounted.pause(paused);
    pauseButton.textContent = paused ? '继续播放' : '暂停观察';
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  if (button.dataset.control === 'replay') {
    paused = false;
    mounted.pause(false);
    mounted.replay();
    pauseButton.textContent = '暂停观察';
    pauseButton.setAttribute('aria-pressed', 'false');
  }
});

Object.assign(window, {__V036__: {metrics: () => ({view, paused, study: mounted.metrics()})}});
select(view);
window.addEventListener('pagehide', event => {
  if (!event.persisted) mounted.destroy();
});
