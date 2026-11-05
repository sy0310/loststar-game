import {describe, expect, it} from 'vitest';
import {v036BrushPose, v036ReceiptFrame, v036ReceiptGlassPlacement} from '../src/review/v036-receipt';

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
