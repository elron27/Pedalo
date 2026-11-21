import { describe, expect, it } from 'vitest';
import { Player } from '../src/domain/player';
import type { Workout } from '../src/domain/workout';
import { FakeClock, RecordingSink } from './helpers';

const w: Workout = {
  name: 'Test',
  blocks: [
    { label: 'a', durationSec: 60, watts: 100 },
    { label: 'b', durationSec: 120, watts: 200 },
    { label: 'c', durationSec: null, watts: 150 },
  ],
};

function setup(workout: Workout | null = w) {
  const clock = new FakeClock();
  const sink = new RecordingSink();
  const errors: unknown[] = [];
  const p = new Player(workout, sink, clock, { onError: (e) => errors.push(e) });
  const run = (sec: number) => {
    clock.advance(sec * 1000);
    p.tick();
  };
  return { clock, sink, p, run, errors };
}

describe('Player', () => {
  it('[SR-00e7dd/AK-cd88] setzt beim Blockwechsel die Zielwatt des Blocks, mit Intensität multipliziert', () => {
    const { p, sink, run } = setup();
    p.start();
    expect(sink.last()).toBe('ziel:100');
    run(59);
    expect(sink.calls).toEqual(['ziel:100']);
    run(1);
    expect(sink.last()).toBe('ziel:200');
    p.setIntensityPercent(110);
    expect(sink.last()).toBe('ziel:220');
    run(120); // Block b zu Ende, Block c mit 150 * 1,10
    expect(sink.last()).toBe('ziel:165');
  });

  it('wechselt auch bei einem großen Zeitsprung korrekt über mehrere Blöcke', () => {
    const { p, sink, run } = setup();
    p.start();
    run(61 + 121);
    expect(p.state().blockIndex).toBe(2);
    expect(sink.last()).toBe('ziel:150');
  });

  it('[SR-cefa05/AK-tms3] Überspringen springt sofort zum nächsten Block und setzt dessen Zielwatt', () => {
    const { p, sink, run } = setup();
    p.start();
    run(10);
    p.skip();
    expect(p.state().blockIndex).toBe(1);
    expect(p.state().blockElapsedSec).toBe(0);
    expect(sink.last()).toBe('ziel:200');
  });

  it('läuft im offenen Block weiter, bis übersprungen wird, und endet danach', () => {
    const { p, sink, run } = setup();
    p.start();
    run(180);
    expect(p.state().blockIndex).toBe(2);
    run(1000);
    expect(p.state().status).toBe('laeuft');
    expect(p.state().blockRemainingSec).toBeNull();
    p.skip();
    expect(p.state().status).toBe('fertig');
    expect(sink.last()).toBe('frei');
  });

  it('[SR-74122b/AK-gt5y] Pause stoppt den Timer, Fortsetzen läuft ab dem Stand weiter', () => {
    const { p, sink, run } = setup();
    p.start();
    run(30);
    p.pause();
    expect(sink.last()).toBe('ziel:0');
    const at = p.state().blockElapsedSec;
    run(600); // lange Pause
    expect(p.state().blockElapsedSec).toBe(at);
    expect(p.state().totalElapsedSec).toBe(30);
    p.resume();
    expect(sink.last()).toBe('ziel:100');
    run(30);
    expect(p.state().blockIndex).toBe(1);
    expect(p.state().totalElapsedSec).toBe(60);
  });

  it('[SR-7ed21c/AK-zvs5] eine Prozentänderung wirkt auf den aktuellen und alle folgenden Blöcke', () => {
    const { p, sink, run } = setup();
    p.start();
    run(20);
    p.setIntensityPercent(90);
    expect(sink.last()).toBe('ziel:90');
    run(40);
    expect(sink.last()).toBe('ziel:180');
    expect(() => p.setIntensityPercent(5)).toThrow(RangeError);
  });

  it('[SR-f073cf/AK-ywz6] freies Training ist ohne Workout startbar und aus dem Workout heraus zuschaltbar, ohne Zielwatt', () => {
    const a = setup(null);
    a.p.start();
    expect(a.p.state().status).toBe('frei');
    expect(a.sink.calls).toEqual(['frei']);

    const b = setup();
    b.p.start();
    b.run(30);
    b.p.switchToFree();
    expect(b.sink.last()).toBe('frei');
    const blockAt = b.p.state().blockElapsedSec;
    b.run(100);
    expect(b.p.state().blockElapsedSec).toBe(blockAt); // Block-Timer ruht
    expect(b.p.state().totalElapsedSec).toBe(130); // Gesamtzeit läuft
    b.p.switchToWorkout();
    expect(b.sink.last()).toBe('ziel:100');
  });

  it('[SR-1a292f/AK-s8zr] Timer läuft bei Bike-Abbruch weiter, danach wird die Zielwatt erneut gesetzt', () => {
    const { p, sink, run, errors } = setup();
    p.start();
    run(10);
    sink.failNext = true;
    p.setIntensityPercent(105); // Setzen schlägt fehl (Bike weg)
    expect(errors).toHaveLength(0); // Fehler kommt asynchron
    run(20);
    expect(p.state().blockElapsedSec).toBe(30); // Timer lief weiter
    p.resendTarget(); // nach Wiederverbindung
    expect(sink.last()).toBe('ziel:105');
  });

  it('meldet Fehler des Bikes, statt sie zu verschlucken', async () => {
    const { p, sink, errors } = setup();
    sink.failNext = true;
    p.start();
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).toHaveLength(1);
  });
});
