import {afterEach,it,expect,vi} from 'vitest';
import {createFusion} from '../src/fusion/domain';
import {createRenewalEngineering,renewalEngineeringPlacements} from '../src/render/renewal-engineering';
import {robotPose,shipPose} from '../src/render/motion';
import type {SceneFrame} from '../src/render/scene';

afterEach(()=>vi.unstubAllGlobals());
it('renders already-owned engineering rights immediately, with no fee, migration or ghost construction on a new save',async()=>{
 vi.stubGlobal('Image',class{src='';decode(){return Promise.resolve();}});
 const state=createFusion(1800000000000,null,{journey:true});
 const scene=createRenewalEngineering(()=>state.game);await scene.ready;
 const images:{src:string}[]=[];
 const noop=()=>{};
 const context=new Proxy({drawImage(image:{src:string}){images.push(image);}},{get(target,key){return key in target?target[key as keyof typeof target]:noop;},set(){return true;}}) as unknown as CanvasRenderingContext2D;
 const frame:SceneFrame={t:1,robot:robotPose(.1),ship:shipPose(1),globe:{} as HTMLImageElement,output:{dataset:{}} as HTMLCanvasElement,environment:{period:'day',seconds:1,light:0,rest:0}};
 expect(scene.entities(context,frame)).toEqual([]);
 state.game.resources=27049;state.game.growth={dock:3,receiver:2,'repair-bay':2,drive:1};
 const before=JSON.stringify(state);
 const entities=scene.entities(context,frame);expect(entities.map(item=>item.depth)).toEqual(renewalEngineeringPlacements.map(item=>item.anchor.y));
 entities.forEach(item=>item.draw());
 expect(images.map(image=>image.src.split('/').at(-1))).toEqual(['engineering-dock.webp','engineering-receiver.webp','engineering-repair-bay.webp','engineering-drive.webp']);
 expect(JSON.stringify(state)).toBe(before);
});
