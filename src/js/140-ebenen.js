// ===================== Ebenen (alles ausschaltbar) =====================
var LAYERS = {pads:true, stations:true, starlink:false, gnss:false, weather:false, live:true, night:true, time:true, fresh:false, home:true};
try{ Object.assign(LAYERS, JSON.parse(localStorage.getItem("lr_layers")||"{}")); }catch(e){}
const SAT_SRC={
  stations:{label:"Raumstationen (ISS, Tiangong)",color:"#ffffff",size:4,celestrak:"stations"},
  starlink:{label:"Starlink",color:"#8fc8ff",size:1.3,celestrak:"starlink"},
  gnss:{label:"Navigation (GPS, Galileo, …)",color:"#7be07b",size:2.6,celestrak:"gnss"},
  weather:{label:"Wettersatelliten",color:"#ffd25a",size:2.6,celestrak:"weather"}};
const SATS={}; let selSat=null;
const satLayer=L.layerGroup().addTo(map);
// Zeichenfläche liegt in einer Leaflet-Ebene (bewegt sich beim Verschieben mit und macht die Zoom-Animation mit,
// statt am Ende zu springen) – gleiches Prinzip wie Leaflets eigener Canvas-Renderer.
map.createPane("sats"); map.getPane("sats").style.zIndex=450; map.getPane("sats").style.pointerEvents="none";
const satcv=L.DomUtil.create("canvas","leaflet-zoom-animated",map.getPane("sats")); satcv.id="satcv";
const sx=satcv.getContext("2d");
let satView=null;   // Kartenausschnitt beim letzten Zeichnen (für die Zoom-Animation)
map.on("zoomanim",e=>{ if(!satView) return;
  const sc=map.getZoomScale(e.zoom,satView.zoom), off=map._latLngBoundsToNewLayerBounds(satView.bounds,e.zoom,e.center).min;
  L.DomUtil.setTransform(satcv,off,sc); });

function buildLayerMenu(){
  const el=document.getElementById("layers");
  const row=(k,lab,dot)=>`<label><input type="checkbox" data-k="${k}" ${LAYERS[k]?"checked":""}>${dot?`<span class="dot" style="background:${dot}"></span>`:""}<span>${lab}</span></label>`;
  el.innerHTML=`<h4>Starts</h4>${row("pads","Startplätze & Routen","#2ecc71")}${row("live","Live-Status bei laufenden Starts","#ff3b3b")}
    <h4>Erde & Zeit</h4>${row("night","Tag/Nacht-Grenze","#4a5878")}${row("time","Zeitraffer-Leiste","#4ea1ff")}
    <h4>Satelliten</h4>`+Object.entries(SAT_SRC).map(([k,s])=>row(k,s.label+(SATS[k]?` <span class="mute">(${SATS[k].length})</span>`:""),s.color)).join("")
    +row("fresh","Neueste Starts hervorheben","#ff4fd8")
    +`<h4>Mein Standort</h4>${row("home","Standort & ISS-Sichtkreis","#ffd25a")}
      <button class="chip ic" style="margin:4px 0 2px" onclick="document.getElementById('layers').style.display='none';openPasses()">${ICON.eye} ISS-Überflüge bei mir</button>`
    +subsMenuHtml()+pwaMenuHtml()+langMenuHtml()+infoMenuHtml();
  el.querySelectorAll("input").forEach(i=>i.onchange=async()=>{
    LAYERS[i.dataset.k]=i.checked; try{localStorage.setItem("lr_layers",JSON.stringify(LAYERS));}catch(e){}
    if(i.dataset.k==="pads"){ if(!i.checked){ closeP(); } render(); }
    if(i.dataset.k==="live") livePoll(true);
    if(i.dataset.k==="night") updateNight(true);
    if(i.dataset.k==="home") drawHome();
    if(i.dataset.k==="time"){ if(!i.checked) simReset(); updTimeUI(); }
    if(i.dataset.k==="fresh"){ if(i.checked){ await loadSats("starlink"); setFresh(); } else if(HL&&HL.fresh){ HL=null; } drawSatMap(); }
    if(SAT_SRC[i.dataset.k]){ if(i.checked){ await loadSats(i.dataset.k); buildLayerMenu(); } else if(selSat&&selSat.g===i.dataset.k) closeP(); propAll(true); }
  });
}
document.getElementById("layerBtn").onclick=e=>{ e.stopPropagation(); const el=document.getElementById("layers");
  el.style.display=el.style.display==="block"?"none":"block"; if(el.style.display==="block") buildLayerMenu(); };
document.addEventListener("click",e=>{ const el=document.getElementById("layers"); if(!el.contains(e.target)&&e.target.id!=="layerBtn") el.style.display="none"; });

// ---------- Satelliten laden (CelesTrak, Cache 2h, sonst eingebetteter Schnappschuss) ----------
function parseTLE(t){ const L=t.split(/\r?\n/).map(s=>s.trimEnd()).filter(Boolean), out=[], seen=new Set();
  for(let i=0;i+2<L.length+1;){
    if(L[i+1]?.startsWith("1 ") && L[i+2]?.startsWith("2 ")){
      const key=L[i+2].slice(8); if(!seen.has(key)){ seen.add(key); try{ out.push({name:L[i].trim(),rec:satellite.twoline2satrec(L[i+1],L[i+2]),intl:L[i+1].slice(9,17).trim()}); }catch(e){} }
      i+=3; } else i++; }
  return out; }
async function loadSats(g){
  if(SATS[g]) return; let txt=null, src="live";
  try{ const c=JSON.parse(localStorage.getItem("lr_tle_"+g)||"null"); if(c && Date.now()-c.ts<2*3600e3) txt=c.t; }catch(e){}
  if(!txt){ try{ const r=await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${SAT_SRC[g].celestrak}&FORMAT=tle`);
      if(!r.ok) throw 0; txt=await r.text(); if(!txt.includes("\n1 ")) throw 0;
      try{ localStorage.setItem("lr_tle_"+g,JSON.stringify({ts:Date.now(),t:txt})); }catch(e){} }catch(e){ txt=null; } }
  if(!txt){ const T=await snapData("tle"); if(T&&T[g]){ txt=T[g]; src="snap"; } }
  if(!txt){ toast(SAT_SRC[g].label+": nur online verfügbar (im Browser öffnen)"); SATS[g]=[]; return; }
  if(src==="snap") toast(SAT_SRC[g].label+": Bahndaten vom "+SNAP_TS+" (Positionen trotzdem live berechnet)");
  SATS[g]=parseTLE(txt); propGroup(g,new Date());
}
const D=180/Math.PI;
function propOne(s,date,gm){ const pv=satellite.propagate(s.rec,date); if(!pv||!pv.position){s.ok=false;return;}
  const g=satellite.eciToGeodetic(pv.position,gm); s.lat=g.latitude*D; s.lon=g.longitude*D; s.h=g.height;
  const v=pv.velocity; s.v=Math.hypot(v.x,v.y,v.z); s.ok=true; }
function propGroup(g,date){ const gm=satellite.gstime(date); (SATS[g]||[]).forEach(s=>propOne(s,date,gm)); }
let propTick=0;
let lastProp=0;
function propAll(force){ const real=Date.now(); if(!force && SIM.speed===1 && real-lastProp<950) return; lastProp=real;
  const now=simNow(); propTick++;
  for(const g in SAT_SRC){ if(!LAYERS[g]||!SATS[g]) continue; if(g==="stations"||force||SIM.speed>1||propTick%3===0) propGroup(g,now); }
  if(HL){ const gm=satellite.gstime(now); HL.sats.forEach(s=>propOne(s,now,gm)); }
  updateNight(); updTimeUI();
  if(selSat){ propOne(selSat.s,now,satellite.gstime(now)); updateSatPanel(); }
  if(SIM.speed>1 && selSat && real-(selSat.tt||0)>3000){ selSat.track=satTrack(selSat.s); selSat.tt=real; }
  drawSatMap(); }
setInterval(()=>propAll(false),250);

// ---------- Zeichnen auf der 2D-Karte ----------
function drawSatMap(){
  if(map._animatingZoom) return;                       // während der Zoom-Animation übernimmt die CSS-Transformation
  const sz=map.getSize(), r=devicePixelRatio||1;
  if(satcv.width!==Math.round(sz.x*r)||satcv.height!==Math.round(sz.y*r)){ satcv.width=Math.round(sz.x*r); satcv.height=Math.round(sz.y*r); satcv.style.width=sz.x+"px"; satcv.style.height=sz.y+"px"; }
  L.DomUtil.setTransform(satcv,map.containerPointToLayerPoint([0,0]),1);   // Fläche deckt genau den sichtbaren Ausschnitt
  satView={bounds:map.getBounds(),zoom:map.getZoom()};
  sx.setTransform(r,0,0,r,0,0); sx.clearRect(0,0,sz.x,sz.y);
  if(G.on) return;
  for(const g of ["starlink","gnss","weather","stations"]){
    if(!LAYERS[g]||!SATS[g]) continue; const S=SAT_SRC[g]; sx.fillStyle=S.color;
    for(const s of SATS[g]){ if(!s.ok) continue;
      for(const sh of [-360,0,360]){ const p=map.latLngToContainerPoint([s.lat,s.lon+sh]);
        if(p.x<-10||p.y<-10||p.x>sz.x+10||p.y>sz.y+10) continue;
        if(g==="stations"){ satIcon(sx,p.x,p.y,s); } else sx.fillRect(p.x-S.size/2,p.y-S.size/2,S.size,S.size); } } }
  hlDraw2D(sz);
  if(selSat&&selSat.s.ok){ const s=selSat.s; for(const sh of [-360,0,360]){ const p=map.latLngToContainerPoint([s.lat,s.lon+sh]);
      sx.beginPath(); sx.arc(p.x,p.y,9,0,7); sx.strokeStyle="#ff3b3b"; sx.lineWidth=2; sx.stroke(); } }
}
function satIcon(c,x,y,s){ const big=/ISS \(ZARYA\)|TIANHE|CSS/.test(s.name);
  if(!big){ c.beginPath(); c.arc(x,y,2.6,0,7); c.fillStyle="#fff"; c.fill(); c.fillStyle=SAT_SRC.stations.color; return; }
  c.save(); c.shadowColor="#9ad0ff"; c.shadowBlur=8;
  c.fillStyle="#7fb6ff"; c.fillRect(x-12,y-3,8,6); c.fillRect(x+4,y-3,8,6);        // Solarpanels
  c.fillStyle="#fff"; c.fillRect(x-4,y-0.8,8,1.6); c.fillRect(x-2.5,y-2.5,5,5);      // Körper
  c.restore(); c.textAlign="center"; c.textBaseline="middle";
  if(big){ c.font="bold 11px sans-serif"; c.fillStyle="#fff"; c.fillText(/ISS/.test(s.name)?"ISS":"Tiangong",x,y+16); c.fillStyle=SAT_SRC.stations.color; } }
map.on("move zoomend moveend resize viewreset",drawSatMap);
map.on("click",e=>{ const hit=nearestSat(map.latLngToContainerPoint(e.latlng)); if(hit) selectSat(hit.s,hit.g); });
function nearestSat(pt){ let best=null,bd=1e9;
  for(const g in SAT_SRC){ if(!LAYERS[g]||!SATS[g]) continue; const lim=g==="stations"?22:10;
    for(const s of SATS[g]){ if(!s.ok) continue; for(const sh of [-360,0,360]){ const p=map.latLngToContainerPoint([s.lat,s.lon+sh]);
      const d=Math.hypot(p.x-pt.x,p.y-pt.y); if(d<lim && d<bd){bd=d;best={s,g};} } } }
  return best; }

// ---------- Globus ----------
function satDrawGlobe(c,proj,path,vis,pt){
  hlDrawGlobe(c,vis,pt); homeDrawGlobe(c,path,vis,pt);
  for(const g of ["starlink","gnss","weather","stations"]){
    if(!LAYERS[g]||!SATS[g]) continue; const S=SAT_SRC[g]; c.fillStyle=S.color;
    for(const s of SATS[g]){ if(!s.ok||!vis([s.lat,s.lon])) continue; const q=pt([s.lat,s.lon]);
      if(g==="stations"){ satIcon(c,q[0],q[1],s); } else c.fillRect(q[0]-S.size/2,q[1]-S.size/2,S.size,S.size);
      if(g==="stations"||g==="gnss"||G.hits.length<400) G.hits.push({x:q[0],y:q[1],sat:s,g}); } }
  if(selSat){ c.setLineDash([4,5]); c.beginPath(); path({type:"LineString",coordinates:selSat.track.map(p=>[p[1],p[0]])});
    c.strokeStyle="#ff6b6b"; c.lineWidth=1.8; c.stroke(); c.setLineDash([]);
    if(selSat.s.ok&&vis([selSat.s.lat,selSat.s.lon])){ const q=pt([selSat.s.lat,selSat.s.lon]); c.beginPath(); c.arc(q[0],q[1],9,0,7); c.strokeStyle="#ff3b3b"; c.lineWidth=2; c.stroke(); } }
}

// ---------- Satellit auswählen ----------
function satTrack(s){ const P=2*Math.PI/s.rec.no, pts=[]; let prev=null,off=0; const t0=simNow().getTime();
  for(let m=0;m<=P;m+=0.5){ const d=new Date(t0+m*60e3), pv=satellite.propagate(s.rec,d); if(!pv||!pv.position) continue;
    const g=satellite.eciToGeodetic(pv.position,satellite.gstime(d)); let lo=g.longitude*D;
    if(prev!==null){ const dl=lo+off-prev; if(dl>180) off-=360; else if(dl<-180) off+=360; } prev=lo+off; pts.push([g.latitude*D,lo+off]); }
  return pts; }
function clearSat(){ selSat=null; satLayer.clearLayers(); }
function selectSat(s,g){
  stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null; follow=false; setHash(null);
  selSat={s,g,track:satTrack(s)}; satLayer.clearLayers();
  L.polyline(segs(selSat.track),{color:"#ff6b6b",weight:2,dashArray:"4 6"}).bindTooltip("Bahn der nächsten ~"+Math.round(2*Math.PI/s.rec.no)+" Min",{sticky:true}).addTo(satLayer);
  const P=document.getElementById("panel"), rec=s.rec; P.classList.remove("wide");
  const epochDays=(rec.jdsatepoch+(rec.jdsatepochF||0)-2440587.5)*86400e3, ageH=(Date.now()-epochDays)/3600e3;
  const SG=SAT_SRC[g]||{label:"Hervorgehoben",color:"#ff4fd8"};
  P.innerHTML=`<div class="hd"><h2>${esc(s.name)}<br><span class="badge" style="background:${SG.color};color:#000">${esc(SG.label)}</span></h2><button class="x" onclick="closeP()">×</button></div>
   <div class="sec"><h3>Live-Position (berechnet)</h3><div class="grid">
     <b>Höhe</b><span id="sH">–</span><b>Geschwindigkeit</b><span id="sV">–</span><b>Position</b><span id="sP">–</span>
   </div></div>
   <div class="sec"><h3>Bahn</h3><div class="grid">
     <b>NORAD-ID</b><span>${esc(rec.satnum)}</span>
     <b>Inklination</b><span>${(rec.inclo*D).toFixed(1)}°</span>
     <b>Umlaufzeit</b><span>${(2*Math.PI/rec.no).toFixed(1)} Min</span>
     <b>Umläufe/Tag</b><span>${(1440/(2*Math.PI/rec.no)).toFixed(2)}</span>
     <b>Bahndaten-Alter</b><span>${ageH<48?ageH.toFixed(0)+" h":(ageH/24).toFixed(1)+" Tage"}</span>
   </div><div class="note">Position wird jede Sekunde aus den Bahnelementen (TLE, CelesTrak) mit dem SGP4-Modell berechnet – genau auf wenige km.</div>
   ${/ISS \(ZARYA\)|TIANHE/.test(s.name)?`<button class="btn sec2" onclick="PASS.sat='${/ISS/.test(s.name)?"iss":"css"}';openPasses()">${ICON.eye} Wann ist sie bei mir sichtbar?</button>`:""}</div>`;
  P.style.display="block"; P.scrollTop=0; updateSatPanel(); drawSatMap();
  if(G.on) G.target=[-s.lon,-s.lat]; else map.panTo([s.lat,s.lon]);
}
function updateSatPanel(){ if(!selSat) return; const s=selSat.s, H=document.getElementById("sH"); if(!H||!s.ok) return;
  H.textContent=s.h.toFixed(0)+" km"; document.getElementById("sV").textContent=(s.v*3600).toLocaleString(LOC,{maximumFractionDigits:0})+" km/h ("+s.v.toFixed(2)+" km/s)";
  document.getElementById("sP").textContent=s.lat.toFixed(2)+"°, "+s.lon.toFixed(2)+"°"; }
