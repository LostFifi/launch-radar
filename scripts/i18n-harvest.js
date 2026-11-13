// Sammelt alle deutschen Texte, die in der englischen Version noch nicht übersetzt sind.
// Öffnet die App auf Englisch, klickt alle Ansichten durch und meldet, was deutsch geblieben ist
// (sichtbare Texte, title/placeholder, und alles, was durch i18n() lief: Meldungen, Benachrichtigungen, Canvas).
//   node scripts/i18n-harvest.js [ausgabe.json]
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');
const { startServer, launchBrowser, mockWeather, visitAll } = require('./i18n-views.js');

(async () => {
  const { base, server } = await startServer();
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(u => !u.href.startsWith(base), r => r.abort());
  await mockWeather(ctx);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '?lang=en');
  const found = await visitAll(page, process.argv.includes('--all'));
  await browser.close(); server.close();
  const list = [...new Set(found)].sort();
  const out = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (out) fs.writeFileSync(out, JSON.stringify(list, null, 1));
  console.log(list.join('\n'));
  console.log(`\n${list.length} deutsche Texte ohne Übersetzung${errs.length ? '\nJS-Fehler: ' + errs.join(' | ') : ''}`);
})();
