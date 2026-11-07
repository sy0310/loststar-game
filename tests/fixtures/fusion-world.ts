import {newGame, advance} from '../../src/game/engine';
import {ExpeditionScene} from '../../src/render/scene';
import {createFusionScene} from '../../src/fusion/scene';
const params = new URLSearchParams(location.search);
const seconds = Number(params.get('seconds') ?? 10);
const level = Number(params.get('level') ?? 0);
const seed = newGame(1800000000000);
seed.resources = 27049;
seed.collection = ['receipt', 'mouse', 'hermit', 'tagbird'];
seed.growth = {'guard-0': level, 'guard-1': level};
let state = advance(seed, 1800000000000 + seconds * 1000);
const live = params.get('live') === '1';
if (live) {
  const start = Date.now();
  window.setInterval(() => {state = advance(state, 1800000000000 + seconds * 1000 + Date.now() - start);}, 50);
}
const extension = createFusionScene(() => state, undefined, () => ['habitat-window', 'archive']);
const scene = new ExpeditionScene(document.querySelector('#world')!, () => state, extension);
scene.setActive(true);
function ready() {
  if (!scene.ready) {requestAnimationFrame(ready);return;}
  if (!live) scene.freeze(seconds);
  document.documentElement.dataset.ready = 'true';
}
ready();
