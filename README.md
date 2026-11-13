# LaunchRadar 🚀

Raketenstarts live verfolgen – im Stil von Flightradar24. Karte und 3D-Globus mit allen kommenden Starts, geschätzten Flugbahnen, Livestream im Mini-Fenster, echter Telemetrie per Texterkennung, Satelliten (ISS, Starlink, GPS …), Statistik und einer Raketen-Datenbank mit Vergleich.

Der Build erzeugt zwei Varianten:
- `dist/index.html` (~1,2 MB, GitHub Pages): Bibliotheken + Start-Schnappschuss eingebettet, Reserve-Bahndaten und Vorschaubilder als `dist/data/*.json` (nur bei Bedarf geladen, vom Service Worker für offline gespeichert)
- `dist/launchradar-offline.html` (~3,5 MB): **alles in einer Datei** – für die Claude-Vorschau oder zum Öffnen ohne Server

Online lädt die App alles live nach.

**Live:** https://lostfifi.github.io/launch-radar/ – GitHub baut bei jedem Push und jede Nacht mit frischen Daten neu (`.github/workflows/pages.yml`, inkl. `npm test`).

---

## Schnellstart

```bash
npm install          # Bibliotheken (Leaflet, d3-geo, satellite.js, Weltkarte)
npm run build        # src/ + data/ → dist/index.html
npm run watch        # beim Entwickeln: baut bei jeder Änderung in src/ automatisch neu
npm run serve        # http://localhost:8000  (Webserver nötig, sonst blockt YouTube)
npm test             # Smoke-Test: öffnet die App in Edge/Chrome, klickt alles durch (Desktop + Handy)
npm run fetch        # optional: neuen Daten-Schnappschuss laden (~8 API-Abfragen, FULL=1 mit Raketen-DB)
```

Python 3 (+ Pillow) und Node.js werden gebraucht.

## Projektstruktur

| Pfad | Inhalt |
|---|---|
| `src/index.html` | HTML-Gerüst mit Platzhaltern wie `/*APP_JS*/`, `/*LEAFLET_JS*/`, `/*SNAP*/` |
| `src/css/app.css` | Gesamtes Styling |
| `src/js/NNN-*.js` | **Der eigentliche Quellcode**, ein Abschnitt pro Datei. Werden in Namensreihenfolge zusammengefügt und teilen sich den globalen Bereich (wegen `onclick="…"` im HTML) – also **keine** `import`/`export` |
| `scripts/bundle.js` | Fügt `src/js` + `src/css` mit esbuild zusammen (inkl. Syntaxprüfung mit Datei/Zeile) → `build/` |
| `scripts/build.py` | Ersetzt die Platzhalter: App-Code, Bibliotheken, Schnappschuss-Daten, Vorschaubilder → `dist/index.html` |
| `scripts/py.js` | Startet Python 3 auf Windows, macOS und Linux |
| `src/pwa/` | Manifest, Service Worker (`sw.js`), Icons – werden beim Build nach `dist/` kopiert |
| `scripts/make_icons.py` | Erzeugt die App-Icons aus dem Raketen-Symbol |
| `scripts/smoke.js` | Smoke-Test (`npm test`), läuft auch bei GitHub vor jedem Veröffentlichen |
| `src/config.json` | Adresse des eigenen Workers + öffentlicher Push-Schlüssel (leer = ohne Worker) |
| `worker/` | Cloudflare Worker: Daten-Zwischenspeicher + Web Push, Anleitung in `worker/README.md` |
| `scripts/vapid.js` | Erzeugt die Push-Schlüssel für den Worker |
| `.github/workflows/pages.yml` | Veröffentlicht `dist/` bei jedem Push auf GitHub Pages |
| `scripts/fetch_data.sh` | Lädt frische Rohdaten nach `data/raw/` und `data/tle/` |
| `scripts/make_world.js` | Erzeugt `data/world.json` (Ländergrenzen) |
| `data/raw/` | Rohdaten von Launch Library 2: `upcoming.json`, `previous.json`, `cfg_*.json` (Raketen), `y_*.json` (Starts des Jahres) |
| `data/tle/` | Bahndaten (TLE) von CelesTrak: Stationen, Starlink, GNSS |
| `data/img_snap.json` | Eingebettete Vorschaubilder (Base64), Cache – wird beim Build ergänzt |
| `data/world.json` | Weltkarte (GeoJSON) |
| `dist/index.html` | Fertige App (Build-Ergebnis) |

### Platzhalter in `src/index.html`
`/*APP_CSS*/ /*APP_JS*/ /*LEAFLET_CSS*/ /*LEAFLET_JS*/ /*D3_JS*/ /*SAT_JS*/ /*WORLD*/ /*SNAP*/ /*PAST*/ /*ROCKETS*/ /*STATS*/ /*TLE*/ /*IMG*/ /*SNAPTS*/ /*RCUT*/`

### Dateien in `src/js/` (in dieser Reihenfolge)
Icons (SVG) · Konfiguration · Karte · Daten laden · Darstellung/Liste · Detailfenster (`select`) · Bahn-Schätzung (`estimateProfile`, `groundTrack`, `trackPoint`) · Route zeichnen (`drawRoute`, `placeRocket`) · Ausgesetzte Nutzlasten (`payloadPlan`, `updateDeploy`) · Stufen-Karten (`stageCard`, `boosterBlock`, `shipBlock`) · 3D-Globus (d3-geo, Canvas) · Simulierte Zeit · Ebenen & Satelliten (satellite.js/SGP4) · Live-Status · Tag/Nacht · Zeitraffer · Erinnerungen · Vergangene Starts · Objekte eines Starts · Statistik · Raketen-Datenbank & Vergleich · Info-Fenster einklappen · Echte Telemetrie (OCR) · Mini-Fenster · Statistik/DB nachführen + Vollprüfung · Layout & Start.

## Funktionen

**Karte & Globus**
- Leaflet-Karte: Esri Dark Gray (Retina-Kacheln auf hochauflösenden Bildschirmen) + Beschriftungs-Ebene darüber; eingebettete Weltkarte liegt darunter und ist nur offline sichtbar. Satelliten-Zeichenfläche liegt in einer Leaflet-Ebene und macht die Zoom-Animation mit (CARTO bräuchte inzwischen einen API-Schlüssel) und eigener 3D-Globus (d3-geo orthographisch, drehen/zoomen/antippen)
- Startplätze mit Status-Farbe (grün Go, gelb TBD, rot Live/Fehlstart). **Ein Punkt pro Startort** (`buildSites()`: gleicher Standort oder < 40 km, z.B. Cape Canaveral + Kennedy); Klick → Liste mit aufklappbaren Unterkapiteln je Startkomplex (SLC-40, LC-39A …)
- Filter Alle / SpaceX / Starship, Liste (Kommende/Vergangene) mit **Suche, Betreiber- und Länderfilter** (gelten auch für die Karte, gelber Punkt am Liste-Knopf), Countdown zum nächsten Start
- **Verschiebungen** (`045-verschiebungen.js`): jede Startzeit wird gemerkt (`lr_net`), Änderungen als „verschoben +23 h“ angezeigt und bei Erinnerungen gemeldet
- **Link pro Start** `#start=<id>` + Teilen-Knopf (`055-teilen.js`)
- **Wetter am Startplatz** (`095-wetter.js`, Open-Meteo): Wind/Böen, Wolken, Regen, Gewitter-Energie, Höhenwind + Faustregel-Einschätzung
- **Von meinem Standort aus** (`147-start-sichtbar.js`): Richtung, Höhe über Horizont, Zeitfenster, Quallen-Effekt
- **Abos** (`182-abos.js`): Filter abonnieren (Liste → „Abonnieren“), passende Starts bekommen automatisch eine Erinnerung (`lr_subs`); einzeln abgewählte bleiben weg (`lr_rem_off`). Der Worker kennt die Regeln und erkennt neue Starts selbst (`matchRule` in App und Worker gleich halten!)
- **Rückblick** (`062-rueckblick.js`): nach dem Start Ergebnis, Verschiebung, Booster-Landung, Aufzeichnung; mit „Echte Telemetrie“ gemessene Werte werden pro Start gespeichert (`lr_tele`, letzte 8) und neben der Schätzung gezeigt
- **Mond, Mars, L1/L2** (`068-mond-mars.js`): schematische Reise-Ansicht mit Transfer-Ellipse, Position der Sonde (Kepler), Mond-/Planetenpositionen (Näherung), Abflug/Ankunft geschätzt
- Tag/Nacht-Grenze, Zeitraffer-Leiste (1×–3600×) für Satelliten und Tag/Nacht
- Ebenen-Menü: alles einzeln ausschaltbar, Auswahl wird gespeichert

**Startfenster** (auf dem Handy einklappbar: Griff, Wischen, Pfeil)
- Simulation ganz oben: Zeit-Regler, Play, 10×/60×/600×, „Kamera folgt“, „Zum Aussetzen“, „Echte Telemetrie“
- Foto + Missions-Patch, Livestream (Mini-Fenster), Countdown, Erinnerung (10 Min vorher)
- Missionsprofil, Booster- und Ship/Raumschiff-Karte mit **identischem Steckbrief-Raster**, Live-Updates, Timeline, Objekte im Orbit, Route & Bahn

**Bahnen** (Schätzung – keine offiziellen Positionsdaten!)
- Kreisbahn-Bodenspur mit Erdrotation; Neigung aus Missionsdaten/Faustregeln (ISS 51,6°, SSO 97,6°, Starlink-Gruppen, Vandenberg 70° Süd …)
- **Aufstiegsprofile je Rakete** (`065-aufstiegsprofile.js`): Falcon 9, Falcon Heavy, Starship, Electron, Vulcan/Atlas, Ariane 6, Sojus, LVM3, Langer Marsch (+ chinesische Kleinraketen), H3, New Glenn, sonst typisches Profil. Je Zeit → Höhe, Tempo, Bodendistanz + Ereignisse (Max-Q, MECO, SECO …), an MECO/SECO aus der Timeline des Starts angepasst. Detailfenster „Aufstieg (geschätzt)“, Kartenzeile zeigt geschätzte Höhe/Tempo, Telemetrie-Diagramm zeigt die Schätzung gestrichelt zum Vergleich
- `distAt()`: Aufstieg aus dem Profil, danach Orbitgeschwindigkeit
- **Startrichtung** aus Bahnneigung und Breite, korrigiert um die Erddrehung; Polar/SSO ab Florida, China, Indien nach Süden
- Jeder Orbit eigene Farbe, durchgezogen; blass = kommend, kräftig = geflogen
- **Starship**: Anzahl Orbits + Höhe aus Beschreibung; Rückkehr: Umlaufzeit/Neigung werden so gesucht, dass die Bahn zur Catch-Zeit (Timeline) über Starbase liegt, ab Deorbit-Burn weicher Übergang zum Turm
- Suborbitale Starship-Flüge: Wasserung Indischer Ozean
- **Nutzlasten**: Anzahl aus Beschreibung, Aussetz-Zeiten aus Timeline (sonst geschätzt), pinke Punkte hinter der Rakete (Abstand bewusst vergrössert)
- **Oberstufe**: Falcon 9 LEO → Deorbit + Wiedereintritt (orange Raute); GTO/GEO → bleibt im Orbit; Mond/Mars → verlässt Erde
- **Booster**: Landezonen/Drohnenschiffe, Einweg → Absturz (graue Raute); Schiffe/Wiedereintritte werden von Land ins Meer geschoben (`onLand` mit d3.geoContains)

**Livestream & Telemetrie**
- YouTube im verschiebbaren Mini-Fenster (nur wenn über http(s) ausgeliefert – YouTube blockt `file://`)
- Telemetrie per Tesseract.js (lädt von jsDelivr): „Diesen Tab teilen“ (`getDisplayMedia` mit `preferCurrentTab`) → Bereich wird aus der Lage des Mini-Fensters berechnet (Stufe 2 unten rechts / Stufe 1 unten links). Alternativ manuell: anderer Tab + Rahmen ziehen
- Plausibilitätsfilter, Bodendistanz aus √(v² − (dh/dt)²) integriert → Rakete bewegt sich nach Messwerten
- **Stufe 1 und Stufe 2 gleichzeitig** (je eigener Bereich, eigene Grenzen; Stufe 1 abschaltbar), Steigrate Stufe 1
- **Diagramme** Höhe und Tempo über T+ für beide Stufen, **CSV-Export**; nach Ende des Teilens bleiben die Diagramme stehen

**Satelliten** (CelesTrak TLE, SGP4 via satellite.js)
- Raumstationen (ISS/Tiangong mit Symbol), Starlink (~10 600), GNSS, Wetter (nur online)
- Klick → Höhe, Tempo, Bahn der nächsten ~90 min; „Objekte eines Starts“ über COSPAR-Kennung
- **Überflüge bei mir** (`145-ueberfluege.js`): Standort per GPS oder Klick (gerundet ~1 km, nur `localStorage` `lr_home`), ISS/Tiangong-Überflüge der nächsten 10 Tage. Sichtbar = Station beleuchtet (Erdschatten-Zylinder), Sonne beim Beobachter < −6°, Höhe ≥ 10°. Himmelskarte je Überflug, Erinnerung 10 Min vorher, „Zeigen“ springt im Zeitraffer hin. Ebene „Standort & ISS-Sichtkreis“

**Deutsch / Englisch** (`005-i18n.js`, Wörterbuch `004-i18n-en.js`)
- Sprache nach Browser (de* = Deutsch, sonst Englisch), Umschalter im Ebenen-Menü, Link `?lang=en` / `?lang=de`
- Eine Übersetzungs-Schicht übersetzt alle angezeigten Texte (exakt oder per Muster mit Platzhaltern); API-Texte (Missionsbeschreibungen) bleiben englisch
- Datum/Zahlen im Sprachformat (`LOC`), Push-Texte von Service Worker und Worker ebenfalls zweisprachig
- `node scripts/i18n-harvest.js` listet fehlende Übersetzungen, `npm test` prüft beide Sprachen

**App (PWA)** (`src/pwa/`, `285-pwa.js`)
- Installierbar (Manifest, Icons aus `scripts/make_icons.py`), startet offline (Service Worker: Seite zuerst aus dem Netz, sonst aus dem Cache)
- Benachrichtigungen über den Service Worker (nötig auf Android), Test-Knopf im Ebenen-Menü
- Erinnerungen werden als `rem.json` im Cache `lr-data` abgelegt; installiert in Chrome/Edge prüft der Service Worker sie per Periodic Background Sync auch bei geschlossener App (Zeitpunkt bestimmt der Browser, nicht garantiert). Echte Push-Nachrichten bräuchten einen Server (z.B. Cloudflare Worker)

**Statistik & Raketen-Datenbank**
- Statistik des Jahres (Kacheln, pro Monat, Betreiber, Land, Rakete)
- 527 Raketen, sortier-/filterbar, Vergleich von bis zu 4 Raketen
- Aktualisierung: Nachführen nach jedem Start (1 Abfrage), Statistik täglich und DB wöchentlich komplett neu (zeitversetzt 1,5 / 6 Min nach Öffnen)

## Datenquellen & Limits

| Quelle | Nutzung | Limit / Cache |
|---|---|---|
| The Space Devs – Launch Library 2 (`ll.thespacedevs.com/2.3.0`) | Starts, Raketen, Booster, Statistik | **~15 Abfragen/Stunde gratis** → Starts 15 min, Vergangene 1 h, Live-Status 5 min, Nachführen 3 h, Vollprüfung 24 h / 7 Tage. Fallback `lldev.thespacedevs.com` |
| CelesTrak (`celestrak.org`) | TLE-Bahndaten | Cache 2 h |
| Esri World Dark Gray | Kartenkacheln (online) | – |
| jsDelivr | Tesseract.js für OCR | nur bei Telemetrie |

Alles wird nur im Browser (`localStorage`) zwischengespeichert. Schlüssel: `lr_cache`, `lr_past`, `lr_layers`, `lr_rem`, `lr_tle_*`, `lr_inc`, `lr_full_stats`, `lr_full_db`.

## Bekannte Grenzen

- **API-Limit:** Bei Sperre (429) nutzt die App zuerst ihren eigenen Cache der echten API (bis 12 h), erst dann den dev-Server. Der dev-Server ist eine Testkopie und oft Tage alt – Verschiebungen fehlen dort. Quelle und Stand stehen im Live-Banner (`dataInfo()`).
- **Start nicht bestätigt:** Nach T-0 fliegt die Rakete nur mit, wenn der Status „In Flight“/„Success“ ist (oder kurz nach T-0 mit frischen echten Daten „Go“). Sonst gelbes Banner „Start nicht bestätigt – evtl. verschoben“ (`launchState()`).
- Flugbahnen sind **Schätzungen** (keine öffentliche Echtzeit-Position während des Aufstiegs). FlightClub.io ist präziser.
- Telemetrie nur am Computer (Chrome/Edge), Browser verlangt jedes Mal eine Bestätigung zum Teilen; X-Streams nicht einbettbar.
- Erinnerungen sind nur bei offener App zuverlässig; im Hintergrund (installierte App, Chrome/Edge) entscheidet der Browser, wann geprüft wird. Keine echten Push-Nachrichten (bräuchte einen Server).
- CelesTrak katalogisiert neue Objekte mit Verzögerung → „Objekte eines Starts“ oft erst nach Tagen.
- Höhe der 1. Stufe nur für Starship (berechnet), Falcon 9/Heavy (41,2 m), New Glenn (57,5 m).
- Claude-Artifacts blockieren externe Abfragen und iframes → dort nur Schnappschuss.

## Ideen / nächste Schritte

1. ~~Auf GitHub Pages veröffentlichen~~ – erledigt: https://lostfifi.github.io/launch-radar/
2. ~~`template.html` in Module aufteilen, Build mit esbuild~~ – erledigt (`src/js/`)
3. ~~PWA~~ – erledigt (installierbar, offline, Benachrichtigungen, Hintergrund-Prüfung). **Cloudflare Worker** läuft: https://launch-radar.lostfifi.workers.dev (`/launches`, `/status`). Daten ohne API-Limit für alle Nutzer + echte Push-Nachrichten. Bei Sperre der Launch Library wartet er die Sperrzeit ab und nutzt solange den GitHub-Schnappschuss (`dist/data/upcoming.json`). Änderungen am Worker: `cd worker && node test.js && npx wrangler@3 deploy`
4. ~~Bessere Bahnen: Startazimut, Aufstiegskurven je Rakete~~ – erledigt mit eigenem Modell (FlightClub hat keine freie API). Weiter möglich: Dogleg-Manöver, Profile für Long March / H3 / New Glenn
5. ~~Satelliten-Überflüge für den eigenen Standort~~ – erledigt (Ebenen-Menü → „ISS-Überflüge bei mir“)
6. ~~Telemetrie auch für Stufe 1 gleichzeitig, Diagramme Höhe/Tempo über Zeit~~ – erledigt
