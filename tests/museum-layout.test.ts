import {it,expect} from 'vitest';
import {exhibits,itemCenter,layerPoint} from '../src/render/museum-layout';
import {baseRobotPose} from '../src/render/base-motion';
it('六柜按实图台面锚点落地，源格透明边不同也不偏离台架',()=>{
 const measured=[[175,526],[389,526],[606,527],[156,774],[389,774],[622,774]];
 exhibits.forEach((e,i)=>{const base=layerPoint(e,e.base.x,e.base.y);expect(base).toEqual({x:measured[i][0],y:measured[i][1]});expect(e.width).toBeLessThanOrEqual(i<3?114:126);});
});
it('六件实物含轻循环余量均在各自玻璃内，不用整格中心推断位置',()=>{
 exhibits.forEach(e=>{const p=itemCenter(e),s=e.scale,r=e.item.size*s/2,b=e.cavity;
 expect(p.x-r).toBeGreaterThanOrEqual(e.x+(b.x-e.base.x)*s);expect(p.x+r).toBeLessThanOrEqual(e.x+(b.x+b.w-e.base.x)*s);expect(p.y-r-3).toBeGreaterThanOrEqual(e.y+(b.y-e.base.y)*s);expect(p.y+r+3).toBeLessThanOrEqual(e.y+(b.y+b.h-e.base.y)*s);
 });
});
it('柜中实物→机械臂取放使用同一注册中心，无旧的固定半格偏移',()=>{
 for(let i=0;i<6;i++){const p=baseRobotPose(i*14+6.2),e=exhibits.find(e=>e.id===p.target)!;expect(p.item.x).toBeCloseTo(itemCenter(e).x,5);expect(p.item.y).toBeCloseTo(itemCenter(e).y,5);}
});
