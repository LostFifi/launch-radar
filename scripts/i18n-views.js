// Gemeinsame Helfer für i18n-harvest.js und smoke.js: Server, Browser, Wetter-Attrappe und „alle Ansichten durchklicken“.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const DIST = path.resolve(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function startServer() {
  const server = http.createServer((req, res) => {
    const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
    if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}
async function launchBrowser() {
  const tries = process.env.CI ? [{ channel: 'chrome' }, {}] : [{ channel: 'msedge' }, { channel: 'chrome' }, {}];
  for (const o of tries) { try { return await chromium.launch(o); } catch (e) { } }
  throw new Error('Kein Browser gefunden (Edge/Chrome installieren)');
}
// Wetter-Vorhersage simulieren (damit der Wetter-Abschnitt auch offline erscheint), mit Gewitter für alle Warnungen
async function mockWeather(ctx) {
  await ctx.route(/api\.open-meteo\.com/, r => {
    const now = new Date(); now.setUTCMinutes(0, 0, 0); const time = [], N = 16 * 24;
    for (let i = -48; i < N; i++) time.push(new Date(now.getTime() + i * 3600e3).toISOString().slice(0, 16));
    const f = v => time.map(() => v);
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ hourly: { time, temperature_2m: f(24), precipitation_probability: f(70), cloud_cover: f(95), wind_speed_10m: f(35), wind_gusts_10m: f(60), wind_direction_10m: f(200), cape: f(1500), weather_code: f(95), wind_speed_250hPa: f(220) } }) });
  });
}
// Klickt alle Ansichten durch und sammelt nach jeder Ansicht deutsche Texte (findGerman) + alles, was i18n() unübersetzt zurückgab
// all=true: ALLE angezeigten Texte sammeln (ausser solchen aus den API-Daten) – für die vollständige Liste
async function visitAll(page, all) {
  await page.waitForFunction(() => typeof launches !== 'undefined' && launches.length > 0, null, { timeout: 30000 });
  return page.evaluate(async (all) => {
    const found = new Set(), wait = ms => new Promise(r => setTimeout(r, ms));
    const apiBlob = JSON.stringify([launches, PAST_SNAP, ROCKETS.map(r => [r.n, r.v, r.fam, r.man, r.d])]);
    const isUi = s => s && /[A-Za-zÄÖÜäöü]{2}/.test(s) && !apiBlob.includes(JSON.stringify(s).slice(1, -1)) && !/^(T[+−]|https?:)/.test(s);
    const orig = i18n; window.i18n = (s, d) => { const r = orig(s, d); const x = String(s ?? '').trim(); if (r === s && x && isUi(x) && (all || DE_HINT.test(x))) found.add(x); return r; };
    const grabAll = () => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.currentNode; n; n = w.nextNode()) {
        if (n.nodeType === 1) { if (n.closest('[translate=no],script,style')) continue; for (const a of ['title', 'placeholder', 'aria-label']) { const v = n.getAttribute(a); if (v && isUi(v.trim()) && i18n(v) === v) found.add(v.trim()); } }
        else if (n.parentElement && !n.parentElement.closest('[translate=no],script,style')) { const v = n.nodeValue.trim(); if (isUi(v) && orig(v) === v) found.add(v); } } };
    const grab = () => all ? grabAll() : findGerman(document.body).filter(isUi).forEach(s => found.add(s));
    const step = async (fn, ms = 250) => { try { await fn(); } catch (e) { found.add('!! Fehler in Ansicht: ' + e.message); } await wait(ms); grab(); };
    grab();
    const up = launches.filter(l => new Date(l.net) > Date.now()).sort((a, b) => new Date(a.net) - new Date(b.net));
    const base = JSON.parse(JSON.stringify(launches.find(x => /falcon 9/i.test(x.rocket?.configuration?.name || '')) || launches[0]));
    HOME = { lat: 28.4, lon: -80.7 };
    await step(() => select(up[0] || launches[0]), 1200);                                  // kommender Start inkl. Wetter + Sichtbarkeit
    await step(() => { const s = document.getElementById('sim'); s.value = 200; s.oninput(); });
    await step(() => document.getElementById('play').click(), 400); await step(() => document.getElementById('play').click());
    for (const l of launches.slice(0, 40)) { await step(() => select(l), 60); }            // alle Starts: Profile, Landungen, Stufen
    for (const l of (await loadPast()).slice(0, 15)) { await step(() => select(l), 60); }  // vergangene: Rückblick
    const fake = (o) => ({ ...base, ...o, mission: { ...base.mission, ...(o.mission || {}) } });
    await step(() => select(fake({ id: 'x-moon', name: 'Falcon 9 | IM-3 Lunar Lander', net: new Date(Date.now() - 2 * 864e5).toISOString(), status: { abbrev: 'Success', name: 'Launch Successful' }, mission: { name: 'IM-3', orbit: { abbrev: 'TLI', name: 'Trans Lunar Injection' }, description: 'Lunar lander' } })));
    await step(() => select(fake({ id: 'x-moon2', name: 'Falcon 9 | Moon', net: new Date(Date.now() + 2 * 864e5).toISOString(), mission: { orbit: { abbrev: 'TLI', name: 'TLI' }, description: 'low-energy lunar transfer' } })));
    await step(() => select(fake({ id: 'x-mars', name: 'Falcon Heavy | Mars Orbiter', net: new Date(Date.now() - 30 * 864e5).toISOString(), status: { abbrev: 'Success', name: 'Launch Successful' }, mission: { orbit: { abbrev: 'HCO', name: 'Heliocentric' }, description: 'Mars orbiter transfer' } })));
    await step(() => select(fake({ id: 'x-l2', name: 'Ariane 6 | Telescope', net: new Date(Date.now() - 10 * 864e5).toISOString(), status: { abbrev: 'Failure', name: 'Launch Failure' }, failreason: 'x', mission: { orbit: { abbrev: 'L2', name: 'L2' } } })));
    await step(() => select(fake({ id: 'x-l1', name: 'Falcon 9 | Solar', net: new Date(Date.now() - 5 * 864e5).toISOString(), status: { abbrev: 'Partial Failure', name: 'Partial' }, mission: { orbit: { abbrev: 'L1', name: 'L1' } } })));
    TELEST['x-moon'] = { at: Date.now(), s2: [[60, 10, 1500], [300, 150, 14500]], s1: [[60, 10, 1500], [150, 66, 8000]] };
    await step(() => select(fake({ id: 'x-moon', name: 'Falcon 9 | IM-3', net: new Date(Date.now() - 2 * 864e5).toISOString(), status: { abbrev: 'Success', name: 'Launch Successful' } })));
    NETH['x-shift'] = { first: new Date(Date.now() + 864e5).toISOString(), prev: new Date(Date.now() + 864e5).toISOString(), net: new Date(Date.now() + 2 * 864e5).toISOString(), at: Date.now(), n: 2, seen: Date.now() };
    await step(() => select(fake({ id: 'x-shift', name: 'Falcon 9 | Shift', net: new Date(Date.now() + 2 * 864e5).toISOString() })));
    await step(() => select(fake({ id: 'x-late', name: 'Falcon 9 | Late', net: new Date(Date.now() - 30 * 60e3).toISOString(), status: { abbrev: 'Go', name: 'Go for Launch' } })));
    await step(() => { launches.push(fake({ id: 'x-late2', name: 'Falcon 9 | Late', net: new Date(Date.now() - 30 * 60e3).toISOString(), status: { abbrev: 'Go', name: 'Go' } })); liveId = 'x-late2'; liveBanner(); });
    await step(() => { const l = launches.at(-1); l.status = { abbrev: 'In Flight', name: 'In Flight' }; liveBanner(); });
    launches.pop();
    HOME = null; await step(() => select(up[0] || launches[0]));
    await step(() => showStartList('up'), 400); await step(() => showStartList('past'), 600);
    await step(async () => { FILT.cty = 'China'; await applyListFilter(); }); FILT = { q: '', prov: '', cty: '' };
    await step(async () => { FILT.q = 'zzzz'; await applyListFilter(); }); FILT = { q: '', prov: '', cty: '' }; render();
    await step(() => openGroup(padGroups.find(g => g.length > 1) || padGroups[0]));
    await step(() => openStats(), 400);
    await step(() => openDB(), 400);
    await step(() => openCompare(ROCKETS.slice(0, 3).map(r => r.id)), 400);
    await step(() => { document.getElementById('layerBtn').click(); });
    SUBS = [{ chip: 'starship', prov: '', cty: '', q: '' }, { chip: '', prov: 'SpaceX', cty: 'USA', q: 'crew' }];
    await step(() => buildLayerMenu()); SUBS = [];
    await step(() => document.getElementById('layerBtn').click());
    HOME = null; await step(() => openPasses());
    HOME = { lat: 47.39, lon: 8.04 }; await step(() => openPasses(), 2500);
    await step(() => { PASS.all = true; renderPasses(); }); await step(() => { PASS.open = 0; renderPasses(); });
    await step(() => { PASS.sat = 'css'; openPasses(); }, 2500); PASS.sat = 'iss';
    await step(async () => { await loadSats('stations'); selectSat(SATS.stations.find(s => /ISS \(ZARYA/.test(s.name)), 'stations'); });
    await step(async () => { await loadSats('stations'); selectSat(SATS.stations[5], 'stations'); });
    await step(() => openTele());
    await step(() => { TELE.auto = false; buildTeleBox(); teleUI(); });
    await step(() => { TELE.S.s2.hist = [[10, 2, 500], [60, 10, 1500]]; TELE.S.s2.v = 1500; TELE.S.s2.h = 10; TELE.S.s2.last = { t: Date.now() }; teleUI(); });
    await step(() => { TELE.on = true; teleEnd(); }); await step(() => teleStop());
    await step(() => openPip('dQw4w9WgXcQ', 'Test')); await step(() => closePip());
    await step(() => { document.getElementById('globeBtn').click(); }); await step(() => { document.getElementById('globeBtn').click(); });
    await step(() => document.getElementById('listBtn').click()); await step(() => closeP());
    // Meldungen/Benachrichtigungen, die nur über i18n() laufen
    const msgs = ['loadSats', 'toggle'];
    await step(() => { toggleRem(up[0].id); toggleRem(up[0].id); });
    await step(() => { DATA.src = 'dev'; DATA.stand = Date.now(); liveBanner(); }); await step(() => { DATA.src = 'cache'; DATA.limited = true; liveBanner(); });
    await step(() => { setSpeed(60); }); await step(() => simReset());
    await step(() => { PWA.prompt = {}; buildLayerMenu(); PWA.prompt = null; });
    return [...found];
  }, !!all);
}
module.exports = { startServer, launchBrowser, mockWeather, visitAll, DIST };
