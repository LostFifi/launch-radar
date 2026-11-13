// Erzeugt das Vorschaubild für geteilte Links (Open Graph, 1200×630) aus der echten App.
//   node scripts/make_og.js      (nach npm run build; schreibt src/pwa/og-image.png)
// Externe Server sind blockiert → eingebettete Weltkarte, damit das Bild immer gleich aussieht.
const path = require('path');
const { startServer, launchBrowser } = require('./i18n-views.js');
(async () => {
  const { base, server } = await startServer();
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'en-US' });
  await ctx.route(u => !u.href.startsWith(base), r => r.abort());
  const page = await ctx.newPage();
  await page.goto(base + '?lang=en');
  await page.waitForFunction(() => typeof launches !== 'undefined' && launches.length > 0);
  await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    document.getElementById('msg').style.display = 'none'; document.getElementById('live').style.display = 'none';
    document.getElementById('timebar').style.display = 'none'; document.querySelector('.leaflet-control-container').style.display = 'none';
    // Ein Starlink-Start ab Florida mit mehreren Orbits sieht am besten aus
    const all = [...launches, ...PAST_SNAP];
    const l = all.find(x => /Cape|Kennedy/.test(x.pad?.location?.name || '') && /falcon 9/i.test(x.name) && (x.mission?.orbit?.abbrev || '') === 'LEO')
      || all.find(x => /Cape|Kennedy/.test(x.pad?.location?.name || '')) || launches[0];
    const est = estimateProfile(l); drawRoute(l, est); placeRocket(1350);
    map.setView([22, -48], 3, { animate: false }); await wait(300);
    const o = document.createElement('div');
    o.innerHTML = `<div style="font:800 64px system-ui,Segoe UI,sans-serif;letter-spacing:.5px;color:#e6ebf5">Launch<span style="color:#4ea1ff">Radar</span></div>
      <div style="font:600 28px system-ui,Segoe UI,sans-serif;color:#e6ebf5;margin-top:6px">Track rocket launches live</div>
      <div style="font:400 21px system-ui,Segoe UI,sans-serif;color:#8a96ad;margin-top:10px;max-width:520px;line-height:1.35">Map &amp; 3D globe · ascent profiles · real telemetry · ISS passes · Moon &amp; Mars</div>
      <div style="font:600 18px system-ui,Segoe UI,sans-serif;color:#4ea1ff;margin-top:18px">lostfifi.github.io/launch-radar</div>`;
    Object.assign(o.style, { position: 'absolute', left: '0', top: '62px', bottom: '0', zIndex: 5000, padding: '0 48px', width: '720px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      background: 'linear-gradient(90deg,#0b0f17f5 0%,#0b0f17e6 55%,#0b0f1700 100%)' });
    document.body.appendChild(o);
    await wait(500);
  });
  const out = path.resolve(__dirname, '..', 'src', 'pwa', 'og-image.png');
  await page.screenshot({ path: out, type: 'png' });
  console.log('Vorschaubild:', out);
  await browser.close(); server.close();
})();
