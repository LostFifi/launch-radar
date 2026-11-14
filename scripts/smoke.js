// Smoke-Test: öffnet dist/index.html in einem echten Browser und klickt die wichtigsten Funktionen durch.
// Externe Server werden blockiert → die App muss mit dem eingebetteten Schnappschuss laufen (Offline-Fall).
// Schlägt fehl bei JavaScript-Fehlern oder wenn eine Funktion nicht das Erwartete zeigt.
//   npm test                 (lokal: nutzt Edge oder Chrome; bei GitHub: Chromium von Playwright)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const DIST = path.resolve(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});

async function launchBrowser() {
  const tries = process.env.CI ? [{ channel: 'chrome' }, {}] : [{ channel: 'msedge' }, { channel: 'chrome' }, {}];
  for (const o of tries) { try { return await chromium.launch(o); } catch (e) { /* nächster */ } }
  throw new Error('Kein Browser gefunden (Edge/Chrome installieren oder: npx playwright-core install chromium)');
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await launchBrowser();
  const errors = [], results = [];
  const check = (name, ok, info = '') => { results.push(`${ok ? '✓' : '✗'} ${name}${info ? ' – ' + info : ''}`); if (!ok) errors.push(name); };
  try {
    for (const vp of [{ name: 'Desktop', width: 1280, height: 800 }, { name: 'Handy', width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', locale: 'de-CH' });
      await ctx.route(u => !u.href.startsWith(base), r => r.abort());       // alles Externe blockieren
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(`[${vp.name}] JS-Fehler: ${e.message}`));
      await page.goto(base + '?lang=de', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof launches !== 'undefined' && launches.length > 0, null, { timeout: 30000 });
      const r = await page.evaluate(async () => {
        const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
        out.launches = launches.length; out.sites = padGroups.length; out.src = DATA.src;
        const l = launches.find(x => /falcon 9/i.test(x.rocket?.configuration?.name || '')) || launches[0];
        select(l); await wait(200);
        out.detail = !!document.querySelector('#panel .simtop') && !!curTrack && curTrack.track.length > 10;
        out.profile = !!document.querySelector('#panel svg');
        out.hash = location.hash.includes(l.id);
        const s = document.getElementById('sim'); s.value = 300; s.oninput(); out.rocket = !!curPos;
        openGroup(padGroups.find(g => g.length > 1) || padGroups[0]); await wait(100);
        out.list = document.querySelectorAll('#panel .item').length;
        await showStartList('up'); const n0 = document.querySelectorAll('#panel .item').length;
        FILT.q = 'falcon'; await applyListFilter(); const n1 = document.querySelectorAll('#panel .item').length;
        FILT.q = ''; FILT.cty = 'China'; await applyListFilter(); const n2 = document.querySelectorAll('#panel .item').length;
        FILT = { q: '', prov: '', cty: '' }; render();
        out.filter = `${n0} alle, ${n1} Falcon, ${n2} China`; out.filterOk = n0 > 0 && n1 > 0 && n1 < n0 && n2 < n0;
        openStats(); await wait(200); out.stats = document.getElementById('panel').innerText.length > 100;
        openDB(); await wait(200); out.db = document.querySelectorAll('#panel table.db tr').length;
        const g0 = G.on; out.globeDefault = g0; document.getElementById('globeBtn').click(); await wait(300); out.globe = G.on !== g0; document.getElementById('globeBtn').click();
        document.getElementById('layerBtn').click(); await wait(100); out.layers = document.querySelectorAll('#layers input').length;
        // Mond/Mars (künstliche Starts) und Rückblick mit gespeicherter Messung
        const base = JSON.parse(JSON.stringify(launches.find(x => /falcon 9/i.test(x.rocket?.configuration?.name || '')) || launches[0]));
        const moon = { ...base, id: 'test-moon', name: 'Falcon 9 | IM-3 Lunar Lander', net: new Date(Date.now() - 2 * 864e5).toISOString(), status: { abbrev: 'Success', name: 'Launch Successful' }, mission: { ...base.mission, name: 'IM-3', orbit: { abbrev: 'TLI', name: 'Trans Lunar Injection' }, description: 'Lunar lander' } };
        const mars = { ...base, id: 'test-mars', name: 'Falcon Heavy | Mars Orbiter', net: new Date(Date.now() + 5 * 864e5).toISOString(), mission: { ...base.mission, orbit: { abbrev: 'HCO', name: 'Heliocentric' }, description: 'Mars orbiter transfer' } };
        TELEST['test-moon'] = { at: Date.now(), s2: [[60, 10, 1500], [150, 68, 8100], [300, 150, 14500]], s1: [[60, 10, 1500], [150, 66, 8000]] };
        select(moon); await wait(150);
        out.moon = !!document.querySelector('#panel svg[aria-label="Reise zum Mond"]');
        out.review = /Rückblick/i.test(document.getElementById('panel').innerText) && /Deine Messung/i.test(document.getElementById('panel').innerText);
        select(mars); await wait(150); out.mars = !!document.querySelector('#panel svg[aria-label="Reise zum Mars"]');
        // Abo: Filter abonnieren → passende Starts bekommen Erinnerung
        const nREM = Object.keys(REM).length; filter = 'spacex'; FILT = { q: '', prov: '', cty: '' }; window.confirm = () => true;
        subscribeFilter(); const nAuto = Object.values(REM).filter(r => r.auto).length;
        SUBS = []; saveSubs(); filter = 'all'; render(); out.subs = nAuto > 0 && Object.values(REM).filter(r => r.auto).length === 0; out.subsInfo = `${nAuto} Auto-Erinnerungen, danach entfernt`;
        HOME = { lat: 47.39, lon: 8.04 }; openPasses(); await wait(3000);
        out.passes = document.querySelectorAll('#panel .pass').length + ' Überflüge';
        const v = launchView(l, estimateProfile(l)); out.view = !!(v && v.verdict);
        closeP(); return out;
      });
      check(`[${vp.name}] Starts geladen`, r.launches > 0, `${r.launches} (${r.src}), ${r.sites} Startorte`);
      check(`[${vp.name}] Startfenster + Bahn`, r.detail && r.rocket);
      check(`[${vp.name}] Aufstiegsprofil`, r.profile);
      check(`[${vp.name}] Link #start=`, r.hash);
      check(`[${vp.name}] Startort-Liste`, r.list > 0, `${r.list} Einträge`);
      check(`[${vp.name}] Suche + Filter`, r.filterOk, r.filter);
      check(`[${vp.name}] Statistik`, r.stats);
      check(`[${vp.name}] Raketen-Datenbank`, r.db > 10, `${r.db} Zeilen`);
      check(`[${vp.name}] Globus (Standard) + Karte umschalten`, r.globe && r.globeDefault);
      check(`[${vp.name}] Ebenen-Menü`, r.layers > 5);
      check(`[${vp.name}] ISS-Überflüge`, /\d/.test(r.passes), r.passes);
      check(`[${vp.name}] Start-Sichtbarkeit vom Standort`, r.view);
      check(`[${vp.name}] Reise zum Mond`, r.moon);
      check(`[${vp.name}] Reise zum Mars`, r.mars);
      check(`[${vp.name}] Rückblick mit eigener Messung`, r.review);
      check(`[${vp.name}] Abo anlegen/entfernen`, r.subs, r.subsInfo);
      // gegen die echte Fensterbreite prüfen (innerWidth wächst auf dem Handy mit, wenn etwas übersteht) + Globus-Grösse
      const wide = await page.evaluate(w => { const was = G.on; setGlobe(true, false); gResize(); const g = document.getElementById('globe').getBoundingClientRect();
        const r = Math.max(document.documentElement.scrollWidth, innerWidth, g.width) - w; setGlobe(was, false); return r; }, vp.width);
      check(`[${vp.name}] kein seitliches Scrollen`, wide <= 1, wide > 1 ? `${wide}px zu breit` : '');
      await ctx.close();
    }
    // Offline-Datei (alles eingebettet) und ausgelagerte Reserve-Daten der Online-Version
    const ctx = await browser.newContext({ serviceWorkers: 'block', locale: 'de-CH' });
    await ctx.route(u => !u.href.startsWith(base), r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[Offline-Datei] JS-Fehler: ${e.message}`));
    await page.goto(base + 'launchradar-offline.html?lang=de');
    await page.waitForFunction(() => typeof launches !== 'undefined' && launches.length > 0, null, { timeout: 30000 });
    const off = await page.evaluate(async () => ({ tle: !!TLE_SNAP, img: !!IMG_SNAP }));
    check('[Offline-Datei] lädt mit eingebetteten Reserve-Daten', off.tle && off.img);
    await page.goto(base);
    await page.waitForFunction(() => typeof launches !== 'undefined' && launches.length > 0, null, { timeout: 30000 });
    const on = await page.evaluate(async () => { const t = await snapData('tle'), i = await snapData('img'); return { inline: TLE_SNAP !== null, tle: !!(t && t.starlink), img: !!(i && Object.keys(i).length) }; });
    check('[Online] Reserve-Daten ausgelagert und nachladbar', !on.inline && on.tle && on.img);
    // Mit eingetragenem Worker: App holt die Starts dort (simulierter Worker)
    await page.route(base + 'mockworker/launches', r => r.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ ts: Date.now(), results: [{ id: 'w1', name: 'Worker | Test', net: new Date(Date.now() + 864e5).toISOString(), status: { abbrev: 'Go', name: 'Go' },
        pad: { id: 1, name: 'SLC-40', latitude: '28.56', longitude: '-80.58', location: { name: 'Cape Canaveral SFS, FL, USA' } }, rocket: { configuration: { name: 'Falcon 9' } } }] }) }));
    const w = await page.evaluate(async b => { CONFIG.worker = b + 'mockworker'; localStorage.removeItem('lr_cache'); await load(); return { via: DATA.via, n: launches.length, name: launches[0].name }; }, base);
    check('[Worker] App nutzt eingetragenen Worker', w.via === 'worker' && w.name === 'Worker | Test');
    // Feedback: Karte öffnen, Sterne + Wunsch, senden → Worker bekommt die Daten; Messung ist in Tests aus
    let fbBody = null;
    await page.route(base + 'mockworker/feedback', r => { fbBody = JSON.parse(r.request().postData()); r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); });
    const fbr = await page.evaluate(async () => { fbOpen(); document.querySelector('#fb .fbstars button[data-r="4"]').click();
      document.getElementById('fbWish').value = 'Mehr Raketen'; await fbSend(); await new Promise(r => setTimeout(r, 300));
      return { gone: !document.getElementById('fb'), use: USE.on, menu: infoMenuHtml().includes('fbOpen()'),
        // auf der echten Seite (gleicher Host wie siteUrl, normaler Browser) muss die Messung an sein
        live: useAllowed({ host: new URL(CONFIG.siteUrl).host }, {}), dnt: useAllowed({ host: new URL(CONFIG.siteUrl).host }, { doNotTrack: '1' }) }; });
    const evr = await page.evaluate(() => { const l = launches.find(x => !x.timeline?.length) || launches[0]; select(l);
      const ev = curTrack.events || [], tl = document.querySelectorAll('#tlList li').length, tip = [...document.querySelectorAll('#tlList li')].every(li => /\d{2}:\d{2}/.test(li.dataset.tip || '')); return { n: ev.length, tl, tip, pay: ev.some(e => e.kind === 'pay') }; });
    const hero = await page.evaluate(async () => { closeP(); updateNext(); const h = document.getElementById('hero'); if (!h) return { e: 'keine Startkarte' };
      const r = { vis: h.style.display !== 'none', cd: /T[−+] /.test(document.getElementById('heroCd').textContent), chip: document.getElementById('next').style.display === 'none' };
      document.getElementById('heroGo').click(); updateNext(); r.go = !!selected && h.style.display === 'none'; closeP(); updateNext(); r.back = h.style.display !== 'none';
      heroClose(); r.x = h.style.display === 'none' && document.getElementById('next').style.display === ''; HERO.off = false; return r; });
    check('[Start] Startkarte: Countdown, Verfolgen, Schliessen', hero.vis && hero.cd && hero.chip && hero.go && hero.back && hero.x, JSON.stringify(hero));
    const shr = await page.evaluate(async () => { const all = (await (await fetch('data/upcoming.json')).json()).results, l = all.find(x => typeof SHARE_IDS !== 'undefined' && SHARE_IDS.includes(x.id.slice(0, 6))); if (!l) return { u: 'keine SHARE_IDS' };
      const u = launchUrl(l), r = await fetch(u), t = await r.text(); return { u, ok: /\/s\/[0-9a-f]{6}\.html$/.test(u) && r.ok && /og:image" content="[^"]*og\/[0-9a-f]{6}\.jpg/.test(t) && t.includes('#start=' + l.id) }; });
    check('[Teilen] kurzer Link mit eigenem Vorschaubild', shr.ok, shr.u);
    const gal = await page.evaluate(async () => { const r = ROCKETS.find(x => x.n === 'Falcon 9') || ROCKETS[0]; openRocket(r.id); await new Promise(z => setTimeout(z, 600));
      const tx = document.getElementById('panel').textContent, ok = /Bildergalerie/.test(tx) && /Flüge/.test(tx);
      openLightbox([{ src: 'a.jpg' }, { src: 'b.jpg' }], 0); lbStep(1); const lb = document.getElementById('lbox'), i = LB.i, vis = lb.style.display; closeLightbox();
      openDB(); const nm = document.querySelector('#dbT .rname'); nm.click(); const prof = !!document.getElementById('rThumbs');
      return { ok, lb: vis === 'flex' && i === 1, prof }; });
    check('[Raketen] Steckbrief, Name-Klick, Vollbild-Galerie', gal.ok && gal.lb && gal.prof, JSON.stringify(gal));
    const grp = await page.evaluate(async () => { const all = visible().length, sxN = launches.filter(l => launchGroup(l) === 'spacex').length; document.getElementById('grpBtn').click();
      const rows = document.querySelectorAll('#grpMenu input[data-g]').length, checked = document.querySelectorAll('#grpMenu input[data-g]:checked').length;
      const sx = document.querySelector('#grpMenu input[data-g=spacex]'); sx.click(); const noSx = visible().length, lab = document.querySelector('#grpBtn .lbl').textContent;
      const rule = currentRule(), ok = !rule.grp.includes('spacex') && visible().every(l => launchGroup(l) !== 'spacex');
      document.querySelector('#grpMenu .gmh button').click(); const back = visible().length; document.body.click();
      return { all, sxN, rows, checked, noSx, lab, ok, back, open: document.getElementById('grpMenu').style.display }; });
    check('[Filter] Ein Knopf, alle Anbieter angehakt, einzeln abwählbar', grp.rows === 11 && grp.checked === 11 && grp.ok && grp.noSx === grp.all - grp.sxN && grp.back === grp.all && /ausser/.test(grp.lab) && grp.open === 'none', JSON.stringify(grp));
    const tel = await page.evaluate(async () => { const keep = selected; selected = null; TELE.S = { s1: teleStage(), s2: teleStage() }; TELE.t0 = Date.now() - 1000;
      teleAccept('s2', 26450, 4, 'falsch'); const seq = [];
      for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 300)); teleAccept('s2', 26451, 256, 'ok'); seq.push(TELE.S.s2.h); }
      const r = { seq, resync: TELE.S.s2.resync || 0 }; selected = keep; return r; });
    check('[Telemetrie] falscher Erstwert blockiert nicht – rastet auf 256 km ein', tel.seq[tel.seq.length - 1] === 256 && tel.resync >= 1, JSON.stringify(tel));
    check('[Flugbahn] Ereignis-Punkte + Timeline (mit Uhrzeit) auch ohne API-Timeline', evr.n >= 3 && evr.tl >= 3 && evr.pay && evr.tip, evr.n + ' Punkte');
    check('[Feedback] Sterne + Wunsch gesendet, Messung in Tests aus', fbr.gone && fbBody && fbBody.r === 4 && fbBody.wish === 'Mehr Raketen' && !fbr.use && fbr.menu);
    check('[Messung] auf der echten Seite aktiv, bei Do Not Track aus', fbr.live === true && fbr.dnt === false);
    await ctx.close();
    // Teilen-Vorschau, Datenschutz-Seite, Suchmaschinen, „Alle Daten löschen“
    {
      const ctx3 = await browser.newContext({ serviceWorkers: 'block', locale: 'de-CH' });
      await ctx3.route(u => !u.href.startsWith(base), r => r.abort());
      const p3 = await ctx3.newPage(); await p3.goto(base + '?lang=de');
      await p3.waitForFunction(() => typeof launches !== 'undefined' && launches.length > 0);
      const og = await p3.evaluate(() => ({ img: document.querySelector('meta[property="og:image"]')?.content, url: document.querySelector('meta[property="og:url"]')?.content }));
      check('[Teilen] Vorschau-Angaben (og:image absolut)', /^https:\/\/.+\/og-image\.png$/.test(og.img || '') && /^https:\/\//.test(og.url || ''), og.img);
      const files = await p3.evaluate(async () => { const st = async f => (await fetch(f)).status; return { og: await st('og-image.png'), ds: await (await fetch('datenschutz.html')).text(), robots: await st('robots.txt'), sitemap: await st('sitemap.xml') }; });
      check('[Datenschutz] Seite vorhanden (DE + EN, Kontakt)', files.ds.includes('id="de"') && files.ds.includes('id="en"') && files.ds.includes('github.com/LostFifi/launch-radar/issues') && !files.ds.includes('/*SITEURL*/'));
      check('[Teilen] og-image.png, robots.txt, sitemap.xml', files.og === 200 && files.robots === 200 && files.sitemap === 200);
      // Suchmaschinen-Seiten: Start-Seiten (DE/EN) mit Event-Daten, ISS-Städte, Sitemap, Direktlink #iss=
      const seo = await p3.evaluate(async () => {
        const sm = await (await fetch('sitemap.xml')).text(), locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
        const startUrl = locs.find(u => /\/start\/[^/]+\.html$/.test(u) && !u.endsWith('index.html')), rel = startUrl.split('/launch-radar/')[1] || startUrl.replace(/^https?:\/\/[^/]+\//, '');
        const sp = await (await fetch(rel)).text(), ip = await (await fetch('iss/zuerich.html')).text();
        const ld = JSON.parse(sp.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1]);
        return { n: locs.length, event: ld['@type'] === 'Event' && !!ld.startDate, hreflang: sp.includes('hreflang="en"'), iss: /ISS sichtbar über Zürich/.test(ip) && /#iss=47\.377,8\.541/.test(ip),
          home: document.getElementById('seo')?.innerText.includes('Raketenstarts live') };
      });
      check('[Suche] Sitemap mit allen Seiten', seo.n > 100, seo.n + ' Adressen');
      check('[Suche] Start-Seite mit Event-Daten + Sprachversion', seo.event && seo.hreflang);
      check('[Suche] ISS-Städte-Seite + Startseiten-Text', seo.iss && seo.home);
      await p3.evaluate(() => { location.hash = 'iss=47.377,8.541'; });
      await p3.waitForTimeout(3500);
      const ih = await p3.evaluate(() => ({ home: HOME, passes: document.querySelectorAll('#panel .pass').length }));
      check('[Suche] Direktlink #iss= öffnet Überflüge', ih.home && Math.abs(ih.home.lat - 47.38) < 0.02 && ih.passes > 0, ih.passes + ' Überflüge');
      const del = await p3.evaluate(async () => { localStorage.setItem('lr_home', '{"lat":1,"lon":2}'); localStorage.setItem('fremd', 'x'); window.confirm = () => true;
        const r = location.reload; let reloaded = false; try { Object.defineProperty(location, 'reload', { value: () => { reloaded = true; } }); } catch (e) { }
        await deleteAllData(); return { home: localStorage.getItem('lr_home'), other: localStorage.getItem('fremd') }; });
      check('[Datenschutz] „Alle meine Daten löschen“ leert nur LaunchRadar-Daten', del.home === null && del.other === 'x');
      await ctx3.close();
    }
    // Englisch: alle Ansichten durchklicken, kein deutscher Text darf übrig bleiben
    {
      const { visitAll, mockWeather } = require('./i18n-views.js');
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', locale: 'en-US' });
      await ctx2.route(u => !u.href.startsWith(base), r => r.abort()); await mockWeather(ctx2);
      const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push(`[Englisch] JS-Fehler: ${e.message}`));
      await p2.goto(base);
      const lang = await p2.evaluate(() => LANG);
      const left = await visitAll(p2);
      check('[Englisch] Sprache automatisch erkannt', lang === 'en');
      const api = await p2.evaluate(() => [i18n('Orbital Insertion Burn Start'), i18n('Payload Deployment Sequence Start'), i18n('3 Starts'), i18n('12 von 40')]);
      check('[Englisch] API-Texte bleiben unverändert, Zahlen-Muster greifen', api[0] === 'Orbital Insertion Burn Start' && api[1] === 'Payload Deployment Sequence Start' && api[2] === '3 launches' && api[3] === '12 of 40', api.join(' | '));
      check('[Englisch] kein deutscher Text übrig', left.length === 0, left.length ? left.slice(0, 8).join(' | ') + (left.length > 8 ? ` … (+${left.length - 8})` : '') : 'alle Ansichten geprüft');
      await p2.goto(base + '?lang=de'); const de = await p2.evaluate(() => [LANG, document.querySelector('#grpBtn .lbl').textContent]);
      check('[Englisch] Umschalten auf Deutsch (?lang=de)', de[0] === 'de' && de[1] === 'Alle');
      await ctx2.close();
    }
  } catch (e) { errors.push('Test abgebrochen: ' + e.message); }
  await browser.close(); server.close();
  console.log(results.join('\n'));
  const js = errors.filter(e => /JS-Fehler|abgebrochen/.test(e));
  if (js.length) console.log('\n' + js.join('\n'));
  console.log(errors.length ? `\n${errors.length} Problem(e)` : '\nAlles in Ordnung');
  process.exit(errors.length ? 1 : 0);
})();
