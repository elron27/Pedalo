# M6: Abnahme am echten Bike

Stand: M2 bis M5 sind gebaut. 31 von 36 Requirements sind durch Tests oder Inspektion belegt. Die restlichen Punkte kann nur das echte Bike zeigen. Diese Anleitung führt durch alles, was am Bike zu prüfen ist (etwa 1 bis 1,5 Stunden).

## Vorbereitung

1. Im Projektordner starten (Dev-Server, er schreibt alles live mit, damit Claude mitlesen kann):
   ```powershell
   npm run dev
   ```
2. In **Chrome** öffnen: `http://localhost:5173`
3. Andere Programme schließen, die das Bike oder den Pulsgurt verbinden (Wahoo-App, ICTrainer).
4. Optional: im Dev-Server werden Befehle, Verbindungsstatus und Fehler nach `docs/m0/live.jsonl` geschrieben.

Meldungen der App sind deutsch. Wenn etwas komisch ist: Notiz machen und weiterfahren, Claude liest das Protokoll.

## Ablauf

Jeder Punkt nennt das Requirement, das er belegt. **Nur bestätigen, was du wirklich gesehen hast.** Claude trägt die Nachweise erst nach deiner Rückmeldung ein.

### A. Verbinden (SR-f83db7, SR-f1a89f, SR-f22ac4, SR-d51418)
- [ ] „Bike koppeln“, Kickr wählen: Status wechselt auf **verbunden**, der Name erscheint.
- [ ] „Pulsgurt koppeln“: Status **verbunden**, Puls erscheint später im Training.
- [ ] Bike ausschalten oder Bluetooth am PC kurz aus: Status wechselt auf **getrennt**.

### B. Freies Training, Schalten (SR-f073cf)
- [ ] „Freies Training starten“, mit konstanter Trittfrequenz treten.
- [ ] Gang um Gang hoch- und runterschalten: **Ändert sich die Leistung bei gleicher Trittfrequenz?** (Erwartung: ja, wie im M0-Versuch mit Simulationswerten.)
- [ ] Eine Zahl dazu notieren, z. B. „Gang +3: von 60 W auf 180 W bei 80 U/min“.

### C. Training aus intervals.icu (SR-00e7dd, SR-130c03, SR-74122b, SR-cefa05, SR-7ed21c, SR-1a292f)
Vorher: Im Profil FTP, Athlet-ID und API-Schlüssel eintragen, Reiter „intervals.icu“, „Trainings laden“.
- [ ] Ein kurzes Rad-Training wählen (am besten eines mit Wiederholungen) und starten.
- [ ] **Zielwatt:** Das Bike geht auf die Zielleistung des ersten Blocks, bei jedem Blockwechsel auf die nächste (Wert im Training = Ziel-Anzeige = Leistung).
- [ ] **Pause:** „Pause“ drücken. Die Leistung soll fallen (die App setzt dabei 0 W als Ziel). „Weiter“: Timer läuft ab dem Stand weiter, Zielwatt kommt zurück.
- [ ] **Überspringen:** „Block überspringen“: sofort der nächste Block.
- [ ] **Intensität:** „+“ zweimal: Zielwatt steigt um 10 %.
- [ ] **Abbruch:** Mitten im Block das Bike kurz ausschalten (oder Bluetooth am PC aus/an). Der Timer läuft weiter, die App verbindet selbst neu, danach steht die Zielwatt wieder. **Wie lange hat es gedauert?**
- [ ] „Freies Training zuschalten“ und „Zurück zum Training“ funktionieren.

### D. Anzeige aus der Distanz (SR-988963)
- [ ] „Vollbild“ drücken und von deiner Fahrposition auf den Bildschirm schauen: Watt, Puls und Trittfrequenz **lesbar ohne Anstrengung?** Falls nicht: Was ist zu klein?

### E. Datei und Upload (SR-b0d66d, SR-4bd74c, SR-e21b18)
- [ ] Nach der Fahrt „Beenden“: „.fit-Datei speichern“. Datei liegt im Download-Ordner.
- [ ] „Zu intervals.icu hochladen“: Aktivität erscheint im richtigen Konto. **Danach dort (und bei Strava) wieder löschen**, wenn es nur ein Test war.
- [ ] Erscheint die Aktivität in Strava (sofern verbunden)? Leistung, Puls und Trittfrequenz sichtbar?

### F. Absturz (SR-a6bbe0)
- [ ] Neue Fahrt starten, 1 bis 2 Minuten fahren, den **Tab schließen** (nicht „Beenden“).
- [ ] Seite neu öffnen: „Nicht beendete Fahrt gefunden“, „Wiederherstellen“, „.fit-Datei speichern“. Datei ist plausibel (importierbar)?

### G. Zweiter Pulsgurt (SR-a54eef)
- [ ] Im Profil zwei Gurte koppeln, dann den anderen aus „Gespeicherte Pulsgurte“ wählen: Verbindet er **ohne** Auswahlfenster? (In Chrome hängt das von der Browsereinstellung ab; falls nicht: genau notieren, was passiert.)

### H. FTP-Tests (SR-e50794, SR-e6536b, SR-12969a), optional
- [ ] Rampentest ein paar Stufen mitfahren und durch Aufhören beenden: Es erscheint ein FTP-Vorschlag.
- [ ] 4DP: nur die Anzeige am Ende prüfen, wenn du einen Test fährst.

### I. Mac (SR-fa0d80)
- [ ] Die App auf einem Mac in Chrome öffnen (Projekt dort starten, Node.js nötig), Bike und Pulsgurt koppeln. Windows ist durch Abschnitt A bis G belegt.

## Was Claude danach macht

- Liest `docs/m0/live.jsonl` und deine Notizen und trägt die Nachweise ein (`reqseq evidence record … --method demonstration`), nur für das, was bestätigt ist.
- Behebt Fehler, die dabei auffallen, mit einem Test, der den Fehler vorher gezeigt hätte.
- Passt Requirements an, wenn die Praxis etwas anderes zeigt, und fragt dich vorher.

## Validierung der Needs (nur du)

Ob die App das leistet, was du brauchst, bestätigst du selbst, wenn du sie ein paar Mal gefahren bist, zum Beispiel für N1:

```powershell
& "C:\Program Files\ReqSeq\bin\reqseq.cmd" evidence record N-4675b0 validation passed
```

Die anderen Needs: N-da8cbc (Geräte), N-aafb2f (Werte sehen), N-ee7ec7 (Aufzeichnen), N-da1c33 (Auswerten und hochladen), N-05e489 (Fahrer und FTP), N-90dc68 (Plattform).
