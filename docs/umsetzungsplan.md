# Umsetzungsplan Pedalo (Entwurf)

Stand: Requirements in ReqSeq übernommen (7 Needs, 36 SRs, alle `draft`). Dieser Plan ist **Vorschlag**, Technikwahl und Prüfmethoden sind zu bestätigen (siehe „Zu entscheiden“).

## 1. Technik (Vorschlag)

| Bereich | Vorschlag | Grund |
|---|---|---|
| Sprache/Build | TypeScript, Vite | Web-App, lokal, kein Server nötig |
| Oberfläche | Preact oder Svelte (klein, reaktiv) | Live-Werte im Sekundentakt |
| Unit-/Komponententests | Vitest, JUnit-XML-Ausgabe | ReqSeq nimmt JUnit (`evidence enrich-junit`) |
| Browsertests | Playwright (Chromium) mit eingeschleustem `navigator.bluetooth`-Simulator | Web Bluetooth ist ohne Hardware sonst nicht testbar |
| .fit-Datei | `@garmin/fitsdk` (Schreiben und Prüfen/Dekodieren) | Gültigkeit der Datei im Test beweisen |
| Speicherung | IndexedDB (Zwischenstand, Bibliothek), localStorage (Profile) | Ein-PC-Betrieb, kein Server |
| Betrieb | `vite preview` lokal, `localhost` (sicherer Kontext für Web Bluetooth) | Entscheidung dritte Runde |

## 2. Architektur-Schnitte (damit alles testbar bleibt)

Hardware und Netz hängen hinter Schnittstellen; der Kern kennt nur diese.

- `domain/` ohne Browser-APIs: Workout-Modell, Blockabfolge, Player (Zustandsautomat: läuft/Pause/Überspringen/Intensität), FTP-Berechnung (Rampe, 20 min, 4DP), Aufzeichnung, FIT-Erzeugung.
- `ports/`: `Trainer` (FTMS), `HeartRateSensor`, `WorkoutSource` (intervals.icu), `Uploader`, `Clock`, `Storage`, `WakeLock`.
- `adapters/`: echte Web-Bluetooth-/fetch-/IndexedDB-Implementierungen **und** Simulatoren (gleiche Schnittstelle, steuerbare Zeit, Aussetzer einspeisbar).
- `ui/`: nur Darstellung und Bedienung.

Der Simulator-Trainer ist Pflicht von Anfang an, nicht Zusatz: er trägt die meisten Tests.

## 3. Meilensteine

**M0 – Technischer Spike (Stefan mit Bike nötig).** Web Bluetooth zu Kickr Bike v2 (FTMS: Zielwatt setzen, Leistung/Trittfrequenz lesen) und Pulsgurt; intervals.icu-API mit API-Schlüssel (Kalender, strukturiertes Training, Upload .fit); CORS aus dem Browser; schaltet das Bike ohne Zielwatt die Leistung? Ergebnis: kurze Notiz in `docs/` und Korrektur der betroffenen Annahmen in den SRs (SR-130c03, SR-ac287d, SR-f073cf). Nicht produktiv, Code wird verworfen oder als Vorlage für Adapter genutzt.

**M1 – Gerüst und Beweiskette.** Projekt, Linter, Vitest, Playwright, Simulatoren-Gerippe. Skript `npm run test:evidence`: Tests laufen, JUnit-XML wird per `reqseq evidence enrich-junit` nach `evidence/<Lauf>.xml` geschrieben (Item = Commit). Hilfsskript, das aus ReqSeq die Referenzen `[SR-xxxxxx/AK-yyyy]` ausliest, damit Testnamen nie von Hand erfunden werden. Erst wenn ein Dummy-Test den Grad > 0 % zeigt, ist die Kette dicht.

**M2 – Domänenkern (reines Unit-Testen).** Blockstruktur (Dauer, % FTP, Wiederholung, offener Block), Player, Intensitäts-Anpassung, Aufzeichnung 1 Hz, FIT-Erzeugung und -Prüfung, Zwischenspeicherung und Wiederherstellung, FTP-Tests. Hier entsteht der größte Teil der Testabdeckung.

**M3 – Geräte mit Simulator.** FTMS- und Puls-Adapter, Kopplung/Status, Verbindungsabbruch mit Wiedereinstieg (Timer weiter, Zielwatt neu setzen), mehrere Pulsgurte.

**M4 – Oberfläche.** Live-Anzeige, Vorschau, Pause/Überspringen/Intensität, dunkles Design, Wake Lock, Vollbild, Fahrer- und Gastmodus-Bedienung, Bibliothek.

**M5 – intervals.icu.** Trainings abrufen, Upload auf das Konto des aktiven Fahrers; gegen Mock-Server getestet, einmal echt abgenommen.

**M6 – Abnahme am echten Bike.** Alle Requirements mit Methode `demonstration` und die Hardware-Fälle aus M3 werden von Stefan gefahren und als Evidenz erfasst; danach Validierung der Needs durch Stefan.

M0 und M1 können parallel laufen; M2 baut auf M1 auf; M3 und M5 sind danach unabhängig voneinander.

## 4. Testkonzept

Ebenen: **Unit** (Domäne), **Komponente** (UI mit Simulatoren in Vitest/jsdom bzw. Playwright), **E2E im Browser** (Playwright, `navigator.bluetooth` durch Simulator ersetzt), **Abnahme am Gerät** (von Hand).

Regeln (aus dem ReqSeq-Leitfaden):
1. Ein Test je Akzeptanzkriterium, Name `[SR-xxxxxx/AK-yyyy] …` mit dem Schlüssel des Kriteriums, nie der Nummer.
2. Jeder Testlauf erzeugt eine eigene Datei in `evidence/`, nichts wird überschrieben, kein Test wird abgeschaltet, um den Grad zu verbessern.
3. Methoden außer `test` (Demonstration, Inspektion, Analyse) werden mit `reqseq evidence record … --method …` erfasst, nur nach tatsächlich erfolgter Prüfung. Die Validierung der Needs trägt Stefan selbst ein.
4. Ändert sich ein Requirement, zählen seine alten Nachweise nicht mehr; Tests anpassen und neu laufen lassen.
5. Ehrlich bleiben: Ein Simulatortest beweist die Logik, nicht die Hardware. Wo das Verhalten am Gerät hängt, steht die Methode `demonstration` und die Abnahme in M6.

Fixtures: aufgezeichnete FTMS-/Puls-Datenströme aus M0 als Testdaten, ein Beispiel-Training aus intervals.icu (anonymisiert), eine gültige Referenz-.fit.

## 5. Prüfmethode je Requirement (Vorschlag, zu bestätigen)

`verification-method` ist bei den 28 alten SRs noch nicht gesetzt; es wird beim Anlegen der Tests mit `reqseq element update` gesetzt.

| Need | SR | Gegenstand | Methode | Wie geprüft |
|---|---|---|---|---|
| N1 | 130c03 | Trainings aus intervals.icu abrufen | test | Mock-API-Antwort → Block-Liste |
| N1 | ac287d | Blockstruktur verarbeiten | test | Parser-Unit-Tests |
| N1 | 3c3d67 | Quelle nur intervals.icu | inspection | Code-/Abhängigkeitsprüfung, kein Blocks-Zugriff |
| N1 | 00e7dd | Blöcke abspielen, Zielwatt je Block | test | Player + Simulator-Trainer erhält Zielwatt |
| N1 | 23612e | Vorschau nächster Block, Profil | test | Komponententest |
| N1 | cefa05 | Block überspringen | test | Player |
| N1 | 74122b | Pause/Fortsetzen | test | Player mit steuerbarer Uhr |
| N1 | 7ed21c | Intensität live in % | test | Player |
| N1 | f073cf | Freies Training, Schalten am Bike | demonstration | Am Bike; Zielwatt-Freiheit zusätzlich als Test |
| N1 | 35475a | Bibliothek, Favoriten | test | IndexedDB, Neustart |
| N1 | 3dbb4e | Bibliothek an der Seite | demonstration | UI-Abnahme |
| N2 | f1a89f / d51418 | Bike / Pulsgurt koppeln, Status | test + Abnahme in M6 | Simulator; Hardware-Fall protokolliert |
| N2 | f83db7 / f22ac4 | Schnittstellen FTMS / Brustgurt | demonstration | Am echten Gerät; Protokollmitschnitt als Fixture |
| N2 | 1a292f | Verbindungsabbruch, Wiedereinstieg | test | Simulator trennt, Timer läuft weiter, Zielwatt neu |
| N2 | a54eef | Mehrere Pulsgurte | test | Speicher und Auswahl |
| N3 | 88ab50 | Live-Werte | test | Komponententest mit Simulatorwerten |
| N3 | 988963 | Große Zahlen aus der Distanz | demonstration | Lesbarkeit aus Fahrposition; Schriftgröße zusätzlich als Test |
| N3 | 8bfae1 | Dunkles Design | inspection | Prüfung der Farbwerte/Kontrast |
| N3 | 9851f3 | Bildschirm bleibt an | test | Wake-Lock-Mock |
| N4 | 2dda85 | Aufzeichnung 1 Hz | test | 36.000 Datensätze (10 h) ohne Lücke |
| N4 | e21b18 | .fit lokal speichern | test | Datei mit FIT-SDK dekodieren und prüfen |
| N4 | a6bbe0 | Zwischenspeichern, Wiederherstellen | test | Absturz simulieren, .fit wiederherstellen |
| N5 | 4bd74c | Upload auf Konto des aktiven Fahrers | test | Mock-Server; einmal echt in M6 |
| N5 | b0d66d | Export lokal + Upload | test | wie oben |
| N5 | 0a7b94 | Kein Strava-API-Upload | inspection | Code-Prüfung |
| N6 | 920097 | FTP pro Fahrer speichern | test | Neustart, Profilwechsel |
| N6 | e50794 / e6536b | Rampentest / 20-min-Test | test | Berechnung gegen bekannte Werte |
| N6 | 12969a | Wahoo-4DP-Test | demonstration | Verfahren erst nach M0 genau klären (Annahme) |
| N6 | 0bf586 | Mehrere Fahrerprofile | test | Wechsel, getrennte Daten |
| N6 | e32fa8 / ff7b53 | Gastmodus / Fahrer ohne Konto | test | E2E ohne Konto, kein Upload |
| N7 | fa0d80 | Chrome auf Windows und Mac | demonstration | Je ein Lauf auf beiden Systemen |
| N7 | 8ee43c | Oberfläche auf Deutsch | inspection | Prüfung der Texte (Textdatei/Lint) |

Hinweis: Die Akzeptanzkriterien einiger alter SRs sind knapp (z. B. „Annahme einfachste Variante“). Beim Anlegen der Tests wird jedes Kriterium gelesen und, falls unklar, gefragt statt interpretiert.

## 6. Risiken

- Web Bluetooth/FTMS-Eigenheiten des Kickr Bike v2 (M0), z. B. Verbindungsverhalten bei Aussetzern.
- Blockstruktur in intervals.icu nicht wie angenommen (M0). Fallback: Datei-Import (.zwo) bleibt als Notweg denkbar, wäre aber eine Änderung am Need.
- CORS der intervals.icu-API (M0). Fallback: kleiner lokaler Proxy.
- 4DP-Testverfahren ist nicht beschrieben; die Methode muss erst festgelegt werden.
- Mac/Chrome: Web Bluetooth läuft dort, ist aber nur bei einem Gerät in M6 prüfbar.

## 7. Zu entscheiden

1. Technikwahl in Abschnitt 1 (insbesondere Oberflächen-Bibliothek).
2. Prüfmethoden in Abschnitt 5, vor allem `demonstration` für Hardware-Fälle.
3. Wer fährt M0 und wann; ohne M0 sind M3 und M5 auf Annahmen gebaut.
