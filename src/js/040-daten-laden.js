// ===================== Daten laden =====================
// Reihenfolge: frischer Cache (echte API, < 15 Min) → echte API → bei Sperre (429, ~15 Abfragen/h) eigener Cache
// der echten API (bis 12 h alt) → dev-Server (Testkopie, oft Tage alt, Verschiebungen fehlen!) → eingebetteter Schnappschuss.
// DATA merkt sich die Quelle, damit die App ehrlich anzeigen kann, wie aktuell die Daten sind.
var DATA={src:null,ts:0,stand:null,limited:false};
function dataStand(list){ const m=Math.max(0,...list.map(l=>Date.parse(l.last_updated||"")||0)); return m||null; }
function saveCache(){ trackNet(launches); try{ localStorage.setItem("lr_cache",JSON.stringify({ts:DATA.ts,src:(DATA.src==="live"||DATA.src==="cache")?"live":"dev",data:launches})); }catch(e){} }
async function load(){
  let cached=null;
  try{ cached = JSON.parse(localStorage.getItem("lr_cache")||"null"); }catch(e){}
  const real=cached && cached.src==="live";            // ältere Caches ohne Quelle gelten als unsicher
  if(real && Date.now()-cached.ts < CACHE_MIN*60e3){ launches=cached.data; Object.assign(DATA,{src:"live",ts:cached.ts,limited:false}); return render(); }
  let status=null;
  // 1. eigener Worker (falls eingerichtet): kein API-Limit, Daten höchstens ~5 Min alt
  if(CONFIG.worker){ try{ const r=await fetch(CONFIG.worker+"/launches"); if(!r.ok) throw new Error(r.status);
      const v=await r.json(); if(!v.results?.length) throw new Error("leer");
      launches=v.results; Object.assign(DATA,{src:"live",ts:v.ts||Date.now(),limited:false,via:"worker"}); saveCache(); return render();
    }catch(e){ console.warn("Worker:",e); } }
  try{
    const r=await fetch(API); status=r.status; if(!r.ok) throw new Error(r.status);
    launches=(await r.json()).results||[]; Object.assign(DATA,{src:"live",ts:Date.now(),limited:false}); saveCache(); return render();
  }catch(e){ console.warn("Launch Library:",e); }
  DATA.limited = status===429;
  const why = DATA.limited ? "API-Limit erreicht (max. ~15 Abfragen pro Stunde)" : "Live-API nicht erreichbar";
  if(real && Date.now()-cached.ts < 12*3600e3){
    launches=cached.data; Object.assign(DATA,{src:"cache",ts:cached.ts}); trackNet(launches);
    toast(`${why} – zeige Daten von vor ${Math.round((Date.now()-cached.ts)/60e3)} Min. Neuer Versuch in 15 Min.`); return render();
  }
  // Eingebetteter Schnappschuss ist echt (GitHub holt ihn bei jedem Build und jede Nacht) → wenn jung, besser als der dev-Server
  const snapT=Date.parse(SNAP_AT)||0;
  if(Date.now()-snapT<36*3600e3){
    launches=SNAPSHOT; Object.assign(DATA,{src:"snap",ts:snapT});
    toast(`${why} – zeige Daten vom ${fmtStand(snapT)}. Neuer Versuch in 15 Min.`); return render();
  }
  try{
    const r=await fetch(API_DEV); if(!r.ok) throw new Error(r.status);
    launches=(await r.json()).results||[]; Object.assign(DATA,{src:"dev",ts:Date.now(),stand:dataStand(launches)});
    toast(`${why} – Ersatzdaten vom Test-Server, Stand ${fmtStand(DATA.stand)}. Verschiebungen fehlen evtl.!`); return render();
  }catch(e){ console.warn("dev-Server:",e); }
  if(cached){ launches=cached.data; Object.assign(DATA,{src:"cache",ts:cached.ts}); toast("Offline – zeige zwischengespeicherte Daten"); return render(); }
  launches = SNAPSHOT; Object.assign(DATA,{src:"snap",ts:snapT}); render();
  toast("Live-Daten blockiert – zeige Schnappschuss vom "+SNAP_TS+". Im Browser (Chrome) öffnen für Live-Daten.");
}
function fmtStand(t){ return t?new Date(t).toLocaleString(LOC,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"unbekannt"; }
// Kurzer Text, wie aktuell die Startdaten sind
function dataInfo(){
  const m=t=>Math.max(0,Math.round((Date.now()-t)/60e3));
  if(DATA.src==="live") return `Daten vor ${m(DATA.ts)} Min`;
  if(DATA.src==="cache") return `Daten vor ${m(DATA.ts)} Min${DATA.limited?" (API-Limit)":""}`;
  if(DATA.src==="dev") return `Ersatzdaten, Stand ${fmtStand(DATA.stand)}`;
  if(DATA.src==="snap") return DATA.ts?`Daten vom ${fmtStand(DATA.ts)}`:`Schnappschuss ${SNAP_TS}`;
  return "";
}
// Ist der Start wirklich erfolgt? Nach T-0 reicht „Go“ nicht – der Start kann verschoben sein, ohne dass wir es schon wissen.
//   upcoming | flying | done | likely (kurz nach T-0, frische echte Daten) | unconfirmed (Startzeit vorbei, nicht bestätigt)
// Manuell bestätigter Start (Knopf „Ist gestartet“ oder Telemetrie misst Tempo): {id:{t:Abhebezeit ms, at}}
// Hilft, wenn die API gedrosselt ist und der Status noch „Go“ zeigt. Gilt 3 Tage.
var LAUNCHED={}; try{ LAUNCHED=JSON.parse(localStorage.getItem("lr_launched")||"{}"); for(const k in LAUNCHED) if(Date.now()-LAUNCHED[k].at>3*864e5) delete LAUNCHED[k]; }catch(e){}
function netOf(l){ return LAUNCHED[l?.id]?.t || new Date(l.net).getTime(); }   // effektive Abhebezeit
function confirmLaunch(id,now){
  const l=[...launches,...(PAST||[])].find(x=>x.id===id)||selected; if(!l) return;
  LAUNCHED[id]={t:now?Date.now():new Date(l.net).getTime(),at:Date.now()};
  try{ localStorage.setItem("lr_launched",JSON.stringify(LAUNCHED)); }catch(e){}
  toast(now?"Start bestätigt – Abhebezeit auf jetzt gesetzt":"Start bestätigt – die Rakete fliegt mit");
  if(selected&&selected.id===id) select(selected); liveBanner&&liveBanner();
}
// Ende des Flugs laut Modell (ms nach T-0), pro Start zwischengespeichert
var FLY_END={};
function flightEnd(l){ if(FLY_END[l.id]==null){ try{ FLY_END[l.id]=estimateProfile(l).tMax*1000; }catch(e){ FLY_END[l.id]=3*3600e3; } } return FLY_END[l.id]; }
// Gestartet laut API: „Launch in Flight“, „Payload Deployed“ (die API stellt oft erst Stunden später auf „Success“)
const flownStatus=l=>/in flight|deploy/.test(((l.status?.abbrev||"")+" "+(l.status?.name||"")).toLowerCase());
function launchState(l){
  const a=(l.status?.abbrev||"").toLowerCase(), t=Date.now()-netOf(l);
  if(/success|fail|partial/.test(a)) return "done";
  if(flownStatus(l) || LAUNCHED[l.id]) return t>flightEnd(l)+15*60e3 ? "done" : "flying";   // nach Flugende: fertig, nicht ewig „live“
  if(t<0) return "upcoming";
  if(a==="go" && (DATA.src==="live"||DATA.src==="cache") && Date.now()-DATA.ts<20*60e3 && t<20*60e3) return "likely";
  return "unconfirmed";
}

// ---------- Filter: Chips oben (Alle/SpaceX/Starship) + Suche, Betreiber, Land (Liste) – gelten für Karte UND Liste ----------
var FILT={q:"",prov:"",cty:""};
const CTY_DE={"USA":"USA","People's Republic of China":"China","Russian Federation":"Russland","New Zealand":"Neuseeland","India":"Indien",
  "Japan":"Japan","French Guiana":"Frankreich (Kourou)","Republic of Kazakhstan":"Kasachstan","Kazakhstan":"Kasachstan","Norway":"Norwegen",
  "South Korea":"Südkorea","Republic of Korea":"Südkorea","Sweden":"Schweden","Iran":"Iran","Israel":"Israel","Australia":"Australien","United Kingdom":"Grossbritannien"};
// Live-Daten haben pad.country (mit Ländercode), der Schnappschuss nur den Ortsnamen → beides auf dieselben deutschen Namen bringen
const CC_DE={US:"USA",CN:"China",RU:"Russland",NZ:"Neuseeland",IN:"Indien",JP:"Japan",GF:"Frankreich (Kourou)",FR:"Frankreich (Kourou)",
  KZ:"Kasachstan",NO:"Norwegen",KR:"Südkorea",SE:"Schweden",IR:"Iran",IL:"Israel",AU:"Australien",GB:"Grossbritannien",KP:"Nordkorea"};
function countryOf(l){
  if(/^sea launch|offshore/i.test(l.pad?.location?.name||"")) return "Auf See";
  const cc=l.pad?.country?.alpha_2_code; if(cc&&CC_DE[cc]) return CC_DE[cc];
  const c=l.pad?.country?.name||(l.pad?.location?.name||"").split(",").pop().trim();
  return CTY_DE[c]||c||"?"; }
function provOf(l){ return l.launch_service_provider?.name||"?"; }
// Regel = {chip:"spacex"|"starship"|"", prov, cty, q} – dieselbe Logik für Filter UND Abos (auch im Worker nachgebaut!)
function matchRule(f,l){
  const p=provOf(l).toLowerCase(), r=(l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"").toLowerCase();
  if(f.chip==="spacex" && !p.includes("spacex")) return false;
  if(f.chip==="starship" && !r.includes("starship")) return false;
  if(f.prov && provOf(l)!==f.prov) return false;
  if(f.cty && countryOf(l)!==f.cty) return false;
  if(f.q){ const hay=[l.name,r,p,l.pad?.name,l.pad?.location?.name,l.mission?.name,l.mission?.orbit?.name,l.mission?.type].join(" ").toLowerCase();
    if(!f.q.toLowerCase().split(/\s+/).every(w=>hay.includes(w))) return false; }
  return true;
}
function currentRule(){ return {chip:filter==="all"?"":filter, prov:FILT.prov, cty:FILT.cty, q:FILT.q}; }
function matchFilter(l){ return matchRule(currentRule(),l); }
function filterActive(){ return !!(FILT.q||FILT.prov||FILT.cty); }
function visible(){ return launches.filter(matchFilter); }
