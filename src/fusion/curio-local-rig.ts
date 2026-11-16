import {drawPhysicalCurioRig} from './curio-material';
interface Point {x:number; y:number}
interface PartLayers {key:string; body:HTMLCanvasElement; part:HTMLCanvasElement; shadow:HTMLCanvasElement}
const layers=new WeakMap<HTMLCanvasElement,PartLayers>();
const outlines:Record<string,Point[]>={
  nested:[{x:76,y:48},{x:96,y:39},{x:115,y:48},{x:115,y:84},{x:96,y:96},{x:76,y:85}],
  stamp:[{x:74,y:108},{x:86,y:66},{x:81,y:50},{x:87,y:20},{x:109,y:6},{x:137,y:6},{x:156,y:22},{x:154,y:49},{x:140,y:69},{x:123,y:123}],
  'cosmic-parcel':[{x:2,y:56},{x:29,y:9},{x:146,y:0},{x:188,y:38},{x:187,y:72},{x:74,y:111},{x:3,y:84}],
  bell:[{x:0,y:0},{x:192,y:0},{x:192,y:143},{x:0,y:143}],
};

function partLayers(image:HTMLCanvasElement,id:string,revision:string){
  const key=`${id}/${revision}`;
  const previous=layers.get(image);
  if(previous?.key===key)return previous;
  const make=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=192;return canvas;};
  const body=previous?.body??make(),part=previous?.part??make(),shadow=previous?.shadow??make();
  for(const canvas of [body,part,shadow]){const context=canvas.getContext('2d')!;context.globalCompositeOperation='source-over';context.clearRect(0,0,192,192);}
  const c=part.getContext('2d')!;
  c.drawImage(image,0,0);c.globalCompositeOperation='destination-in';c.beginPath();
  for(const [index,point]of outlines[id].entries()){if(index)c.lineTo(point.x,point.y);else c.moveTo(point.x,point.y);}c.closePath();c.fill();
  const b=body.getContext('2d')!;b.drawImage(image,0,0);b.globalCompositeOperation='destination-out';b.drawImage(part,0,0);
  const s=shadow.getContext('2d')!;s.drawImage(part,0,0);s.globalCompositeOperation='source-in';s.fillStyle=id==='cosmic-parcel'?'#382947':'#694b46';s.fillRect(0,0,192,192);
  const value={key,body,part,shadow};layers.set(image,value);return value;
}

/** Only the authored joint moves. The surrounding specimen keeps its registered support. */
export function drawLocalCurioRig(c:CanvasRenderingContext2D,id:string,image:HTMLCanvasElement,revision:string,seconds:number,trial:number,reduced=false,serviceEnvelope=1,stability=1){
  if(drawPhysicalCurioRig(c,id,image,seconds,trial,reduced,serviceEnvelope))return;
  if(!outlines[id]){c.drawImage(image,0,0);return;}
  const pieces=partLayers(image,id,revision);
  const active=trial>0&&trial<1?Math.sin(trial*Math.PI):0;
  const idle=Math.sin(seconds*(id==='bell'?1.7:1.1));
  const amplitude=(reduced?.35:1)*serviceEnvelope*(1+(1-stability)*.45);
  c.drawImage(pieces.shadow,0,0);c.drawImage(pieces.body,0,0);
  c.save();
  if(id==='nested')c.translate(0,-(4+idle*4)*amplitude-active*19*serviceEnvelope);
  else if(id==='stamp'){
    c.translate(82,137);c.rotate((idle*.045+active*.095)*amplitude);c.translate(-82,-137+active*3);
  }else if(id==='cosmic-parcel'){
    c.translate(179,68);c.rotate(-(idle*.028+active*.075)*amplitude);c.translate(-179,-68-active*5);
  }else{
    c.fillStyle='#b78c56';c.fillRect(91,137,5,13);c.fillStyle='#e3b76e';c.fillRect(87+idle*2,146,13,5);
    c.translate(95,139);c.rotate((idle*.055+Math.sin(trial*Math.PI*8)*active*.11)*amplitude);c.translate(-95,-139);
  }
  c.drawImage(pieces.part,0,0);c.restore();
  if(id==='cosmic-parcel'){
    c.save();c.globalCompositeOperation='screen';c.globalAlpha=.25+active*.45;c.strokeStyle='#c9acf3';c.lineWidth=1;
    c.beginPath();c.moveTo(21,88);c.lineTo(74,111);c.lineTo(177,76);c.stroke();c.restore();
  }
  if(id==='bell'&&active>0){
    c.save();c.strokeStyle='#d9e9c3';c.lineWidth=1.5;c.globalAlpha=active*.8;
    for(let index=0;index<2;index++){const wave=(trial*2+index*.5)%1;c.beginPath();c.ellipse(96,135,20+wave*60,6+wave*16,0,0,Math.PI*2);c.stroke();}c.restore();
  }
}
