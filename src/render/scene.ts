import spaceUrl from '../../assets/runtime/visual-renewal/world/space.webp';
import {prepareRenewalRobot,isRenewalRobot} from './renewal-robot';
import globeUrl from '../../assets/runtime/visual-renewal/world/globe.webp';
import robotUrl from '../../assets/runtime/visual-renewal/world/robot-atlas.webp';
import shipUrl from '../../assets/runtime/visual-renewal/world/ship-atlas.webp';
import warehouseUrl from '../../assets/runtime/visual-renewal/world/station.webp';
import mouseUrl from '../../assets/runtime/mouse.webp';
import hermitUrl from '../../assets/runtime/hermit.webp';
import birdUrl from '../../assets/runtime/tagbird.webp';
import sorterUrl from '../../assets/runtime/sorter.webp';
import { robotPose, shipPose, shipViews } from './motion';
import {createAnimatedRobotPainter,robotAnimationPose,type RobotAnimationState} from './robot-animation';
import { tuning, type SaveData } from '../game/engine';
import {worldView} from '../game/world';
import {residentEnvironment, residentMotion, residentIds, type ResidentEnvironment} from './resident-motion';
import {drawResident, loadResidentArt, type ResidentArt} from './residents';
import {pickSceneCommands, sceneClientPoint, type SceneAlphaMask, type SceneHitTarget, type SceneImageCommand, type ScenePick} from './scene-picking';
export type {ScenePick} from './scene-picking';

const urls = {globe:globeUrl,robot:robotUrl,ship:shipUrl,warehouse:warehouseUrl,mouse:mouseUrl,hermit:hermitUrl,bird:birdUrl,sorter:sorterUrl,space:spaceUrl};
type Art = Record<keyof typeof urls, HTMLImageElement>;
export interface SceneFrame {t:number;robot:ReturnType<typeof robotPose>;robotAnimation?:RobotAnimationState;ship:ReturnType<typeof shipPose>;globe:HTMLImageElement;environment:ResidentEnvironment;output:HTMLCanvasElement}
export interface SceneCamera {scale:number;x:number;y:number;offsetX?:number;offsetY?:number}
export interface SceneEntity {depth:number;draw:()=>void;hitTarget?:SceneHitTarget}
export interface SceneExtension {
  ready?:Promise<void>;
  cycleFraction?:(base:number,seconds:number)=>number;
  robotPose?:(base:ReturnType<typeof robotPose>,seconds:number)=>ReturnType<typeof robotPose>|undefined;
  robotAnimation?:(base:ReturnType<typeof robotPose>,seconds:number)=>RobotAnimationState|undefined;
  shipPose?:(base:ReturnType<typeof shipPose>,seconds:number)=>ReturnType<typeof shipPose>;
  drawRobot?:(context:CanvasRenderingContext2D,frame:SceneFrame,atlas:HTMLImageElement)=>boolean|void;
  environment?:(seconds:number)=>ResidentEnvironment;
  drawResident?:typeof drawResident;
  residentPose?:typeof residentMotion;
  camera?:SceneCamera;
  hideLegacySorter?:boolean;
  /** The A layout fits one transparent world over its continuous host starfield. */
  hostBackdrop?:boolean;
  /** Explicit renderer contract: resident drawing owns all of its new textures. */
  independentResidents?:boolean;
  worldEntities?:(context:CanvasRenderingContext2D,frame:SceneFrame)=>SceneEntity[];
  afterWorld:(context:CanvasRenderingContext2D,frame:SceneFrame)=>void;
}
const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});

/** Dynamic canvases opt into invalidation; ordinary immutable atlas masks stay cached. */
export function cachedSceneAlphaMask<T>(cached:{mask:T;revision?:string}|undefined,revision:string|undefined,read:()=>T){
  return cached&&cached.revision===revision?cached:{mask:read(),revision};
}

export class ExpeditionScene {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private outputContext: CanvasRenderingContext2D;
  private world: HTMLCanvasElement;
  private worldContext: CanvasRenderingContext2D;
  private art!: Art;
  private residentArt!: ResidentArt;
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
  private destroyed=false;
  private hitCommands: SceneImageCommand[] = [];
  private hitTarget: SceneHitTarget | undefined;
  private alphaMasks = new WeakMap<HTMLImageElement | HTMLCanvasElement, {mask:SceneAlphaMask;revision?:string}>();
  private robotPainter = createAnimatedRobotPainter();
  ready=false;

  constructor(parent:HTMLElement,private getState:()=>SaveData,private extension?:SceneExtension) {
    this.canvas=document.createElement('canvas');this.canvas.width=832;this.canvas.height=740;
    this.canvas.setAttribute('aria-label','退件平原动态远征：咔哒绕过仓库自动探索，失物号连续前后绕轨');this.canvas.setAttribute('role','img');
    parent.append(this.canvas);this.ctx=this.outputContext=this.canvas.getContext('2d',{alpha:true})!;
    this.world=document.createElement('canvas');this.world.width=832;this.world.height=740;
    this.worldContext=this.world.getContext('2d')!;
    this.recordImageHits(this.outputContext);
    this.recordImageHits(this.worldContext);

  }
  private load(){
    if(this.loading||this.destroyed)return;this.loading=true;
    const independent=this.extension?.independentResidents===true;
    // These compatibility arguments are never painted by an independent renderer.
    // One in-memory pixel avoids fetching obsolete day poses, cycles or a hidden sorter.
    let placeholder:HTMLImageElement|undefined;
    if(independent||this.extension?.hideLegacySorter){
      placeholder=new Image(1,1);
      placeholder.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
    }
    const emptyResident={dayContact:{x:0,y:0},frames:[]};
    const independentArt:ResidentArt={registration:{residents:{mouse:emptyResident,hermit:emptyResident,tagbird:emptyResident}},images:{}};
    Promise.all([
      Promise.all(Object.entries(urls).map(async([key,url])=>[key,
        independent&&['mouse','hermit','bird'].includes(key)||key==='sorter'&&this.extension?.hideLegacySorter
          ?placeholder!:await load(url)] as const)),
      independent?Promise.resolve(independentArt):loadResidentArt(),
      prepareRenewalRobot(),
      this.extension?.ready,
    ]).then(([entries,residentArt])=>{
      if(this.destroyed)return;
      this.residentArt=residentArt;
      this.art=Object.fromEntries(entries) as Art;this.ready=true;this.canvas.dataset.ready='true';this.loop();
    }).catch(()=>{const parent=this.canvas.parentElement;if(this.destroyed||!parent)return;parent.dataset.error='true';parent.insertAdjacentText('beforeend','通信暂时中断，请刷新恢复场景。');});
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
  pickAtClient(clientX:number,clientY:number):ScenePick {
    const point=sceneClientPoint(clientX,clientY,this.canvas.getBoundingClientRect(),this.canvas.width,this.canvas.height,getComputedStyle(this.canvas).objectFit==='contain'?'contain':'stretch');
    if(!point)return {kind:'space',x:0,y:0};
    if(!this.ready||point.x<0||point.y<0||point.x>=this.canvas.width||point.y>=this.canvas.height)return {...point,kind:'space'};
    return pickSceneCommands(point,this.hitCommands,image=>this.imageMask(image));
  }
  private imageMask(image:HTMLImageElement | HTMLCanvasElement){
    const cached=this.alphaMasks.get(image);
    const revision=image.dataset.hitRevision;
    if(cached&&cached.revision===revision)return cached.mask;
    const canvas=image instanceof HTMLCanvasElement?image:document.createElement('canvas');
    if(image instanceof HTMLImageElement){canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;}
    const context=canvas.getContext('2d')!;if(image instanceof HTMLImageElement)context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    const alpha=new Uint8Array(canvas.width*canvas.height);
    for(let index=0;index<alpha.length;index++)alpha[index]=pixels[index*4+3];
    const entry=cachedSceneAlphaMask(cached,revision,()=>({width:canvas.width,height:canvas.height,alpha}));
    this.alphaMasks.set(image,entry);return entry.mask;
  }
  private recordImageHits(context:CanvasRenderingContext2D){
    const original=context.drawImage.bind(context);
    context.drawImage=((image:CanvasImageSource,...values:number[])=>{
      if(this.hitTarget&&(image instanceof HTMLImageElement||image instanceof HTMLCanvasElement)){
        const imageWidth=image instanceof HTMLImageElement?image.naturalWidth:image.width;
        const imageHeight=image instanceof HTMLImageElement?image.naturalHeight:image.height;
        const source=values.length===8?{x:values[0],y:values[1],width:values[2],height:values[3]}:{x:0,y:0,width:imageWidth,height:imageHeight};
        const destination=values.length===8?{x:values[4],y:values[5],width:values[6],height:values[7]}:
          {x:values[0],y:values[1],width:values.length===4?values[2]:imageWidth,height:values.length===4?values[3]:imageHeight};
        this.hitCommands.push({target:this.hitTarget,image,source,destination,transform:context.getTransform(),opacity:context.globalAlpha});
      }
      Reflect.apply(original,context,[image,...values]);
    }) as typeof context.drawImage;
  }
  private withHitTarget(target:SceneHitTarget|undefined,draw:()=>void){
    const previous=this.hitTarget;this.hitTarget=target;
    try{draw();}finally{this.hitTarget=previous;}
  }
  private loop=()=>{
    if(this.destroyed)return;
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
    const previousTarget=this.hitTarget;this.hitTarget={kind:'ship',id:'ship'};
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
      c.drawImage(this.art.ship,layer.cell%2*256,Math.floor(layer.cell/2)*256,256,256,-w/2,-w/2,w,w);
      const lens=shipViews[layer.cell].light,px=(lens.x-128)*w/256,py=(lens.y-128)*w/256;
      c.fillStyle='#5d3b61';c.fillRect(px-1.6,py-1.1,3.2,2.2);c.fillStyle='#ffe1a5';c.fillRect(px-1,py-.6,2,1.2);c.restore();
    }
    this.hitTarget=previousTarget;
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
  private drawRobot(t:number,f:number,p=robotPose(f),animation?:RobotAnimationState){
    const c=this.ctx,moving=p.action==='walk'||p.action==='return';
    t=animation?.workSeconds??t;
    this.shadow(p.x,p.y,31);
    const walkFrame=Math.floor(t*8)%4;
    let frame=moving?walkFrame:p.action==='scan'?4:p.action==='pickup'?(f<.575?5:6):7;
    if(p.action==='unload'&&f<.925)frame=6;
    if(p.action==='unload'&&f>.976)frame=1;
    const bob=animation?robotAnimationPose(p,f,animation).bob:moving?Math.round(Math.sin(t*16))*1:0;
    if(animation||isRenewalRobot(this.art.robot))this.robotPainter.draw(c,this.art.robot,p,f,animation??{workSeconds:t,received:0,appliedWorkMs:0,assistRate:0});
    else this.actor(frame,p.x,p.y+bob,144,p.action==='walk'&&p.facing==='right',p.action==='return',t);
    if(p.parcel.visible)this.parcel(p.parcel.x,p.parcel.y+(p.action==='return'?bob:0),24);
    if(p.action==='scan'&&!animation){
      const tx=p.parcel.x,ty=p.parcel.y;
      c.save();c.fillStyle='#62ebd42d';c.beginPath();c.moveTo(p.x-48,p.y-76);c.lineTo(tx-26,ty);c.lineTo(tx+25,ty);c.fill();
      c.lineWidth=2;c.strokeStyle='#94fff0';c.setLineDash([5,4]);c.beginPath();c.ellipse(tx,ty,27+Math.sin(t*5)*4,10,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
      c.fillStyle='#c7fff2';c.fillRect(tx-2,ty-3,4,4);c.restore();
    }
    if(p.action==='pickup'){
      for(let i=0;i<7;i++){c.fillStyle=i%2?'#fff3bc':'#f4b66e';c.fillRect(p.x-35+Math.cos(i+t*2)*35,p.y-44+Math.sin(i+t*2)*25,3,3);}
    }
    if(p.action==='unload'){
      const pulse=Math.sin((f-.91)/.09*Math.PI);c.fillStyle=`rgba(141,255,216,${pulse*.7})`;c.fillRect(277,406,24,2);c.fillRect(280,400,2,8);
    }
  }
  private parcel(x:number,y:number,size:number){
    const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));const l=-size/2,r=size/2,top=-size;
    c.fillStyle='#663b54';c.fillRect(l-2,top-2,size+4,size+4);c.fillStyle='#efa65d';c.fillRect(l,top,size,size);
    c.fillStyle='#a65b4d';c.beginPath();c.moveTo(r-6,top+5);c.lineTo(r,top);c.lineTo(r,0);c.lineTo(r-6,0);c.fill();
    c.fillStyle='#ffe0a2';c.beginPath();c.moveTo(l,top);c.lineTo(r,top);c.lineTo(r-6,top+5);c.lineTo(l,top+5);c.fill();
    c.fillStyle='#f6d4b1';c.fillRect(-4,top,5,size);c.fillRect(l+2,top+9,7,6);c.fillStyle='#7f4a53';c.fillRect(l+3,top+11,4,1);c.restore();
  }
  private positionWorld(context:CanvasRenderingContext2D){
    context.setTransform(1,0,0,1,32,0);
    const camera=this.extension?.camera;
    if(camera){context.translate(camera.x+(camera.offsetX??0),camera.y+(camera.offsetY??0));context.scale(camera.scale,camera.scale);context.translate(-camera.x,-camera.y);}
  }
  private draw(now:number){
    if(!this.ready||!this.canvas.isConnected)return;
    const began=performance.now(),t=this.frozen??(now-this.start)/1000,s=this.getState();
    this.hitCommands=[];this.hitTarget=undefined;
    let c=this.outputContext;this.ctx=c;
    const baseFraction=this.frozen===null?s.cycleMs/tuning(s).scanner:(t%12)/12;
    const f=this.extension?.cycleFraction?.(baseFraction,t)??baseFraction,p=this.extension?.robotPose?.(robotPose(f),t)??robotPose(f);
    const environment=this.extension?.environment?.(t)??residentEnvironment(worldView(s),t);
    const baseShip=shipPose(t),ship=this.extension?.shipPose?.(baseShip,t)??baseShip;
    const robotAnimation=this.extension?.robotAnimation?.(p,t);
    const frame={t,robot:p,robotAnimation,ship,globe:this.art.globe,environment,output:this.canvas};
    let robotRenderPasses=0,robotRenderSource='base';
    c.imageSmoothingEnabled=false;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,832,740);
    if(!this.extension?.hostBackdrop){
    c.drawImage(this.art.space,0,0,832,740);
    // Blend only the independent space backdrop into the shell's matching
    // starfield. The globe/actors are painted afterwards and never enter this mask.
    c.save();c.globalCompositeOperation='destination-in';
    const spaceEdge=c.createLinearGradient(0,0,0,740);
    spaceEdge.addColorStop(0,'#ffffff00');spaceEdge.addColorStop(40/740,'#ffffffff');
    spaceEdge.addColorStop(700/740,'#ffffffff');spaceEdge.addColorStop(1,'#ffffff00');
    c.fillStyle=spaceEdge;c.fillRect(0,0,832,740);c.restore();
    }
    this.positionWorld(c);
    c.save();c.translate(384,365);c.rotate(-.18);c.lineWidth=1.5;c.strokeStyle='#b49bd350';c.setLineDash([3,12]);c.beginPath();c.ellipse(0,0,350,175,0,0,Math.PI*2);c.stroke();c.restore();
    if(ship.back)this.drawShip(t,ship);
    c=this.worldContext;this.ctx=c;
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,832,740);c.imageSmoothingEnabled=false;this.positionWorld(c);
    this.withHitTarget({kind:'planet',id:'parcel'},()=>c.drawImage(this.art.globe,52,70,664,664));
    // Independent material accents attach to specific pipe/terrain points.
    this.lamp(534,604,'#ffc271',t);this.lamp(535,615,'#f4af56',t+.5);
    const entities:(SceneEntity&{hit?:SceneHitTarget})[]=[
      ...this.extension?.hideLegacySorter?[]:[{depth:294,hit:{kind:'planet' as const,id:'parcel'},draw:()=>{this.shadow(568,294,38);this.sprite(this.art.sorter,568,294,101,101);this.lamp(557,208,'#8ff3df',t);const step=Math.floor(t*3)%3;c.fillStyle='#d7b46d';for(let i=0;i<3;i++)c.fillRect(526+i*7+step,278+i*2,3,2);}}],
      {depth:417,hit:{kind:'planet',id:'parcel'},draw:()=>{this.shadow(315,417,69);this.sprite(this.art.warehouse,315,417,170,156);this.lamp(245,351,'#f4c579',t);c.fillStyle='#c59760';c.fillRect(274,406,26,2);}},
      {depth:p.y,hit:{kind:'robot',id:'robot'},draw:()=>{
        robotRenderPasses++;
        if(this.extension?.drawRobot&&this.extension.drawRobot(c,frame,this.art.robot)!==false){robotRenderSource='extension';return;}
        this.drawRobot(t,f,p,robotAnimation);
      }},
      {depth:449,draw:()=>this.parcel(438,449,26)},
      {depth:294.5,draw:()=>{
    c.fillStyle='#694771';c.fillRect(600,206,3,52);c.fillStyle='#f9c77c';c.fillRect(599,202,5,5);c.fillStyle='#c9758b';c.beginPath();c.moveTo(603,209);c.lineTo(635,213+Math.sin(t*3)*2);c.lineTo(631,229+Math.sin(t*3)*2);c.lineTo(603,226);c.fill();
    c.fillStyle='#ffdb9b';c.fillRect(611,214,8,6);
      }},
    ];
    const residents:ReturnType<typeof drawResident>[]=[];
    for(const id of residentIds){
      if(id!=='mouse'&&!s.collection.includes(id))continue;
      const pose=this.extension?.residentPose?.(id,environment)??residentMotion(id,environment),dayImage=id==='tagbird'?this.art.bird:this.art[id];
      const paintResident=this.extension?.drawResident??drawResident;
      entities.push({depth:pose.depth,hit:s.collection.includes(id)?{kind:'resident',id}:undefined,draw:()=>residents.push(paintResident(c,id,environment,this.residentArt,dayImage))});
    }
    if(this.extension?.worldEntities)entities.push(...this.extension.worldEntities(c,frame));
    entities.sort((a,b)=>a.depth-b.depth).forEach(e=>this.withHitTarget(e.hit??e.hitTarget,e.draw));
    this.extension?.afterWorld(c,frame);
    c=this.outputContext;this.ctx=c;
    c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(this.world,0,0);c.restore();
    if(!ship.back)this.drawShip(t,ship);
    if(now<this.focusUntil){
      const progress=1-(this.focusUntil-now)/2200;
      c.save();c.globalAlpha=(1-progress)*.8;c.strokeStyle=this.focusKind==='glitch'?'#f4b3e7':'#ffe0a2';c.lineWidth=2;
      for(let i=0;i<12;i++){const a=i*Math.PI/6,r=35+progress*95,x=474+Math.cos(a)*r,y=310+Math.sin(a)*r*.6;c.strokeRect(x,y,3,3);}
      c.restore();
    }
    this.canvas.dataset.action=p.action;this.canvas.dataset.ship=ship.back?'back':'front';
    const drawnAnimation=robotAnimation&&robotRenderSource==='base'?robotAnimation:undefined;
    const drawnMotion=drawnAnimation?robotAnimationPose(p,f,drawnAnimation):undefined;
    this.canvas.dataset.legacySorterCount=this.extension?.hideLegacySorter?'0':'1';
    this.canvas.dataset.robotRenderPasses=String(robotRenderPasses);
    this.canvas.dataset.robotRenderSource=robotRenderSource;
    this.canvas.dataset.robotWorkSeconds=String(drawnAnimation?.workSeconds??t);
    this.canvas.dataset.robotGaitFrame=String(drawnMotion?(p.action==='walk'||p.action==='return'?drawnMotion.walkFrame:4):Math.floor(t*8)%4);
    this.canvas.dataset.robotScanAngle=String(p.action==='scan'?(drawnMotion?.scanAngle??0):0);
    this.canvas.dataset.robotReceived=String(drawnAnimation?.received??0);
    this.canvas.dataset.robotAppliedWorkMs=String(drawnAnimation?.appliedWorkMs??0);
    this.canvas.dataset.robotAssistRate=String(drawnAnimation?.assistRate??0);
    this.canvas.dataset.robotAssistVisualIntensity=String(drawnAnimation?.assistVisualIntensity??0);
    this.canvas.dataset.robotAssistVisualTier=String(drawnAnimation?.assistVisualTier??0);
    this.canvas.dataset.robotTorsoLean=String(drawnMotion?.lean??0);
    this.canvas.dataset.robotScanAmplitude=String(drawnMotion?.scanAmplitude??.18);
    this.canvas.dataset.robotAnimationAction=p.action;
    this.canvas.dataset.period=environment.period;
    this.canvas.dataset.residents=JSON.stringify(residents);
    for(const resident of residents)this.canvas.setAttribute(`data-resident-${resident.id}`,resident.action);
    this.drawTimes.push(performance.now()-began);if(this.drawTimes.length>1800)this.drawTimes.shift();
  }
  destroy(){this.destroyed=true;this.active=false;cancelAnimationFrame(this.frame);}
}
