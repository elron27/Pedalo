import type { Block, Workout } from './workout';

/** Bester Durchschnitt über ein Fenster von windowSec Sekunden (1 Wert je Sekunde, fehlende Werte zählen als 0). */
export function bestAverage(powers: number[], windowSec: number): { watts: number; startSec: number } | undefined {
  if (powers.length < windowSec) return undefined;
  let sum = 0;
  let best = -1;
  let at = 0;
  for (let i = 0; i < powers.length; i++) {
    sum += powers[i]!;
    if (i >= windowSec) sum -= powers[i - windowSec]!;
    if (i >= windowSec - 1 && sum > best) {
      best = sum;
      at = i - windowSec + 1;
    }
  }
  return { watts: best / windowSec, startSec: at };
}

/** 20-Minuten-Test: FTP-Vorschlag = 95 % der besten 20-Minuten-Leistung (übliche Regel, Annahme). */
export function ftpFromTwentyMinuteTest(powers: number[]): number | undefined {
  const b = bestAverage(powers, 1200);
  return b ? Math.round(b.watts * 0.95) : undefined;
}

export interface FourDpResult {
  best5s?: number;
  best1min?: number;
  best5min?: number;
  best20min?: number;
  /** FTP-Vorschlag = beste Leistung über 1200 s (Annahme aus einem Datenpunkt, siehe SR-12969a). */
  ftpSuggestion?: number;
}

export function fourDpResult(powers: number[]): FourDpResult {
  const r = (s: number) => {
    const b = bestAverage(powers, s);
    return b ? Math.round(b.watts) : undefined;
  };
  const best20min = r(1200);
  return { best5s: r(5), best1min: r(60), best5min: r(300), best20min, ftpSuggestion: best20min };
}

export interface RampConfig {
  startWatts: number;
  stepWatts: number;
  stepSec: number;
  maxSteps: number;
}

/** Vorgaben des Rampentests (Annahme: übliche Werte, anpassbar). */
export const defaultRamp: RampConfig = { startWatts: 100, stepWatts: 20, stepSec: 60, maxSteps: 30 };

/** Rampentest als Training; der letzte Block ist offen, der Test endet durch Abbruch des Fahrers. */
export function rampWorkout(cfg: RampConfig = defaultRamp): Workout {
  const blocks: Block[] = [];
  for (let i = 0; i < cfg.maxSteps; i++) {
    const last = i === cfg.maxSteps - 1;
    blocks.push({ label: `Stufe ${i + 1}`, durationSec: last ? null : cfg.stepSec, watts: cfg.startWatts + i * cfg.stepWatts });
  }
  return { name: 'Rampentest', blocks };
}

/** Der Fahrer hat aufgehört zu treten: die letzten seconds Sekunden ohne Trittfrequenz. */
export function riderStopped(cadences: (number | undefined)[], seconds = 10): boolean {
  if (cadences.length < seconds) return false;
  return cadences.slice(-seconds).every((c) => !c);
}

/** Rampentest: FTP-Vorschlag = 75 % der besten Minute (übliche Regel, Annahme). */
export function ftpFromRamp(powers: number[], stepSec = defaultRamp.stepSec): number | undefined {
  const b = bestAverage(powers, stepSec);
  return b ? Math.round(b.watts * 0.75) : undefined;
}
