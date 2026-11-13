// ===================== Daten laden =====================
async function load(){
  let cached=null;
  try{ cached = JSON.parse(localStorage.getItem("lr_cache")||"null"); }catch(e){}
  if(cached && Date.now()-cached.ts < CACHE_MIN*60e3){ launches = cached.data; return render(); }
  for(const url of [API, API_DEV]){
    try{
      const r = await fetch(url);
      if(!r.ok) throw new Error(r.status);
      const j = await r.json();
      launches = j.results||[];
      try{ localStorage.setItem("lr_cache",JSON.stringify({ts:Date.now(),data:launches})); }catch(e){}
      if(url===API_DEV) toast("Hinweis: Fallback-Daten (dev-Server) – evtl. nicht ganz aktuell");
      return render();
    }catch(e){ console.warn("Fehler",url,e); }
  }
  if(cached){ launches=cached.data; toast("Offline – zeige zwischengespeicherte Daten"); return render(); }
  launches = SNAPSHOT; render();
  toast("Live-Daten blockiert – zeige Schnappschuss vom "+SNAP_TS+". Im Browser (Chrome) öffnen für Live-Daten.");
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
