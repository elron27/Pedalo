---
id: 465a5e00-8011-4367-863b-fde02ae32fa8
type: system-requirement
status: draft
title: Gastmodus ohne Profil und ohne Konten
requirement-type: functional
acceptance-criteria:
  - key: r0yj
    text: Given kein Profil ist gewählt, when der Fahrer den Gastmodus startet und einen FTP-Wert eintippt, then kann er ein Training fahren, und es wird kein Upload angeboten.
verification-method: test
derives-from:
  - { id: 9657d887-9179-4ab0-89ce-a8d1a905e489, version: n2:c0ee522d161052f3, title: Fahrer und FTP }
---

Das System muss einen Gastmodus bieten: sofort fahren ohne Profil und ohne Konten, alle Werte (z. B. FTP) von Hand eingeben. Der Upload entfällt. (Bestätigt.)
