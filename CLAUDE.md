# CLAUDE.md

Statisches Browser-Spiel (HTML, CSS, JS ohne Framework und ohne Build-Schritt), deployt auf Vercel; `vercel.json` hat einen Catch-all-Rewrite auf `index.html`. Keine Tracker, keine Drittanbieter-Requests, Schriften selbst gehostet (Lizenzdatei neben die Schriftdatei in `fonts/`).

## Datenschutz

- Die Datenschutzerklärung liegt in `datenschutz/index.html` (ausgeliefert unter `/datenschutz/`), die technische Dokumentation in `docs/PRIVACY-TECHNICAL.md`.
- **Bei jeder Änderung, die personenbezogene Daten oder den Browser berührt** (neue externe Ressource, Skript, Schrift, Bild oder Embed; Analytics; Cookies, localStorage, sessionStorage, IndexedDB, Service Worker; Spielstände oder Statistiken speichern; fetch/Beacon/APIs; Formulare oder mailto; Aufbau der Spiellinks bzw. Verschlüsselung; Response-Header; Hosting, Domains, Weiterleitungen oder Rewrites; Vercel Analytics/Speed Insights/Functions/Middleware): beide Dateien prüfen und in derselben Änderung aktualisieren, inklusive Stand-Datum und Datei:Zeile-Verweisen.
- `/datenschutz/` muss direkt erreichbar bleiben; der Catch-all-Rewrite darf die Seite nicht verschlucken.
- Die Startseite muss Links auf das Impressum (`https://fcrw.cc/imprint`) und auf `/datenschutz/` behalten.
- `docs/` und diese Datei werden nicht deployt (`.vercelignore`).
