import { describe,it,expect } from 'vitest';
import { robotPose,shipPose } from '../src/render/motion';
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
describe('连续运动与地面接触',()=>{
  it('机器人沿仓库外路线走一圈，关键动作无位置跳变',()=>{
    for(let i=0;i<1000;i++){
      const p=robotPose(i/1000),next=robotPose((i+1)/1000);
      expect(distance(p,next)).toBeLessThan(5);
      expect(p.x).toBeGreaterThan(210);expect(p.x).toBeLessThan(515);
      expect(p.y).toBeGreaterThan(325);expect(p.y).toBeLessThan(485);
      expect(p.x>247&&p.x<395&&p.y>386&&p.y<428).toBe(false);
    }
    expect(robotPose(.4).action).toBe('scan');expect(robotPose(.56).action).toBe('pickup');
    expect(robotPose(.8).action).toBe('return');expect(robotPose(.96).action).toBe('unload');
  });
  it('飞船朝向始终沿切线、尺度连续，前后切换点不突然翻转',()=>{
    for(let t=0;t<28;t+=.02){
      const a=shipPose(t),b=shipPose(t+.001);
      expect(distance(a,b)).toBeLessThan(.3);expect(Math.abs(a.scale-b.scale)).toBeLessThan(.001);
      const velocity=Math.atan2(b.y-a.y,b.x-a.x);
      expect(Math.cos(velocity-a.heading)).toBeGreaterThan(.99);
      expect(a.scale).toBeGreaterThan(.4);expect(a.scale).toBeLessThan(1.2);
    }
    expect(shipPose(10).back).toBe(true);expect(shipPose(4).back).toBe(false);
  });
});

it('独立包裹对齐空手图集的双手中点，先递交再落到收货台',()=>{
  // Atlas cell 6: gripper centers (49,106)/(74,111) in 160px cells,
  // rendered at 144px with anchor (-77.76,-139.68). Parcel is 24px tall.
  const carry=robotPose(.8);
  expect(carry.parcel.x-carry.x).toBeCloseTo(-22,0);
  expect(carry.parcel.y-carry.y).toBeCloseTo(-28,0);
  // Cell 7 extends both hands to the left before releasing onto the tray at (291,435).
  const handoff=robotPose(.935);expect(handoff.parcel.x).toBeCloseTo(293,0);expect(handoff.parcel.y).toBeCloseTo(419,0);
  const delivered=robotPose(.98);expect(delivered.parcel).toMatchObject({x:291,y:435,delivered:true,held:false});
});
