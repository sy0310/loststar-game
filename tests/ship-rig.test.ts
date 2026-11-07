import {describe,it,expect} from 'vitest';
import {shipPose as shipRig} from '../src/render/motion';
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
describe('飞船喷口与尾迹同一视角坐标系',()=>{
  it('每层机身真实喷口都落在共同尾焰原点，尾气只朝机尾',()=>{
    for(let t=0;t<28;t+=.025){
      const rig=shipRig(t);
      expect(rig.layers.reduce((s,p)=>s+p.alpha,0)).toBeCloseTo(1);
      for(const layer of rig.layers){
        const a=layer.anchor,x=(a.x-128)*rig.width/256,y=(a.y-128)*rig.width/256;
        const actual={x:layer.x+x*Math.cos(layer.rotation)-y*Math.sin(layer.rotation),y:layer.y+x*Math.sin(layer.rotation)+y*Math.cos(layer.rotation)};
        expect(distance(actual,rig.nozzle)).toBeLessThan(.001);
        expect(Math.cos(layer.nativeHeading+layer.rotation+Math.PI-rig.exhaustHeading)).toBeGreaterThan(.999);
      }
      expect(Math.cos(rig.exhaustHeading-rig.heading)).toBeLessThan(-.98);
      expect(distance(rig.nozzle,shipRig(t+.001).nozzle)).toBeLessThan(1.5);
    }
  });
  it('尾迹有界、消散且与机身共用球前/球后层级',()=>{
    for(const t of [0,1.7,4,8.8,10,13.9,14,28]){
      const p=shipRig(t),trail=p.trail;
      expect(trail.length).toBeGreaterThan(2);expect(trail.length).toBeLessThanOrEqual(10);
      expect(trail.every(dot=>dot.back===p.back&&dot.alpha>=0&&dot.alpha<=1)).toBe(true);
      expect(trail[0].alpha).toBeGreaterThan(trail.at(-1)!.alpha);
      expect(trail.every(dot=>Number.isFinite(dot.x)&&Number.isFinite(dot.y))).toBe(true);
    }
  });
});
