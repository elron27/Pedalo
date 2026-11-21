# Pedalo – Hinweise für Claude Code

Pedalo ist eine eigene Trainingssoftware für das Wahoo Kickr Bike v2 (Ersatz für ICTrainer).
Web-App, lokal auf dem PC, Chrome als Referenz (Windows und Mac), Oberfläche auf Deutsch. Gesprochen wird Deutsch.

## Stand (2026-11-21)

- Requirements: ReqSeq-Arbeitsmappe (`need/`, `system-requirement/`, `metamodel/`, Nachweise in `evidence/`).
  7 Needs (N1 bis N7) unter dem Sammel-Need, 36 SRs. Entscheidungen: `docs/needs-entwurf.md`.
- Technischer Spike (M0) ist gemacht, Ergebnisse in `docs/m0-ergebnisse.md` (FTMS, Simulationswerte im freien Training,
  intervals.icu ohne Proxy, Watt wie im Training, 4DP-Ablauf).
- Code: M2 bis M5 gebaut (Kern in `src/domain`, Geräte in `src/devices`, intervals.icu in `src/icu`, Oberfläche in `src/ui`
  mit Preact, Steuerung in `src/app`). Plan und Testkonzept: `docs/umsetzungsplan.md`.
- Start ohne Claude: `Pedalo-starten.cmd` oder `npm start` (Produktionsbuild auf http://localhost:5173, siehe README).
- Neu seit der ersten ganzen Fahrt (2026-11-21): Gesamt-Restzeit (SR-2eaedc), Pulszonen aus intervals.icu (SR-215ffb, Annahme:
  `sportSettings[].hr_zones` im Athleten-Abruf, am echten Konto noch nicht geprüft), Geschwindigkeit/Distanz in der .fit (SR-f32bce).
- Tests: `npm test` (Vitest), `npm run test:e2e` (Playwright mit simuliertem Bike), `npm run test:evidence` schreibt Nachweise.
  35 von 40 SRs verifiziert. Offen sind nur Hardware-Fälle (SR-f83db7, SR-f22ac4, SR-b0d66d, SR-988963, SR-fa0d80).
- **Nächste Aufgabe: M6 abschließen** nach `docs/m6-abnahme.md`: Rückmeldung von Stefan (Pause per 0 W, Wiederverbindung, Strava
  zählt Distanz, Mac), dann Nachweise mit `reqseq evidence record … --method demonstration` nur für Bestätigtes. Needs validiert Stefan selbst.

## Regeln

- Versionen und Verknüpfungen nur mit der ReqSeq-CLI (`C:\Program Files\ReqSeq\bin\reqseq.cmd`), nie von Hand,
  keine Versions-Hashes (`version: n2:...`) schreiben. Anforderungstexte und Akzeptanzkriterien mit `element update` ändern.
- Ein Test je Akzeptanzkriterium, Name `[SR-xxxxxx/AK-schlüssel] …` (Referenzen: `npm run ak-refs`). Kein Test bekommt
  die Referenz eines Kriteriums, das er nicht prüft. Keine Nachweisdatei löschen, kein Test abschalten.
- Die Ursprungs-IDs (REQ-F-xxx usw.) stehen im Text jedes SR und bleiben erhalten.
- Nicht entscheiden, was in `docs/needs-entwurf.md` oder in den Ergebnisnotizen schon entschieden ist. Bei Widersprüchen nachfragen.
- Annahmen kennzeichnen („Annahme, unbestätigt“). Offen sind: Darstellung offener Blöcke und Rampen in intervals.icu,
  FTP-Faktor beim 4DP-Test (aktuell 1,0 aus einem Datenpunkt), Pause per Zielleistung 0 W (am Bike zu prüfen).
- Persönliche Daten (Pulsdaten, Gerätekennungen, API-Schlüssel) nicht ins Repository (`docs/m0/*.json`, `*.fit` sind ignoriert).
- Die Shell verträgt große Heredocs schlecht: Dateien mit dem Write-Tool schreiben.
