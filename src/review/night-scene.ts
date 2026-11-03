import invaderUrl from '../../assets/runtime/invader-v02.webp';
import type {SceneExtension,SceneFrame} from '../render/scene';
import {nightStage,nightCamera,smoothInstall,type NightStage} from './d1-motion';

/** D1 keeps the normal scene's globe, buildings, robot atlas and orbit renderer. */
export function createNightStudy():SceneExtension {
  const shadow=new Image();shadow.src=invaderUrl;
  let night:HTMLCanvasElement|undefined,rim:HTMLCanvasElement|undefined;
  function atmosphere(c:CanvasRenderingContext2D,frame:SceneFrame){
    if(!night){night=document.createElement('canvas');night.width=frame.globe.width;night.height=frame.globe.height;const m=night.getContext('2d')!;m.drawImage(frame.globe,0,0);m.globalCompositeOperation='source-in';m.fillStyle='#273b84';m.fillRect(0,0,night.width,night.height);}
    c.save();c.globalAlpha=.50;c.drawImage(night,52,70,664,664);c.restore();
    for(const [x,y]of [[271,330],[557,208],[345,634],[488,610]]){
      c.save();const glow=c.createRadialGradient(x+3,y+2,1,x+3,y+2,29);glow.addColorStop(0,'#ffd89d66');glow.addColorStop(1,'#ffd89d00');c.fillStyle=glow;c.fillRect(x-28,y-28,62,62);c.restore();
    }
  }
  function beacon(c:CanvasRenderingContext2D,s:NightStage){
    const alarm=s.phase==='signal'||s.phase==='travel',pulse=.55+Math.sin(s.seconds*5)**2*.4;
    c.save();c.fillStyle=alarm?'#ffe4a8':'#a2eadc';c.fillRect(554,206,10,4);c.fillStyle=alarm?'#ffe4a833':'#a2eadc22';c.fillRect(551,203,16,10);
    if(alarm){c.globalAlpha=pulse*.35;c.strokeStyle='#f8d59b';c.lineWidth=2;c.beginPath();c.ellipse(559,208,12+(s.seconds*12)%22,5+(s.seconds*5)%10,0,0,Math.PI*2);c.stroke();
      c.fillStyle='#ffe9bb30';c.beginPath();c.moveTo(558,210);c.lineTo(s.target.x-26,s.target.y);c.lineTo(s.target.x+26,s.target.y);c.closePath();c.fill();}
    c.restore();
  }
  function gate(c:CanvasRenderingContext2D,s:NightStage){
    // Door is attached to the actual receiving lip, rather than another front-row machine.
    const access=s.phase==='dock'?smoothInstall(s.progress/.18)*(1-smoothInstall((s.progress-.70)/.30)):0;
    c.save();
    // The receiving alcove is warm while the terrain is blue-purple: local light,
    // not a full-screen dark filter, establishes the building's night-time depth.
    const porch=c.createRadialGradient(291,415,2,291,415,31);porch.addColorStop(0,'#f9c97833');porch.addColorStop(1,'#f9c97800');c.fillStyle=porch;c.fillRect(260,384,62,62);
    c.fillStyle='#293247';c.fillRect(277,411,29,24);c.strokeStyle='#d3ad7d';c.lineWidth=2;c.strokeRect(276,410,31,25);
    const h=Math.round(22*(1-access));
    c.fillStyle='#728c91';c.fillRect(279,412,25,h);c.fillStyle='#aec8bb';for(let y=414;y<412+h;y+=5)c.fillRect(279,y,25,2);
    c.fillStyle=access>.4?'#c9ffe0':'#9fdaca';c.fillRect(277,437,29,3);c.fillStyle='#f3dbab';c.fillRect(273,414,3,5);c.restore();
  }
  function paperShadow(c:CanvasRenderingContext2D,s:NightStage){
    if(s.phase==='done')return;
    const held=s.phase==='escort'||s.phase==='dock',x=s.target.x,y=s.target.y,fold=s.fold;
    const alpha=s.emerge*(s.phase==='dock'?1-smoothInstall((s.progress-.72)/.25):1);
    c.save();c.globalAlpha=alpha;c.translate(Math.round(x),Math.round(y));
    if(!held){c.fillStyle='#12162c66';c.beginPath();c.ellipse(0,5,24*(1-fold*.5),5,0,0,Math.PI*2);c.fill();}
    if(shadow.complete&&shadow.naturalWidth){
      if(!rim){rim=document.createElement('canvas');rim.width=384;rim.height=384;const r=rim.getContext('2d')!;r.drawImage(shadow,0,0);r.globalCompositeOperation='source-in';r.fillStyle='#e1d7f4';r.fillRect(0,0,384,384);}
      const pose=fold>.4?3:s.phase==='identify'?2:Math.floor(s.seconds*3)%2;
      const w=104*(1-fold*.66),h=104*(1-fold*.72),dy=-h*.79;
      c.save();c.globalAlpha*=.58+Math.sin(s.seconds*3)**2*.20;
      for(const [dx,dy2]of [[-2,0],[2,0],[0,-2]])c.drawImage(rim,pose%2*192,Math.floor(pose/2)*192,192,192,-w/2+dx,dy+dy2,w,h);c.restore();
      c.drawImage(shadow,pose%2*192,Math.floor(pose/2)*192,192,192,-w/2,dy,w,h);
    }
    if(fold>0){
      // Transparent registered containment case lets the paper remain visible inside.
      c.save();c.globalAlpha*=fold;c.fillStyle='#84cfc91c';c.fillRect(-23,-34,46,35);c.strokeStyle='#c0f5e2';c.lineWidth=2;c.strokeRect(-23,-34,46,35);
      c.fillStyle='#b3ba9d';c.fillRect(-25,-37,50,5);c.fillRect(-25,1,50,5);c.fillStyle='#fff0c270';c.fillRect(-17,-29,3,18);c.fillRect(17,-26,2,9);c.fillStyle='#e7d5a9';c.fillRect(-7,-8,14,6);c.restore();
    }
    if(s.phase==='identify'){
      const progress=s.progress;for(let i=0;i<2;i++){const wave=(s.seconds*.65+i*.5)%1;c.save();c.globalAlpha=(1-wave)*.8;c.strokeStyle='#9cece0';c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.ellipse(0,5,24+wave*24,8+wave*7,0,0,Math.PI*2);c.stroke();c.restore();}
      c.fillStyle='#292d44e8';c.fillRect(-59,-110,118,24);c.strokeStyle='#99e5d3';c.strokeRect(-59,-110,118,24);c.font='19px monospace';c.textAlign='center';c.fillStyle='#d9f4df';c.fillText(progress>.5?'漂行纸影':'核验折痕中',0,-92,108);
      c.fillStyle='#314453';c.fillRect(-47,-81,94,4);c.fillStyle='#b9efcf';c.fillRect(-47,-81,94*progress,4);
    }
    c.restore();
  }
  function searchlight(c:CanvasRenderingContext2D,frame:SceneFrame,s:NightStage){
    if(!s.beamVisible(frame.ship.back))return;
    const ship=frame.ship,from={x:ship.x,y:ship.y-ship.width*.20},target=s.target;
    const a=Math.atan2(target.y-from.y,target.x-from.x),right={x:-Math.sin(a)*23,y:Math.cos(a)*23};
    c.save();c.fillStyle='#fff0bf18';c.beginPath();c.moveTo(from.x,from.y);c.lineTo(target.x-right.x,target.y-right.y);c.lineTo(target.x+right.x,target.y+right.y);c.closePath();c.fill();
    c.lineWidth=1.5;c.strokeStyle='#ffedbe40';c.beginPath();c.moveTo(from.x,from.y);c.lineTo(target.x,target.y);c.stroke();
    c.fillStyle='#fff0bf1e';c.beginPath();c.ellipse(target.x,target.y,31,10,0,0,Math.PI*2);c.fill();c.strokeStyle='#fff0bf99';c.lineWidth=1;c.stroke();c.restore();
  }
  return {
    camera:nightCamera,
    cycleFraction:(_base,t)=>nightStage(t).fraction,
    robotPose:(_base,t)=>nightStage(t).robot,
    worldEntities:(c,frame)=>{const s=nightStage(frame.t);return [
      {depth:-Infinity,draw:()=>atmosphere(c,frame)},
      {depth:295,draw:()=>beacon(c,s)},
      {depth:434,draw:()=>gate(c,s)},
      {depth:s.phase==='escort'||s.phase==='dock'?s.robot.y+.1:s.target.y-.1,draw:()=>paperShadow(c,s)},
    ];},
    afterWorld(c,frame){const s=nightStage(frame.t);searchlight(c,frame,s);
      const canvas=c.canvas as HTMLCanvasElement;canvas.dataset.studyPhase=s.phase;canvas.dataset.studySeconds=s.seconds.toFixed(2);canvas.dataset.robotX=s.robot.x.toFixed(2);canvas.dataset.robotY=s.robot.y.toFixed(2);canvas.dataset.targetX=s.target.x.toFixed(2);canvas.dataset.targetY=s.target.y.toFixed(2);canvas.dataset.beam=String(s.beamVisible(frame.ship.back));
    },
  };
}
