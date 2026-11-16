import {it,expect} from 'vitest';
import {nightStage,receiptStage,nightCamera,projectNight,receiptGeometry} from '../src/review/d1-motion';
import {shipPose} from '../src/render/motion';
it('D1夜间30秒完成跨区域追踪、核验、收容、返回，路径连续且避开仓库地基',()=>{
 let last=nightStage(0),min=last.robot.x,max=min;const phases=new Set<string>();
 for(let t=.02;t<=30;t+=.02){const s=nightStage(t);expect(Math.hypot(s.robot.x-last.robot.x,s.robot.y-last.robot.y)).toBeLessThan(5);expect(Math.hypot(s.target.x-last.target.x,s.target.y-last.target.y)).toBeLessThan(5);expect(s.robot.x>247&&s.robot.x<395&&s.robot.y>386&&s.robot.y<428).toBe(false);min=Math.min(min,s.robot.x);max=Math.max(max,s.robot.x);phases.add(s.phase);last=s;}
 expect(max-min).toBeGreaterThan(240);expect(phases).toEqual(new Set(['signal','travel','identify','contain','escort','dock','done']));expect(nightStage(31).phase).toBe('done');
});
it('D1镜头完整保留球体闭合轮廓，光束世界目标与机器人事件点一致',()=>{
 const c=nightCamera;expect(c.scale).toBeGreaterThan(1);for(const [x,y]of [[52,70],[716,734]]){const p=projectNight({x,y});expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(832);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(740);}
 for(let t=0;t<30;t+=.1){const s=nightStage(t),ship=shipPose(t);expect(s.beamVisible(ship.back)).toBe(!ship.back);expect(Number.isFinite(s.target.x+s.target.y)).toBe(true);if(s.phase==='escort')expect(Math.hypot(s.target.x-s.robot.x,s.target.y-s.robot.y)).toBeLessThan(60);}
});
it('收据0–3四档共享实际台面、奇物位置和尺寸，安装有中间动作而非只换色',()=>{
 const all=[0,1,2,3].map(level=>receiptGeometry(level));for(const g of all){expect(g.anchor).toEqual({x:175,y:526});expect(g.item).toEqual(all[0].item);expect(g.itemSize).toBe(all[0].itemSize);}
 expect(all[1].baseWidth).toBeGreaterThan(all[0].baseWidth*1.2);expect(all[3].frameHeight).toBeGreaterThan(all[0].frameHeight*1.15);
 expect(receiptStage(0).level).toBe(0);expect(receiptStage(3).level).toBe(1);expect(receiptStage(6).level).toBe(2);expect(receiptStage(9).level).toBe(3);expect(receiptStage(2.4).install).toBeGreaterThan(0);expect(receiptStage(2.4).install).toBeLessThan(1);expect(receiptStage(12).install).toBe(1);
});
