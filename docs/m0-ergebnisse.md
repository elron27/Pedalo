# M0-Ergebnisse (Lauf 1, 2026-11-21)

Grundlage: Protokoll `docs/m0/protokoll-2026-11-21-lauf1.json` (lokal, nicht im Repository: enthält Pulsdaten und Gerätekennungen). Chrome 157, Windows.

## Belegt

**Bike (KICKR BIKE C76B), FTMS**
- Verbinden und Datenempfang funktionieren. Daten: Geschwindigkeit, Trittfrequenz, Leistung (Flags `0x44`). Kein Puls vom Bike, wird auch nicht gebraucht.
- Feature-Feld `02 40 00 00 08 60 00 00`: Leistung und Trittfrequenz messbar; als Ziel setzbar sind **Leistung** und **Indoor-Bike-Simulation** und Radumfang. **Zielwiderstand (0x04) wird nicht unterstützt.**
- Leistungsbereich 0 bis 2500 W, Schritt 1 W.
- Das Characteristic „Training Status“ (0x2AD3) gibt es nicht. Wird nicht benötigt.
- Zielwatt wird akzeptiert (`80 05 01`) **auch ohne vorheriges „Steuerung anfordern“**. 100 W: Leistung ~96 W nach 0,3 s, ~99 W stabil. 300 W: 123 W nach 0,4 s, 299 W nach ca. 1,5 s. Sauber und schnell genug für Blockwechsel (SR-00e7dd).
- Zielwatt 0 W: Leistung fällt auf ca. 25 bis 45 W.
- „Pause“ (`08 02`) und „Stop“ (`08 01`) werden bestätigt, **ändern die Leistung aber nicht sichtbar**: nach Pause blieb die Leistung bei 300 W (Zielwatt wirkt weiter). Folge für SR-74122b: Die App kann Pause nicht allein per FTMS-Pause abbilden, sie muss bei Pause selbst eine niedrige Zielleistung setzen.

**Pulsgurt**
- Standard-Pulsdienst funktioniert (Sigma HRM, Polar H10). Rohdaten mit und ohne RR-Intervalle, mit und ohne Kontaktbit (Sigma: `04 56` = Kontakt nicht erkannt, Wert bleibt stehen).
- Die 5-s-Abstände im Protokoll kommen vom Spike (Protokoll gedrosselt), nicht vom Gurt.
- Polar H10 trennte zweimal nach ca. 19 s ohne eine einzige Messung (08:24 und 08:27), der dritte Versuch lief. Ursache offen (Gurt nicht getragen/nicht feucht?). Zu klären, ob die App darauf vorbereitet sein muss.

## Offen / nicht getestet
- **Freier Modus:** Nach „Reset“ bzw. „Stop“ bleibt das Bike bei ca. 30 bis 40 W bei 85 U/min. Laut Stefan ändert Schalten dort nichts. Auffällig: Die Geschwindigkeit je Trittfrequenz war im zweiten Freilauf niedriger (ca. 0,10 km/h je U/min gegen 0,18 vorher). Das spricht dafür, dass sich der Gang nur auf die virtuelle Geschwindigkeit, nicht auf den Widerstand auswirkt. Notizen zu den Schaltvorgängen fehlen im Protokoll, deshalb nicht zuordenbar.
- **Hypothese:** Schalten wirkt nur, wenn die App Simulationswerte (FTMS 0x11) sendet. Das Bike meldet, dass es sie unterstützt. **Ungeprüft.** Dafür hat der Spike jetzt den Knopf „Simulation setzen (freies Training)“.
- Verbindungsabbruch/Neuverbinden (SR-1a292f): nicht getestet.
- intervals.icu (Lesen, Upload, CORS, Blockstruktur): nicht getestet.

## Folgen für die Requirements
- **SR-f073cf (freies Training)** geändert: Statt „App setzt keine Zielwatt“ sendet sie Simulationswerte (Steigung 0 %). Annahme bleibt unbestätigt, bis der Test mit dem Simulationsknopf es zeigt.
- **SR-74122b (Pause)**: nach dem Test mit Zielleistung bei Pause neu prüfen (noch nicht geändert).

## Lauf 2 (2026-11-21, live mitgeschrieben in `docs/m0/live.jsonl`)

**Freies Training mit Simulationswerten: bestätigt.**
- Befehl `11 00 00 00 00 28 33` (Wind 0, Steigung 0 %, Crr 0,004, Cw 0,51) wird mit `80 11 01` bestätigt, **auch ohne „Steuerung anfordern“**.
- Mit Simulation wirkt das Schalten: Die Geschwindigkeit je Trittfrequenz stieg im Lauf der Schaltvorgänge von etwa 0,20 km/h je U/min (14,2 km/h bei 71,5 U/min) auf etwa 0,60 (32 km/h bei 53 U/min). Bei der niedrigen Trittfrequenz lag die Leistung bei 430 bis 515 W (Spitzen enthalten Beschleunigung), im niedrigen Gang bei 20 W im Beharrungszustand (16,7 km/h, 83 U/min).
- Ohne Simulationswerte (Lauf 1) blieb das Bike bei 30 bis 40 W, Schalten wirkte nicht.
- Im Protokoll stehen nur zwei Notizen („gang hoch“). Die genaue Zahl der Schaltvorgänge ist nicht belegt, die Wirkung ist es.
- Ausrollen: Ohne Treten sinkt die virtuelle Geschwindigkeit langsam (etwa 36 auf 18 km/h in 20 s).
- Wechsel von Zielwatt (ERG, 100 W) auf Simulation klappt ohne Zwischenschritt. Die virtuelle Geschwindigkeit wird dabei übernommen (Sprung auf rund 40 km/h).

**Verbinden:** Der erste Verbindungsversuch scheiterte (`NetworkError: Connection attempt failed`), „Neu verbinden“ ohne Geräteauswahl klappte danach in 3,7 s. Ein Abbruch **während** der Fahrt kam nicht vor, SR-1a292f ist weiter ungetestet. Folge: Die App braucht einen Wiederholungsversuch schon beim ersten Verbinden.

**Pulsgurt:** Sigma HRM lief durchgehend (72 bis 130 bpm, passend zur Belastung).

**Weiterhin offen:** intervals.icu (Lesen, Upload, CORS, Blockstruktur), Abbruch während der Fahrt, Pause per Zielleistung.

## intervals.icu (Lauf 2)

- **CORS: kein Hindernis.** `GET /api/v1/athlete/{id}/events` mit Basic-Auth (`API_KEY:<Schlüssel>`) aus dem Browser (localhost): Status 200. Auch der Upload `POST /athlete/{id}/activities` mit .fit als `multipart/form-data` kam an (Status 200, Antwort mit Aktivitäts-ID). **Kein Proxy nötig.**
- **Die Aktivität aus dem Upload-Test liegt wirklich in intervals.icu** und muss dort (und bei Strava, falls weitergereicht) von Hand gelöscht werden.
- **Kalender enthält mehr als Radtraining:** 7 Termine in 14 Tagen: Ride, WeightTraining (leere `steps`, nur Beschreibung), Run (Puls-Ziel statt Leistung). Die App muss nach `type` filtern.
- **Blockstruktur kommt an (Annahme bestätigt).** `workout_doc.steps[]` mit `duration` in Sekunden und `power: {units: "w", value: 151, target: "3s"}`. Wiederholungen als Gruppe `{reps: 2, steps: [...], duration: <Summe>}`. `text` ist optional (Block ohne Namen kommt vor).
- **Leistung steht in absoluten Watt, nicht in % FTP.** Die Werte sind aus dem FTP-Stand zur Planungszeit umgerechnet (Zonen im Dokument ergeben FTP von etwa 274 W). Der Termin enthält zusätzlich `icu_ftp`. Entscheidung (Stefan): Watt werden so gefahren, wie sie im Training stehen, ohne Umrechnung auf den aktuellen FTP.
- **Nicht belegt:** Darstellung eines offenen Blocks („bis Taste“), von Rampen und tieferer Verschachtelung. Dafür gab es kein Beispiel.

Geänderte Requirements: SR-130c03 (Typ Ride, Dauer und Leistung), SR-ac287d (Watt, Wiederholungsgruppen, offene Punkte).

## 4DP-Test: Auswertung von `4dptest.fit` (lokal, nicht im Repository)

Quelle: Wahoo SYSTM, Training „Full Frontal (4DP Test)“, 2026-09-11, Kickr Bike plus Polar H10, 1-Hz-Aufzeichnung über 59 min (3535 Datensätze, 63 KB). Die Datei ist laut FIT-SDK gültig.
- **Ablauf (Start in s, Dauer, mittlere Watt):** Einfahren 0 s/639 s/185 W; 5-s-Sprint bei 788 s (7 s, 858 W, Spitze 997 W); ein weiterer kurzer Sprint bei 1035 s; **5 min** bei 1223 s (300 s, 341 W); **20 min** bei 1823 s (1200 s, 274 W); **1 min** bei 3353 s (60 s, 418 W, Spitze 603 W); dazwischen Erholungen von 1 bis 4 min.
- **Bestwerte aus den Datensätzen:** 5 s 957 W, 1 min 419 W, 5 min 341 W, 20 min 274 W.
- **Das Ergebnis des Tests (FTP, NM, AC, MAP) steht nicht in der Datei.** Im Sitzungssatz steht nur `thresholdPower` 301 W (FTP-Einstellung vor dem Test, passt zu Intensitätsfaktor 0,861). Wahoos Berechnung ist nicht öffentlich. Entscheidung: eigene Näherung, vorläufig 95 % des besten 20-Minuten-Mittels (Annahme; ergibt hier 260 W gegen 301 W FTP-Einstellung, also zu prüfen).
- Die Datei enthält Runden (Laps) für die Abschnitte, aber keine Workout-Schritte.
- Nützlich als Referenz für unsere .fit-Erzeugung: Felder je Datensatz sind Zeit, Distanz, Geschwindigkeit, Leistung, Kalorien, Puls, Trittfrequenz.
- Weil die Datei am 11.09. aufgezeichnet wurde, hat intervals.icu mit dem Upload vermutlich eine zweite Aktivität dieses Tages angelegt. Löschen.
