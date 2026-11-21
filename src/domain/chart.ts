// Aufbereitung für das Verlaufsdiagramm: reine Rechnung ohne Oberfläche.

export type Series = (number | undefined)[];

/** Gleitender Mittelwert über win Werte (nur vorhandene Werte zählen). */
export function movingAverage(xs: Series, win: number): Series {
  if (win <= 1) return [...xs];
  const out: Series = [];
  for (let i = 0; i < xs.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - win + 1); j <= i; j++) {
      const v = xs[j];
      if (v !== undefined) {
        sum += v;
        n++;
      }
    }
    out.push(xs[i] === undefined ? undefined : n ? sum / n : undefined);
  }
  return out;
}

/** Fasst je factor Werte zu einem Mittelwert zusammen (Lücken bleiben Lücken). */
export function downsample(xs: Series, factor: number): Series {
  if (factor <= 1) return [...xs];
  const out: Series = [];
  for (let i = 0; i < xs.length; i += factor) {
    let sum = 0;
    let n = 0;
    for (let j = i; j < Math.min(xs.length, i + factor); j++) {
      const v = xs[j];
      if (v !== undefined) {
        sum += v;
        n++;
      }
    }
    out.push(n ? sum / n : undefined);
  }
  return out;
}

/** Aufrunden auf eine glatte Obergrenze (Vielfache von step). */
export function niceMax(v: number, step: number): number {
  return Math.max(step, Math.ceil(v / step) * step);
}

export interface PathBox {
  width: number;
  height: number;
  min: number;
  max: number;
  /** Gesamtzahl der Sekunden, die der Zeitachse entsprechen. */
  domainSec: number;
  /** Sekunden je Wert in xs. */
  stepSec: number;
}

/** SVG-Pfad (M/L); fehlende Werte unterbrechen die Linie. */
export function toPath(xs: Series, box: PathBox): string {
  let d = '';
  let pen = false;
  xs.forEach((v, i) => {
    if (v === undefined || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    const x = (((i + 0.5) * box.stepSec) / box.domainSec) * box.width;
    const y = box.height - ((v - box.min) / (box.max - box.min)) * box.height;
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

export interface ChartRecord {
  power?: number;
  heartRate?: number;
  cadence?: number;
  target?: number;
}

export interface ChartModel {
  paths: { power: string; target: string; heartRate: string; cadence: string };
  leftMax: number;
  rightMin: number;
  rightMax: number;
  domainSec: number;
  /** Minutenmarken für die Zeitachse. */
  ticksMin: number[];
}

/**
 * Baut das Diagramm: links Watt (Leistung und Ziel), rechts Puls und Trittfrequenz.
 * Die Zeitachse reicht mindestens bis plannedSec (geplante Trainingsdauer), damit der Rest sichtbar bleibt.
 */
export function buildChart(records: ChartRecord[], opts: { width: number; height: number; plannedSec?: number; maxPoints?: number }): ChartModel {
  const maxPoints = opts.maxPoints ?? 700;
  const domainSec = Math.max(records.length, opts.plannedSec ?? 0, 60);
  const factor = Math.max(1, Math.ceil(records.length / maxPoints));
  const col = (f: (r: ChartRecord) => number | undefined): Series => records.map(f);
  const power = downsample(movingAverage(col((r) => r.power), 5), factor);
  const target = downsample(col((r) => r.target), factor);
  const hr = downsample(col((r) => r.heartRate), factor);
  const cad = downsample(movingAverage(col((r) => r.cadence), 5), factor);

  const defined = (s: Series) => s.filter((v): v is number => v !== undefined);
  const leftMax = niceMax(Math.max(...defined(power), ...defined(target), 100) * 1.08, 50);
  const right = [...defined(hr), ...defined(cad)];
  const rightMin = right.length ? Math.max(0, Math.floor((Math.min(...right) - 5) / 10) * 10) : 0;
  const rightMax = right.length ? Math.max(rightMin + 40, niceMax(Math.max(...right) + 5, 10)) : 100;

  const base = { width: opts.width, height: opts.height, domainSec, stepSec: factor };
  const stepMin = domainSec > 90 * 60 ? 20 : domainSec > 40 * 60 ? 10 : domainSec > 15 * 60 ? 5 : 1;
  const ticksMin: number[] = [];
  for (let m = stepMin; m * 60 <= domainSec; m += stepMin) ticksMin.push(m);
  return {
    paths: {
      power: toPath(power, { ...base, min: 0, max: leftMax }),
      target: toPath(target, { ...base, min: 0, max: leftMax }),
      heartRate: toPath(hr, { ...base, min: rightMin, max: rightMax }),
      cadence: toPath(cad, { ...base, min: rightMin, max: rightMax }),
    },
    leftMax,
    rightMin,
    rightMax,
    domainSec,
    ticksMin,
  };
}
