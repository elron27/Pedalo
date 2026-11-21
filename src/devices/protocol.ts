// Bluetooth-Protokolle ohne Browser-Abhängigkeit: Bytes rein, Werte raus (und umgekehrt).
// Die Beispielbytes in den Tests stammen aus dem Protokoll vom echten Kickr Bike v2 (M0).
import type { TrainerData } from '../ports';

/** FTMS Indoor Bike Data (0x2AD2). */
export function parseIndoorBikeData(d: DataView): TrainerData {
  const flags = d.getUint16(0, true);
  let o = 2;
  const out: TrainerData = {};
  const u16 = () => {
    const v = d.getUint16(o, true);
    o += 2;
    return v;
  };
  const s16 = () => {
    const v = d.getInt16(o, true);
    o += 2;
    return v;
  };
  if (!(flags & 1)) out.speedKmh = u16() / 100;
  if (flags & 2) u16(); // mittlere Geschwindigkeit
  if (flags & 4) out.cadence = u16() / 2;
  if (flags & 8) u16(); // mittlere Trittfrequenz
  if (flags & 16) o += 3; // Distanz
  if (flags & 32) o += 2; // Widerstandslevel
  if (flags & 64) out.power = s16();
  return out;
}

export const FTMS_OP = { requestControl: 0x00, reset: 0x01, setTargetPower: 0x05, start: 0x07, stop: 0x08, simulation: 0x11 } as const;

export function encodeRequestControl(): Uint8Array {
  return Uint8Array.of(FTMS_OP.requestControl);
}

export function encodeSetTargetPower(watts: number): Uint8Array {
  if (!Number.isFinite(watts) || watts < 0 || watts > 2500) throw new RangeError('Zielwatt muss zwischen 0 und 2500 liegen.');
  const w = Math.round(watts);
  return Uint8Array.of(FTMS_OP.setTargetPower, w & 0xff, (w >> 8) & 0xff);
}

/** Indoor Bike Simulation: Wind 0, Steigung in %, Rollwiderstand 0,004, Luftwiderstand 0,51 (wie im M0-Test). */
export function encodeSimulation(gradePercent: number): Uint8Array {
  const g = Math.round(gradePercent * 100);
  return Uint8Array.of(FTMS_OP.simulation, 0, 0, g & 0xff, (g >> 8) & 0xff, 40, 51);
}

export function parseControlResponse(d: DataView): { op: number; ok: boolean } | undefined {
  if (d.byteLength < 3 || d.getUint8(0) !== 0x80) return undefined;
  return { op: d.getUint8(1), ok: d.getUint8(2) === 1 };
}

export interface HeartRateReading {
  bpm: number;
  /** false = Sensor meldet keinen Hautkontakt; dann ist der Wert nicht verlässlich. */
  contact: boolean | undefined;
}

/** Heart Rate Measurement (0x2A37). */
export function parseHeartRate(d: DataView): HeartRateReading {
  const flags = d.getUint8(0);
  const bpm = flags & 1 ? d.getUint16(1, true) : d.getUint8(1);
  const contactBits = (flags >> 1) & 3; // 0/1: nicht unterstützt, 2: unterstützt, kein Kontakt, 3: Kontakt
  return { bpm, contact: contactBits < 2 ? undefined : contactBits === 3 };
}
