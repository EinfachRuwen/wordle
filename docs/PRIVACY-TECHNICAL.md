# Technische Datenschutz-Dokumentation

Stand: 18.11.2026 · gehört zu `datenschutz/index.html` (öffentlich unter `/datenschutz/`).
Diese Datei und `CLAUDE.md` werden nicht deployt (`.vercelignore`).

## Hosting und Auslieferung (ermittelt, nicht vollständig aus dem Repo ableitbar)

| Punkt | Befund | Beleg |
|---|---|---|
| Hoster | Vercel Inc. (Git-Integration: `vercel[bot]` legt Production- und Preview-Deployments an) | GitHub-Deployments-API des Repos; Antwort-Header `server: Vercel`, `x-vercel-id`, `x-vercel-cache` |
| Produktiv-Domain | `wordle-kappa-puce.vercel.app` (Repo-Homepage). Keine eigene Domain bekannt | `curl -I` am 18.11.2026 → 200, `server: Vercel` |
| Proxy/CDN davor | keiner erkennbar (keine Cloudflare-Header), nur Vercel-Edge | Header-Auswertung 18.11.2026 |
| Weiterleitungen | keine | `curl -I` |
| Konfiguration | `vercel.json`: Catch-all-Rewrite `/(.*)` → `/index.html` (unbekannte Pfade liefern das Spiel mit 200). Statische Dateien haben Vorrang vor dem Rewrite, daher wird `datenschutz/index.html` unter `/datenschutz/` ausgeliefert. Keine Functions (`api/`), keine Middleware, kein Build-Schritt, kein `package.json` | `vercel.json:1-5`, Repo-Inhalt |
| Response-Header | nur `strict-transport-security`; keine CSP, keine `Referrer-Policy` (Browser-Default `strict-origin-when-cross-origin`) | Header-Auswertung |
| Live-Prüfung | Headless-Chromium auf Produktion am 18.11.2026: alle Requests nur an `wordle-kappa-puce.vercel.app` (HTML, `fonts.css`, `style.css`, `app.js`, `fonts/Inter-latin.woff2`, `favicon.ico` → per Rewrite `index.html`); 0 Cookies; localStorage/sessionStorage/IndexedDB/Cache Storage leer; kein Service Worker | Audit-Skript, Link-Modus + Klassik-Modus durchgespielt |

## Verarbeitungen

| # | Verarbeitung | Daten | Fundstelle | Rechtsgrundlage | Speicherdauer |
|---|---|---|---|---|---|
| 1 | Auslieferung durch Vercel, Request-/Server-Logs | IP, Zeit, Host, Pfad + Query (bei Spiellinks `g` und `iv`), Status, Referrer, User-Agent, aus IP abgeleiteter Ort | Hosting (s. o.) | Art. 6 Abs. 1 lit. f DSGVO | Vercel-Dashboard: Hobby 1 h, Pro 1 Tag (Runtime Logs; statische Requests nur teilweise sichtbar). Vercel-intern: nicht konkret veröffentlicht |
| 2 | Drittlandübermittlung USA | wie 1 | – | Art. 45 DSGVO (EU-US DPF, Vercel Inc. „Active“, nächste Rezertifizierung 29.04.2027, dataprivacyframework.gov/participant/6847) | – |
| 3 | Spiellink-Verschlüsselung | geheimes Wort → AES-256-GCM, zufälliger Schlüssel + 12-Byte-IV; Link `/?g=<Chiffrat>&iv=<IV>#<Schlüssel>` (Base64url) | `app.js:73-88` (verschlüsseln), `app.js:102-105` (Link bauen), `app.js:501-520` (Button) | lokal | – |
| 3a | Was der Server sieht | nur `g` (Chiffrat inkl. 16-Byte-GCM-Tag) und `iv` als Query; Fragment (Schlüssel) wird vom Browser nie gesendet. Chiffratlänge = UTF-8-Länge des Worts + 16 Byte → Wortlänge (Umlaute 2 Byte) ableitbar, Inhalt nicht | `app.js:104`; live geprüft („KÄSE1“ → 22 Byte Chiffrat) | Art. 6 Abs. 1 lit. f (als Teil von #1) | wie 1 |
| 3b | Link öffnen | Entschlüsselung lokal; danach `history.replaceState` entfernt das Fragment, `?g&iv` bleiben in der Adresszeile; bei ungültigem Link wird die Query entfernt | `app.js:90-100`, `app.js:107-112`, `app.js:643-662` | lokal | – |
| 4 | Wortliste Klassik-Modus | ~250 deutsche 5-Buchstaben-Wörter als Konstante im Code; Auswahl per `Math.random()` im Browser | `app.js:25-55`, `app.js:611-619` | keine Übertragung | – |
| 5 | Spielstand | Objekt `S` (Wort, Versuche, Buchstabenstatus, Modus) nur im Arbeitsspeicher; Modus „Gleiches Gerät“ hält das Wort ebenfalls nur in `S` | `app.js:8-20`, `app.js:486-498` | lokal, nicht persistent | bis Neuladen/Schließen des Tabs |
| 6 | Statistiken | keine (keine Serien, Bestwerte, Historie) | grep: kein Storage-Zugriff | – | – |
| 7 | Zwischenablage (nur schreiben, nur auf Klick) | Spiellink bzw. Ergebnis-Text (Score, Emoji-Raster, `origin+pathname`, ohne Wort) | `app.js:523-539`, `app.js:582-592` | lokal | – |
| 8 | Eingaben/Events | Texteingabe (Filter auf A–Z, ÄÖÜ, 0–9), physische Tastatur, `confirm()` beim Abbrechen, Fenstergröße für Kachelgröße | `app.js:472-483`, `app.js:624-632`, `app.js:566`, `app.js:297-302`, `app.js:573-575` | lokal, nichts gespeichert | – |
| 9 | Schrift Inter | selbst gehostet, `fonts/Inter-latin.woff2`, `fonts/Inter-latin-ext.woff2`, Lizenz `fonts/OFL-inter.txt` (SIL OFL 1.1) | `fonts.css:1-97`, `index.html:14`, `datenschutz/index.html:11` | keine Drittanbieter | – |
| 10 | Externe Links (kein Laden vor Klick) | `https://fcrw.cc/imprint` (302 → focusonruwen.com/impressum/), `https://vercel.com/legal/privacy-notice` | `index.html:109-112`; `datenschutz/index.html:57`, `:126` | – | – |
| 11 | E-Mail-Kontakt | mailto-Link nur auf der Datenschutzseite | `datenschutz/index.html:40`, `:105` | Art. 6 Abs. 1 lit. f | bis Anfrage erledigt |

Nicht vorhanden (per grep und live geprüft): Cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, Service Worker/PWA-Manifest, fetch/XHR/sendBeacon, Analytics (kein Umami, keine Vercel Web Analytics/Speed Insights), Formular-Submits, Auth, Datenbank/Backend, iframes/Embeds, externe Skripte/Fonts/Bilder/CDNs.

## Google Fonts

Inter wurde früher von Google Fonts geladen und ist seit Commit `9024bae` („Inter lokal hosten statt Google Fonts“, PR #1) selbst gehostet. Am 18.11.2026 geprüft: keine Referenz auf `fonts.googleapis.com`/`fonts.gstatic.com` mehr im Repo und keine Requests dorthin auf der Live-Seite. Im Branch `datenschutz` ergänzt: Lizenzdatei `fonts/OFL-inter.txt` (die OFL verlangt, dass die Lizenz mit den Schriftdateien weitergegeben wird) und ein korrigierter Kommentar in `index.html:13` (vorher „preconnect for speed“). Neue Schriften nur lokal einbinden, Lizenz daneben ablegen.

## Bisherige Datenschutzlinks

Vor diesem Branch gab es keinen Datenschutz- oder Impressum-Link im Repo (auch keinen auf fcrw.cc/privacy). Jetzt: Footer der Startseite (`index.html:109-112`) und der Datenschutzseite.

## Rechtliches Gerüst der Erklärung

- Verantwortlicher: wie Impressum (`https://fcrw.cc/imprint` → 302 → `https://focusonruwen.com/impressum/`) und zentrale Erklärung (`https://fcrw.cc/privacy` → `https://focusonruwen.com/datenschutz/`, Stand 15.11.2026); beide stimmen überein.
- Betroffenenrechte Art. 15–18, 20; Widerspruch Art. 21 hervorgehoben (Callout); Beschwerde Art. 77 ohne konkrete Behörde.
- Keine Speicherung/kein Auslesen auf dem Endgerät → § 25 TDDDG nicht einschlägig, kein Cookie-Banner. Keine Einwilligungen → kein Widerruf nach Art. 7 Abs. 3.
- Keine automatisierte Entscheidung (Art. 22); keine Bereitstellungspflicht.

## Offene Punkte

1. **Vercel-Tarif / AVV:** Das Vercel-DPA gilt laut Abschnitt 1 nur für Pro- und Enterprise-Kunden (https://vercel.com/legal/dpa). Im Hobby-Tarif gibt es keinen Auftragsverarbeitungsvertrag nach Art. 28 DSGVO. Tarif im Dashboard prüfen; die Erklärung formuliert deshalb neutral („verarbeitet Vercel“), nicht „im Auftrag“.
2. **Log-Aufbewahrung bei Vercel intern:** nicht konkret veröffentlicht; die Erklärung verweist auf Vercels Angaben.
3. **Aufsichtsbehörde:** Die zentrale Erklärung nennt die LfD Niedersachsen; Entscheidung zwischen LfD Niedersachsen und LDI NRW steht noch aus → hier nur Art. 77 allgemein.
4. **Zentrale Erklärung:** nennt dieses Spiel nicht im Geltungsbereich; ggf. dort ergänzen oder auf `/datenschutz/` dieser Seite verweisen.
5. **Hinweistext im Link-Kasten** (`index.html:88-91`): „Das Wort … wird nie an den Server gesendet“ stimmt für das Klartext-Wort und den Schlüssel; das Chiffrat geht als Query an den Server (Punkt 3a). Optional präzisieren.

## Pflege

Bei jeder Änderung, die Daten oder den Browser berührt, diese Datei **und** `datenschutz/index.html` (inkl. Stand-Datum) prüfen und anpassen. Siehe `CLAUDE.md`.
