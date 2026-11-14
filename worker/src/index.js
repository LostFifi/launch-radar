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
const SUBJECT = "https://launch-radar.com/";   // VAPID-Kontakt (öffentliche Seite statt E-Mail)

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
        const ru = (Array.isArray(rules) ? rules : []).slice(0, 20).map(x => ({ chip: ["spacex", "starship"].includes(x.chip) ? x.chip : "", grp: (Array.isArray(x.grp) ? x.grp : []).filter(g => GROUPS.some(G => G[0] === g)), prov: S(x.prov), cty: S(x.cty), q: S(x.q) }));
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
      // ---- Anonyme Nutzungsmessung (keine Cookies, keine IDs, nur Tageszähler) ----
      if (url.pathname === "/t" && req.method === "POST") {
        if (!fromSite(req, env)) return json({ ok: false }, 403, cors);
        let d; try { d = JSON.parse(await req.text()); } catch (e) { return json({ ok: false }, 400, cors); }
        await countVisit(env, d); return json({ ok: true }, 200, cors);
      }
      // ---- Feedback: Bewertung 1–5, Funktionswunsch, Kommentar ----
      if (url.pathname === "/feedback" && req.method === "POST") {
        if (!fromSite(req, env)) return json({ ok: false }, 403, cors);
        let d; try { d = JSON.parse(await req.text()); } catch (e) { return json({ ok: false }, 400, cors); }
        const r = Math.round(+d.r), wish = String(d.wish || "").trim().slice(0, 600), c = String(d.c || "").trim().slice(0, 600);
        if (!(r >= 1 && r <= 5) && !wish && !c) return json({ ok: false }, 400, cors);
        const rl = "rl:" + await hash((req.headers.get("cf-connecting-ip") || "") + new Date().toISOString().slice(0, 10));   // gegen Spam: 1×/Minute
        if (await env.LR.get(rl)) return json({ ok: false, error: "zu schnell" }, 429, cors);
        await env.LR.put(rl, "1", { expirationTtl: 60 });
        const list = (await env.LR.get("fb:list", "json")) || [];
        list.unshift({ at: Date.now(), r: r >= 1 && r <= 5 ? r : null, wish, c, lang: d.lang === "en" ? "en" : "de", mob: !!d.mob });
        await env.LR.put("fb:list", JSON.stringify(list.slice(0, 1000)));
        return json({ ok: true }, 200, cors);
      }
      // ---- Statistik für Fionn (Passwort = Secret STATS_KEY) ----
      if (url.pathname === "/admin/stats") {
        const k = (env.STATS_KEY || "").trim(), got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
        if (!k || got !== k) return json({ error: "Passwort falsch" }, 401, cors);
        const days = {}, keys = (await env.LR.list({ prefix: "st:" })).keys.map(x => x.name).sort().slice(-90);
        for (const key of keys) days[key.slice(3)] = await env.LR.get(key, "json");
        for (let i = 0; i < 5; i++) { const d = dayStr(Date.now() - i * 864e5); if (!days[d] || i === 0) { const r = await rollup(env, d); if (r.v || !days[d]) days[d] = r; } }   // heute immer live
        return json({ days, feedback: (await env.LR.get("fb:list", "json")) || [] }, 200, { ...cors, "cache-control": "no-store" });
      }
      if (url.pathname === "/") return json({ name: "LaunchRadar Worker", routes: ["/launches", "/previous", "/push/key", "/push/subscribe", "/push/pending"] }, 200, cors);
      return json({ error: "nicht gefunden" }, 404, cors);
    } catch (e) { return json({ error: String(e.message || e) }, 500, cors); }
  },

  async scheduled(event, env, ctx) {
    const min = new Date(event.scheduledTime).getUTCMinutes();
    // API-Kontingent (~15/h, Cloudflare-IPs geteilt): normal alle 10 Min, nur rund um einen Start (−3 h … +1 h) alle 5 Min
    const cur = (await env.LR.get("launches", "json"))?.results || [], now = event.scheduledTime;
    const busy = cur.some(l => { const d = now - new Date(l.net).getTime(); return d > -3600e3 && d < 3 * 3600e3; });
    if (!cur.length || busy || min % 10 < 5) await refresh(env, "launches");
    { const y = dayStr(event.scheduledTime - 864e5); if (!(await env.LR.get("st:" + y))) { const r = await rollup(env, y); await env.LR.put("st:" + y, JSON.stringify(r), { expirationTtl: 400 * 86400 }); } }
    if (min >= 30 && min < 35) await refresh(env, "previous");      // stündlich, versetzt zur Startliste
    await sendReminders(env);
  }
};

// Reserve: GitHub baut die App bei jedem Push und jede Nacht mit frischen Daten und veröffentlicht sie auch als Datei
const SNAPSHOT_URL = "https://launch-radar.com/data/upcoming.json";
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
    const r = await fetch(key === "previous" ? PREVIOUS : UPCOMING, { headers: { "user-agent": "LaunchRadar-Worker (+https://launch-radar.com/)", accept: "application/json" } });
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
// Anbieter-Gruppen für den Filter oben (gleiche Logik im Worker: worker/src/index.js → launchGroup)
const GROUPS = [["starship","Starship"],["spacex","SpaceX (Falcon)"],["blue","Blue Origin"],["ula","ULA"],["rocketlab","Rocket Lab"],
  ["europe","Europa"],["russia","Russland"],["china","China"],["india","Indien"],["japan","Japan"],["other","Andere"]];
function launchGroup(l){
  const p=(l.launch_service_provider?.name || "").toLowerCase(), r=(l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"").toLowerCase(), c=countryOf(l);
  if(r.includes("starship")) return "starship";
  if(p.includes("spacex")) return "spacex";
  if(p.includes("blue origin")) return "blue";
  if(p.includes("united launch alliance")||/ula/.test(p)) return "ula";
  if(p.includes("rocket lab")) return "rocketlab";
  if(/arianespace|european space agency|esa|avio|isar aerospace|rocket factory|orbex|skyrora|pld space/.test(p)||/ariane|vega/.test(r)) return "europe";
  if(c==="Russland"||c==="Kasachstan"||/roscosmos|russian|glavkosmos|khrunichev|progress rocket/.test(p)) return "russia";
  if(c==="China"||/china|chinese|galactic energy|landspace|ispace|expace|space pioneer|orienspace|cas space/.test(p)) return "china";
  if(c==="Indien"||/indian space|isro|skyroot|agnikul/.test(p)) return "india";
  if(c==="Japan"||/jaxa|mitsubishi|interstellar tech|space one/.test(p)) return "japan";
  return "other";
}
export function matchRule(f, l) {
  const prov = l.launch_service_provider?.name || "?", p = prov.toLowerCase(), r = (l.rocket?.configuration?.full_name || l.rocket?.configuration?.name || "").toLowerCase();
  if (f.chip === "spacex" && !p.includes("spacex")) return false;
  if (f.chip === "starship" && !r.includes("starship")) return false;
  if (Array.isArray(f.grp) && f.grp.length && !f.grp.includes(launchGroup(l))) return false;
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
  return { "access-control-allow-origin": ok ? o : allow[0], "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type, authorization", vary: "origin" };
}

// ---------- Nutzungsmessung ----------
// Nur Anfragen von der eigenen Seite zählen (nicht localhost, nicht fremde Seiten)
function fromSite(req, env) { const o = req.headers.get("origin") || ""; return (env.ALLOW_ORIGIN || "").split(",").includes(o); }
const FEATS = ["detail", "globe", "map", "list", "stats", "rockets", "layers", "sim", "live", "tele", "pip", "iss", "visible", "moon", "mars", "sub", "remind", "share", "review", "weather", "lang", "install", "feedback"];
const BUCKET = [10, 30, 120, 300, 900, Infinity];   // <10 s, <30 s, <2 min, <5 min, <15 min, länger
const bucketOf = s => BUCKET.findIndex(b => s < b);
// d = { first, tot (Sekunden sichtbar bisher), prev (beim letzten Senden), f: [neu benutzte Funktionen], lang, mob }
// Jede Meldung = eigener Schlüssel mit den Werten in den Metadaten → keine Lese-Ändern-Schreiben-Konflikte
// (KV ist nicht sofort konsistent). vid = zufällige Kennung pro Seitenaufruf (nirgends gespeichert, nur zum Zusammenfassen).
async function countVisit(env, d) {
  const vid = String(d.vid || "").replace(/[^a-z0-9]/gi, "").slice(0, 16); if (vid.length < 6) return;
  const meta = { t: Math.max(0, Math.min(6 * 3600, Math.round(+d.tot || 0))), f: (Array.isArray(d.f) ? d.f : []).filter(f => FEATS.includes(f)).slice(0, 25),
    l: d.lang === "en" ? "en" : "de", m: d.mob ? 1 : 0 };
  await env.LR.put(`ev:${dayStr(Date.now())}:${vid}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, "", { metadata: meta, expirationTtl: 6 * 86400 });
}
const dayStr = t => new Date(t).toISOString().slice(0, 10);
// Alle Meldungen eines Tages → Tagessumme (pro Besuch: längste Zeit, alle benutzten Funktionen)
async function rollup(env, day) {
  const V = new Map(); let cursor;
  do { const r = await env.LR.list({ prefix: `ev:${day}:`, cursor }); cursor = r.list_complete ? null : r.cursor;
    for (const k of r.keys) { const vid = k.name.split(":")[2], m = k.metadata || {}, v = V.get(vid) || { t: 0, f: new Set(), l: m.l, m: m.m };
      v.t = Math.max(v.t, +m.t || 0); (m.f || []).forEach(f => v.f.add(f)); V.set(vid, v); } } while (cursor);
  const s = { v: 0, dur: 0, b: [0, 0, 0, 0, 0, 0], f: {}, lang: {}, dev: {} };
  for (const v of V.values()) { if (v.t < 3) continue; s.v++; s.dur += v.t; s.b[bucketOf(v.t)]++;
    v.f.forEach(f => s.f[f] = (s.f[f] || 0) + 1); const L = v.l === "en" ? "en" : "de", D = v.m ? "mobile" : "desktop"; s.lang[L] = (s.lang[L] || 0) + 1; s.dev[D] = (s.dev[D] || 0) + 1; }
  return s;
}

