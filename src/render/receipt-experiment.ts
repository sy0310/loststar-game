import type {ReceiptExperimentFrame} from '../review/receipt-reading';

type Point={x:number;y:number};
type Rect=Point&{width:number;height:number};
type Row={left:number;right:number}|null;
type Surface={canvas:HTMLCanvasElement;context:CanvasRenderingContext2D};
const SIZE=256;
const clamp=(value:number)=>Math.max(0,Math.min(1,value));

export function receiptUnfoldGeometry(
  options:{center:Point;frame:number;receiverY:number;curlV:number;hinge:Point},
  opening:number,
){
  const {center,frame,receiverY,curlV,hinge}=options;
  const top=center.y-frame/2;
  const idleBottom=center.y+frame/2;
  const extension=Math.min(15,Math.max(0,receiverY-3-idleBottom))*clamp(opening);
  return {top,bottom:idleBottom+extension,splitY:center.y+(curlV-.5)*frame,extension,hinge};
}

function surface(width=SIZE,height=SIZE):Surface{
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  return {canvas,context:canvas.getContext('2d')!};
}

/** The inner face is an edited, unprinted layer of this same receipt. */
export function prepareReceiptInnerPaper(source:HTMLCanvasElement,face:Rect,curlV:number){
  const original=source.getContext('2d')!.getImageData(0,0,SIZE,SIZE);
  const cleaned=original;
  const inner=surface(),grain=surface(),extension=surface();
  inner.context.putImageData(cleaned,0,0);
  const top=Math.floor(face.y+face.height*.45),height=Math.min(80,Math.floor(face.height*.45));
  let left=0,right=SIZE;
  for(let y=top;y<top+height;y++){
    let first=0,last=SIZE-1;
    while(first<SIZE&&original.data[(y*SIZE+first)*4+3]<240)first++;
    while(last>first&&original.data[(y*SIZE+last)*4+3]<240)last--;
    left=Math.max(left,first+5);right=Math.min(right,last-5);
  }
  grain.context.imageSmoothingEnabled=false;
  grain.context.drawImage(inner.canvas,left,top,right-left,height,0,0,SIZE,SIZE);
  const rowBounds=(y:number)=>{
    let left=0,right=SIZE-1;
    while(left<SIZE&&original.data[(y*SIZE+left)*4+3]<16)left++;
    while(right>left&&original.data[(y*SIZE+right)*4+3]<16)right--;
    return {left,right};
  };
  const cut=Math.floor(curlV*SIZE),edge=rowBounds(cut);
  const pixels=new ImageData(SIZE,SIZE);
  for(let y=0;y<SIZE;y++){
    const sourceY=cut-1-Math.round(Math.sin(Math.PI*y/(SIZE-1))*12);
    const available=rowBounds(sourceY);
    for(let x=edge.left;x<=edge.right;x++){
      const sourceX=Math.max(available.left+1,Math.min(available.right-1,x));
      const sourceIndex=(sourceY*SIZE+sourceX)*4,target=(y*SIZE+x)*4;
      for(let channel=0;channel<4;channel++)pixels.data[target+channel]=cleaned.data[sourceIndex+channel];
    }
  }
  extension.context.putImageData(pixels,0,0);
  return {inner,grain,extension};
}

/** Inner-page glyphs are painted before the same lighting and paper deformation pass. */
export function paintReceiptInnerContent(
  target:Surface,
  material:HTMLCanvasElement,
  face:Rect,
  hingeX:number,
  profile:Row[],
  foldY:number,
  frame:ReceiptExperimentFrame,
){
  const c=target.context;
  c.clearRect(0,0,SIZE,SIZE);
  c.drawImage(material,0,0);
  const top=face.y+23;
  const safeRow=(y:number,height:number)=>{
    let left=face.x+4,right=Math.min(face.x+face.width-4,hingeX-5);
    for(let row=Math.max(0,Math.floor(y-16));row<Math.min(SIZE,y+height);row++){
      const shape=profile[row];
      if(shape){left=Math.max(left,shape.left+4);right=Math.min(right,shape.right-4);}
    }
    return {left,width:Math.max(25,right-left)};
  };
  const heading=safeRow(top,2);
  c.save();
    c.beginPath();
    c.rect(face.x,face.y,face.width,face.height);
    c.clip();
  c.globalCompositeOperation='source-atop';
  c.fillStyle='#6d3d3f';
    c.font='bold 16px monospace';
    c.textAlign='left';
  c.globalAlpha=clamp(frame.open*4);
  c.fillText(['好奇心','第一折','内夹层','未发生'][frame.reading.researchLevel],heading.left,top,heading.width);
  const rendered:string[]=[];
  if(frame.reading.researchLevel===0){
    c.font='15px monospace';
    c.globalAlpha=frame.reveal;
    const row=safeRow(top+32,2);
    c.fillText('欢迎光临',row.left,top+32,row.width);
  }
  const fold=clamp((frame.check-.30)/.5);
  let removedBefore=0;
  frame.reading.lines.forEach((line,index)=>{
    const completed=frame.reading.researchLevel===3&&line.status==='complete';
    const rowFold=completed?fold:0;
    const alpha=clamp(frame.reveal*frame.reading.lines.length-index)*(1-rowFold);
    const y=top+31+index*41-removedBefore*41*fold;
    const {left,width}=safeRow(y,30);
    c.save();
    c.translate(left+width,y);
    c.scale(Math.max(.001,1-rowFold),1-rowFold*.25);
    c.translate(-width,0);
    c.globalAlpha=alpha;
    const statusWidth=line.nextStepLabel?38:0;
    c.fillStyle='#6d3d3f';
    c.font='bold 16px monospace';
    c.fillText(line.paperTitle,0,0,width-statusWidth-(statusWidth?4:0));
    if(line.nextStepLabel){
      c.fillStyle='#975540';
    c.font='12px monospace';
    c.textAlign='right';
      c.fillText(line.nextStepLabel,width,0,statusWidth);
    c.textAlign='left';
    }
    if(line.address){c.font='13px monospace';
    c.fillText(line.address.split('·').at(-1)!,0,17,width);}
    c.restore();
    if(alpha>.02&&rowFold<.98)rendered.push(line.id);
    if(completed)removedBefore++;
  });
  if(frame.reading.researchLevel===3){
    c.globalAlpha=frame.stamp;
    c.font='bold 15px monospace';
    c.fillStyle='#995d37';
    const y=Math.min(face.y+face.height-2,foldY+18),row=safeRow(y,2);
    c.fillText(`未发生${frame.reading.pendingCount}项`,row.left,y,row.width);
  }
  c.restore();
  return rendered;
}

export function drawReceiptUnfold(
  c:CanvasRenderingContext2D,
  options:{center:Point;frame:number;receiverY:number},
  frame:ReceiptExperimentFrame,
  materials:{outer:HTMLCanvasElement;inner:HTMLCanvasElement;extension:HTMLCanvasElement;profile:Row[];curlV:number;hinge:Point},
  rig:{nodes:Point[]},
  drawPaper:(image:HTMLCanvasElement)=>void,
){
  const geometry=receiptUnfoldGeometry({...options,curlV:materials.curlV,hinge:materials.hinge},frame.open);
  const half=options.frame/2,overlap=options.frame/SIZE;
  const bandPosition=materials.curlV*(rig.nodes.length-1);
  const band=Math.min(rig.nodes.length-2,Math.floor(bandPosition)),fraction=bandPosition-band;
  const cutX=rig.nodes[band].x+(rig.nodes[band+1].x-rig.nodes[band].x)*fraction;
  const splitY=options.center.y+rig.nodes[band].y+(rig.nodes[band+1].y-rig.nodes[band].y)*fraction;
  c.save();
    c.beginPath();
    c.rect(options.center.x-half,geometry.top,options.frame,splitY-geometry.top+overlap);
    c.clip();
  drawPaper(materials.inner);
    c.restore();
  const cutRow=Math.floor(materials.curlV*SIZE);
  const row=materials.profile[cutRow]??{left:30,right:220};
  const above=materials.profile[Math.max(0,cutRow-8)]??row;
  const slope=Math.max(-.16,Math.min(.16,((row.left+row.right)-(above.left+above.right))/16));
  const capShift=geometry.extension*slope;
  if(geometry.extension>0){
    c.save();
    c.transform(options.frame/SIZE,0,capShift/SIZE,(geometry.extension+overlap*2)/SIZE,
      options.center.x-half+cutX,splitY-overlap);
    c.drawImage(materials.extension,0,0);
    c.restore();
  }
  c.save();
    c.beginPath();
    c.rect(options.center.x-half,splitY+geometry.extension-overlap,options.frame,options.frame);
    c.clip();
  c.translate(capShift,geometry.extension);
    drawPaper(materials.inner);
    c.restore();
  const fullOpening=[.30,.55,1,1][frame.reading.researchLevel];
  const faceOpening=frame.reading.researchLevel===0?frame.open:frame.open/fullOpening;
  const frontScale=Math.cos(clamp(faceOpening)*Math.PI/2);
  if(frontScale>.001){
    c.save();
    c.translate(materials.hinge.x,0);
    c.scale(frontScale,1);
    c.translate(-materials.hinge.x,0);
    drawPaper(materials.outer);
    c.restore();
  }
  return {...geometry,capShift};
}

export function drawReceiptTicket(c:CanvasRenderingContext2D,center:Point,receiverY:number,grain:HTMLCanvasElement,frame:ReceiptExperimentFrame){
  if(frame.ticket<=0)return;
  const width=30,height=6,left=center.x-15,top=receiverY-height;
  c.save();
    c.beginPath();
    c.rect(left,top,width*frame.ticket,height);
    c.clip();
  c.drawImage(grain,0,0,SIZE,SIZE,left,top,width,height);
  c.strokeStyle='rgba(132,86,65,.5)';
    c.lineWidth=.35;
    c.strokeRect(left,top,width,height);
  c.fillStyle='#77413e';
    c.font='3.1px monospace';
    c.textAlign='center';
  c.fillText(frame.reading.ticketLines[0],center.x,top+4.2,width-3);
    c.restore();
}
