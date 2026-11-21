# Needs-Entwurf (Aufteilung des Need „Eigene Trainingssoftware statt ICTrainer“)

Status: **Entwurf**. Die YAML-Dateien in `need/` und `system-requirement/` sind unverändert.
Die Zuordnung ist ein Vorschlag, der in ReqSeq übernommen werden muss.

Jeder SR steht genau einmal. Die Zahl hinter dem Titel ist die Datei-ID (SR-xxxx).

---

## N1 – Ein Blocks-Workout durchfahren
Der Athlet lädt ein Workout und fährt es mit Zielwatt je Block durch.

- Workout-Datei aus Blocks importieren (SR-120d)
- Workout-Quelle: Blocks-Account per Datei (SR-87da, Schnittstelle, Annahme)
- Blöcke nacheinander abspielen, Zielwatt im ERG-Modus (SR-fc22)
- Vorschau auf nächsten Block und Workout-Profil (SR-21f9)
- Aktuellen Block überspringen (SR-0015)
- Workout pausieren und fortsetzen (SR-2b29)
- Intensität live in Prozent für alle folgenden Blöcke (SR-7d9f)
- Freies Training ohne ERG jederzeit zuschalten (SR-4962)

## N2 – Geräte verbinden und stabil halten
Bike und Pulsgurt sind gekoppelt, und die Verbindung bleibt auch bei Störungen erhalten.

- Bike per Bluetooth koppeln und Status anzeigen (SR-cbb6)
- Trainer: Wahoo Kickr Bike v2 über FTMS (SR-5674, Schnittstelle)
- Pulsgurt per Bluetooth koppeln und Status anzeigen (SR-8125)
- Pulssensor: Bluetooth-Brustgurt (SR-7460, Schnittstelle)
- Bei Verbindungsabbruch Timer weiter, neu verbinden, Zielwatt neu setzen (SR-8f30)

## N3 – Werte während des Trainings sehen
Der Athlet liest die Werte aus mehreren Metern Entfernung, ohne Ablenkung.

- Live: Watt, Puls, Trittfrequenz, Restzeit Block, Gesamtzeit (SR-77c2)
- Große Zahlen, aus der Distanz lesbar, vollbildtauglich (SR-b738)
- Dunkles Design (SR-4ec2)
- Bildschirm bleibt während des Trainings an (SR-5419)

## N4 – Training aufzeichnen und sicher speichern
Alle Messwerte landen in einer gültigen Datei, auch wenn die App abstürzt.

- Watt, Puls, Trittfrequenz im Sekundentakt aufzeichnen (SR-3c2d)
- Aufzeichnung als .fit-Datei lokal speichern (SR-378a)
- Aufzeichnung laufend zwischenspeichern, .fit nach Absturz wiederherstellbar (SR-8f93)

## N5 – Training auswerten und hochladen
Das Training landet in intervals.icu und damit bei Strava.

- .fit-Datei direkt zu intervals.icu hochladen (SR-203e)
- Export: .fit lokal und Upload zu intervals.icu (SR-5cb7), **Überschneidung mit SR-378a und SR-203e, siehe Fragen**
- Kein direkter Strava-API-Upload (SR-3d08, Constraint)

## N6 – FTP bestimmen und pflegen
Die Trainingswerte beruhen auf einem aktuellen FTP.

- FTP eingeben und dauerhaft speichern (SR-e7ef)
- Rampentest: Leistung steigern bis Abbruch, FTP berechnen (SR-7617)
- Zusätzlicher FTP-Test, z. B. 20 Minuten (SR-9d30, Soll, „offen: ob nötig“)

## N7 – Plattform und Sprache
Rahmenbedingungen, die die gesamte App betreffen.

- Web-App in Chrome oder Edge auf dem PC (SR-aeb1, Constraint, Annahme Windows)
- Oberfläche auf Deutsch (SR-f596, Annahme)

---

## Abdeckung

| Need | Anzahl SR |
|---|---|
| N1 Workout durchfahren | 8 |
| N2 Geräte verbinden | 5 |
| N3 Werte sehen | 4 |
| N4 Aufzeichnen und sichern | 3 |
| N5 Auswerten und hochladen | 3 |
| N6 FTP | 3 |
| N7 Plattform und Sprache | 2 |
| **Summe** | **28** |

## Offene Fragen (für die Frage-Antwort-Runde)

1. N5: Sind „Aufzeichnung als .fit speichern“ (SR-378a) und „Upload zu intervals.icu“ (SR-203e) getrennte Anforderungen, oder soll SR-5cb7 sie ersetzen?
2. N2: Reicht ein Pulsgurt, oder sind mehrere Sensoren nötig?
3. N6: Soll der 20-Minuten-Test (SR-9d30) in Version 1 enthalten sein?
4. N7: Ist Windows wirklich die Zielplattform, oder genügt Chrome/Edge auf jedem Betriebssystem?
5. N1: In welchem Format kommen die Blocks-Workouts (JSON oder .zwo), und wie wird die Datei geladen?
6. N4: Wie lange darf ein Training maximal dauern, und wie groß ist die Zwischenspeicherung?
