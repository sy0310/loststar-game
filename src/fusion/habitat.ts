import type {SaveData} from '../game/engine';
import {worldView} from '../game/world';
import {residentEnvironment, type ResidentId} from '../render/resident-motion';
import {fusionRenderElapsed} from './render-clock';
import {FrameCadence} from '../render/frame-cadence';
import {loadRenewalResidents,drawRenewalResident} from '../render/renewal-residents';
import controlUrl from '../../assets/runtime/visual-renewal/museum/case-2-back.webp';
import {residentDailyPose} from '../review/resident-daily';

const backgroundUrls = import.meta.glob('../../assets/runtime/visual-renewal/museum/habitat-*.webp', {
  eager: true, query: '?url', import: 'default',
}) as Record<string,string>;
const habitatRegistration = {
  mouse: {support: {x: 565, y: 447}, target: {x: 308, y: 184}, scale: 1.45, lamp: {x: 202, y: 67}},
  hermit: {support: {x: 164, y: 400}, target: {x: 315, y: 184}, scale: 1.5, lamp: {x: 122, y: 88}},
  tagbird: {support: {x: 601, y: 203}, target: {x: 115, y: 94}, scale: 1.6, lamp: {x: 84, y: 51}},
} as const;

async function decode(url: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

let sharedArt: Promise<Awaited<ReturnType<typeof loadHabitatArt>>> | undefined;
async function loadHabitatArt() {
 const [renewal,backgrounds,control]=await Promise.all([
  loadRenewalResidents(),
  Promise.all((['mouse','hermit','tagbird'] as const).map(async id=>[id,await decode(backgroundUrls[`../../assets/runtime/visual-renewal/museum/habitat-${id}.webp`])] as const)),
  decode(controlUrl),
 ]);
 return {renewal,control,backgrounds:Object.fromEntries(backgrounds)};
}
function habitatArt() {
  if (!sharedArt) sharedArt = loadHabitatArt().catch(error => {sharedArt = undefined;throw error;});
  return sharedArt;
}

/** Residents retain their registered feet, flight frames and actual persistent day/night routine. */
export class FusionHabitatScene {
  readonly canvas = document.createElement('canvas');
  readonly ready: Promise<void>;
  private context: CanvasRenderingContext2D;
  private assets: Awaited<ReturnType<typeof loadHabitatArt>> | undefined;
  private active = false;
  private disposed = false;
  private frame = 0;
  private interactionAt = -Infinity;
  private cadence = new FrameCadence();

  constructor(
    root: HTMLElement,
    private id: ResidentId,
    private getState: () => SaveData,
    private level: () => number = () => 0,
  ) {
    this.canvas.width = 600;
    this.canvas.height = 220;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', '居民生态观察区');
    this.context = this.canvas.getContext('2d')!;
    root.append(this.canvas);
    this.ready = habitatArt().then(assets => {
      if (this.disposed) return;
      this.assets = assets;
      this.canvas.dataset.ready = 'true';
      this.draw();
    }).catch(() => {
      this.canvas.dataset.ready = 'error';
      this.canvas.setAttribute('aria-label', '观察区暂未接通');
    });
  }

  setActive(active: boolean) {
    if (this.disposed) return;
    if (this.active !== active) this.cadence.reset();
    this.active = active;
    if (active && !this.frame) this.frame = requestAnimationFrame(this.loop);
    if (active && this.assets) this.draw();
  }

  /** A free local observation animation; never changes discovery, currency or the world clock. */
  interact() {
    if(this.disposed||!this.getState().collection.includes(this.id))return false;
    if(performance.now()-this.interactionAt<2600)return true;
    this.interactionAt=performance.now();
    if(this.assets)this.draw();
    return true;
  }

  dispose() {
    this.active = false;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private loop = (milliseconds: number) => {
    this.frame = 0;
    if (this.disposed || !this.active || !this.canvas.isConnected) return;
    if (!document.hidden && this.cadence.draw(milliseconds, 1000 / 30)) {
      this.draw();
    }
    this.frame = requestAnimationFrame(this.loop);
  };

  private draw() {
    if (!this.assets || this.disposed) return;
    const state = this.getState();
    const elapsed = fusionRenderElapsed(state, Date.now());
    const visualState = {...state, world: {...state.world, elapsedMs: elapsed}};
    const environment = residentEnvironment(worldView(visualState), elapsed / 1000);
    const trialAge=(performance.now()-this.interactionAt)/1000;
    const trial=trialAge>=0&&trialAge<2.6;
    const observationEnvironment=trial?{...environment,period:'day' as const,rest:0,seconds:({mouse:5.1,hermit:4.3,tagbird:.1}[this.id])+trialAge*.7}:environment;
    const known = state.collection.includes(this.id);
    const level = Math.max(0, Math.min(3, this.level()));
    const context = this.context;
    context.imageSmoothingEnabled = false;
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#191523';
    context.fillRect(0, 0, 600, 220);
    context.drawImage(this.assets.backgrounds[this.id], 0, 10, 600, 200);
    context.save();
    context.beginPath();context.rect(14, 16, 572, 189);context.clip();
    if (known) {
      const registration = habitatRegistration[this.id];
      context.save();
      context.translate(registration.target.x - registration.support.x * registration.scale,
        registration.target.y - registration.support.y * registration.scale);
      context.scale(registration.scale, registration.scale);
      const settled=residentDailyPose(this.id,environment);
      const ramp=(n:number)=>{const p=Math.max(0,Math.min(1,n));return p*p*(3-2*p);};
      const pose = drawRenewalResident(context,this.id,observationEnvironment,this.assets.renewal,trial?{origin:settled,blend:ramp(trialAge/.35)*ramp((2.6-trialAge)/.45)}:undefined);
      context.restore();
      this.canvas.dataset.action = pose.action;
      this.canvas.dataset.source = pose.source;
      this.canvas.dataset.poseX = String(pose.x);
      this.canvas.dataset.poseY = String(pose.y);
    } else {
      this.canvas.dataset.action = 'unseen';
      this.canvas.dataset.source = 'hidden';
    }
    if (level > 0) this.drawEquipment(level);
    if (environment.light > 0) {
      context.save();context.globalCompositeOperation = 'multiply';context.globalAlpha = environment.light * .8;
      context.fillStyle = '#586e96';context.fillRect(0, 0, 600, 220);context.restore();
      const lamp = habitatRegistration[this.id].lamp;
      const light = context.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 82);
      light.addColorStop(0, '#f8ce8b55');light.addColorStop(1, '#f8ce8b00');
      context.save();context.globalCompositeOperation = 'screen';context.globalAlpha = environment.light;
      context.fillStyle = light;context.fillRect(lamp.x - 82, lamp.y - 82, 164, 164);
      context.fillStyle = '#f9dba6';context.fillRect(lamp.x - 3, lamp.y - 2, 6, 3);context.restore();
    }
    context.restore();
    this.drawGlass(level);
    this.canvas.dataset.period = environment.period;
    this.canvas.dataset.trial=String(trial);
    this.canvas.dataset.worldMs = String(state.world.elapsedMs);
    this.canvas.dataset.frame = String(Math.floor(elapsed / 65));
    this.canvas.dataset.level = String(level);
    this.canvas.dataset.known = String(known);
  }

  private drawEquipment(level: number) {
    const c=this.context;
    // The same authored copper instrument used by the display microclimate,
    // registered as a small habitat-side controller rather than a flat UI block.
    c.fillStyle='#24134265';c.beginPath();c.ellipse(543,194,30,5,0,0,Math.PI*2);c.fill();
    c.drawImage(this.assets!.control,246,140,62,144,520,110,53,84);
    c.fillStyle='#68dafa';c.fillRect(541,145,15,2);
    if(level<2)return;
    c.fillStyle='#39224f';c.fillRect(461,187,54,10);c.fillStyle='#e3a454';c.fillRect(461,185,54,3);
    if(this.id==='mouse'){
      for(let i=0;i<4;i++){c.fillStyle=i%2?'#e6bb7e':'#f6d6a0';c.fillRect(468+i*2,180-i*3,36,3);c.fillStyle='#9f77b7';c.fillRect(471+i*2,180-i*3,17,1);}
    }else if(this.id==='hermit'){
      c.fillStyle='#e3a454';c.fillRect(470,162,32,23);c.fillStyle='#aa6d50';c.fillRect(470,173,32,12);c.fillStyle='#f5d7a0';c.fillRect(483,162,7,23);c.fillStyle='#ead0a0';c.fillRect(474,170,8,5);
    }else{
      c.strokeStyle='#e3a454';c.lineWidth=4;c.beginPath();c.moveTo(468,185);c.lineTo(468,145);c.quadraticCurveTo(484,133,500,145);c.lineTo(500,185);c.stroke();c.fillStyle='#c89c69';c.fillRect(469,161,31,4);
    }
    if(level<3)return;
    c.strokeStyle='#c49758';c.lineWidth=3;c.beginPath();c.moveTo(571,186);c.lineTo(577,186);c.lineTo(577,96);c.lineTo(525,96);c.stroke();
    c.fillStyle='#e3a454';c.fillRect(520,91,59,5);c.fillStyle='#ffe0a2';c.fillRect(523,96,49,2);
  }

  private drawGlass(level: number) {
    const context = this.context;
    context.fillStyle = '#bce4ed09';context.fillRect(10, 11, 580, 199);
    context.fillStyle = '#e3edfba0';context.fillRect(15, 22, 2, 116);context.fillRect(20, 23, 3, 31);
    context.fillStyle = '#c6e5ed60';context.fillRect(578, 49, 2, 83);
    context.strokeStyle = level >= 2 ? '#b7b29b' : '#a58763';
    context.lineWidth = 4;context.strokeRect(4, 6, 592, 208);
    context.strokeStyle = '#3c3047';context.lineWidth = 2;context.strokeRect(9, 11, 582, 198);
    context.fillStyle = level >= 1 ? '#b8d4b8' : '#b79871';
    for (const x of [12, 579]) for (const y of [14, 198]) context.fillRect(x, y, 8, 3);
  }
}
