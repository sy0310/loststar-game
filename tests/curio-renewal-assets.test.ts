import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {expect,test} from 'vitest';
import {renewalCurioIds,renewalCurioRegistration} from '../src/fusion/curio-renewal-model';

/** Proves final cleaning cannot reveal an untouched alpha edge on state commit. */
test('18态是384独立透明实图，A/B全部实物像素由真实工具扫线覆盖',async()=>{
 for(const id of renewalCurioIds){
  for(const state of ['found','clean','stabilized']){
   const bytes=await readFile(`assets/runtime/visual-renewal/curios/${id}-${state}.png`),m=await sharp(bytes).metadata();
   expect(m.width).toBe(384);expect(m.height).toBe(384);expect(m.hasAlpha).toBe(true);
   if(state==='stabilized')continue;
   const data=await sharp(bytes).raw().toBuffer();let missed=0,opaque=0;
   for(let y=0;y<192;y++)for(let x=0;x<192;x++){
    if(data[((y*2)*384+x*2)*4+3]<129)continue;opaque++;
    const swept=renewalCurioRegistration[id].cleanPaths.some(([a,b])=>{
     const dx=b.x-a.x,dy=b.y-a.y,denominator=dx*dx+dy*dy;
     const t=denominator?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/denominator)):0;
     return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<=13.5;
    });if(!swept)missed++;
   }
   expect(opaque,`${id}/${state} must contain real specimen pixels`).toBeGreaterThan(3000);
   expect(missed,`${id}/${state}: untouched pixels would pop on commit`).toBe(0);
  }
 }
});
