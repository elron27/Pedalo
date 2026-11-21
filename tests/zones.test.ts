import { describe, expect, it } from 'vitest';
import { IcuClient } from '../src/icu/client';
import { hrZonesFromAthlete, zoneOf } from '../src/domain/zones';

const athlete = {
  sportSettings: [
    { types: ['Run'], hr_zones: [120, 140, 150, 160, 170, 180, 190] },
    { types: ['Ride', 'VirtualRide'], hr_zones: [111, 130, 148, 158, 168, 178, 190] },
  ],
};

describe('Pulszonen', () => {
  it('[SR-215ffb/AK-d38m] ordnet einen Puls seiner Zone zu; ohne Grenzen gibt es keine Zone', () => {
    const z = hrZonesFromAthlete(athlete)!;
    expect(z.upper).toEqual([111, 130, 148, 158, 168, 178, 190]); // Radeinstellung
    expect(zoneOf(100, z)).toBe(1);
    expect(zoneOf(111, z)).toBe(1);
    expect(zoneOf(112, z)).toBe(2);
    expect(zoneOf(150, z)).toBe(4);
    expect(zoneOf(200, z)).toBe(7); // über dem Maximum bleibt die letzte Zone
    expect(zoneOf(undefined, z)).toBeUndefined();
    expect(zoneOf(130, undefined)).toBeUndefined();
    expect(hrZonesFromAthlete({})).toBeUndefined();
    expect(hrZonesFromAthlete({ sportSettings: [{ types: ['Ride'], hr_zones: [150, 140] }] })).toBeUndefined();
  });

  it('liest die Zonen über die API des Athleten', async () => {
    const seen: string[] = [];
    const f = (async (url: string) => {
      seen.push(url);
      return new Response(JSON.stringify(athlete), { status: 200 });
    }) as unknown as typeof fetch;
    const z = await new IcuClient({ athleteId: 'i1', apiKey: 'k', fetch: f }).getHrZones();
    expect(seen).toEqual(['https://intervals.icu/api/v1/athlete/i1']);
    expect(z?.upper).toHaveLength(7);
  });
});
