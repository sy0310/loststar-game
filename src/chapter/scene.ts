import type {ChapterSave} from './model';
import {chapterSchedule} from './model';
import {fusionRenderElapsed} from '../fusion/render-clock';
import type {SceneExtension} from '../render/scene';
import {sortingMachinePoint} from '../fusion/facilities';
const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)};
/** No game mutation: the recorded event and optional read-only replay drive these small stage parts. */
export function chapterSequence(s:ChapterSave,renderElapsedMs=s.game.world.elapsedMs){const schedule=chapterSchedule(s);if(!schedule)return null;const sec=(renderElapsedMs-schedule.start)/1000;return sec>=0&&sec<8?sec:null;}
export function withChapterScene<T extends SceneExtension>(base:T,get:()=>ChapterSave):T{
 const robot=base.robotPose,drawRobot=base.drawRobot,after=base.afterWorld;
 const sequence=()=>{const s=get();return chapterSequence(s,fusionRenderElapsed(s.game,Date.now()));};
 return {...base,robotPose(p,t){const sec=sequence();if(sec===null)return robot?.(p,t);const original=robot?.(p,t)??p,a=smooth(sec/2)*(1-smooth((sec-6)/2)),x=original.x+(378-original.x)*a,y=original.y+(355-original.y)*a;return{...p,x,y,action:sec<2?'walk':'scan',facing:'right',carrying:false,parcel:{...p.parcel,visible:false,held:false}};},
 drawRobot(c,f,a){if(sequence()!==null)return false;return drawRobot?.(c,f,a);},
 afterWorld(c,f){after(c,f);const sec=sequence();f.output.dataset.chapterPhase=sec===null?'idle':sec<1?'lamp':sec<3?'belt':sec<4.5?'parcel':sec<6?'slip':'read';if(sec===null)return;
  const point=sortingMachinePoint(90,205),move=smooth((sec-1)/3),px=point.x-18*move,py=point.y+10*move;
  c.save();c.imageSmoothingEnabled=false;
  // Grounded roller-plane paper strip emerging from the actual machine mouth.
  c.fillStyle='#f1dca6';c.globalAlpha=smooth(sec/.8);c.fillRect(point.x+37,point.y-48,5,4);c.fillStyle='#f9e7b4';c.fillRect(point.x+38,point.y-47,2,2);
  if(sec>=1){c.fillStyle='#d9c39d';c.beginPath();c.moveTo(point.x-16,point.y-3);c.lineTo(point.x+8,point.y+4);c.lineTo(point.x+8-25*move,point.y+4+12*move);c.lineTo(point.x-16-25*move,point.y-3+12*move);c.closePath();c.fill();c.strokeStyle='#9d7f78';c.lineWidth=1;for(let i=0;i<5;i++){const r=((sec*1.3+i/5)%1);c.beginPath();c.moveTo(point.x-16-25*move*r,point.y-3+12*move*r);c.lineTo(point.x+8-25*move*r,point.y+4+12*move*r);c.stroke();}}
  if(sec>=2.5){c.fillStyle='#513748';c.fillRect(px-10,py-17,23,19);c.fillStyle='#b8855a';c.fillRect(px-9,py-18,21,17);c.fillStyle='#e6b775';c.fillRect(px-9,py-18,19,4);c.fillStyle='#efdbac';c.fillRect(px,py-17,4,16);c.fillStyle='#5b4256';c.fillRect(px+6,py-10,4,3);}
  // Matching warm star: same relative upper-right direction as the package trial.
  const star={x:548,y:116};c.fillStyle='#f6d898';c.fillRect(star.x-3,star.y,9,2);c.fillRect(star.x,star.y-4,2,10);
  if(sec>=4.5){const a=smooth((sec-4.5)/1.2);c.globalAlpha=a;c.fillStyle='#483449';c.fillRect(point.x-47,point.y+22,132,27);c.fillStyle='#f0d9b4';c.fillRect(point.x-46,point.y+20,130,25);c.fillStyle='#523d5d';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText('退回目的地：上一天',point.x+19,point.y+37);}
  c.restore();
 }} as T;
}
