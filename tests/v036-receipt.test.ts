import {describe, expect, it} from 'vitest';
import {beginReceiptRestoration, createReceiptRestorationState, advanceReceiptRestoration} from '../src/review/receipt-restoration';
import {receiptRestorationRegistration} from '../src/render/receipt-restoration';
import {v036BrushPose, v036ReceiptFrame, v036ReceiptGlassPlacement, v036BrushToolTransform, v037ReceiptFrame} from '../src/review/v036-receipt';

describe('V036 isolated receipt contact storyboard', () => {
  it('aligns the actual asymmetric glass floor with the paper receiver', () => {
    const placement = v036ReceiptGlassPlacement();
    expect(placement.sourceReceiver).toEqual({x: 172.5, y: 263.5});
    expect(placement.rect.x).toBeCloseTo(-73.515625);
    expect(placement.rect.y).toBeCloseTo(45.34375);
    expect(placement.receiver).toEqual({x: 320, y: 490});
    // Changing either output size or target still uses the same measured source floor.
    const shifted = v036ReceiptGlassPlacement({width: 320, height: 320}, {x: 215, y: 430}, {width: 510, height: 410});
    expect(shifted.rect.x + 172.5 / 320 * shifted.rect.width).toBeCloseTo(215);
    expect(shifted.rect.y + 263.5 / 320 * shifted.rect.height).toBeCloseTo(430);
  });

  it('stages material work before glass and the flavor performance', () => {
    const samples = [
      [0, 'soil'], [2, 'release'], [4.5, 'support'], [7, 'dirty'], [10, 'cleaning'],
      [14.5, 'clean'], [16, 'repairing'], [21, 'display'], [25, 'trying'], [28, 'complete'],
    ] as const;
    for (const [seconds, phase] of samples) expect(v036ReceiptFrame(seconds).phase).toBe(phase);
  });

  it('preserves the same original ink and missing signature throughout every visual state', () => {
    for (let seconds = 0; seconds <= 32; seconds += .1) {
      const frame = v036ReceiptFrame(seconds);
      expect(frame.originalCode).toBe('RET-031');
      expect(frame.missingSignature).toBe(true);
      expect(frame.evidenceCount).toBe(0);
      expect(frame.flavorOnly).toBe(true);
    }
  });

  it('cleans before installing two independently timed patches', () => {
    const before = v036ReceiptFrame(14.5);
    expect(before.cleaning).toBe(1);
    expect(before.upperPatch).toBe(0);
    expect(before.lowerPatch).toBe(0);
    const first = v036ReceiptFrame(17.2);
    expect(first.upperPatch).toBe(1);
    expect(first.lowerPatch).toBe(0);
    const second = v036ReceiptFrame(19.2);
    expect(second.upperPatch).toBe(1);
    expect(second.lowerPatch).toBe(1);
    expect(second.glass).toBe(0);
  });

  it('compresses the soft fan at its actual contact while its handle and arm remain attached', () => {
    const brush = receiptRestorationRegistration().tools.brush;
    const free = v036BrushToolTransform(0);
    const pressed = v036BrushToolTransform(1);
    for (const pressure of [0, .25, .5, .75, 1]) {
      const transform = v036BrushToolTransform(pressure);
      const m = transform.bristles;
      expect(m.a * brush.contact.x + m.c * brush.contact.y + m.e).toBeCloseTo(0);
      expect(m.b * brush.contact.x + m.d * brush.contact.y + m.f).toBeCloseTo(0);
      // The handle root follows the deformed bristle root, and the arm grips that actual handle.
      expect(transform.handleOrigin.x + brush.root.x).toBeCloseTo(m.a * brush.root.x + m.c * brush.root.y + m.e);
      expect(transform.handleOrigin.y + brush.root.y).toBeCloseTo(m.b * brush.root.x + m.d * brush.root.y + m.f);
      expect(transform.handleGrip.x).toBeCloseTo(transform.handleOrigin.x + brush.pivot.x);
      expect(transform.handleGrip.y).toBeCloseTo(transform.handleOrigin.y + brush.pivot.y);
    }
    const freeLength = Math.hypot(free.handleOrigin.x + brush.root.x, free.handleOrigin.y + brush.root.y);
    const pressedLength = Math.hypot(pressed.handleOrigin.x + brush.root.x, pressed.handleOrigin.y + brush.root.y);
    expect(pressedLength / freeLength).toBeCloseTo(.7);
  });

  it('lifts the brush on every return stroke without dirt contact', () => {
    for (let pass = 0; pass < 7; pass++) {
      const sweeping = v036BrushPose((pass + .35) / 8);
      const returning = v036BrushPose((pass + .86) / 8);
      expect(sweeping.contact).toBe(true);
      expect(sweeping.pressure).toBe(1);
      expect(returning.contact).toBe(false);
      expect(returning.pressure).toBe(0);
      expect(returning.lift).toBeGreaterThan(10);
      expect(returning.source.y).toBeGreaterThan(sweeping.source.y);
    }
  });

  it('alternates brush directions and holds finished physical states during a free replay', () => {
    expect(v036BrushPose(.35 / 8).source.x).toBeLessThan(v036BrushPose(.60 / 8).source.x);
    expect(v036BrushPose(1.35 / 8).source.x).toBeGreaterThan(v036BrushPose(1.60 / 8).source.x);
    const replay = v036ReceiptFrame(28, 1.8);
    expect(replay.cleaning).toBe(1);
    expect(replay.upperPatch).toBe(1);
    expect(replay.lowerPatch).toBe(1);
    expect(replay.glass).toBe(1);
    expect(replay.trying).toBe(true);
    expect(replay.trial).toBeCloseTo(.4);
  });

  it('clamps untrusted elapsed values to bounded material progress', () => {
    for (const seconds of [-20, 0, 100000]) {
      const frame = v036ReceiptFrame(seconds);
      for (const key of ['release', 'support', 'cleaning', 'upperPatch', 'lowerPatch', 'glass', 'trial'] as const) {
        expect(frame[key]).toBeGreaterThanOrEqual(0);
        expect(frame[key]).toBeLessThanOrEqual(1);
      }
    }
  });
});


describe('V037 persisted receipt stage adapter', () => {
  it('holds each saved physical state for any amount of idle time', () => {
    const buried = createReceiptRestorationState(500);
    expect(v037ReceiptFrame(buried, 86400).phase).toBe('soil');
    const dirty = {...buried, stage: 'displayed' as const};
    expect(v037ReceiptFrame(dirty, 86400)).toMatchObject({phase: 'dirty', cleaning: 0, upperPatch: 0, lowerPatch: 0, glass: 0, trying: false});
    const clean = {...dirty, condition: 'clean' as const};
    expect(v037ReceiptFrame(clean, 86400)).toMatchObject({phase: 'clean', cleaning: 1, upperPatch: 0, lowerPatch: 0, glass: 0});
    const stable = {...clean, condition: 'stabilized' as const};
    expect(v037ReceiptFrame(stable, 86400)).toMatchObject({phase: 'display', cleaning: 1, upperPatch: 1, lowerPatch: 1, glass: 1, trying: false});
  });

  it('runs the approved brush and two repairs only inside their real paid actions', () => {
    const dirty = {...createReceiptRestorationState(500), stage: 'displayed' as const};
    const cleaning = beginReceiptRestoration(dirty, 'clean', 'clean-once', 10).state;
    expect(v037ReceiptFrame(cleaning, 11.9)).toMatchObject({phase: 'cleaning', cleaning: .5, upperPatch: 0, lowerPatch: 0});
    const clean = advanceReceiptRestoration(cleaning, 14);
    const repairing = beginReceiptRestoration(clean, 'repair', 'repair-once', 20).state;
    const first = v037ReceiptFrame(repairing, 20 + 3.9 * .43);
    expect(first.upperPatch).toBe(1);expect(first.lowerPatch).toBe(0);expect(first.glass).toBe(0);
    const restored = advanceReceiptRestoration(repairing, 24);
    expect(v037ReceiptFrame(restored, 86400).glass).toBe(1);
    expect(restored.parts).toBe(340);expect(restored.transactions).toHaveLength(2);
  });

  it('replays free flavor while preserving the exact saved condition and blank signature', () => {
    const dirty = {...createReceiptRestorationState(120), stage: 'displayed' as const};
    const trying = beginReceiptRestoration(dirty, 'try', 'free-try', 5).state;
    expect(v037ReceiptFrame(trying, 6.2)).toMatchObject({phase: 'trying', cleaning: 0, upperPatch: 0, lowerPatch: 0, glass: 0, missingSignature: true});
    expect(v037ReceiptFrame(trying, 6.2).trial).toBeCloseTo(.5);
    expect(trying.parts).toBe(120);expect(trying.evidenceIds).toEqual([]);expect(trying.transactions).toEqual([]);
    const finished = advanceReceiptRestoration(trying, 8);
    expect(v037ReceiptFrame(finished, 100)).toMatchObject({phase: 'dirty', trying: false, cleaning: 0});
  });
});
