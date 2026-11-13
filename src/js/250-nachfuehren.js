// ===================== Statistik & Raketen-Datenbank nach jedem Start nachführen =====================
const CN_DE={"United States of America":"USA","People's Republic of China":"China","Russian Federation":"Russland","New Zealand":"Neuseeland","India":"Indien","Japan":"Japan","France":"Frankreich","Kazakhstan":"Kasachstan","Iran, Islamic Republic of":"Iran","Korea, Republic of":"Südkorea","Korea, Democratic People's Republic of":"Nordkorea","Israel":"Israel","Australia":"Australien","Norway":"Norwegen","Sweden":"Schweden","United Kingdom of Great Britain and Northern Ireland":"Grossbritannien","French Guiana":"Frankreich (Kourou)"};
var STATS0=JSON.parse(JSON.stringify(STATS)), ROCKETS0=JSON.parse(JSON.stringify(ROCKETS)), RCUT=RCUT_SNAP;
var FULL={stats:null,db:null};
var INC={ts:null,n:0,busy:false};
function topN(obj,n){ const it=Object.entries(obj).sort((a,b)=>b[1]-a[1]), head=it.slice(0,n), rest=it.slice(n).reduce((s,x)=>s+x[1],0); return rest?[...head,["Andere",rest]]:head; }
function applyIncrement(list){
  // immer vom Schnappschuss ausgehen, damit nichts doppelt gezählt wird
  const S=JSON.parse(JSON.stringify(STATS0)), R=JSON.parse(JSON.stringify(ROCKETS0)), cut=new Date(S.cut), cutR=new Date(RCUT);
  let n=0;
  list.forEach(l=>{ const a=l.status?.abbrev||"", t=new Date(l.net);
    if(!/^(Success|Failure|Partial Failure)$/.test(a)) return;
    if(t>cut || t>cutR) n++;
    if(t>cut && t.getFullYear()===S.year){
      S.total++; S.status[a]=(S.status[a]||0)+1; S.month[t.getMonth()]++;
      const pv=l.launch_service_provider?.name||"?", cn=l.pad?.country?.name||l.pad?.location?.country?.name||"?", rk=l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"?";
      S.provAll[pv]=(S.provAll[pv]||0)+1; const c2=CN_DE[cn]||cn; S.ctyAll[c2]=(S.ctyAll[c2]||0)+1; S.rockAll[rk]=(S.rockAll[rk]||0)+1; }
    const r=t>cutR ? (R.find(x=>x.id===l.rocket?.configuration?.id) || R.find(x=>x.n===l.rocket?.configuration?.name)) : null;
    if(r){ r.tot++; if(a==="Success") r.suc++; else r.fail++; if(r.pend>0) r.pend--;
      (l.rocket?.launcher_stage||[]).forEach(s=>{ const ld=s.landing; if(ld&&ld.attempt){ r.al++; if(ld.success) r.sl++; } }); }
  });
  S.prov=topN(S.provAll,8); S.cty=topN(S.ctyAll,7); S.rock=topN(S.rockAll,10);
  Object.assign(STATS,S); ROCKETS.length=0; R.forEach(x=>ROCKETS.push(x));
  INC.n=n; }
async function refreshCounts(force){
  if(INC.busy) return; INC.busy=true;
  try{
    let c=null; try{ c=JSON.parse(localStorage.getItem("lr_inc")||"null"); }catch(e){}
    if(!force && c && Date.now()-c.ts<3*3600e3){ applyIncrement(c.data); INC.ts=c.ts; }
    else{
      const since=new Date(Math.min(new Date(STATS0.cut),new Date(RCUT))-3600e3).toISOString();
      const r=await fetch(`https://ll.thespacedevs.com/2.3.0/launches/previous/?mode=detailed&limit=100&ordering=net&net__gte=${since}`);
      if(!r.ok) throw r.status;
      const data=(await r.json()).results.map(l=>({id:l.id,net:l.net,status:{abbrev:l.status?.abbrev},launch_service_provider:{name:l.launch_service_provider?.name},
        pad:{country:{name:l.pad?.country?.name||l.pad?.location?.country?.name}},
        rocket:{configuration:{id:l.rocket?.configuration?.id,name:l.rocket?.configuration?.name,full_name:l.rocket?.configuration?.full_name},
          launcher_stage:(l.rocket?.launcher_stage||[]).map(s=>({landing:{attempt:s.landing?.attempt,success:s.landing?.success}}))}}));
      applyIncrement(data); INC.ts=Date.now();
      try{ localStorage.setItem("lr_inc",JSON.stringify({ts:INC.ts,data})); }catch(e){}
    }
  }catch(e){ if(!INC.ts){ STATS.prov=topN(STATS.provAll,8); STATS.cty=topN(STATS.ctyAll,7); STATS.rock=topN(STATS.rockAll,10); } }
  INC.busy=false; refreshOpenViews();
}
function standText(kind){
  const f=d=>new Date(d).toLocaleString("de-CH",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  const full=kind==="db"?FULL.db:FULL.stats;
  if(full && INC.ts) return `vollständig geprüft ${f(full)} · nachgeführt ${f(INC.ts)}${INC.n?` (+${INC.n} Starts)`:""}`;
  return INC.ts ? `aktualisiert ${new Date(INC.ts).toLocaleString("de-CH",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}${INC.n?` · ${INC.n} neue Starts seit Schnappschuss eingerechnet`:""}` : `Schnappschuss vom ${STATS0.asof} (offline)`; }
function refreshOpenViews(){ const P=document.getElementById("panel"); if(P.style.display!=="block") return; const h2=P.querySelector(".hd h2")?.textContent||"";
  if(/Raumfahrt-Statistik/.test(h2)) openStats(); else if(/Raketen-Datenbank/.test(h2)) renderDBTable(); }
