# Pedalo – Hinweise für Claude Code

Pedalo ist eine eigene Trainingssoftware für das Wahoo Kickr Bike v2 (Ersatz für ICTrainer).
Web-App, lokal auf dem PC, Chrome als Referenz, Oberfläche auf Deutsch. Gesprochen wird Deutsch.

## Stand

- Die Requirements liegen als ReqSeq-Arbeitsmappe vor (`need/`, `system-requirement/`, `metamodel/`).
  Es gibt bisher einen Need und 28 System-Requirements, die alle von diesem Need abgeleitet sind.
- Der Entwurf zur Aufteilung in 7 Needs und alle in drei Frage-Antwort-Runden getroffenen Entscheidungen
  stehen in `docs/needs-entwurf.md`. **Das ist die Grundlage für die nächste Aufgabe. Zuerst lesen.**
- Es gibt noch keinen Code.

## Aufgabe jetzt: Entwurf in ReqSeq übernehmen

1. `reqseq.cmd workspace check` ausführen und den Ausgangszustand festhalten (Pfad zur CLI siehe `README.md`).
2. Die Hilfe der CLI lesen (`reqseq.cmd --help` und die Unterbefehle zum Anlegen und Verknüpfen von Elementen).
3. Die 7 Needs N1 bis N7 aus `docs/needs-entwurf.md` anlegen, mit Titel, Priorität und Validierungskriterien.
4. Die bestehenden 28 SRs den neuen Needs zuordnen (`derives-from`). Der bisherige Sammel-Need
   „Eigene Trainingssoftware statt ICTrainer“ bleibt als übergeordneter Need bestehen, sofern ReqSeq das so zulässt.
5. Die als „Neu, Kandidat“ und „Neu, bestätigt“ markierten SRs anlegen, jeweils mit Typ und Akzeptanzkriterium.
6. Geänderte SRs anpassen: SR-120d und SR-87da (Quelle ist intervals.icu), SR-4962 (Schalten am Bike),
   SR-e7ef (FTP pro Fahrer), SR-203e (Upload auf das Konto des aktiven Fahrers).
7. Versionen und Verknüpfungen nur mit der ReqSeq-CLI aktualisieren, nie von Hand. Danach `workspace check`.
8. Committen und auf den Branch `claude/clever-dirac-e5tcdx` pushen.

## Regeln

- Keine Versions-Hashes (`version: n2:...`) von Hand schreiben.
- Die Ursprungs-IDs (REQ-F-xxx usw.) stehen im Text jedes SR und bleiben erhalten.
- Nicht entscheiden, was in `docs/needs-entwurf.md` bereits entschieden ist. Bei Widersprüchen nachfragen.
- Annahmen kennzeichnen (z. B. „Annahme, unbestätigt“), wie in den bestehenden SRs.

## Danach

Technischer Spike (Web Bluetooth zum Kickr Bike v2 und Pulsgurt, intervals.icu-API, CORS), dann Version 1.
Reihenfolge und Risiken stehen am Ende von `docs/needs-entwurf.md`.
