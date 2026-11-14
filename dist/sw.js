// LaunchRadar Service Worker
// - App startet auch offline (index.html wird zwischengespeichert, online immer frisch geladen)
// - Benachrichtigungen (auf Android geht das nur über den Service Worker)
// - Hintergrund-Prüfung der Erinnerungen (Periodic Background Sync: nur Chrome/Edge, installierte App, Zeitpunkt bestimmt der Browser)
const VERSION = "95147308b5";
const SHELL = "lr-shell-" + VERSION, DATA = "lr-data";
const ASSETS = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/badge-96.png", "data/tle.json", "data/img.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("lr-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Seite: zuerst Netz (immer neueste Version), offline aus dem Cache. Eigene Dateien: Cache, sonst Netz.
// Fremde Server (API, Karte, CelesTrak) gehen direkt ans Netz – die App hat dafür ihren eigenen Cache.
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    // Nur die App selbst (Startseite) als Offline-Kopie speichern – nicht die Info-Seiten (start/, iss/, datenschutz …)
    const scope = new URL(self.registration.scope).pathname, isApp = url.pathname === scope || url.pathname === scope + "index.html";
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && isApp) (await caches.open(SHELL)).put("./", res.clone());
        return res;
      } catch (err) {
        return (isApp && await caches.match("./")) || (await caches.match(req)) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});

// ---------- Erinnerungen im Hintergrund ----------
// Die Seite legt ihre Erinnerungen (lr_rem) als rem.json im Cache "lr-data" ab.
async function readRem() {
  try { const r = await (await caches.open(DATA)).match("rem.json"); return r ? await r.json() : {}; } catch (e) { return {}; }
}
async function writeRem(rem) {
  await (await caches.open(DATA)).put("rem.json", new Response(JSON.stringify(rem), { headers: { "content-type": "application/json" } }));
}
// Texte in der Sprache der App (die Seite legt lang.txt im Cache ab)
async function lang() { try { const r = await (await caches.open(DATA)).match("lang.txt"); return r ? await r.text() : "de"; } catch (e) { return "de"; } }
const TX = {
  de: { soon: m => `in ca. ${m} Min`, now: "jetzt", ago: m => `vor ${m} Min`, launch: (n, w) => `${n} startet ${w}`, other: "Neue Meldung zu einem Start – tippen zum Öffnen" },
  en: { soon: m => `in about ${m} min`, now: "now", ago: m => `${m} min ago`, launch: (n, w) => `${n} launches ${w}`, other: "News about a launch – tap to open" }
};
async function checkReminders() {
  const rem = await readRem(), now = Date.now(); let changed = false; const L = TX[await lang()] || TX.de;
  for (const id in rem) {
    const r = rem[id], t = new Date(r.net) - now;
    // Der Browser weckt uns unregelmässig: alles melden, was in den nächsten 20 Min kommt oder knapp verpasst wurde
    if (!r.fired && t <= 20 * 60e3 && t > -15 * 60e3) {
      r.fired = true; changed = true;
      const min = Math.round(t / 60e3), name = r.kind === "pass" ? r.name : (r.name.split("|")[1] || r.name).trim();
      const when = min > 0 ? L.soon(min) : min === 0 ? L.now : L.ago(-min);
      try {
        await self.registration.showNotification("LaunchRadar", {
          body: r.kind === "pass" ? `${name} ${when} – ${r.txt || ""}` : L.launch(name, when),
          icon: "icons/icon-192.png", badge: "icons/badge-96.png", tag: "lr-" + id, data: { url: "./" }
        });
      } catch (err) { /* Benachrichtigungen nicht erlaubt – trotzdem als gemeldet markieren */ }
    }
  }
  if (changed) await writeRem(rem);
}
self.addEventListener("periodicsync", e => { if (e.tag === "lr-rem") e.waitUntil(checkReminders()); });

// Push vom eigenen Worker (ohne Inhalt): Meldungen dort abholen und anzeigen
const WORKER = "https://launch-radar.lostfifi.workers.dev";
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let msgs = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (WORKER && sub) msgs = await (await fetch(WORKER + "/push/pending?e=" + encodeURIComponent(sub.endpoint))).json();
    } catch (err) {}
    if (!msgs.length) {            // Fallback: lokal gespeicherte Erinnerungen prüfen
      await checkReminders();
      const shown = await self.registration.getNotifications();
      if (shown.length) return;
      msgs = [{ title: "LaunchRadar", body: (TX[await lang()] || TX.de).other, tag: "lr-push" }];
    }
    for (const m of msgs) await self.registration.showNotification(m.title || "LaunchRadar",
      { body: m.body, tag: m.tag, icon: "icons/icon-192.png", badge: "icons/badge-96.png", data: { url: "./" } });
  })());
});
self.addEventListener("message", e => { if (e.data && e.data.type === "check") e.waitUntil(checkReminders()); });

// Klick auf die Benachrichtigung: offenes App-Fenster nach vorne holen, sonst öffnen
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (new URL(c.url).pathname.startsWith(new URL(self.registration.scope).pathname)) return c.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
  })());
});
