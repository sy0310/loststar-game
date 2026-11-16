import {expect, it} from 'vitest';
import {nightHolsterStage} from '../src/review/night-scene';
import {robotPose} from '../src/render/motion';
import {createV034NightModel} from '../src/review/v034-night-model';
import {v034BlendFromPatrol, v034NightStage} from '../src/review/v034-night-stage';

it('keeps the registered empty case attached to the current patrol pose', () => {
  const pose = {...robotPose(.35), x: 405, y: 478};
  const holstered = nightHolsterStage(pose);
  expect(holstered.cargo.grip).toEqual({x: 427, y: 430});
  expect(holstered.cargo.visible).toBe(true);
  expect(holstered.cargo.open).toBe(0);
  expect(holstered.paper.alpha).toBe(0);
  expect(holstered.robot).toEqual(pose);
});

it('shares exactly the same case grip before and at the third-incident boundary', () => {
  const model = createV034NightModel('basic', {mode: 'cycle'});
  const patrol = {...robotPose(.35), x: 405, y: 478};
  const before = nightHolsterStage(patrol);
  const view = model.snapshot(280.2);
  const entering = v034BlendFromPatrol(view, v034NightStage(view), patrol);
  expect(entering.cargo.grip).toEqual(before.cargo.grip);
  expect(entering.cargo.open).toBe(before.cargo.open);
  expect(entering.cargo.yaw).toBe(before.cargo.yaw);
  expect(entering.cargo.pitch).toBe(before.cargo.pitch);
  expect(entering.cargo.angle).toBe(before.cargo.angle);
});
