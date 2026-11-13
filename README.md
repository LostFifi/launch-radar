# LaunchRadar 🚀

Raketenstarts live verfolgen – im Stil von Flightradar24. Karte und 3D-Globus mit allen kommenden Starts, geschätzten Flugbahnen, Livestream im Mini-Fenster, echter Telemetrie per Texterkennung, Satelliten (ISS, Starlink, GPS …), Statistik und einer Raketen-Datenbank mit Vergleich.

Die fertige App ist **eine einzige HTML-Datei** (`dist/index.html`, ~3,5 MB) – alle Bibliotheken und ein Daten-Schnappschuss sind eingebettet, damit sie auch offline bzw. in Vorschauen (Claude-App) läuft. Online lädt sie alles live nach.

---

## Schnellstart

```bash
npm install          # Bibliotheken (Leaflet, d3-geo, satellite.js, Weltkarte)
npm run build        # src/ + data/ → dist/index.html
npm run watch        # beim Entwickeln: baut bei jeder Änderung in src/ automatisch neu
npm run serve        # http://localhost:8000  (Webserver nötig, sonst blockt YouTube)
npm run fetch        # optional: neuen Daten-Schnappschuss laden (~12 API-Abfragen!)
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
- Leaflet-Karte (Esri Dark Gray online, eingebettete Weltkarte offline) und eigener 3D-Globus (d3-geo orthographisch, drehen/zoomen/antippen)
- Startplätze mit Status-Farbe (grün Go, gelb TBD, rot Live/Fehlstart), Gruppierung pro Startplatz
- Filter Alle / SpaceX / Starship, Liste (Kommende/Vergangene), Countdown zum nächsten Start
- Tag/Nacht-Grenze, Zeitraffer-Leiste (1×–3600×) für Satelliten und Tag/Nacht
- Ebenen-Menü: alles einzeln ausschaltbar, Auswahl wird gespeichert

**Startfenster** (auf dem Handy einklappbar: Griff, Wischen, Pfeil)
- Simulation ganz oben: Zeit-Regler, Play, 10×/60×/600×, „Kamera folgt“, „Zum Aussetzen“, „Echte Telemetrie“
- Foto + Missions-Patch, Livestream (Mini-Fenster), Countdown, Erinnerung (10 Min vorher)
- Missionsprofil, Booster- und Ship/Raumschiff-Karte mit **identischem Steckbrief-Raster**, Live-Updates, Timeline, Objekte im Orbit, Route & Bahn

**Bahnen** (Schätzung – keine offiziellen Positionsdaten!)
- Kreisbahn-Bodenspur mit Erdrotation; Neigung aus Missionsdaten/Faustregeln (ISS 51,6°, SSO 97,6°, Starlink-Gruppen, Vandenberg 70° Süd …)
- **Aufstiegsprofile je Rakete** (`065-aufstiegsprofile.js`): Falcon 9, Falcon Heavy, Starship, Electron, Vulcan/Atlas, Ariane 6, Sojus, LVM3, sonst typisches Profil. Je Zeit → Höhe, Tempo, Bodendistanz + Ereignisse (Max-Q, MECO, SECO …), an MECO/SECO aus der Timeline des Starts angepasst. Detailfenster „Aufstieg (geschätzt)“, Kartenzeile zeigt geschätzte Höhe/Tempo, Telemetrie-Diagramm zeigt die Schätzung gestrichelt zum Vergleich
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

- Flugbahnen sind **Schätzungen** (keine öffentliche Echtzeit-Position während des Aufstiegs). FlightClub.io ist präziser.
- Telemetrie nur am Computer (Chrome/Edge), Browser verlangt jedes Mal eine Bestätigung zum Teilen; X-Streams nicht einbettbar.
- Erinnerungen funktionieren nur, solange die Seite offen ist (keine echten Push-Nachrichten).
- CelesTrak katalogisiert neue Objekte mit Verzögerung → „Objekte eines Starts“ oft erst nach Tagen.
- Höhe der 1. Stufe nur für Starship (berechnet), Falcon 9/Heavy (41,2 m), New Glenn (57,5 m).
- Claude-Artifacts blockieren externe Abfragen und iframes → dort nur Schnappschuss.

## Ideen / nächste Schritte

1. ~~Auf GitHub Pages veröffentlichen~~ – erledigt: https://lostfifi.github.io/launch-radar/
2. ~~`template.html` in Module aufteilen, Build mit esbuild~~ – erledigt (`src/js/`)
3. PWA mit echten Push-Benachrichtigungen (Service Worker – geht nur gehostet)
4. ~~Bessere Bahnen: Startazimut, Aufstiegskurven je Rakete~~ – erledigt mit eigenem Modell (FlightClub hat keine freie API). Weiter möglich: Dogleg-Manöver, Profile für Long March / H3 / New Glenn
5. ~~Satelliten-Überflüge für den eigenen Standort~~ – erledigt (Ebenen-Menü → „ISS-Überflüge bei mir“)
6. ~~Telemetrie auch für Stufe 1 gleichzeitig, Diagramme Höhe/Tempo über Zeit~~ – erledigt
