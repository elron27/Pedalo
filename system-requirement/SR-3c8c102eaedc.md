---
id: 671d0b4c-6ce0-4770-b330-3c8c102eaedc
type: system-requirement
status: draft
title: Restzeit des gesamten Trainings anzeigen
requirement-type: functional
acceptance-criteria:
  - key: xnf9
    text: Given ein laufendes Training mit festen Blockdauern von zusammen 70 Minuten, when 10 Minuten vergangen sind, then zeigt das System 60:00 als Restzeit des gesamten Trainings; während der Pause läuft sie nicht weiter; bei einem Training mit offenem Block zeigt das System statt einer Zeit „offen“.
verification-method: test
derives-from:
  - { id: ef78473c-283b-4f70-9633-7eb60aaafb2f, version: n2:0c7c26ce44cc9885, title: Werte während des Trainings sehen }
---

Das System muss während der Fahrt die verbleibende Dauer des gesamten Trainings anzeigen. Bei einem Training mit offenem Block ist sie nicht bekannt; das System zeigt dann statt einer Zeit an, dass sie offen ist. (Beobachtung von Stefan bei der ersten ganzen Fahrt, 2026-11-21: Es gab nur die Restzeit des Blocks und die verstrichene Gesamtzeit.)
