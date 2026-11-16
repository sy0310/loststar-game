import {it,expect} from 'vitest';
import {receiptAssembly,receiptFloorGeometry,receiptFocusCamera,receiptVaultWindow} from '../src/render/receipt-study';
import {exhibits,itemCenter} from '../src/render/museum-layout';
it('收据安装真的移动结构件，灯光等结构归位后点亮，物品不跟着换级漂移',()=>{
 for(const level of [1,2,3]){
  const start=receiptAssembly(level,0),during=receiptAssembly(level,.45),end=receiptAssembly(level,1);
  expect(start.baseOffsetY).toBeGreaterThan(20);expect(during.baseOffsetY).toBeLessThan(start.baseOffsetY);expect(end.baseOffsetY).toBe(0);
  expect(start.nameplateOffsetY).toBeGreaterThan(10);expect(end.nameplateOffsetY).toBe(0);expect(start.lamp).toBe(0);expect(end.lamp).toBe(1);
  expect(start.itemOffset).toEqual({x:0,y:0});expect(during.itemOffset).toEqual(start.itemOffset);expect(end.itemOffset).toEqual(start.itemOffset);
 }
 expect(receiptAssembly(2,0).mechanismOffsetY).toBeGreaterThan(20);expect(receiptAssembly(2,1).mechanismOffsetY).toBe(0);
 expect(receiptAssembly(3,0).shellSplit).toBeGreaterThan(30);expect(receiptAssembly(3,.5).shellSplit).toBeGreaterThan(0);expect(receiptAssembly(3,1).shellSplit).toBe(0);
});
it('典藏玻璃采用实测独立内窗，既装得下原收据，又不给外金属框涂白板',()=>{
 const e=exhibits[0],w=receiptVaultWindow(e),item=itemCenter(e),half=e.item.size*e.scale/2;
 expect(w.left).toBeGreaterThan(135);expect(w.width).toBeLessThan(76);
 expect(w.left).toBeLessThan(item.x-half-2);expect(w.left+w.width).toBeGreaterThan(item.x+half+2);
 expect(w.top).toBeLessThan(item.y-half-3);expect(w.top+w.height).toBeGreaterThan(item.y+half+3);
 expect(w.archRise).toBeGreaterThan(20);expect(w.archRise).toBeLessThan(35);
});
it('预览镜头不随等级重新缩放；越界安装时间安全钳制且减少动态能看见完整归位',()=>{
 expect(receiptFocusCamera).toEqual({left:65,top:290,width:220,height:310});
 expect(receiptAssembly(3,-1)).toEqual(receiptAssembly(3,0));expect(receiptAssembly(3,12)).toEqual(receiptAssembly(3,1));
 for(let p=0;p<=1;p+=.01){const a=receiptAssembly(3,p);expect(Number.isFinite(a.baseOffsetY+a.shellSplit+a.crownOffsetY+a.lamp)).toBe(true);}
});
it('投影采用实际内底接收面并位于前金属唇之后，不落入旧item裁剪区或整座外廓',()=>{
 const e=exhibits[0];
 for(const level of [0,1,2,3]){
  const floor=receiptFloorGeometry(e,level),cy=floor.y+floor.height/2;
  expect(floor.width).toBeLessThan(84);expect(floor.width).toBeGreaterThan(70);
  expect(cy).toBeGreaterThan(493);expect(cy).toBeLessThan(507);
  expect(floor.frontY).toBeGreaterThan(cy);expect(floor.frontY).toBeLessThan(514);
 }
 expect(receiptFloorGeometry(e,0).hasBakedFloorFill).toBe(true);
 expect(receiptFloorGeometry(e,3).hasBakedFloorFill).toBe(false);
});
