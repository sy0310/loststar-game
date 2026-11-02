import globeUrl from '../../assets/runtime/parcel-globe.webp';
import robotUrl from '../../assets/runtime/robot.webp';
import shipUrl from '../../assets/runtime/ship.webp';
import warehouseUrl from '../../assets/runtime/warehouse.webp';
import mouseUrl from '../../assets/runtime/mouse.webp';
import {robotPose,shipPose} from './motion';
import {tuning,type SaveData} from '../game/engine';
const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
type Art = Record<'globe'|'robot'|'ship'|'warehouse'|'mouse',HTMLImageElement>;
export class ExpeditionScene {
  readonly canvas:HTMLCanvasElement;
  private ctx:CanvasRenderingContext2D;
  private art!:Art;
  private backdrop:HTMLCanvasElement;
  private frame=0;
  private start=performance.now();
  private lastFrame=0;
  private frozen:number|null=null;
  private intervals:number[]=[];
  private drawTimes:number[]=[];
  ready=false;
  constructor(parent:HTMLElement,private getState:()=>SaveData){
    this.canvas=document.createElement('canvas');this.canvas.width=768;this.canvas.height=730;
    this.canvas.setAttribute('aria-label','退货箱星动态远征：失物号前后绕轨，咔哒机器人自动探索');this.canvas.setAttribute('role','img');
    parent.append(this.canvas);this.ctx=this.canvas.getContext('2d',{alpha:true})!;
    this.backdrop=document.createElement('canvas');this.backdrop.width=768;this.backdrop.height=730;
    const c=this.backdrop.getContext('2d')!;
    const glow=c.createRadialGradient(390,360,20,390,360,450);glow.addColorStop(0,'#30213e');glow.addColorStop(.8,'#17152d');glow.addColorStop(1,'#111222');c.fillStyle=glow;c.fillRect(0,0,768,730);
    for(let i=0;i<110;i++){const x=(i*97.31+18)%768,y=(i*i*13.37+19)%730;c.fillStyle=i%9===0?'#bba4db':'#534869';c.fillRect(x,y,i%9===0?3:2,i%9===0?3:2);}
    Promise.all([load(globeUrl),load(robotUrl),load(shipUrl),load(warehouseUrl),load(mouseUrl)]).then(([globe,robot,ship,warehouse,mouse])=>{this.art={globe,robot,ship,warehouse,mouse};this.ready=true;this.canvas.dataset.ready='true';this.loop();}).catch(()=>{parent.dataset.error='true';parent.insertAdjacentText('beforeend','场景资源加载失败，请刷新重试。');});
  }
  freeze(seconds:number|null){this.frozen=seconds;this.draw(performance.now());}
  metrics(){const sorted=[...this.intervals].sort((a,b)=>a-b);return {frames:this.intervals.length,medianFrameMs:sorted[Math.floor(sorted.length/2)]??0,p95FrameMs:sorted[Math.floor(sorted.length*.95)]??0,meanDrawMs:this.drawTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.drawTimes.length),canvasPixels:768*730,renderer:'Canvas2D, 2.5D layers'};}
  resetMetrics(){this.intervals=[];this.drawTimes=[];this.lastFrame=0;}
  private loop=()=>{if(this.lastFrame&&document.visibilityState==='visible'&&this.canvas.isConnected){this.intervals.push(performance.now()-this.lastFrame);if(this.intervals.length>1800)this.intervals.shift();}this.lastFrame=performance.now();this.draw(this.lastFrame);this.frame=requestAnimationFrame(this.loop);};
  private sprite(img:HTMLImageElement,x:number,y:number,w:number,h:number,flip=false){const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));if(flip)c.scale(-1,1);c.drawImage(img,Math.round(-w/2),-h,w,h);c.restore();}
  private shadow(x:number,y:number,w:number){const c=this.ctx;c.fillStyle='#45283e88';c.beginPath();c.ellipse(x,y+1,w,w*.25,0,0,Math.PI*2);c.fill();}
  private drawShip(t:number){const c=this.ctx,p=shipPose(t),w=108*p.scale,h=w*this.art.ship.height/this.art.ship.width;
    c.save();c.translate(p.x,p.y);const direction=Math.sin(p.angle)>0?-1:1;c.scale(direction,1);c.rotate(-.13);
    c.fillStyle='#51e6ff44';c.beginPath();c.ellipse(-w*.65,-h*.37,26+Math.sin(t*30)*5,7,0,0,Math.PI*2);c.fill();
    c.fillStyle='#65eaff';c.fillRect(-w*.75,-h*.42,22+Math.sin(t*30)*6,4);c.fillStyle='#e6ffff';c.fillRect(-w*.55,-h*.41,10,3);
    c.drawImage(this.art.ship,-w/2,-h,w,h);c.restore();
  }
  private drawRobot(t:number,f:number){const c=this.ctx,p=robotPose(f),w=65,h=79,moving=p.action==='walk'||p.action==='return';
    this.shadow(p.x,p.y,25);
    c.save();c.translate(Math.round(p.x),Math.round(p.y));if(p.action==='return')c.scale(-1,1);
    const img=this.art.robot,split=Math.floor(img.height*.81),upperH=h*.81;
    const bob=moving?Math.round(Math.sin(t*12)*1.4):p.action==='pickup'?4*Math.sin((f-.5)/.12*Math.PI):0;
    c.drawImage(img,0,0,img.width,split,-w/2,-h+bob,w,upperH);
    for(let foot=0;foot<2;foot++){const offset=moving?Math.round(Math.sin(t*12+foot*Math.PI)*3):0;c.drawImage(img,foot*img.width/2,split,img.width/2,img.height-split,-w/2+foot*w/2,-h+upperH+offset,w/2,h-upperH);}
    if(p.action==='return'){this.parcel(8,-20,23);}
    c.restore();
    if(p.action==='scan'){
      c.save();c.strokeStyle='#7df9e2';c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();c.ellipse(p.x+40,p.y+8,26+Math.sin(t*6)*5,10,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
      c.fillStyle='#61e7d42a';c.beginPath();c.moveTo(p.x+24,p.y-39);c.lineTo(p.x+68,p.y+8);c.lineTo(p.x+13,p.y+8);c.fill();c.restore();
      this.parcel(p.x+42,p.y+2,22);
    }
    if(p.action==='pickup'){c.fillStyle='#ffe6a6';for(let i=0;i<5;i++)c.fillRect(p.x+Math.cos(i*1.3+t)*26,p.y-36+Math.sin(i*1.3+t)*24,3,3);}
  }
  private parcel(x:number,y:number,size:number){const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));const l=-size/2,r=size/2,top=-size;
    c.fillStyle='#633347';c.fillRect(l-2,top-2,size+4,size+4);c.fillStyle='#e9a15b';c.fillRect(l,top,size,size);
    c.fillStyle='#a95b45';c.beginPath();c.moveTo(r-6,top+5);c.lineTo(r,top);c.lineTo(r,0);c.lineTo(r-6,0);c.fill();
    c.fillStyle='#ffe1a6';c.beginPath();c.moveTo(l,top);c.lineTo(r,top);c.lineTo(r-6,top+5);c.lineTo(l,top+5);c.fill();
    c.fillStyle='#f7d1a5';c.fillRect(-4,top,5,size);c.fillStyle='#f7e1bf';c.fillRect(l+2,top+9,7,6);c.fillStyle='#7f4a53';c.fillRect(l+3,top+11,4,1);c.fillRect(l+3,top+13,3,1);c.restore();}
  private draw(now:number){if(!this.ready||!this.canvas.isConnected)return;
    const began=performance.now(),c=this.ctx,t=this.frozen??(now-this.start)/1000,s=this.getState(),fraction=this.frozen===null?s.cycleMs/tuning(s).scanner:(t%12)/12;
    c.imageSmoothingEnabled=false;c.clearRect(0,0,768,730);c.drawImage(this.backdrop,0,0);
    c.save();c.translate(384,365);c.rotate(-.19);c.strokeStyle='#9a7bb04f';c.lineWidth=2;c.setLineDash([5,11]);c.beginPath();c.ellipse(0,0,320,155,0,0,Math.PI*2);c.stroke();c.restore();
    if(shipPose(t).back)this.drawShip(t);
    c.drawImage(this.art.globe,52,70,664,664);
    const p=robotPose(fraction);
    const entities=[
      {depth:435,draw:()=>{this.shadow(349,435,64);this.sprite(this.art.warehouse,349,435,148,139);c.fillStyle=Math.sin(t*2)>0?'#9affee':'#50c5ce';c.fillRect(310,357,14,3);}},
      {depth:p.y,draw:()=>this.drawRobot(t,fraction)},
      {depth:447,draw:()=>{this.shadow(544,447,22);this.sprite(this.art.mouse,544,447+Math.floor(Math.sin(t*4)*1.5),64,69);if(Math.floor(t*3)%5===0){c.fillStyle='#ffd998';c.fillRect(516,405,3,3);c.fillRect(512,399,2,2);}}},
      {depth:447,draw:()=>this.parcel(439,447,27)},
      {depth:449,draw:()=>{if(p.action==='unload'){const u=(fraction-.9)/.1;c.save();c.globalAlpha=1-Math.max(0,(u-.75)*4);this.parcel(274+u*49,414+u*5,23-u*8);c.restore();}}},
    ];entities.sort((a,b)=>a.depth-b.depth).forEach(e=>e.draw());
    // Flag is a separate environmental layer.
    c.fillStyle='#6b456b';c.fillRect(577,214,4,74);c.fillStyle='#f3ad5f';c.fillRect(576,210,6,6);c.fillStyle='#d16f63';c.beginPath();c.moveTo(581,217);c.lineTo(621,222+Math.sin(t*3)*3);c.lineTo(615,243+Math.sin(t*3)*3);c.lineTo(581,239);c.fill();c.fillStyle='#ffde9d';c.fillRect(591,224,10,8);
    if(!shipPose(t).back)this.drawShip(t);
    this.canvas.dataset.action=p.action;this.canvas.dataset.ship=shipPose(t).back?'back':'front';
    this.drawTimes.push(performance.now()-began);if(this.drawTimes.length>1800)this.drawTimes.shift();
  }
  destroy(){cancelAnimationFrame(this.frame);}
}
