import type { KeyValueStore } from '../ports';
import type { Workout } from './workout';

export interface LibraryEntry {
  id: string;
  workout: Workout;
  favorite: boolean;
  addedAt: string;
}

const KEY = 'lib/';

/** Lokale Trainingsbibliothek. Liegt im Speicher des Browsers, braucht keine Verbindung zu intervals.icu. */
export class Library {
  constructor(private readonly kv: KeyValueStore) {}

  async add(workout: Workout, favorite = true): Promise<LibraryEntry> {
    const entry: LibraryEntry = { id: crypto.randomUUID(), workout, favorite, addedAt: new Date().toISOString() };
    await this.kv.set(KEY + entry.id, entry);
    return entry;
  }

  async list(): Promise<LibraryEntry[]> {
    const out: LibraryEntry[] = [];
    for (const k of await this.kv.keys(KEY)) {
      const e = await this.kv.get<LibraryEntry>(k);
      if (e) out.push(e);
    }
    return out.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.workout.name.localeCompare(b.workout.name, 'de'));
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const e = await this.kv.get<LibraryEntry>(KEY + id);
    if (!e) throw new Error('Training nicht in der Bibliothek.');
    await this.kv.set(KEY + id, { ...e, favorite });
  }

  async remove(id: string): Promise<void> {
    await this.kv.delete(KEY + id);
  }
}
