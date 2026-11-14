import {drawResident, type ResidentDrawResult} from './residents';
import {residentDailyPose} from '../review/resident-daily';
import type {ResidentId} from './resident-motion';
import refinement from '../../assets/runtime/v034-refine/registration.json';

interface DailyFrame {file: string; contact: {x: number; y: number}; displayScale: number}
interface Registration {residents: Record<ResidentId, {frames: DailyFrame[]}>}
const urls = import.meta.glob('../../assets/runtime/v034/resident-*.webp', {eager: true, query: '?url', import: 'default'}) as Record<string, string>;
const registrations = import.meta.glob('../../assets/runtime/v034/registration.json', {eager: true, import: 'default'}) as Record<string, Registration>;

export function createDailyResidentRenderer() {
  const registration = Object.values(registrations)[0];
  const images: Record<string, HTMLImageElement> = {};
  const ready = Promise.all(Object.entries(urls).map(async ([path, url]) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    images[path.split('/').at(-1)!] = image;
  })).then(() => {
    for (const id of ['mouse', 'hermit', 'tagbird'] as const) {
      if (registration?.residents[id]?.frames.length !== 2) throw Error(`Missing daily poses for ${id}`);
      for (const frame of registration.residents[id].frames) {
        if (!images[frame.file]) throw Error(`Missing daily resident image ${frame.file}`);
      }
    }
  });
  const draw: typeof drawResident = (context, id, environment, art, dayImage) => {
    const pose = residentDailyPose(id, environment);
    if (environment.period !== 'day') return drawResident(context, id, environment, art, dayImage);
    const daily = pose.dailyFrame === null ? null : registration.residents[id].frames[pose.dailyFrame];
    const flight = id === 'tagbird' && !daily ? art.registration.residents[id].flightFrames?.[pose.frame] : null;
    const selected = daily ?? flight;
    const image = daily ? images[daily.file] : flight ? art.images[flight.file] : dayImage;
    const contact = selected?.contact ?? art.registration.residents[id].dayContact;
    const scale = id === 'tagbird' && daily
      ? refinement.residentDaily.bird.displayScale
      : selected?.displayScale ?? pose.width / image.naturalWidth;
    context.save();
    context.fillStyle = id === 'tagbird' ? '#28233b30' : '#30203965';
    context.beginPath();
    context.ellipse(pose.x, id === 'tagbird' ? 294 : pose.y + 1, pose.shadow, pose.shadow * .22, 0, 0, Math.PI * 2);
    context.fill();
    context.translate(Math.round(pose.x), Math.round(pose.y));
    if (pose.flip) context.scale(-1, 1);
    const left = -contact.x * scale;
    const top = -contact.y * scale;
    const width = image.naturalWidth * scale;
    if (!selected && id !== 'tagbird') {
      const split = image.naturalHeight * .81;
      const footstep = Math.sin(environment.seconds * (id === 'mouse' ? 7 : 4)) * .85;
      context.drawImage(image, 0, 0, image.naturalWidth, split, left, top, width, split * scale);
      context.drawImage(image, 0, split, image.naturalWidth, image.naturalHeight - split,
        left + footstep, top + split * scale, width, (image.naturalHeight - split) * scale);
    } else context.drawImage(image, left, top, width, image.naturalHeight * scale);
    context.restore();
    return {...pose, source: selected?.file ?? `original-${id}`, flightArt: !!flight} satisfies ResidentDrawResult;
  };
  return {ready, draw};
}
