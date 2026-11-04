import {itemCenter, type Exhibit} from '../render/museum-layout';
import {drawLocalCurioRig} from './curio-local-rig';

export type CurioState={condition:'found'|'clean'|'stabilized';action?:{kind:'clean'|'repair';startedAt:number;endsAt:number}};
interface Material {
  original:HTMLCanvasElement;
  image:HTMLCanvasElement;
  solid:{x:number;y:number}[];
  anchor:{x:number;y:number};
  contacts:Map<number,{x:number;y:number}>;
  revision:string;
}
const materials=new WeakMap<HTMLImageElement,Material>();
const make=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=192;return canvas;};

function contact(solid:{x:number;y:number}[],x:number,y:number){
  let closest=solid[0]??{x:96,y:96};
  let distance=Infinity;
  for(const point of solid){const next=(point.x-x)**2+(point.y-y)**2;if(next<distance){distance=next;closest=point;}}
  return closest;
}

function materialFor(image:HTMLImageElement){
  const cached=materials.get(image);
  if(cached)return cached;
  const original=make(),context=original.getContext('2d')!;
  const scale=192/Math.max(image.naturalWidth,image.naturalHeight);
  context.drawImage(image,(192-image.naturalWidth*scale)/2,(192-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
  const alpha=context.getImageData(0,0,192,192).data;
  const solid:{x:number;y:number}[]=[];
  for(let y=0;y<192;y+=2)for(let x=0;x<192;x+=2)if(alpha[(y*192+x)*4+3]>220)solid.push({x,y});
  const value={original,image:make(),solid,anchor:contact(solid,123,116),contacts:new Map<number,{x:number;y:number}>(),revision:''};
  materials.set(image,value);return value;
}

/** Stable physical material is cached independently of the live joint pose. */
export function prepareCurioMaterial(image:HTMLImageElement,state:CurioState,now:number,id:string){
  const material=materialFor(image);
  const phase=state.action?Math.min(1,Math.max(0,(now-state.action.startedAt)/(state.action.endsAt-state.action.startedAt))):0;
  const revision=`${state.condition}/${state.action?.kind??''}/${state.action?Math.round(phase*90):0}`;
  if(material.revision!==revision){
    const painter=material.image.getContext('2d')!;
    painter.clearRect(0,0,192,192);painter.drawImage(material.original,0,0);
    if(state.condition==='found'){
      const colors=id==='stamp'?['#925d43','#b07d4a','#644347']:['#62594f','#a18d72','#776350'];
      painter.globalAlpha=.8;
      for(let i=0;i<35;i++){
        const x=(i*37+id.length*11)%172+10,y=(i*29+13)%172+10;
        if(state.action?.kind==='clean'&&x/192<phase)continue;
        painter.fillStyle=colors[i%colors.length];painter.fillRect(x,y,8+i%6,5+i%5);
      }
      painter.globalAlpha=1;
      painter.globalCompositeOperation='destination-in';painter.drawImage(material.original,0,0);painter.globalCompositeOperation='source-over';
    }
    const repaired=state.condition==='stabilized'?1:state.action?.kind==='repair'?phase:0;
    if(repaired>0){
      const anchor=material.anchor;
      painter.save();painter.globalAlpha=repaired;painter.translate(anchor.x,anchor.y);painter.fillStyle='#d4bc91';
      if(id==='tape')painter.fillRect(-10,0,17,4);
      else if(id==='nested'){painter.fillRect(-9,-5,5,13);painter.fillRect(-13,-1,13,4);}
      else if(id==='stamp'){painter.rotate(.5);painter.fillRect(-4,-9,6,18);}
      else if(id==='cosmic-parcel'){painter.rotate(-.4);painter.fillRect(-10,-2,20,5);}
      else if(id==='bell')painter.fillRect(-3,-6,6,12);
      painter.restore();
    }
    material.revision=revision;
  }
  return {...material,phase,size:192 as const};
}

export interface CurioPoseOptions {
  seconds?:number;
  trial?:number;
  reducedMotion?:boolean;
  serviceEnvelope?:number;
  drawAbility?:(context:CanvasRenderingContext2D,image:HTMLCanvasElement)=>boolean;
}

/** Registered specimen material and joint rig stay behind the foreground glass. */
export function drawCurioSpecimen(context:CanvasRenderingContext2D,exhibit:Exhibit,image:HTMLImageElement,state:CurioState,now:number,options:CurioPoseOptions={}){
  const material=prepareCurioMaterial(image,state,now,exhibit.id);
  const center=itemCenter(exhibit),size=exhibit.item.size*exhibit.scale;
  const seconds=options.seconds??now/1000;
  context.save();context.translate(center.x,center.y);context.scale(size/192,size/192);context.translate(-96,-96);
  if(!options.drawAbility?.(context,material.image))drawLocalCurioRig(context,exhibit.id,material.image,material.revision,seconds,(options.trial??0)*(options.serviceEnvelope??1),options.reducedMotion,options.serviceEnvelope??1);
  if(state.action){
    const index=Math.round(material.phase*90);
    let tip=material.anchor;
    if(state.action.kind==='clean'){
      tip=material.contacts.get(index)??contact(material.solid,25+material.phase*142,100+Math.sin(material.phase*Math.PI*6)*25);
      material.contacts.set(index,tip);
    }
    context.strokeStyle='#7e827b';context.lineWidth=3;context.beginPath();context.moveTo(171,160);context.lineTo(tip.x+18,tip.y-26);context.lineTo(tip.x,tip.y);context.stroke();
    context.save();context.translate(tip.x,tip.y);context.rotate(-.6);context.fillStyle='#b98c63';context.fillRect(-2,-29,5,25);
    context.fillStyle=state.action.kind==='clean'?'#d7c4a0':'#c1b9aa';context.fillRect(-7,-5,15,7);
    if(state.action.kind==='clean'){context.fillStyle='#e7d7b4';for(let i=0;i<6;i++)context.fillRect(-6+i*2,2,1,5);}context.restore();
  }
  context.restore();
}
