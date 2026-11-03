import type {SceneExtension,SceneFrame} from './scene';
import type {guardView} from '../prototype/guard-engine';
import tapeUrl from '../../assets/runtime/tape.webp';
import bellUrl from '../../assets/runtime/bell.webp';
type GuardVisual=ReturnType<typeof guardView>;

export function guardLayer(getVisual:()=>GuardVisual):SceneExtension {
  let tint:HTMLCanvasElement|null=null;
  const icons={tape:new Image(),bell:new Image()};icons.tape.src=tapeUrl;icons.bell.src=bellUrl;
  const point=(progress:number)=>({x:570-progress*233,y:530-progress*76+Math.sin(progress*Math.PI)*24});
  return {afterWorld(c:CanvasRenderingContext2D,frame:SceneFrame){
    const v=getVisual(),t=frame.t;
    if(v.light>0){
      if(!tint){tint=document.createElement('canvas');tint.width=frame.globe.width;tint.height=frame.globe.height;const m=tint.getContext('2d')!;m.drawImage(frame.globe,0,0);m.globalCompositeOperation='source-in';m.fillStyle='#0a143c';m.fillRect(0,0,tint.width,tint.height);}
      c.save();c.globalAlpha=v.light*.69;c.drawImage(tint,52,70,664,664);c.restore();
      for(const [x,y] of [[271,330],[557,208],[345,634],[488,610]]){
        c.save();c.globalAlpha=v.light;const g=c.createRadialGradient(x+3,y+2,1,x+3,y+2,30);g.addColorStop(0,'#ffe4a666');g.addColorStop(1,'#ffe4a600');c.fillStyle=g;c.fillRect(x-28,y-28,60,60);c.fillStyle='#ffecb4';c.fillRect(x,y,7,4);c.restore();
      }
    }
    if(v.phase!=='night')return;
    const slots=[{x:438,y:492},{x:378,y:517}];
    for(let i=0;i<2;i++){
      const slot=slots[i],id=v.activeSlots[i];if(v.strengths[i]){c.strokeStyle=['','#e7c792','#a7e5d9','#e9aefb'][v.strengths[i]];c.lineWidth=2+v.strengths[i]*.5;c.beginPath();c.ellipse(slot.x,slot.y,25+v.strengths[i]*7,8+v.strengths[i]*2,0,0,Math.PI*2);c.stroke();}c.fillStyle='#352f50';c.fillRect(slot.x-23,slot.y-5,46,11);c.fillStyle='#9a8b91';c.fillRect(slot.x-21,slot.y-7,42,4);
      if(id&&icons[id].complete&&icons[id].naturalWidth)c.drawImage(icons[id],slot.x-25,slot.y-57,50,50);
      if(id==='tape'){
        const stretch=45+Math.sin(t*2)*5;c.fillStyle='#e7c8a5bb';c.fillRect(slot.x-5,slot.y+3,stretch,7);c.fillStyle='#ae8ab5';for(let j=0;j<7;j++)c.fillRect(slot.x+j*7,slot.y+5,3,2);
      }
      if(id==='bell')for(let j=0;j<3;j++){
        const wave=(v.nightBase/6+j/3)%1;c.save();c.globalAlpha=(1-wave)*.7;c.strokeStyle='#b8ecdf';c.lineWidth=2;c.beginPath();c.ellipse(slot.x,slot.y,20+wave*(95+v.strengths[i]*12),8+wave*37,0,0,Math.PI*2);c.stroke();c.restore();
      }
    }
    for(const actor of v.intruders){
      const p=point(actor.progress);c.save();c.globalAlpha=actor.alpha;c.translate(Math.round(p.x),Math.round(p.y));
      c.fillStyle='#17142d88';c.beginPath();c.ellipse(0,1,24,5,0,0,Math.PI*2);c.fill();
      const bob=actor.stunned?0:Math.round(Math.sin(t*7+actor.id)*2);
      c.translate(0,bob);c.scale(2,2);
      // One original paper-shadow silhouette; no sprite or enemy family expansion.
      c.fillStyle='#2e2449';c.fillRect(-10,-19,19,17);c.fillRect(-12,-14,23,8);c.fillStyle='#7f6a92';c.fillRect(-9,-20,17,3);c.fillStyle='#b5a0b5';c.fillRect(-2,-20,3,15);
      c.fillStyle='#b7f4e1';c.fillRect(-7,-13,3,3);c.fillRect(4,-13,3,3);c.fillStyle='#473958';c.fillRect(-7,-3,4,4);c.fillRect(4,-3,4,4);
      c.fillStyle='#d8b58e';c.fillRect(-7,-8,4,3);c.fillStyle='#49324c';c.fillRect(-6,-7,2,1);
      if(actor.stunned){c.fillStyle='#fff0b4';c.fillRect(-2,-27,2,3);c.fillRect(4,-25,2,2);}
      c.restore();
      if(actor.sealing){
        c.save();c.strokeStyle='#b8e8ca99';c.lineWidth=2;c.setLineDash([3,5]);c.beginPath();c.moveTo(frame.robot.x,frame.robot.y-40);c.lineTo(p.x,p.y-20);c.stroke();c.setLineDash([]);
        c.fillStyle='#ffe2a3';c.fillRect(p.x-18,p.y-38,36,13);c.fillStyle='#76546a';c.fillRect(p.x-11,p.y-32,22,2);c.restore();
      }
    }
  }};
}
