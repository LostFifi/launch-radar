// ===================== App (PWA): Installieren, Offline, Benachrichtigungen =====================
// Service Worker = src/pwa/sw.js. Ohne eigenen Server gibt es keine echten Push-Nachrichten:
// Erinnerungen kommen, solange die App offen ist; installiert in Chrome/Edge prüft der Service Worker
// zusätzlich im Hintergrund (Periodic Background Sync – Zeitpunkt bestimmt der Browser).
var PWA={reg:null,prompt:null,sync:null,standalone:matchMedia("(display-mode: standalone)").matches||navigator.standalone===true};
const PWA_OK=/^https?:$/.test(location.protocol) && "serviceWorker" in navigator;
if(PWA_OK){
  navigator.serviceWorker.register("sw.js").then(async reg=>{ PWA.reg=reg; await navigator.serviceWorker.ready; syncRem(); pwaPeriodic(); })
    .catch(e=>console.warn("Service Worker:",e));
}
addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); PWA.prompt=e; });
addEventListener("appinstalled",()=>{ PWA.prompt=null; PWA.standalone=true; toast("LaunchRadar ist jetzt als App installiert"); pwaPeriodic(); });
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) checkRem(); });

async function pwaInstall(){ if(!PWA.prompt) return; PWA.prompt.prompt(); try{ await PWA.prompt.userChoice; }catch(e){} PWA.prompt=null; buildLayerMenu(); }
async function pwaPeriodic(){
  try{ const reg=PWA.reg||(PWA_OK?await navigator.serviceWorker.ready:null);
    if(!reg||!reg.periodicSync){ PWA.sync="nein"; return; }
    const st=await navigator.permissions.query({name:"periodic-background-sync"});
    if(st.state!=="granted"){ PWA.sync="nein"; return; }
    await reg.periodicSync.register("lr-rem",{minInterval:15*60e3}); PWA.sync="ja";
  }catch(e){ PWA.sync="nein"; }
}
// Erinnerungen für den Service Worker ablegen; was er schon gemeldet hat, wird übernommen (keine doppelten Meldungen)
async function syncRem(){
  if(!window.caches) return;
  try{ const c=await caches.open("lr-data"), r=await c.match("rem.json");
    if(r){ const sw=await r.json(); for(const id in sw) if(REM[id] && sw[id].fired && sw[id].net===REM[id].net) REM[id].fired=true; }
    await c.put("rem.json",new Response(JSON.stringify(REM),{headers:{"content-type":"application/json"}}));
  }catch(e){}
  pushSync();
}
// ---------- Echte Push-Nachrichten über den eigenen Worker (nur wenn src/config.json ausgefüllt ist) ----------
const PUSH_OK=()=>!!(CONFIG.worker && CONFIG.vapidPublic && PWA_OK && "PushManager" in window);
let pushLast="", pushTimer=null;
function pushSync(){ if(!PUSH_OK()) return; clearTimeout(pushTimer); pushTimer=setTimeout(pushSyncNow,1500); }
async function pushSyncNow(){
  try{
    if(!window.Notification||Notification.permission!=="granted") return;
    const reg=PWA.reg||await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub){ if(!Object.keys(REM).length && !SUBS.length) return;
      const k=Uint8Array.from(atob(CONFIG.vapidPublic.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:k}); }
    const rem={}; for(const id in REM){ const r=REM[id]; rem[id]={net:r.net,name:r.name,kind:r.kind,txt:r.txt}; }
    const body=JSON.stringify({sub:sub.toJSON(),rem,rules:SUBS,off:Object.keys(REMOFF)}); if(body===pushLast) return;
    const r=await fetch(CONFIG.worker+"/push/subscribe",{method:"POST",headers:{"content-type":"application/json"},body});
    if(r.ok){ pushLast=body; PWA.push=true; }
  }catch(e){ console.warn("Push:",e); PWA.push=false; }
}
// Benachrichtigung anzeigen – über den Service Worker (Android verlangt das), sonst direkt
async function notify(body,tag){
  try{ if(!window.Notification || Notification.permission!=="granted") return false;
    const reg=PWA.reg||(PWA_OK?await navigator.serviceWorker.getRegistration():null);
    if(reg) await reg.showNotification("LaunchRadar",{body,tag,icon:"icons/icon-192.png",badge:"icons/badge-96.png",data:{url:"./"}});
    else new Notification("LaunchRadar",{body,tag});
    return true;
  }catch(e){ return false; }
}
async function pwaAsk(){
  try{ if(window.Notification && Notification.permission==="default") await Notification.requestPermission(); }catch(e){}
  await pwaPeriodic(); pushSync(); if(document.getElementById("layers").style.display==="block") buildLayerMenu();
}
async function pwaTest(){ if(!await notify("Test: So sehen Start-Erinnerungen aus.","lr-test")) toast("Benachrichtigung konnte nicht angezeigt werden"); }
function pwaMenuHtml(){
  const perm=window.Notification?Notification.permission:"none";
  const pl={granted:"erlaubt",denied:"blockiert – in den Website-Einstellungen des Browsers ändern",default:"noch nicht erlaubt",none:"nicht unterstützt"}[perm];
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const inst=PWA.standalone?`<div class="note">Läuft als installierte App.</div>`
    :PWA.prompt?`<button class="chip ic" onclick="pwaInstall()">${ICON.rocket} App installieren</button>`
    :ios?`<div class="note">iPhone/iPad: in Safari auf Teilen → „Zum Home-Bildschirm“.</div>`
    :`<div class="note">Installieren: im Browser-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“.</div>`;
  return `<h4>App & Benachrichtigungen</h4>${inst}
    <div class="note">Benachrichtigungen: <b style="color:var(--text)">${pl}</b></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${perm==="default"?`<button class="chip" onclick="pwaAsk()">${ICON.bell} Erlauben</button>`:""}${perm==="granted"?`<button class="chip" onclick="pwaTest()">${ICON.bell} Test senden</button>`:""}</div>
    <div class="note">${PUSH_OK()&&perm==="granted"
      ?"Echte Push-Nachrichten über den LaunchRadar-Server: Erinnerungen und Verschiebungen kommen auch bei geschlossener App pünktlich."
      :PWA.sync==="ja"
      ?"Hintergrund-Prüfung aktiv: Erinnerungen kommen auch bei geschlossener App. Den Zeitpunkt bestimmt der Browser – sie können sich verspäten."
      :"Erinnerungen kommen, solange die App offen ist (auch als Hintergrund-Tab)."+(PWA_OK&&!PWA.standalone&&!ios?" Als installierte App (Chrome/Edge) prüft sie zusätzlich im Hintergrund.":"")}</div>`;
}
