// ===================== Darstellung =====================
function statusColor(l){
  const a=(l.status?.abbrev||"").toLowerCase();
  if(l.webcast_live||a==="in flight") return "var(--live)";
  if(a==="go") return "var(--go)";
  if(a==="success") return "var(--go)";
  if(/fail/.test(a)) return "var(--live)";
  return "var(--tbd)";
}
function render(){
  padLayer.clearLayers();
  if(LAYERS && !LAYERS.pads){ padGroups=[]; return updateNext(); }
  const byPad = {}; padGroups = [];
  visible().forEach(l=>{ if(!l.pad) return; (byPad[l.pad.id] ||= []).push(l); });
  Object.values(byPad).forEach(list=>{
    padGroups.push(list);
    list.sort((a,b)=>new Date(a.net)-new Date(b.net));
    const l=list[0], live=list.some(x=>x.webcast_live);
    const icon=L.divIcon({className:"",iconSize:[18,18],
      html:`<div class="pin ${live?"live":""}" style="background:${statusColor(l)}">${list.length>1?`<span class="n">${list.length}</span>`:""}</div>`});
    L.marker([+l.pad.latitude,+l.pad.longitude],{icon}).addTo(padLayer)
      .bindTooltip(`${l.name}<br><small>${fmtDate(l.net)}</small>`)
      .on("click",()=> list.length>1 ? showList(list, l.pad.name) : select(l));
  });
  updateNext();
}

function updateNext(){
  const v=visible().filter(l=>new Date(l.net)>Date.now()-3600e3).sort((a,b)=>new Date(a.net)-new Date(b.net));
  const n=v[0]; const el=document.getElementById("next");
  if(!n){el.textContent="Keine Starts";return;}
  el.innerHTML=`Nächster: <b>${esc(n.name.split("|")[1]||n.name)}</b> · ${countdown(n.net)}`;
  el.onclick=()=>select(n);
}

function showList(list,title,tab){
  clearSat(); stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null;
  const P=document.getElementById("panel"); P.classList.remove("wide");
  P.innerHTML=`<div class="hd"><h2>${esc(title||"Kommende Starts")}</h2><button class="x" onclick="closeP()">×</button></div>`+
    (tab?`<div class="tabs"><button class="chip ${tab==="up"?"on":""}" onclick="showStartList('up')">Kommende</button><button class="chip ${tab==="past"?"on":""}" onclick="showStartList('past')">Vergangene</button></div>`:"")+
    list.map((l,i)=>`<div class="item" data-i="${i}">${imgTag(l,true)}<div><b>${esc(l.name)}</b><br>
      <small>${fmtDate(l.net)} · ${esc(l.pad?.location?.name||"")}</small><br>
      <span class="badge" style="background:${statusColor(l)};color:#000">${esc(l.status?.abbrev||"")}</span>
      ${l.webcast_live?'<span class="badge" style="background:var(--live)">● LIVE</span>':""}
      ${landIcons(l)} ${REM[l.id]?ICON.bell:""}</div></div>`).join("");
  P.querySelectorAll(".item").forEach(d=>d.onclick=()=>select(list[+d.dataset.i]));
  P.style.display="block"; P.scrollTop=0;
}
function closeP(){ follow=false; clearSat(); document.getElementById("panel").classList.remove("min"); document.getElementById("panel").classList.remove("wide"); document.getElementById("panel").style.display="none"; stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null; }
