import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import events from './fixtures/icu-events.json';
import { Library } from '../src/domain/library';
import { IcuClient, IcuError } from '../src/icu/client';
import { MemoryStore } from '../src/ports';
import { riderContext } from '../src/domain/profile';

interface Seen {
  url: string;
  auth?: string;
  method?: string;
  body?: FormData;
}

function fakeFetch(respond: (s: Seen) => Response) {
  const seen: Seen[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const s: Seen = { url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization, method: init?.method, body: init?.body as FormData | undefined };
    seen.push(s);
    return respond(s);
  }) as unknown as typeof fetch;
  return { f, seen };
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });

describe('intervals.icu', () => {
  it('[SR-130c03/AK-jhkv] zeigt Radtrainings mit Dauer und Leistung je Block, Kraft und Lauf werden nicht angeboten', async () => {
    const { f, seen } = fakeFetch(() => json(events));
    const c = new IcuClient({ athleteId: 'i123', apiKey: 'geheim', fetch: f });
    const { workouts, skipped } = await c.listRideWorkouts(new Date(2026, 10, 21), new Date(2026, 11, 5));
    expect(workouts.map((w) => w.workout.name)).toEqual(['Sweet spot 2×20′', 'Z2-Ausfahrt ~100′', 'Entlastung: Sweet spot 2×10′ + Sprints']);
    expect(workouts[0]!.workout.blocks[0]).toEqual({ label: 'Einfahren', durationSec: 600, watts: 151 });
    expect(workouts[0]!.date).toBe('2026-11-21');
    expect(skipped).toEqual([]);
    // Anfrage: Konto des Fahrers, Zeitraum, Basic-Auth mit API-Schlüssel
    expect(seen[0]!.url).toBe('https://intervals.icu/api/v1/athlete/i123/events?oldest=2026-11-21&newest=2026-12-05');
    expect(atob(seen[0]!.auth!.replace('Basic ', ''))).toBe('API_KEY:geheim');
  });

  it('nennt Radtrainings, die nicht darstellbar sind, statt sie still zu übergehen', async () => {
    const bad = { id: 9, name: 'Rampe', type: 'Ride', start_date_local: '2026-11-30T00:00:00', workout_doc: { steps: [{ duration: 60, power: { units: 'w', start: 100, end: 200 } }] } };
    const { f } = fakeFetch(() => json([bad]));
    const { workouts, skipped } = await new IcuClient({ athleteId: 'i1', apiKey: 'k', fetch: f }).listRideWorkouts(new Date(), new Date());
    expect(workouts).toHaveLength(0);
    expect(skipped).toEqual([{ name: 'Rampe', date: '2026-11-30', reason: 'Rampen werden noch nicht unterstützt.' }]);
  });

  it('meldet abgelehnte Zugangsdaten verständlich', async () => {
    const { f } = fakeFetch(() => new Response('', { status: 401 }));
    await expect(new IcuClient({ athleteId: 'i1', apiKey: 'falsch', fetch: f }).listRideWorkouts(new Date(), new Date())).rejects.toThrow(/Zugangsdaten abgelehnt/);
  });

  it('[SR-4bd74c/AK-bgx5] der Upload legt die Aktivität im Konto des aktiven Fahrers an; im Gastmodus wird kein Upload angeboten', async () => {
    const { f, seen } = fakeFetch(() => json({ icu_athlete_id: 'iStefan', id: 'i42', activities: [{ id: 'i42' }] }));
    const c = new IcuClient({ athleteId: 'iStefan', apiKey: 'k', fetch: f });
    const res = await c.uploadFit(Uint8Array.of(1, 2, 3), 'pedalo.fit');
    expect(res.activityId).toBe('i42');
    expect(seen[0]!.url).toBe('https://intervals.icu/api/v1/athlete/iStefan/activities');
    expect(seen[0]!.method).toBe('POST');
    const file = seen[0]!.body!.get('file') as File;
    expect(file.name).toBe('pedalo.fit');
    expect(file.size).toBe(3);

    const profile = { id: '1', name: 'Stefan', ftp: 274, hrStraps: [], icu: { athleteId: 'iStefan', apiKey: 'k' } };
    expect(riderContext(profile).canUpload).toBe(true);
    expect(riderContext(null, 250).canUpload).toBe(false); // Gastmodus
  });

  it('meldet, wenn intervals.icu keine Aktivität angelegt hat', async () => {
    const { f } = fakeFetch(() => json({ activities: [] }));
    await expect(new IcuClient({ athleteId: 'i', apiKey: 'k', fetch: f }).uploadFit(Uint8Array.of(1), 'x.fit')).rejects.toBeInstanceOf(IcuError);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('Prüfung des Quelltextes (automatisierte Inspektion)', () => {
  const sources = sourceFiles('src').map((p) => [p, readFileSync(p, 'utf8')] as const);

  it('[SR-3c3d67/AK-jpwh] Trainings werden ausschließlich über die intervals.icu-API bezogen, es gibt keine Blocks-Schnittstelle', () => {
    for (const [p, text] of sources) {
      expect(text, p).not.toMatch(/blocks\.(app|com|io)|getblocks|blocks-api/i);
    }
    const hosts = new Set(sources.flatMap(([, t]) => [...t.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]!.toLowerCase())));
    expect([...hosts]).toEqual(['intervals.icu']);
  });

  it('[SR-0a7b94/AK-rfpd] die App enthält keine Strava-API-Anbindung', () => {
    for (const [p, text] of sources) expect(text, p).not.toMatch(/strava/i);
  });
});

describe('Bibliothek', () => {
  const w = { name: 'Mein Training', blocks: [{ label: '', durationSec: 600, watts: 150 }] };

  it('[SR-35475a/AK-r0vk] ein Favorit ist nach Neustart ohne Internetverbindung in der Bibliothek und startbar', async () => {
    const kv = new MemoryStore();
    const lib1 = new Library(kv);
    const e = await lib1.add(w, true);
    await lib1.add({ ...w, name: 'Anderes' }, false);
    // Neustart: neues Objekt über demselben Speicher, kein Netzwerkzugriff nötig
    const lib2 = new Library(kv);
    const list = await lib2.list();
    expect(list[0]).toMatchObject({ id: e.id, favorite: true, workout: w }); // Favoriten zuerst
    expect(list[0]!.workout.blocks[0]!.watts).toBe(150); // vollständig, direkt abspielbar
    await lib2.setFavorite(list[1]!.id, true);
    expect((await lib2.list()).every((x) => x.favorite)).toBe(true);
    await lib2.remove(e.id);
    expect(await lib2.list()).toHaveLength(1);
    await expect(lib2.setFavorite('gibt-es-nicht', true)).rejects.toThrow();
  });
});
