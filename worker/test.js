// Offline-Test des Workers ohne Cloudflare-Konto: simuliert KV und fetch.
//   cd worker && node test.js
import worker, { vapidJwt, TeleHub } from "./src/index.js";
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";

let ok = 0, bad = 0; const check = (n, c, i = "") => { console.log(`${c ? "✓" : "✗"} ${n}${i ? " – " + i : ""}`); c ? ok++ : bad++; };

// Schlüssel wie scripts/vapid.js
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
const store = new Map(), metas = new Map();
const env = { VAPID_PUBLIC: pub, VAPID_PRIVATE_JWK: JSON.stringify(jwk), ALLOW_ORIGIN: "https://launch-radar.com,https://www.launch-radar.com,https://lostfifi.github.io",
  LR: { async get(k, t) { const v = store.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
        async put(k, v, o) { store.set(k, v); if (o?.metadata) metas.set(k, o.metadata); }, async delete(k) { store.delete(k); },
        async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name, metadata: metas.get(name) })), list_complete: true }; } } };

// 1) VAPID-JWT ist gültig signiert (ES256)
const jwt = await vapidJwt("https://fcm.googleapis.com", env), [h, p, s] = jwt.split(".");
const pk = createPublicKey({ key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, format: "jwk" });
check("VAPID-Signatur gültig", verify("sha256", Buffer.from(h + "." + p), { key: pk, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")));
check("JWT-Inhalt", JSON.parse(Buffer.from(p, "base64url")).aud === "https://fcm.googleapis.com");

// 2) fetch simulieren: Launch Library liefert einen Start in 8 Minuten, Push-Dienst nimmt an
const soon = new Date(Date.now() + 8 * 60e3).toISOString(), pushes = [];
globalThis.fetch = async (url, o = {}) => {
  url = String(url);
  if (url.includes("thespacedevs")) return new Response(JSON.stringify({ results: [{ id: "abc", name: "Falcon 9 | Test", net: soon }] }));
  if (url.startsWith("https://push.example")) { pushes.push(o.headers.Authorization); return new Response(null, { status: 201 }); }
  return new Response("?", { status: 404 });
};
const call = (path, init) => worker.fetch(new Request("https://w.example" + path, { headers: { origin: "https://launch-radar.com" }, ...init }), env, {});

let r = await call("/launches"); let j = await r.json();
check("/launches lädt und speichert", r.status === 200 && j.results.length === 1);
check("CORS für launch-radar.com", r.headers.get("access-control-allow-origin") === "https://launch-radar.com");
r = await call("/push/subscribe", { method: "POST", body: JSON.stringify({ sub: { endpoint: "https://push.example/abc", keys: {} }, rem: { abc: { net: "2020-01-01T00:00:00Z", name: "Falcon 9 | Test" } } }) });
check("/push/subscribe", r.status === 200);
await worker.scheduled({ scheduledTime: Date.now() }, env, {});
check("Push gesendet (Verschiebung + 10-Min-Erinnerung)", pushes.length === 1 && pushes[0].startsWith("vapid t="));
r = await call("/push/pending?e=" + encodeURIComponent("https://push.example/abc")); j = await r.json();
check("/push/pending liefert die Texte", j.length === 2, j.map(m => m.body).join(" | "));
j = await (await call("/push/pending?e=" + encodeURIComponent("https://push.example/abc"))).json();
check("Meldungen nur einmal", j.length === 0);
await worker.scheduled({ scheduledTime: Date.now() }, env, {});
check("kein doppelter Push", pushes.length === 1);
// 2b) Abo: Regel „Starship“ erkennt einen neuen Start selbst, abgewählter Start wird ausgelassen
{
  store.clear(); pushes.length = 0;
  const in8 = new Date(Date.now() + 8 * 60e3).toISOString();
  globalThis.fetch = async (url, o = {}) => { url = String(url);
    if (url.includes("thespacedevs")) return new Response(JSON.stringify({ results: [
      { id: "s1", name: "Starship | Flug 20", net: in8, rocket: { configuration: { name: "Starship" } }, launch_service_provider: { name: "SpaceX" } },
      { id: "s2", name: "Starship | Flug 21", net: in8, rocket: { configuration: { name: "Starship" } }, launch_service_provider: { name: "SpaceX" } },
      { id: "f1", name: "Falcon 9 | X", net: in8, rocket: { configuration: { name: "Falcon 9" } }, launch_service_provider: { name: "SpaceX" } }] }));
    if (url.startsWith("https://push.example")) { pushes.push(1); return new Response(null, { status: 201 }); }
    return new Response("?", { status: 404 }); };
  await call("/push/subscribe", { method: "POST", body: JSON.stringify({ sub: { endpoint: "https://push.example/r" }, rem: {}, rules: [{ chip: "starship" }], off: ["s2"] }) });
  await worker.scheduled({ scheduledTime: Date.now() }, env, {});
  const p = await (await call("/push/pending?e=" + encodeURIComponent("https://push.example/r"))).json();
  check("Abo: neuer Starship-Start erkannt, abgewählter + Falcon ausgelassen", pushes.length === 1 && p.length === 1 && p[0].body.includes("Flug 20"), p.map(x => x.body).join(" | "));
  // Englisch: gleiche Abo-Logik, Text auf Englisch
  await call("/push/subscribe", { method: "POST", body: JSON.stringify({ sub: { endpoint: "https://push.example/en" }, rem: {}, rules: [{ chip: "starship" }], off: ["s2"], lang: "en" }) });
  await worker.scheduled({ scheduledTime: Date.now() }, env, {});
  const pe = await (await call("/push/pending?e=" + encodeURIComponent("https://push.example/en"))).json();
  check("Push-Text auf Englisch", pe.length === 1 && /launches in \d+ min!/.test(pe[0].body), pe.map(x => x.body).join(" | "));
}

// 3) API gesperrt (429) → Wartezeit merken + GitHub-Schnappschuss als Reserve
store.clear(); let llCalls = 0;
globalThis.fetch = async (url) => { url = String(url);
  if (url.includes("thespacedevs")) { llCalls++; return new Response('{"detail":"Request was throttled. Expected available in 600 seconds."}', { status: 429 }); }
  if (url.includes("launch-radar.com/data/")) return new Response(JSON.stringify({ ts: Date.now() - 3600e3, results: [{ id: "g1", name: "GitHub | Reserve", net: soon }] }));
  return new Response("?", { status: 404 }); };
r = await call("/launches"); j = await r.json();
check("429 → GitHub-Schnappschuss als Reserve", r.status === 200 && j.results[0].id === "g1" && j.src === "github");
await worker.scheduled({ scheduledTime: Date.now() }, env, {});
check("Wartezeit eingehalten (keine weitere API-Abfrage)", llCalls === 1);
j = await (await call("/status")).json();
check("/status zeigt Sperre", j.launches.status === 429 && j.retryUntil > Date.now());

// 4) Nutzungsmessung + Feedback + Statistik
{ env.STATS_KEY = "geheim\n";
  const post = (path, body, origin = "https://launch-radar.com") => worker.fetch(new Request("https://w.example" + path, { method: "POST", headers: { origin, "content-type": "text/plain" }, body: JSON.stringify(body) }), env, {});
  // gleichzeitig abgeschickt (wie echte Beacons) – darf nichts doppelt oder verloren zählen
  await Promise.all([post("/t", { vid: "aaaaaa11", tot: 20, f: ["globe", "detail", "boese"], lang: "en", mob: true }),
    post("/t", { vid: "aaaaaa11", tot: 400, f: ["tele"], lang: "en", mob: true }),   // gleicher Besuch, später versteckt
    post("/t", { vid: "bbbbbb22", tot: 5, f: [], lang: "de" }), post("/t", { vid: "cccccc33", tot: 1, f: [] })]);   // < 3 s zählt nicht
  const fremd = await post("/t", { vid: "dddddd44", tot: 5 }, "https://boese.example");
  check("Messung nur von der eigenen Seite", fremd.status === 403);
  const fb = await post("/feedback", { r: 5, wish: "Mehr Raketen", c: "Super", lang: "de" });
  const fb2 = await post("/feedback", { r: 4 });
  check("Feedback gespeichert, Spam-Schutz", fb.status === 200 && fb2.status === 429);
  const no = await call("/admin/stats");
  const st = await (await worker.fetch(new Request("https://w.example/admin/stats", { headers: { origin: "https://launch-radar.com", authorization: "Bearer geheim" } }), env, {})).json();
  const d = st.days[new Date().toISOString().slice(0, 10)];
  check("Statistik nur mit Passwort", no.status === 401 && !!d);
  check("Besuche, Dauer-Gruppen, Funktionen gezählt", d.v === 2 && d.dur === 405 && d.b.join() === "1,0,0,0,1,0" && d.dev.desktop === 1 && d.f.globe === 1 && d.f.tele === 1 && !d.f.boese && d.lang.en === 1 && d.dev.mobile === 1, JSON.stringify(d));
  await worker.scheduled({ scheduledTime: Date.now() + 864e5 }, env, {});   // nächster Tag: Cron fasst gestern zusammen
  check("Cron fasst den Vortag zusammen", JSON.parse(store.get("st:" + new Date().toISOString().slice(0, 10)) || "{}").v === 2);
  check("Feedback in der Statistik", st.feedback.length === 1 && st.feedback[0].wish === "Mehr Raketen" && st.feedback[0].r === 5);
}
// 5) Live-Telemetrie: Sender schickt, alle lesen
{ const mem = new Map(), hub = new TeleHub({ storage: { async get(k) { return mem.get(k); }, async put(k, v) { mem.set(k, v); } } });
  env.TELE = { idFromName: () => "live", get: () => ({ fetch: (u, o) => hub.fetch(new Request(u, o)) }) };
  const push = (body, key = "geheim") => worker.fetch(new Request("https://w.example/tele/push", { method: "POST", headers: { origin: "https://launch-radar.com", authorization: "Bearer " + key }, body: JSON.stringify(body) }), env, {});
  const bad = await push({ id: "x", s2: { v: 1, h: 1 } }, "falsch");
  check("Telemetrie senden nur mit Passwort", bad.status === 401);
  await push({ id: "f15", name: "Starship Flight 15", ts: 35990, s2: { v: 26451, h: 256 }, s1: null, d: 123456, vh: 7.3, pay: 20 });
  const live = await (await call("/tele/live")).json();
  check("Alle bekommen den neuesten Wert", live.cur?.id === "f15" && live.cur.s2.v === 26451 && live.cur.s2.h === 256 && live.cur.pay === 20 && live.hist.length === 1, JSON.stringify(live.cur));
  await push({ id: "f15", s2: { v: 99999999, h: -5 } });
  const l2 = await (await call("/tele/live")).json();
  check("Unsinnige Werte werden nicht verteilt", l2.cur.s2.v === null && l2.cur.s2.h === null);
}
console.log(bad ? `\n${bad} Fehler` : "\nAlles in Ordnung"); process.exit(bad ? 1 : 0);
