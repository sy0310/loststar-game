import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {describe,it,expect} from 'vitest';
import {shipViews,robotScannerSource} from '../src/render/motion';
import {firstPlanetFacilities} from '../src/fusion/facilities';

const path='assets/runtime/visual-renewal/world/';
const registration=JSON.parse(readFileSync(`${path}registration.json`,'utf8')) as {
 assets:{id:string;source:string;sourceSha256:string;runtime:string;sha256:string;width:number;height:number;views?:typeof shipViews;scanner?:typeof robotScannerSource}[];
};
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
describe('renewed production world materials',()=>{
 it('contains actual reproducible binaries with independent source artwork and matching declared dimensions/hashes',async()=>{
  expect(registration.assets).toHaveLength(36);
  for(const item of registration.assets){
   expect(item.source.startsWith('assets/source/visual-renewal/world/')).toBe(true);
   const source=readFileSync(item.source),runtime=readFileSync(item.runtime);
   expect(source.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
   expect(runtime.subarray(0,4).toString()).toBe('RIFF');
   expect(runtime.subarray(8,12).toString()).toBe('WEBP');
   expect(hash(source)).toBe(item.sourceSha256);expect(hash(runtime)).toBe(item.sha256);
   const metadata=await sharp(runtime).metadata();expect(metadata.width).toBe(item.width);expect(metadata.height).toBe(item.height);
  }
 });
 it('anchors every exhaust/noise axis and searchlight in actual visible hull pixels, with matching renderer registration',async()=>{
  const {data,info}=await sharp(`${path}ship-atlas.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const registered=registration.assets.find(item=>item.id==='ship-atlas')!;
  for(const view of shipViews){
   expect(registered.views?.[view.cell]).toMatchObject(view);
   for(const point of [view.anchor,view.nose,view.light]){
    const x=view.cell%2*256+point.x,y=Math.floor(view.cell/2)*256+point.y;
    expect(data[(y*info.width+x)*4+3],`view ${view.cell} actual hull contact ${point.x},${point.y}`).toBeGreaterThan(128);
   }
  }
 });
 it('keeps robot atlas gutters clear and synchronizes lens/door/tray contacts with the new material',async()=>{
  const {data,info}=await sharp(`${path}robot-atlas.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let frame=0;frame<8;frame++)for(let pixel=0;pixel<160;pixel++){
   const left=frame%4*160,top=Math.floor(frame/4)*160;
   for(const [x,y]of[[left+pixel,top],[left+pixel,top+159],[left,top+pixel],[left+159,top+pixel]])expect(data[(y*info.width+x)*4+3]).toBe(0);
  }
  expect(registration.assets.find(item=>item.id==='robot-atlas')?.scanner).toEqual(robotScannerSource);
  const opening=firstPlanetFacilities.reception.doorOpening,tray=firstPlanetFacilities.reception.unload.tray;
  expect(tray.x).toBeGreaterThan(Math.min(...opening.map(point=>point.x)));
  expect(tray.x).toBeLessThan(Math.max(...opening.map(point=>point.x)));
  expect(tray.y).toBeLessThan(firstPlanetFacilities.reception.anchor.y);
  expect(tray.y-Math.max(...opening.map(point=>point.y))).toBeLessThan(3);
 });
});
