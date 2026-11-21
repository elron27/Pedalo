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
