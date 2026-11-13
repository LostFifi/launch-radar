// ===================== Daten laden =====================
// Reihenfolge: frischer Cache (echte API, < 15 Min) → echte API → bei Sperre (429, ~15 Abfragen/h) eigener Cache
// der echten API (bis 12 h alt) → dev-Server (Testkopie, oft Tage alt, Verschiebungen fehlen!) → eingebetteter Schnappschuss.
// DATA merkt sich die Quelle, damit die App ehrlich anzeigen kann, wie aktuell die Daten sind.
var DATA={src:null,ts:0,stand:null,limited:false};
function dataStand(list){ const m=Math.max(0,...list.map(l=>Date.parse(l.last_updated||"")||0)); return m||null; }
function saveCache(){ try{ localStorage.setItem("lr_cache",JSON.stringify({ts:DATA.ts,src:(DATA.src==="live"||DATA.src==="cache")?"live":"dev",data:launches})); }catch(e){} }
async function load(){
  let cached=null;
  try{ cached = JSON.parse(localStorage.getItem("lr_cache")||"null"); }catch(e){}
  const real=cached && cached.src==="live";            // ältere Caches ohne Quelle gelten als unsicher
  if(real && Date.now()-cached.ts < CACHE_MIN*60e3){ launches=cached.data; Object.assign(DATA,{src:"live",ts:cached.ts,limited:false}); return render(); }
  let status=null;
  try{
    const r=await fetch(API); status=r.status; if(!r.ok) throw new Error(r.status);
    launches=(await r.json()).results||[]; Object.assign(DATA,{src:"live",ts:Date.now(),limited:false}); saveCache(); return render();
  }catch(e){ console.warn("Launch Library:",e); }
  DATA.limited = status===429;
  const why = DATA.limited ? "API-Limit erreicht (max. ~15 Abfragen pro Stunde)" : "Live-API nicht erreichbar";
  if(real && Date.now()-cached.ts < 12*3600e3){
    launches=cached.data; Object.assign(DATA,{src:"cache",ts:cached.ts});
    toast(`${why} – zeige Daten von vor ${Math.round((Date.now()-cached.ts)/60e3)} Min. Neuer Versuch in 15 Min.`); return render();
  }
  try{
    const r=await fetch(API_DEV); if(!r.ok) throw new Error(r.status);
    launches=(await r.json()).results||[]; Object.assign(DATA,{src:"dev",ts:Date.now(),stand:dataStand(launches)});
    toast(`${why} – Ersatzdaten vom Test-Server, Stand ${fmtStand(DATA.stand)}. Verschiebungen fehlen evtl.!`); return render();
  }catch(e){ console.warn("dev-Server:",e); }
  if(cached){ launches=cached.data; Object.assign(DATA,{src:"cache",ts:cached.ts}); toast("Offline – zeige zwischengespeicherte Daten"); return render(); }
  launches = SNAPSHOT; Object.assign(DATA,{src:"snap",ts:0}); render();
  toast("Live-Daten blockiert – zeige Schnappschuss vom "+SNAP_TS+". Im Browser (Chrome) öffnen für Live-Daten.");
}
function fmtStand(t){ return t?new Date(t).toLocaleString("de-CH",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"unbekannt"; }
// Kurzer Text, wie aktuell die Startdaten sind
function dataInfo(){
  const m=t=>Math.max(0,Math.round((Date.now()-t)/60e3));
  if(DATA.src==="live") return `Daten vor ${m(DATA.ts)} Min`;
  if(DATA.src==="cache") return `Daten vor ${m(DATA.ts)} Min${DATA.limited?" (API-Limit)":""}`;
  if(DATA.src==="dev") return `Ersatzdaten, Stand ${fmtStand(DATA.stand)}`;
  if(DATA.src==="snap") return `Schnappschuss ${SNAP_TS}`;
  return "";
}
// Ist der Start wirklich erfolgt? Nach T-0 reicht „Go“ nicht – der Start kann verschoben sein, ohne dass wir es schon wissen.
//   upcoming | flying | done | likely (kurz nach T-0, frische echte Daten) | unconfirmed (Startzeit vorbei, nicht bestätigt)
function launchState(l){
  const a=(l.status?.abbrev||"").toLowerCase(), t=Date.now()-new Date(l.net);
  if(/in flight/.test(a)) return "flying";
  if(/success|fail|partial/.test(a)) return "done";
  if(t<0) return "upcoming";
  if(a==="go" && (DATA.src==="live"||DATA.src==="cache") && Date.now()-DATA.ts<20*60e3 && t<20*60e3) return "likely";
  return "unconfirmed";
}

function visible(){
  return launches.filter(l=>{
    const p=(l.launch_service_provider?.name||"").toLowerCase();
    const r=(l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"").toLowerCase();
    if(filter==="spacex") return p.includes("spacex");
    if(filter==="starship") return r.includes("starship");
    return true;
  });
}
