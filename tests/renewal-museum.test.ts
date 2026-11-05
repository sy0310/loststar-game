import {describe,expect,it} from 'vitest';
import {exhibits,itemCenter} from '../src/render/museum-layout';
import {renewalExhibits,renewalDisplaySpecimen,renewalMuseumPose} from '../src/render/renewal-museum';
import {renewalCurioRegistration,type RenewalCurioId} from '../src/fusion/curio-renewal-model';
import {baseRobotPose} from '../src/render/base-motion';

describe('renewed museum physical registration',()=>{
 it('uses the actual sole of every material at every paid cabinet level',()=>{
  for(const level of [0,1,2,3])for(const bay of renewalExhibits){
   const item=renewalDisplaySpecimen(bay,level),center=itemCenter(item),support=renewalCurioRegistration[bay.id as RenewalCurioId].support;
   const sole={x:center.x+(support.x-96)*item.item.size/192,y:center.y+(support.y-96)*item.item.size/192};
   expect(sole.x).toBeCloseTo(bay.x,10);
   expect(sole.y).toBeCloseTo(bay.y-[44,54,62,72][level]-13,10);
  }
 });
 it('keeps the two complete rows and their labels separate from the next row crown',()=>{
  for(const bay of renewalExhibits){
   expect(bay.x-100).toBeGreaterThanOrEqual(0);expect(bay.x+100).toBeLessThanOrEqual(768);
   expect(bay.y+44).toBeLessThan(960);
   if(bay.y===825)expect(bay.y-278).toBeGreaterThan(500+44);
  }
  // The head may overlap the projected cabinetry; the real feet fit these 40px aisles.
  for(const footX of [270,500])for(const bay of renewalExhibits)expect(Math.abs(footX-bay.x)).toBeGreaterThanOrEqual(92+15);
 });
 it('keeps the item and hand path continuous through lifting and placing at all levels',()=>{
  for(const level of [0,1,2,3])for(let visit=0;visit<6;visit++)for(const phase of [4,5.5,6.2,7.2,8.2,9.2,10]){
   const before=renewalMuseumPose(visit*14+phase-.0001,()=>level),after=renewalMuseumPose(visit*14+phase+.0001,()=>level);
   expect(Math.hypot(before.item.x-after.item.x,before.item.y-after.item.y)).toBeLessThan(.1);
   expect(Math.hypot(before.hand.x-after.hand.x,before.hand.y-after.hand.y)).toBeLessThan(.1);
  }
 });
 it('does not mutate the historical room or default robot path',()=>{
  const before=JSON.stringify(exhibits),pose=baseRobotPose(6.8);
  for(const bay of renewalExhibits)renewalDisplaySpecimen(bay,3);
  renewalMuseumPose(6.8,()=>3);
  expect(JSON.stringify(exhibits)).toBe(before);expect(baseRobotPose(6.8)).toEqual(pose);
 });
});

describe('service route and reachable arms',()=>{
 it('walks the real row-front route and brings the body to within an arm reach before touching',()=>{
  for(const level of [0,1,2,3])for(let t=0;t<84;t+=.04){
   const p=renewalMuseumPose(t,()=>level);
   for(const bay of renewalExhibits)expect(Math.abs(p.x-bay.x)<95&&p.y>bay.y-65&&p.y<bay.y).toBe(false);
   if(p.contact>.1){
    expect(Math.hypot(p.hand.x-p.shoulder.x,p.hand.y-p.shoulder.y)).toBeLessThan(85);
   }
  }
 });
});
