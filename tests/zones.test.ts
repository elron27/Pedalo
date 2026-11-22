import { describe, expect, it } from 'vitest';
import { IcuClient } from '../src/icu/client';
import { effectiveZones, hrZonesFromAthlete, parseZoneInput, ZoneInputError, zoneOf, zoneRanges } from '../src/domain/zones';

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

  it('[SR-215ffb/AK-fp2y] Obergrenzen gelten einschließlich: 149 ist Zone 2, 150 ist Zone 3', () => {
    const z = { upper: [130, 149, 160] };
    expect(zoneOf(149, z)).toBe(2);
    expect(zoneOf(150, z)).toBe(3);
  });

  it('[SR-215ffb/AK-hqf6] ohne gültige Radzonen werden keine Zonen einer anderen Sportart übernommen', () => {
    const a = {
      sportSettings: [
        { types: ['Run'], hr_zones: [120, 140, 150, 160, 170, 180, 190] },
        { types: ['Ride', 'VirtualRide'], hr_zones: null },
      ],
    };
    expect(hrZonesFromAthlete(a)).toBeUndefined();
    expect(hrZonesFromAthlete({ sportSettings: [{ types: ['Run'], hr_zones: [120, 140, 150] }] })).toBeUndefined();
  });

  it('eigene Obergrenzen: gültige Eingabe wird gelesen, fehlerhafte mit Meldung abgelehnt', () => {
    expect(parseZoneInput('130, 149, 160, 172, 185')?.upper).toEqual([130, 149, 160, 172, 185]);
    expect(parseZoneInput('130;149 160')?.upper).toEqual([130, 149, 160]);
    expect(parseZoneInput('  ')).toBeUndefined();
    expect(() => parseZoneInput('130, 120, 160')).toThrow(/steigen/);
    expect(() => parseZoneInput('130, abc')).toThrow(/keine ganze Zahl/);
    expect(() => parseZoneInput('130, 300')).toThrow(/zwischen 40 und 250/);
    expect(() => parseZoneInput('149')).toThrow(/mindestens 2/);
    expect(() => parseZoneInput('130, 149')).not.toThrow(ZoneInputError);
  });

  it('zeigt die Bereiche jeder Zone', () => {
    expect(zoneRanges({ upper: [130, 149, 160] })).toEqual(['Zone 1: bis 130', 'Zone 2: 131–149', 'Zone 3: 150–160']);
  });

  it('eigene Zonen haben Vorrang vor denen aus intervals.icu', () => {
    const icu = { upper: [111, 130, 148] };
    const own = { upper: [130, 149, 160] };
    expect(effectiveZones({ hrZones: icu, hrZonesOwn: own })).toBe(own);
    expect(effectiveZones({ hrZones: icu })).toBe(icu);
    expect(effectiveZones(null)).toBeUndefined();
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
