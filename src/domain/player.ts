import type { Clock, TargetSink } from '../ports';
import type { Block, Workout } from './workout';

export type PlayerStatus = 'bereit' | 'laeuft' | 'pause' | 'frei' | 'fertig';

export interface PlayerState {
  status: PlayerStatus;
  blockIndex: number;
  blockElapsedSec: number;
  /** null bei offenem Block. */
  blockRemainingSec: number | null;
  totalElapsedSec: number;
  intensityPct: number;
  /** Zielwatt, die gerade am Bike stehen soll (null im freien Training). */
  targetWatts: number | null;
  current: Block | null;
  next: Block | null;
}

export interface PlayerOptions {
  /** Zielleistung während der Pause (Watt). Die FTMS-Pause ändert die Leistung nicht (M0), deshalb setzt die App sie selbst. */
  pauseWatts?: number;
  onError?: (e: unknown) => void;
}

/**
 * Spielt ein Training ab. Zeit kommt von außen (Clock + tick()), das Bike wird über TargetSink gesteuert.
 * Der Timer läuft unabhängig von der Verbindung zum Bike weiter; schlägt das Setzen der Zielwatt fehl,
 * wird das über onError gemeldet und resendTarget() holt es nach.
 */
export class Player {
  private status: PlayerStatus = 'bereit';
  private blockIndex = 0;
  private blockElapsed = 0;
  private total = 0;
  private intensity = 100;
  private lastTick = 0;
  private listeners: ((s: PlayerState) => void)[] = [];
  private readonly pauseWatts: number;
  private readonly onError: (e: unknown) => void;
  private resumeStatus: PlayerStatus = 'laeuft';

  constructor(
    private readonly workout: Workout | null,
    private readonly sink: TargetSink,
    private readonly clock: Clock,
    opts: PlayerOptions = {},
  ) {
    this.pauseWatts = opts.pauseWatts ?? 0;
    this.onError = opts.onError ?? (() => {});
  }

  onChange(cb: (s: PlayerState) => void): void {
    this.listeners.push(cb);
  }

  state(): PlayerState {
    const blocks = this.workout?.blocks ?? [];
    const cur = this.status === 'fertig' ? null : (blocks[this.blockIndex] ?? null);
    const next = blocks[this.blockIndex + 1] ?? null;
    const dur = cur?.durationSec ?? null;
    return {
      status: this.status,
      blockIndex: this.blockIndex,
      blockElapsedSec: this.blockElapsed,
      blockRemainingSec: dur === null ? null : Math.max(0, dur - this.blockElapsed),
      totalElapsedSec: this.total,
      intensityPct: this.intensity,
      targetWatts: this.currentTarget(),
      current: cur,
      next: this.status === 'fertig' ? null : next,
    };
  }

  private currentTarget(): number | null {
    if (this.status === 'laeuft') {
      const b = this.workout?.blocks[this.blockIndex];
      return b ? Math.round((b.watts * this.intensity) / 100) : null;
    }
    if (this.status === 'pause') return this.pauseWatts;
    return null;
  }

  private emit(): void {
    const s = this.state();
    for (const l of this.listeners) l(s);
  }

  private send(fn: () => Promise<void> | void): void {
    try {
      const r = fn();
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch((e) => this.onError(e));
    } catch (e) {
      this.onError(e);
    }
  }

  private applyTarget(): void {
    const t = this.currentTarget();
    if (t === null) this.send(() => this.sink.setFreeRide());
    else this.send(() => this.sink.setTargetPower(t));
  }

  /** Training starten (mit Workout) bzw. freies Training ohne Workout. */
  start(): void {
    if (this.status !== 'bereit') return;
    this.lastTick = this.clock.now();
    if (!this.workout || this.workout.blocks.length === 0) this.status = 'frei';
    else this.status = 'laeuft';
    this.applyTarget();
    this.emit();
  }

  /** Zeit fortschreiben. Wird regelmäßig aufgerufen (z. B. 4x pro Sekunde). */
  tick(): void {
    const now = this.clock.now();
    let dt = Math.max(0, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (dt === 0 || this.status === 'bereit' || this.status === 'fertig' || this.status === 'pause') return;
    this.total += dt;
    if (this.status === 'laeuft') {
      const blocks = this.workout!.blocks;
      let changed = false;
      while (this.status === 'laeuft') {
        const dur = blocks[this.blockIndex]!.durationSec;
        if (dur === null) {
          this.blockElapsed += dt;
          break;
        }
        const left = dur - this.blockElapsed;
        if (dt < left) {
          this.blockElapsed += dt;
          break;
        }
        dt -= left;
        changed = true;
        this.advance();
      }
      if (changed) this.applyTarget();
    }
    this.emit();
  }

  private advance(): void {
    const blocks = this.workout!.blocks;
    this.blockElapsed = 0;
    if (this.blockIndex + 1 >= blocks.length) {
      this.status = 'fertig';
      this.send(() => this.sink.setFreeRide());
    } else this.blockIndex += 1;
  }

  pause(): void {
    if (this.status !== 'laeuft' && this.status !== 'frei') return;
    this.tick();
    this.resumeStatus = this.status;
    this.status = 'pause';
    this.applyTarget();
    this.emit();
  }

  resume(): void {
    if (this.status !== 'pause') return;
    this.lastTick = this.clock.now();
    this.status = this.resumeStatus;
    this.applyTarget();
    this.emit();
  }

  /** Aktuellen Block überspringen: sofort der nächste Block mit seiner Zielwatt. */
  skip(): void {
    if (this.status !== 'laeuft') return;
    this.tick();
    this.advance();
    this.applyTarget();
    this.emit();
  }

  /** Intensität in Prozent (100 = wie im Training). Wirkt auf den aktuellen und alle folgenden Blöcke. */
  setIntensityPercent(pct: number): void {
    if (!Number.isFinite(pct) || pct < 10 || pct > 300) throw new RangeError('Intensität muss zwischen 10 und 300 Prozent liegen.');
    this.intensity = Math.round(pct);
    if (this.status === 'laeuft') this.applyTarget();
    this.emit();
  }

  /** Freies Training zuschalten (auch aus einem Workout heraus). Block-Timer ruht, die Gesamtzeit läuft. */
  switchToFree(): void {
    if (this.status === 'fertig' || this.status === 'bereit') return;
    this.tick();
    this.status = 'frei';
    this.applyTarget();
    this.emit();
  }

  /** Zurück ins Workout nach freiem Training. */
  switchToWorkout(): void {
    if (this.status !== 'frei' || !this.workout || this.workout.blocks.length === 0) return;
    this.tick();
    this.status = 'laeuft';
    this.applyTarget();
    this.emit();
  }

  /** Training beenden (Fahrer bricht ab oder ist fertig). */
  finish(): void {
    if (this.status === 'fertig') return;
    this.tick();
    this.status = 'fertig';
    this.send(() => this.sink.setFreeRide());
    this.emit();
  }

  /** Nach Wiederverbindung: aktuellen Zustand erneut am Bike setzen. */
  resendTarget(): void {
    if (this.status === 'bereit' || this.status === 'fertig') return;
    this.applyTarget();
  }
}
