import {expect, it} from 'vitest';
import {createV034NightModel, v034EventSeconds} from '../src/review/v034-night-model';
import {
  v034ApproachPoint,
  v034BlendFromPatrol,
  v034Escape,
  v034NightStage,
  v034NightCamera,
  v034NightLightState,
  v034RelightState,
  v034RepairTool,
} from '../src/review/v034-night-stage';
import {nightRobotSourcePoint} from '../src/review/night-robot';
import {nightRobotRegistration} from '../src/review/d1-motion';
import {shipPose} from '../src/render/motion';

it('holds during the actual isolation pause and routes a leak through the real door', () => {
  const model = createV034NightModel('basic');
  const held = model.snapshot(16.2);
  expect(held.facilities.gate.holding).toBe(true);
  expect(v034NightStage(held).gate).toBeLessThan(.5);
  const reopening = model.snapshot(v034EventSeconds(49150));
  expect(reopening.facilities.gate.holding).toBe(false);
  expect(v034NightStage(reopening).gate).toBeGreaterThan(0);
  expect(v034NightStage(reopening).gate).toBeLessThan(1);
  const arrival = model.snapshot(23);
  expect(arrival.actor.outcome).toBe('arrived');
  expect(v034Escape(arrival)).toMatchObject({active: true, entry: 0, point: {x: 290, y: 410}});
  expect(v034NightStage(arrival).paper.alpha).toBe(0);
  expect(v034ApproachPoint(arrival).x).toBe(290);
});

it('only seals a verified incident and keeps the accepted carried-item path', () => {
  const model = createV034NightModel('complete');
  const before = model.snapshot(22);
  expect(before.actor.outcome).toBeNull();
  expect(v034NightStage(before).cargo.latched).toBe(false);
  const folding = v034NightStage(model.snapshot(23.9));
  expect(folding.paper.fold).toBeGreaterThan(.95);
  expect(folding.paper.intake).toBeGreaterThan(.9);
  expect(v034Escape(model.snapshot(23.9)).active).toBe(false);
  const contained = v034NightStage(model.snapshot(25));
  expect(contained.cargo.latched).toBe(true);
  expect(contained.paper.intake).toBe(1);
  expect(contained.robot.action).toBe('return');
  expect(v034NightStage(model.snapshot(29.2)).cargo.receiving).toBe(1);
});

it('keeps body, grip and paper targets continuous across real outcomes', () => {
  for (const preset of ['basic', 'complete'] as const) {
    const model = createV034NightModel(preset);
    const resolved = preset === 'basic' ? 23 : 24;
    const before = v034NightStage(model.snapshot(resolved - .001));
    const after = v034NightStage(model.snapshot(resolved + .001));
    expect(Math.hypot(after.robot.x - before.robot.x, after.robot.y - before.robot.y)).toBeLessThan(1);
    expect(Math.hypot(after.cargo.grip.x - before.cargo.grip.x, after.cargo.grip.y - before.cargo.grip.y))
      .toBeLessThan(1);
    expect(Math.abs(after.cargo.open - before.cargo.open)).toBeLessThan(.01);
    expect(Math.hypot(after.target.x - before.target.x, after.target.y - before.target.y)).toBeLessThan(1);
  }
});

it('binds morning repair to the registered claw and the actual warehouse seam', () => {
  const model = createV034NightModel('basic');
  const repairing = model.snapshot(31);
  expect(repairing.repairSpent).toBe(18);
  const stage = v034NightStage(repairing);
  expect(stage.robot.action).toBe('unload');
  expect(stage.cargo.visible).toBe(false);
  expect(stage.beamVisible(false)).toBe(false);
  const tool = v034RepairTool(repairing);
  expect(tool.grip).toEqual(nightRobotSourcePoint(nightRobotRegistration.unloadHands[1], false, stage));
  expect(tool.length).toBeLessThan(12);
  expect(tool.tip.x).toBeCloseTo(294.91, 3);
  expect(tool.tip.y).toBeCloseTo(402.895, 3);
  expect(v034NightStage(model.snapshot(35)).phase).toBe('done');
});

it('enters the third cycle incident from the existing patrol position continuously', () => {
  const model = createV034NightModel('basic', {mode: 'cycle'});
  const start = model.snapshot(280.2);
  const initial = v034NightStage(start);
  const patrol = {...initial.robot, x: 405, y: 478};
  const entered = v034BlendFromPatrol(start, initial, patrol);
  expect(entered.robot).toMatchObject({x: 405, y: 478, action: 'walk'});
  const end = model.snapshot(281.7);
  const normal = v034NightStage(end);
  const settled = v034BlendFromPatrol(end, v034NightStage(end), patrol);
  expect(settled.robot.x).toBeCloseTo(normal.robot.x, 3);
  expect(settled.robot.y).toBeCloseTo(normal.robot.y, 3);
});

it('keeps the entire globe texture inside the suggested review camera', () => {
  const camera = v034NightCamera;
  const left = 32 + camera.x + (52 - camera.x) * camera.scale;
  const right = 32 + camera.x + (716 - camera.x) * camera.scale;
  const top = camera.y + (70 - camera.y) * camera.scale + camera.offsetY;
  const bottom = camera.y + (734 - camera.y) * camera.scale + camera.offsetY;
  expect(left).toBeGreaterThan(0);
  expect(right).toBeLessThan(832);
  expect(top).toBeGreaterThan(0);
  expect(bottom).toBeLessThan(740);
});

it('only emits searchlight on the front orbit and fades it at the orbit boundary', () => {
  const view = createV034NightModel('basic').snapshot(12);
  const stage = v034NightStage(view);
  expect(v034NightLightState(view, stage, shipPose(1)).beam).toBe(0);
  expect(v034NightLightState(view, stage, shipPose(4)).beam).toBeGreaterThan(.9);
  const horizon = .8 / (Math.PI * 2) * 14;
  expect(v034NightLightState(view, stage, shipPose(horizon + .001)).beam).toBeLessThan(.001);
});

it('keeps the light on the actual creature or receiving point across both outcomes', () => {
  for (const preset of ['basic', 'complete'] as const) {
    const model = createV034NightModel(preset);
    const resolved = preset === 'basic' ? 23 : 24;
    const before = model.snapshot(resolved - .001);
    const after = model.snapshot(resolved + .001);
    const a = v034NightLightState(before, v034NightStage(before), shipPose(4)).target;
    const b = v034NightLightState(after, v034NightStage(after), shipPose(4)).target;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1);
  }
  const model = createV034NightModel('basic', {mode: 'cycle'});
  expect(Math.abs(model.snapshot(240).environment.light - model.snapshot(239.999).environment.light))
    .toBeLessThan(.001);
  expect(model.snapshot(243).environment.light).toBe(1);
});

it('increases local work light during contact and restores daylight without a ledger change', () => {
  const model = createV034NightModel('basic');
  expect(v034RelightState(model.snapshot(12)).work).toBeGreaterThan(v034RelightState(model.snapshot(3)).work);
  expect(v034RelightState(model.snapshot(36))).toEqual({station: 0, work: 0});
  expect(model.snapshot(36)).toMatchObject({damage: 6, repairSpent: 18, integrity: 100});
});
