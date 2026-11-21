# Needs-Entwurf (Aufteilung des Need „Eigene Trainingssoftware statt ICTrainer“)

Status: **Entwurf, Stand nach der zweiten Frage-Antwort-Runde**. Die YAML-Dateien in `need/` und `system-requirement/` sind unverändert.
Die Zuordnung muss in ReqSeq übernommen werden. Die Datei-IDs stehen in Klammern hinter jedem SR.

---

## N1 – Ein Training durchfahren
Der Athlet fährt ein Training mit Zielwatt je Block durch. Das Training kommt aus intervals.icu (dorthin synchronisiert Blocks automatisch), von Hand oder aus einer lokalen Bibliothek.

- Trainings aus intervals.icu abrufen und als Block-Liste anzeigen (SR-120d, SR-87da, geändert: Quelle ist intervals.icu, nicht Blocks direkt)
- Blocks-Struktur verarbeiten: Blöcke mit Dauer, % FTP, Wiederholungen und offenen Blöcken (ergänzt)
- Blöcke nacheinander abspielen, Zielwatt im ERG-Modus (SR-fc22)
- Vorschau auf nächsten Block und Workout-Profil (SR-21f9)
- Aktuellen Block überspringen (SR-0015)
- Workout pausieren und fortsetzen (SR-2b29)
- Intensität live in Prozent für alle folgenden Blöcke (SR-7d9f)
- Freies Training ohne ERG jederzeit zuschalten, auch ohne Workout. Die Leistung ändert sich allein durch Schalten am Bike, die App setzt keine Zielwatt (SR-4962, ergänzt)
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
- **Neu, bestätigt:** Gastmodus ohne Profil und ohne Konten: sofort fahren, alle Werte (z. B. FTP) per Hand eintippen, Upload entfällt
- **Neu, bestätigt:** Auch ein Fahrer ohne verbundenes Konto kann alle Werte von Hand eintippen und fahren

## N7 – Plattform und Sprache
Rahmenbedingungen, die die gesamte App betreffen.

- Web-App in Chrome oder Edge auf dem PC (SR-aeb1, Constraint, Annahme Windows)
- Oberfläche auf Deutsch (SR-f596, Annahme)
- **Bestätigt:** Nutzbar auf Windows-PC und Mac mit Chrome. Ein iPhone wird nicht unterstützt (Web Bluetooth fehlt dort). Android ist möglich, aber nicht Ziel.

---

## Antworten aus der zweiten Runde

1. **FTP-Tests:** Alle drei sollen möglich sein (20 Minuten, Wahoo 4DP, Rampe). Damit sind sie alle in Version 1.
2. **iPhone:** wird ausgelassen.
3. **Blocks-Anbindung:** Erst „direkt über den Connector“, dann die Überlegung, ob intervals.icu allein reicht, weil Blocks dorthin automatisch synchronisiert. **Empfehlung: intervals.icu als einzige Schnittstelle** (Trainings lesen, .fit hochladen). Damit entfällt die Abhängigkeit von einer Blocks-API, die ich nicht kenne. Zu prüfen: Kommen die Blocks-Trainings in intervals.icu mit Blockstruktur (Dauer, % FTP) im Kalender an?
4. **Fahrerprofile:** umschaltbar, eigener FTP, eigenes intervals.icu-Konto (falls vorhanden). Ein Blocks-Konto muss die App nicht kennen, wenn intervals.icu die Quelle ist. Im Gastmodus fährt man ohne Konto.
5. **Manuelle Eingabe:** Gast und Fahrer ohne Konto tippen alles von Hand ein.
6. **Freies Training:** Schalten am Bike ändert die Leistung, die App setzt keine Zielwatt (SR-4962 ergänzt).

## intervals.icu: API-Schlüssel oder OAuth?

Aus dem Screenshot: Die Seite sagt, dass man **keine OAuth-App braucht, wenn man nur auf Daten zugreift, die man selbst in intervals.icu sieht**. Jeder Athlet hat einen API-Schlüssel. OAuth wird nötig, wenn eine App von **mehreren Athleten** genutzt wird oder Webhooks braucht.

- Für den Start reicht der **API-Schlüssel**: Jedes Fahrerprofil speichert seinen eigenen Schlüssel.
- Sobald Frau, Gast oder Freund die App ohne Schlüssel-Kopieren nutzen sollen, ist **OAuth** die saubere Lösung. Der Antrag wird manuell geprüft. Die App läuft im Browser und kann das Client-Geheimnis nicht verstecken, deshalb als „Öffentlicher Client“ mit „PKCE erforderlich“. `http://localhost/*` ist als Redirect immer erlaubt, für eine gehostete App braucht es eine eigene Redirect-URL.
- Webhooks sind nicht nötig und bleiben aus.
- Den Antrag solltest du **noch nicht stellen**, bevor wir die Schnittstelle getestet haben. Er blockiert die Entwicklung nicht.

## Technische Risiken, die vor dem Coding zu prüfen sind

- **Blockstruktur in intervals.icu:** Ob die von Blocks synchronisierten Trainings dort als strukturierte Trainings (Dauer, % FTP, Wiederholungen) ankommen und sich per API auslesen lassen, ist zu prüfen. Nach meinem Kenntnisstand kennt intervals.icu strukturierte Workouts und kann sie als .zwo oder .mrc exportieren, das ist aber nicht belegt.
- **CORS:** Ob der Browser die intervals.icu-API direkt aufrufen darf, ist zu prüfen. Sonst braucht es einen kleinen Proxy.
- **Speicherung pro Fahrer:** Schlüssel oder Tokens liegen im Browser des Nutzers. Das ist für ein Ein-PC-Setup vertretbar, muss aber als Anforderung stehen.
- **Freies Training am Bike:** Ob die Gangschaltung des Kickr Bike v2 ohne gesetzte Zielwatt die Leistung ändert, ist am echten Bike zu testen.

## Offene Fragen für die nächste Runde

1. Erscheint ein von Blocks geplantes Training in deinem intervals.icu-Kalender mit Blöcken (Dauer und Leistung), oder nur als Titel? Ein kurzer Blick in den Kalender reicht.
2. Soll die erste Version nur mit API-Schlüssel laufen, und OAuth folgt später für Frau und Freunde?
3. Soll die App auf einem öffentlichen Webserver liegen (eine URL, die auch der Freund öffnet), oder nur lokal auf deinem PC laufen?
