import radarDeviceUrl from '../../assets/runtime/equipment-radar.webp';
import gateDeviceUrl from '../../assets/runtime/sorter.webp';
import type {StationState,ResearchState} from '../game/station';
import {robotPose} from './motion';
import type {SceneExtension,SceneFrame} from './scene';
import type {guardView} from '../prototype/guard-engine';
import tapeUrl from '../../assets/runtime/tape.webp';
import invaderUrl from '../../assets/runtime/invader-v02.webp';
import bellUrl from '../../assets/runtime/bell.webp';
type GuardVisual=ReturnType<typeof guardView>&{station?:StationState;research?:ResearchState;at?:number;repairBay?:number};

export function guardLayer(getVisual:()=>GuardVisual):SceneExtension {
  let tint:HTMLCanvasElement|null=null,warm:HTMLCanvasElement|null=null,rim:HTMLCanvasElement|null=null;const invader=new Image();invader.src=invaderUrl;
  const icons={tape:new Image(),bell:new Image()};icons.tape.src=tapeUrl;icons.bell.src=bellUrl;
  const machines={beacon:new Image(),gate:new Image()};machines.beacon.src=radarDeviceUrl;machines.gate.src=gateDeviceUrl;
  const point=(progress:number)=>({x:570-progress*233,y:530-progress*76+Math.sin(progress*Math.PI)*24});
  return {robotPose:(dayPose)=>{const v=getVisual(),age=((v.at??Date.now())-(v.station?.lastRepair?.at??0))/1000;if(v.station?.lastRepair&&age>=0&&age<4){const f=age<1?age:age<3?1:4-age;return {...dayPose,x:dayPose.x+(327-dayPose.x)*f,y:dayPose.y+(454-dayPose.y)*f,action:age>=1&&age<3?'unload':'walk',parcel:{...dayPose.parcel,visible:false,held:false}};}if(v.phase!=='night'){const dawn=240000-v.untilNextMs;if(v.nightNumber>1&&dawn>=0&&dawn<2500){const f=dawn/2500;return {...dayPose,x:327+(dayPose.x-327)*f,y:454+(dayPose.y-454)*f,action:'walk',parcel:{...dayPose.parcel,visible:false}};}return undefined;}const a=(v.nightBase%12)/12,base=robotPose(0),targetX=a<.3?327+a/.3*78:a<.65?405:a<.95?405-(a-.65)/.3*78:327,targetY=454+(targetX-327)/78*24,blend=Math.min(1,v.nightBase/2.5),x=dayPose.x+(targetX-dayPose.x)*blend,y=dayPose.y+(targetY-dayPose.y)*blend;return {...base,x,y,action:a<.3?'walk':a<.65?'scan':a<.95?'return':'unload',parcel:{...base.parcel,x:520,y:520,visible:false,held:false}};},afterWorld(c:CanvasRenderingContext2D,frame:SceneFrame){
    const v=getVisual(),t=frame.t;
    if(v.light>0){
      if(!tint){tint=document.createElement('canvas');tint.width=frame.globe.width;tint.height=frame.globe.height;const m=tint.getContext('2d')!;m.drawImage(frame.globe,0,0);m.globalCompositeOperation='source-in';m.fillStyle='#0a143c';m.fillRect(0,0,tint.width,tint.height);}
      if(!warm){warm=document.createElement('canvas');warm.width=frame.globe.width;warm.height=frame.globe.height;const m=warm.getContext('2d')!;m.drawImage(frame.globe,0,0);m.globalCompositeOperation='source-in';m.fillStyle='#e59a52';m.fillRect(0,0,warm.width,warm.height);}
      const warmth=v.phase==='dusk'?Math.sin(v.light/.65*Math.PI/2)*.17:v.phase==='night'?Math.max(0,1-v.nightBase/3)*.17:0;if(warmth){c.save();c.globalAlpha=warmth;c.drawImage(warm,52,70,664,664);c.restore();}
      c.save();c.globalAlpha=v.light*.56;c.drawImage(tint,52,70,664,664);c.restore();
      for(const [x,y] of [[271,330],[557,208],[345,634],[488,610]]){
        c.save();c.globalAlpha=v.light;const g=c.createRadialGradient(x+3,y+2,1,x+3,y+2,30);g.addColorStop(0,'#ffe4a666');g.addColorStop(1,'#ffe4a600');c.fillStyle=g;c.fillRect(x-28,y-28,60,60);c.fillStyle='#ffecb4';c.fillRect(x,y,7,4);c.restore();
      }
    }
    const age=((v.at??Date.now())-(v.station?.lastRepair?.at??0))/1000,repairing=!!v.station?.lastRepair&&age>=0&&age<4,from=v.station?.lastRepair?.from??100,visualIntegrity=repairing?from+(v.station!.integrity-from)*Math.min(1,age/3):v.station?.integrity??100;
    if(visualIntegrity<100){const cracks=[[300,400],[325,415],[286,421],[339,420],[311,392],[293,391]];c.save();c.lineWidth=3;for(let i=0;i<Math.min(6,Math.ceil((100-visualIntegrity)/6));i++){const [x,y]=cracks[i];c.strokeStyle='#21172e';c.beginPath();c.moveTo(x-5,y-10);c.lineTo(x+3,y-3);c.lineTo(x-2,y+4);c.lineTo(x+8,y+11);c.stroke();c.strokeStyle='#cd895d';c.lineWidth=1;c.stroke();}c.fillStyle=Math.sin(t*6)>.0?'#ffb990':'#bf648b';c.fillRect(273,430,7,5);c.restore();}
    const hitAge=((v.at??Date.now())-(v.station?.lastHitAt??0))/1000;if(v.station?.lastHitAt&&hitAge>=0&&hitAge<1.5){c.save();c.globalAlpha=1-hitAge/1.5;c.strokeStyle='#ffb17c';c.lineWidth=3;c.beginPath();c.ellipse(315,417,24+hitAge*27,10+hitAge*10,0,0,Math.PI*2);c.stroke();for(let i=0;i<8;i++){c.fillStyle=i%2?'#ffe2a8':'#bb719b';c.fillRect(315+Math.cos(i*2.4)*hitAge*40,400-Math.sin(i)*12-hitAge*19,3,3);}c.font='24px sans-serif';c.fillStyle='#ffe0a3';c.textAlign='center';c.fillText(v.station.lastHitPoints?`护板 −${v.station.lastHitPoints}`:'护板碰撞',315,284);c.restore();}
    if(repairing){c.save();const x=292+Math.sin(t*4)*9,y=425+Math.cos(t*3)*3;c.strokeStyle='#8bd8d1';c.lineWidth=3;c.beginPath();c.moveTo(frame.robot.x-16,frame.robot.y-59);c.lineTo(x,y);c.stroke();c.fillStyle='#fff2be';for(let i=0;i<9;i++){const f=(t*3+i*.13)%1;c.globalAlpha=1-f;c.fillRect(x+Math.cos(i*2)*f*31,y+Math.sin(i*3)*f*19,2+i%2,3);}c.globalAlpha=1;c.strokeStyle='#bde9d4';c.lineWidth=2;c.strokeRect(278,411,36,23);c.fillStyle='#173d40dd';c.fillRect(257,285,168,32);c.fillStyle='#d4ffdb';c.font='22px sans-serif';c.textAlign='center';c.fillText(`修复 +${v.station!.lastRepair!.points} · −${v.station!.lastRepair!.cost}零件`,341,309,156);c.restore();}
    if(v.repairBay){c.fillStyle='#85cec0';for(let i=0;i<v.repairBay;i++)c.fillRect(268+i*8,444,5,6);}
    if(v.research?.active){c.save();c.strokeStyle='#a1e1db88';c.lineWidth=1;c.setLineDash([4,6]);c.beginPath();c.ellipse(476,384,58+(t*8)%24,18,0,0,Math.PI*2);c.stroke();c.restore();}
    const production=!!v.station;

    const ship=frame.ship;if(v.phase==='night'&&!ship.back){c.save();c.globalAlpha=.22;c.strokeStyle='#ffeab3';c.setLineDash([4,8]);c.beginPath();c.moveTo(ship.x,ship.y+15);c.lineTo(365,470);c.stroke();c.setLineDash([]);c.fillStyle='#ffeab355';c.beginPath();c.ellipse(365,470,35+Math.sin(t)*3,10,0,0,Math.PI*2);c.fill();c.restore();}
    const slots=[{x:438,y:492},{x:378,y:517}];
    for(let i=0;i<2;i++){
      const slot=slots[i],id=v.activeSlots[i];if(v.strengths[i]){c.strokeStyle=['','#e7c792','#a7e5d9','#e9aefb'][v.strengths[i]];c.lineWidth=2+v.strengths[i]*.5;c.beginPath();c.ellipse(slot.x,slot.y,25+v.strengths[i]*7,8+v.strengths[i]*2,0,0,Math.PI*2);c.stroke();}c.fillStyle='#352f50';c.fillRect(slot.x-23,slot.y-5,46,11);c.fillStyle='#9a8b91';c.fillRect(slot.x-21,slot.y-7,42,4);
      if((id==='tape'||id==='bell')&&icons[id].complete&&icons[id].naturalWidth)c.drawImage(icons[id],slot.x-25,slot.y-57,50,50);
      if(id==='beacon'||id==='gate'){const img=machines[id];if(img.complete&&img.naturalWidth)c.drawImage(img,slot.x-33,slot.y-68,66,66);if(v.phase==='night'&&id==='beacon'){const p=point(.47);c.save();c.fillStyle='#b4e8d733';c.beginPath();c.moveTo(slot.x-3,slot.y-45);c.lineTo(p.x-30,p.y+8);c.lineTo(p.x+30,p.y+8);c.fill();c.strokeStyle='#bdffee';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y+6,26,7,0,0,Math.PI*2);c.stroke();c.restore();}if(id==='gate'){const closed=v.phase==='night'&&v.nightBase%6<1.1+v.strengths[i]*.2;c.fillStyle=closed?'#c2e8d7':'#81768c';for(let j=0;j<(closed?5:1);j++)c.fillRect(slot.x-18+j*8,slot.y-36,4,29);}}
      if(v.phase==='night'&&id==='tape'){
        const stretch=45+Math.sin(t*2)*5;c.fillStyle='#e7c8a5bb';c.fillRect(slot.x-5,slot.y+3,stretch,7);c.fillStyle='#ae8ab5';for(let j=0;j<7;j++)c.fillRect(slot.x+j*7,slot.y+5,3,2);
      }
      if(v.phase==='night'&&id==='bell')for(let j=0;j<3;j++){
        const wave=(v.nightBase/6+j/3)%1;c.save();c.globalAlpha=(1-wave)*.7;c.strokeStyle='#b8ecdf';c.lineWidth=2;c.beginPath();c.ellipse(slot.x,slot.y,20+wave*(95+v.strengths[i]*12),8+wave*37,0,0,Math.PI*2);c.stroke();c.restore();
      }
    }
    if(v.phase!=='night')return;
    for(const actor of v.intruders){
      const p=point(actor.progress);c.save();c.globalAlpha=actor.alpha;c.translate(Math.round(p.x),Math.round(p.y));
      c.fillStyle='#17142d88';c.beginPath();c.ellipse(0,1,24,5,0,0,Math.PI*2);c.fill();
      const bob=actor.stunned?0:Math.round(Math.sin(t*7+actor.id)*2);c.translate(0,bob);
      const pose=actor.stunned?3:actor.slowed?2:Math.floor(t*4+actor.id)%2;
      if(invader.complete&&invader.naturalWidth){
        if(!rim){rim=document.createElement('canvas');rim.width=384;rim.height=384;const r=rim.getContext('2d')!;r.drawImage(invader,0,0);r.globalCompositeOperation='source-in';r.fillStyle='#c8c4eb';r.fillRect(0,0,384,384);}
        c.save();c.globalAlpha=.65;for(const [dx,dy] of [[-2,0],[2,0],[0,-2]])c.drawImage(rim,pose%2*192,Math.floor(pose/2)*192,192,192,-49+dx,-85+dy,98,98);c.restore();
        c.drawImage(invader,pose%2*192,Math.floor(pose/2)*192,192,192,-49,-85,98,98);
      }
      const label=actor.status==='intercepted'?'核验完成':actor.status==='arrived'?(production?'撞击护板':'咔哒护送'):actor.stunned?(production?'隔离门阻挡':'铃声停顿'):actor.slowed?(production?'警戒引导':'胶带减速'):`影子 ${actor.id+1}`;
      const color=actor.stunned?'#b6f3e5':actor.slowed?'#ffe0a1':'#ece0ff';c.fillStyle='#211b39e8';c.fillRect(-69,-122,138,28);c.strokeStyle=color;c.lineWidth=1;c.strokeRect(-69,-122,138,28);c.fillStyle=color;c.font='24px sans-serif';c.textAlign='center';c.fillText(label,0,-102,132);
      c.fillStyle='#322743';c.fillRect(-49,-93,98,5);c.fillStyle='#b8e6d1';c.fillRect(-49,-93,98*actor.verification,5);
      if(actor.stunned){c.fillStyle='#fff0b4';c.fillRect(-4,-72,3,6);c.fillRect(7,-68,3,3);}
      c.restore();
      if(actor.sealing){
        c.save();c.strokeStyle='#b8e8ca99';c.lineWidth=2;c.setLineDash([3,5]);c.beginPath();c.moveTo(frame.robot.x,frame.robot.y-40);c.lineTo(p.x,p.y-20);c.stroke();c.setLineDash([]);
        c.fillStyle='#ffe2a3';c.fillRect(p.x-18,p.y-38,36,13);c.fillStyle='#76546a';c.fillRect(p.x-11,p.y-32,22,2);c.restore();
      }
    }
  }};
}
