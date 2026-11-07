import registry from '../../assets/runtime/visual-renewal/mechanisms-v042/static-registration.json';
import {mechanismFrame,mechanismDrawCommands,mechanismRibbonRegion,rasterMechanismRibbon,rasterMechanismSurface,type MechanismId,type MechanismOptions,type MechanismTexture} from './curio-mechanism-model';
import {renewalCurioRegistration} from './curio-renewal-model';
const urls=import.meta.glob('../../assets/runtime/visual-renewal/mechanisms-v042/*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const images=new Map<string,HTMLImageElement>();let ready:Promise<void>|undefined,loaded=false;
export function prepareCurioMechanisms():Promise<void>{
 if(!ready)ready=Promise.all(Object.entries(urls).map(async([path,url])=>{const key=path.split('/').at(-1)!.replace('.webp','');let image=images.get(key);if(!image){image=new Image();image.src=url;images.set(key,image);}try{await image.decode();}catch(error){if(images.get(key)===image)images.delete(key);throw error;}})).then(()=>{loaded=true;}).catch(error=>{ready=undefined;loaded=false;throw error;});
 return ready;
}
interface Meta{corrections:readonly number[];cleaning:number;revision:string}
const metadata=new WeakMap<object,Meta>();
export function registerMechanismMaterial(image:CanvasImageSource,meta:Meta){metadata.set(image,meta);}
export function mechanismMaterialMeta(image:CanvasImageSource):Meta{return metadata.get(image)??{corrections:[1,1],cleaning:1,revision:'default'};}
const entries=new Map(registry.assets.map(a=>[a.id,a]));
const canvas=(w:number,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const textures=new Map<string,MechanismTexture>();
function texture(key:string){let value=textures.get(key);if(!value){const image=images.get(key)!;const c=canvas(image.naturalWidth,image.naturalHeight),ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);value={width:c.width,height:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};textures.set(key,value);}return value;}
const band={key:'',canvas:undefined as HTMLCanvasElement|undefined,pixels:undefined as ImageData|undefined};
function ribbon(frame:ReturnType<typeof mechanismFrame>){
 if(!band.canvas){band.canvas=canvas(mechanismRibbonRegion.width,mechanismRibbonRegion.height);band.pixels=band.canvas.getContext('2d')!.createImageData(band.canvas.width,band.canvas.height);}
 const t=frame.tape!,key=[t.alignment,t.tension,t.length,t.curl].map(n=>Math.round(n*40)).join('/');
 if(key!==band.key){rasterMechanismRibbon(frame,texture('tape-band-face'),texture('tape-band-back'),texture('tape-band-tip'),band.pixels!.data);band.canvas.getContext('2d')!.putImageData(band.pixels!,0,0);band.key=key;}
 return band.canvas;
}
function part(c:CanvasRenderingContext2D,key:string,dy=0,raw=false){
 const image=images.get(key),entry=entries.get(key);if(!image?.naturalWidth||!entry)return;
 if(raw&&'matrix'in entry&&entry.matrix){c.transform(...entry.matrix as [number,number,number,number,number,number]);c.drawImage(image,0,0,entry.width,entry.height);return;}
 if(!entry.rect)return;const [x,y,w,h]=entry.rect;c.drawImage(image,x,y+dy,w,h);
}
const dirt=new Map<MechanismId,{key:string;canvas:HTMLCanvasElement}>();
function deposits(c:CanvasRenderingContext2D,id:MechanismId,progress:number,bandCanvas?:HTMLCanvasElement){
 if(progress>=1)return;const source=images.get(`${id}-deposits`);if(!source?.naturalWidth)return;
 let cached=dirt.get(id);if(!cached){cached={key:'',canvas:canvas(384)};dirt.set(id,cached);}
 // The surface beneath dirt is always opaque; only the independent dirt overlay is erased.
 const key=String(Math.round(progress*180))+(id==='tape'?`/${band.key}`:'');
 if(cached.key!==key){
  const d=cached.canvas.getContext('2d')!;d.setTransform(1,0,0,1,0,0);d.globalCompositeOperation='source-over';d.clearRect(0,0,384,384);d.drawImage(source,0,0,384,384);
  d.globalCompositeOperation='destination-out';d.strokeStyle='#000';d.lineCap='round';d.lineWidth=54;d.beginPath();
  for(const [i,[a,b]]of renewalCurioRegistration[id].cleanPaths.entries()){const p=Math.max(0,Math.min(1,(progress*8-i)/.72));if(p){d.moveTo(a.x*2,a.y*2);d.lineTo((a.x+(b.x-a.x)*p)*2,(a.y+(b.y-a.y)*p)*2);}}d.stroke();
  d.globalCompositeOperation='destination-in';if(id==='tape'&&bandCanvas)d.drawImage(bandCanvas,mechanismRibbonRegion.x,mechanismRibbonRegion.y);else part(d,'bell-shell');d.globalCompositeOperation='source-over';cached.key=key;
 }
 c.drawImage(cached.canvas,0,0);
}
export function drawCurioMechanism(c:CanvasRenderingContext2D,id:MechanismId,options:MechanismOptions&{cleaning?:number}={}){
 const frame=mechanismFrame(id,options);if(!loaded)return{frame,drawn:false};const bandCanvas=id==='tape'?ribbon(frame):undefined;
 c.save();c.scale(.5,.5);c.imageSmoothingEnabled=false;
 for(const command of mechanismDrawCommands(frame)){
  c.save();if(command.clip){c.beginPath();c.rect(...command.clip);c.clip();}if(command.polygon){c.beginPath();command.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();}if(command.matrix)c.transform(...command.matrix);
  if(command.key==='ribbon')c.drawImage(bandCanvas!,mechanismRibbonRegion.x,mechanismRibbonRegion.y);else part(c,command.key,command.dy,command.raw);
  c.restore();
 }
 deposits(c,id,options.cleaning??1,bandCanvas);
 if(frame.tape&&Math.abs(frame.tape.rollAngle)>.001){
  // A real paper winding-seam material moves on an oblique ellipse; the reel silhouette/highlight never rotates.
  const angle=2.45+frame.tape.rollAngle,x=237+Math.cos(angle)*47,y=137.15+Math.sin(angle)*93;
  c.save();c.translate(x,y);c.rotate(Math.atan2(Math.cos(angle)*93,-Math.sin(angle)*47));const face=images.get('tape-band-back')!;c.drawImage(face,face.naturalWidth*.4,face.naturalHeight*.2,3,face.naturalHeight*.55,-.8,-5,1.6,10);c.restore();
 }
 if(frame.bell&&frame.bell.ringEnergy>.01){c.save();c.globalAlpha=frame.bell.ringEnergy*.7;c.strokeStyle='#ffe0a0';c.lineWidth=1.4;for(let i=0;i<2;i++){const age=frame.trialTime-.65-i*.10;if(age<0)continue;c.beginPath();c.ellipse(198,278,85+age*23,20+age*7,0,Math.PI*.06,Math.PI*.94);c.stroke();}c.restore();}
 c.restore();return{frame,drawn:true};
}
export function drawMechanismForMaterial(c:CanvasRenderingContext2D,id:MechanismId,image:CanvasImageSource,options:MechanismOptions={}){
 const meta=mechanismMaterialMeta(image);return drawCurioMechanism(c,id,{...options,corrections:meta.corrections,cleaning:meta.cleaning});
}
/** Mechanical pad and carrying gripper share the exact physical contact returned by the same frame. */
export function mechanismActuatorGrip(id:MechanismId,frame:ReturnType<typeof mechanismFrame>){
 if(!frame.playing)return undefined;if(id==='tape')return{x:frame.tool.tip.x+8.64,y:frame.tool.tip.y+.60};
 const e=entries.get('mechanism-press-pad')!,contact=e.contact!,scale=21/e.width;
 return{x:frame.tool.tip.x+(e.width/2-contact.x)*scale,y:frame.tool.tip.y+(3-contact.y)*scale};
}
export function drawMechanismActuator(c:CanvasRenderingContext2D,id:MechanismId,frame:ReturnType<typeof mechanismFrame>){
 if(id!=='bell'||!frame.playing)return;const image=images.get('mechanism-press-pad')!,e=entries.get('mechanism-press-pad')!,contact=e.contact!,scale=21/e.width;
 c.drawImage(image,frame.tool.tip.x-contact.x*scale,frame.tool.tip.y-contact.y*scale,21,e.height*scale);
}

const appliedTapeCache=new Map<string,{canvas:HTMLCanvasElement;x:number;y:number}>();
/** Installed engineering tape uses the same independent tape material, never an assembled-curio crop. */
export function drawAppliedTape(c:CanvasRenderingContext2D,points:readonly {x:number;y:number}[],width=9){
 if(!loaded||points.length<2)return false;const key=JSON.stringify([points,width]);let cached=appliedTapeCache.get(key);
 if(!cached){const x=Math.floor(Math.min(...points.map(p=>p.x))-width),y=Math.floor(Math.min(...points.map(p=>p.y))-width),w=Math.ceil(Math.max(...points.map(p=>p.x))-x+width),h=Math.ceil(Math.max(...points.map(p=>p.y))-y+width),surface=canvas(w,h),ctx=surface.getContext('2d')!,pixels=ctx.createImageData(w,h);
  rasterMechanismSurface(points,texture('tape-band-face'),texture('tape-band-back'),texture('tape-band-tip'),pixels.data,{x,y,width:w,height:h},false,width/2,false);ctx.putImageData(pixels,0,0);cached={canvas:surface,x,y};if(appliedTapeCache.size>8)appliedTapeCache.clear();appliedTapeCache.set(key,cached);
 }
 c.drawImage(cached.canvas,cached.x,cached.y);return true;
}
