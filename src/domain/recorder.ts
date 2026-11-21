import type { KeyValueStore } from '../ports';

/** Ein Datensatz je Sekunde. Fehlt ein Wert (kein Sensor), bleibt er undefined, es wird nichts erfunden. */
export interface RecordSample {
  /** Sekunden seit Start, 0-basiert. */
  t: number;
  power?: number;
  heartRate?: number;
  cadence?: number;
  speedKmh?: number;
  /** Zielleistung (Watt), die zu diesem Zeitpunkt am Bike stand; fehlt im freien Training. */
  target?: number;
}

export interface LapMark {
  /** Index des ersten Datensatzes der Runde. */
  startIndex: number;
  label: string;
}

export interface SessionMeta {
  sessionId: string;
  startedAt: string; // ISO
  workoutName: string;
  riderName: string;
  ftp?: number;
  laps: LapMark[];
  finished: boolean;
}

export interface Recording {
  meta: SessionMeta;
  records: RecordSample[];
}

export type Latest = Omit<RecordSample, 't'>;

/**
 * Zeichnet im Sekundentakt auf (tick() einmal je Sekunde aufrufen) und schreibt laufend in einen Speicher,
 * damit nach einem Absturz alles bis auf die letzten Sekunden erhalten ist.
 * Datensätze liegen in Blöcken zu je chunkSize Sätzen (nur der laufende Block wird neu geschrieben).
 */
export class Recorder {
  readonly records: RecordSample[] = [];
  readonly laps: LapMark[] = [];
  private readonly startedAt: Date;
  private lastFlushed = 0;
  private flushing: Promise<void> = Promise.resolve();

  constructor(
    private readonly info: { sessionId: string; startedAt: Date; workoutName: string; riderName: string; ftp?: number },
    private readonly store?: KeyValueStore,
    private readonly opts: { chunkSize?: number; flushEverySec?: number; onError?: (e: unknown) => void } = {},
  ) {
    this.startedAt = info.startedAt;
  }

  private get chunkSize(): number {
    return this.opts.chunkSize ?? 60;
  }

  /** Neue Runde ab dem nächsten Datensatz (z. B. bei Blockwechsel). */
  markLap(label: string): void {
    this.laps.push({ startIndex: this.records.length, label });
  }

  /** Einen Datensatz für die laufende Sekunde anhängen. */
  tick(latest: Latest): void {
    this.records.push({ t: this.records.length, ...latest });
    const every = this.opts.flushEverySec ?? 5;
    if (this.store && this.records.length % every === 0) void this.flush();
  }

  meta(finished = false): SessionMeta {
    return {
      sessionId: this.info.sessionId,
      startedAt: this.startedAt.toISOString(),
      workoutName: this.info.workoutName,
      riderName: this.info.riderName,
      ftp: this.info.ftp,
      laps: [...this.laps],
      finished,
    };
  }

  /** Alles Ungespeicherte wegschreiben. Fehler werden gemeldet, nicht verschluckt. */
  flush(finished = false): Promise<void> {
    if (!this.store) return Promise.resolve();
    const store = this.store;
    const from = Math.floor(this.lastFlushed / this.chunkSize);
    const to = Math.floor(Math.max(0, this.records.length - 1) / this.chunkSize);
    const prefix = `rec/${this.info.sessionId}`;
    const meta = this.meta(finished);
    const chunks: [number, RecordSample[]][] = [];
    for (let c = from; c <= to; c++) chunks.push([c, this.records.slice(c * this.chunkSize, (c + 1) * this.chunkSize)]);
    this.lastFlushed = this.records.length;
    this.flushing = this.flushing
      .then(async () => {
        for (const [c, data] of chunks) await store.set(`${prefix}/chunk/${String(c).padStart(6, '0')}`, data);
        await store.set(`${prefix}/meta`, meta);
      })
      .catch((e) => {
        this.lastFlushed = from * this.chunkSize; // beim nächsten Mal erneut versuchen
        (this.opts.onError ?? ((err) => console.error('Zwischenspeichern fehlgeschlagen', err)))(e);
      });
    return this.flushing;
  }

  /** Wartet, bis alle angestoßenen Schreibvorgänge fertig sind. */
  whenFlushed(): Promise<void> {
    return this.flushing;
  }

  finish(): Promise<void> {
    return this.flush(true);
  }
}

/** Zwischengespeicherte Aufzeichnung laden (nach Absturz oder geschlossenem Tab). */
export async function recoverRecording(store: KeyValueStore, sessionId: string): Promise<Recording | undefined> {
  const prefix = `rec/${sessionId}`;
  const meta = await store.get<SessionMeta>(`${prefix}/meta`);
  if (!meta) return undefined;
  const keys = await store.keys(`${prefix}/chunk/`);
  const records: RecordSample[] = [];
  for (const k of keys) records.push(...((await store.get<RecordSample[]>(k)) ?? []));
  return { meta, records };
}

/** Alle gespeicherten Sitzungen, neueste zuerst. */
export async function listSessions(store: KeyValueStore): Promise<SessionMeta[]> {
  const metas: SessionMeta[] = [];
  for (const k of await store.keys('rec/')) {
    if (!k.endsWith('/meta')) continue;
    const m = await store.get<SessionMeta>(k);
    if (m) metas.push(m);
  }
  return metas.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Sitzungen, die nicht ordentlich beendet wurden. */
export async function findUnfinishedSessions(store: KeyValueStore): Promise<SessionMeta[]> {
  return (await listSessions(store)).filter((m) => !m.finished);
}

export async function deleteRecording(store: KeyValueStore, sessionId: string): Promise<void> {
  for (const k of await store.keys(`rec/${sessionId}/`)) await store.delete(k);
}
