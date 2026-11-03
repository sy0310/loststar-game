import {residentIds, residentMotion, type ResidentEnvironment, type ResidentId} from './resident-motion';

interface ResidentFrame {
  file: string;
  contact: {x: number; y: number};
  displayScale: number;
}
interface ResidentRegistration {
  residents: Record<ResidentId, {
    dayContact: {x: number; y: number};
    frames: ResidentFrame[];
    flightFrames?: ResidentFrame[];
  }>;
}
const textures = import.meta.glob('../../assets/runtime/resident-cycle/*.webp', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const registrations = import.meta.glob('../../assets/runtime/resident-cycle/registration.json', {
  eager: true, import: 'default',
}) as Record<string, ResidentRegistration>;

export async function loadResidentArt() {
  const registration = Object.values(registrations)[0];
  if (!registration) throw Error('Resident pose registration is missing');
  const pairs = await Promise.all(Object.entries(textures).map(async ([path, url]) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return [path.split('/').at(-1)!, image] as const;
  }));
  const images = Object.fromEntries(pairs);
  for (const id of residentIds) {
    const resident = registration.residents[id];
    if (resident.frames.length !== 2 || (id === 'tagbird' && resident.flightFrames?.length !== 2)) {
      throw Error(`Resident ${id} requires its complete resting and flying poses`);
    }
    for (const frame of [...resident.frames, ...(resident.flightFrames ?? [])]) {
      if (!images[frame.file]) throw Error(`Resident pose ${frame.file} is missing`);
    }
  }
  return {registration, images};
}
export type ResidentArt = Awaited<ReturnType<typeof loadResidentArt>>;

export function drawResident(
  context: CanvasRenderingContext2D,
  id: ResidentId,
  environment: ResidentEnvironment,
  art: ResidentArt,
  dayImage: HTMLImageElement,
) {
  const pose = residentMotion(id, environment);
  const registration = art.registration.residents[id];
  const flight = id === 'tagbird' && !pose.nightArt ? registration.flightFrames?.[pose.frame] : undefined;
  const selected = pose.nightArt ? registration.frames[pose.frame] : flight;
  const image = selected ? art.images[selected.file] : dayImage;
  const scale = selected?.displayScale ?? pose.width / dayImage.naturalWidth;
  const contact = selected?.contact ?? registration.dayContact;
  const shadowY = id === 'tagbird' && !pose.nightArt ? 294 : pose.y + 1;
  context.save();
  context.fillStyle = id === 'tagbird' ? '#28233b30' : '#30203965';
  context.beginPath();
  context.ellipse(pose.x, shadowY, pose.shadow, pose.shadow * .22, 0, 0, Math.PI * 2);
  context.fill();
  context.translate(Math.round(pose.x), Math.round(pose.y));
  if (pose.flip) context.scale(-1, 1);
  const left = -contact.x * scale;
  const top = -contact.y * scale;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  if (!selected && id !== 'tagbird') {
    // Feet advance independently while the torso carries its load.
    const split = image.naturalHeight * .81;
    const step = Math.sin(environment.seconds * (id === 'mouse' ? 7 : 4)) * .85 * (1 - environment.rest);
    context.drawImage(image, 0, 0, image.naturalWidth, split, left, top, width, split * scale);
    context.drawImage(image, 0, split, image.naturalWidth, image.naturalHeight - split,
      left + step, top + split * scale, width, (image.naturalHeight - split) * scale);
  } else {
    context.drawImage(image, left, top, width, height);
  }
  if (id === 'mouse' && environment.rest < .1 && Math.floor(environment.seconds * 2) % 6 < 2) {
    context.fillStyle = '#e8cc9e';
    for (let index = 0; index < 3; index++) {
      context.fillRect(-25 + index * 6, -33 - index * 3 + Math.sin(environment.seconds * 3 + index), 2, 1);
    }
  }
  context.restore();
  return {...pose, flightArt: !!flight, source: selected?.file ?? `original-${id}`};
}
