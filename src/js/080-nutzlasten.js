// ===================== Ausgesetzte Nutzlasten (Satelliten hinter der Rakete) =====================
var DEP=null;            // {n,label,times[],src,markers[],lbl}
var depPos=[];           // aktuelle Positionen für den Globus
function relSec(iso){ if(!iso) return null; const m=/(-)?P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(iso); if(!m) return null;
  const s=(+m[2]||0)*86400+(+m[3]||0)*3600+(+m[4]||0)*60+(+m[5]||0); return m[1]?-s:s; }
function payloadPlan(l){
  if(/fail/i.test(l.status?.abbrev||"")) return null;
  const desc=l.mission?.description||"", name=l.name||"", tl=l.timeline||[];
  const orb=(l.mission?.orbit?.abbrev||"").toUpperCase(); if(orb.startsWith("SUB")) return null;
  // Anzahl aus der Missionsbeschreibung (Konstellations-Gesamtzahlen ignorieren)
  let n=null; const re=/(\d+)\s+(?:[\w\-\.]+\s+){0,4}satellites/ig; let m;
  while((m=re.exec(desc))){ const k=+m[1], before=desc.slice(Math.max(0,m.index-70),m.index).toLowerCase();
    if(k>=1 && k<=60 && !/constellation|total|consist|of up to/.test(before)){ n=k; break; } }
  const starlink=/starlink/i.test(name);
  const mp=missionProfile(l); if(mp?.n) n=mp.n;
  if(n==null) n = starlink ? 24 : 1;
  const label = starlink ? "Starlink" : /dragon|crew|crs/i.test(name) ? "Dragon" : (l.mission?.name||"Nutzlast");
  // Zeitpunkte aus der Timeline
  const f=rx=>{ const e=tl.find(t=>rx.test(t.type?.abbrev||t.type?.description||"")); return e?relSec(e.relative_time):null; };
  let t0=f(/payload deployment sequence start|deploy.*start/i), t1=f(/payload deployment sequence end|deploy.*end/i), src="laut offizieller Timeline";
  if(t0==null){ const s=f(/payload separation|payload deploy|starlink deploy|spacecraft separation|dragon separation|satellite deploy/i); if(s!=null){ t0=s; t1=s; } }
  if(t0==null && mp?.deploy){ [t0,t1]=mp.deploy; src=mp.src; }
  if(t0==null){ t0 = starlink ? 3700 : 3000; t1=t0; src="geschätzt"; }
  if(t1==null||t1<t0) t1=t0;
  const times=Array.from({length:n},(_,i)=>n>1? t0+(t1-t0)*i/(n-1) : t0);
  return {n,label,times,t0,t1,src};
}
function DEPINFO(l){ const p=payloadPlan(l); if(!p) return "";
  return `<div class="note" style="margin-top:10px;color:var(--text)"><span class="lg" style="--c:#ff4fd8"></span><b>Nutzlast:</b> ${p.n>1?p.n+"× ":""}${esc(p.label)} · Aussetzen ${p.t1>p.t0?`T+${mmss(p.t0)} bis T+${mmss(p.t1)}`:`bei T+${mmss(p.t0)}`} <span class="mute">(${p.src})</span>
    <div class="mute" style="margin-top:4px">Die Satelliten erscheinen einzeln hinter der Rakete. Ihr Abstand ist vergrössert dargestellt, damit man sie auf der Karte unterscheiden kann.</div></div>`; }
function setupDeploy(l){
  DEP=payloadPlan(l); depPos=[]; if(!DEP) return;
  DEP.markers=DEP.times.map((td,i)=>L.circleMarker([0,0],{radius:3.2,stroke:false,fillColor:"#ff4fd8",fillOpacity:1,opacity:0,interactive:true})
    .bindTooltip(`${esc(DEP.label)} ${DEP.n>1?(i+1)+"/"+DEP.n:""} · ausgesetzt T+${mmss(td)}`).addTo(routeLayer));
  DEP.lbl=L.marker([0,0],{interactive:false,opacity:0,icon:L.divIcon({className:"",iconSize:[0,0],html:'<div class="deplbl"></div>'})}).addTo(routeLayer);
}
// Abstand hinter der Rakete: wächst nach dem Aussetzen (vergrössert dargestellt, damit sichtbar)
function depGap(i,dt){ return 6 + dt*0.05; }
function updateDeploy(t,d){
  depPos=[]; if(!DEP||!curTrack) return 0; let cnt=0;
  // Gemessen per Telemetrie („PAYLOADS DEPLOYED“)? Dann zählt die gemessene Anzahl statt der geschätzten Zeiten.
  const meas=typeof TELE!=="undefined"&&TELE.pay&&selected&&TELE.pay.id===selected.id&&TELE.pay.n>0&&Date.now()-TELE.pay.at<15*60e3?TELE.pay:null;
  DEP.times.forEach((td,i)=>{ const mk=DEP.markers[i];
    let dep=t>=td, tdep=td;
    if(meas){ dep=i<meas.n; tdep=Math.min(t,TELE.payTimes?.[i]??td); }
    if(!dep){ mk.setStyle({opacity:0,fillOpacity:0}); return; }
    cnt++; const p=pointAt(curTrack.track,curTrack.cum,Math.max(0,d-depGap(i,t-tdep))), q=[p[0],norm(p[1])];
    mk.setLatLng(q); mk.setStyle({opacity:1,fillOpacity:1}); depPos.push(q); });
  if(cnt){ const last=depPos[depPos.length-1]; DEP.lbl.setLatLng(last); DEP.lbl.setOpacity(1);
    const el=DEP.lbl.getElement()?.querySelector(".deplbl"); if(el) el.textContent=`${cnt}${DEP.n>1?"/"+DEP.n:""} ${DEP.label}${meas?" ✓":""}`; }
  else DEP.lbl.setOpacity(0);
  return cnt;
}
