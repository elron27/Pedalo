# Needs-Entwurf (Aufteilung des Need „Eigene Trainingssoftware statt ICTrainer“)

Status: **Entwurf, Stand nach der zweiten Frage-Antwort-Runde**. Die YAML-Dateien in `need/` und `system-requirement/` sind unverändert.
Die Zuordnung muss in ReqSeq übernommen werden. Die Datei-IDs stehen in Klammern hinter jedem SR.

---

## N1 – Ein Training durchfahren
Der Athlet fährt ein Training mit Zielwatt je Block durch. Das Training kommt aus Blocks (direkt über den Connector, Fallback intervals.icu) oder aus einer lokalen Bibliothek.

- Training aus Blocks direkt abrufen und als Block-Liste anzeigen (SR-120d, SR-87da, geändert, siehe Abschnitt „Antworten“)
- Blocks-Struktur verarbeiten: Blöcke mit Dauer, % FTP, Wiederholungen und offenen Blöcken (ergänzt)
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
- **Neu, Kandidat:** Mehrere Pulsgurte gespeichert, Auswahl ohne erneutes Koppeln, auch für Gast-Gurte

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
- **Dimensionierung:** Trainingsdauer 10 Minuten bis 10 Stunden, höchstens rund 36.000 Datensätze pro Training bei 1 Hz.

## N5 – Training auswerten und hochladen
Das Training landet im intervals.icu-Konto des jeweiligen Fahrers und damit bei Strava.

- .fit-Datei direkt zu intervals.icu hochladen, auf das Konto des aktiven Fahrers (SR-203e, ergänzt)
- Export: .fit lokal und Upload zu intervals.icu (SR-5cb7), als Sammel-SR beibehalten
- Kein direkter Strava-API-Upload (SR-3d08, Constraint)

## N6 – Fahrer und FTP
Jeder Fahrer hat sein eigenes Profil mit eigenem FTP, eigenem Pulsgurt und eigenen Konten. Ein Gastmodus braucht keine Konten.

- FTP eingeben und dauerhaft speichern, pro Fahrer (SR-e7ef, ergänzt)
- Rampentest: Leistung steigern bis Abbruch, FTP berechnen (SR-7617, Option)
- Zusätzlicher FTP-Test, z. B. 20 Minuten (SR-9d30, Option)
- **Neu, bestätigt:** Wahoo-4DP-Test als weiterer FTP-Test (Option)
- **Neu, bestätigt:** Mehrere Fahrerprofile, umschaltbar, jedes mit eigenem FTP, eigenem Blocks-Konto und eigenem intervals.icu-Konto (falls vorhanden)
- **Neu, bestätigt:** Gastmodus ohne Profil und ohne Konten: sofort fahren, FTP-Angabe per Hand, Upload entfällt

## N7 – Plattform und Sprache
Rahmenbedingungen, die die gesamte App betreffen.

- Web-App in Chrome oder Edge auf dem PC (SR-aeb1, Constraint, Annahme Windows)
- Oberfläche auf Deutsch (SR-f596, Annahme)
- **Bestätigt:** Nutzbar auf Windows-PC und Mac mit Chrome. Ein iPhone wird nicht unterstützt (Web Bluetooth fehlt dort). Android ist möglich, aber nicht Ziel.

---

## Antworten aus der zweiten Runde

1. **FTP-Tests:** Alle drei sollen möglich sein (20 Minuten, Wahoo 4DP, Rampe). Damit sind sie alle in Version 1.
2. **iPhone:** wird ausgelassen.
3. **Blocks-Anbindung:** Die App soll direkt über den Connector abrufen. Falls das nicht geht, wird intervals.icu als Quelle genutzt.
4. **Fahrerprofile:** umschaltbar, eigener FTP, eigenes Blocks-Konto und eigenes intervals.icu-Konto (falls vorhanden). Im Gastmodus fährt man ohne Konto.

## Technische Risiken, die vor dem Coding zu prüfen sind

- **Direkter Blocks-Zugriff aus der Web-App:** Der Connector, den ich hier nutze, ist ein Werkzeug für mich, nicht für eine Browser-App. Die App bräuchte eine öffentliche Blocks-API mit Zugang pro Fahrer. Ob es die gibt, ist nicht geklärt. Ohne API fällt die Anbindung auf intervals.icu zurück, wie du es vorgesehen hast.
- **intervals.icu-API:** Nach meinem Kenntnisstand gibt es sie mit einem API-Schlüssel pro Konto, sie kann Trainings lesen und .fit hochladen. Das muss noch geprüft werden, auch ob der Browser sie ohne Proxy aufrufen darf (CORS).
- **Speicherung pro Fahrer:** Konten und Schlüssel liegen dann im Browser des Nutzers. Das ist für ein Ein-PC-Setup vertretbar, muss aber als Anforderung stehen.

## Offene Fragen für die nächste Runde

1. Hast du einen intervals.icu-API-Schlüssel, und nutzt ihr intervals.icu schon für Strava?
2. Soll das Blocks-Konto über den offiziellen Blocks-Login oder über einen Schlüssel angebunden werden? Das klären wir mit dem Blocks-Anbieter.
3. Soll ein Gast seinen FTP-Wert eintippen können, oder darf er immer einen Test machen?
