import type { TrainerData, TrainerPort } from '../ports';

export type LogFn = (kind: string, data?: unknown) => void;

/** Protokoll für die Entwicklung: schickt Einträge an den Dev-Server (docs/m0/live.jsonl). Im Build ein No-op. */
export function createLogger(enabled: boolean): LogFn {
  if (!enabled) return () => {};
  const t0 = performance.now();
  return (kind, data) => {
    const e = { t: Math.round(performance.now() - t0), at: new Date().toISOString(), kind, data };
    fetch('/__log', { method: 'POST', body: JSON.stringify(e), keepalive: true }).catch(() => {});
  };
}

/** Umhüllt einen Trainer und protokolliert Befehle, Trennungen und (gedrosselt) die Messwerte. */
export function loggedTrainer<T extends TrainerPort & { pair(): Promise<void>; readonly name?: string }>(inner: T, log: LogFn): TrainerPort & { pair(): Promise<void>; readonly name?: string } {
  let lastData = 0;
  return {
    get name() {
      return inner.name;
    },
    pair: async () => {
      log('bike.koppeln');
      try {
        await inner.pair();
        log('bike.gekoppelt', { name: inner.name });
      } catch (e) {
        log('bike.koppeln.fehler', String(e));
        throw e;
      }
    },
    connect: async () => {
      try {
        await inner.connect();
        log('bike.verbunden');
      } catch (e) {
        log('bike.verbinden.fehler', String(e));
        throw e;
      }
    },
    disconnect: () => {
      log('bike.trennen');
      inner.disconnect();
    },
    onDisconnect: (cb) =>
      inner.onDisconnect(() => {
        log('bike.getrennt');
        cb();
      }),
    onData: (cb) =>
      inner.onData((d: TrainerData) => {
        const now = performance.now();
        if (now - lastData > 2000) {
          lastData = now;
          log('bike.daten', d);
        }
        cb(d);
      }),
    setTargetPower: async (w) => {
      log('bike.zielwatt', w);
      try {
        await inner.setTargetPower(w);
      } catch (e) {
        log('bike.zielwatt.fehler', String(e));
        throw e;
      }
    },
    setFreeRide: async () => {
      log('bike.frei(simulation 0 %)');
      try {
        await inner.setFreeRide();
      } catch (e) {
        log('bike.frei.fehler', String(e));
        throw e;
      }
    },
  };
}
