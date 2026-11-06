import {expect, test} from 'vitest';
import {curioConditionPresentation,curioTreatmentLabels,curioPhysicalFrame,curioActionProgress,curioSupportContacts,type CurioState} from '../src/fusion/curio-material';

const at = (kind: 'clean'|'repair', progress: number, id: 'tape'|'bell'='tape') => curioPhysicalFrame(id,{
  condition:kind==='clean'?'found':'clean',action:{kind,startedAt:100,endsAt:1100},
},100+progress*1000);

test('三种材料沿同一存档状态展示各自缺损与操作词',()=>{
  const signatures=new Set<string>();
  for(const id of ['receipt','tape','bell']){
    signatures.add(JSON.stringify(curioTreatmentLabels(id)));
    expect(curioConditionPresentation(id,'found').label).toBe('刚获得');
    expect(curioConditionPresentation(id,'clean').label).toBe('清理后');
    expect(curioConditionPresentation(id,'stabilized').label).toBe('升级完成');
  }
  expect(signatures.size).toBe(3);
  expect(curioConditionPresentation('receipt','stabilized').detail).toContain('签收仍空白');
  expect(curioConditionPresentation('tape','clean').detail).toContain('断头仍分离');
  expect(curioConditionPresentation('bell','clean').detail).toContain('顶杆仍卡住');
});

test('清理只去类型污损，断头与固定件的结构状态不被清理自动修复',()=>{
  for(const id of ['tape','bell'] as const)for(const p of [0,.2,.5,.9,1]){
    const frame=at('clean',p,id);
    expect(frame.cleaning).toBeCloseTo(p);expect(frame.aligned).toBe(0);expect(frame.pressed).toBe(0);
    expect(frame.contact.x+frame.contact.y).toBeGreaterThan(0);
  }
});

test('胶带卷背和前胶尾各自贴在真实台面，修复只改变断头接触位而不移动胶卷',()=>{
  const found=curioSupportContacts('tape',{condition:'found'},0);
  const clean=curioSupportContacts('tape',{condition:'clean'},0);
  const fixed=curioSupportContacts('tape',{condition:'stabilized'},0);
  expect(found).toEqual(clean);
  expect(fixed[0]).toEqual(found[0]);
  expect(fixed[1].point.y).toBeLessThan(found[1].point.y);
  for(const contacts of [found,clean,fixed])for(const contact of contacts){
    const tableY=184+contact.point.y*340/192;
    expect(tableY).toBeGreaterThanOrEqual(440);expect(tableY).toBeLessThan(535);
    expect(contact.radiusY*340/192).toBeLessThan(6);
  }
});

test('胶带先在镊子接触后移回断头，再在压片接触后压合胶边',()=>{
  expect(at('repair',.10).aligned).toBe(0);
  expect(at('repair',.20).aligned).toBeGreaterThan(0);
  expect(at('repair',.35).aligned).toBe(1);
  expect(at('repair',.35).pressed).toBe(0);
  expect(at('repair',.60).pressed).toBe(0);
  expect(at('repair',.75).pressed).toBeGreaterThan(0);
  expect(at('repair',1).pressed).toBe(1);
});

test('铃分别紧固、复位顶杆；原图没有灯，不向丝带添加伪造灯光',()=>{
  expect(at('repair',.35,'bell').aligned).toBe(1);
  expect(at('repair',.35,'bell').pressed).toBe(0);
  expect(at('repair',.90,'bell').pressed).toBe(1);
  const final=curioPhysicalFrame('bell',{condition:'stabilized'},0);
  expect(final).toMatchObject({cleaning:1,repairing:1,aligned:1,pressed:1,complete:true});
  expect(final).not.toHaveProperty('lamp');
});

test('渲染投影保持输入存档与既有完成权益，时间边界有限且不重新收费',()=>{
  const saved:CurioState={condition:'stabilized'};const before=JSON.stringify(saved);
  for(const time of [0,1000,NaN,Infinity,-100]){
    expect(curioPhysicalFrame('tape',saved,time).complete).toBe(true);
    expect(curioActionProgress({condition:'found',action:{kind:'clean',startedAt:0,endsAt:100}},time)).toBeGreaterThanOrEqual(0);
  }
  expect(JSON.stringify(saved)).toBe(before);
  expect(curioActionProgress({condition:'clean',action:{kind:'repair',startedAt:100,endsAt:100}},100)).toBe(1);
});
