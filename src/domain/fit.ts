import { Encoder, Profile } from '@garmin/fitsdk';
import type { Recording } from './recorder';

const num = (k: string): number => (Profile.MesgNum as unknown as Record<string, number>)[k]!;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : undefined);
const round = (x: number | undefined) => (x === undefined ? undefined : Math.round(x));

/** Normalisierte Leistung (30-s-gleitender Mittelwert, 4. Potenz). */
export function normalizedPower(powers: number[]): number | undefined {
  if (powers.length < 30) return undefined;
  const roll: number[] = [];
  let sum = 0;
  for (let i = 0; i < powers.length; i++) {
    sum += powers[i]!;
    if (i >= 30) sum -= powers[i - 30]!;
    if (i >= 29) roll.push(sum / 30);
  }
  return Math.round(Math.pow(roll.reduce((a, b) => a + Math.pow(b, 4), 0) / roll.length, 0.25));
}

function stats(recs: Recording['records']) {
  const power = recs.flatMap((r) => (r.power === undefined ? [] : [r.power]));
  const hr = recs.flatMap((r) => (r.heartRate === undefined ? [] : [r.heartRate]));
  const cad = recs.flatMap((r) => (r.cadence === undefined ? [] : [r.cadence]));
  const speeds = recs.flatMap((r) => (r.speedKmh === undefined ? [] : [r.speedKmh / 3.6]));
  const dist = recs.reduce((a, r) => a + (r.speedKmh ?? 0) / 3.6, 0); // m bei 1 Hz
  return {
    avgSpeed: avg(speeds),
    maxSpeed: max(speeds),
    avgPower: round(avg(power)),
    maxPower: max(power),
    avgHr: round(avg(hr)),
    maxHr: max(hr),
    avgCad: round(avg(cad)),
    maxCad: max(cad),
    np: normalizedPower(recs.map((r) => r.power ?? 0)),
    dist,
  };
}

/** Erzeugt eine .fit-Datei (Aktivität, Indoor-Radfahren) aus einer Aufzeichnung. */
export function buildFit(rec: Recording): Uint8Array {
  const { meta, records } = rec;
  const start = new Date(meta.startedAt);
  const at = (sec: number) => new Date(start.getTime() + sec * 1000);
  const endSec = Math.max(records.length, 1);
  const enc = new Encoder();
  const put = (name: string, m: Record<string, unknown>) => enc.onMesg(num(name), m as never);

  put('FILE_ID', {
    type: 'activity',
    manufacturer: 'development',
    product: 0,
    serialNumber: 1,
    timeCreated: start,
  });
  put('EVENT', { timestamp: start, event: 'timer', eventType: 'start' });

  let dist = 0;
  for (const r of records) {
    dist += (r.speedKmh ?? 0) / 3.6;
    const m: Record<string, unknown> = { timestamp: at(r.t), distance: Math.round(dist * 100) / 100 };
    if (r.power !== undefined) m.power = Math.round(r.power);
    if (r.heartRate !== undefined) m.heartRate = Math.round(r.heartRate);
    if (r.cadence !== undefined) m.cadence = Math.round(r.cadence);
    if (r.speedKmh !== undefined) m.speed = Math.round((r.speedKmh / 3.6) * 1000) / 1000;
    put('RECORD', m);
  }

  const laps = meta.laps.length && meta.laps[0]!.startIndex === 0 ? meta.laps : [{ startIndex: 0, label: '' }, ...meta.laps];
  laps.forEach((l, i) => {
    const from = l.startIndex;
    const to = i + 1 < laps.length ? laps[i + 1]!.startIndex : records.length;
    if (to <= from) return;
    const s = stats(records.slice(from, to));
    put('LAP', {
      timestamp: at(to),
      startTime: at(from),
      totalElapsedTime: to - from,
      totalTimerTime: to - from,
      sport: 'cycling',
      subSport: 'indoorCycling',
      avgPower: s.avgPower,
      maxPower: s.maxPower,
      avgHeartRate: s.avgHr,
      maxHeartRate: s.maxHr,
      avgCadence: s.avgCad,
      maxCadence: s.maxCad,
      totalDistance: s.dist,
      avgSpeed: s.avgSpeed,
      maxSpeed: s.maxSpeed,
    });
  });

  const s = stats(records);
  put('EVENT', { timestamp: at(endSec), event: 'timer', eventType: 'stopAll' });
  put('SESSION', {
    timestamp: at(endSec),
    startTime: start,
    totalElapsedTime: endSec,
    totalTimerTime: endSec,
    sport: 'cycling',
    subSport: 'indoorCycling',
    firstLapIndex: 0,
    numLaps: laps.length,
    avgPower: s.avgPower,
    maxPower: s.maxPower,
    normalizedPower: s.np,
    avgHeartRate: s.avgHr,
    maxHeartRate: s.maxHr,
    avgCadence: s.avgCad,
    maxCadence: s.maxCad,
    totalDistance: s.dist,
    avgSpeed: s.avgSpeed,
    maxSpeed: s.maxSpeed,
    thresholdPower: meta.ftp,
  });
  put('ACTIVITY', {
    timestamp: at(endSec),
    totalTimerTime: endSec,
    numSessions: 1,
    type: 'manual',
    event: 'activity',
    eventType: 'stop',
  });
  return enc.close();
}

export function fitFileName(meta: { startedAt: string; workoutName: string }): string {
  const d = meta.startedAt.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const n = meta.workoutName.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 40);
  return `pedalo-${d}${n ? '-' + n : ''}.fit`;
}
