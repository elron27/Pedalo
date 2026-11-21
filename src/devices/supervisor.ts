import type { Connectable, ConnectionStatus } from '../ports';

export interface SupervisorOptions {
  /** Wartezeiten zwischen Verbindungsversuchen; die letzte gilt für alle weiteren. */
  retryDelaysMs?: number[];
  onError?: (e: unknown) => void;
}

/**
 * Hält ein Gerät verbunden: wiederholt fehlgeschlagene Verbindungsversuche (schon der erste kann scheitern, siehe M0),
 * verbindet nach einem Abbruch selbständig neu und meldet jede erfolgreiche Verbindung.
 */
export class Supervisor {
  private current: ConnectionStatus = 'getrennt';
  private wanted = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private statusCbs: ((s: ConnectionStatus) => void)[] = [];
  private connectedCbs: ((first: boolean) => void)[] = [];
  private everConnected = false;
  private readonly delays: number[];
  private readonly onError: (e: unknown) => void;

  constructor(
    private readonly device: Connectable,
    opts: SupervisorOptions = {},
  ) {
    this.delays = opts.retryDelaysMs ?? [1000, 2000, 5000];
    this.onError = opts.onError ?? ((e) => console.error('Verbindung', e));
    device.onDisconnect(() => {
      if (!this.wanted) return;
      this.set('getrennt');
      this.schedule();
    });
  }

  get status(): ConnectionStatus {
    return this.current;
  }

  onStatus(cb: (s: ConnectionStatus) => void): void {
    this.statusCbs.push(cb);
  }

  /** Wird nach jeder erfolgreichen Verbindung gerufen; first = erste Verbindung seit start(). */
  onConnected(cb: (first: boolean) => void): void {
    this.connectedCbs.push(cb);
  }

  private set(s: ConnectionStatus): void {
    if (s === this.current) return;
    this.current = s;
    for (const cb of this.statusCbs) cb(s);
  }

  start(): void {
    if (this.wanted) return;
    this.wanted = true;
    this.attempt = 0;
    void this.tryConnect();
  }

  stop(): void {
    this.wanted = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.device.disconnect();
    this.set('getrennt');
  }

  private async tryConnect(): Promise<void> {
    if (!this.wanted) return;
    this.set('verbindet');
    try {
      await this.device.connect();
      if (!this.wanted) {
        this.device.disconnect();
        return;
      }
      this.attempt = 0;
      this.set('verbunden');
      const first = !this.everConnected;
      this.everConnected = true;
      for (const cb of this.connectedCbs) cb(first);
    } catch (e) {
      this.onError(e);
      if (!this.wanted) return;
      this.set('getrennt');
      this.schedule();
    }
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    const delay = this.delays[Math.min(this.attempt, this.delays.length - 1)] ?? 1000;
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.tryConnect();
    }, delay);
  }
}
