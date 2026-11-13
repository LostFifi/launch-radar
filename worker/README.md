# LaunchRadar-Worker (Cloudflare, gratis)

Ein kleiner Server, der zwei Probleme löst:

| Problem | Lösung |
|---|---|
| API-Limit (~15 Abfragen/h pro Internetanschluss) | Der Worker fragt alle 5 Min für **alle** Nutzer zusammen ab (12/h). Die App fragt nur noch den Worker. |
| Erinnerungen nur bei offener App | Der Worker schickt 10 Min vor dem Start eine **echte Push-Nachricht** – auch bei geschlossener App, auch bei Verschiebungen. |

Solange `src/config.json` leer ist, läuft die App genau wie bisher ohne Worker.

## Einrichten (ca. 10 Minuten, einmalig)

1. **Konto:** Auf <https://dash.cloudflare.com/sign-up> gratis registrieren (Kreditkarte nicht nötig).
2. **Anmelden** (im Ordner `worker/`):
   ```bash
   npx wrangler@3 login
   ```
3. **Speicher anlegen** und die ausgegebene `id` in `wrangler.toml` bei `HIER_KV_ID_EINTRAGEN` eintragen:
   ```bash
   npx wrangler@3 kv namespace create LR
   ```
4. **Push-Schlüssel erzeugen** (im Hauptordner):
   ```bash
   node scripts/vapid.js
   ```
5. **Schlüssel im Worker hinterlegen** (im Ordner `worker/`, jeweils Wert einfügen):
   ```bash
   npx wrangler@3 secret put VAPID_PUBLIC
   ```
   ```bash
   npx wrangler@3 secret put VAPID_PRIVATE_JWK
   ```
   Der private Schlüssel gehört **nur** hierhin – nie ins Repo.
6. **Hochladen:**
   ```bash
   npx wrangler@3 deploy
   ```
   Ausgabe merken, z.B. `https://launch-radar.DEINNAME.workers.dev`.
7. **App verbinden:** in `src/config.json` eintragen und pushen:
   ```json
   { "worker": "https://launch-radar.DEINNAME.workers.dev", "vapidPublic": "<öffentlicher Schlüssel aus Schritt 4>" }
   ```

## Testen

- Ohne Konto: `node test.js` (simuliert Speicher, API und Push-Dienst)
- Nach dem Hochladen: `https://launch-radar.DEINNAME.workers.dev/launches` im Browser öffnen

## Gratis-Grenzen (reichen locker)

100 000 Aufrufe/Tag · 1 000 Schreibvorgänge/Tag im Speicher (Worker braucht ~300 + 1 pro Erinnerung) · Cron alle 5 Min.

## Endpunkte

| Pfad | Zweck |
|---|---|
| `GET /launches` | kommende Starts (wie Launch Library, + `ts`) |
| `GET /previous` | vergangene Starts (stündlich) |
| `GET /push/key` | öffentlicher VAPID-Schlüssel |
| `POST /push/subscribe` | `{sub, rem}` – Push-Abo + Erinnerungen |
| `GET /push/pending?e=<endpoint>` | Texte der Push-Meldungen (holt der Service Worker) |
