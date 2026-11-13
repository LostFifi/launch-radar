// LaunchRadar Cloudflare Worker (gratis-Plan reicht)
// 1) Daten-Zwischenspeicher: holt alle 5 Min die kommenden Starts (12 Abfragen/h – unter dem Gratis-Limit von ~15/h),
//    stündlich die vergangenen. Alle App-Nutzer fragen nur noch den Worker → kein API-Limit mehr für sie.
// 2) Echte Push-Nachrichten: die App meldet ihre Erinnerungen an; kurz vor dem Start schickt der Worker einen Push
//    OHNE Inhalt (dafür genügt die VAPID-Signatur, keine Verschlüsselung nötig). Der Service Worker der App holt
//    den Text danach unter /push/pending ab. Startzeit wird dabei aus den frischen Daten genommen (Verschiebungen!).
//
// Bindings (wrangler.toml): KV-Namespace LR · Secrets: VAPID_PUBLIC (base64url), VAPID_PRIVATE_JWK (JSON), ALLOW_ORIGIN
const LL = "https://ll.thespacedevs.com/2.3.0";
const UPCOMING = `${LL}/launches/upcoming/?limit=40&mode=detailed&hide_recent_previous=false`;
const PREVIOUS = `${LL}/launches/previous/?mode=detailed&limit=30`;
const SUBJECT = "https://lostfifi.github.io/launch-radar/";   // VAPID-Kontakt (öffentliche Seite statt E-Mail)

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      if (url.pathname === "/launches" || url.pathname === "/previous") {
        const key = url.pathname.slice(1);
        let v = await env.LR.get(key, "json");
        if (!v) { await refresh(env, key); v = await env.LR.get(key, "json"); }
        if (!v) return json({ error: "noch keine Daten" }, 503, cors);
        return json(v, 200, { ...cors, "cache-control": "public, max-age=60" });
      }
      if (url.pathname === "/push/key") return json({ key: pubKey(env) || null }, 200, cors);
      if (url.pathname === "/status") return json(await env.LR.get("status", "json") || {}, 200, cors);
      if (url.pathname === "/push/subscribe" && req.method === "POST") {
        const { sub, rem, rules, off, lang } = await req.json();
        if (!sub || !sub.endpoint || !/^https:\/\//.test(sub.endpoint)) return json({ error: "ungültig" }, 400, cors);
        const id = await hash(sub.endpoint), old = (await env.LR.get("sub:" + id, "json")) || {};
        const r = {}; for (const k in rem || {}) { const x = rem[k]; if (x && x.net) r[k] = { net: x.net, name: String(x.name || "").slice(0, 120), kind: x.kind === "pass" ? "pass" : "launch", txt: String(x.txt || "").slice(0, 120), sent: old.rem?.[k]?.sent && old.rem[k].net === x.net } }
        const S = v => String(v || "").slice(0, 80);
        const ru = (Array.isArray(rules) ? rules : []).slice(0, 20).map(x => ({ chip: ["spacex", "starship"].includes(x.chip) ? x.chip : "", prov: S(x.prov), cty: S(x.cty), q: S(x.q) }));
        const of = (Array.isArray(off) ? off : []).slice(0, 300).map(S);
        await env.LR.put("sub:" + id, JSON.stringify({ sub, rem: r, rules: ru, off: of, lang: lang === "en" ? "en" : "de", pending: old.pending || [] }), { expirationTtl: 40 * 86400 });
        return json({ ok: true, n: Object.keys(r).length }, 200, cors);
      }
      if (url.pathname === "/push/unsubscribe" && req.method === "POST") {
        const { endpoint } = await req.json(); if (endpoint) await env.LR.delete("sub:" + await hash(endpoint));
        return json({ ok: true }, 200, cors);
      }
      if (url.pathname === "/push/pending") {
        const e = url.searchParams.get("e"); if (!e) return json([], 200, cors);
        const key = "sub:" + await hash(e), s = await env.LR.get(key, "json"); if (!s) return json([], 200, cors);
        const p = s.pending || []; if (p.length) { s.pending = []; await env.LR.put(key, JSON.stringify(s), { expirationTtl: 40 * 86400 }); }
        return json(p, 200, cors);
      }
      if (url.pathname === "/") return json({ name: "LaunchRadar Worker", routes: ["/launches", "/previous", "/push/key", "/push/subscribe", "/push/pending"] }, 200, cors);
      return json({ error: "nicht gefunden" }, 404, cors);
    } catch (e) { return json({ error: String(e.message || e) }, 500, cors); }
  },

  async scheduled(event, env, ctx) {
    const min = new Date(event.scheduledTime).getUTCMinutes();
    await refresh(env, "launches");
    if (min < 5) await refresh(env, "previous");      // stündlich
    await sendReminders(env);
  }
};

// Reserve: GitHub baut die App bei jedem Push und jede Nacht mit frischen Daten und veröffentlicht sie auch als Datei
const SNAPSHOT_URL = "https://lostfifi.github.io/launch-radar/data/upcoming.json";
async function refresh(env, key) {
  const ok = await refreshLL(env, key);
  if (!ok && key === "launches") {                     // API gesperrt → GitHub-Schnappschuss, falls neuer als unsere Daten
    try {
      const cur = await env.LR.get(key, "json"), r = await fetch(SNAPSHOT_URL, { cf: { cacheTtl: 300 } });
      if (r.ok) { const s = await r.json(); if (s.results?.length && (!cur || s.ts > cur.ts)) await env.LR.put(key, JSON.stringify({ ts: s.ts, results: s.results, src: "github" })); }
    } catch (e) {}
  }
  return ok;
}
async function refreshLL(env, key) {
  const prev = await env.LR.get("status", "json") || {}, now = Date.now();
  if (prev.retryUntil && now < prev.retryUntil) return false;   // gesperrt: nicht unnötig Kontingent verbrauchen
  let st = 0, info = "";
  try {
    const r = await fetch(key === "previous" ? PREVIOUS : UPCOMING, { headers: { "user-agent": "LaunchRadar-Worker (+https://lostfifi.github.io/launch-radar/)", accept: "application/json" } });
    st = r.status;
    if (r.ok) {
      const j = await r.json();
      await env.LR.put(key, JSON.stringify({ ts: Date.now(), results: j.results || [] }));
    } else info = (await r.text()).slice(0, 200);      // z.B. 429: alte Daten bleiben
  } catch (e) { info = String(e.message || e); }
  // letzter Abruf für /status (nur bei Fehlern oder höchstens 1× pro 30 Min schreiben – KV-Gratislimit)
  const wait = st === 429 ? +((info.match(/(\d+) seconds/) || [])[1] || 900) : 0;
  if (st !== 200 || !prev[key] || prev[key].status !== 200 || now - prev[key].at > 30 * 60e3 || prev.retryUntil) {
    prev[key] = { status: st, at: now, info }; prev.retryUntil = wait ? now + wait * 1000 : 0;
    await env.LR.put("status", JSON.stringify(prev));
  }
  return st === 200;
}

// Erinnerungen prüfen: 10 Min vor Start (bzw. Überflug) einen Push senden. Startzeit aus den frischen Daten.
async function sendReminders(env) {
  const up = (await env.LR.get("launches", "json"))?.results || [], net = Object.fromEntries(up.map(l => [l.id, l.net]));
  const now = Date.now(); let cursor;
  do {
    const page = await env.LR.list({ prefix: "sub:", cursor }); cursor = page.list_complete ? null : page.cursor;
    for (const k of page.keys) {
      const s = await env.LR.get(k.name, "json"); if (!s) continue; let changed = false, push = false;
      s.pending = s.pending || [];
      // Abos: neue passende Starts (nächste 30 Tage) selbst erkennen – auch wenn die App lange nicht offen war
      for (const l of up) {
        const t = new Date(l.net) - now;
        if (s.rem[l.id] || (s.off || []).includes(l.id) || t < 60e3 || t > 30 * 864e5) continue;
        if ((s.rules || []).some(r => matchRule(r, l))) { s.rem[l.id] = { net: l.net, name: String(l.name).slice(0, 120), kind: "launch", txt: "", sent: false, auto: true }; changed = true; }
      }
      for (const id in s.rem) {
        const r = s.rem[id];
        if (net[id] && net[id] !== r.net) {            // verschoben → melden und neu planen
          s.pending.push({ title: "LaunchRadar", body: TXT[s.lang || "de"].shift(short(r.name), fmt(net[id], s.lang)), tag: "lr-shift-" + id });
          r.net = net[id]; r.sent = false; changed = push = true;
        }
        const t = new Date(r.net) - now;
        if (!r.sent && t <= 11 * 60e3 && t > -10 * 60e3) {
          const m = Math.max(0, Math.round(t / 60e3));
          const T = TXT[s.lang || "de"];
          s.pending.push({ title: "LaunchRadar", body: r.kind === "pass" ? T.pass(r.name, m, r.txt) : T.launch(short(r.name), m), tag: "lr-" + id });
          r.sent = true; changed = push = true;
        }
        if (t < -6 * 3600e3) { delete s.rem[id]; changed = true; }
      }
      if (push) {
        const res = await webPush(s.sub, env);
        if (res === 404 || res === 410) { await env.LR.delete(k.name); continue; }   // Abo erloschen
      }
      if (changed) { s.pending = s.pending.slice(-10); await env.LR.put(k.name, JSON.stringify(s), { expirationTtl: 40 * 86400 }); }
    }
  } while (cursor);
}

// Web Push ohne Inhalt: nur VAPID-JWT (ES256) im Authorization-Header
async function webPush(sub, env) {
  try {
    const aud = new URL(sub.endpoint).origin;
    const jwt = await vapidJwt(aud, env);
    const r = await fetch(sub.endpoint, { method: "POST", headers: { TTL: "900", Urgency: "high", Authorization: `vapid t=${jwt}, k=${pubKey(env)}` } });
    return r.status;
  } catch (e) { console.log("Push fehlgeschlagen:", e.message); return 0; }
}
export async function vapidJwt(aud, env) {
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const data = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT });
  const key = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data));
  return data + "." + b64u(new Uint8Array(sig));
}
// Gleiche Regeln wie in der App (src/js/040-daten-laden.js: matchRule, countryOf)
const CC_DE = { US: "USA", CN: "China", RU: "Russland", NZ: "Neuseeland", IN: "Indien", JP: "Japan", GF: "Frankreich (Kourou)", FR: "Frankreich (Kourou)",
  KZ: "Kasachstan", NO: "Norwegen", KR: "Südkorea", SE: "Schweden", IR: "Iran", IL: "Israel", AU: "Australien", GB: "Grossbritannien", KP: "Nordkorea" };
const CTY_DE = { "USA": "USA", "People's Republic of China": "China", "Russian Federation": "Russland", "New Zealand": "Neuseeland", "India": "Indien",
  "Japan": "Japan", "French Guiana": "Frankreich (Kourou)", "Republic of Kazakhstan": "Kasachstan", "Kazakhstan": "Kasachstan", "Norway": "Norwegen",
  "South Korea": "Südkorea", "Republic of Korea": "Südkorea", "Sweden": "Schweden", "Iran": "Iran", "Israel": "Israel", "Australia": "Australien", "United Kingdom": "Grossbritannien" };
function countryOf(l) {
  const loc = l.pad?.location?.name || ""; if (/^sea launch|offshore/i.test(loc)) return "Auf See";
  const cc = l.pad?.country?.alpha_2_code; if (cc && CC_DE[cc]) return CC_DE[cc];
  const c = l.pad?.country?.name || loc.split(",").pop().trim(); return CTY_DE[c] || c || "?";
}
export function matchRule(f, l) {
  const prov = l.launch_service_provider?.name || "?", p = prov.toLowerCase(), r = (l.rocket?.configuration?.full_name || l.rocket?.configuration?.name || "").toLowerCase();
  if (f.chip === "spacex" && !p.includes("spacex")) return false;
  if (f.chip === "starship" && !r.includes("starship")) return false;
  if (f.prov && prov !== f.prov) return false;
  if (f.cty && countryOf(l) !== f.cty) return false;
  if (f.q) { const hay = [l.name, r, p, l.pad?.name, l.pad?.location?.name, l.mission?.name, l.mission?.orbit?.name, l.mission?.type].join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false; }
  return true;
}
function pubKey(env) { return (env.VAPID_PUBLIC || "").trim(); }   // Secrets können einen Zeilenumbruch enthalten
function b64u(bytes) { let s = ""; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function hash(s) { return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).slice(0, 32); }
function short(n) { return (String(n).split("|")[1] || n).trim(); }
// Push-Texte in der Sprache der App (lang beim Anmelden mitgeschickt)
const TXT = {
  de: { shift: (n, d) => `${n}: neue Startzeit ${d}`, launch: (n, m) => `${n} startet in ${m} Min!`, pass: (n, m, t) => `${n} in ${m} Min – ${t}` },
  en: { shift: (n, d) => `${n}: new launch time ${d}`, launch: (n, m) => `${n} launches in ${m} min!`, pass: (n, m, t) => `${n} in ${m} min – ${t}` }
};
function fmt(iso, lang) { return new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "de-CH", { timeZone: "Europe/Zurich", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function json(o, status, headers) { return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...headers } }); }
function corsHeaders(req, env) {
  const o = req.headers.get("origin") || "", allow = (env.ALLOW_ORIGIN || "https://lostfifi.github.io").split(",");
  const ok = allow.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return { "access-control-allow-origin": ok ? o : allow[0], "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
}
