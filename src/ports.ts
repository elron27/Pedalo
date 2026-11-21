// Schnittstellen zwischen Kern und Außenwelt. Der Kern kennt nur diese Typen,
// echte Geräte und Simulatoren setzen sie um.

export interface Clock {
  /** Aktuelle Zeit in Millisekunden. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Was der Player am Bike einstellen kann. Fehler (z. B. Verbindung weg) werden als Ablehnung gemeldet. */
export interface TargetSink {
  setTargetPower(watts: number): Promise<void> | void;
  /** Freies Training: Simulationswerte mit Steigung 0 %, keine Zielleistung. */
  setFreeRide(): Promise<void> | void;
}

export interface TrainerData {
  power?: number;
  cadence?: number;
  speedKmh?: number;
}

export type ConnectionStatus = 'getrennt' | 'verbindet' | 'verbunden';

/** Gerät, das sich verbinden lässt und seine Trennung meldet. */
export interface Connectable {
  connect(): Promise<void>;
  disconnect(): void;
  onDisconnect(cb: () => void): void;
}

export interface TrainerPort extends TargetSink, Connectable {
  onData(cb: (d: TrainerData) => void): void;
}

export interface HeartRatePort extends Connectable {
  onHeartRate(cb: (bpm: number | undefined) => void): void;
}

/** Einfacher Schlüssel-Wert-Speicher (localStorage oder IndexedDB). */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  async get<T>(key: string): Promise<T | undefined> {
    const v = this.data.get(key);
    return v === undefined ? undefined : (JSON.parse(v) as T);
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

export interface WakeLockPort {
  acquire(): Promise<void>;
  release(): Promise<void>;
}
