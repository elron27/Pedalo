import type { HeartRatePort, TrainerData, TrainerPort } from '../ports';
import type { HrStrap, StrapConnector } from '../domain/profile';
import { encodeRequestControl, encodeSetTargetPower, encodeSimulation, parseHeartRate, parseIndoorBikeData } from './protocol';

const FTMS = 0x1826;
const BIKE_DATA = 0x2ad2;
const CONTROL_POINT = 0x2ad9;
const HEART_RATE = 0x180d;
const HR_MEASUREMENT = 0x2a37;

function bt(): Bluetooth {
  if (!navigator.bluetooth) throw new Error('Dieser Browser unterstützt kein Web Bluetooth. Bitte Chrome verwenden.');
  return navigator.bluetooth;
}

/** Wahoo Kickr Bike v2 (und andere FTMS-Trainer) über Web Bluetooth. */
export class FtmsTrainer implements TrainerPort {
  private device: BluetoothDevice | undefined;
  private control: BluetoothRemoteGATTCharacteristic | undefined;
  private dataCbs: ((d: TrainerData) => void)[] = [];
  private discCbs: (() => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  /** Entwicklungsprotokoll (optional). */
  log: (kind: string, data?: unknown) => void = () => {};

  get name(): string | undefined {
    return this.device?.name;
  }

  /** Auswahlfenster des Browsers. Muss durch eine Bedienung des Fahrers ausgelöst werden. */
  async pair(): Promise<void> {
    const dev = await bt().requestDevice({ filters: [{ services: [FTMS] }], optionalServices: [FTMS] });
    this.device = dev;
    dev.addEventListener('gattserverdisconnected', () => {
      this.control = undefined;
      for (const cb of this.discCbs) cb();
    });
  }

  async connect(): Promise<void> {
    if (!this.device?.gatt) throw new Error('Bike ist noch nicht gekoppelt.');
    const server = await this.device.gatt.connect();
    this.log('bike.gatt.verbunden');
    const svc = await server.getPrimaryService(FTMS);
    // Wie im M0-Versuch zuerst alle Eigenschaften des Dienstes abfragen (das vollständige Entdecken klappt zuverlässiger
    // als die gezielte Abfrage einer einzelnen Eigenschaft) und dann die benötigten heraussuchen.
    const chars = await svc.getCharacteristics();
    this.log('bike.eigenschaften', chars.map((c) => c.uuid.slice(4, 8)));
    const find = (id: number) => chars.find((c) => parseInt(c.uuid.slice(4, 8), 16) === id);
    const data = find(BIKE_DATA);
    const control = find(CONTROL_POINT);
    if (!data || !control) {
      server.disconnect();
      throw new Error('Das Bike meldet keine Leistungsdaten über FTMS. Bitte Bike aus- und wieder einschalten und neu verbinden.');
    }
    data.addEventListener('characteristicvaluechanged', (ev) => {
      const v = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!v) return;
      const d = parseIndoorBikeData(v);
      for (const cb of this.dataCbs) cb(d);
    });
    await data.startNotifications();
    this.control = control;
    await this.write(encodeRequestControl());
    this.log('bike.bereit');
  }

  disconnect(): void {
    this.device?.gatt?.disconnect();
  }

  onData(cb: (d: TrainerData) => void): void {
    this.dataCbs.push(cb);
  }

  onDisconnect(cb: () => void): void {
    this.discCbs.push(cb);
  }

  setTargetPower(watts: number): Promise<void> {
    return this.write(encodeSetTargetPower(watts));
  }

  /** Freies Training: Simulation mit Steigung 0 % (ohne sie wirkt das Schalten am Bike nicht, siehe M0). */
  setFreeRide(): Promise<void> {
    return this.write(encodeSimulation(0));
  }

  private write(bytes: Uint8Array): Promise<void> {
    const ctrl = this.control;
    if (!ctrl) return Promise.reject(new Error('Bike ist nicht verbunden.'));
    // Schreibzugriffe nacheinander, sonst meldet Bluetooth "GATT operation already in progress"
    const run = this.queue.then(() => ctrl.writeValueWithResponse(bytes as BufferSource));
    this.queue = run.catch(() => {});
    return run;
  }
}

/** Pulsgurt über Web Bluetooth; kennt gespeicherte Gurte (ohne erneutes Koppeln, wenn der Browser es erlaubt). */
export class BleHeartRate implements HeartRatePort, StrapConnector {
  private device: BluetoothDevice | undefined;
  private hrCbs: ((bpm: number | undefined) => void)[] = [];
  private discCbs: (() => void)[] = [];
  private listened = new WeakSet<BluetoothDevice>();

  private adopt(dev: BluetoothDevice): void {
    this.device = dev;
    if (this.listened.has(dev)) return;
    this.listened.add(dev);
    dev.addEventListener('gattserverdisconnected', () => {
      for (const cb of this.discCbs) cb();
    });
  }

  async requestNew(): Promise<HrStrap> {
    const dev = await bt().requestDevice({ filters: [{ services: [HEART_RATE] }] });
    this.adopt(dev);
    return { id: dev.id, name: dev.name ?? 'Pulsgurt' };
  }

  /** Gespeicherten Gurt wählen, ohne Auswahlfenster. Der Browser muss getDevices() unterstützen. */
  async connectKnown(id: string): Promise<void> {
    const b = bt();
    if (!b.getDevices) throw new Error('Dieser Browser kann gespeicherte Pulsgurte nicht ohne Auswahlfenster verbinden.');
    const dev = (await b.getDevices()).find((d) => d.id === id);
    if (!dev) throw new Error('Pulsgurt ist dem Browser nicht mehr bekannt. Bitte neu koppeln.');
    this.adopt(dev);
  }

  async connect(): Promise<void> {
    if (!this.device?.gatt) throw new Error('Pulsgurt ist noch nicht gewählt.');
    const server = await this.device.gatt.connect();
    const ch = await (await server.getPrimaryService(HEART_RATE)).getCharacteristic(HR_MEASUREMENT);
    ch.addEventListener('characteristicvaluechanged', (ev) => {
      const v = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!v) return;
      const r = parseHeartRate(v);
      const bpm = r.contact === false ? undefined : r.bpm;
      for (const cb of this.hrCbs) cb(bpm);
    });
    await ch.startNotifications();
  }

  disconnect(): void {
    this.device?.gatt?.disconnect();
  }

  onHeartRate(cb: (bpm: number | undefined) => void): void {
    this.hrCbs.push(cb);
  }

  onDisconnect(cb: () => void): void {
    this.discCbs.push(cb);
  }
}
