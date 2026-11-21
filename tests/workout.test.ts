import { describe, expect, it } from 'vitest';
import events from './fixtures/icu-events.json';
import { parseManualBlocks, totalDurationSec, workoutFromIntervalsDoc, WorkoutParseError, workoutProfile } from '../src/domain/workout';

const byName = (n: string) => events.find((e) => e.name.startsWith(n))!;

describe('Blockstruktur aus intervals.icu', () => {
  it('[SR-ac287d/AK-s6gr] rollt Wiederholungen aus, behält Watt genau und kennt offene Blöcke', () => {
    const e = byName('Sweet spot 2');
    const w = workoutFromIntervalsDoc(e.name, e.workout_doc);
    // Einfahren, Aufbau, 2x (Sweetspot, locker), Ausfahren = 2 + 4 + 1 Blöcke
    expect(w.blocks.map((b) => [b.durationSec, b.watts])).toEqual([
      [600, 151],
      [300, 206],
      [1200, 250],
      [300, 151],
      [1200, 250],
      [300, 151],
      [300, 124],
    ]);
    expect(totalDurationSec(w)).toBe(4200);

    // Offener Block: Schritt ohne Dauer (synthetisches Beispiel, ein echtes liegt noch nicht vor)
    const open = workoutFromIntervalsDoc('offen', {
      steps: [
        { power: { units: 'w', value: 120 }, duration: 300 },
        { text: 'bis Taste', power: { units: 'w', value: 200 } },
      ],
    });
    expect(open.blocks[1]).toEqual({ label: 'bis Taste', durationSec: null, watts: 200 });
    expect(totalDurationSec(open)).toBeNull();
  });

  it('rollt 6 Wiederholungen mit Sprint aus und übernimmt 798 W unverändert', () => {
    const e = byName('Entlastung');
    const w = workoutFromIntervalsDoc(e.name, e.workout_doc);
    expect(w.blocks.filter((b) => b.label === 'Sprint')).toHaveLength(6);
    expect(w.blocks.find((b) => b.label === 'Sprint')!.watts).toBe(798);
    expect(totalDurationSec(w)).toBe(3720);
  });

  it('rechnet %ftp nur mit FTP des Termins um und meldet sonst einen Fehler', () => {
    const doc = { steps: [{ power: { units: '%ftp', value: 50 }, duration: 60 }] };
    expect(workoutFromIntervalsDoc('x', doc, { icuFtp: 274 }).blocks[0]!.watts).toBe(137);
    expect(() => workoutFromIntervalsDoc('x', doc)).toThrow(WorkoutParseError);
  });

  it('weist nicht darstellbare Blöcke mit klarer Meldung zurück (Puls, Rampe, leer)', () => {
    expect(() => workoutFromIntervalsDoc('l', byName('Lauf').workout_doc)).toThrow(/Leistung/);
    expect(() => workoutFromIntervalsDoc('r', { steps: [{ duration: 60, power: { units: 'w', start: 100, end: 200 } }] })).toThrow(/Rampen/);
    expect(() => workoutFromIntervalsDoc('g', byName('Gym').workout_doc)).toThrow(/ohne Leistungsblöcke/);
  });

  it('liefert ein Profil mit Startzeiten, offener Block bekommt eine Anzeigebreite', () => {
    const p = workoutProfile({ name: 'a', blocks: [{ label: '', durationSec: 60, watts: 100 }, { label: '', durationSec: null, watts: 200 }] });
    expect(p.map((s) => [s.startSec, s.sec, s.open])).toEqual([[0, 60, false], [60, 300, true]]);
  });
});

describe('Handeingabe', () => {
  it('liest Minuten, mm:ss und offene Blöcke', () => {
    const w = parseManualBlocks('Test', '10:00 150\n5 200\n\noffen 120 W');
    expect(w.blocks.map((b) => [b.durationSec, b.watts])).toEqual([[600, 150], [300, 200], [null, 120]]);
  });
  it('nennt die Zeile bei Fehlern', () => {
    expect(() => parseManualBlocks('T', '10:00 150\nquatsch')).toThrow(/Zeile 2/);
    expect(() => parseManualBlocks('T', '')).toThrow(/Keine Blöcke/);
  });
});
