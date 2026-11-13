#!/usr/bin/env bash
# Lädt einen neuen Daten-Schnappschuss (Fallback für offline / Claude-Vorschau).
# Achtung: Die Gratis-API von The Space Devs erlaubt ca. 15 Abfragen pro Stunde – dieses Skript braucht ~12.
set -e
cd "$(dirname "$0")/.."
LL=https://ll.thespacedevs.com/2.3.0
Y=$(date +%Y)
get(){ echo "→ $2"; curl -sf -m 90 -o "$2" "$1"; sleep 2; }
get "$LL/launches/upcoming/?limit=40&mode=detailed" data/raw/upcoming.json
get "$LL/launches/previous/?mode=detailed&limit=40" data/raw/previous.json
for o in 0 100 200 300 400 500; do get "$LL/launcher_configurations/?mode=detailed&limit=100&offset=$o" data/raw/cfg_$o.json; done
for o in 0 100 200; do get "$LL/launches/previous/?mode=normal&limit=100&offset=$o&net__gte=$Y-01-01T00:00:00Z" data/raw/y_$o.json; done
for g in stations starlink gnss; do get "https://celestrak.org/NORAD/elements/gp.php?GROUP=$g&FORMAT=tle" data/tle/$g.txt; done
echo "Fertig. Jetzt: npm run build"
