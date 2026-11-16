import {expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {curioRigCommands,curioRigContact,curioRigHinge,rigTransform,type RigId} from '../src/fusion/curio-rig-motion';
const ids:RigId[]=['receipt','tape','nested','stamp','cosmic-parcel','bell'];

test('两个结构接触点在全进度连续，无一开始施力就换整块C的位姿跳变',()=>{
 for(const id of ids)for(const step of [0,1]){
  let last=curioRigContact(id,step,[0,0]);
  for(let i=1;i<=1000;i++){
   const state=step===0?[i/1000,0]:[1,i/1000],p=curioRigContact(id,step,state);
   if(i>1)expect(Math.hypot(p.x-last.x,p.y-last.y),`${id}/${step}/${i}`).toBeLessThan(.12);
   expect(Number.isFinite(p.x+p.y)).toBe(true);last=p;
  }
 }
});
test('箱盖后铰链两端在损坏、归位和免费开盖过程都固定于真实后壁',()=>{
 for(const c0 of [0,.2,.5,1])for(const c1 of [0,.5,1])for(const trial of [0,.3,1])for(const p of [{x:80,y:43},{x:166,y:57}]){
  const q=curioRigHinge([c0,c1],p,trial);expect(q.x).toBeCloseTo(p.x,10);expect(q.y).toBeCloseTo(p.y,10);
 }
});
test('六物常态都真的驱动局部joint，固定body与减少动态读数保持不动',()=>{
 for(const id of ids){
  const first=curioRigCommands(id,[1,1],0,0,false),next=curioRigCommands(id,[1,1],1,0,false);
  expect(next,`${id} must have its own actual idle motion`).not.toEqual(first);
  expect(first.find(c=>c.key===`${id}-rig-fixed`)).toEqual(next.find(c=>c.key===`${id}-rig-fixed`));
  expect(curioRigCommands(id,[1,1],0,0,true)).toEqual(curioRigCommands(id,[1,1],100,0,true));
  expect(curioRigCommands(id,[1,1],0,.5,true),`${id} still gives explicit one-shot feedback with reduced motion`).not.toEqual(curioRigCommands(id,[1,1],0,0,true));
 }
});
const buffers=new Map<string,Buffer>();
async function bytes(key:string){let b=buffers.get(key);if(!b){b=await readFile(`assets/runtime/visual-renewal/curios/${key}.png`);buffers.set(key,b);}return b;}
async function raster(id:RigId,corrections:number[]){
 const defs:string[]=[],body:string[]=[];
 for(const [i,c]of curioRigCommands(id,corrections).entries()){
  const b=await bytes(c.key),clips:string[]=[];
  if(c.clip)clips.push(`<rect x="${c.clip[0]}" y="${c.clip[1]}" width="${c.clip[2]}" height="${c.clip[3]}"/>`);
  if(c.polygon)clips.push(`<polygon points="${c.polygon.map(p=>`${p.x},${p.y}`).join(' ')}"/>`);
  if(clips.length)defs.push(`<clipPath id="p${i}">${clips.join('')}</clipPath>`);
  body.push(`<g transform="matrix(${c.matrix.join(' ')})"><g ${clips.length?`clip-path="url(#p${i})"`:''}><image width="192" height="192" xlink:href="data:image/png;base64,${b.toString('base64')}"/></g></g>`);
 }
 return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="384" height="384" viewBox="0 0 192 192"><defs>${defs.join('')}</defs>${body.join('')}</svg>`)).ensureAlpha().raw().toBuffer();
}
test('真实RGBA合成中不动的实心body全程alpha≥.98，不再出现网格穿透与全身淡出',async()=>{
 for(const id of ids){
  const fixed=await sharp(await bytes(`${id}-rig-fixed`)).ensureAlpha().raw().toBuffer();
  for(const corrections of [[0,0],[.5,0],[1,0],[1,.5],[1,1]]){
   const actual=await raster(id,corrections);let checked=0,minimum=255;
   for(let at=3;at<fixed.length;at+=4)if(fixed[at]>=250){checked++;minimum=Math.min(minimum,actual[at]);}
   expect(checked).toBeGreaterThan(2500);expect(minimum,`${id}/${corrections} opaque fixed body`).toBeGreaterThanOrEqual(250);
  }
 }
},30000);


test('宇宙包裹两次应答只绕原签挂点轻摆，箱体不动、不平移脱挂',()=>{
 const hinge={x:81,y:79};
 for(const progress of [0,.43,.49,.55,.70,.76,.82,1]){
  const commands=curioRigCommands('cosmic-parcel',[1,1],0,progress,false),tag=commands.find(c=>c.key==='cosmic-parcel-rig-joint1')!,body=commands.find(c=>c.key==='cosmic-parcel-rig-fixed')!;
  const actual=rigTransform(tag.matrix,hinge);expect(actual.x).toBeCloseTo(hinge.x,10);expect(actual.y).toBeCloseTo(hinge.y,10);expect(body.matrix).toEqual([1,0,0,1,0,0]);
 }
});
