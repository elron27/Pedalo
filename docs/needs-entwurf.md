# Needs-Entwurf (Aufteilung des Need „Eigene Trainingssoftware statt ICTrainer“)

Status: **Entwurf, Stand nach der ersten Frage-Antwort-Runde**. Die YAML-Dateien in `need/` und `system-requirement/` sind unverändert.
Die Zuordnung muss in ReqSeq übernommen werden. Die Datei-IDs stehen in Klammern hinter jedem SR.

---

## N1 – Ein Training durchfahren (Blocks-Workout oder eigene Auswahl)
Der Athlet fährt ein Training mit Zielwatt je Block durch. Das Training kommt aus Blocks oder aus einer lokalen Bibliothek.

- Workout-Datei aus Blocks importieren, mit Blöcken aus Dauer, % FTP, Wiederholungen und offenen Blöcken (SR-120d, ergänzt)
- Workout-Quelle: Blocks-Account per Datei (SR-87da, Schnittstelle, Format noch offen, siehe unten)
- Blöcke nacheinander abspielen, Zielwatt im ERG-Modus (SR-fc22)
- Vorschau auf nächsten Block und Workout-Profil (SR-21f9)
- Aktuellen Block überspringen (SR-0015)
- Workout pausieren und fortsetzen (SR-2b29)
- Intensität live in Prozent für alle folgenden Blöcke (SR-7d9f)
- Freies Training ohne ERG jederzeit zuschalten (SR-4962)
- **Neu, Kandidat:** Eigene Trainingsbibliothek mit Favoriten, lokal gespeichert, auch ohne Blocks-Verbindung
- **Neu, Kandidat:** Bibliothek zeigt bekannte Trainings an der Seite, Auswahl startet das Training

## N2 – Geräte verbinden und stabil halten
Bike und Pulsgurt sind gekoppelt, und die Verbindung bleibt auch bei Störungen erhalten.

- Bike per Bluetooth koppeln und Status anzeigen (SR-cbb6)
- Trainer: Wahoo Kickr Bike v2 über FTMS (SR-5674, Schnittstelle)
- Pulsgurt per Bluetooth koppeln und Status anzeigen (SR-8125)
- Pulssensor: Bluetooth-Brustgurt (SR-7460, Schnittstelle)
- Bei Verbindungsabbruch Timer weiter, neu verbinden, Zielwatt neu setzen (SR-8f30)
- **Neu, Kandidat:** Mehrere Pulsgurte gespeichert, Auswahl ohne erneutes Koppeln, auch für Gast-Gurte (Frau, Gast)

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
- **Dimensionierung:** Trainingsdauer 10 Minuten bis 10 Stunden. Das sind bei 1 Hz höchstens rund 36.000 Datensätze pro Training, das ist für die Zwischenspeicherung unkritisch.

## N5 – Training auswerten und hochladen
Das Training landet in intervals.icu und damit bei Strava.

- .fit-Datei direkt zu intervals.icu hochladen (SR-203e)
- Export: .fit lokal und Upload zu intervals.icu (SR-5cb7). **Entscheidung: Beides soll abgedeckt werden, SR-5cb7 bleibt als Sammel-SR bestehen, SR-378a und SR-203e bleiben als Einzel-SRs.** Ob das Doppelung ist, klärt ReqSeq beim Übernehmen.
- Kein direkter Strava-API-Upload (SR-3d08, Constraint)

## N6 – FTP und Fahrer
Jeder Fahrer hat seinen eigenen FTP-Wert, und der FTP-Test ist direkt in der App möglich.

- FTP eingeben und dauerhaft speichern (SR-e7ef)
- Rampentest: Leistung steigern bis Abbruch, FTP berechnen (SR-7617)
- Zusätzlicher FTP-Test, z. B. 20 Minuten (SR-9d30, Soll)
- **Neu, Kandidat:** Wahoo-4DP-Test als weiterer FTP-Test
- **Neu, Kandidat:** Mehrere Fahrerprofile, jeder mit eigenem FTP und eigenem Pulsgurt

## N7 – Plattform und Sprache
Rahmenbedingungen, die die gesamte App betreffen.

- Web-App in Chrome oder Edge auf dem PC (SR-aeb1, Constraint, Annahme Windows)
- Oberfläche auf Deutsch (SR-f596, Annahme)
- **Neu, Kandidat:** Nutzbar auf Windows-PC und Mac, Chrome als Referenz. Ein iPhone wird nicht unterstützt (siehe unten), Android-Chrome ist möglich.

---

## Abdeckung (Stand vor den neuen Kandidaten)

| Need | Anzahl SR |
|---|---|
| N1 Training durchfahren | 8 |
| N2 Geräte verbinden | 5 |
| N3 Werte sehen | 4 |
| N4 Aufzeichnen und sichern | 3 |
| N5 Auswerten und hochladen | 3 |
| N6 FTP und Fahrer | 3 |
| N7 Plattform und Sprache | 2 |
| **Summe** | **28** |

## Antworten aus der Frage-Antwort-Runde

1. **SR-378a, SR-203e und SR-5cb7:** Beides abdecken. Entscheidung übernommen.
2. **Pulsgurte:** Es reicht nicht ein Gurt, sondern mehrere, auch Gast-Gurte. Das Koppeln darf nicht bei jedem Training nötig sein. Neuer Kandidat in N2.
3. **FTP-Tests:** Gewünscht ist der 20-Minuten-Test, der Wahoo-4DP-Test oder der Rampentest. Die Antwort „entweder oder“ lässt offen, ob einer genügt oder alle drei gebraucht werden. Das ist in der nächsten Runde zu klären (siehe unten).
4. **Plattform:** Windows-PC für den Fahrer, ein Freund mit Mac, Handy ist möglich. Crossplattform ist gewünscht, und Chrome ist die naheliegende Wahl. **Achtung:** Web Bluetooth funktioniert in Chrome und Edge auf Windows, Mac und Android, aber nicht in Safari und nicht auf dem iPhone. Ein iPhone-Nutzer bräuchte also eine andere Lösung.
5. **Workout-Format aus Blocks:** Blocks nutzt eine eigene Struktur. Ein Beispiel-Workout hat Blöcke vom Typ `steady` (Dauer in Sekunden, Leistung in % FTP, Trittfrequenz, Bezeichnung) und `repeat` (Wiederholungen mit Kindblöcken). Außerdem gibt es offene Blöcke (`open`, z. B. „Best even effort“). Der Import muss also Wiederholungen und offene Blöcke verarbeiten. **Offen:** Ob Blocks eine Datei exportiert (JSON oder .zwo) oder ob die App die Blocks-Struktur direkt liest, ist noch nicht entschieden. Die Blocks-Trainingsliste ist zudem nur über den Connector erreichbar, deshalb die lokale Bibliothek als Ersatz (siehe N1).
6. **Dauer:** 10 Minuten bis 10 Stunden, ist in N4 berücksichtigt.

## Offene Fragen für die nächste Runde

1. Reicht einer der drei FTP-Tests (20 Minuten, 4DP, Rampe), oder sollen alle drei in Version 1? Und meint „4dp“ den Wahoo-4DP-Test?
2. Ist ein iPhone-Nutzer ein Thema, oder reicht PC und Mac mit Chrome?
3. Soll die Blocks-Anbindung in Version 1 eine Datei-Lösung sein (manueller Export), oder ist ein direkter Abruf über den Connector gewünscht?
4. Mehrere Fahrerprofile: Soll die App zwischen Fahrern umschalten können (z. B. Frau und Gast), oder reicht ein gemeinsames FTP?
