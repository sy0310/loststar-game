import {curioRigContact} from '../src/fusion/curio-rig-motion';
import {expect,test} from 'vitest';
import {renewalCurioIds,renewalCurioRegistration,renewalReceiptCurioState,renewalTreatmentFrame,renewalBuriedReceiptPose} from '../src/fusion/curio-renewal-model';
import {createReceiptRestorationState,beginReceiptRestoration} from '../src/review/receipt-restoration';
import {curioConditionPresentation,curioTreatmentLabels,type CurioState} from '../src/fusion/curio-material';
const at=(id:typeof renewalCurioIds[number],kind:'clean'|'repair',p:number)=>renewalTreatmentFrame(id,{condition:kind==='clean'?'found':'clean',action:{kind,startedAt:100,endsAt:1100}},100+1000*p);

test('六物各自保持材质损伤、独立工具和两个可注册结构接触点',()=>{
 expect(renewalCurioIds).toHaveLength(6);
 const profiles=new Set<string>();
 for(const id of renewalCurioIds){
  const r=renewalCurioRegistration[id];expect(r.cleanPaths).toHaveLength(8);expect(r.repairs).toHaveLength(2);
  profiles.add(JSON.stringify(curioTreatmentLabels(id)));
  for(const repair of r.repairs){expect(repair.zone.length).toBeGreaterThanOrEqual(4);for(const p of [...repair.zone,repair.contact]){expect(p.x).toBeGreaterThanOrEqual(0);expect(p.x).toBeLessThanOrEqual(192);expect(p.y).toBeGreaterThanOrEqual(0);expect(p.y).toBeLessThanOrEqual(192);}}
  expect(curioConditionPresentation(id,'clean').detail).toContain('仍');
 }
 expect(profiles.size).toBe(6);
});
test('清理只能沿工具轨迹揭露B材质，不提前修复任何结构',()=>{
 for(const id of renewalCurioIds)for(const p of [0,.1,.4,.7,1]){const f=at(id,'clean',p);expect(f.cleaning).toBeCloseTo(p);expect(f.corrections).toEqual([0,0]);expect(f.repairing).toBe(0);}
});
test('两次结构施力只在工具压住的时间内发生，不在进场和退场中自动复位',()=>{
 for(const id of renewalCurioIds){
  expect(at(id,'repair',.1).corrections[0]).toBe(0);expect(at(id,'repair',.2).pressure).toBe(1);expect(at(id,'repair',.2).corrections[0]).toBeGreaterThan(0);
  expect(at(id,'repair',.35).corrections).toEqual([1,0]);expect(at(id,'repair',.6).corrections).toEqual([1,0]);expect(at(id,'repair',.75).pressure).toBe(1);expect(at(id,'repair',.75).corrections[1]).toBeGreaterThan(0);expect(at(id,'repair',1).corrections).toEqual([1,1]);
 }
});
test('工具接触点跟随同一归位插值，完成态固定在最终座位',()=>{
 for(const id of renewalCurioIds){const reg=renewalCurioRegistration[id];for(const p of [.2,.4,.68,.85]){const f=at(id,'repair',p),r=reg.repairs[f.step],remain=1-f.corrections[f.step];expect(f.repairContact).toEqual(curioRigContact(id,f.step,f.corrections));}}
});
test('收据只是已有秒制动作到渲染毫秒的投影，不补签收、不改费用或旧权益',()=>{
 let source=createReceiptRestorationState(27049,3);source={...source,stage:'displayed'};
 const started=beginReceiptRestoration(source,'clean','visual-test-clean',10).state;
 const before=JSON.stringify(started),projection=renewalReceiptCurioState(started);
 expect(projection.condition).toBe('found');expect(projection.action).toEqual({kind:'clean',startedAt:10000,endsAt:13800});
 expect(JSON.stringify(started)).toBe(before);expect(started.parts).toBe(27009);expect(started.caseTier).toBe(3);expect(started.verifiedEvidenceIds).toEqual([]);
 const complete:CurioState={condition:'stabilized'};
 for(const id of renewalCurioIds)expect(renewalTreatmentFrame(id,complete,NaN).corrections).toEqual([1,1]);
});


test('未出土纸伏在土样前岸后，出土沿固定纸边旋出并保持同一夹持点',()=>{
 const start=renewalBuriedReceiptPose(0),middle=renewalBuriedReceiptPose(.57),end=renewalBuriedReceiptPose(1);
 expect(start.scaleY).toBe(.2);expect(start.angle).toBe(-.2);expect(start.settle).toBe(0);expect(start.edgeContact.y).toBeGreaterThan(125);expect(start.edgeContact.y).toBeLessThan(132);
 expect(middle.scaleY).toBeGreaterThan(start.scaleY);expect(middle.scaleY).toBeLessThan(end.scaleY);expect(middle.pivot).toEqual(start.pivot);expect(end.pivot).toEqual(start.pivot);
 expect(end).toMatchObject({scaleY:1,angle:0,settle:1,edgeContact:{x:144,y:44}});
 for(const p of [-1,NaN,Infinity])expect(renewalBuriedReceiptPose(p)).toEqual(start);
});
