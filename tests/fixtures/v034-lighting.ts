import '../../src/review/v034.css';
import {ExpeditionScene} from '../../src/render/scene';
import {createV034NightModel} from '../../src/review/v034-night-model';
import {createV034NightScene} from '../../src/review/v034-night-scene';
import {v034NightCamera} from '../../src/review/v034-night-stage';
import {v034ShipPose} from '../../src/review/v034-camera';

const params = new URLSearchParams(location.search);
const preset = params.get('preset') === 'complete' ? 'complete' : 'basic';
const seconds = Math.max(0, Math.min(36, Number(params.get('seconds')) || 0));
const dayLight = params.get('light') === 'day';
document.body.innerHTML = `<div id="week1-app">
  <header class="week-header"><div><div class="week-kicker">RENDER AUDIT / 固定时刻</div><h1>退件平原</h1></div></header>
  <main class="week-main"><p class="week-note" id="light-label"></p><div class="week-scene" id="light-world"></div>
  <p class="week-note">同一球体、时刻、角色和飞船位置，日照对照仅切换环境光场。<br>控制时刻的渲染检查，真实墙钟录像单独提供。</p></main></div>`;
document.querySelector('#light-label')!.textContent = `${dayLight ? '同事件姿态 · 日照对照' : '夜间现场光'} / ${seconds}s / ${preset}`;
document.documentElement.dataset.build = `${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty ? ' · 本地修改' : ''}`;

const model = createV034NightModel(preset);
const lightingModel = {...model, snapshot: (time: number) => {
  const view = model.snapshot(time);
  return dayLight ? {...view, environment: {...view.environment, light: 0}} : view;
}};
const layer = createV034NightScene(lightingModel, {camera: v034NightCamera});
const scene = new ExpeditionScene(document.querySelector<HTMLElement>('#light-world')!,
  () => model.getState(scene.elapsedSeconds()), {...layer, shipPose: v034ShipPose,
    afterWorld: (context, frame) => {
      layer.afterWorld(context, frame);
      Object.assign(frame.output.dataset, {
        auditRobotX: String(frame.robot.x), auditRobotY: String(frame.robot.y),
        auditShipX: String(frame.ship.x), auditShipY: String(frame.ship.y),
        auditCamera: JSON.stringify(layer.camera),
      });
    }});
scene.setActive(true);
await layer.ready;
while (!scene.ready) await new Promise(resolve => setTimeout(resolve, 10));
scene.setActive(false);
scene.freeze(seconds);
document.documentElement.dataset.lightingReady = 'true';
