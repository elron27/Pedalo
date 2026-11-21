import { describe, expect, it } from 'vitest';
import { buildChart, downsample, movingAverage, niceMax, toPath } from '../src/domain/chart';

describe('Diagramm-Rechnung', () => {
  it('glättet mit gleitendem Mittelwert und lässt Lücken offen', () => {
    expect(movingAverage([10, 20, 30, 40], 2)).toEqual([10, 15, 25, 35]);
    expect(movingAverage([10, undefined, 30], 2)).toEqual([10, undefined, 30]);
  });

  it('fasst Werte zusammen, Lücken bleiben Lücken', () => {
    expect(downsample([1, 3, 5, 7, 9], 2)).toEqual([2, 6, 9]);
    expect(downsample([undefined, undefined, 4, 6], 2)).toEqual([undefined, 5]);
  });

  it('rundet Obergrenzen auf glatte Werte', () => {
    expect(niceMax(263, 50)).toBe(300);
    expect(niceMax(1, 50)).toBe(50);
  });

  it('zeichnet Linien und unterbricht sie bei fehlenden Werten', () => {
    const box = { width: 100, height: 100, min: 0, max: 100, domainSec: 4, stepSec: 1 };
    expect(toPath([0, 100, undefined, 50], box)).toBe('M12.5 100.0 L37.5 0.0 M87.5 50.0');
  });

  it('baut aus Datensätzen vier Linien mit Achsen, auch bei 10 Stunden mit begrenzter Punktzahl', () => {
    const recs = Array.from({ length: 36_000 }, (_, i) => ({ power: 150 + (i % 50), heartRate: 120 + (i % 30), cadence: 85, target: 180 }));
    const m = buildChart(recs, { width: 1000, height: 200 });
    for (const p of Object.values(m.paths)) expect(p.startsWith('M')).toBe(true);
    expect((m.paths.power.match(/[ML]/g) ?? []).length).toBeLessThanOrEqual(700);
    expect(m.leftMax).toBeGreaterThanOrEqual(200);
    expect(m.rightMin).toBeLessThan(120);
    expect(m.rightMax).toBeGreaterThanOrEqual(140); // Puls-Mittel im Bereich 120 bis 149
    expect(m.ticksMin[0]).toBe(20);
  });

  it('reicht die Zeitachse bis zur geplanten Dauer, damit der Rest sichtbar bleibt', () => {
    const m = buildChart([{ power: 100, target: 100 }], { width: 1000, height: 200, plannedSec: 3600 });
    expect(m.domainSec).toBe(3600);
  });

  it('kommt ohne Daten und ohne Puls aus', () => {
    const m = buildChart([], { width: 1000, height: 200 });
    expect(m.paths).toEqual({ power: '', target: '', heartRate: '', cadence: '' });
    const n = buildChart([{ power: 120 }], { width: 1000, height: 200 });
    expect(n.paths.heartRate).toBe('');
    expect(n.paths.power.startsWith('M')).toBe(true);
  });
});
