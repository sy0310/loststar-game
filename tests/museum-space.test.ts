import {describe,expect,it} from 'vitest';
import {museumCaseGeometry,museumSpace,physicalMuseumExhibits,translatedRect,rectsOverlap,museumDoorPanels} from '../src/render/museum-space';
import {museumServicePose,MuseumVisitEligibility} from '../src/render/museum-service';

describe('museum shared physical registration',()=>{
 it('reserves a real transit silhouette and gait footprint, not just a foot point',()=>{
  expect(museumSpace.transit.right-museumSpace.transit.left).toBeGreaterThan(museumSpace.measuredBodyWidth);
  expect(museumSpace.feet.right-museumSpace.feet.left).toBeGreaterThan(museumSpace.measuredFeetWidth);
  for(const x of museumSpace.corridors)for(const e of physicalMuseumExhibits)for(const level of [0,1,2,3]){
   const caseBounds=museumCaseGeometry(e,level).bounds,body=translatedRect(museumSpace.transit,{x,y:e.y});
   expect(rectsOverlap(body,caseBounds,museumSpace.clearance-.01)).toBe(false);
  }
 });
 it('telescopes every glass pane into the existing hood without moving any fixed case part',()=>{
  for(const e of physicalMuseumExhibits)for(const level of [0,1,2,3]){
   const g=museumCaseGeometry(e,level),fixed=JSON.stringify(g);
   for(let opening=0;opening<=1;opening+=.02)for(const pane of museumDoorPanels(g,opening)){
    expect(pane.bounds.left).toBe(g.door.left);expect(pane.bounds.right).toBe(g.door.right);
    expect(pane.bounds.top).toBeGreaterThan(g.bounds.top);expect(pane.bounds.bottom).toBeLessThanOrEqual(g.floor+.001);
   }
   expect(JSON.stringify(museumCaseGeometry(e,level))).toBe(fixed);
   for(const pane of museumDoorPanels(g,1))expect(pane.bounds.bottom).toBeCloseTo(g.ceiling);
  }
 });
 it('uses the same actual width, floor, door and nameplate at every level',()=>{
  for(const e of physicalMuseumExhibits)for(const level of [0,1,2,3]){
   const g=museumCaseGeometry(e,level);
   expect(g.bounds.right-g.bounds.left).toBe(e.width);
   expect(g.bounds.left).toBeGreaterThanOrEqual(12);expect(g.bounds.right).toBeLessThanOrEqual(756);
   expect(g.hitbox).toEqual(g.bounds);
   expect(g.plaque.top).toBeGreaterThanOrEqual(g.floor);
   expect(g.plaque.bottom).toBeLessThan(g.solid.bottom);
   expect(g.door.left).toBeGreaterThanOrEqual(g.bounds.left);
   expect(g.door.right).toBeLessThanOrEqual(g.bounds.right);
   expect(g.door.travel).toBe(museumSpace.innerHeight);
  }
 });
});
describe('museum full swept paths',()=>{
 it('keeps the entire registered gait footprint outside every solid at all cabinet levels',()=>{
  for(const level of [0,1,2,3])for(let t=0;t<84;t+=.02){
   const p=museumServicePose(t,()=>level);
   for(const e of physicalMuseumExhibits){const solid=museumCaseGeometry(e,level).solid;expect(rectsOverlap(p.feetBounds,solid,museumSpace.clearance)).toBe(false);expect(rectsOverlap(p.bodyGroundBounds,solid,museumSpace.clearance)).toBe(false);}
   if(p.trayExtension>0)expect(rectsOverlap(p.actorBounds,p.trayBounds,museumSpace.clearance-.01)).toBe(false);
  }
 });
 it('keeps an unfinished/unloaded object on its support until the next eligible visit',()=>{
  const latch=new MuseumVisitEligibility();expect(latch.resolve(4.4,()=>false)).toBe(false);latch.reset();expect(latch.resolve(7.8,()=>true)).toBe(false);
  let p=museumServicePose(7.8,()=>3,()=>latch.resolve(7.8,()=>true));expect(p.action).toBe('observe');expect(p.contact).toBe(0);expect(p.trayExtension).toBe(0);expect(p.opening).toBe(0);
  expect(latch.resolve(14,()=>true)).toBe(true);latch.reset();expect(latch.resolve(21.8,()=>true)).toBe(true);
  const fresh=new MuseumVisitEligibility();expect(fresh.resolve(7.8,()=>true)).toBe(false);fresh.reset();expect(fresh.resolve(8.1,()=>true)).toBe(false);expect(fresh.resolve(14.1,()=>true)).toBe(true);
  expect(fresh.resolve(92.5,()=>true)).toBe(false);
 });
 it('uses finite working-side arms below the existing 85px maximum, with a fully open portal before contact',()=>{
  let maximum=0;
  for(const level of [0,1,2,3])for(let t=0;t<84;t+=.01){
   const p=museumServicePose(t,()=>level);if(p.contact>.01){maximum=Math.max(maximum,p.handReach);expect(p.handReach).toBeLessThan(82.4);expect(p.apertureOpen).toBe(true);}
  }
  expect(maximum).toBeGreaterThan(40);
 });
 it('clears the near lip before leaving the cabinet, and retracts before closing',()=>{
  for(const level of [0,1,2,3])for(let t=0;t<84;t+=.02){
   const p=museumServicePose(t,()=>level),e=physicalMuseumExhibits.find(e=>e.id===p.target)!,g=museumCaseGeometry(e,level);
   if(p.trayExtension>.01)expect(p.opening).toBeGreaterThan(.995);
   if(p.itemDepth<=g.solid.bottom){expect(p.itemBounds.top).toBeGreaterThanOrEqual(g.aperture.top);expect(p.itemBounds.bottom).toBeLessThan(g.nearLip.top);expect(p.itemBounds.left).toBeGreaterThan(g.aperture.left);expect(p.itemBounds.right).toBeLessThan(g.aperture.right);}
   if(p.trayExtension>0&&p.trayDepth<=g.solid.bottom){expect(p.trayBounds.bottom).toBeLessThanOrEqual(g.nearLip.top-2);expect(p.trayBounds.top).toBeGreaterThan(g.aperture.top);}
   if(p.opening<.99)expect(p.trayExtension).toBe(0);
  }
 });
 it('does not jump at a service boundary for any of the six objects and four paid levels',()=>{
  for(const level of [0,1,2,3])for(let visit=0;visit<6;visit++)for(const phase of [4,4.8,5.5,6,6.45,6.8,7.05,7.2,7.8,8.5,9.1,9.4,10.1,10.5,11]){
   const a=museumServicePose(visit*14+phase-.00001,()=>level),b=museumServicePose(visit*14+phase+.00001,()=>level);
   for(const key of ['item','hand'] as const)expect(Math.hypot(a[key].x-b[key].x,a[key].y-b[key].y)).toBeLessThan(.01);
  }
 });
});
