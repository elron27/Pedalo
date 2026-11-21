import type { Page } from '@playwright/test';

/**
 * Ersetzt navigator.bluetooth und navigator.wakeLock durch Simulatoren. Die App läuft dabei durch ihren
 * echten Web-Bluetooth-Pfad (Verbinden, Notifications, Control Point), nur das Gerät ist simuliert.
 * Steuerung aus dem Test über window.__fake.
 */
export async function installFakes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Listener = (e: Event) => void;
    class Target {
      private l: Record<string, Listener[]> = {};
      addEventListener(t: string, f: Listener) {
        (this.l[t] ??= []).push(f);
      }
      removeEventListener() {}
      emit(t: string) {
        const ev = new Event(t);
        Object.defineProperty(ev, 'target', { value: this });
        for (const f of this.l[t] ?? []) f(ev);
      }
    }
    const fake = {
      connectAttempts: 0,
      failConnects: 0,
      connected: false,
      writes: [] as number[][],
      wake: [] as string[],
      bikeChar: null as (Target & { value?: DataView }) | null,
      hrChars: {} as Record<string, Target & { value?: DataView }>,
      devices: {} as Record<string, Target & { id: string; name: string; gatt: unknown }>,
      choosers: 0,
      bikeEmit(d: { power: number; cadence: number; speedKmh: number }) {
        const b = new DataView(new ArrayBuffer(8));
        b.setUint16(0, 0x44, true);
        b.setUint16(2, Math.round(d.speedKmh * 100), true);
        b.setUint16(4, Math.round(d.cadence * 2), true);
        b.setInt16(6, d.power, true);
        if (fake.bikeChar) {
          fake.bikeChar.value = b;
          fake.bikeChar.emit('characteristicvaluechanged');
        }
      },
      hrEmit(id: string, bpm: number) {
        const c = fake.hrChars[id];
        if (!c) return;
        c.value = new DataView(Uint8Array.of(0x10, bpm).buffer);
        c.emit('characteristicvaluechanged');
      },
      drop(id = 'bike') {
        fake.connected = false;
        fake.devices[id]?.emit('gattserverdisconnected');
      },
    };
    (window as unknown as { __fake: typeof fake }).__fake = fake;

    const mkDevice = (id: string, name: string, kind: 'bike' | 'hr') => {
      const dev = new Target() as Target & { id: string; name: string; gatt: unknown };
      dev.id = id;
      dev.name = name;
      dev.gatt = {
        connect: async () => {
          if (kind === 'bike') {
            fake.connectAttempts++;
            if (fake.failConnects > 0) {
              fake.failConnects--;
              throw new Error('NetworkError: Connection attempt failed.');
            }
            fake.connected = true;
          }
          return {
            getPrimaryService: async () => ({
              getCharacteristic: async (uuid: number) => {
                const c = new Target() as Target & { value?: DataView; startNotifications: () => Promise<void>; writeValueWithResponse: (b: BufferSource) => Promise<void> };
                c.startNotifications = async () => {};
                c.writeValueWithResponse = async (b) => {
                  if (!fake.connected) throw new Error('GATT Server is disconnected.');
                  fake.writes.push(Array.from(new Uint8Array(b as ArrayBuffer)));
                };
                if (uuid === 0x2ad2) fake.bikeChar = c;
                if (uuid === 0x2a37) fake.hrChars[id] = c;
                return c;
              },
            }),
          };
        },
        disconnect: () => {
          if (kind === 'bike') fake.connected = false;
          dev.emit('gattserverdisconnected');
        },
      };
      fake.devices[id] = dev;
      return dev;
    };

    const known: Record<string, ReturnType<typeof mkDevice>> = {};
    const bluetooth = {
      requestDevice: async (opts: { filters?: { services?: number[] }[] }) => {
        fake.choosers++;
        const svc = opts.filters?.[0]?.services?.[0];
        if (svc === 0x1826) return (known.bike ??= mkDevice('bike', 'KICKR BIKE SIM', 'bike'));
        const n = Object.keys(known).filter((k) => k.startsWith('gurt')).length + 1;
        const id = `gurt${n}`;
        return (known[id] = mkDevice(id, `Gurt ${n}`, 'hr'));
      },
      getDevices: async () => Object.values(known),
    };
    Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async (type: string) => {
          fake.wake.push(type);
          return { release: async () => void fake.wake.push('release') };
        },
      },
      configurable: true,
    });
  });
}

export interface FakeHandle {
  connectAttempts: number;
  failConnects: number;
  writes: number[][];
  wake: string[];
  choosers: number;
  bikeEmit(d: { power: number; cadence: number; speedKmh: number }): void;
  hrEmit(id: string, bpm: number): void;
  drop(id?: string): void;
}
