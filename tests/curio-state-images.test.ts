import {afterEach, expect, test, vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import type {CurioState} from '../src/fusion/curio-material';

afterEach(() => {vi.unstubAllGlobals();vi.resetModules();});

test('已扣费但尚未完成的处理、过期计时和重新进入都不能预授下一张图', async () => {
  const {curioStateImageKey} = await import('../src/fusion/curio-state-images');
  for (const condition of ['found','clean','stabilized'] as const) {
    const state:CurioState={condition,action:{kind:condition==='found'?'clean':'repair',startedAt:0,endsAt:1}};
    const before=JSON.stringify(state);
    for (let n=0;n<4;n++) expect(curioStateImageKey('receipt',state)).toBe(`receipt-${condition}`);
    expect(JSON.stringify(state)).toBe(before);
  }
});

test('六物18个源图有真实透明PNG与对应无损WebP，所有可见像素与alpha一致',async()=>{
 const ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'],stages=['found','clean','stabilized'];
 for(const id of ids){const digests=new Set<string>();for(const stage of stages){
  const base=`assets/runtime/visual-renewal/whole-states-v043/${id}-${stage}`;
  const png=await readFile(`${base}.png`);expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  const a=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(`${base}.webp`).ensureAlpha().raw().toBuffer();
  expect([a.info.width,a.info.height]).toEqual([384,384]);let mismatch=0;for(let i=0;i<a.data.length;i+=4)if(a.data[i+3]!==b[i+3]||(a.data[i+3]>0&&(a.data[i]!==b[i]||a.data[i+1]!==b[i+1]||a.data[i+2]!==b[i+2])))mismatch++;expect(mismatch).toBe(0);
  expect(a.data[3]).toBe(0);expect(a.data[(384*384-1)*4+3]).toBe(0);
  digests.add(createHash('sha256').update(a.data).digest('hex'));
 }expect(digests.size).toBe(3);}
});

test('真实入口一次只画一张完整图片，不请求切片或生成污层；坏实例可重试',async()=>{
 let failing:object|undefined;const requested:string[]=[];
 class ImageStub {src='';naturalWidth=384;naturalHeight=384;constructor(){failing??=this;}async decode(){requested.push(this.src);if(this===failing)throw Error('temporary-state-image-failure');}}
 vi.stubGlobal('Image',ImageStub);
 const m=await import('../src/fusion/curio-state-images');
 await expect(m.prepareCurioStateImages()).rejects.toThrow('temporary-state-image-failure');
 await expect(m.prepareCurioStateImages()).resolves.toBeUndefined();
 for(const id of ['receipt','tape','nested','stamp','cosmic-parcel','bell'] as const)for(const condition of m.curioImageStages){
  const drawImage=vi.fn();expect(m.drawWholeCurioState({drawImage} as unknown as CanvasRenderingContext2D,id,{condition},384)).toBe(true);
  expect(drawImage).toHaveBeenCalledTimes(1);expect(drawImage.mock.calls[0]).toEqual([m.curioStateImage(id,{condition}),0,0,384,384]);
 }
 expect(requested.every(url=>url.includes('whole-states-v043/')&&/-(?:found|clean|stabilized)\.webp(?:\?|$)/.test(url))).toBe(true);
 const count=requested.length;await m.prepareCurioStateImages();expect(requested.length).toBe(count);
});
