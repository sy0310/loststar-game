/** Accumulates display time so a 30Hz drawing cadence keeps the remainder at 60Hz. */
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
    if (this.elapsed + .1 < periodMs) return false;
    this.elapsed = Math.max(0, this.elapsed - periodMs * Math.max(1, Math.floor(this.elapsed / periodMs)));
    return true;
  }
}
