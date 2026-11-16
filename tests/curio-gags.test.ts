import {expect,test} from 'vitest';
import {curioRigCommands,stampPerformanceDate} from '../src/fusion/curio-rig-motion';

test('套娃在外盖后继续打开内盖，最后显露同一原箱；结束回到原机构',()=>{
 const idle=curioRigCommands('nested',[1,1],0,0,true);
 const start=curioRigCommands('nested',[1,1],0,.10,true);
 const reveal=curioRigCommands('nested',[1,1],0,.5,true);
 expect(start.filter(c=>c.key==='nested-rig-joint0')).toHaveLength(2);
 expect(reveal.some(c=>c.key==='nested-rig-inner')).toBe(true);
 expect(idle.some(c=>c.key==='nested-rig-inner')).toBe(false);
 const [inner,outer]=reveal.filter(c=>c.key==='nested-rig-joint0');
 expect(Math.hypot(inner.matrix[0],inner.matrix[1])).toBeLessThan(Math.hypot(outer.matrix[0],outer.matrix[1]));
 expect(curioRigCommands('nested',[1,1],0,1,true)).toEqual(idle);
});

test('邮戳按下后票面日期只退真实一天，跨年也不创造持久收据事实',()=>{
 const at=new Date(2026,0,1,12).getTime();
 expect(stampPerformanceDate(at,.2)).toBe('01.01');
 expect(stampPerformanceDate(at,.6)).toBe('12.31');
 expect(stampPerformanceDate(at,0)).toBe('01.01');
 expect(stampPerformanceDate(at,1)).toBe('01.01');
});
