import type {SaveData} from '../game/engine';
import {worldView} from '../game/world';
import {residentEnvironment, type ResidentId} from '../render/resident-motion';
import {loadResidentArt} from '../render/residents';
import {createDailyResidentRenderer} from '../render/v034-residents';
import {residentDailyPose} from '../review/resident-daily';
import {textures} from '../ui/art';
import {fusionRenderElapsed} from './render-clock';
import {FrameCadence} from '../render/frame-cadence';

const backgroundUrls = import.meta.glob('../../assets/runtime/habitat-*-v02.webp', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
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
  const daily = createDailyResidentRenderer();
  const [art, dayPairs, backgrounds] = await Promise.all([
    loadResidentArt(),
    Promise.all((['mouse', 'hermit', 'tagbird'] as const).map(async id => [id, await decode(textures[id])] as const)),
    Promise.all((['mouse', 'hermit', 'tagbird'] as const).map(async id => [id, await decode(backgroundUrls[`../../assets/runtime/habitat-${id}-v02.webp`])] as const)),
    daily.ready,
  ]);
  return {art, daily, dayImages: Object.fromEntries(dayPairs), backgrounds: Object.fromEntries(backgrounds)};
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
      const pose = this.assets.daily.draw(context, this.id, environment, this.assets.art, this.assets.dayImages[this.id]);
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
    this.canvas.dataset.worldMs = String(state.world.elapsedMs);
    this.canvas.dataset.frame = String(Math.floor(elapsed / 65));
    this.canvas.dataset.level = String(level);
    this.canvas.dataset.known = String(known);
  }

  private drawEquipment(level: number) {
    const context = this.context;
    context.fillStyle = '#302b42';context.fillRect(513, 159, 57, 32);
    context.fillStyle = '#aa8965';context.fillRect(515, 156, 53, 4);
    context.fillStyle = '#587c7d';context.fillRect(520, 165, 40, 17);
    context.fillStyle = '#a6d2b8';context.fillRect(524, 169, 22 + level * 3, 2);
    context.fillRect(524, 174, 13 + level * 4, 2);
    context.fillStyle = '#e5c894';context.fillRect(516, 186, 4, 3);context.fillRect(563, 186, 3, 3);
    if (level < 2) return;
    for (let index = 0; index < 4; index++) {
      const x = 473 + index * 8;
      const y = 172 - index % 2 * 7;
      context.fillStyle = '#506d69';context.fillRect(x, y, 2, 26);
      context.fillStyle = '#a9ba8d';context.fillRect(x - 5, y + 3, 6, 3);context.fillRect(x + 1, y - 3, 7, 4);
      context.fillStyle = '#dec7a1';context.fillRect(x + 3, y - 2, 2, 1);
    }
    context.fillStyle = '#b8957b';context.fillRect(469, 194, 35, 5);
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
