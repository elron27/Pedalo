# Pedalo

Ein eigener Smart Trainer (Trainingssoftware für das Wahoo Kickr Bike v2).

## Requirements
Die Anforderungen liegen als ReqSeq-Arbeitsmappe in diesem Ordner (`need/`, `system-requirement/`, `metamodel/`).
Öffnen: `O:\Dokumente\IT\ReqSeq-0.10.1-win-x64\ReqSeq.exe` und diesen Ordner wählen.
Prüfen per Kommandozeile: `O:\Dokumente\IT\ReqSeq-0.10.1-win-x64\bin\reqseq.cmd workspace check`
Die ursprünglichen IDs (REQ-C/F/N-xxx) stehen im Text jedes Elements.

## Entwicklung
Voraussetzung: Node.js LTS. `npm install`, dann:
- `npm test` – Tests ausführen
- `npm run test:evidence` – Tests ausführen und das Ergebnis als Nachweis nach `evidence/` schreiben (je Lauf eine neue Datei)
- `npm run ak-refs [SR-xxxxxx]` – Akzeptanzkriterien mit der Referenz für den Testnamen `[SR-xxxxxx/AK-yyyy]`
- `npm run dev` / `npm run build` – App starten / bauen

Der Pfad zur ReqSeq-CLI ist in `tools/reqseq.mjs` voreingestellt (`C:/Program Files/ReqSeq/bin/reqseq.cmd`) und über die Umgebungsvariable `REQSEQ` änderbar. Plan: `docs/umsetzungsplan.md`.
