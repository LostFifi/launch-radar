// ===================== Darstellung =====================
function statusColor(l){
  const a=(l.status?.abbrev||"").toLowerCase();
  const st=launchState(l);
  if(st==="flying"||(l.webcast_live&&st!=="done")) return "var(--live)";
  if(st==="done"&&!/fail/.test(a)) return "var(--go)";
  if(a==="go") return "var(--go)";
  if(a==="success") return "var(--go)";
  if(/fail/.test(a)) return "var(--live)";
  return "var(--tbd)";
}
// ---------- Startorte: alle Rampen eines Orts (gleicher Standort oder < 40 km entfernt) in EINEM Punkt ----------
// z.B. Cape Canaveral SFS (SLC-40, SLC-41) + Kennedy Space Center (LC-39A) → „Cape Canaveral / Kennedy“
const shortLoc=n=>(n||"").split(",")[0].replace(/ (SFS|SFB|Space Force Station|Space Force Base)$/,"").trim();
function padShort(n){ return (n||"").replace(/^Space Launch Complex /,"SLC-").replace(/^Launch Complex /,"LC-").replace(/^Orbital Launch Pad/,"Orbital Pad").replace(/^Unknown Pad$/,"Rampe noch offen"); }
function siteName(locs){
  const s=[...new Set([...locs].map(shortLoc))];
  if(s.some(x=>/cape canaveral/i.test(x)) && s.some(x=>/kennedy/i.test(x))) return "Cape Canaveral / Kennedy";
  return s.join(" / ");
}
function buildSites(list){
  const sites=[];
  list.forEach(l=>{ if(!l.pad) return; const ll=[+l.pad.latitude,+l.pad.longitude], loc=l.pad.location?.name||l.pad.name;
    let s=sites.find(x=>x.locs.has(loc)||hav(x.ll,ll)<40);
    if(!s){ s={ll,locs:new Set(),list:[]}; sites.push(s); }
    s.locs.add(loc); s.list.push(l); });
  sites.forEach(s=>{
    s.list.sort((a,b)=>new Date(a.net)-new Date(b.net)); s.name=siteName(s.locs); s.list.site=s;
    s.pads=[...new Set(s.list.map(l=>l.pad.id))];
    // Punkt in die Mitte der Rampen (nur bekannte Rampen, „Unknown Pad“ verschiebt sonst)
    const known=s.list.filter(l=>!/unknown/i.test(l.pad.name)), use=known.length?known:s.list, ids=new Set(), pts=[];
    use.forEach(l=>{ if(!ids.has(l.pad.id)){ ids.add(l.pad.id); pts.push([+l.pad.latitude,+l.pad.longitude]); } });
    s.ll=[pts.reduce((a,p)=>a+p[0],0)/pts.length, pts.reduce((a,p)=>a+p[1],0)/pts.length]; });
  return sites;
}
function openGroup(list){ list.length>1 ? showSite(list.site) : select(list[0]); }
function render(){
  padLayer.clearLayers();
  if(LAYERS && !LAYERS.pads){ padGroups=[]; return updateNext(); }
  padGroups=buildSites(visible()).map(s=>s.list);
  padGroups.forEach(list=>{
    const s=list.site, l=list[0], live=list.some(x=>x.webcast_live);
    const icon=L.divIcon({className:"",iconSize:[18,18],
      html:`<div class="pin ${live?"live":""}" style="background:${statusColor(l)}">${list.length>1?`<span class="n">${list.length}</span>`:""}</div>`});
    L.marker(s.ll,{icon}).addTo(padLayer)
      .bindTooltip(`<b>${esc(s.name)}</b>${s.pads.length>1?` <span class="mute">· ${s.pads.length} Startkomplexe</span>`:""}<br>Nächster: ${esc(l.name)}<br><small>${fmtDate(l.net)}</small>`)
      .on("click",()=>openGroup(list));
  });
  document.getElementById("listBtn").classList.toggle("filt",filterActive());   // Punkt am Liste-Knopf: Filter aktiv
  applySubs();                     // Abos: neue passende Starts bekommen automatisch eine Erinnerung
  updateNext(); livePoll(false);   // Live-Banner sofort nach dem Laden (fragt höchstens alle 5 Min nach)
  openFromHash();                  // #start=<id> in der Adresse → diesen Start öffnen
}
// Liste eines Startorts mit Unterkapiteln je Startkomplex (aufklappbar)
function showSite(s){
  const byPad={}; s.list.forEach(l=>(byPad[l.pad.id] ||= []).push(l));
  const pads=Object.values(byPad).sort((a,b)=>new Date(a[0].net)-new Date(b[0].net));
  if(pads.length===1) return showList(s.list, s.name+" · "+padShort(s.list[0].pad.name));
  const flat=pads.flat();
  showList(flat, s.name, null, pads.map(p=>({title:padShort(p[0].pad.name), full:/unknown/i.test(p[0].pad.name)?"Startkomplex noch nicht bekannt gegeben":p[0].pad.name, loc:shortLoc(p[0].pad.location?.name), n:p.length, live:p.some(x=>x.webcast_live)})));
}

function updateNext(){
  const v=visible().filter(l=>new Date(l.net)>Date.now()-3600e3).sort((a,b)=>new Date(a.net)-new Date(b.net));
  const n=v[0]; const el=document.getElementById("next");
  if(!n){el.textContent="Keine Starts";return;}
  el.innerHTML=`Nächster: <b>${esc(n.name.split("|")[1]||n.name)}</b> · ${launchState(n)==="unconfirmed"?'<span style="color:var(--tbd)">Startzeit vorbei, nicht bestätigt</span>':countdown(n.net)}`;
  el.onclick=()=>select(n);
  layoutTop();   // Kopfzeile kann zweizeilig werden → Banner darunter neu ausrichten
}

// groups (optional): Unterkapitel [{title,full,loc,n,live}] – list ist dann in dieser Reihenfolge sortiert
function showList(list,title,tab,groups){
  clearSat(); stopSim(); setHash(null); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null;
  const P=document.getElementById("panel"); P.classList.remove("wide");
  const item=(l,i)=>`<div class="item" data-i="${i}">${imgTag(l,true)}<div><b>${esc(l.name)}</b><br>
      <small>${fmtDate(l.net)} · ${esc(groups?padShort(l.pad?.name):l.pad?.location?.name||"")}</small><br>
      <span class="badge" style="background:${statusColor(l)};color:#000">${esc(l.status?.abbrev||"")}</span>
      ${l.webcast_live&&launchState(l)!=="done"?'<span class="badge" style="background:var(--live)">● LIVE</span>':""}
      ${postponedPill(l)} ${landIcons(l)} ${REM[l.id]?ICON.bell:""}</div></div>`;
  let body;
  if(groups){ let i=0;
    body=`<div class="sec mute" style="font-size:13px">${list.length} Starts auf ${groups.length} Startkomplexen</div>`+
      groups.map(g=>{ const items=list.slice(i,i+g.n).map((l,k)=>item(l,i+k)).join(""); i+=g.n;
        return `<details class="padgrp" open><summary><span class="pt">${esc(g.title)}${g.live?' <span class="badge" style="background:var(--live)">● LIVE</span>':""}</span>
          <span class="mute">${g.n} ${g.n===1?"Start":"Starts"}</span><small>${esc(g.full)}${g.loc?" · "+esc(g.loc):""}</small></summary>${items}</details>`; }).join("");
  } else body=list.map(item).join("");
  P.innerHTML=`<div class="hd"><h2>${esc(title||"Kommende Starts")}</h2><button class="x" onclick="closeP()">×</button></div>`+
    (tab?`<div class="tabs"><button class="chip ${tab==="up"?"on":""}" onclick="showStartList('up')">Kommende</button><button class="chip ${tab==="past"?"on":""}" onclick="showStartList('past')">Vergangene</button></div>`:"")+body;
  P.querySelectorAll(".item").forEach(d=>d.onclick=()=>select(list[+d.dataset.i]));
  P.style.display="block"; P.scrollTop=0;
}
function closeP(){ follow=false; setHash(null); clearSat(); document.getElementById("panel").classList.remove("min"); document.getElementById("panel").classList.remove("wide"); document.getElementById("panel").style.display="none"; stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null; }
