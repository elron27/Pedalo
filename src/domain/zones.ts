/** Pulszonen: obere Grenzen in Schlägen je Minute; die letzte Zone reicht bis zum Maximalpuls. */
export interface HrZones {
  upper: number[];
}

/** Zone (1-basiert) zu einem Puls; über der letzten Grenze zählt die letzte Zone. */
export function zoneOf(hr: number | undefined, zones: HrZones | undefined): number | undefined {
  if (hr === undefined || !zones || zones.upper.length === 0) return undefined;
  const i = zones.upper.findIndex((u) => hr <= u);
  return (i === -1 ? zones.upper.length - 1 : i) + 1;
}

interface SportSetting {
  types?: string[];
  hr_zones?: unknown;
}

/**
 * Pulszonen aus der Athleten-Antwort von intervals.icu lesen (Annahme, unbestätigt: sportSettings[].hr_zones
 * enthält die oberen Grenzen). Bevorzugt die Einstellung für Rad; liefert undefined, wenn nichts Brauchbares da ist.
 */
export function hrZonesFromAthlete(athlete: unknown): HrZones | undefined {
  const list = (athlete as { sportSettings?: SportSetting[] } | null)?.sportSettings;
  if (!Array.isArray(list)) return undefined;
  const valid = (s: SportSetting): number[] | undefined => {
    const z = s.hr_zones;
    if (!Array.isArray(z) || z.length < 2) return undefined;
    if (!z.every((v, i) => typeof v === 'number' && v > 0 && (i === 0 || v > (z[i - 1] as number)))) return undefined;
    return z as number[];
  };
  const ride = list.find((s) => s.types?.some((t) => t === 'Ride' || t === 'VirtualRide') && valid(s));
  const any = ride ?? list.find((s) => valid(s));
  const upper = any ? valid(any) : undefined;
  return upper ? { upper } : undefined;
}
