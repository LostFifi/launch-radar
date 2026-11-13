// ===================== Ist der Start von meinem Standort aus sichtbar? =====================
// Nimmt die geschätzte Bahn (Bodenpunkt aus distAt/pointAt, Höhe aus dem Aufstiegsprofil) und rechnet für jede
// Sekunde Richtung + Winkel über dem Horizont vom eigenen Standort (HOME, 145-ueberfluege.js). Alles GESCHÄTZT.
// Quallen-Effekt: bei dir dämmert es (Sonne −4° … −18°), die Abgasfahne in grosser Höhe ist aber noch von der Sonne beschienen.
function launchView(l,est){
  if(!HOME||!est||!est.track||!est.prof) return null;
  const obs={latitude:HOME.lat/D,longitude:HOME.lon/D,height:0.4}, tEnd=Math.min(est.tMax,profEnd(est.prof)+240), pts=[];
  let best=null, first=null, last=null;
  for(let t=0;t<=tEnd;t+=4){
    const d=distAt(t,est), p=pointAt(est.track,est.cum,d), h=Math.max(0.05,profAt(est.prof,t).h);
    const ecf=satellite.geodeticToEcf({latitude:p[0]/D,longitude:norm(p[1])/D,height:h});
    const la=satellite.ecfToLookAngles(obs,ecf), el=la.elevation*D, az=(la.azimuth*D+360)%360;
    const tm=new Date(new Date(l.net).getTime()+t*1000), sunR=sunElev(tm,p[0],norm(p[1]));
    // Schattenhöhe über dem Bodenpunkt: lit, wenn die Rakete höher als der Erdschatten ist
    const dep=Math.max(0,-sunR)/D, shadowH=sunR>=0?0:R_E/Math.cos(dep)-R_E, lit=h>shadowH;
    const vis=el>1;
    pts.push([az,Math.max(0,el),vis&&lit,t,el,lit,la.rangeSat]);
    if(vis){ if(first===null) first=t; last=t; if(!best||el>best.el) best={t,el,az,km:la.rangeSat,lit}; }
  }
  const sunMe=sunElev(new Date(new Date(l.net).getTime()+(best?best.t:0)*1000),HOME.lat,HOME.lon);
  const litAbove=pts.some(q=>q[4]>1&&q[5]);
  let verdict, col;
  if(!best){ verdict="Nicht sichtbar – die Rakete bleibt unter deinem Horizont"; col="#3a4560"; }
  else if(sunMe<-4 && sunMe>-18 && litAbove){ verdict="Quallen-Effekt möglich: bei dir Dämmerung, die Abgasfahne oben noch im Sonnenlicht"; col="#c86bff"; }
  else if(sunMe<=-4){ verdict=best.el>5?"Nachts sichtbar als heller, wandernder Punkt (Triebwerk)":"Nachts knapp über dem Horizont – nur mit freier Sicht"; col=best.el>5?"#2ecc71":"#f5b041"; }
  else { verdict=best.km<250?"Tagsüber – Rauchsäule evtl. sichtbar":"Tagsüber – in dieser Entfernung kaum zu sehen"; col=best.km<250?"#f5b041":"#3a4560"; }
  return {pts,best,first,last,sunMe,verdict,col};
}
function viewSection(l,est){
  const ahead=new Date(l.net)-Date.now();
  if(ahead<-3600e3) return "";
  if(!HOME) return `<div class="sec"><h3>Von meinem Standort aus</h3><div class="mute">Sieht man den Start von dir aus?</div>
    <button class="btn sec2" onclick="openPasses()">${ICON.home} Standort festlegen</button></div>`;
  const v=launchView(l,est); if(!v) return "";
  const b=v.best, km=x=>Math.round(x).toLocaleString(LOC);
  return `<div class="sec"><h3>Von meinem Standort aus <span class="mute" style="text-transform:none;letter-spacing:0">· geschätzt</span></h3>
    <div class="wxhead"><span class="pill" style="background:${v.col};color:${v.col==="#3a4560"?"var(--text)":"#000"}">${b?"sichtbar?":"nein"}</span><span>${esc(v.verdict)}</span></div>
    ${b?`<div class="sky">${skySvg({pts:v.pts.filter(q=>q[4]>-2).map(q=>[q[0],q[1],q[4]>1&&(q[5]||v.sunMe<-4)])})}<div class="grid">
      <b>Zu sehen</b><span>T+${mmss(v.first)} bis T+${mmss(v.last)}</span>
      <b>Höchster Punkt</b><span>${Math.round(b.el)}° über dem Horizont im ${compass(b.az)} (T+${mmss(b.t)})</span>
      <b>Entfernung</b><span>${km(b.km)} km</span>
      <b>Bei dir</b><span>${v.sunMe>=0?"Tag":v.sunMe>-6?"Dämmerung":v.sunMe>-18?"späte Dämmerung":"Nacht"} (Sonne ${Math.round(v.sunMe)}°)</span>
    </div></div>`:`<div class="mute">Mindestabstand: ${km(Math.min(...v.pts.map(q=>q[6])))} km.</div>`}
    <div class="note">Aus der geschätzten Bahn und Höhe berechnet – Berge, Häuser und Wolken nicht berücksichtigt. Himmelskarte: Mitte = senkrecht über dir, durchgezogen = sichtbar.</div></div>`;
}
