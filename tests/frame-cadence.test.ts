import {expect, it} from 'vitest';
import {FrameCadence} from '../src/render/frame-cadence';
import {baseRobotPose} from '../src/render/base-motion';
import webkitTrace from './fixtures/webkit-raf-v043.json';

it('真实WebKit显示时序不因任意绘制起相重复丢弃本可绘制的一帧',()=>{
 for(const trace of webkitTrace.cases)for(let offset=0;offset<17;offset++){
  const cadence=new FrameCadence();let at=0,count=0;cadence.draw(at);
  cadence.draw(offset);
  for(const delta of trace.intervals){at+=delta;if(cadence.draw(offset+at))count++;}
  expect(count,`${trace.view} phase${offset}`).toBeGreaterThanOrEqual(trace.intervals.length-3);
 }
});

it('30Hz绘制累计显示时间，在60Hz屏上保留小数余量', () => {
  const clock = new FrameCadence();
  const paints: number[] = [];
  for (let frame = 0; frame <= 600; frame++) if (clock.draw(frame * 1000 / 60, 1000 / 30)) paints.push(frame * 1000 / 60);
  expect(paints).toHaveLength(301);
  for (let index = 1; index < paints.length; index++) expect(paints[index] - paints[index - 1]).toBeCloseTo(1000 / 30, 6);
});

it('后台恢复与时间重置各只画当前帧，不补画过期帧', () => {
  const clock = new FrameCadence();
  expect(clock.draw(0)).toBe(true);
  expect(clock.draw(4)).toBe(false);
  clock.reset();
  expect(clock.draw(60000)).toBe(true);
  expect(clock.draw(60004)).toBe(false);
  expect(clock.draw(1)).toBe(true);
});

for(const sourceHz of [60,120])for(const targetHz of [60,30])it(`${sourceHz}Hz整数毫秒rAF保持${targetHz}Hz目标频率且无额外跳帧`,()=>{
  const clock=new FrameCadence(),paints:{frame:number;at:number}[]=[];
  for(let frame=0;frame<=sourceHz*10;frame++){
    const at=Math.round(frame*1000/sourceHz);
    if(clock.draw(at,1000/targetHz))paints.push({frame,at});
  }
  expect(paints).toHaveLength(targetHz*10+1);
  for(let index=0;index<paints.length;index++)expect(paints[index].frame).toBe(index*sourceHz/targetHz);
  for(let index=1;index<paints.length;index++){
    const gap=paints[index].at-paints[index-1].at;
    expect(gap).toBeGreaterThanOrEqual(Math.floor(1000/targetHz));
    expect(gap).toBeLessThanOrEqual(Math.ceil(1000/targetHz));
  }
});

it('保留早画的负余量，16ms输入不会漂移成62.5Hz',()=>{
  const clock=new FrameCadence();let paints=0;
  for(let at=0;at<=16000;at+=16)if(clock.draw(at))paints++;
  expect(paints).toBe(961);
});

it('后台长间隔只画一次当前帧，重复时间戳不追帧；reset清除正负余量',()=>{
  const clock=new FrameCadence();
  expect(clock.draw(0)).toBe(true);expect(clock.draw(17)).toBe(true);expect(clock.draw(33)).toBe(true);
  expect(clock.draw(60013)).toBe(true);
  for(let repeat=0;repeat<10;repeat++)expect(clock.draw(60013)).toBe(false);
  expect(clock.draw(60017)).toBe(false);
  clock.reset();expect(clock.draw(90000)).toBe(true);expect(clock.draw(90004)).toBe(false);expect(clock.draw(90017)).toBe(true);
});

it('机器人抓取前到达实物，提放停稳，手与机械臂保持连续', () => {
  const before = baseRobotPose(6.2);
  expect(before.lift).toBe(0);
  const at = baseRobotPose(7.2);
  expect(at.lift).toBe(1);
  for (const boundary of [4, 5.5, 6.2, 7.2, 8.2, 9.2, 10, 14]) {
    const a = baseRobotPose(boundary - .001);
    const b = baseRobotPose(boundary + .001);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(1);
    expect(Math.hypot(b.hand.x - a.hand.x, b.hand.y - a.hand.y)).toBeLessThan(1);
    if (a.lift > 0 || b.lift > 0) expect(Math.hypot(b.item.x - a.item.x, b.item.y - a.item.y)).toBeLessThan(1);
  }
});
