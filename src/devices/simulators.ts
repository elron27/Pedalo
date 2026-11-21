import type { HeartRatePort, TrainerData, TrainerPort } from '../ports';

/** Trainer-Simulator mit steuerbaren Aussetzern, gleiche Schnittstelle wie das echte Bike. */
export class SimTrainer implements TrainerPort {
  connected = false;
  /** Anzahl der nächsten Verbindungsversuche, die scheitern sollen. */
  failConnects = 0;
  connectAttempts = 0;
  commands: string[] = [];
  private dataCbs: ((d: TrainerData) => void)[] = [];
  private discCbs: (() => void)[] = [];

  async connect(): Promise<void> {
    this.connectAttempts++;
    if (this.failConnects > 0) {
      this.failConnects--;
      throw new Error('Connection attempt failed.');
    }
    this.connected = true;
  }
  disconnect(): void {
    this.connected = false;
  }
  onData(cb: (d: TrainerData) => void): void {
    this.dataCbs.push(cb);
  }
  onDisconnect(cb: () => void): void {
    this.discCbs.push(cb);
  }
  async setTargetPower(w: number): Promise<void> {
    if (!this.connected) throw new Error('Bike ist nicht verbunden.');
    this.commands.push(`ziel:${w}`);
  }
  async setFreeRide(): Promise<void> {
    if (!this.connected) throw new Error('Bike ist nicht verbunden.');
    this.commands.push('frei');
  }
  /** Test: Bluetooth bricht ab. */
  drop(): void {
    this.connected = false;
    for (const cb of this.discCbs) cb();
  }
  emit(d: TrainerData): void {
    for (const cb of this.dataCbs) cb(d);
  }
}

export class SimHeartRate implements HeartRatePort {
  connected = false;
  private hrCbs: ((b: number | undefined) => void)[] = [];
  private discCbs: (() => void)[] = [];
  constructor(readonly name = 'Sim-Gurt') {}
  async connect(): Promise<void> {
    this.connected = true;
  }
  disconnect(): void {
    this.connected = false;
  }
  onHeartRate(cb: (b: number | undefined) => void): void {
    this.hrCbs.push(cb);
  }
  onDisconnect(cb: () => void): void {
    this.discCbs.push(cb);
  }
  emit(bpm: number | undefined): void {
    for (const cb of this.hrCbs) cb(bpm);
  }
}
