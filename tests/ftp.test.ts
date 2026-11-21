import { Decoder, Stream } from '@garmin/fitsdk';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bestAverage, defaultRamp, fourDpResult, ftpFromRamp, ftpFromTwentyMinuteTest, rampWorkout, riderStopped } from '../src/domain/ftp';

const constant = (w: number, sec: number) => Array.from({ length: sec }, () => w);

describe('FTP-Tests', () => {
  it('findet den besten Durchschnitt über ein Fenster', () => {
    const p = [...constant(100, 30), ...constant(300, 10), ...constant(100, 30)];
    expect(bestAverage(p, 10)).toEqual({ watts: 300, startSec: 30 });
    expect(bestAverage(p, 1000)).toBeUndefined();
  });

  it('[SR-e6536b/AK-btdj] ein 20-Minuten-Test liefert einen FTP-Vorschlag (95 % der besten 20 Minuten)', () => {
    const p = [...constant(150, 600), ...constant(300, 1200), ...constant(100, 300)];
    expect(ftpFromTwentyMinuteTest(p)).toBe(285);
    expect(ftpFromTwentyMinuteTest(constant(300, 600))).toBeUndefined(); // zu kurz
  });

  it('[SR-e50794/AK-g5rf] der Rampentest steigert stufenweise, endet bei Abbruch und schlägt einen FTP vor', () => {
    const w = rampWorkout();
    expect(w.blocks[0]).toMatchObject({ watts: 100, durationSec: 60 });
    expect(w.blocks[1]).toMatchObject({ watts: 120, durationSec: 60 });
    expect(w.blocks.at(-1)!.durationSec).toBeNull(); // endet erst durch Abbruch
    // Fahrer schafft Stufen bis 300 W (Stufe 11), danach Abbruch
    const powers: number[] = [];
    for (let i = 0; i < 11; i++) powers.push(...constant(defaultRamp.startWatts + i * defaultRamp.stepWatts, 60));
    expect(ftpFromRamp(powers)).toBe(225); // 75 % von 300 W
    // Abbruch erkannt, wenn 10 Sekunden lang nicht getreten wird
    const cad = [...constant(90, 100), ...constant(0, 10)];
    expect(riderStopped(cad)).toBe(true);
    expect(riderStopped(constant(90, 100))).toBe(false);
    expect(riderStopped([0, 0, 0])).toBe(false); // zu wenig Daten
  });

  it('[SR-12969a/AK-cgs8] 4DP: zeigt die Bestleistung je Belastung und schlägt die beste 20-Minuten-Leistung als FTP vor', () => {
    // Nachgebaut nach der echten Aufzeichnung 4dptest.fit: 5 s, 5 min, 20 min, 1 min
    const p = [
      ...constant(185, 780),
      ...constant(957, 5),
      ...constant(150, 440),
      ...constant(341, 300),
      ...constant(60, 200),
      ...constant(274, 1200),
      ...constant(65, 1500),
      ...constant(419, 60),
    ];
    const r = fourDpResult(p);
    expect(r).toEqual({ best5s: 957, best1min: 419, best5min: 341, best20min: 274, ftpSuggestion: 274 });
  });

  const real = 'docs/m0/4dptest.fit';
  it.skipIf(!existsSync(real))('[SR-12969a/AK-cgs8] 4DP: echte Aufzeichnung ergibt 274 W als FTP-Vorschlag (wie Wahoo)', () => {
    const { messages } = new Decoder(Stream.fromByteArray(Array.from(readFileSync(real)))).read();
    const powers = messages.recordMesgs!.map((r: { power?: number }) => r.power ?? 0);
    const r = fourDpResult(powers);
    expect(r.ftpSuggestion).toBe(274);
    expect(r.best5s).toBe(957);
    expect(r.best1min).toBe(419);
    expect(r.best5min).toBe(341);
  });
});
