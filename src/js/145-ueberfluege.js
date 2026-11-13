// ===================== Mein Standort & Überflüge (ISS, Tiangong) =====================
// Standort bleibt nur im Browser (localStorage "lr_home"), gerundet auf ~1 km.
// Sichtbar = Station von der Sonne beleuchtet, beim Beobachter Dämmerung/Nacht (Sonne < −6°), mind. 10° über Horizont.
ICON.home='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="vertical-align:-2px"><path d="M12 21s-7-6.3-7-11.5a7 7 0 0 1 14 0C19 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
ICON.eye='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="vertical-align:-2px"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var HOME=null; try{ HOME=JSON.parse(localStorage.getItem("lr_home")||"null"); }catch(e){}
const PASS_DAYS=10, PASS_MINEL=10, STATIONS={iss:{re:/ISS \(ZARYA\)/,label:"ISS"},css:{re:/CSS \(TIANHE\)|TIANHE/,label:"Tiangong"}};
var PASS={sat:"iss", all:false, open:null, cache:{}};
const homeLayer=L.layerGroup().addTo(map);

// ---------- Standort ----------
function setHome(lat,lon){
  HOME={lat:Math.round(lat*100)/100, lon:Math.round(norm(lon)*100)/100};
  try{ localStorage.setItem("lr_home",JSON.stringify(HOME)); }catch(e){}
  PASS.cache={}; if(!LAYERS.home){ LAYERS.home=true; try{localStorage.setItem("lr_layers",JSON.stringify(LAYERS));}catch(e){} }
  drawHome(); if(!G.on) map.setView([HOME.lat,HOME.lon],Math.max(map.getZoom(),4)); openPasses();
}
function locateHome(){
  if(!navigator.geolocation){ toast("Kein GPS verfügbar – tippe auf die Karte"); return pickHome(); }
  toast("Standort wird ermittelt …");
  navigator.geolocation.getCurrentPosition(p=>setHome(p.coords.latitude,p.coords.longitude),
    ()=>{ toast("Standort nicht freigegeben – tippe stattdessen auf die Karte"); pickHome(); },{timeout:15000,maximumAge:3600e3});
}
var homePick=false;
function pickHome(){
  if(G.on) document.getElementById("globeBtn").click();
  homePick=true; document.getElementById("panel").classList.add("min");
  toast("Tippe auf der Karte auf deinen Standort");
}
map.on("click",e=>{ if(!homePick) return; homePick=false; setHome(e.latlng.lat,e.latlng.lng); });
function clearHome(){ HOME=null; try{ localStorage.removeItem("lr_home"); }catch(e){} PASS.cache={}; drawHome(); openPasses(); }

// Bodenradius (km), in dem eine Station in Höhe h mindestens el° über dem Horizont steht
function visRadius(h,el){ const e=el/D; return (Math.acos(R_E*Math.cos(e)/(R_E+h))-e)*R_E; }
function drawHome(){
  homeLayer.clearLayers(); if(!HOME||!LAYERS.home) return;
  const icon=L.divIcon({className:"",iconSize:[14,14],html:'<div class="homepin"></div>'});
  for(const sh of [-360,0,360]){
    L.circle([HOME.lat,HOME.lon+sh],{radius:visRadius(420,PASS_MINEL)*1000,color:"#ffd25a",weight:1,opacity:.6,dashArray:"4 6",fill:false,interactive:false}).addTo(homeLayer);
    L.marker([HOME.lat,HOME.lon+sh],{icon,zIndexOffset:500}).bindTooltip("Mein Standort<br><small>Gestrichelt: ISS hier mind. 10° hoch</small>").on("click",openPasses).addTo(homeLayer);
  }
}
function homeDrawGlobe(c,path,vis,pt){
  if(!HOME||!LAYERS.home) return;
  c.setLineDash([3,5]); c.beginPath(); path(d3.geoCircle().center([HOME.lon,HOME.lat]).radius(visRadius(420,PASS_MINEL)/R_E*D)());
  c.strokeStyle="rgba(255,210,90,.6)"; c.lineWidth=1; c.stroke(); c.setLineDash([]);
  if(!vis([HOME.lat,HOME.lon])) return; const q=pt([HOME.lat,HOME.lon]);
  c.beginPath(); c.arc(q[0],q[1],5,0,7); c.fillStyle="#ffd25a"; c.fill(); c.lineWidth=2.5; c.strokeStyle="#0b0f17"; c.stroke();
}

// ---------- Berechnung ----------
function sunEci(d){ const n=d.getTime()/864e5+2440587.5-2451545, r=Math.PI/180;
  const L0=(280.46+0.9856474*n)%360, g=(357.528+0.9856003*n)*r, lam=(L0+1.915*Math.sin(g)+0.02*Math.sin(2*g))*r, eps=(23.439-4e-7*n)*r;
  return [Math.cos(lam),Math.cos(eps)*Math.sin(lam),Math.sin(eps)*Math.sin(lam)]; }
// Erdschatten als Zylinder: beleuchtet, wenn auf der Sonnenseite oder weiter als der Erdradius von der Schattenachse
function sunlit(p,d){ const s=sunEci(d), dot=p.x*s[0]+p.y*s[1]+p.z*s[2]; if(dot>0) return true;
  return Math.sqrt(Math.max(0,p.x*p.x+p.y*p.y+p.z*p.z-dot*dot))>6378; }
function sunElev(d,lat,lon){ const s=sunPos(d), r=Math.PI/180;
  return Math.asin(Math.sin(lat*r)*Math.sin(s.lat*r)+Math.cos(lat*r)*Math.cos(s.lat*r)*Math.cos((lon-s.lon)*r))/r; }
function lookAt(rec,t,obs){ const d=new Date(t), pv=satellite.propagate(rec,d); if(!pv||!pv.position) return null;
  const la=satellite.ecfToLookAngles(obs,satellite.eciToEcf(pv.position,satellite.gstime(d)));
  return {el:la.elevation*D, az:(la.azimuth*D+360)%360, km:la.rangeSat, pos:pv.position}; }
function findPasses(s){
  const obs={latitude:HOME.lat/D,longitude:HOME.lon/D,height:0.4}, t0=Date.now(), out=[], step=30e3;
  const elAt=t=>{ const l=lookAt(s.rec,t,obs); return l?l.el:-90; };
  const edge=(a,b,rising)=>{ for(let i=0;i<12;i++){ const m=(a+b)/2; if((elAt(m)>0)===rising) b=m; else a=m; } return (a+b)/2; };
  let prev=elAt(t0), up=prev>0?t0:null;
  for(let t=t0+step;t<t0+PASS_DAYS*864e5;t+=step){ const e=elAt(t);
    if(prev<=0&&e>0) up=edge(t-step,t,true);
    if(prev>0&&e<=0&&up!==null){ const p=analysePass(s,up,edge(t-step,t,false),obs); if(p.maxEl>=PASS_MINEL) out.push(p); up=null; }
    prev=e; }
  return out;
}
function analysePass(s,a,b,obs){
  const p={start:a,end:b,maxEl:-90,pts:[],visStart:null,visEnd:null,visMax:0};
  for(let t=a;t<=b+1;t+=Math.max(2e3,(b-a)/90)){ const l=lookAt(s.rec,Math.min(t,b),obs); if(!l) continue;
    const v=l.el>=PASS_MINEL && sunlit(l.pos,new Date(t)) && sunElev(new Date(t),HOME.lat,HOME.lon)<-6;
    p.pts.push([l.az,Math.max(0,l.el),v]);
    if(l.el>p.maxEl){ p.maxEl=l.el; p.tMax=t; p.km=l.km; }
    if(v){ if(p.visStart===null) p.visStart=t; p.visEnd=t; p.visMax=Math.max(p.visMax,l.el); } }
  p.vis=p.visStart!==null && p.visEnd-p.visStart>=30e3;
  const lv=p.pts.map(x=>x[2]).lastIndexOf(true);
  p.fade=p.vis && p.pts.slice(lv+1).some(x=>x[1]>=PASS_MINEL);   // verschwindet mitten am Himmel im Erdschatten
  p.day=sunElev(new Date(p.tMax),HOME.lat,HOME.lon)>=-6;
  return p;
}
function compass(az){ return ["N","NO","O","SO","S","SW","W","NW"][Math.round(az/45)%8]; }
function stationSat(k){ return (SATS.stations||[]).find(s=>STATIONS[k].re.test(s.name)); }

// ---------- Fenster ----------
function openPasses(){
  clearSat(); stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null; follow=false; setHash(null);
  const P=document.getElementById("panel"); P.classList.remove("wide","min");
  const hd=`<div class="hd"><h2>${ICON.eye} Überflüge bei mir</h2><button class="x" onclick="closeP()">×</button></div>`;
  if(!HOME){
    P.innerHTML=hd+`<div class="sec"><p style="margin:0 0 10px">Wann fliegt die ISS (oder Tiangong) sichtbar über dich? Dafür brauche ich deinen Standort.</p>
      <button class="btn" onclick="locateHome()">${ICON.home} Standort ermitteln (GPS)</button>
      <button class="btn sec2" onclick="pickHome()">Auf der Karte wählen</button>
      <div class="note">Der Standort wird auf ~1 km gerundet und nur in diesem Browser gespeichert – er wird nirgends hingeschickt.</div></div>`;
    P.style.display="block"; P.scrollTop=0; return;
  }
  P.innerHTML=hd+`<div class="tabs">${Object.entries(STATIONS).map(([k,s])=>`<button class="chip ${PASS.sat===k?"on":""}" onclick="PASS.sat='${k}';PASS.open=null;openPasses()">${s.label}</button>`).join("")}
      <span style="flex:1"></span><button class="chip ${PASS.all?"":"on"}" onclick="PASS.all=!PASS.all;openPasses()">Nur sichtbare</button></div>
    <div id="passList"><div class="sec mute">Berechne Überflüge der nächsten ${PASS_DAYS} Tage …</div></div>
    <div class="sec"><div class="grid"><b>Standort</b><span>${HOME.lat.toFixed(2)}°, ${HOME.lon.toFixed(2)}°
      <button class="chip" style="padding:2px 8px;margin-left:6px" onclick="pickHome()">ändern</button>
      <button class="chip" style="padding:2px 8px" onclick="clearHome()">löschen</button></span></div>
    <div class="note" id="passNote"></div></div>`;
  P.style.display="block"; P.scrollTop=0;
  setTimeout(async()=>{ await loadSats("stations"); renderPasses(); },30);
}
function renderPasses(){
  const box=document.getElementById("passList"); if(!box) return;
  const s=stationSat(PASS.sat);
  if(!s){ box.innerHTML=`<div class="sec mute">Keine Bahndaten für ${STATIONS[PASS.sat].label} gefunden.</div>`; return; }
  const key=PASS.sat+HOME.lat+","+HOME.lon+"|"+s.rec.jdsatepoch, c=PASS.cache[key];
  const list=(c&&Date.now()-c.ts<15*60e3)?c.list:(PASS.cache[key]={ts:Date.now(),list:findPasses(s)}).list;
  const now=Date.now(), show=list.filter(p=>p.end>now && (PASS.all||p.vis));
  const age=(Date.now()-(s.rec.jdsatepoch+(s.rec.jdsatepochF||0)-2440587.5)*864e5)/864e5;
  document.getElementById("passNote").innerHTML=`Berechnet aus Bahndaten vom ${age<1?"heute":age.toFixed(1)+" Tagen"} (SGP4). Mehr als ~3 Tage im Voraus können die Zeiten um Minuten abweichen – Station manövriert gelegentlich.
    <br>Sichtbar = Station von der Sonne beleuchtet, bei dir Dämmerung oder Nacht, mind. ${PASS_MINEL}° hoch. Zeiten sind geschätzt.`;
  if(!show.length){ box.innerHTML=`<div class="sec mute">Keine ${PASS.all?"":"sichtbaren "}Überflüge in den nächsten ${PASS_DAYS} Tagen.${PASS.all?"":" Tipp: „Nur sichtbare“ ausschalten."}</div>`; return; }
  const tm=t=>new Date(t).toLocaleTimeString(LOC,{hour:"2-digit",minute:"2-digit"});
  box.innerHTML=show.slice(0,40).map((p,i)=>{
    const a=p.vis?p.visStart:p.start, e=p.vis?p.visEnd:p.end, el=p.vis?p.visMax:p.maxEl;
    const f=p.pts.find(x=>x[2])||p.pts[0], l=[...p.pts].reverse().find(x=>x[2])||p.pts[p.pts.length-1];
    const q=!p.vis?(p.day?"Tageslicht":"im Erdschatten"):el>=50?"sehr gut sichtbar":el>=25?"gut sichtbar":"tief am Horizont";
    const qc=!p.vis?"#3a4560":el>=50?"var(--go)":el>=25?"#8fc8ff":"var(--tbd)";
    const id="pass-"+PASS.sat+"-"+Math.round(a/60e3);
    return `<div class="pass ${p.vis?"":"dim"}" onclick="PASS.open=PASS.open===${i}?null:${i};renderPasses()">
      <div><b>${new Date(a).toLocaleDateString(LOC,{weekday:"short",day:"2-digit",month:"2-digit"})}</b><br><span class="tn">${tm(a)} – ${tm(e)}</span></div>
      <div class="pe"><b>${Math.round(el)}°</b><small>max. Höhe</small></div>
      <div>von ${compass(f[0])} ${p.fade?`– verschwindet im ${compass(l[0])} im Erdschatten`:`nach ${compass(l[0])}`}<br><span class="pill" style="background:${qc};color:${p.vis?"#000":"var(--text)"}">${q}</span></div>
      <div class="pa" onclick="event.stopPropagation()">
        <button class="ib" title="Auf Karte zeigen (Zeitraffer)" onclick="showPass(${p.start})">${ICON.sat}</button>
        ${p.vis&&a>now?`<button class="ib ${REM[id]?"on":""}" title="10 Min vorher erinnern" onclick="passRem('${id}',${a},'von ${compass(f[0])} nach ${compass(l[0])}, max. ${Math.round(el)}°')">${ICON.bell}</button>`:""}
      </div></div>${PASS.open===i?`<div class="sky">${skySvg(p)}<div class="note">Himmelskarte: Mitte = senkrecht über dir, Rand = Horizont. Durchgezogen = sichtbar. Nach Süden schauend ist Osten links.</div></div>`:""}`;
  }).join("");
}
function skySvg(p){
  const R=80, c=90, xy=([az,el])=>{ const r=(90-el)/90*R, a=az/D; return [c+r*Math.sin(a),c-r*Math.cos(a)]; };
  let seg="", cur=null, prev=null;
  const lines=[]; p.pts.forEach(pt=>{ if(!cur||cur.v!==pt[2]){ cur={v:pt[2],pts:prev?[prev]:[]}; lines.push(cur); } cur.pts.push(xy(pt)); prev=xy(pt); });
  seg=lines.map(l=>`<polyline points="${l.pts.map(q=>q.map(v=>v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="${l.v?"#ffd25a":"#5a6a8a"}" stroke-width="${l.v?3:1.5}" ${l.v?"":'stroke-dasharray="3 4"'} stroke-linecap="round"/>`).join("");
  const s=xy(p.pts[0]), m=p.pts.reduce((a,b)=>b[1]>a[1]?b:a), mm=xy(m);
  return `<svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Bahn am Himmel">
    <circle cx="${c}" cy="${c}" r="${R}" fill="#0b0f17" stroke="#3a4560"/><circle cx="${c}" cy="${c}" r="${R*2/3}" fill="none" stroke="#232c3f"/><circle cx="${c}" cy="${c}" r="${R/3}" fill="none" stroke="#232c3f"/>
    <path d="M${c} ${c-R}V${c+R}M${c-R} ${c}H${c+R}" stroke="#232c3f"/>
    <g font-size="10" fill="#8a96ad" text-anchor="middle"><text x="${c}" y="${c-R-3}">N</text><text x="${c}" y="${c+R+10}">S</text><text x="${c+R+6}" y="${c+3}">O</text><text x="${c-R-6}" y="${c+3}">W</text></g>
    ${seg}<circle cx="${s[0]}" cy="${s[1]}" r="3" fill="#8a96ad"/><circle cx="${mm[0]}" cy="${mm[1]}" r="3.5" fill="#fff"/></svg>`;
}
function showPass(start){
  if(!LAYERS.stations||!LAYERS.time){ LAYERS.stations=true; LAYERS.time=true; try{localStorage.setItem("lr_layers",JSON.stringify(LAYERS));}catch(e){} }
  SIM.base=start-60e3; SIM.anchor=Date.now(); SIM.speed=60;
  const s=stationSat(PASS.sat); propAll(true); if(s) selectSat(s,"stations");
  toast("Zeitraffer 60× ab 1 Min vor dem Überflug – „Jetzt“ in der Zeitleiste setzt zurück");
}
function passRem(id,t,txt){
  if(REM[id]) delete REM[id];
  else { REM[id]={name:i18n(STATIONS[PASS.sat].label+"-Überflug"),net:new Date(t).toISOString(),fired:false,kind:"pass",txt:i18n(txt)};
    pwaAsk(); beep(true); toast("Erinnerung gesetzt – 10 Min vor dem Überflug"); }
  saveRem(); renderPasses();
}
drawHome();
