// ===================== Anonyme Nutzungsmessung + Feedback =====================
// Misst nur: sichtbare Zeit auf der Seite und welche Funktionen benutzt wurden. Keine Cookies, keine IDs, keine IP –
// der Worker zählt nur Tagessummen (worker/src/index.js → /t). Nur auf der echten Seite, nicht lokal/in Tests,
// nicht bei „Do Not Track“ / Global Privacy Control. Feedback (Sterne, Wunsch, Kommentar) → /feedback.
var USE={on:false, sec:0, sent:0, first:true, f:new Set(), fSent:new Set()};
(function(){
  let host=""; try{ host=new URL(CONFIG.siteUrl).host; }catch(e){}
  USE.on=!!CONFIG.worker && location.host===host && !navigator.webdriver && navigator.doNotTrack!=="1" && !navigator.globalPrivacyControl;
})();
function useMark(f){ USE.f.add(f); }
function useSend(){
  if(!USE.on || USE.sec<3) return;   // ganz kurze Besuche (Bots, Fehlklicks) nicht zählen
  const nf=[...USE.f].filter(x=>!USE.fSent.has(x));
  if(!USE.first && USE.sec-USE.sent<5 && !nf.length) return;
  const body=JSON.stringify({first:USE.first, tot:Math.round(USE.sec), prev:Math.round(USE.sent), f:nf, lang:LANG, mob:innerWidth<800});
  let ok=false; try{ ok=navigator.sendBeacon(CONFIG.worker.replace(/\/$/,"")+"/t", new Blob([body],{type:"text/plain"})); }catch(e){}
  if(ok){ USE.first=false; USE.sent=USE.sec; nf.forEach(x=>USE.fSent.add(x)); }
}
setInterval(()=>{ if(document.visibilityState==="visible"){ USE.sec++; fbMaybe(); } },1000);
addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") useSend(); });
addEventListener("pagehide",useSend);

// Welche Funktionen benutzt werden: bestehende Funktionen umhüllen (gleiches Verhalten, nur ein Merker dazu)
(function(){
  const wrap=(name,f)=>{ const o=window[name]; if(typeof o!=="function") return;
    window[name]=function(...a){ try{ f(...a); }catch(e){} return o.apply(this,a); }; };
  wrap("select",l=>{ useMark("detail"); try{ const k=deepInfo(l)?.kind; if(k==="moon"||k==="mars") useMark(k); }catch(e){}
    try{ if(launchState(l)==="done") useMark("review"); }catch(e){} });
  wrap("liveFollow",()=>useMark("live"));
  wrap("teleAuto",()=>useMark("tele")); wrap("teleStart",()=>useMark("tele"));
  wrap("openPip",()=>useMark("pip")); wrap("openPasses",()=>useMark("iss"));
  wrap("subscribeFilter",()=>useMark("sub")); wrap("toggleRem",()=>useMark("remind"));
  wrap("shareLaunch",()=>useMark("share")); wrap("setLang",()=>useMark("lang")); wrap("pwaInstall",()=>useMark("install"));
  document.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return;
    const m={listBtn:"list",statBtn:"stats",dbBtn:"rockets",layerBtn:"layers",play:"sim"}[b.id];
    if(m) useMark(m); if(b.id==="globeBtn") setTimeout(()=>useMark(G.on?"globe":"map"),0); },true);
})();

// ---------- Feedback ----------
const FB_STAR='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
var FB={r:0};
function fbState(){ try{ return JSON.parse(localStorage.getItem("lr_fb")||"{}"); }catch(e){ return {}; } }
function fbSave(o){ try{ localStorage.setItem("lr_fb",JSON.stringify({...fbState(),...o})); }catch(e){} }
// Nach 3 Minuten sichtbarer Zeit einmal fragen – höchstens alle 7 Tage (Später), 30 Tage (×) bzw. 180 Tage (gesendet)
function fbMaybe(){
  if(!USE.on || USE.sec!==180 || document.getElementById("fb")) return;
  if(Date.now()<(fbState().next||0)) return;
  fbOpen(true);
}
function fbOpen(auto){
  if(!CONFIG.worker){ toast("Feedback ist hier nicht verfügbar"); return; }
  document.getElementById("fb")?.remove(); FB.r=0;
  const d=document.createElement("div"); d.id="fb"; d.className="fbcard";
  d.innerHTML=`<button class="fbx" onclick="fbClose(30)" aria-label="Schliessen">×</button>
    <b>Wie gefällt dir LaunchRadar?</b>
    <div class="fbstars" role="radiogroup" aria-label="Bewertung">${[1,2,3,4,5].map(i=>`<button data-r="${i}" aria-label="${i} von 5">${FB_STAR}</button>`).join("")}</div>
    <label for="fbWish">Welche Funktion wünschst du dir?</label>
    <textarea id="fbWish" maxlength="600" rows="2" placeholder="z.B. Starts einer bestimmten Rakete, Benachrichtigung für …"></textarea>
    <label for="fbC">Sonst noch etwas? (optional)</label>
    <textarea id="fbC" maxlength="600" rows="2" placeholder="Lob, Kritik, Fehler …"></textarea>
    <div class="fbbtn"><button class="btn" style="margin:0" onclick="fbSend()">Senden</button>${auto?`<button class="btn sec2" style="margin:0" onclick="fbClose(7)">Später</button>`:""}</div>
    <small class="mute">Anonym – ohne Name, E-Mail oder Cookies.</small>`;
  document.body.appendChild(d);
  d.querySelectorAll(".fbstars button").forEach(b=>b.onclick=()=>{ FB.r=+b.dataset.r;
    d.querySelectorAll(".fbstars button").forEach(x=>x.classList.toggle("on",+x.dataset.r<=FB.r)); });
  if(auto) fbSave({next:Date.now()+7*864e5});   // nicht gleich nochmals fragen, auch wenn einfach weggeklickt
}
function fbClose(days){ document.getElementById("fb")?.remove(); fbSave({next:Date.now()+days*864e5}); }
async function fbSend(){
  const wish=document.getElementById("fbWish").value.trim(), c=document.getElementById("fbC").value.trim();
  if(!FB.r && !wish && !c){ toast("Bitte Sterne wählen oder etwas schreiben"); return; }
  try{
    const r=await fetch(CONFIG.worker.replace(/\/$/,"")+"/feedback",{method:"POST",headers:{"content-type":"text/plain"},
      body:JSON.stringify({r:FB.r||null,wish,c,lang:LANG,mob:innerWidth<800})});
    if(r.status===429){ toast("Bitte kurz warten und nochmals senden"); return; }
    if(!r.ok) throw 0;
    useMark("feedback"); document.getElementById("fb")?.remove(); fbSave({next:Date.now()+180*864e5, sent:Date.now()});
    toast("Danke für dein Feedback!");
  }catch(e){ toast("Senden fehlgeschlagen – bitte später nochmals"); }
}
