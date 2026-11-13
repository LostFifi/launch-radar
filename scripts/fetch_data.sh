#!/usr/bin/env bash
# Lädt einen neuen Daten-Schnappschuss (Fallback für offline / Claude-Vorschau).
# Achtung: Die Gratis-API von The Space Devs erlaubt ca. 15 Abfragen pro Stunde.
#   bash scripts/fetch_data.sh          Starts + Statistik + Bahndaten (~8 API-Abfragen)
#   FULL=1 bash scripts/fetch_data.sh   zusätzlich Raketen-Datenbank (+6 Abfragen)
# Schlägt eine Abfrage fehl (z.B. API-Limit), bleibt die alte Datei erhalten – das Skript bricht nicht ab.
cd "$(dirname "$0")/.."
mkdir -p data/raw data/tle
LL=https://ll.thespacedevs.com/2.3.0
Y=$(date +%Y)
FAILED=0
get(){
  echo "→ $2"
  local ok=1
  if curl -sf -m 90 -o "$2.tmp" "$1" && [ -s "$2.tmp" ]; then mv "$2.tmp" "$2"; ok=0
  else rm -f "$2.tmp"; echo "  fehlgeschlagen – behalte alte Datei"; FAILED=$((FAILED+1)); fi
  sleep 2; return $ok
}
get "$LL/launches/upcoming/?limit=40&mode=detailed" data/raw/upcoming.json && date -u +%Y-%m-%dT%H:%M:%SZ > data/raw/fetched_at.txt
get "$LL/launches/previous/?mode=detailed&limit=40" data/raw/previous.json
if [ "${FULL:-0}" = "1" ]; then
  for o in 0 100 200 300 400 500; do get "$LL/launcher_configurations/?mode=detailed&limit=100&offset=$o" data/raw/cfg_$o.json; done
fi
for o in 0 100 200; do get "$LL/launches/previous/?mode=normal&limit=100&offset=$o&net__gte=$Y-01-01T00:00:00Z" data/raw/y_$o.json; done
for g in stations starlink gnss; do get "https://celestrak.org/NORAD/elements/gp.php?GROUP=$g&FORMAT=tle" data/tle/$g.txt; done
echo "Fertig ($FAILED fehlgeschlagen). Jetzt: npm run build"
