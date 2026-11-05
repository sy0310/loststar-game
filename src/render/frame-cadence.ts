/** Accumulates display time without losing fractional deadlines to integer rAF timestamps. */
export class FrameCadence {
  private previous: number | undefined;
  private elapsed = 0;

  reset() {
    this.previous = undefined;
    this.elapsed = 0;
  }

  draw(now: number, periodMs = 1000 / 60) {
    if (this.previous === undefined || now < this.previous) {
      this.previous = now;
      return true;
    }
    this.elapsed += Math.min(1000, now - this.previous);
    this.previous = now;
    // WebViews can quantize 60Hz rAF to 17/16/17ms. Accept one timestamp
    // quantum early, and retain that (bounded negative) remainder. Clamping it
    // to zero would discard the debt and bias later deadlines.
    const quantumMs = 1;
    if (this.elapsed + quantumMs < periodMs) return false;
    // Consume missed periods in one operation: a background gap draws only
    // the current frame, never a burst of historical frames.
    this.elapsed -= periodMs * Math.max(1, Math.floor((this.elapsed + quantumMs) / periodMs));
    return true;
  }
}
