import {FUSION_DATABASE, FUSION_REVIEW_DATABASE, openFusionStore} from './store';
import {mountFusion} from './ui';
import {createFusionScene} from './scene';
import {ExpeditionScene} from '../render/scene';

async function start() {
  const sample = new URLSearchParams(location.search).get('sample');
  const review = !import.meta.env.DEV || sample === 'refinement';
  const controller = await openFusionStore({review});
  const handle = mountFusion(controller);
  const extension = createFusionScene(() => controller.state.game,
    (id, at, source) => void controller.act({type: 'observe', id, at, source}),
    () => controller.state.projects,
    () => controller.state);
  const scene = new ExpeditionScene(handle.worldRoot, () => controller.state.game, extension);
  handle.setScene(scene, event => extension.pulse(event), () => extension.focus(), () => extension.unloadPoint());
  scene.setActive(true);
  Object.assign(window, {__FUSION__: {
    databaseName: review ? FUSION_REVIEW_DATABASE : FUSION_DATABASE,
    metrics: () => scene.metrics(),
    uiMetrics: () => handle.diagnostics(),
    resetUiMetrics: () => handle.resetDiagnostics(),
    feedbackMetrics: () => extension.feedbackMetrics(),
    resetMetrics: () => scene.resetMetrics(),
    pickAtClient: (x: number, y: number) => scene.pickAtClient(x, y),
  }});
}

void start().catch(() => {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.replaceChildren();
  const text = document.createElement('p');
  text.textContent = '档案暂时未接通，请刷新重试。';
  app.append(text);
});
