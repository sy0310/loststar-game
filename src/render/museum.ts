import robotAtlasUrl from '../../assets/runtime/robot-empty-v3.webp';
import {baseRobotPose} from './base-motion';
import roomUrl from '../../assets/runtime/museum-room-v02.webp';
import {textures} from '../ui/art';
import {discoveryById} from '../content/catalog';
import type {ArtId} from '../content/types';
const habitatUrls=import.meta.glob('../../assets/runtime/habitat-*-v02.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const layers=import.meta.glob('../../assets/runtime/case-*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
export const exhibitIds=['receipt','tape','nested','stamp','cosmic-parcel','bell'] as const;
export const residentIds=['mouse','hermit','tagbird'] as const;
export const exhibits=exhibitIds.map((id,i)=>({id,x:[.23,.50,.79,.20,.50,.81][i],y:i<3?.555:.821,w:i<3?198:216}));
export type MuseumSource={collection:string[]};
function image(url:string){const img=new Image();img.src=url;return img;}
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement|undefined,x:number,y:number,w:number,h=w){if(img?.complete&&img.naturalWidth)c.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
/** Actual rear glass → moving specimen → front glass → independent nameplate. */
export class MuseumScene {
 readonly canvas=document.createElement('canvas');ready:Promise<void>;
 private c:CanvasRenderingContext2D|null;private active=false;private last=0;private frames=0;
 private room=image(roomUrl);private robot=image(robotAtlasUrl);private pose=baseRobotPose(0);private art=Object.fromEntries(exhibitIds.map(id=>[id,image(textures[id])]));
 private glass=Object.fromEntries(exhibitIds.map(id=>[id,[image(layers[`../../assets/runtime/case-${id}-back.webp`]),image(layers[`../../assets/runtime/case-${id}-front.webp`])]]));
 constructor(private root:HTMLElement,private source:()=>MuseumSource,private level:(id:string)=>number=()=>0,private clock:()=>number=()=>performance.now()/1000){
  root.classList.add('museum-room');this.canvas.id='museum-canvas';this.canvas.width=768;this.canvas.height=960;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','失物收藏室：六个独立玻璃容器，藏品在玻璃内轻轻活动');root.append(this.canvas);this.c=this.canvas.getContext('2d');
  const hits=document.createElement('div');hits.className='exhibit-hits';hits.innerHTML=exhibits.map(({id,x,y,w})=>`<button data-exhibit="${id}" data-detail="${id}" style="left:${(x-w/768/2)*100}%;top:${(y-w/960)*100}%;width:${w/768*100}%;height:${w/960*100}%"></button>`).join('');root.append(hits);this.ready=this.load();requestAnimationFrame(this.loop);
 }
 async load(){this.root.dataset.loading='true';try{await Promise.all([this.robot,this.room,...Object.values(this.art),...Object.values(this.glass).flat()].map(i=>i.decode()));this.canvas.dataset.ready='true';this.draw(this.clock());this.refresh();}catch{this.canvas.dataset.ready='error';this.root.setAttribute('aria-label','收藏室暂未接通，请返回后重试');}finally{this.root.dataset.loading='false';}}
 mount(parent:HTMLElement){parent.append(this.root);}
 async retry(){for(const img of [this.robot,this.room,...Object.values(this.art),...Object.values(this.glass).flat()]){const url=new URL(img.src);url.searchParams.set('retry',String(Date.now()));img.src=url.href;}this.ready=this.load();await this.ready;}
 refresh(){for(const id of exhibitIds){const b=this.root.querySelector<HTMLButtonElement>(`[data-exhibit="${id}"]`)!;const known=this.source().collection.includes(id);b.disabled=!known;b.setAttribute('aria-label',known?`放大${discoveryById(id)!.name}`:'空展柜，等待下一次发现');}}
 setActive(value:boolean){this.active=value;this.refresh();if(value)this.draw(this.clock());}
 private loop=(ms:number)=>{if(this.active&&!document.hidden&&ms-this.last>=(matchMedia('(prefers-reduced-motion: reduce)').matches?100:50)){this.last=ms;this.draw(this.clock());}requestAnimationFrame(this.loop);};
 private draw(t:number){const c=this.c;if(!c||!this.room.complete||!this.room.naturalWidth)return;c.clearRect(0,0,768,960);c.imageSmoothingEnabled=false;sprite(c,this.room,0,0,768,960);
  // Tiny free-floating dust and lamplight are part of the room, never the whole background moving.
  for(let i=0;i<16;i++){const x=(i*127+Math.sin(t*.18+i)*10)%740+14,y=110+(i*61+t*3)%620;c.fillStyle=`rgba(255,218,148,${.15+.15*Math.sin(t+i)})`;c.fillRect(Math.round(x),Math.round(y),2,2);}
  this.pose=baseRobotPose(t);const entities=exhibits.map(e=>({depth:e.y*960,draw:()=>this.case(c,e,t)}));entities.push({depth:this.pose.y,draw:()=>this.drawRobot(c,t)});entities.sort((a,b)=>a.depth-b.depth).forEach(e=>e.draw());
  this.canvas.dataset.robotX=String(Math.round(this.pose.x));this.canvas.dataset.robotY=String(Math.round(this.pose.y));this.canvas.dataset.robotAction=this.pose.action;this.canvas.dataset.robotTarget=this.pose.target;
  this.root.dispatchEvent(new CustomEvent('robot-state',{detail:this.pose}));
  const lights=this.level('light');if(lights){c.fillStyle=`rgba(255,207,124,${.035*lights})`;c.fillRect(0,0,768,960);}
  if(this.level('deco-0')){c.fillStyle='#ffe9ae';for(let i=0;i<12;i++)c.fillRect(34+i*62,163+(i%2)*7,4,4);}
  if(this.level('deco-1')){c.fillStyle='#7dbd9b';for(let i=0;i<9;i++)c.fillRect(25+i*4,710-Math.sin(i)*18,5,8);}
  if(this.level('deco-2')){c.fillStyle='#cf9beb';c.fillRect(580,236,56,27);c.fillStyle='#fff0c9';c.font='16px monospace';c.fillText('LR–01',584,255);}
  if(this.level('deco-3')){c.strokeStyle='#ffdc8b';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.arc(55,285,22+i*9,t*.1,t*.1+Math.PI*1.5);c.stroke();}}
  this.canvas.dataset.frame=String(++this.frames);
 }
 private drawRobot(c:CanvasRenderingContext2D,t:number){const p=this.pose,moving=p.action==='walk'||p.action==='return',frame=moving?Math.floor(t*8)%4:p.action==='observe'?4:p.lift>.8?6:p.action==='wipe'?7:5,w=p.width,feet=[149,147,149,148,148,148,149,149][frame];
  c.save();c.translate(p.x,p.y);c.fillStyle='#100c2880';c.beginPath();c.ellipse(0,1,32,7,0,0,Math.PI*2);c.fill();if(p.facing>0)c.scale(-1,1);c.drawImage(this.robot,frame%4*160,Math.floor(frame/4)*160,160,160,-w/2,-feet/160*w,w,w);c.restore();
  if(p.opening>0){const end=p.lift>0?p.item:{x:exhibits.find(e=>e.id===p.target)!.x*768,y:exhibits.find(e=>e.id===p.target)!.y*960-30};c.strokeStyle='#a3c5b1';c.lineWidth=4;c.beginPath();c.moveTo(p.hand.x,p.hand.y);c.lineTo((p.hand.x+end.x)/2,end.y+20);c.lineTo(end.x,end.y);c.stroke();c.fillStyle='#ffe5a6';c.fillRect(end.x-4,end.y-4,8,8);}
  if(p.lift>0&&this.source().collection.includes(p.target)){const e=exhibits.find(e=>e.id===p.target)!;const size=e.w*.45*(1-p.lift)+48*p.lift;sprite(c,this.art[p.target as typeof exhibitIds[number]],p.item.x-size/2,p.item.y-size/2,size);}
 }

 renderExhibit(canvas:HTMLCanvasElement,id:string,level:number){const e=exhibits.find(e=>e.id===id);if(!e||this.canvas.dataset.ready!=='true')return;const c=canvas.getContext('2d');if(!c)return;c.imageSmoothingEnabled=false;c.fillStyle='#201a32';c.fillRect(0,0,canvas.width,canvas.height);c.save();c.translate(canvas.width/2,canvas.height-48);this.case(c,{...e,x:0,y:0,w:Math.min(canvas.width*.88,canvas.height-68)},0,level);c.restore();canvas.dataset.ready='true';canvas.dataset.level=String(level);}
 private case(c:CanvasRenderingContext2D,e:typeof exhibits[number],t:number,forcedLevel?:number){
  const service=forcedLevel===undefined&&this.pose.target===e.id?this.pose:null;const x=e.x*768,y=e.y*960,w=e.w,known=this.source().collection.includes(e.id),level=forcedLevel??this.level(`case-${exhibitIds.indexOf(e.id)}`),[back,front]=this.glass[e.id];
  c.save();c.translate(x,y);c.fillStyle='#120d2880';c.beginPath();c.ellipse(0,-3,w*.30,10,0,0,Math.PI*2);c.fill();sprite(c,back,-w/2,-w,w,w);
  if(level){c.strokeStyle=['','#ffe0a0','#9ce9e1','#e6b2ff'][level];c.lineWidth=level===3?3:2;c.beginPath();c.ellipse(0,-w*.13,w*.27,9,0,0,Math.PI*2);c.stroke();}
  c.save();c.beginPath();c.rect(-w*.32,-w*.82,w*.64,w*.65);c.clip();
  if(known&&!(service&&service.lift>0)){
   if(level){for(let ring=0;ring<3;ring++){c.fillStyle=level===3?'#c8a7ef20':'#ffe2a120';c.beginPath();c.ellipse(0,-w*(.22+ring*.045),w*(.20-ring*.025),w*.035,0,0,Math.PI*2);c.fill();}}
   const phase=t+exhibitIds.indexOf(e.id),bob=Math.sin(phase*1.4)*2,iw=e.id==='cosmic-parcel'?w*.39:e.id==='stamp'?w*.35:w*.45;
   c.save();c.translate(0,-w*.49+bob);
   switch(e.id){
    case 'receipt':c.rotate(Math.sin(t*.8)*.035);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.fillStyle='#ffeab9';for(let i=0;i<3;i++)c.fillRect(-12+i*10,iw*.25+(t*6+i*7)%16,3,2);break;
    case 'tape':c.rotate(Math.sin(t)*.04);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle='#f5cc7a';c.lineWidth=3;c.beginPath();c.moveTo(10,iw*.24);c.lineTo(15+Math.sin(t*1.4)*5,iw*.38);c.lineTo(28,iw*.4);c.stroke();break;
    case 'nested':sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle='#dfb5fb';c.strokeRect(-9,-iw*.36-Math.sin(t*1.3)**2*10,18,13);break;
    case 'stamp':c.translate(0,-Math.max(0,Math.sin(t*1.8))*5);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.fillStyle='#b982da88';c.fillRect(-14,iw*.38,28,3);break;
    case 'cosmic-parcel':c.rotate(Math.sin(t*.7)*.02);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle='#b1d9fd';c.beginPath();c.ellipse(0,0,iw*.54,iw*.19,Math.sin(t*.6)*.4,0,Math.PI*2);c.stroke();break;
    case 'bell':c.rotate(Math.sin(t*1.5)*.07);sprite(c,this.art[e.id],-iw/2,-iw/2,iw);c.strokeStyle=`rgba(255,224,153,${1-t%2/2})`;c.beginPath();c.ellipse(0,iw*.25,10+t%2*15,3+t%2*4,0,0,Math.PI*2);c.stroke();break;
   }
   c.restore();
   if(level>=2){for(let i=0;i<4;i++){c.fillStyle='#fff3b0';c.fillRect(Math.sin(t*.5+i)*w*.21,-w*.35+Math.cos(t*.7+i)*w*.17,2,2);}}
  }
  c.restore();c.save();c.globalAlpha=.9-(service?.opening??0)*.6;sprite(c,front,-w/2+(service?.opening??0)*w*.34,-w,w,w);c.restore();
  // Nameplates are separate runtime geometry/text; always in front of glass.
  const plaqueW=w*.77;c.fillStyle='#2b2036';c.fillRect(-plaqueW/2,6,plaqueW,33);c.strokeStyle=level?'#e8c184':'#a98054';c.lineWidth=2;c.strokeRect(-plaqueW/2,6,plaqueW,33);c.fillStyle=known?'#ffe9bf':'#b9a9c7';c.font='22px monospace';c.textAlign='center';c.fillText(known?['未购买收据','道歉胶带','套娃包裹','昨天邮戳','收件人：宇宙','签收铃'][exhibitIds.indexOf(e.id)]:'等待好奇心',0,27,plaqueW-8);
  if(level===3){c.fillStyle='#ffe8a1';c.fillRect(-4,42,8,3);}c.restore();
 }
}
/** Three habitats have independent miniature terrain, idle poses and glass foreground. */
export class HabitatScene {
 readonly canvas=document.createElement('canvas');private c:CanvasRenderingContext2D|null;private art:HTMLImageElement;private background:HTMLImageElement;private active=false;private last=0;
 constructor(root:HTMLElement,private id:typeof residentIds[number],private known:()=>boolean,private level:()=>number=()=>0){this.canvas.width=600;this.canvas.height=220;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','居民生态观察区');root.append(this.canvas);this.c=this.canvas.getContext('2d');this.art=image(textures[id as ArtId]);this.background=image(habitatUrls[`../../assets/runtime/habitat-${id}-v02.webp`]);requestAnimationFrame(this.loop);}
 setActive(v:boolean){this.active=v;}
 private loop=(ms:number)=>{if(this.active&&!document.hidden&&ms-this.last>=80){this.last=ms;this.draw(ms/1000);}requestAnimationFrame(this.loop);};
 private draw(t:number){const c=this.c;if(!c)return;const known=this.known(),level=this.level();c.imageSmoothingEnabled=false;c.fillStyle=this.id==='mouse'?'#32243c':this.id==='hermit'?'#28373e':'#2c2947';c.fillRect(0,0,600,220);
  sprite(c,this.background,0,0,600,220);
  if(known){const x=this.id==='mouse'?300+Math.sin(t*.5)*65:this.id==='hermit'?315+Math.sin(t*.25)*25:330,y=this.id==='tagbird'?101+Math.sin(t*2)*2:185;const w=this.id==='mouse'?122:this.id==='hermit'?132:103;c.save();c.translate(x,y);c.scale(this.id==='mouse'&&Math.cos(t*.5)<0?-1:1,1);c.rotate(Math.sin(t*(this.id==='tagbird'?2:1))*.022);sprite(c,this.art,-w/2,-w,w);c.restore();if(this.id==='mouse'){c.fillStyle='#f1d9b0';c.fillRect(x+35,167,12,3);}}
  if(level){c.fillStyle='#f9dda455';c.fillRect(0,0,600,8);c.fillStyle='#9ed9ca';for(let i=0;i<level*3;i++)c.fillRect(490+i*10,164-i%3*9,6,11);if(level>=2){c.fillStyle='#d5afdd';for(let i=0;i<5;i++)c.fillRect(499+i*9,145-i%2*5,6,6);}}
  c.fillStyle='#bce4ed12';c.fillRect(0,0,600,220);c.fillStyle='#e3edfc70';c.fillRect(14,20,3,140);c.fillRect(21,20,4,35);c.fillRect(577,37,3,91);c.strokeStyle='#ae8e65';c.lineWidth=5;c.strokeRect(3,3,594,214);this.canvas.dataset.frame=String(Math.floor(t*12));
 }
}
