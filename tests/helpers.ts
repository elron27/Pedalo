import type { Clock, TargetSink } from '../src/ports';

export class FakeClock implements Clock {
  t = 1_000_000;
  now() {
    return this.t;
  }
  advance(ms: number) {
    this.t += ms;
  }
}

export class RecordingSink implements TargetSink {
  calls: string[] = [];
  failNext = false;
  async setTargetPower(w: number) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Bike nicht verbunden');
    }
    this.calls.push(`ziel:${w}`);
  }
  async setFreeRide() {
    this.calls.push('frei');
  }
  last() {
    return this.calls[this.calls.length - 1];
  }
}
