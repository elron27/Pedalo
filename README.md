# Pedalo

Ein eigener Smart Trainer (Trainingssoftware für das Wahoo Kickr Bike v2).

## Weitergeben (GitHub Pages)
Der Quellcode liegt auf https://github.com/elron27/Pedalo. Bei jedem Push auf `main` baut GitHub die App und veröffentlicht sie unter
`https://elron27.github.io/Pedalo/` (Workflow `.github/workflows/pages.yml`; einmalig in den Repository-Einstellungen unter „Pages“ die Quelle „GitHub Actions“ wählen).
Wer Pedalo nutzen will, öffnet diese Adresse in Chrome und installiert die App wie unten beschrieben. Es ist nichts weiter nötig, auch kein Node.js.
Jeder Nutzer legt seine eigenen Daten an (Profil, FTP, optional intervals.icu-Zugang); sie bleiben im eigenen Browser und gehen nirgendwohin außer zu intervals.icu.
Voraussetzung: Chrome oder Edge mit Bluetooth (Windows, Mac, Android), ein Bike mit FTMS (Kickr Bike v2 geprüft).

## Benutzen (ohne Entwicklungsumgebung)
Voraussetzung: Node.js LTS und Google Chrome (Web Bluetooth).
- **Windows:** Doppelklick auf `Pedalo-starten.cmd`. Beim ersten Start wird installiert und gebaut, danach öffnet sich Chrome mit Pedalo. Das schwarze Fenster offen lassen, solange du fährst; Schließen beendet die App.
- **Mac/Linux oder Terminal:** `npm install` (einmal), dann `npm start` (baut und öffnet http://localhost:5173).
- **Als App installieren (empfohlen):** Pedalo einmal über `Pedalo-starten.cmd` öffnen, dann in Chrome oben rechts im Adressfeld auf das Installieren-Symbol klicken (oder Menü ⋮ → „Speichern und teilen“ → „Installieren…“). Danach gibt es Pedalo wie ein normales Programm im Startmenü, mit eigenem Fenster und Symbol, auf Wunsch auch auf dem Desktop oder in der Taskleiste. Es startet auch ohne laufenden Server, Bluetooth, Profile und intervals.icu funktionieren wie gewohnt. Der Server (`Pedalo-starten.cmd`) wird nur noch nach Code-Änderungen gebraucht; beim nächsten Start nach `npm run build` holt sich die App die neue Version.
- Nach Änderungen am Code: `npm run build`, dann `npm run serve`.
- Profile, Bibliothek und Zwischenspeicherung liegen im Browser unter der Adresse `http://localhost:5173`. Darum immer diese Adresse benutzen (anderer Anschluss: Umgebungsvariable `PEDALO_PORT`, dann sind die Daten dort leer).
- Bike einschalten (kurbeln, damit es wach ist), „Bike koppeln“, „Pulsgurt koppeln“, Training wählen, Starten. Nach der Fahrt „.fit-Datei speichern“ oder „Zu intervals.icu hochladen“.
- Bleibt das Bike „getrennt“: kurz kurbeln und im Auswahlfenster erneut koppeln; hilft das nicht, das Bike aus- und wieder einschalten.

## Requirements
Die Anforderungen liegen als ReqSeq-Arbeitsmappe in diesem Ordner (`need/`, `system-requirement/`, `metamodel/`).
Öffnen: `C:\Program Files\ReqSeq\ReqSeq.exe` und diesen Ordner wählen.
Prüfen per Kommandozeile: `"C:\Program Files\ReqSeq\bin\reqseq.cmd" workspace check`
Die ursprünglichen IDs (REQ-C/F/N-xxx) stehen im Text jedes Elements.

## Entwicklung
Voraussetzung: Node.js LTS. `npm install`, dann:
- `npm test` – Tests ausführen
- `npm run test:evidence` – Tests ausführen und das Ergebnis als Nachweis nach `evidence/` schreiben (je Lauf eine neue Datei)
- `npm run ak-refs [SR-xxxxxx]` – Akzeptanzkriterien mit der Referenz für den Testnamen `[SR-xxxxxx/AK-yyyy]`
- `npm run dev` – App im Entwicklungsmodus (http://localhost:5173), schreibt Befehle und Fehler live nach `docs/m0/live.jsonl`
- `npm run build`, dann `npm run preview` – App bauen und lokal betreiben (http://localhost:4173)
- `npm run test:e2e` – Browsertests in Chrome mit simuliertem Bike und Pulsgurt

Der Pfad zur ReqSeq-CLI ist in `tools/reqseq.mjs` voreingestellt (`C:/Program Files/ReqSeq/bin/reqseq.cmd`) und über die Umgebungsvariable `REQSEQ` änderbar. Plan: `docs/umsetzungsplan.md`.
