import type {SceneFrame} from '../render/scene';
import type {NightActorFrame} from '../prototype/night-model';

export function anomalyPoint(actor: Pick<NightActorFrame, 'id' | 'progress' | 'status' | 'alpha'>, seconds: number) {
  const progress = actor.progress;
  const arrival = actor.status === 'arrived' ? 1 - actor.alpha : 0;
  const x = 546 - progress * 256;
  const groundY = 470 - progress * 60 + Math.sin(progress * Math.PI) * 8;
  if (actor.id === 0) {
    const hop = actor.status === 'approaching' ? Math.abs(Math.sin(seconds * 5.2)) * 9 : 0;
    return {x, y: groundY - hop - arrival * 44, groundY, hop};
  }
  const flutter = actor.status === 'approaching' ? Math.sin(seconds * 4.1) * 7 : 0;
  return {x: x + Math.sin(seconds * 1.8) * 7, y: groundY - 42 + flutter - arrival * 22, groundY, hop: 42 - flutter};
}

function paperPattern(context: CanvasRenderingContext2D) {
  context.fillStyle = '#b38d66';
  for (let index = 0; index < 10; index++) {
    const x = -18 + (index * 11) % 33;
    const y = -25 + (index * 7) % 23;
    context.fillRect(x, y, 2 + index % 3, 1);
  }
}

function drawBox(context: CanvasRenderingContext2D, actor: NightActorFrame, seconds: number) {
  const folding = actor.status === 'intercepted' ? 1 - actor.alpha : 0;
  const lid = actor.stunned ? .3 : .5 + Math.sin(seconds * 5.2) * .15;
  context.scale(1, 1 - folding * .76);
  context.fillStyle = '#302a40';
  context.fillRect(-24, -40, 48, 39);
  context.fillStyle = '#d1a16c';
  context.fillRect(-22, -37, 43, 34);
  context.fillStyle = '#9d6d58';
  context.beginPath();context.moveTo(13, -34);context.lineTo(23, -40);context.lineTo(23, -5);context.lineTo(13, 0);context.fill();
  context.fillStyle = '#ebc891';
  context.fillRect(-22, -38, 35, 3);
  context.fillStyle = '#754e4b';
  context.fillRect(-21, -34, 35, 5);
  context.save();context.translate(-22, -37);context.transform(1, -.17 - lid * .4, .15, 1, 0, 0);
  context.fillStyle = '#4b3b4e';context.fillRect(-2, -7, 38, 9);
  context.fillStyle = '#e3ba83';context.fillRect(0, -6, 34, 6);
  context.fillStyle = '#f1d4a3';context.fillRect(0, -6, 31, 1);
  context.restore();
  paperPattern(context);
  context.fillStyle = '#e8d2ad';context.fillRect(-8, -26, 17, 14);
  context.fillStyle = '#7b6660';context.fillRect(-6, -23, 12, 1);context.fillRect(-6, -20, 8, 1);
  context.fillStyle = '#524052';context.fillRect(-15, -31, 4, 4);context.fillRect(8, -31, 4, 4);
  context.fillStyle = '#d6e7c7';context.fillRect(-14, -31, 2, 2);context.fillRect(8, -31, 2, 2);
  context.fillStyle = '#bd8061';context.fillRect(-21, -5, 34, 2);
}

function drawMoth(context: CanvasRenderingContext2D, actor: NightActorFrame, seconds: number) {
  const fold = actor.status === 'intercepted' ? 1 - actor.alpha : 0;
  const flap = actor.stunned ? .65 : .4 + Math.abs(Math.sin(seconds * 11)) * .6;
  for (const side of [-1, 1]) {
    context.save();context.scale(side, 1);context.transform(1, -.16 * side, .08, 1, 0, 0);context.scale((1 - fold * .85) * flap, 1);
    context.fillStyle = '#46445d';
    context.beginPath();context.moveTo(0, -22);context.lineTo(24, -34);context.lineTo(30, -17);context.lineTo(17, -4);context.lineTo(1, -3);context.closePath();context.fill();
    context.fillStyle = '#c4d3c1';
    context.beginPath();context.moveTo(3, -22);context.lineTo(23, -31);context.lineTo(27, -18);context.lineTo(15, -7);context.lineTo(3, -6);context.closePath();context.fill();
    context.fillStyle = '#e5e5ca';context.fillRect(11, -26, 8, 3);context.fillRect(7, -20, 12, 2);
    context.fillStyle = '#8a9f9c';context.fillRect(13, -16, 7, 1);context.fillRect(10, -13, 4, 1);
    context.fillStyle = '#ac8d7b';context.fillRect(21, -24, 3, 3);
    context.restore();
  }
  context.fillStyle = '#383b54';context.fillRect(-3, -26, 6, 25);
  context.fillStyle = '#d4b482';context.fillRect(-2, -25, 4, 20);
  context.fillStyle = '#eee5c4';context.fillRect(-1, -29, 2, 4);context.fillRect(-5, -31, 2, 3);context.fillRect(3, -31, 2, 3);
  context.fillStyle = '#faf4cc';context.fillRect(-3, -25, 2, 2);context.fillRect(1, -25, 2, 2);
}

/** Two authored paper creatures share the real model's movement and outcome. */
export function drawFusionAnomaly(context: CanvasRenderingContext2D, actor: NightActorFrame, frame: SceneFrame) {
  const point = anomalyPoint(actor, frame.environment.seconds);
  context.save();context.globalAlpha = actor.alpha;
  context.fillStyle = '#17182e70';context.beginPath();context.ellipse(point.x, point.groundY + 2, actor.id === 0 ? 22 : 16, 5, 0, 0, Math.PI * 2);context.fill();
  context.translate(Math.round(point.x), Math.round(point.y));
  context.scale(1.25, 1.25);
  if (actor.id === 0) drawBox(context, actor, frame.environment.seconds);
  else drawMoth(context, actor, frame.environment.seconds);
  if (actor.stunned) {
    context.fillStyle = '#d8f4d5';context.fillRect(-30, -18, 2, 5);context.fillRect(29, -18, 2, 5);
    context.strokeStyle = '#d8f4d580';context.lineWidth = 1;
    context.beginPath();context.ellipse(0, -15, 32, 10, 0, 0, Math.PI * 2);context.stroke();
  }
  context.restore();
}

export function drawContainedAnomaly(context: CanvasRenderingContext2D, id: number, position: {x: number; y: number}, opacity: number) {
  context.save();context.globalAlpha = opacity;context.translate(position.x, position.y + 8);
  if (id === 0) {
    context.fillStyle = '#4e3c4d';context.fillRect(-12, -14, 24, 14);
    context.fillStyle = '#c8a578';context.fillRect(-10, -13, 20, 11);
    context.fillStyle = '#edcf97';context.fillRect(-10, -13, 19, 2);
    context.fillStyle = '#eee0bd';context.fillRect(-2, -11, 3, 8);
    context.fillStyle = '#7b6d66';context.fillRect(2, -6, 5, 2);
  } else {
    context.fillStyle = '#d6dfc4';
    context.beginPath();context.moveTo(0, -14);context.lineTo(-12, -9);context.lineTo(-4, 0);context.lineTo(0, -4);context.lineTo(5, 0);context.lineTo(12, -9);context.closePath();context.fill();
    context.fillStyle = '#8fa6a2';context.fillRect(-8, -8, 6, 1);context.fillRect(3, -8, 5, 1);
    context.fillStyle = '#ccad7a';context.fillRect(-1, -12, 2, 11);
  }
  context.restore();
}
