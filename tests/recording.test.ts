import { Decoder, Stream } from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { buildFit, fitFileName } from '../src/domain/fit';
import { Recorder, deleteRecording, findUnfinishedSessions, recoverRecording, type Recording } from '../src/domain/recorder';
import { MemoryStore } from '../src/ports';

const start = new Date('2026-11-21T10:00:00Z');
const info = { sessionId: 's1', startedAt: start, workoutName: 'Sweet spot 2×20′', riderName: 'Stefan', ftp: 274 };

function decode(bytes: Uint8Array) {
  const stream = Stream.fromByteArray(Array.from(bytes));
  const d = new Decoder(stream);
  const isFit = Decoder.isFIT(stream);
  const integrity = d.checkIntegrity();
  const { messages, errors } = d.read();
  return { isFit, integrity, messages, errors };
}

function recordSeconds(n: number, store?: MemoryStore) {
  const r = new Recorder(info, store);
  for (let i = 0; i < n; i++) r.tick({ power: 150 + (i % 10), heartRate: 120 + (i % 5), cadence: 85, speedKmh: 30 });
  return r;
}

describe('Aufzeichnung', () => {
  it('[SR-2dda85/AK-y7fv] speichert pro Sekunde einen Datensatz mit Watt, Puls und Trittfrequenz', () => {
    const r = recordSeconds(10);
    expect(r.records).toHaveLength(10);
    expect(r.records.map((x) => x.t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const x of r.records) {
      expect(x.power).toBeGreaterThanOrEqual(150);
      expect(x.heartRate).toBeGreaterThanOrEqual(120);
      expect(x.cadence).toBe(85);
    }
  });

  it('erfindet keine Werte, wenn ein Sensor fehlt', () => {
    const r = new Recorder(info);
    r.tick({ power: 100, cadence: 80 });
    expect(r.records[0]).toEqual({ t: 0, power: 100, cadence: 80 });
    expect(r.records[0]).not.toHaveProperty('heartRate');
  });

  it('[SR-f32bce/AK-kv6q] schreibt Distanz und Geschwindigkeit je Datensatz sowie Gesamtdistanz, mittlere und höchste Geschwindigkeit passend zur Aufzeichnung', () => {
    const r = new Recorder(info);
    for (let i = 0; i < 100; i++) r.tick({ power: 150, speedKmh: i < 50 ? 30 : 36 });
    const { messages, errors } = decode(buildFit({ meta: r.meta(true), records: r.records }));
    expect(errors).toHaveLength(0);
    const recs = messages.recordMesgs!;
    expect(recs.every((x) => typeof x.distance === 'number' && typeof x.speed === 'number')).toBe(true);
    const expectedDist = (50 * 30 + 50 * 36) / 3.6; // Meter
    const ses = messages.sessionMesgs![0]! as Record<string, number>;
    expect(Math.abs(ses.totalDistance! - expectedDist) / expectedDist).toBeLessThan(0.01);
    expect(Math.abs(recs.at(-1)!.distance! - expectedDist) / expectedDist).toBeLessThan(0.01);
    const avgMs = (50 * 30 + 50 * 36) / 100 / 3.6;
    expect(Math.abs((ses.avgSpeed ?? ses.enhancedAvgSpeed)! - avgMs) / avgMs).toBeLessThan(0.01);
    expect(Math.abs((ses.maxSpeed ?? ses.enhancedMaxSpeed)! - 36 / 3.6) / (36 / 3.6)).toBeLessThan(0.01);
  });

  it('bewältigt die Höchstdauer von 10 Stunden (36.000 Datensätze) in einer gültigen Datei', () => {
    const r = recordSeconds(36_000);
    expect(r.records).toHaveLength(36_000);
    const fit = buildFit({ meta: r.meta(true), records: r.records });
    const { isFit, integrity, errors, messages } = decode(fit);
    expect(isFit && integrity).toBe(true);
    expect(errors).toHaveLength(0);
    expect(messages.recordMesgs).toHaveLength(36_000);
  });
});

describe('.fit-Datei', () => {
  it('[SR-e21b18/AK-tz7v] nach dem Training entsteht eine gültige .fit-Datei mit allen Datensätzen', () => {
    const r = recordSeconds(120);
    r.markLap('Block 2'); // Runde ab Datensatz 120 ist leer und entfällt
    const rec: Recording = { meta: r.meta(true), records: r.records };
    const { isFit, integrity, errors, messages } = decode(buildFit(rec));
    expect(isFit).toBe(true);
    expect(integrity).toBe(true);
    expect(errors).toHaveLength(0);
    expect(messages.fileIdMesgs![0]!.type).toBe('activity');
    expect(messages.recordMesgs).toHaveLength(120);
    const recs = messages.recordMesgs!;
    expect(recs[0]!.power).toBe(150);
    expect(recs[0]!.heartRate).toBe(120);
    expect(recs[0]!.cadence).toBe(85);
    // Sekundentakt
    expect((recs[1]!.timestamp as unknown as Date).getTime() - (recs[0]!.timestamp as unknown as Date).getTime()).toBe(1000);
    const s = messages.sessionMesgs![0]!;
    expect(s.sport).toBe('cycling');
    expect(s.subSport).toBe('indoorCycling');
    expect(s.totalTimerTime).toBe(120);
    expect(s.avgPower).toBe(Math.round(150 + 4.5));
    expect(s.thresholdPower).toBe(274);
    expect(messages.activityMesgs).toHaveLength(1);
  });

  it('schreibt eine Runde je Block', () => {
    const r = new Recorder(info);
    for (let i = 0; i < 90; i++) {
      if (i === 0) r.markLap('Einfahren');
      if (i === 60) r.markLap('Sweetspot');
      r.tick({ power: i < 60 ? 100 : 250, cadence: 90 });
    }
    const { messages } = decode(buildFit({ meta: r.meta(true), records: r.records }));
    expect(messages.lapMesgs).toHaveLength(2);
    expect(messages.lapMesgs!.map((l) => l.avgPower)).toEqual([100, 250]);
  });

  it('benennt die Datei nach Zeit und Training', () => {
    expect(fitFileName({ startedAt: '2026-11-21T10:05:00.000Z', workoutName: 'Sweet spot 2×20′' })).toBe('pedalo-20261121-1005-Sweet_spot_2_20.fit');
  });
});

describe('Zwischenspeicherung', () => {
  it('[SR-a6bbe0/AK-zjfx] nach Absturz lässt sich die .fit-Datei aus der Zwischenspeicherung erzeugen', async () => {
    const store = new MemoryStore();
    const r = recordSeconds(127, store); // Absturz kurz nach dem Zwischenspeichern bei 125 s
    await r.whenFlushed();
    // "Absturz": der Recorder ist weg, nur der Speicher bleibt
    const unfinished = await findUnfinishedSessions(store);
    expect(unfinished.map((m) => m.sessionId)).toEqual(['s1']);
    const rec = await recoverRecording(store, 's1');
    expect(rec).toBeDefined();
    expect(rec!.records.length).toBeGreaterThanOrEqual(125); // höchstens wenige Sekunden verloren
    expect(rec!.records.length).toBeLessThanOrEqual(127);
    const { isFit, integrity, errors, messages } = decode(buildFit(rec!));
    expect(isFit && integrity).toBe(true);
    expect(errors).toHaveLength(0);
    expect(messages.recordMesgs!.length).toBe(rec!.records.length);
    expect(rec!.records[100]).toEqual({ t: 100, power: 150, heartRate: 120, cadence: 85, speedKmh: 30 });
  });

  it('merkt sich beendete Sitzungen als beendet und löscht auf Wunsch', async () => {
    const store = new MemoryStore();
    const r = recordSeconds(10, store);
    await r.finish();
    expect(await findUnfinishedSessions(store)).toHaveLength(0);
    await deleteRecording(store, 's1');
    expect(await recoverRecording(store, 's1')).toBeUndefined();
  });

  it('meldet Schreibfehler und versucht es beim nächsten Mal erneut', async () => {
    const store = new MemoryStore();
    let fail = true;
    const orig = store.set.bind(store);
    store.set = (async (k: string, v: unknown) => {
      if (fail) throw new Error('Speicher voll');
      return orig(k, v);
    }) as typeof store.set;
    const errors: unknown[] = [];
    const r = new Recorder(info, store, { flushEverySec: 5, onError: (e) => errors.push(e) });
    for (let i = 0; i < 5; i++) r.tick({ power: 100 });
    await r.whenFlushed();
    expect(errors).toHaveLength(1);
    fail = false;
    for (let i = 0; i < 5; i++) r.tick({ power: 100 });
    await r.whenFlushed();
    expect((await recoverRecording(store, 's1'))!.records).toHaveLength(10);
  });
});
