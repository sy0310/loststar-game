import {openFusionStore} from './store';
import {mountFusion} from './ui';
import {createFusionScene} from './scene';
import {ExpeditionScene} from '../render/scene';

async function start() {
  const controller = await openFusionStore();
  const handle = mountFusion(controller);
  const extension = createFusionScene(() => controller.state.game,
    (id, at, source) => void controller.act({type: 'observe', id, at, source}),
    () => controller.state.projects);
  const scene = new ExpeditionScene(handle.worldRoot, () => controller.state.game, extension);
  handle.setScene(scene, () => extension.pulse(), () => extension.focus());
  scene.setActive(true);
  Object.assign(window, {__FUSION__: {
    metrics: () => scene.metrics(),
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
