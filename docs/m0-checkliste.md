# M0-Checkliste: Spike am Bike (ca. 2 Stunden)

Ziel: die vier Annahmen prüfen, auf denen M3 und M5 stehen. Es wird nur gemessen, kein Code für später geschrieben.
Alles Beobachtete steht am Ende im **Protokoll** (Knopf „Protokoll als Datei speichern“). Bitte die Datei nach `docs/m0/` legen, sie wird später als Testdaten (Fixtures) benutzt.

## Vorbereitung (10 min)

1. Im Projektordner starten: `npm install` (einmalig), dann `npm run dev`.
2. In **Chrome** öffnen: `http://localhost:5173/spike/index.html` (Port steht in der Konsole). Nicht Edge, nicht über die IP-Adresse (sonst fehlt Web Bluetooth).
3. Bike einschalten und einmal treten, damit es wach ist. **Wahoo-App/ICTrainer und alle anderen Programme schließen**, die das Bike verbinden; das Bike hält meist nur eine Verbindung.
4. Pulsgurt anlegen (feucht). Auch hier andere Verbindungen trennen.
5. Für intervals.icu zur Hand: Athlet-ID (`i…`, in den Einstellungen) und API-Schlüssel. Die Seite speichert beides nicht. Falls möglich eine Test-.fit-Datei bereithalten (z. B. aus einer älteren Fahrt).

## Test 1: Bike per Bluetooth (FTMS), ca. 20 min

| # | Schritt | Beobachten / Notiz |
|---|---|---|
| 1.1 | „Bike verbinden“, Kickr wählen | Erscheint es in der Liste? Wie lange bis „bike.bereit“? Name des Geräts? |
| 1.2 | Protokoll lesen | Welche Characteristics hat der FTMS-Service (`bike.characteristic`)? Wert von `bike.feature` und `bike.powerRange` (Min/Max Watt) |
| 1.3 | Treten (ohne Steuerung) | Zeigen Watt, Trittfrequenz, km/h passende Werte? Wie oft kommen sie (ca. 1 pro Sekunde?) |
| 1.4 | „Steuerung anfordern“, dann „Start“ | Antwort in `bike.controlResponse`? (`80 00 01` = Anfrage angenommen, `80 07 01` = Start ok) |
| 1.5 | Zielwatt 100 setzen, dann 150, 200 | Folgt die Leistung innerhalb weniger Sekunden? Wie lange? Antwort `80 05 01`? |
| 1.6 | Bei Zielwatt 150 die Trittfrequenz ändern und **schalten** | Bleibt die Leistung bei ~150 W? (Erwartung im ERG-Modus: ja) |
| 1.7 | Maximalen Zielwatt testen (z. B. 400), danach wieder 100 | Wird er akzeptiert/begrenzt? |

## Test 2: Freies Training, Schalten ohne Zielwatt (Annahme zu SR-f073cf), ca. 15 min

Das ist die wichtigste offene Frage für „Freies Training“.

| # | Schritt | Beobachten / Notiz |
|---|---|---|
| 2.1 | „Trennen“, Seite neu laden, Bike verbinden, **nichts anfordern** | Notiz schreiben: „frei, keine Steuerung“ |
| 2.2 | Mit konstanter Trittfrequenz (z. B. 80) treten, Gang um Gang **hochschalten**, dann runter | Ändert sich die Watt-Anzeige mit dem Gang? Bitte in die Notiz „Gang +1: X W bei 80 U/min“ |
| 2.3 | Nach Steuerung/ERG (Test 1) „Reset“ oder „Stop“ senden | Geht das Bike in den freien Modus zurück, und ändert Schalten dort wieder die Leistung? |
| 2.4 | Gleicher Versuch mit „Steuerung anfordern“ aber **ohne** Zielwatt | Verhalten notieren |

Ergebnis „A“: Schalten ändert die Leistung nur ohne Steuerung/nach Reset → SR-f073cf passt, die App sendet in freiem Modus nichts. Ergebnis „B“: ändert nie etwas → SR-f073cf anders formulieren und Rückfrage an dich.

## Test 3: Verbindungsabbruch (SR-1a292f), ca. 15 min

| # | Schritt | Beobachten / Notiz |
|---|---|---|
| 3.1 | Bei laufender Fahrt „Trennen“ klicken, dann „Neu verbinden (ohne Auswahl)“ | Klappt das ohne erneute Geräte-Auswahl? Wie lange (`bike.neuverbunden` ms)? |
| 3.2 | Bike kurz ausschalten (oder Bluetooth am PC aus/an), wieder einschalten, „Neu verbinden“ | Erkennt `bike.getrennt` den Abbruch? Klappt Neuverbinden? Wie oft muss man es versuchen? |
| 3.3 | Nach Neuverbinden Steuerung anfordern und Zielwatt neu setzen | Wird der Zielwatt wieder gehalten? |
| 3.4 | Bei laufender Fahrt den Browser-Tab einige Sekunden in den Hintergrund legen | Laufen die Daten weiter? |

## Test 4: Pulsgurt, ca. 10 min

| # | Schritt | Beobachten / Notiz |
|---|---|---|
| 4.1 | „Pulsgurt verbinden“ | Wird der Gurt gefunden? Plausible Werte? |
| 4.2 | Bike und Gurt gleichzeitig | Laufen beide stabil über 5 Minuten? |
| 4.3 | Gurt trennen (abnehmen) und neu verbinden | Wie reagiert die Seite? Muss man neu auswählen? |

## Test 5: intervals.icu (SR-130c03, SR-ac287d, CORS), ca. 30 min

Wichtig vorab: Ein **gutes** Ergebnis ist hier auch ein Fehler, wenn er etwas Klares zeigt (z. B. CORS-Fehler).

| # | Schritt | Beobachten / Notiz |
|---|---|---|
| 5.1 | In Blocks ein Training in den intervals.icu-Kalender der nächsten Tage legen, mit Intervallen und mindestens einer Wiederholung (z. B. 5 × 3 min) und einem Block „bis Taste“ falls möglich | Training soll in intervals.icu im Kalender erscheinen. Notiz dazu. |
| 5.2 | ID und Schlüssel eintragen, „Trainings aus Kalender lesen“ | `icu.events.status`: 200? Oder Fehler (CORS)? Meldung genau abschreiben |
| 5.3 | Protokoll ansehen | Hat das Training ein `workout_doc`? Welche Schritte (Dauer, % FTP/Watt, Wiederholungen) stehen darin? Das gesamte `workout_doc` später an Claude geben |
| 5.4 | .fit-Datei wählen, „hochladen“ | `icu.upload.status`: Status und Antwort? **Achtung:** Die Aktivität landet wirklich in intervals.icu und kann bei Strava erscheinen. Danach dort wieder löschen |
| 5.5 | Mit einem zweiten Athleten wiederholen, falls vorhanden | Funktioniert der eigene Schlüssel pro Athlet? |

Falls 5.2/5.4 an CORS scheitern: Es ist keine Katastrophe, dann kommt ein kleiner lokaler Proxy. Nur die Meldung notieren.

## Abschluss (10 min)

1. „Protokoll als Datei speichern“ und Datei nach `docs/m0/` kopieren.
2. Kurze Notizen (Stichpunkte) mit Ergebnissen zu Test 1 bis 5 an Claude geben.
3. Auch nützlich: Welche Gänge hat das Bike (Zahl der Stufen), wie ist das Gefühl bei Zielwatt-Wechsel.

## Was Claude daraus macht

- Notiz in `docs/` mit den Ergebnissen, Korrektur der Annahmen in SR-130c03, SR-ac287d, SR-f073cf, SR-1a292f, SR-4bd74c.
- Aufgezeichnete Datenströme werden Testdaten für die Simulatoren (M3).
- Entscheidung Direktzugriff oder Proxy für intervals.icu.
- 4DP-Test: Unabhängig von M0 offen; kurz notieren, wie du ihn kennst (Dauer, Ablauf), damit die Anforderung genau wird.
