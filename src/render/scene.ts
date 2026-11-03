import globeUrl from '../../assets/runtime/parcel-globe.webp';
import robotUrl from '../../assets/runtime/robot-empty-v3.webp';
import shipUrl from '../../assets/runtime/ship-directions-v3.webp';
import warehouseUrl from '../../assets/runtime/warehouse.webp';
import mouseUrl from '../../assets/runtime/mouse.webp';
import hermitUrl from '../../assets/runtime/hermit.webp';
import birdUrl from '../../assets/runtime/tagbird.webp';
import sorterUrl from '../../assets/runtime/sorter.webp';
import { robotPose, shipPose } from './motion';
import { tuning, type SaveData } from '../game/engine';

const urls = {globe:globeUrl,robot:robotUrl,ship:shipUrl,warehouse:warehouseUrl,mouse:mouseUrl,hermit:hermitUrl,bird:birdUrl,sorter:sorterUrl};
type Art = Record<keyof typeof urls, HTMLImageElement>;
export interface SceneFrame {t:number;robot:ReturnType<typeof robotPose>;ship:ReturnType<typeof shipPose>;globe:HTMLImageElement}
export interface SceneCamera {scale:number;x:number;y:number;offsetX?:number;offsetY?:number}
export interface SceneEntity {depth:number;draw:()=>void}
export interface SceneExtension {
  ready?:Promise<void>;
  cycleFraction?:(base:number,seconds:number)=>number;
  robotPose?:(base:ReturnType<typeof robotPose>,seconds:number)=>ReturnType<typeof robotPose>|undefined;
  drawRobot?:(context:CanvasRenderingContext2D,frame:SceneFrame,atlas:HTMLImageElement)=>void;
  camera?:SceneCamera;
  worldEntities?:(context:CanvasRenderingContext2D,frame:SceneFrame)=>SceneEntity[];
  afterWorld:(context:CanvasRenderingContext2D,frame:SceneFrame)=>void;
}
const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});

export class ExpeditionScene {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private art!: Art;
  private backdrop: HTMLCanvasElement;
  private frame=0;
  private start=performance.now();
  private lastFrame=0;
  private frozen:number|null=null;
  private intervals:number[]=[];
  private drawTimes:number[]=[];
  private focusUntil=0;
  private focusKind='parcel';
  private active=false;
  private loading=false;
  ready=false;

  constructor(parent:HTMLElement,private getState:()=>SaveData,private extension?:SceneExtension) {
    this.canvas=document.createElement('canvas');this.canvas.width=832;this.canvas.height=740;
    this.canvas.setAttribute('aria-label','退件平原动态远征：咔哒绕过仓库自动探索，失物号连续前后绕轨');this.canvas.setAttribute('role','img');
    parent.append(this.canvas);this.ctx=this.canvas.getContext('2d',{alpha:false})!;
    this.backdrop=document.createElement('canvas');this.backdrop.width=832;this.backdrop.height=740;
    const c=this.backdrop.getContext('2d')!;
    const nebula=c.createRadialGradient(440,390,10,440,390,490);
    nebula.addColorStop(0,'#382748');nebula.addColorStop(.65,'#201b3a');nebula.addColorStop(1,'#17152e');c.fillStyle=nebula;c.fillRect(0,0,832,740);
    for(let i=0;i<140;i++){
      const x=(i*97.31+18)%832,y=(i*i*13.37+19)%740,size=i%13===0?3:1;
      c.fillStyle=i%13===0?'#d4b8dd':i%5===0?'#8885b7':'#4e456d';c.fillRect(x,y,size,size);
      if(i%23===0){c.fillStyle='#a68bc77a';c.fillRect(x-3,y+1,9,1);c.fillRect(x+1,y-3,1,9);}
    }
  }
  private load(){
    if(this.loading)return;this.loading=true;
    Promise.all(Object.entries(urls).map(async([key,url])=>[key,await load(url)] as const)).then(async entries=>{
      if(this.extension?.ready)await this.extension.ready;
      this.art=Object.fromEntries(entries) as Art;this.ready=true;this.canvas.dataset.ready='true';this.loop();
    }).catch(()=>{const parent=this.canvas.parentElement!;parent.dataset.error='true';parent.insertAdjacentText('beforeend','通信暂时中断，请刷新恢复场景。');});
  }
  setActive(active:boolean){this.active=active;this.lastFrame=0;if(active&&!this.ready)this.load();}
  celebrate(kind:string){this.focusKind=kind;this.focusUntil=performance.now()+2200;}
  freeze(seconds:number|null){this.frozen=seconds;this.draw(performance.now());}
  restart(){this.start=performance.now();this.frozen=null;this.lastFrame=0;this.draw(this.start);}
  elapsedSeconds(){return this.frozen??(performance.now()-this.start)/1000;}
  metrics(){
    const sorted=[...this.intervals].sort((a,b)=>a-b);
    return {frames:this.intervals.length,medianFrameMs:sorted[Math.floor(sorted.length/2)]??0,p95FrameMs:sorted[Math.floor(sorted.length*.95)]??0,meanDrawMs:this.drawTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.drawTimes.length),canvasPixels:832*740,canvasSize:{width:832,height:740},renderer:'Canvas2D / independent 2.5D layers'};
  }
  resetMetrics(){this.intervals=[];this.drawTimes=[];this.lastFrame=0;}
  private loop=()=>{
    const now=performance.now();
    if(this.active&&document.visibilityState==='visible'){
      if(this.lastFrame){this.intervals.push(now-this.lastFrame);if(this.intervals.length>1800)this.intervals.shift();}
      this.lastFrame=now;this.draw(now);
    }else this.lastFrame=0;
    this.frame=requestAnimationFrame(this.loop);
  };
  private sprite(img:HTMLImageElement,x:number,y:number,w:number,h:number,flip=false){
    const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));if(flip)c.scale(-1,1);c.drawImage(img,Math.round(-w/2),-h,w,h);c.restore();
  }
  private shadow(x:number,y:number,w:number){const c=this.ctx;c.fillStyle='#43243e73';c.beginPath();c.ellipse(x,y+1,w,w*.24,0,0,Math.PI*2);c.fill();}
  private lamp(x:number,y:number,color:string,t:number){
    const c=this.ctx;c.fillStyle=color+'22';c.fillRect(x-5,y-4,16,10);c.fillStyle=color;c.fillRect(x,y,6,3);
    if(Math.sin(t*2+x)>.25){c.fillStyle='#fff0bc';c.fillRect(x+1,y,3,1);}
  }
  private drawShip(t:number,p=shipPose(t)){
    const c=this.ctx,w=p.width;
    // One render unit shares the orbit depth. Both plume and fading wake are masked
    // by the planet on the back pass, just like the registered directional hulls.
    c.save();
    for(const dot of p.trail){c.globalAlpha=dot.alpha;c.fillStyle='#7cdffe';const size=Math.max(1,Math.round(dot.size*p.scale));c.fillRect(Math.round(dot.x),Math.round(dot.y),size,size);}
    c.globalAlpha=1;c.translate(p.nozzle.x,p.nozzle.y);c.rotate(p.exhaustHeading);
    const length=p.flameLength+[0,3,1,5][p.flameFrame]*p.scale;
    c.fillStyle='#4bbded55';c.fillRect(0,-5*p.scale,length+5,10*p.scale);
    c.fillStyle='#66dfff';c.fillRect(0,-3*p.scale,length,6*p.scale);
    c.fillStyle='#e7ffff';c.fillRect(0,-p.scale,length*.55,2*p.scale);c.restore();
    for(const layer of p.layers){
      c.save();c.globalAlpha=layer.alpha;c.translate(layer.x,layer.y);c.rotate(layer.rotation);
      c.drawImage(this.art.ship,layer.cell%2*256,Math.floor(layer.cell/2)*256,256,256,-w/2,-w/2,w,w);c.restore();
    }
  }
  private actor(frame:number,x:number,y:number,w:number,flip=false,carrying=false,t=0){
    const c=this.ctx,atlas=this.art.robot,cell=160,dx=-w*.54,dy=-w*.97;
    c.save();c.translate(Math.round(x),Math.round(y));if(flip)c.scale(-1,1);
    if(carrying){
      c.drawImage(atlas,2*cell,cell,cell,128,dx,dy,w,w*.8);
      const walk=Math.floor(t*8)%4;
      c.drawImage(atlas,walk*cell,128,cell,32,dx,dy+w*.8,w,w*.2);
    }else c.drawImage(atlas,(frame%4)*cell,Math.floor(frame/4)*cell,cell,cell,dx,dy,w,w);
    c.restore();
  }
  private drawRobot(t:number,f:number,p=robotPose(f)){
    const c=this.ctx,moving=p.action==='walk'||p.action==='return';
    this.shadow(p.x,p.y,31);
    const walkFrame=Math.floor(t*8)%4;
    let frame=moving?walkFrame:p.action==='scan'?4:p.action==='pickup'?(f<.575?5:6):7;
    if(p.action==='unload'&&f<.925)frame=6;
    if(p.action==='unload'&&f>.976)frame=1;
    const bob=moving?Math.round(Math.sin(t*16))*1:0;
    this.actor(frame,p.x,p.y+bob,144,p.action==='walk'&&p.facing==='right',p.action==='return',t);
    if(p.parcel.visible)this.parcel(p.parcel.x,p.parcel.y+(p.action==='return'?bob:0),24);
    if(p.action==='scan'){
      const tx=p.parcel.x,ty=p.parcel.y;
      c.save();c.fillStyle='#62ebd42d';c.beginPath();c.moveTo(p.x-48,p.y-76);c.lineTo(tx-26,ty);c.lineTo(tx+25,ty);c.fill();
      c.lineWidth=2;c.strokeStyle='#94fff0';c.setLineDash([5,4]);c.beginPath();c.ellipse(tx,ty,27+Math.sin(t*5)*4,10,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
      c.fillStyle='#c7fff2';c.fillRect(tx-2,ty-3,4,4);c.restore();
    }
    if(p.action==='pickup'){
      for(let i=0;i<7;i++){c.fillStyle=i%2?'#fff3bc':'#f4b66e';c.fillRect(p.x-35+Math.cos(i+t*2)*35,p.y-44+Math.sin(i+t*2)*25,3,3);}
    }
    if(p.action==='unload'){
      const pulse=Math.sin((f-.91)/.09*Math.PI);c.fillStyle=`rgba(141,255,216,${pulse*.7})`;c.fillRect(277,438,29,3);c.fillRect(280,431,3,12);
    }
  }
  private parcel(x:number,y:number,size:number){
    const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));const l=-size/2,r=size/2,top=-size;
    c.fillStyle='#663b54';c.fillRect(l-2,top-2,size+4,size+4);c.fillStyle='#efa65d';c.fillRect(l,top,size,size);
    c.fillStyle='#a65b4d';c.beginPath();c.moveTo(r-6,top+5);c.lineTo(r,top);c.lineTo(r,0);c.lineTo(r-6,0);c.fill();
    c.fillStyle='#ffe0a2';c.beginPath();c.moveTo(l,top);c.lineTo(r,top);c.lineTo(r-6,top+5);c.lineTo(l,top+5);c.fill();
    c.fillStyle='#f6d4b1';c.fillRect(-4,top,5,size);c.fillRect(l+2,top+9,7,6);c.fillStyle='#7f4a53';c.fillRect(l+3,top+11,4,1);c.restore();
  }
  private draw(now:number){
    if(!this.ready||!this.canvas.isConnected)return;
    const began=performance.now(),c=this.ctx,t=this.frozen??(now-this.start)/1000,s=this.getState();
    const baseFraction=this.frozen===null?s.cycleMs/tuning(s).scanner:(t%12)/12;
    const f=this.extension?.cycleFraction?.(baseFraction,t)??baseFraction,p=this.extension?.robotPose?.(robotPose(f),t)??robotPose(f);
    const ship=shipPose(t),frame={t,robot:p,ship,globe:this.art.globe};
    c.imageSmoothingEnabled=false;c.setTransform(1,0,0,1,0,0);c.drawImage(this.backdrop,0,0);c.translate(32,0);
    const camera=this.extension?.camera;if(camera){c.translate(camera.x+(camera.offsetX??0),camera.y+(camera.offsetY??0));c.scale(camera.scale,camera.scale);c.translate(-camera.x,-camera.y);}
    c.save();c.translate(384,365);c.rotate(-.18);c.lineWidth=1.5;c.strokeStyle='#b49bd350';c.setLineDash([3,12]);c.beginPath();c.ellipse(0,0,350,175,0,0,Math.PI*2);c.stroke();c.restore();
    if(ship.back)this.drawShip(t,ship);
    c.drawImage(this.art.globe,52,70,664,664);
    // Independent material accents attach to specific pipe/terrain points.
    this.lamp(345,634,'#e9ae70',t);this.lamp(488,610,'#94dcdb',t+.5);this.lamp(193,548,'#e9ae70',t+1);
    const entities=[
      {depth:294,draw:()=>{this.shadow(568,294,38);this.sprite(this.art.sorter,568,294,101,101);this.lamp(557,208,'#8ff3df',t);const step=Math.floor(t*3)%3;c.fillStyle='#d7b46d';for(let i=0;i<3;i++)c.fillRect(526+i*7+step,278+i*2,3,2);}},
      {depth:417,draw:()=>{this.shadow(315,417,69);this.sprite(this.art.warehouse,315,417,170,156);this.lamp(271,330,'#91efe3',t);c.fillStyle='#624b66';c.fillRect(270,437,38,9);c.fillStyle='#bb957c';c.fillRect(270,434,38,5);c.fillStyle='#88d9c6';c.fillRect(277,438,24,2);}},
      {depth:p.y,draw:()=>this.extension?.drawRobot?this.extension.drawRobot(c,frame,this.art.robot):this.drawRobot(t,f,p)},
      {depth:447,draw:()=>{this.shadow(553,447,30);this.sprite(this.art.mouse,553,447+(Math.floor(t*4)%4===2?1:0),83,89);if(Math.floor(t*4)%7<2){c.fillStyle='#f4d49d';for(let i=0;i<3;i++)c.fillRect(520+i*9+Math.floor(t*11)%4,405-i*5,3,2);}}},
      {depth:449,draw:()=>this.parcel(438,449,26)},
    ];
    if(s.collection.includes('hermit'))entities.push({depth:397,draw:()=>{const x=170+Math.floor(Math.sin(t*.5)*6);this.shadow(x,397,25);this.sprite(this.art.hermit,x,397+(Math.floor(t*3)%2),66,65);}});
    if(s.collection.includes('tagbird'))entities.push({depth:235,draw:()=>{this.sprite(this.art.bird,601,235+(Math.floor(t*2)%6===1?-4:0),47,50);}});
    if(this.extension?.worldEntities)entities.push(...this.extension.worldEntities(c,frame));
    entities.sort((a,b)=>a.depth-b.depth).forEach(e=>e.draw());
    c.fillStyle='#694771';c.fillRect(600,206,3,52);c.fillStyle='#f9c77c';c.fillRect(599,202,5,5);c.fillStyle='#c9758b';c.beginPath();c.moveTo(603,209);c.lineTo(635,213+Math.sin(t*3)*2);c.lineTo(631,229+Math.sin(t*3)*2);c.lineTo(603,226);c.fill();
    c.fillStyle='#ffdb9b';c.fillRect(611,214,8,6);
    this.extension?.afterWorld(c,frame);
    if(!ship.back)this.drawShip(t,ship);
    if(now<this.focusUntil){
      const progress=1-(this.focusUntil-now)/2200;
      c.save();c.globalAlpha=(1-progress)*.8;c.strokeStyle=this.focusKind==='glitch'?'#f4b3e7':'#ffe0a2';c.lineWidth=2;
      for(let i=0;i<12;i++){const a=i*Math.PI/6,r=35+progress*95,x=474+Math.cos(a)*r,y=310+Math.sin(a)*r*.6;c.strokeRect(x,y,3,3);}
      c.restore();
    }
    this.canvas.dataset.action=p.action;this.canvas.dataset.ship=ship.back?'back':'front';
    this.drawTimes.push(performance.now()-began);if(this.drawTimes.length>1800)this.drawTimes.shift();
  }
  destroy(){cancelAnimationFrame(this.frame);}
}
