import type { KeyValueStore } from '../ports';

/** Schlüssel-Wert-Speicher auf IndexedDB (bleibt nach Neustart und ohne Netzwerk erhalten). */
export class IdbStore implements KeyValueStore {
  private db: Promise<IDBDatabase> | undefined;

  constructor(private readonly name = 'pedalo') {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB nicht verfügbar'));
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Fehler'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB abgebrochen'));
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.run('readonly', (s) => s.get(key))) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.run('readwrite', (s) => s.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(key));
  }

  async keys(prefix: string): Promise<string[]> {
    const all = (await this.run('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿')))) as IDBValidKey[];
    return all.map(String).sort();
  }
}
