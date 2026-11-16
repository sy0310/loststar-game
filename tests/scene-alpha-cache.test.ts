import {describe,expect,it,vi} from 'vitest';
import {cachedSceneAlphaMask} from '../src/render/scene';

describe('scene canvas alpha revision',()=>{
  it('reuses immutable masks and reads changed fog pixels only when a pick asks for the new revision',()=>{
    let alpha=new Uint8Array([255,255]);
    const read=vi.fn(()=>alpha.slice());
    const first=cachedSceneAlphaMask(undefined,'1',read);
    alpha[0]=0;
    expect(cachedSceneAlphaMask(first,'1',read)).toBe(first);
    expect(read).toHaveBeenCalledTimes(1);
    const revealed=cachedSceneAlphaMask(first,'2',read);
    expect(revealed.mask[0]).toBe(0);expect(first.mask[0]).toBe(255);
    expect(cachedSceneAlphaMask(revealed,'2',read)).toBe(revealed);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('preserves legacy cache behavior for images without an explicit hit revision',()=>{
    const read=vi.fn(()=>new Uint8Array([1]));
    const first=cachedSceneAlphaMask(undefined,undefined,read);
    expect(cachedSceneAlphaMask(first,undefined,read)).toBe(first);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
