// Offline-Test des Workers ohne Cloudflare-Konto: simuliert KV und fetch.
//   cd worker && node test.js
import worker, { vapidJwt } from "./src/index.js";
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";

let ok = 0, bad = 0; const check = (n, c, i = "") => { console.log(`${c ? "✓" : "✗"} ${n}${i ? " – " + i : ""}`); c ? ok++ : bad++; };

// Schlüssel wie scripts/vapid.js
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
const store = new Map();
const env = { VAPID_PUBLIC: pub, VAPID_PRIVATE_JWK: JSON.stringify(jwk), ALLOW_ORIGIN: "https://launch-radar.com,https://www.launch-radar.com,https://lostfifi.github.io",
  LR: { async get(k, t) { const v = store.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
        async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
        async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; } } };

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
console.log(bad ? `\n${bad} Fehler` : "\nAlles in Ordnung"); process.exit(bad ? 1 : 0);
