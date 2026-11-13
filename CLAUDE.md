# CLAUDE.md – Hinweise für Claude Code

Projekt von Fionn: **LaunchRadar**, Raketenstart-Tracker im Flightradar-Stil. Ausführliche Doku: `README.md`.

## Sprache & Stil
- Antworten und UI-Texte auf **Deutsch (Schweiz, kein ß → ss)**.
- Fionn mag **kurze, strukturierte Antworten** (Stichpunkte, Tabellen).
- Design: dunkel, professionell, **keine Emojis** in der Oberfläche (eigene SVG-Icons in `ICON`, Raketen-Symbol `RK_PATH`).

## Arbeitsweise
- Quellcode ist `src/js/NNN-*.js` (klassische Scripts, gemeinsamer globaler Bereich, kein import/export), `src/css/app.css`, `src/index.html`. **Nie** `dist/index.html` direkt bearbeiten – immer `npm run build`.
- Neue Datei in `src/js/` → Nummer so wählen, dass sie nach allem kommt, was sie beim Laden braucht.
- Nach Änderungen: bauen, mit `npm run serve` lokal öffnen, auf Desktop **und** Handy-Breite (≤ 799 px) prüfen.
- Die App muss **offline** (eingebetteter Schnappschuss) und **online** (Live-Daten) funktionieren. Jeder Fetch braucht einen Fallback.
- **API-Limit beachten**: Launch Library 2 gratis ≈ 15 Abfragen/Stunde. Neue Abfragen nur mit Cache (`localStorage`) und zeitversetzt.
- Geschätzte Werte immer als „geschätzt“ kennzeichnen, gemessene als „gemessen“.
- Alles Neue soll im Ebenen-Menü ausschaltbar sein, wenn es auf der Karte erscheint.

## Wichtige Funktionen in src/js/
- `estimateProfile(l)` – Bahn, Neigung, Orbits, Landungen, Oberstufe, Starship-Rückkehr
- `groundTrack()`, `trackPoint()`, `distAt()`, `pointAt()` – Bahnmathematik
- `drawRoute()`, `placeRocket(t)` – Karte; Globus in `gDraw()`
- `payloadPlan()`, `updateDeploy()` – ausgesetzte Satelliten
- `select(l)` – Detailfenster; `stageCard()` – einheitlicher Booster/Ship-Steckbrief
- `teleAuto()`, `teleTick()`, `teleParse()` – OCR-Telemetrie; `openPip()` – Mini-Fenster
- `refreshCounts()`, `fullStats()`, `fullDB()` – Statistik/DB aktuell halten

## Offene Wünsche
Siehe „Ideen / nächste Schritte“ im README. Live: https://lostfifi.github.io/launch-radar/ (Push auf master veröffentlicht automatisch).
