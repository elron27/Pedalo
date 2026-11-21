// Fehlermeldungen für den Fahrer: deutsch. Eigene Fehler der App sind schon deutsch,
// Fehler des Browsers (DOMException, TypeError, ...) werden hier übersetzt.

export const FEHLER = {
  verbindung: 'Verbindung zum Gerät fehlgeschlagen. Bitte Gerät einschalten, in die Nähe bringen und es nochmal versuchen.',
  nichtErlaubt: 'Bluetooth ist für diese Seite nicht erlaubt. Bitte die Berechtigung im Browser prüfen.',
  netzwerk: 'Keine Verbindung zum Internet oder zu intervals.icu.',
  speicher: 'Der Speicher des Browsers hat einen Fehler gemeldet.',
  allgemein: 'Es ist ein unerwarteter Fehler aufgetreten.',
};

/** Deutsche Meldung für den Fahrer; null = kein Fehler anzeigen (z. B. Auswahlfenster abgebrochen). */
export function describeError(e: unknown): string | null {
  if (e instanceof DOMException) {
    if (e.name === 'NotFoundError' && /cancel/i.test(e.message)) return null; // Fahrer hat das Auswahlfenster geschlossen
    if (e.name === 'NetworkError') return FEHLER.verbindung;
    if (e.name === 'NotFoundError') return FEHLER.verbindung;
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') return FEHLER.nichtErlaubt;
    if (e.name === 'QuotaExceededError' || e.name === 'UnknownError' || e.name === 'InvalidStateError') return FEHLER.speicher;
    return FEHLER.allgemein;
  }
  if (e instanceof TypeError && /fetch|network/i.test(e.message)) return FEHLER.netzwerk;
  if (e instanceof TypeError || e instanceof ReferenceError || e instanceof SyntaxError) return FEHLER.allgemein; // Programmfehler, Einzelheiten stehen in der Konsole
  if (e instanceof Error) return e.message; // eigene, deutsche Meldungen der App
  return FEHLER.allgemein;
}
