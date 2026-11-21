import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../src/domain/player';
import { addStrap, connectProfileStrap, newId, ProfileStore, riderContext, selectStrap, type HrStrap, type Profile, type StrapConnector } from '../src/domain/profile';
import { SimTrainer } from '../src/devices/simulators';
import { Supervisor } from '../src/devices/supervisor';
import { encodeRequestControl, encodeSetTargetPower, encodeSimulation, parseControlResponse, parseHeartRate, parseIndoorBikeData } from '../src/devices/protocol';
import { MemoryStore } from '../src/ports';
import { FakeClock } from './helpers';

const view = (hex: string) => new DataView(Uint8Array.from(hex.split(' ').map((h) => parseInt(h, 16))).buffer);

describe('Protokoll (Bytes aus dem M0-Test am echten Bike)', () => {
  it('liest Indoor Bike Data', () => {
    expect(parseIndoorBikeData(view('44 00 b9 01 0d 00 1a 00'))).toEqual({ speedKmh: 4.41, cadence: 6.5, power: 26 });
    expect(parseIndoorBikeData(view('44 00 00 00 00 00 00 00'))).toEqual({ speedKmh: 0, cadence: 0, power: 0 });
    expect(parseIndoorBikeData(view('44 00 85 0b 84 00 2b 01'))).toEqual({ speedKmh: 29.49, cadence: 66, power: 299 });
  });

  it('erzeugt dieselben Befehle wie im Test: Zielwatt, Simulation, Steuerung anfordern', () => {
    expect(Array.from(encodeSetTargetPower(100))).toEqual([0x05, 0x64, 0x00]);
    expect(Array.from(encodeSetTargetPower(300))).toEqual([0x05, 0x2c, 0x01]);
    expect(Array.from(encodeSimulation(0))).toEqual([0x11, 0, 0, 0, 0, 0x28, 0x33]);
    expect(Array.from(encodeRequestControl())).toEqual([0x00]);
    expect(() => encodeSetTargetPower(-1)).toThrow(RangeError);
    expect(() => encodeSetTargetPower(3000)).toThrow(RangeError);
  });

  it('liest Antworten des Bikes', () => {
    expect(parseControlResponse(view('80 05 01'))).toEqual({ op: 5, ok: true });
    expect(parseControlResponse(view('80 05 02'))).toEqual({ op: 5, ok: false });
    expect(parseControlResponse(view('44 00'))).toBeUndefined();
  });

  it('liest den Puls aus Messwerten von Sigma HRM und Polar H10, auch ohne Hautkontakt', () => {
    expect(parseHeartRate(view('16 48 2e 03 04 03')).bpm).toBe(72); // Sigma, mit RR-Intervallen
    expect(parseHeartRate(view('10 55 f3 02')).bpm).toBe(85); // Polar H10
    expect(parseHeartRate(view('00 55')).bpm).toBe(85);
    expect(parseHeartRate(view('01 2c 01')).bpm).toBe(300); // 16-Bit-Format
    expect(parseHeartRate(view('16 48 2e 03')).contact).toBe(true);
    expect(parseHeartRate(view('04 56')).contact).toBe(false); // Sigma ohne Hautkontakt, Wert bleibt stehen
    expect(parseHeartRate(view('10 55 f3 02')).contact).toBeUndefined();
  });
});

describe('Verbindung halten', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const flush = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
  };

  it('[SR-f1a89f/AK-fy62] zeigt nach dem Koppeln den Status verbunden bzw. getrennt', async () => {
    const t = new SimTrainer();
    const s = new Supervisor(t);
    const seen: string[] = [];
    s.onStatus((x) => seen.push(x));
    expect(s.status).toBe('getrennt');
    s.start();
    await flush(0);
    expect(s.status).toBe('verbunden');
    t.drop();
    expect(s.status).toBe('getrennt');
    s.stop();
    expect(seen).toEqual(['verbindet', 'verbunden', 'getrennt']);
  });

  it('[SR-d51418/AK-np6p] zeigt auch beim Pulsgurt den Status verbunden bzw. getrennt', async () => {
    const t = new SimTrainer(); // gleiche Schnittstelle (Connectable) wie der Gurt
    const s = new Supervisor(t);
    s.start();
    await flush(0);
    expect(s.status).toBe('verbunden');
    s.stop();
    expect(s.status).toBe('getrennt');
  });

  it('wiederholt einen gescheiterten ersten Verbindungsversuch (wie im M0-Test)', async () => {
    const t = new SimTrainer();
    t.failConnects = 2;
    const errors: unknown[] = [];
    const s = new Supervisor(t, { retryDelaysMs: [1000, 2000], onError: (e) => errors.push(e) });
    s.start();
    await flush(0);
    expect(s.status).toBe('getrennt');
    await flush(1000);
    expect(t.connectAttempts).toBe(2);
    await flush(2000);
    expect(t.connectAttempts).toBe(3);
    expect(s.status).toBe('verbunden');
    expect(errors).toHaveLength(2); // Fehler werden gemeldet, nicht verschluckt
  });

  it('[SR-1a292f/AK-s8zr] bei Bluetooth-Abbruch läuft der Timer weiter, die App verbindet neu und setzt danach die Zielwatt erneut', async () => {
    const trainer = new SimTrainer();
    const clock = new FakeClock();
    const player = new Player({ name: 'x', blocks: [{ label: '', durationSec: 600, watts: 180 }] }, trainer, clock);
    const sup = new Supervisor(trainer, { retryDelaysMs: [1000] });
    sup.onConnected(() => player.resendTarget());
    sup.start();
    await flush(0);
    player.start();
    await flush(0);
    expect(trainer.commands).toEqual(['ziel:180']);

    trainer.failConnects = 1; // auch der erste Wiederverbindungsversuch scheitert
    trainer.drop();
    clock.advance(20_000);
    player.tick();
    expect(player.state().blockElapsedSec).toBe(20); // Timer lief ohne Bike weiter

    await flush(1000); // 1. Versuch scheitert
    expect(sup.status).toBe('getrennt');
    await flush(1000); // 2. Versuch klappt
    expect(sup.status).toBe('verbunden');
    expect(trainer.commands).toEqual(['ziel:180', 'ziel:180']); // Zielwatt neu gesetzt
    sup.stop();
  });

  it('hört auf, wenn gestoppt wird', async () => {
    const t = new SimTrainer();
    t.failConnects = 99;
    const s = new Supervisor(t, { onError: () => {} });
    s.start();
    await flush(0);
    s.stop();
    const n = t.connectAttempts;
    await flush(60_000);
    expect(t.connectAttempts).toBe(n);
  });
});

describe('Profile und Pulsgurte', () => {
  const mk = (name: string, ftp: number, key?: string): Profile => ({
    id: newId(),
    name,
    ftp,
    icu: key ? { athleteId: 'i' + name, apiKey: key } : undefined,
    hrStraps: [],
  });

  it('[SR-920097/AK-njhr] jedes Profil behält nach Neustart und Wechsel seinen eigenen FTP', async () => {
    const kv = new MemoryStore();
    const a = mk('Anna', 210);
    const b = mk('Stefan', 274);
    const s1 = new ProfileStore(kv);
    await s1.save(a);
    await s1.save(b);
    await s1.setActive(a.id);
    const s2 = new ProfileStore(kv); // Neustart: neues Objekt, gleicher Speicher
    expect((await s2.active())!.ftp).toBe(210);
    await s2.setActive(b.id);
    expect((await s2.active())!.ftp).toBe(274);
    expect((await s2.get(a.id))!.ftp).toBe(210);
    await expect(s2.save({ ...a, ftp: 10 })).rejects.toThrow(RangeError);
  });

  it('[SR-0bf586/AK-c04m] beim Profilwechsel gelten FTP, Pulsgurt und intervals.icu-Konto des gewählten Profils', async () => {
    const kv = new MemoryStore();
    const store = new ProfileStore(kv);
    const a = addStrap(mk('Anna', 210, 'schluesselA'), { id: 'gurtA', name: 'Polar A' });
    const b = addStrap(mk('Stefan', 274, 'schluesselS'), { id: 'gurtS', name: 'Sigma S' });
    await store.save(a);
    await store.save(b);
    await store.setActive(a.id);
    let ctx = riderContext(await store.active());
    expect([ctx.ftp, ctx.profile!.selectedStrapId, ctx.profile!.icu!.apiKey]).toEqual([210, 'gurtA', 'schluesselA']);
    await store.setActive(b.id);
    ctx = riderContext(await store.active());
    expect([ctx.ftp, ctx.profile!.selectedStrapId, ctx.profile!.icu!.apiKey]).toEqual([274, 'gurtS', 'schluesselS']);
  });

  it('[SR-a54eef/AK-nj88] mit zwei gespeicherten Pulsgurten verbindet die App den anderen ohne erneutes Koppeln', async () => {
    let p = mk('Stefan', 274);
    p = addStrap(p, { id: 'g1', name: 'Sigma' });
    p = addStrap(p, { id: 'g2', name: 'Polar' });
    expect(p.hrStraps).toHaveLength(2);
    p = selectStrap(p, 'g1');
    const calls: string[] = [];
    const c: StrapConnector = {
      connectKnown: async (id) => void calls.push('bekannt:' + id),
      requestNew: async (): Promise<HrStrap> => {
        calls.push('neu');
        return { id: 'g3', name: 'Neu' };
      },
    };
    await connectProfileStrap(p, c);
    p = selectStrap(p, 'g2'); // anderen Gurt auswählen (z. B. Gast-Gurt)
    await connectProfileStrap(p, c);
    expect(calls).toEqual(['bekannt:g1', 'bekannt:g2']); // nie das Auswahlfenster
    expect(() => selectStrap(p, 'unbekannt')).toThrow();
    // ohne gewählten Gurt wird neu gekoppelt und gespeichert
    const fresh = await connectProfileStrap(mk('Neu', 200), c);
    expect(calls.at(-1)).toBe('neu');
    expect(fresh.selectedStrapId).toBe('g3');
  });

  it('Upload nur für Profile mit intervals.icu-Konto', () => {
    expect(riderContext(mk('A', 200, 'k')).canUpload).toBe(true);
    expect(riderContext(mk('B', 200)).canUpload).toBe(false);
    expect(riderContext(null, 250)).toMatchObject({ kind: 'gast', ftp: 250, canUpload: false });
  });
});
