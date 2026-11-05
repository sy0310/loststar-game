import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {ExpeditionScene,type SceneExtension} from '../src/render/scene';
import {newGame} from '../src/game/engine';

const requested:string[]=[];let failed='';
function installDom(){
 vi.stubGlobal('Image',class{
  srcValue='';onload?:()=>void;onerror?:()=>void;
  constructor(_width?:number,_height?:number){}
  set src(value:string){this.srcValue=value;requested.push(value);queueMicrotask(()=>{if(failed&&value.endsWith(failed))this.onerror?.();else this.onload?.();});}
  get src(){return this.srcValue;}
  decode(){return failed&&this.srcValue.endsWith(failed)?Promise.reject(Error('asset unavailable')):Promise.resolve();}
 });
 vi.stubGlobal('document',{visibilityState:'visible',createElement:()=>({dataset:{},isConnected:false,width:0,height:0,setAttribute(){},getContext:()=>({drawImage(){}})})});
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
}
function createScene(extension:Partial<SceneExtension>){
 const parent={dataset:{},append(canvas:HTMLCanvasElement){Object.assign(canvas,{parentElement:parent});},insertAdjacentText:vi.fn()} as unknown as HTMLElement;
 const state=newGame(1800000000000);
 const scene=new ExpeditionScene(parent,()=>state,{afterWorld(){},...extension});scene.setActive(true);
 return {scene,parent};
}
const legacyDay=(url:string)=>/\/(mouse|hermit|tagbird|sorter)\.webp$/.test(url);
beforeEach(()=>{requested.length=0;failed='';installDom();});
afterEach(()=>vi.unstubAllGlobals());
describe('scene texture ownership',()=>{
 it('does not request legacy day/cycle/sorter images for an explicitly independent Fusion renderer',async()=>{
  const {scene}=createScene({independentResidents:true,hideLegacySorter:true,drawResident:()=>({} as never)});
  await vi.waitFor(()=>expect(scene.ready).toBe(true));
  expect(requested.filter(legacyDay)).toEqual([]);expect(requested.some(url=>url.includes('/resident-cycle/'))).toBe(false);
  expect(requested.filter(url=>url.startsWith('data:'))).toHaveLength(1);
  const art=(scene as unknown as {art:{mouse:HTMLImageElement;hermit:HTMLImageElement;bird:HTMLImageElement;sorter:HTMLImageElement}}).art;
  expect(art.mouse).toBe(art.hermit);expect(art.mouse).toBe(art.bird);expect(art.mouse).toBe(art.sorter);
  expect(requested.some(url=>url.includes('visual-renewal/world/globe.webp'))).toBe(true);scene.destroy();
 });
 it('preserves legacy day/cycle/sorter loading when an old renderer only supplies drawResident',async()=>{
  const {scene}=createScene({drawResident:()=>({} as never)});
  await vi.waitFor(()=>expect(scene.ready).toBe(true));
  expect(requested.filter(legacyDay).map(url=>url.split('/').at(-1)).sort()).toEqual(['hermit.webp','mouse.webp','sorter.webp','tagbird.webp']);
  expect(requested.some(url=>url.includes('/resident-cycle/'))).toBe(true);scene.destroy();
 });
 it('still fails the scene when a critical new globe texture is unavailable',async()=>{
  failed='/globe.webp';const {scene,parent}=createScene({independentResidents:true,hideLegacySorter:true,drawResident:()=>({} as never)});
  await vi.waitFor(()=>expect(parent.dataset.error).toBe('true'));
  expect(scene.ready).toBe(false);expect(requested.filter(legacyDay)).toEqual([]);scene.destroy();
 });
});
