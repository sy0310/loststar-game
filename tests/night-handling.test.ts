import {expect,it} from 'vitest';
import {nightStage,nightRobotRegistration} from '../src/review/d1-motion';

it('uses the measured atlas grip instead of the old parcel bottom anchor',()=>{
  expect(nightRobotRegistration.carryGrip.x).toBeCloseTo(-23.76,2);
  expect(nightRobotRegistration.carryGrip.y).toBeCloseTo(-43.38,2);
  const stage=nightStage(24);
  expect(stage.cargo.grip.x-stage.robot.x).toBeCloseTo(-23.76,2);
  expect(stage.cargo.grip.y-stage.robot.y-stage.rig.bob).toBeCloseTo(-43.38,2);
});

it('folds separate paper panels, latches, and takes weight before walking home',()=>{
  expect(nightStage(15.4).handling.reach).toBeGreaterThan(0);
  expect(nightStage(15.4).paper.fold).toBe(0);
  expect(nightStage(16.5).paper.fold).toBeGreaterThan(0);
  expect(nightStage(17.4).paper.intake).toBeGreaterThan(0);
  expect(nightStage(17.4).cargo.open).toBeGreaterThan(.9);
  expect(nightStage(19).cargo.open).toBe(0);
  expect(nightStage(19.6).rig.load).toBeGreaterThan(0);
  expect(nightStage(20).cargo.latched).toBe(true);
  expect(nightStage(20).robot.action).toBe('return');
  for(const t of [12,16,17.5,19.5,24])expect(nightStage(t).paper.sourceScale).toBe(.35);
});

it('keeps cargo, paper and handoff continuous and receives behind the door',()=>{
  let previous=nightStage(0);
  for(let t=.02;t<=30;t+=.02){
    const next=nightStage(t);
    expect(Math.hypot(next.cargo.grip.x-previous.cargo.grip.x,next.cargo.grip.y-previous.cargo.grip.y)).toBeLessThan(5);
    expect(Math.hypot(next.paper.pivot.x-previous.paper.pivot.x,next.paper.pivot.y-previous.paper.pivot.y)).toBeLessThan(5);
    expect(next.paper.height).toBeGreaterThanOrEqual(0);
    previous=next;
  }
  expect(nightStage(27.8).cargo.receiving).toBeGreaterThan(0);
  expect(nightStage(28.7).cargo.receiving).toBe(1);
  expect(nightStage(29.2).cargo.visible).toBe(false);
});
