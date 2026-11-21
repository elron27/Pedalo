import type { KeyValueStore } from '../ports';
import type { HrZones } from './zones';

export interface HrStrap {
  /** Geräte-ID des Browsers (Web Bluetooth). */
  id: string;
  name: string;
}

export interface IcuAccount {
  athleteId: string;
  apiKey: string;
}

export interface Profile {
  id: string;
  name: string;
  ftp: number;
  icu?: IcuAccount;
  hrStraps: HrStrap[];
  selectedStrapId?: string;
  /** Zuletzt aus intervals.icu gelesene Pulszonen (gilt auch ohne Netz). */
  hrZones?: HrZones;
}

const KEY = 'profile/';
const ACTIVE = 'active-profile';

export class ProfileStore {
  constructor(private readonly kv: KeyValueStore) {}

  async list(): Promise<Profile[]> {
    const out: Profile[] = [];
    for (const k of await this.kv.keys(KEY)) {
      const p = await this.kv.get<Profile>(k);
      if (p) out.push(p);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  get(id: string): Promise<Profile | undefined> {
    return this.kv.get<Profile>(KEY + id);
  }

  async save(p: Profile): Promise<void> {
    if (!p.name.trim()) throw new Error('Name fehlt.');
    if (!Number.isFinite(p.ftp) || p.ftp < 50 || p.ftp > 2000) throw new RangeError('FTP muss zwischen 50 und 2000 Watt liegen.');
    await this.kv.set(KEY + p.id, p);
  }

  async remove(id: string): Promise<void> {
    await this.kv.delete(KEY + id);
    if ((await this.kv.get<string>(ACTIVE)) === id) await this.kv.delete(ACTIVE);
  }

  /** null = Gastmodus (kein Profil). */
  async setActive(id: string | null): Promise<void> {
    if (id === null) await this.kv.delete(ACTIVE);
    else await this.kv.set(ACTIVE, id);
  }

  async active(): Promise<Profile | null> {
    const id = await this.kv.get<string>(ACTIVE);
    return id ? ((await this.get(id)) ?? null) : null;
  }
}

export interface RiderContext {
  kind: 'profil' | 'gast';
  name: string;
  ftp?: number;
  profile?: Profile;
  /** Upload nur mit Profil, das ein intervals.icu-Konto hat. */
  canUpload: boolean;
}

/** Wer fährt gerade: ein Profil oder ein Gast mit handeingegebenem FTP. */
export function riderContext(profile: Profile | null, guestFtp?: number): RiderContext {
  if (!profile) return { kind: 'gast', name: 'Gast', ftp: guestFtp, canUpload: false };
  return { kind: 'profil', name: profile.name, ftp: profile.ftp, profile, canUpload: Boolean(profile.icu?.athleteId && profile.icu.apiKey) };
}

export function newId(): string {
  return crypto.randomUUID();
}

// ---------- Pulsgurte je Profil ----------

export function addStrap(p: Profile, strap: HrStrap): Profile {
  const rest = p.hrStraps.filter((s) => s.id !== strap.id);
  return { ...p, hrStraps: [...rest, strap], selectedStrapId: strap.id };
}

export function selectStrap(p: Profile, id: string): Profile {
  if (!p.hrStraps.some((s) => s.id === id)) throw new Error('Pulsgurt ist nicht gespeichert.');
  return { ...p, selectedStrapId: id };
}

export interface StrapConnector {
  /** Mit einem bereits gekoppelten Gurt verbinden, ohne Auswahlfenster. */
  connectKnown(id: string): Promise<void>;
  /** Neuen Gurt koppeln (Auswahlfenster des Browsers). Liefert den neuen Gurt. */
  requestNew(): Promise<HrStrap>;
}

/** Verbindet den gewählten Gurt ohne erneutes Koppeln; ohne gewählten Gurt wird einer neu gekoppelt und gespeichert. */
export async function connectProfileStrap(p: Profile, c: StrapConnector): Promise<Profile> {
  if (p.selectedStrapId) {
    await c.connectKnown(p.selectedStrapId);
    return p;
  }
  return addStrap(p, await c.requestNew());
}
