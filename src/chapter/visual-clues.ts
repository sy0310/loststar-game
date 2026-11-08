import type {ChapterSave} from './model';

/** The same fictional return impression appears on the receipt and the stamp's trial paper. */
export function drawChapterPostmark(c:CanvasRenderingContext2D,x:number,y:number,r=18){
 c.save();c.translate(x,y);c.strokeStyle='#8b4e89';c.fillStyle='#8b4e89';c.lineWidth=2;
 c.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6,px=Math.round(Math.cos(a)*r),py=Math.round(Math.sin(a)*r);if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.stroke();
 c.beginPath();c.moveTo(r*.5,-r*.25);c.lineTo(-r*.45,-r*.25);c.lineTo(-r*.45,r*.35);c.lineTo(r*.25,r*.35);c.stroke();
 c.beginPath();c.moveTo(-r*.45,-r*.25);c.lineTo(-r*.05,-r*.62);c.moveTo(-r*.45,-r*.25);c.lineTo(-r*.05,r*.08);c.stroke();c.restore();
}

/** Reading marks, not replacement state art or financial/signature evidence. */
export function mountChapterClues(get:()=>ChapterSave){
 const image=document.querySelector<HTMLImageElement>('#lt-image')!;
 const canvas=document.createElement('canvas');canvas.id='chapter-object-clues';canvas.width=canvas.height=384;
 canvas.setAttribute('role','img');document.querySelector('.lt-picture')!.append(canvas);
 const c=canvas.getContext('2d')!;let previous='';
 function label(text:string,x:number,y:number,anchor:{x:number;y:number}){
  c.font='bold 16px sans-serif';const w=Math.ceil(c.measureText(text).width)+16;
  c.strokeStyle='#d8bd88';c.lineWidth=2;c.beginPath();c.moveTo(anchor.x,anchor.y);c.lineTo(x+w/2,y-9);c.lineTo(x+w/2,y);c.stroke();
  c.fillStyle='#d8bd88';c.fillRect(anchor.x-3,anchor.y-3,6,6);
  c.fillStyle='#30283ef5';c.fillRect(x,y,w,29);c.strokeStyle='#93809e';c.strokeRect(x+1,y+1,w-2,27);
  c.fillStyle='#f1dfbb';c.fillText(text,x+8,y+20);
 }
 function refresh(){
  const dialog=document.querySelector<HTMLDialogElement>('#refui-treatment')!,key=image.dataset.stateImage??'',id=key.replace(/-(found|clean|stabilized)\.webp$/,''),condition=key.includes('-found.')?'found':key.includes('-clean.')?'clean':'stabilized';
  const hidden=!dialog.open||dialog.dataset.materialReady!=='true'||dialog.dataset.preview==='true'||image.hidden||image.dataset.ready!=='true'||!['receipt','stamp','cosmic-parcel'].includes(id);
  const next=[key,hidden,get().game.collection.includes('receipt')].join('/');if(next===previous)return;previous=next;
  canvas.hidden=hidden;if(hidden)return;
  c.clearRect(0,0,384,384);c.imageSmoothingEnabled=false;c.globalAlpha=1;c.setTransform(1,0,0,1,0,0);
  let clue='';
  if(id==='receipt'){
   c.save();c.globalAlpha=condition==='found'?.62:.86;drawChapterPostmark(c,110,299,18);c.restore();
   if(condition==='found'){
    label('票角的旧印记',6,342,{x:110,y:299});clue='票角的旧印记';
   }else{
    // Printed in the existing blank paper area, away from RET-031/P03 and the unsigned box.
    c.save();c.translate(181,204);c.rotate(condition==='clean'?-.018:0);c.fillStyle='#814079';c.font='12px sans-serif';c.fillText('购买日期',0,0);c.font='bold 22px sans-serif';c.fillText('明天',0,25);c.restore();
    label('日期没写错？',7,342,{x:205,y:222});clue='购买日期：明天';
   }
  }else if(id==='stamp'){
   label('印模：昨天',255,177,{x:199,y:307});clue='印模：昨天';
   if(get().game.collection.includes('receipt')){c.strokeStyle='#deb977';c.lineWidth=2;c.strokeRect(119,274,117,58);}
  }else{
   if(condition==='found'){label('箱缝里的星',217,342,{x:244,y:181});clue='箱缝里的星';}
   else{label('封签：明日寄出',6,337,{x:162,y:215});clue='封签：明日寄出';}
  }
  canvas.dataset.clue=clue;canvas.dataset.item=id;canvas.dataset.condition=condition;
  canvas.setAttribute('aria-label','物件阅读标注：'+clue+'；不是签收凭证');
 }
 return{refresh};
}
