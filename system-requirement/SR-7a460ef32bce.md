---
id: 0a1c9514-159c-419e-b80b-7a460ef32bce
type: system-requirement
status: draft
title: Distanz und Geschwindigkeit in der .fit-Datei
requirement-type: functional
acceptance-criteria:
  - key: kv6q
    text: Given eine aufgezeichnete Fahrt mit Geschwindigkeit je Sekunde, when die .fit-Datei erzeugt wird, then enthält jeder Datensatz Distanz und Geschwindigkeit, und die Fahrt enthält Gesamtdistanz, mittlere und höchste Geschwindigkeit, die zu den aufgezeichneten Geschwindigkeiten passen (Abweichung höchstens 1 %).
verification-method: test
derives-from:
  - { id: c826e6f8-2592-4629-bf3c-1e879bee7ec7, version: n2:f7ebe0b72fc33674, title: Training aufzeichnen und sicher speichern }
---

Das System muss in der .fit-Datei die zurückgelegte Distanz und die Geschwindigkeit mitschreiben: je Datensatz Distanz und Geschwindigkeit, je Fahrt Gesamtdistanz sowie mittlere und höchste Geschwindigkeit. Damit kann Strava die gefahrenen Kilometer für die Jahresstatistik übernehmen. Eine Anzeige der Kilometer im Fenster ist nicht verlangt. (Wunsch von Stefan, 2026-11-21.) Annahme, unbestätigt: Die Geschwindigkeit, die das Bike meldet (virtuelle Geschwindigkeit), genügt für Strava. Ob Strava die Aktivität mit Distanz zählt, ist nach dem Upload zu prüfen.
