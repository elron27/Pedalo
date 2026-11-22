/** Pulszonen: obere Grenzen in Schlägen je Minute (einschließlich); die letzte Zone reicht bis zum Maximalpuls. */
export interface HrZones {
  upper: number[];
}

/** Zone (1-basiert) zu einem Puls; über der letzten Grenze zählt die letzte Zone. */
export function zoneOf(hr: number | undefined, zones: HrZones | undefined): number | undefined {
  if (hr === undefined || !zones || zones.upper.length === 0) return undefined;
  const i = zones.upper.findIndex((u) => hr <= u);
  return (i === -1 ? zones.upper.length - 1 : i) + 1;
}

const MIN_BPM = 40;
const MAX_BPM = 250;

function validUpper(z: unknown): number[] | undefined {
  if (!Array.isArray(z) || z.length < 2) return undefined;
  if (!z.every((v, i) => typeof v === 'number' && v > 0 && (i === 0 || v > (z[i - 1] as number)))) return undefined;
  return z as number[];
}

interface SportSetting {
  types?: string[];
  hr_zones?: unknown;
}

/**
 * Pulszonen aus der Athleten-Antwort von intervals.icu lesen (Annahme, unbestätigt: sportSettings[].hr_zones
 * enthält die oberen Grenzen). Verwendet nur die Einstellung für Rad (Ride/VirtualRide), nie die einer anderen
 * Sportart; liefert undefined, wenn dort nichts Brauchbares steht.
 */
export function hrZonesFromAthlete(athlete: unknown): HrZones | undefined {
  const list = (athlete as { sportSettings?: SportSetting[] } | null)?.sportSettings;
  if (!Array.isArray(list)) return undefined;
  for (const s of list) {
    if (!s.types?.some((t) => t === 'Ride' || t === 'VirtualRide')) continue;
    const upper = validUpper(s.hr_zones);
    if (upper) return { upper };
  }
  return undefined;
}

export class ZoneInputError extends Error {}

/**
 * Selbst eingetragene Obergrenzen lesen, z. B. „130, 149, 160, 172, 185“ (Komma, Semikolon oder Leerzeichen trennen).
 * Leere Eingabe = keine eigenen Zonen (undefined). Fehler werfen ZoneInputError mit einer Meldung für den Fahrer.
 */
export function parseZoneInput(text: string): HrZones | undefined {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  const upper: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) throw new ZoneInputError(`Pulszonen: „${p}“ ist keine ganze Zahl.`);
    const v = Number(p);
    if (v < MIN_BPM || v > MAX_BPM) throw new ZoneInputError(`Pulszonen: ${v} liegt nicht zwischen ${MIN_BPM} und ${MAX_BPM}.`);
    if (upper.length && v <= upper[upper.length - 1]!) throw new ZoneInputError('Pulszonen: Die Obergrenzen müssen von Zone zu Zone steigen.');
    upper.push(v);
  }
  if (upper.length < 2) throw new ZoneInputError('Pulszonen: Bitte mindestens 2 Obergrenzen eintragen.');
  return { upper };
}

export function formatZoneInput(z: HrZones | undefined): string {
  return z ? z.upper.join(', ') : '';
}

/** Bereiche zum Anzeigen: „Zone 1: bis 130“, „Zone 2: 131–149“ … */
export function zoneRanges(z: HrZones): string[] {
  return z.upper.map((u, i) => (i === 0 ? `Zone 1: bis ${u}` : `Zone ${i + 1}: ${z.upper[i - 1]! + 1}–${u}`));
}

/** Gültige Zonen eines Profils: selbst eingetragene vor denen aus intervals.icu. */
export function effectiveZones(p: { hrZonesOwn?: HrZones; hrZones?: HrZones } | null | undefined): HrZones | undefined {
  return p?.hrZonesOwn ?? p?.hrZones;
}
