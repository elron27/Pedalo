import { describe, expect, it } from 'vitest';
import { describeError, FEHLER } from '../src/app/errors';

describe('Fehlermeldungen auf Deutsch', () => {
  it('übersetzt Fehler des Browsers und blendet ein abgebrochenes Auswahlfenster aus', () => {
    expect(describeError(new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError'))).toBeNull();
    expect(describeError(new DOMException('Connection Error: Connection attempt failed.', 'NetworkError'))).toBe(FEHLER.verbindung);
    expect(describeError(new DOMException('No Services matching UUID', 'NotFoundError'))).toBe(FEHLER.verbindung);
    expect(describeError(new DOMException('Permission denied', 'NotAllowedError'))).toBe(FEHLER.nichtErlaubt);
    expect(describeError(new TypeError('Failed to fetch'))).toBe(FEHLER.netzwerk);
    expect(describeError(new TypeError('x is undefined'))).toBe(FEHLER.allgemein);
    expect(describeError('irgendwas')).toBe(FEHLER.allgemein);
  });

  it('lässt eigene deutsche Meldungen der App unverändert durch', () => {
    expect(describeError(new Error('Rampen werden noch nicht unterstützt.'))).toBe('Rampen werden noch nicht unterstützt.');
    expect(describeError(new RangeError('FTP muss zwischen 50 und 2000 Watt liegen.'))).toBe('FTP muss zwischen 50 und 2000 Watt liegen.');
  });

  it('enthält keine englischen Standardmeldungen', () => {
    for (const m of Object.values(FEHLER)) expect(m).not.toMatch(/\b(failed|error|cancelled|denied|connection)\b/i);
  });
});
