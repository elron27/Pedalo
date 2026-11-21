import { buildFit, fitFileName } from '../domain/fit';
import { fourDpResult, ftpFromRamp, ftpFromTwentyMinuteTest, rampWorkout, riderStopped, type FourDpResult } from '../domain/ftp';
import { Library, type LibraryEntry } from '../domain/library';
import { Player, type PlayerState } from '../domain/player';
import { addStrap, newId, ProfileStore, riderContext, selectStrap, type Profile, type RiderContext, type StrapConnector } from '../domain/profile';
import { deleteRecording, listSessions, Recorder, recoverRecording, type Latest, type Recording, type SessionMeta } from '../domain/recorder';
import { parseManualBlocks, type Workout } from '../domain/workout';
import { Supervisor } from '../devices/supervisor';
import { IcuClient, type IcuSkipped, type IcuWorkout } from '../icu/client';
import type { Clock, ConnectionStatus, HeartRatePort, KeyValueStore, TrainerPort, WakeLockPort } from '../ports';
import { T } from '../ui/texts';
import { describeError } from './errors';

export type RideKind = 'training' | 'frei' | 'rampe' | 'zwanzig' | 'vierdp';

export interface RideResult {
  recording: Recording;
  kind: RideKind;
  avgPower?: number;
  avgHeartRate?: number;
  ftpSuggestion?: number;
  fourDp?: FourDpResult;
  uploaded?: string;
  saved?: boolean;
}

export interface AppState {
  ready: boolean;
  profiles: Profile[];
  active: Profile | null;
  guestFtp?: number;
  trainer: ConnectionStatus;
  hr: ConnectionStatus;
  trainerName?: string;
  live: Latest;
  screen: 'start' | 'fahrt' | 'ende';
  rideKind: RideKind;
  workout: Workout | null;
  player: PlayerState | null;
  library: LibraryEntry[];
  icu: { loading: boolean; workouts: IcuWorkout[]; skipped: IcuSkipped[]; error?: string };
  unfinished: SessionMeta[];
  recent: SessionMeta[];
  result?: RideResult;
  busy?: string;
  error?: string;
  notice?: string;
}

export interface Deps {
  profiles: ProfileStore;
  library: Library;
  recStore: KeyValueStore;
  trainer: TrainerPort & { pair(): Promise<void>; readonly name?: string };
  hr: HeartRatePort & StrapConnector;
  wake: WakeLockPort;
  clock: Clock;
  makeIcu(account: { athleteId: string; apiKey: string }): IcuClient;
  /** Entwicklungsprotokoll (optional). */
  log?: (kind: string, data?: unknown) => void;
  /** Datei an den Fahrer ausgeben (Download). */
  saveFile(bytes: Uint8Array, name: string): void;
}

const STALE_MS = 5000;

/** Verbindet Kern und Oberfläche. Die Oberfläche liest nur state() und ruft Methoden auf. */
export class Controller {
  private s: AppState = {
    ready: false,
    profiles: [],
    active: null,
    trainer: 'getrennt',
    hr: 'getrennt',
    live: {},
    screen: 'start',
    rideKind: 'frei',
    workout: null,
    player: null,
    library: [],
    icu: { loading: false, workouts: [], skipped: [] },
    unfinished: [],
    recent: [],
  };
  private listeners = new Set<() => void>();
  private trainerSup: Supervisor;
  private hrSup: Supervisor;
  private player: Player | null = null;
  private recorder: Recorder | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextRecordAt = 0;
  private lastTrainerAt = 0;
  private lastHrAt = 0;
  private liveRaw: { power?: number; cadence?: number; speedKmh?: number; heartRate?: number } = {};
  private cadences: (number | undefined)[] = [];
  private lastLapIndex = -1;

  constructor(private readonly d: Deps) {
    this.trainerSup = new Supervisor(d.trainer, { onError: (e) => this.fail(e) });
    this.hrSup = new Supervisor(d.hr, { onError: (e) => this.fail(e) });
    this.trainerSup.onStatus((t) => {
      d.log?.('status.bike', t);
      this.patch({ trainer: t });
    });
    this.hrSup.onStatus((h) => {
      d.log?.('status.pulsgurt', h);
      this.patch({ hr: h });
    });
    this.trainerSup.onConnected(() => this.player?.resendTarget());
    d.trainer.onData((x) => {
      this.lastTrainerAt = d.clock.now();
      this.liveRaw = { ...this.liveRaw, power: x.power, cadence: x.cadence, speedKmh: x.speedKmh };
    });
    d.hr.onHeartRate((bpm) => {
      this.lastHrAt = d.clock.now();
      this.liveRaw = { ...this.liveRaw, heartRate: bpm };
    });
  }

  // ---------- Zustand ----------

  state(): AppState {
    return this.s;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private patch(p: Partial<AppState>): void {
    this.s = { ...this.s, ...p };
    for (const l of this.listeners) l();
  }

  private fail(e: unknown): void {
    console.error(e);
    this.d.log?.('fehler', String(e));
    const msg = describeError(e);
    if (msg) this.patch({ error: msg });
  }

  clearMessages(): void {
    this.patch({ error: undefined, notice: undefined });
  }

  private async guard(label: string | undefined, fn: () => Promise<void>): Promise<void> {
    if (label) this.patch({ busy: label });
    try {
      await fn();
    } catch (e) {
      this.fail(e);
    } finally {
      if (label) this.patch({ busy: undefined });
    }
  }

  // ---------- Start ----------

  async init(): Promise<void> {
    await this.guard(undefined, async () => {
      const [profiles, active, library, sessions] = await Promise.all([
        this.d.profiles.list(),
        this.d.profiles.active(),
        this.d.library.list(),
        listSessions(this.d.recStore),
      ]);
      this.patch({
        profiles,
        active,
        library,
        unfinished: sessions.filter((m) => !m.finished),
        recent: sessions.filter((m) => m.finished).slice(0, 10),
        trainerName: this.d.trainer.name,
        ready: true,
      });
    });
  }

  private async refreshProfiles(): Promise<void> {
    this.patch({ profiles: await this.d.profiles.list(), active: await this.d.profiles.active() });
  }

  async selectProfile(id: string | null): Promise<void> {
    await this.guard(undefined, async () => {
      await this.d.profiles.setActive(id);
      await this.refreshProfiles();
      this.patch({ icu: { loading: false, workouts: [], skipped: [] } });
    });
  }

  async saveProfile(input: { id?: string; name: string; ftp: number; athleteId?: string; apiKey?: string }): Promise<void> {
    await this.guard(undefined, async () => {
      const old = input.id ? await this.d.profiles.get(input.id) : undefined;
      const icu = input.athleteId?.trim() && input.apiKey?.trim() ? { athleteId: input.athleteId.trim(), apiKey: input.apiKey.trim() } : undefined;
      const p: Profile = { hrStraps: [], ...old, id: old?.id ?? newId(), name: input.name.trim(), ftp: input.ftp, icu };
      await this.d.profiles.save(p);
      await this.d.profiles.setActive(p.id);
      await this.refreshProfiles();
    });
  }

  async removeProfile(id: string): Promise<void> {
    await this.guard(undefined, async () => {
      await this.d.profiles.remove(id);
      await this.refreshProfiles();
    });
  }

  setGuestFtp(ftp: number | undefined): void {
    this.patch({ guestFtp: ftp });
  }

  rider(): RiderContext {
    return riderContext(this.s.active, this.s.guestFtp);
  }

  // ---------- Geräte ----------

  async pairBike(): Promise<void> {
    await this.guard(undefined, async () => {
      this.trainerSup.stop();
      await this.d.trainer.pair();
      this.patch({ trainerName: this.d.trainer.name });
      this.trainerSup.start();
    });
  }

  async pairStrap(): Promise<void> {
    await this.guard(undefined, async () => {
      this.hrSup.stop();
      const strap = await this.d.hr.requestNew();
      if (this.s.active) {
        await this.d.profiles.save(addStrap(this.s.active, strap));
        await this.refreshProfiles();
      }
      this.hrSup.start();
    });
  }

  /** Gespeicherten Gurt des Profils wählen und ohne Auswahlfenster verbinden. */
  async useStrap(id: string): Promise<void> {
    await this.guard(undefined, async () => {
      if (!this.s.active) return;
      this.hrSup.stop();
      await this.d.hr.connectKnown(id);
      await this.d.profiles.save(selectStrap(this.s.active, id));
      await this.refreshProfiles();
      this.hrSup.start();
    });
  }

  // ---------- Trainings ----------

  async refreshLibrary(): Promise<void> {
    this.patch({ library: await this.d.library.list() });
  }

  async addToLibrary(w: Workout): Promise<void> {
    await this.guard(undefined, async () => {
      await this.d.library.add(w, true);
      await this.refreshLibrary();
      this.patch({ notice: T.inBibliothekGespeichert });
    });
  }

  async setFavorite(id: string, fav: boolean): Promise<void> {
    await this.guard(undefined, async () => {
      await this.d.library.setFavorite(id, fav);
      await this.refreshLibrary();
    });
  }

  async removeFromLibrary(id: string): Promise<void> {
    await this.guard(undefined, async () => {
      await this.d.library.remove(id);
      await this.refreshLibrary();
    });
  }

  async loadIcu(): Promise<void> {
    const acc = this.s.active?.icu;
    if (!acc) return;
    this.patch({ icu: { loading: true, workouts: [], skipped: [] } });
    try {
      const from = new Date();
      const to = new Date(from.getTime() + 14 * 86_400_000);
      const r = await this.d.makeIcu(acc).listRideWorkouts(from, to);
      this.patch({ icu: { loading: false, workouts: r.workouts, skipped: r.skipped } });
    } catch (e) {
      this.patch({ icu: { loading: false, workouts: [], skipped: [], error: describeError(e) ?? undefined } });
    }
  }

  parseManual(name: string, text: string): Workout | undefined {
    try {
      return parseManualBlocks(name || T.vonHand, text);
    } catch (e) {
      this.fail(e);
      return undefined;
    }
  }

  // ---------- Fahrt ----------

  async startRide(kind: RideKind, workout: Workout | null): Promise<void> {
    await this.guard(undefined, async () => {
      const w = kind === 'rampe' ? rampWorkout() : kind === 'training' ? workout : null;
      if (kind === 'training' && !w) throw new Error(T.keinTraining);
      const rider = this.rider();
      const name = w?.name ?? (kind === 'frei' ? T.freiesTraining : kind === 'zwanzig' ? T.zwanzigMinTest : T.vierDpTest);
      this.recorder = new Recorder(
        { sessionId: newId(), startedAt: new Date(this.d.clock.now()), workoutName: name, riderName: rider.name, ftp: rider.ftp },
        this.d.recStore,
        { onError: (e) => this.fail(e) },
      );
      this.cadences = [];
      this.lastLapIndex = -1;
      this.player = new Player(w, this.d.trainer, this.d.clock, {
        // Ist das Bike gerade getrennt, wird die Zielwatt nach der Wiederverbindung nachgesetzt (kein Fehler für den Fahrer).
        onError: (e) => (this.s.trainer === 'verbunden' ? this.fail(e) : console.warn('Bike nicht erreichbar, Zielwatt wird nachgesetzt', e)),
      });
      this.player.onChange((ps) => this.onPlayerChange(ps));
      this.d.log?.('fahrt.start', { kind, training: w?.name, bloecke: w?.blocks.length });
      this.patch({ screen: 'fahrt', rideKind: kind, workout: w, result: undefined, error: undefined });
      void this.d.wake.acquire().catch((e) => this.fail(e));
      this.player.start();
      this.nextRecordAt = this.d.clock.now() + 1000;
      this.timer = setInterval(() => this.onTimer(), 250);
    });
  }

  private onPlayerChange(ps: PlayerState): void {
    if (ps.status !== 'bereit' && ps.blockIndex !== this.lastLapIndex && ps.current) {
      this.lastLapIndex = ps.blockIndex;
      this.recorder?.markLap(ps.current.label || `${T.block} ${ps.blockIndex + 1}`);
    }
    this.patch({ player: ps });
    if (ps.status === 'fertig' && this.s.screen === 'fahrt') void this.finishRide();
  }

  private fresh(at: number, v: number | undefined): number | undefined {
    return this.d.clock.now() - at <= STALE_MS ? v : undefined;
  }

  private latest(): Latest {
    const r = this.liveRaw;
    return {
      power: this.fresh(this.lastTrainerAt, r.power),
      cadence: this.fresh(this.lastTrainerAt, r.cadence),
      speedKmh: this.fresh(this.lastTrainerAt, r.speedKmh),
      heartRate: this.fresh(this.lastHrAt, r.heartRate),
    };
  }

  private onTimer(): void {
    this.player?.tick();
    let recorded = false;
    while (this.d.clock.now() >= this.nextRecordAt && this.recorder) {
      const l = this.latest();
      this.recorder.tick(l);
      this.cadences.push(l.cadence);
      this.nextRecordAt += 1000;
      recorded = true;
    }
    this.patch({ live: this.latest() });
    if (recorded && this.s.rideKind === 'rampe' && riderStopped(this.cadences)) void this.finishRide();
  }

  pause(): void {
    this.player?.pause();
  }
  resume(): void {
    this.player?.resume();
  }
  skip(): void {
    this.player?.skip();
  }
  setIntensity(pct: number): void {
    try {
      this.player?.setIntensityPercent(pct);
    } catch (e) {
      this.fail(e);
    }
  }
  toFree(): void {
    this.player?.switchToFree();
  }
  toWorkout(): void {
    this.player?.switchToWorkout();
  }

  async finishRide(): Promise<void> {
    const rec = this.recorder;
    if (!rec || this.s.screen !== 'fahrt') return;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.d.log?.('fahrt.ende', { sekunden: rec.records.length });
    const player = this.player;
    this.player = null; // zuerst abmelden: player.finish() meldet 'fertig' und würde sonst finishRide() erneut anstoßen
    this.recorder = null;
    player?.finish();
    await this.guard(undefined, async () => {
      await rec.finish();
      await this.d.wake.release().catch((e) => this.fail(e));
      const recording: Recording = { meta: rec.meta(true), records: rec.records };
      const kind = this.s.rideKind;
      const powers = rec.records.map((r) => r.power ?? 0);
      const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);
      const result: RideResult = {
        recording,
        kind,
        avgPower: avg(rec.records.flatMap((r) => (r.power === undefined ? [] : [r.power]))),
        avgHeartRate: avg(rec.records.flatMap((r) => (r.heartRate === undefined ? [] : [r.heartRate]))),
      };
      if (kind === 'rampe') result.ftpSuggestion = ftpFromRamp(powers);
      if (kind === 'zwanzig') result.ftpSuggestion = ftpFromTwentyMinuteTest(powers);
      if (kind === 'vierdp') {
        result.fourDp = fourDpResult(powers);
        result.ftpSuggestion = result.fourDp.ftpSuggestion;
      }
      this.patch({ screen: 'ende', result, player: null, live: {} });
      await this.reloadSessions();
    });
  }

  private async reloadSessions(): Promise<void> {
    const sessions = await listSessions(this.d.recStore);
    this.patch({ unfinished: sessions.filter((m) => !m.finished), recent: sessions.filter((m) => m.finished).slice(0, 10) });
  }

  // ---------- Ergebnis ----------

  /** FTP-Vorschlag des Tests übernehmen. */
  async applyFtp(ftp: number): Promise<void> {
    await this.guard(undefined, async () => {
      if (this.s.active) {
        await this.d.profiles.save({ ...this.s.active, ftp });
        await this.refreshProfiles();
      } else this.patch({ guestFtp: ftp });
      this.patch({ notice: T.ftpUebernommen(ftp) });
    });
  }

  saveFit(): void {
    const r = this.s.result;
    if (!r) return;
    try {
      this.d.saveFile(buildFit(r.recording), fitFileName(r.recording.meta));
      this.patch({ result: { ...r, saved: true } });
    } catch (e) {
      this.fail(e);
    }
  }

  async uploadFit(): Promise<void> {
    const r = this.s.result;
    const rider = this.rider();
    if (!r || !rider.canUpload || !rider.profile?.icu) return; // Gast: kein Upload
    await this.guard(T.ladeHoch, async () => {
      const res = await this.d.makeIcu(rider.profile!.icu!).uploadFit(buildFit(r.recording), fitFileName(r.recording.meta));
      this.patch({ result: { ...r, uploaded: res.activityId } });
    });
  }

  backToStart(): void {
    this.patch({ screen: 'start', result: undefined, workout: null, player: null, rideKind: 'frei' });
  }

  // ---------- Wiederherstellung ----------

  async openSession(id: string): Promise<void> {
    await this.guard(undefined, async () => {
      const recording = await recoverRecording(this.d.recStore, id);
      if (!recording) throw new Error(T.fahrtNichtGefunden);
      this.patch({ screen: 'ende', result: { recording, kind: 'frei' } });
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.guard(undefined, async () => {
      await deleteRecording(this.d.recStore, id);
      await this.reloadSessions();
      if (this.s.result?.recording.meta.sessionId === id) this.backToStart();
    });
  }
}
