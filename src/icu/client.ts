import { workoutFromIntervalsDoc, WorkoutParseError, type IcuWorkoutDoc, type Workout } from '../domain/workout';

export interface IcuConfig {
  athleteId: string;
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}

export interface IcuWorkout {
  eventId: number;
  /** Datum des Termins (YYYY-MM-DD). */
  date: string;
  workout: Workout;
}

export interface IcuSkipped {
  name: string;
  date: string;
  reason: string;
}

export class IcuError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

interface IcuEvent {
  id: number;
  name?: string;
  type?: string;
  start_date_local?: string;
  icu_ftp?: number;
  workout_doc?: IcuWorkoutDoc;
}

const RIDE_TYPES = new Set(['Ride', 'VirtualRide']);

/** Zugriff auf intervals.icu mit dem API-Schlüssel des Fahrers (M0: Abruf und Upload gehen direkt aus dem Browser). */
export class IcuClient {
  private readonly f: typeof fetch;
  private readonly base: string;

  constructor(private readonly cfg: IcuConfig) {
    this.f = cfg.fetch ?? ((...a) => fetch(...a));
    this.base = cfg.baseUrl ?? 'https://intervals.icu/api/v1';
  }

  private headers(): Record<string, string> {
    return { Authorization: 'Basic ' + btoa('API_KEY:' + this.cfg.apiKey) };
  }

  private async check(r: Response, what: string): Promise<void> {
    if (r.ok) return;
    if (r.status === 401 || r.status === 403) throw new IcuError(`intervals.icu hat die Zugangsdaten abgelehnt (${what}).`, r.status);
    throw new IcuError(`intervals.icu antwortete mit Fehler ${r.status} (${what}).`, r.status);
  }

  /** Radtrainings mit Blöcken im Zeitraum. Termine anderer Sportarten und ohne Blöcke werden nicht angeboten. */
  async listRideWorkouts(from: Date, to: Date): Promise<{ workouts: IcuWorkout[]; skipped: IcuSkipped[] }> {
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const url = `${this.base}/athlete/${encodeURIComponent(this.cfg.athleteId)}/events?oldest=${iso(from)}&newest=${iso(to)}`;
    const r = await this.f(url, { headers: this.headers() });
    await this.check(r, 'Trainings lesen');
    const events = (await r.json()) as IcuEvent[];
    const workouts: IcuWorkout[] = [];
    const skipped: IcuSkipped[] = [];
    for (const e of events) {
      if (!e.type || !RIDE_TYPES.has(e.type) || !e.workout_doc?.steps?.length) continue;
      const name = e.name ?? 'Training';
      const date = (e.start_date_local ?? '').slice(0, 10);
      try {
        workouts.push({ eventId: e.id, date, workout: workoutFromIntervalsDoc(name, e.workout_doc, { icuFtp: e.icu_ftp }) });
      } catch (err) {
        if (err instanceof WorkoutParseError) skipped.push({ name, date, reason: err.message });
        else throw err;
      }
    }
    workouts.sort((a, b) => a.date.localeCompare(b.date));
    return { workouts, skipped };
  }

  /** .fit-Datei als Aktivität auf das Konto dieses Fahrers hochladen. */
  async uploadFit(bytes: Uint8Array, fileName: string): Promise<{ activityId: string }> {
    const fd = new FormData();
    fd.append('file', new Blob([bytes as BlobPart], { type: 'application/octet-stream' }), fileName);
    const r = await this.f(`${this.base}/athlete/${encodeURIComponent(this.cfg.athleteId)}/activities`, {
      method: 'POST',
      headers: this.headers(),
      body: fd,
    });
    await this.check(r, 'Hochladen');
    const body = (await r.json()) as { id?: string; activities?: { id?: string }[] };
    const id = body.activities?.[0]?.id ?? body.id;
    if (!id) throw new IcuError('intervals.icu hat die Datei angenommen, aber keine Aktivität angelegt (vielleicht schon vorhanden).');
    return { activityId: id };
  }
}
