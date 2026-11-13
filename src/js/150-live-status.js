// ===================== Live-Status bei laufenden Starts =====================
let lastPoll=0, liveId=null;
function liveCandidate(){ const now=Date.now();
  return launches.filter(l=>{ const t=new Date(l.net)-now, a=(l.status?.abbrev||"");
    return l.webcast_live || a==="In Flight" || (t<45*60e3 && t>-3*3600e3 && !/success|fail/i.test(a)); })
    .sort((a,b)=>new Date(a.net)-new Date(b.net))[0]; }
async function livePoll(force){
  const B=document.getElementById("live");
  if(!LAYERS.live){ B.style.display="none"; return; }
  const l=liveCandidate(); if(!l){ B.style.display="none"; liveId=null; return; }
  liveId=l.id; liveBanner();
  if(!force && Date.now()-lastPoll<5*60e3) return;   // Free-API: max. ~12 Abfragen/Stunde
  lastPoll=Date.now();
  try{ const r=await fetch(`https://ll.thespacedevs.com/2.3.0/launches/${l.id}/?mode=detailed`); if(!r.ok) throw r.status;
    applyLive(await r.json()); }catch(e){ console.warn("Live-Abfrage fehlgeschlagen",e); }
}
function applyLive(n){
  const i=launches.findIndex(x=>x.id===n.id); if(i<0) return; const o=launches[i]; launches[i]=n;
  if(o.status?.abbrev!==n.status?.abbrev){ toast(`${n.name.split("|")[1]||n.name}: Status → ${n.status?.name}`);
    if(/success|fail/i.test(n.status?.abbrev||"")) setTimeout(()=>refreshCounts(true),60e3); }
  else if((n.updates?.length||0)>(o.updates?.length||0)) toast(`Update: ${n.updates[0].comment}`);
  if(!o.webcast_live && n.webcast_live) toast("Livestream ist gestartet");
  try{ localStorage.setItem("lr_cache",JSON.stringify({ts:Date.now(),data:launches})); }catch(e){}
  render();
  if(selected && selected.id===n.id){ const s=document.getElementById("sim"), v=s?+s.value:0, top=document.getElementById("panel").scrollTop;
    select(n); const s2=document.getElementById("sim"); if(s2&&!simTimer){ s2.value=v; placeRocket(v); } document.getElementById("panel").scrollTop=top; }
  liveBanner();
}
function liveBanner(){
  const B=document.getElementById("live"), l=launches.find(x=>x.id===liveId); if(!l||!LAYERS.live){ B.style.display="none"; return; }
  const ago=lastPoll?Math.round((Date.now()-lastPoll)/60e3):null;
  B.innerHTML=`<span style="color:var(--live)">●</span> <b>LIVE-Modus</b> · ${esc(l.name.split("|")[1]||l.name)} · ${esc(l.status?.name||"")} · ${countdown(l.net)}${ago!==null?` · Abfrage vor ${ago} min`:""}`;
  B.style.display="block"; B.onclick=()=>select(l);
}
setInterval(()=>{ livePoll(false); },20e3);
setInterval(()=>{ if(liveId) liveBanner(); },1000);

(async()=>{ for(const g in SAT_SRC) if(LAYERS[g]) await loadSats(g); propAll(true); })();
setTimeout(()=>livePoll(true),3000);
