import {exhibits as bays, itemCenter} from './museum-layout';

const visits = [3, 1, 5, 0, 4, 2];
const hub = {x: 384, y: 918};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {const t = clamp(value);return t * t * (3 - 2 * t);};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A rounded aisle. Outbound and return trips share the same physical route. */
function aisle(target: {x: number; y: number}, fraction: number) {
  const directionX = Math.sign(target.x - hub.x);
  const directionY = Math.sign(target.y - hub.y);
  const radius = 26;
  const horizontal = Math.abs(target.x - hub.x) - radius;
  const vertical = Math.abs(target.y - hub.y) - radius;
  const cornerLength = radius * Math.PI / 2;
  const distance = smooth(fraction) * (horizontal + cornerLength + vertical);
  if (distance < horizontal) return {x: hub.x + directionX * distance, y: hub.y, turn: 0};
  if (distance < horizontal + cornerLength) {
    const angle = (distance - horizontal) / cornerLength * Math.PI / 2;
    return {x: target.x - directionX * radius + directionX * Math.sin(angle) * radius,
      y: hub.y + directionY * (1 - Math.cos(angle)) * radius, turn: Math.sin(angle)};
  }
  return {x: target.x, y: hub.y + directionY * (radius + distance - horizontal - cornerLength), turn: 1};
}

export function baseRobotPose(seconds: number, layout: typeof bays = bays) {
  const time = Math.max(0, seconds);
  const index = Math.floor(time / 14) % visits.length;
  const bay = layout[visits[index]];
  const t = time % 14;
  const service = {x: visits[index] % 3 === 0 ? 270 : 500, y: bay.y + 42};
  let action: 'walk' | 'observe' | 'open' | 'lift' | 'inspect' | 'place' | 'wipe' | 'return';
  let position = {...service, turn: 1};
  let lift = 0;
  let opening = 0;
  if (t < 4) {action = 'walk';position = aisle(service, t / 4);}
  else if (t < 5.5) action = 'observe';
  else if (t < 6.2) {action = 'open';opening = smooth((t - 5.5) / .7);}
  else if (t < 7.2) {action = 'lift';opening = 1;lift = smooth(t - 6.2);}
  else if (t < 8.2) {action = 'inspect';opening = 1;lift = 1;}
  else if (t < 9.2) {action = 'place';opening = 1;lift = 1 - smooth(t - 8.2);}
  else if (t < 10) {action = 'wipe';opening = 1 - smooth((t - 9.2) / .8);}
  else {action = 'return';position = aisle(service, 1 - (t - 10) / 4);}

  const towardBay = bay.x < service.x ? -1 : 1;
  const walkingDirection = (action === 'return' ? -1 : 1) * Math.sign(service.x - hub.x);
  const facing = (action === 'walk' || action === 'return') && position.turn < .55 ? walkingDirection : towardBay;
  const center = itemCenter(bay);
  const shoulder = {x: position.x + towardBay * 17, y: position.y - 54};
  const held = {x: position.x + towardBay * 35, y: position.y - 61};
  const inspect = smooth((t - 7.2) / .35) * (1 - smooth((t - 7.85) / .35));
  const item = {x: lerp(center.x, held.x, lift), y: lerp(center.y, held.y - inspect * 4, lift)};
  const contact = smooth((t - 5.55) / .55) * (1 - smooth((t - 9.05) / .45));
  const rest = smooth(t / .4) * (1 - smooth((t - 13.6) / .4));
  const hand = {x: lerp(position.x + towardBay * 27 * rest, item.x + towardBay * 7, contact),
    y: lerp(position.y - 48, item.y + 13, contact)};
  const specimenEnvelope=clamp(1-smooth((t-4.1)/1.1)+smooth((t-9.2)/.8));
  const turn = Math.sin(position.turn * Math.PI) * (action === 'walk' || action === 'return' ? 1 : 0);
  return {...position, action, target: bay.id, lift, opening, facing, hand, shoulder, item, contact, turn, specimenEnvelope, width: 108};
}
