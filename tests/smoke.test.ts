import { describe, expect, it } from 'vitest';

// Prüft nur, dass die Testumgebung läuft. Gehört zu keinem Requirement und trägt
// deshalb bewusst keine Referenz [SR-…/AK-…].
describe('Testumgebung', () => {
  it('läuft', () => {
    expect(1 + 1).toBe(2);
  });
});
