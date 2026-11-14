import {afterEach,expect,test,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {modernReceiptPose,modernReceiptPoint,modernReceiptSupport,modernReceiptClampContacts,modernReceiptRepairContact,warpModernReceiptPixels,modernReceiptBounds} from '../src/fusion/receipt-paper-model';
import {renewalTreatmentFrame} from '../src/fusion/curio-renewal-model';
import {receiptReadingRecords} from '../src/fusion/receipt-reading-model';
import {drawCurioAbilityRig} from '../src/fusion/curio-ability-rig';
import {drawModernReceiptPaper} from '../src/fusion/receipt-paper-renderer';

afterEach(()=>vi.unstubAllGlobals());

test('现代票据全程是一张连续矩形纸，压力仅逐步压平两道原折痕',()=>{
 for(const cleaning of [0,.3,.7,1])for(const corrections of [[0,0],[.5,0],[1,0],[1,.5],[1,1]]){
  const pose=modernReceiptPose(cleaning,corrections);let previous=modernReceiptPoint({x:0,y:0},pose).y;
  for(let y=.25;y<=192;y+=.25){const a=modernReceiptPoint({x:0,y},pose),b=modernReceiptPoint({x:192,y},pose);expect(a.y).toBeGreaterThan(previous);expect(b.x-a.x).toBeGreaterThan(170);previous=a.y;}
 }
 for(const step of [0,1]){let old=modernReceiptRepairContact(step,step?[1,0]:[0,0]);for(let n=1;n<=1000;n++){const next=modernReceiptRepairContact(step,step?[1,n/1000]:[n/1000,0]);expect(Math.hypot(next.x-old.x,next.y-old.y)).toBeLessThan(.02);old=next;}}
 const fixed=modernReceiptPose(1,[1,1]);for(const p of [{x:112,y:14},{x:42,y:160},{x:141,y:135}])expect(modernReceiptPoint(p,fixed)).toEqual(p);
});

test('同一原纸逆向像素取样，A/B/C及处理中实心纸alpha全程≥.98，无全身溶解或网格漏透',async()=>{
 const source=await sharp('assets/runtime/visual-renewal/receipt-modern/receipt-paper-master.png').ensureAlpha().raw().toBuffer(),target=new Uint8ClampedArray(384*384*4);
 for(const cleaning of [0,.2,.6,1])for(const corrections of [[0,0],[.5,0],[1,0],[1,.5],[1,1]]){
  warpModernReceiptPixels(source,modernReceiptPose(cleaning,corrections),target);let minimum=255;
  for(let y=70;y<300;y++)for(let x=125;x<250;x++)minimum=Math.min(minimum,target[(y*384+x)*4+3]);
  expect(minimum).toBeGreaterThanOrEqual(250);
 }
 for(const state of ['found','clean','stabilized']){
  const p=await sharp(`assets/runtime/visual-renewal/curios/receipt-${state}.png`).ensureAlpha().raw().toBuffer();
  for(let y=70;y<300;y+=9)for(let x=125;x<250;x+=7)expect(p[(y*384+x)*4+3],state).toBeGreaterThanOrEqual(250);
 }
});

test('纸污与折痕层严格落在原纸alpha内，不再伸出白纸条；三态身份同源',async()=>{
 const master=await sharp('assets/runtime/visual-renewal/receipt-modern/receipt-paper-master.png').ensureAlpha().raw().toBuffer();
 for(const name of ['deposits','creases']){const layer=await sharp(`assets/runtime/visual-renewal/receipt-modern/receipt-paper-${name}.png`).ensureAlpha().raw().toBuffer();for(let at=3;at<master.length;at+=4)if(master[at]===0)expect(layer[at],name).toBe(0);}
 const registration=JSON.parse(await readFile('assets/runtime/visual-renewal/receipt-modern/registration.json','utf8'));
 expect(registration.originalFacts).toEqual({artifactCode:'RET-031',boxCode:'P03',signature:null});
 expect(registration.assets.filter((a:{layer:string})=>a.layer==='canonical-single-sheet-state')).toHaveLength(3);
});

test('工具尖端投影与同一纸面一致；四紫夹接触纸边，归档脚不会随能力试验游移',()=>{
 for(const kind of ['clean','repair'] as const)for(const p of [.03,.2,.55,.75,.99]){
  const f=renewalTreatmentFrame('receipt',{condition:kind==='clean'?'found':'clean',action:{kind,startedAt:0,endsAt:1000}},1000*p);
  if(kind==='repair')expect(f.repairContact).toEqual(modernReceiptRepairContact(f.step,f.corrections));
  expect(f.contact.x).toBeGreaterThan(20);expect(f.contact.x).toBeLessThan(170);
 }
 expect(modernReceiptClampContacts).toHaveLength(4);expect(modernReceiptSupport).toEqual({x:96,y:195});
 const a=modernReceiptPose(1,[1,1],0,0,false),b=modernReceiptPose(1,[1,1],1,.5,false);
 expect(modernReceiptPoint({x:100,y:110},b)).not.toEqual(modernReceiptPoint({x:100,y:110},a));
 expect(modernReceiptPose(1,[1,1],0,0,true)).toEqual(modernReceiptPose(1,[1,1],100,0,true));
});

test('收据0/I/II只画一张票据，不再追加旧纸翼；仅显示传入的真实记录',()=>{
 const records=[{id:'label/P30',at:10,detail:'现场倒置箱标',code:'P30',orientation:'inverted'},{id:'label/P03',at:11,detail:'现场箱标',code:'P03'}],before=JSON.stringify(records);
 for(const level of [0,1,2]){
  const drawImage=vi.fn();const ctx=new Proxy({drawImage},{get:(t,k)=>k in t?t[k as keyof typeof t]:()=>{},set:()=>true}) as unknown as CanvasRenderingContext2D;
  const result=drawCurioAbilityRig(ctx,{id:'receipt',image:{} as CanvasImageSource,seconds:3,abilityLevel:level,experimentProgress:.5,records});
  expect(drawImage).toHaveBeenCalledTimes(1);expect(result.bounds).toEqual(modernReceiptBounds);expect(result.extension).toBe(0);
  expect(result.usedRecordIds).toEqual(records.slice(0,level).map(r=>r.id));
 }
 expect(JSON.stringify(records)).toBe(before);
 expect(receiptReadingRecords([],2)).toEqual([]);
 expect(receiptReadingRecords([...records,{...records[0]},{id:'bad',at:NaN,detail:'not-valid'}],2)).toEqual(records);
});

test('清理/施力复用同一surface时，revision确实刷新源像素而不是锁在第一次found',()=>{
 let allocated=0,reads=0;
 class FakeCanvas{
  width=384;height=384;data=new Uint8ClampedArray(384*384*4);
  context={clearRect:()=>this.data.fill(0),drawImage:(image:FakeCanvas)=>this.data.set(image.data),getImageData:()=>{reads++;return{data:this.data.slice()};},createImageData:()=>({data:new Uint8ClampedArray(384*384*4)}),putImageData:(image:{data:Uint8ClampedArray})=>this.data.set(image.data)};
  getContext(){return this.context;}
 }
 vi.stubGlobal('document',{createElement:()=>{allocated++;return new FakeCanvas();}});
 const source=new FakeCanvas();source.data.fill(17);const outputs:number[]=[];
 const target={save(){},restore(){},drawImage:(image:FakeCanvas)=>outputs.push(image.data[0])} as unknown as CanvasRenderingContext2D;
 const pose=modernReceiptPose(1,[1,1]);
 drawModernReceiptPaper(target,source as unknown as HTMLCanvasElement,pose,'found/0');source.data.fill(88);
 drawModernReceiptPaper(target,source as unknown as HTMLCanvasElement,pose,'clean/.3');
 drawModernReceiptPaper(target,source as unknown as HTMLCanvasElement,pose,'clean/.3');
 expect(outputs).toEqual([17,88,88]);expect(allocated).toBe(1);expect(reads).toBe(2);
});
