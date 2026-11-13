// Erzeugt statische Seiten für Suchmaschinen (läuft nach build.py, bei GitHub jede Nacht mit frischen Daten):
//   start/<slug>.html + en/launch/<slug>.html   eine Seite pro Start (DE/EN) mit Event-Daten (schema.org)
//   start/index.html + en/launches/index.html   Übersichten
//   iss/<stadt>.html + iss/index.html           sichtbare ISS-Überflüge für Städte (CH/DE/AT), satellite.js/SGP4
//   sitemap.xml                                  alle Seiten
// Die Seiten sind ohne JavaScript lesbar und verlinken in die App (#start=… bzw. #iss=lat,lon).
const fs = require('fs'), path = require('path');
const satellite = require('satellite.js');
const ROOT = path.resolve(__dirname, '..'), DIST = path.join(ROOT, 'dist');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config.json'), 'utf8'));
const SITE = (CONFIG.siteUrl || '').replace(/\/?$/, '/');
const read = f => JSON.parse(fs.readFileSync(path.join(DIST, f), 'utf8'));
const up = read('data/upcoming.json'), past = read('data/previous.json');
const STAND = new Date(up.ts);
const write = (rel, html) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); pages.push(rel); };
const pages = [];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = l => String(l.name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) + '-' + l.id.slice(0, 6);
const short = l => (String(l.name).split('|')[1] || l.name).trim();
const rocket = l => l.rocket?.configuration?.full_name || l.rocket?.configuration?.name || '';
const fmt = (d, lang, opt) => new Date(d).toLocaleString(lang === 'en' ? 'en-GB' : 'de-CH', { timeZone: lang === 'en' ? 'UTC' : 'Europe/Zurich', ...opt });
const DT = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
const T = {
  de: { home: 'Raketenstarts live verfolgen', launches: 'Raketenstarts', launchesT: 'Nächste Raketenstarts – Startzeiten, Livestreams & Bahnen', next: 'Kommende Starts', recent: 'Letzte Starts',
    live: 'Live auf der Karte verfolgen', time: 'Startzeit', tz: 'Schweizer Zeit', status: 'Status', rocket: 'Rakete', prov: 'Betreiber', pad: 'Startplatz', orbit: 'Zielbahn', mission: 'Mission',
    streams: 'Livestreams', result: 'Ergebnis', stand: 'Stand', est: 'Startzeiten können sich kurzfristig ändern – die App zeigt immer den neuesten Stand.',
    descL: (l) => `${short(l)}: Startzeit ${fmt(l.net, 'de', DT)} (Schweizer Zeit), ${rocket(l)} ab ${l.pad?.location?.name || ''}. Livestream, Bahn auf der Karte und Countdown bei LaunchRadar.`,
    titleL: (l, past) => `${short(l)} – ${past ? 'Start' : 'Startzeit'}, Livestream & Bahn | LaunchRadar`, other: 'English', iss: 'ISS-Überflüge', issT: 'ISS sichtbar – Überflüge für Städte in der Schweiz, Deutschland und Österreich' },
  en: { home: 'Track rocket launches live', launches: 'Rocket launches', launchesT: 'Upcoming rocket launches – launch times, livestreams & trajectories', next: 'Upcoming launches', recent: 'Recent launches',
    live: 'Track live on the map', time: 'Launch time', tz: 'UTC', status: 'Status', rocket: 'Rocket', prov: 'Provider', pad: 'Launch site', orbit: 'Target orbit', mission: 'Mission',
    streams: 'Livestreams', result: 'Result', stand: 'Updated', est: 'Launch times can change at short notice – the app always shows the latest.',
    descL: (l) => `${short(l)}: launch time ${fmt(l.net, 'en', DT)} UTC, ${rocket(l)} from ${l.pad?.location?.name || ''}. Livestream, trajectory map and countdown on LaunchRadar.`,
    titleL: (l, past) => `${short(l)} – launch time, livestream & trajectory | LaunchRadar`, other: 'Deutsch', iss: 'ISS passes', issT: 'ISS passes' }
};
const CSS = `:root{--bg:#0b0f17;--panel:#121826;--line:#232c3f;--text:#e6ebf5;--mute:#8a96ad;--acc:#4ea1ff;--go:#2ecc71}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0 auto;max-width:860px;padding:20px 16px 60px;color:var(--text);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--acc)}h1{font-size:26px;line-height:1.25;margin:14px 0 6px}h2{font-size:18px;margin:28px 0 8px}
.top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.logo{font-weight:800;font-size:18px;text-decoration:none;color:var(--text);margin-right:auto}.logo span{color:var(--acc)}
.chip{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:5px 11px;text-decoration:none;color:var(--text);font-size:14px}
.btn{display:inline-block;background:var(--acc);color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}th{color:var(--mute);font-weight:600}
.mute{color:var(--mute)}.note{color:var(--mute);font-size:13px}.hero{width:100%;max-height:340px;object-fit:cover;border-radius:12px;background:#000}
.grid{display:grid;grid-template-columns:auto 1fr;gap:4px 14px}.grid b{color:var(--mute);font-weight:500}ul.l{padding-left:18px}ul.l li{margin:4px 0}
.badge{display:inline-block;padding:1px 8px;border-radius:6px;font-size:12px;font-weight:700;background:#f5b041;color:#000}`;
function page({ lang, rel, title, desc, h1, body, alt, jsonld, img }) {
  const depth = rel.split('/').length - 1, up = '../'.repeat(depth);
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${rel}">
${alt ? `<link rel="alternate" hreflang="${lang}" href="${SITE}${rel}"><link rel="alternate" hreflang="${lang === 'de' ? 'en' : 'de'}" href="${SITE}${alt}">` : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="LaunchRadar"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${rel}"><meta property="og:image" content="${esc(img || SITE + 'og-image.png')}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="${up}icons/icon-192.png"><meta name="theme-color" content="#0b0f17"><style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
${CONFIG.analyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CONFIG.analyticsToken}"}'></script>` : ''}
</head><body><div class="top"><a class="logo" href="${up}${lang === 'en' ? '?lang=en' : ''}">Launch<span>Radar</span></a>
<a class="chip" href="${up}${lang === 'en' ? 'en/launches/' : 'start/'}">${T[lang].launches}</a>${lang === 'de' ? `<a class="chip" href="${up}iss/">${T.de.iss}</a>` : ''}
${alt ? `<a class="chip" href="${up}${alt}">${T[lang].other}</a>` : ''}</div>
<h1>${h1}</h1>${body}
<p class="note" style="margin-top:40px">${T[lang].stand}: ${fmt(STAND, lang, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}${lang === 'en' ? ' UTC' : ''} · <a href="${up}datenschutz.html${lang === 'en' ? '#en' : ''}">${lang === 'en' ? 'Privacy & legal' : 'Datenschutz & Impressum'}</a> · Data: The Space Devs, CelesTrak</p>
</body></html>`;
}

// ---------- Start-Seiten ----------
const isPast = l => /success|fail|partial/i.test(l.status?.abbrev || '') || new Date(l.net) < Date.now() - 6 * 3600e3;
const all = [...up.results, ...past.results.slice(0, 30)].filter((l, i, a) => a.findIndex(x => x.id === l.id) === i);
for (const l of all) {
  const s = slug(l), p = isPast(l), img = l.image?.image_url || l.image?.thumbnail_url;
  for (const lang of ['de', 'en']) {
    const t = T[lang], rel = lang === 'de' ? `start/${s}.html` : `en/launch/${s}.html`, alt = lang === 'de' ? `en/launch/${s}.html` : `start/${s}.html`;
    const depth = rel.split('/').length - 1, upp = '../'.repeat(depth);
    const vids = (l.vid_urls || []).slice().sort((a, b) => (a.priority || 99) - (b.priority || 99)).slice(0, 4);
    const ld = { '@context': 'https://schema.org', '@type': 'Event', name: l.name, startDate: l.net, description: (l.mission?.description || t.descL(l)).slice(0, 500),
      eventStatus: /fail|cancel/i.test(l.status?.name || '') && !p ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
      location: [{ '@type': 'Place', name: l.pad?.name, address: l.pad?.location?.name, geo: { '@type': 'GeoCoordinates', latitude: +l.pad?.latitude, longitude: +l.pad?.longitude } },
        { '@type': 'VirtualLocation', url: vids[0]?.url || `${SITE}#start=${l.id}` }],
      organizer: { '@type': 'Organization', name: l.launch_service_provider?.name || '' }, ...(img ? { image: [img] } : {}),
      url: SITE + rel };
    const body = `${img ? `<img class="hero" src="${esc(img)}" alt="${esc(short(l))}" loading="lazy">` : ''}
<p><span class="badge">${esc(l.status?.name || '')}</span></p>
<div class="grid"><b>${t.time}</b><span><b style="color:var(--text)">${esc(fmt(l.net, lang, DT))}</b> ${t.tz}${lang === 'en' ? ` · <span class="lt" data-t="${l.net}"></span>` : ''}</span>
<b>${t.rocket}</b><span>${esc(rocket(l))}</span><b>${t.prov}</b><span>${esc(l.launch_service_provider?.name)}</span>
<b>${t.pad}</b><span>${esc(l.pad?.name)}, ${esc(l.pad?.location?.name)}</span>${l.mission?.orbit?.name ? `<b>${t.orbit}</b><span>${esc(l.mission.orbit.name)}</span>` : ''}
${l.mission?.type ? `<b>${t.mission}</b><span>${esc(l.mission.type)}</span>` : ''}</div>
<a class="btn" href="${upp}${lang === 'en' ? '?lang=en' : ''}#start=${l.id}">▶ ${t.live}</a>
${l.mission?.description ? `<h2>${t.mission}</h2><p>${esc(l.mission.description).replace(/\n+/g, '<br>')}</p>` : ''}
${vids.length ? `<h2>${t.streams}</h2><ul class="l">${vids.map(v => `<li><a href="${esc(v.url)}" rel="noopener">${esc(v.publisher || v.source || v.url)}</a></li>`).join('')}</ul>` : ''}
${!p ? `<p class="note">${t.est}</p>` : ''}
${lang === 'en' ? `<script>document.querySelectorAll(".lt").forEach(e=>e.textContent="your time: "+new Date(e.dataset.t).toLocaleString([], {weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}))</script>` : ''}`;
    write(rel, page({ lang, rel, alt, title: t.titleL(l, p), desc: t.descL(l), h1: esc(l.name), body, jsonld: ld, img }));
  }
}
// ---------- Übersichten ----------
const row = (l, lang, base) => `<tr><td>${esc(fmt(l.net, lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</td><td><a href="${base}${slug(l)}.html">${esc(short(l))}</a><br><span class="mute">${esc(rocket(l))}</span></td><td>${esc(l.pad?.location?.name)}</td></tr>`;
for (const lang of ['de', 'en']) {
  const t = T[lang], rel = lang === 'de' ? 'start/index.html' : 'en/launches/index.html', alt = lang === 'de' ? 'en/launches/index.html' : 'start/index.html', base = lang === 'de' ? '' : '../launch/';
  const nx = up.results.filter(l => !isPast(l)).sort((a, b) => new Date(a.net) - new Date(b.net)), rc = past.results.slice(0, 30);
  const head = `<table><tr><th>${t.time} (${t.tz})</th><th>${t.mission}</th><th>${t.pad}</th></tr>`;
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: nx.slice(0, 30).map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + (lang === 'de' ? 'start/' : 'en/launch/') + slug(l) + '.html', name: l.name })) };
  write(rel, page({ lang, rel, alt, title: `${t.launchesT} | LaunchRadar`, desc: lang === 'de' ? 'Alle kommenden Raketenstarts weltweit: SpaceX, Starship, Rocket Lab, ULA, Ariane, China und mehr – mit Startzeit in Schweizer Zeit, Livestream und Bahn.' : 'All upcoming rocket launches worldwide: SpaceX, Starship, Rocket Lab, ULA, Ariane, China and more – with launch time, livestream and trajectory.',
    h1: t.launchesT, jsonld: ld, body: `<a class="btn" href="../${lang === 'en' ? '../?lang=en' : ''}">▶ ${t.home}</a><h2>${t.next}</h2>${head}${nx.map(l => row(l, lang, base)).join('')}</table><h2>${t.recent}</h2>${head}${rc.map(l => row(l, lang, base)).join('')}</table>` }));
}

// ---------- ISS-Überflüge für Städte ----------
const CITIES = [['Zürich', 47.377, 8.541], ['Genf', 46.204, 6.143], ['Basel', 47.560, 7.588], ['Bern', 46.948, 7.447], ['Lausanne', 46.520, 6.633], ['Luzern', 47.050, 8.309],
  ['St. Gallen', 47.424, 9.377], ['Lugano', 46.004, 8.951], ['Aarau', 47.392, 8.044], ['Winterthur', 47.500, 8.724], ['Chur', 46.849, 9.532],
  ['Berlin', 52.520, 13.405], ['Hamburg', 53.551, 9.994], ['München', 48.137, 11.576], ['Köln', 50.938, 6.960], ['Frankfurt', 50.110, 8.682], ['Stuttgart', 48.776, 9.183],
  ['Düsseldorf', 51.227, 6.773], ['Leipzig', 51.340, 12.375], ['Wien', 48.208, 16.373], ['Graz', 47.071, 15.439], ['Salzburg', 47.809, 13.055], ['Innsbruck', 47.269, 11.404]];
const tleTxt = fs.readFileSync(path.join(ROOT, 'data/tle/stations.txt'), 'utf8').split(/\r?\n/);
const iI = tleTxt.findIndex(s => /ISS \(ZARYA\)/.test(s)), iss = satellite.twoline2satrec(tleTxt[iI + 1], tleTxt[iI + 2]);
const D = 180 / Math.PI, RE = 6371;
function sun(d) { const n = d / 864e5 + 2440587.5 - 2451545, r = Math.PI / 180, L0 = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) * r, lam = (L0 + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r, eps = (23.439 - 4e-7 * n) * r;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), gmst = (280.46061837 + 360.98564736629 * n) % 360;
  return { dec: dec / r, lon: ((ra / r - gmst + 540) % 360) - 180, eci: [Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam)] }; }
const sunEl = (t, la, lo) => { const s = sun(t), r = Math.PI / 180; return Math.asin(Math.sin(la * r) * Math.sin(s.dec * r) + Math.cos(la * r) * Math.cos(s.dec * r) * Math.cos((lo - s.lon) * r)) / r; };
const lit = (p, t) => { const s = sun(t).eci, dot = p.x * s[0] + p.y * s[1] + p.z * s[2]; return dot > 0 || Math.sqrt(Math.max(0, p.x * p.x + p.y * p.y + p.z * p.z - dot * dot)) > 6378; };
const look = (t, obs) => { const d = new Date(t), pv = satellite.propagate(iss, d); if (!pv || !pv.position) return null; const la = satellite.ecfToLookAngles(obs, satellite.eciToEcf(pv.position, satellite.gstime(d))); return { el: la.elevation * D, az: (la.azimuth * D + 360) % 360, pos: pv.position }; };
const CMP = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'], cmp = a => CMP[Math.round(a / 45) % 8];
function passes(lat, lon) {
  const obs = { latitude: lat / D, longitude: lon / D, height: 0.4 }, out = [], t0 = Date.now(); let prev = -90, up = null;
  for (let t = t0; t < t0 + 10 * 864e5; t += 30e3) { const l = look(t, obs), e = l ? l.el : -90;
    if (prev <= 0 && e > 0) up = t;
    if (prev > 0 && e <= 0 && up) { let best = -90, vs = null, ve = null, vmax = 0, az0, az1;
      for (let u = up - 30e3; u <= t; u += 5e3) { const q = look(u, obs); if (!q) continue; if (q.el > best) best = q.el;
        const v = q.el >= 10 && lit(q.pos, new Date(u)) && sunEl(new Date(u), lat, lon) < -6; if (v) { if (vs === null) { vs = u; az0 = q.az; } ve = u; az1 = q.az; vmax = Math.max(vmax, q.el); } }
      if (vs !== null && ve - vs >= 60e3) out.push({ vs, ve, vmax, az0, az1 }); up = null; }
    prev = e; }
  return out;
}
const tz = c => /Wien|Graz|Salzburg|Innsbruck|Berlin|Hamburg|München|Köln|Frankfurt|Stuttgart|Düsseldorf|Leipzig/.test(c) ? 'Europe/Berlin' : 'Europe/Zurich';
const cslug = c => c.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const [c, la, lo] of CITIES) {
  const P = passes(la, lo), z = tz(c), f = (t, o) => new Date(t).toLocaleString('de-CH', { timeZone: z, ...o });
  const rel = `iss/${cslug(c)}.html`;
  const rows = P.map(p => `<tr><td>${f(p.vs, { weekday: 'short', day: '2-digit', month: '2-digit' })}</td><td>${f(p.vs, { hour: '2-digit', minute: '2-digit' })} – ${f(p.ve, { hour: '2-digit', minute: '2-digit' })}</td><td>${Math.round(p.vmax)}°</td><td>von ${cmp(p.az0)} nach ${cmp(p.az1)}</td></tr>`).join('');
  const nxt = P[0] ? `Der nächste sichtbare Überflug: <b>${f(P[0].vs, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} Uhr</b>, bis ${Math.round(P[0].vmax)}° hoch, von ${cmp(P[0].az0)} nach ${cmp(P[0].az1)}.` : 'In den nächsten 10 Tagen gibt es keinen gut sichtbaren Überflug (Tageslicht oder Erdschatten).';
  write(rel, page({ lang: 'de', rel, title: `ISS sichtbar über ${c} – nächste Überflüge | LaunchRadar`, desc: `Wann ist die ISS über ${c} zu sehen? Alle sichtbaren Überflüge der nächsten 10 Tage mit Uhrzeit, Höhe und Richtung – jede Nacht neu berechnet.`,
    h1: `ISS sichtbar über ${c}`, body: `<p>${nxt}</p><a class="btn" href="../#iss=${la},${lo}">▶ Live auf der Karte & Himmelskarte</a>
<h2>Sichtbare Überflüge der nächsten 10 Tage</h2>${P.length ? `<table><tr><th>Tag</th><th>Zeit</th><th>Max. Höhe</th><th>Richtung</th></tr>${rows}</table>` : '<p class="mute">Keine.</p>'}
<p class="note">Sichtbar = ISS von der Sonne beleuchtet, bei dir Dämmerung oder Nacht, mindestens 10° über dem Horizont. Berechnet mit dem SGP4-Modell aus aktuellen Bahndaten (CelesTrak); Zeiten können um wenige Minuten abweichen. Die ISS sieht aus wie ein heller, ruhig wandernder Stern ohne Blinken.</p>
<h2>Andere Städte</h2><p>${CITIES.filter(x => x[0] !== c).map(x => `<a href="${cslug(x[0])}.html">${x[0]}</a>`).join(' · ')}</p>` }));
}
write('iss/index.html', page({ lang: 'de', rel: 'iss/index.html', title: 'ISS sichtbar – Überflüge für die Schweiz, Deutschland & Österreich | LaunchRadar',
  desc: 'Wann kann man die ISS sehen? Sichtbare Überflüge für Zürich, Bern, Basel, Genf, Berlin, München, Wien und weitere Städte – jede Nacht neu berechnet.',
  h1: 'ISS-Überflüge: wann ist die Raumstation sichtbar?', body: `<p>Die Internationale Raumstation ist mit blossem Auge als heller, wandernder Punkt zu sehen – am besten kurz nach Sonnenuntergang oder vor Sonnenaufgang. Wähle deine Stadt oder nutze die App mit deinem genauen Standort.</p>
<a class="btn" href="../">▶ Mit meinem Standort in der App</a><h2>Städte</h2><ul class="l">${CITIES.map(x => `<li><a href="${cslug(x[0])}.html">ISS über ${x[0]}</a></li>`).join('')}</ul>` }));

// ---------- Startseite: Liste der nächsten Starts (Links) in den Beschreibungsblock einsetzen ----------
{
  const f = path.join(DIST, 'index.html'), nx = up.results.filter(l => !isPast(l)).sort((a, b) => new Date(a.net) - new Date(b.net)).slice(0, 15);
  const list = `<h2>Nächste Raketenstarts / Upcoming launches</h2><ul>${nx.map(l => `<li><a href="start/${slug(l)}.html">${esc(l.name)}</a> – ${esc(fmt(l.net, 'de', DT))}</li>`).join('')}</ul>`;
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('<!--SEOLIST-->', list));
}
// ---------- Sitemap ----------
const day = new Date().toISOString().slice(0, 10);
const urls = ['', '?lang=en', 'datenschutz.html', ...pages.sort()];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${day}</lastmod>${u === '' ? '<priority>1.0</priority>' : ''}</url>`).join('\n') + '\n</urlset>\n');
console.log(`SEO-Seiten: ${pages.length} (${all.length} Starts × 2 Sprachen, ${CITIES.length} ISS-Städte), Sitemap: ${urls.length} Adressen`);
