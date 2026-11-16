import type {SceneFrame} from '../render/scene';
import {robotScannerPoint} from '../render/motion';

export interface FusionFeedbackEvent {
  token: number;
  kind: 'contact' | 'accepted' | 'rejected' | 'inspect';
  x: number;
  y: number;
  at: number;
  reason?: string;
}
interface FeedbackStroke {
  token: number;
  output: {x: number; y: number};
  point?: {x: number; y: number};
  contactAt?: number;
  acceptedAt?: number;
  rejectedAt?: number;
  inspectAt?: number;
  contactDrawn: boolean;
  acceptedDrawn: boolean;
}
export interface FusionFeedbackSample {token: number; kind: 'contact' | 'accepted'; eventAt: number; firstPaintAt: number; firstPaintMs: number}
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function ring(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
  context.save();context.globalAlpha = alpha;context.strokeStyle = color;context.lineWidth = 1.5;
  context.beginPath();context.ellipse(x, y, radius, radius * .34, 0, 0, Math.PI * 2);context.stroke();
  context.fillStyle = color;
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    context.fillRect(Math.round(x + Math.cos(angle) * radius) - 1, Math.round(y + Math.sin(angle) * radius * .34) - 1, 2, 2);
  }
  context.restore();
}

/** Each input owns a bounded lifetime. Coordinates are registered once through the actual camera. */
export function createWorldFeedback() {
  const strokes: FeedbackStroke[] = [];
  const samples: FusionFeedbackSample[] = [];
  let workUntil = -Infinity;
  let lastWork = 0;
  const firstDraw = (stroke: FeedbackStroke, kind: 'contact' | 'accepted', at: number, now: number) => {
    if (kind === 'contact' ? stroke.contactDrawn : stroke.acceptedDrawn) return;
    if (kind === 'contact') stroke.contactDrawn = true;
    else stroke.acceptedDrawn = true;
    samples.push({token: stroke.token, kind, eventAt: at, firstPaintAt: now, firstPaintMs: Math.max(0, now - at)});
    if (samples.length > 240) samples.shift();
  };
  return {
    accept(event: FusionFeedbackEvent) {
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y) || !Number.isFinite(event.at)) return;
      let stroke = strokes.find(item => item.token === event.token);
      if (!stroke) {
        stroke = {token: event.token, output: {x: event.x, y: event.y}, contactDrawn: false, acceptedDrawn: false};
        strokes.push(stroke);
        if (strokes.length > 6) strokes.shift();
      }
      if (event.kind === 'contact') stroke.contactAt = event.at;
      if (event.kind === 'accepted') stroke.acceptedAt = event.at;
      if (event.kind === 'rejected') stroke.rejectedAt = event.at;
      if (event.kind === 'inspect') stroke.inspectAt = event.at;
    },
    metrics() {return {active: strokes.length, samples: samples.map(sample => ({...sample})), measuredAt: 'Canvas draw call, before browser presentation'};},
    draw(context: CanvasRenderingContext2D, frame: SceneFrame, appliedWork: number) {
      const now = performance.now();
      const transform = context.getTransform();
      const inverse = transform.inverse();
      const scanner = robotScannerPoint(frame.robot, frame.t, frame.robotAnimation);
      if (appliedWork > lastWork + .001 && frame.environment.period !== 'night') workUntil = now + 380;
      lastWork = appliedWork;
      for (let index = strokes.length - 1; index >= 0; index--) {
        const stroke = strokes[index];
        if (!stroke.point) {
          const point = inverse.transformPoint(stroke.output);
          stroke.point = {x: point.x, y: point.y};
        }
        const point = stroke.point;
        const endAt = Math.max(stroke.contactAt ?? -Infinity, stroke.acceptedAt ?? -Infinity,
          stroke.rejectedAt ?? -Infinity, stroke.inspectAt ?? -Infinity);
        if (now - endAt > 1150) {strokes.splice(index, 1);continue;}
        if (stroke.contactAt !== undefined && now - stroke.contactAt < 400) {
          const progress = clamp((now - stroke.contactAt) / 400);
          ring(context, point.x, point.y, 5 + progress * 14, '#e8c79e', (1 - progress) * .7);
          firstDraw(stroke, 'contact', stroke.contactAt, now);
        }
        if (stroke.rejectedAt !== undefined) {
          const progress = clamp((now - stroke.rejectedAt) / 500);
          ring(context, point.x, point.y, 14 - progress * 4, '#d7aa7d', (1 - progress) * .8);
        }
        if (stroke.inspectAt !== undefined) {
          const progress = clamp((now - stroke.inspectAt) / 850);
          ring(context, point.x, point.y, 15 + progress * 14, '#c2d4b9', (1 - progress) * .8);
        }
        if (stroke.acceptedAt === undefined || stroke.rejectedAt !== undefined || frame.environment.period === 'night') continue;
        const age = now - stroke.acceptedAt;
        const progress = clamp(age / 650);
        if (progress < 1) {
          ring(context, point.x, point.y, 5 + progress * 20, '#efc897', (1 - progress) * .75);
          const amount = clamp(age / 350);
          const x = point.x + (scanner.x - point.x) * amount;
          const y = point.y + (scanner.y - point.y) * amount - Math.sin(amount * Math.PI) * 8;
          context.save();context.globalAlpha = (1 - progress) * .9;
          context.fillStyle = '#f6d69e';context.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);context.restore();
          firstDraw(stroke, 'accepted', stroke.acceptedAt, now);
        }
      }
      if (now < workUntil && frame.environment.period !== 'night') {
        const power = clamp((workUntil - now) / 380);
        context.save();context.globalCompositeOperation = 'screen';context.globalAlpha = power * .65;
        context.fillStyle = '#f6d69e';context.fillRect(Math.round(scanner.x) - 3, Math.round(scanner.y) - 2, 6, 4);
        context.globalAlpha *= .45;
        context.fillRect(Math.round(scanner.x) - 7, Math.round(scanner.y) - 4, 14, 8);context.restore();
      }
    },
  };
}
