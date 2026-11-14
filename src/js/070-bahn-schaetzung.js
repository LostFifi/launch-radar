// ===================== Bahn-Schätzung =====================
function estimateProfile(l){
  const lat=+l.pad.latitude, lon=+l.pad.longitude;
  const name=(l.name||"").toLowerCase(), orb=(l.mission?.orbit?.abbrev||"").toUpperCase();
  const rocket=(l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"").toLowerCase();
  const vandenberg = lon<-119 && lon>-122 && lat>34 && lat<35.5;
  let inc, south=false, suborbital=false, tMax=90*60;

  const sub = orb.startsWith("SUB");
  const prof=(sub&&!rocket.includes("starship"))?null:profileFor(l);   // Aufstiegsprofil (065-aufstiegsprofile.js)
  if(rocket.includes("starship")){ inc=26.5; suborbital=sub; tMax=sub?70*60:90*60; }
  else if(sub){ inc=Math.abs(lat)+0.05; tMax=600; }
  else if(/shenzhou|tianzhou|tiangong|mengzhou/.test(name)) inc=41.5;
  else if(/\biss\b|crew|crs|cygnus|dragon|soyuz ms|progress|axiom|\bax-|htv|dream chaser|starliner/.test(name)) inc=51.64;
  else if(name.includes("starlink")||/starlink group/i.test(l.mission?.description||"")){
    const g=+((name+" "+(l.mission?.description||"").toLowerCase()).match(/group (\d+)/)||[])[1];
    inc = vandenberg ? ({11:53,13:97.6,15:70,17:97}[g]||70) : 43; }
  else if(orb==="SSO") inc=97.6;
  else if(vandenberg && ["LEO","PO",""].includes(orb)) inc = orb==="PO"?90:70;   // Vandenberg: typisch 70° (Richtung Süd-Südost über den Pazifik)
  else if(orb==="PO") inc=90;
  else if(orb==="MEO") inc=55;
  else if(orb==="HEO") inc=63.4;
  else if(["GTO","GEO","GSO","SUB-GEO","TLI","LO","HCO","SO","L1","L2"].includes(orb)) inc=Math.abs(lat);
  else inc=Math.max(Math.abs(lat)+2,45);

  if(vandenberg) south=true;
  const mp=missionProfile(l); if(mp?.inc) inc=mp.inc;   // bekanntes Missionsprofil (069)
  if(inc>80 && lat>10 && !vandenberg) south=true;      // Polar/SSO ab Florida, China, Indien, Norwegen → Richtung Süden (Kourou fliegt nach Norden)
  if(inc<Math.abs(lat)) inc=Math.abs(lat)+0.05;         // physikalisch nicht erreichbar → nach Osten

  const desc=l.mission?.description||"";
  let orbits=1, P=5400;
  if(mp?.alt){ const a=R_E+mp.alt; P=2*Math.PI*Math.sqrt(a**3/398600.4418); }
  if(rocket.includes("starship") && !sub){
    const mo=desc.match(/(\d+)\s+orbits?/i); orbits = mo ? +mo[1] : 1;
    const mh=desc.match(/(\d{3,4})\s*km/i); if(mh){ const a=R_E+ +mh[1]; P=2*Math.PI*Math.sqrt(a**3/398600.4418); }
    tMax = orbits*P;
  }
  // Was passiert mit der Oberstufe nach dem Aussetzen?
  let stage=null;
  if(!rocket.includes("starship") && !sub){
    const pp=payloadPlan(l), spx=/spacex/i.test(l.launch_service_provider?.name||"");
    const low=["LEO","SSO","PO","VLEO",""].includes(orb) || /iss|crew|crs|dragon/.test(name);
    const esc_=["TLI","LO","HCO","SO","L1","L2","MARS","HELIOCENTRIC"].some(x=>orb.startsWith(x));
    if(esc_) stage={mode:"escape",label:"Oberstufe verlässt mit der Nutzlast die Erdumlaufbahn"};
    else if(mp?.deorbit){ const Td=mp.deorbit, Tre=mp.reentry||Td+20*60;
      stage={mode:"deorbit",Td,Tre,src:mp.src,label:"Oberstufe: Deorbit-Zündung, dann Wiedereintritt und Verglühen über dem Ozean"};
      tMax=Math.max(tMax,Tre+10*60); }
    else if(spx && low){
      const tdl=(()=>{ const e=(l.timeline||[]).find(t=>/deorbit burn start/i.test(t.type?.abbrev||"")); return e?relSec(e.relative_time):null; })();
      const Td=tdl ?? ((pp?pp.t1:3700)+35*60), Tre=Td+15*60;
      stage={mode:"deorbit",Td,Tre,src:tdl!=null?"laut Timeline":"geschätzt",label:"Oberstufe: Deorbit-Burn, dann Wiedereintritt und Verglühen über dem Ozean"};
      tMax=Math.max(tMax,Tre+15*60);
    } else stage={mode:"orbit",label:["GTO","GEO","GSO","MEO"].includes(orb)?"Oberstufe bleibt in einer hohen Umlaufbahn (Weltraumschrott)":"Oberstufe bleibt vermutlich im Orbit und tritt erst nach Wochen bis Jahren wieder ein"};
  }
  orbits=Math.max(orbits,Math.ceil(tMax/P-0.02));
  let track, retFit=null;
  const tlx=rx=>{ const v=(l.timeline||[]).filter(t=>rx.test(t.type?.abbrev||"")).map(t=>relSec(t.relative_time)).filter(x=>x!=null); return v.length?Math.max(...v):null; };
  const returns = rocket.includes("starship") && !sub && /return|catch|starbase/i.test(desc);
  if(returns){
    // Landezeit aus der Timeline (Catch/Landung), sonst nach den angegebenen Orbits
    const Tl = tlx(/starship catch|starship landing/i) || (orbits*P+40*60);
    const Td = Math.min(tlx(/deorbit burn start/i) || (Tl-57*60), Tl-20*60);
    // Starship-Orbitalflug ab Starbase: Start nach Südosten (absteigend) durch die Yucatán-Strasse – so umgeht die Bahn
    // Kuba und Florida (beobachtet auf der SpaceX-Telemetrie). Neigung + Umlaufzeit so suchen, dass
    //   (1) der erste Überflug nahe an der Yucatán-Strasse liegt und (2) das Ship zur Catch-Zeit absteigend,
    //   also von Nordwesten kommend, über Starbase steht.
    // Zeitversatz: nach Brennschluss liegt das Ship um lag Sekunden hinter der gedachten Kreisbahn ab T-0.
    const tgt=LZ.STARBASE, WP=[21.9,-85.8], tE=prof?profEnd(prof):540, dE=prof?prof.pts[prof.pts.length-1][3]:1800;
    const lagOf=(i2,s2,P2)=>{ const tr=groundTrack(lat,lon,i2,s2,tE+400,P2), c=[0]; for(let k=1;k<tr.length;k++) c.push(c[k-1]+hav(tr[k-1],tr[k])); return lagT({cum:c},tE,dE); };
    let best={c:1e9};
    for(const s2 of [true,false]) for(let ii=0; ii<=56; ii++){ const inc2=Math.max(Math.abs(lat)+0.05, 26.2+ii*0.25);
      const first=groundTrack(lat,lon,inc2,s2,1500,P); let cw=1e9; for(const p of first) cw=Math.min(cw,hav(p,WP));
      if(cw>80) continue;                                             // Korridor (Yucatán-Strasse) ist Pflicht → Neigung ≈ 30–33°
      const lg=lagOf(inc2,s2,P);
      for(let jj=0; jj<=900; jj++){ const P2=P*(0.94+jj*0.0001), tl=Tl-lg;
        const q=trackPoint(lat,lon,inc2,s2,P2,tl), q0=trackPoint(lat,lon,inc2,s2,P2,tl-240);
        const desc=q0[0]>q[0]+0.3, c=hav([q[0],q[1]],tgt)+cw*3+(desc?0:600);   // Anflug von Norden (absteigend)
        if(c<best.c) best={c,inc:inc2,P:P2,south:s2,lag:lg,km:hav([q[0],q[1]],tgt)}; } }
    if(best.c>=1e9) best={inc:Math.max(Math.abs(lat)+0.05,26.2),P,south:false,lag:0,km:null};   // Notlösung
    inc=best.inc; P=best.P; south=best.south; tMax=Tl; orbits=Math.ceil(Tl/P);
    const tau=t=>t-best.lag;                                          // echte Zeit → Zeit auf der Bahn
    track=groundTrack(lat,lon,inc,south,tau(Tl),P);
    // Abstieg: ab dem Deorbit-Burn das letzte Stück sanft so VERSCHIEBEN, dass es in Starbase endet.
    // (Verschieben statt Hinziehen: die Anflugform – absteigend aus Nordwesten – bleibt erhalten;
    //  in echt gleicht das Ship die Abweichung beim Wiedereintritt seitlich aus.)
    const kd=track.findIndex(p=>p[2]>=tau(Td)), last=track[track.length-1];
    if(kd>0){ let tl=tgt[1]; while(tl-last[1]>180) tl-=360; while(tl-last[1]<-180) tl+=360;
      const dLa=tgt[0]-last[0], dLo=tl-last[1];
      for(let k=kd;k<track.length;k++){ const f=(track[k][2]-tau(Td))/(Tl-Td), w=f*f*(3-2*f);
        track[k][0]+=dLa*w; track[k][1]+=dLo*w; } }
    retFit={km:best.km,Td,Tl};
  } else track=groundTrack(lat,lon,inc,south,tMax,P);
  let cut=track.length;
  if(suborbital){ // Starship: Wasserung im Indischen Ozean
    for(let k=0;k<track.length;k++){ const L0=norm(track[k][1]); if(track[k][2]>40*60 && L0>100 && L0<125){cut=k+1;break;} }
  }
  const tr=track.slice(0,cut);
  const cum=[0]; for(let k=1;k<tr.length;k++) cum.push(cum[k-1]+hav(tr[k-1],tr[k]));

  // Landungen
  const landings=[];
  (l.rocket?.launcher_stage||[]).forEach(s=>{
    const ld=s.landing; if(!ld) return;
    if(ld.attempt===false){ landings.push({pos:pointAt(tr,cum,550),label:"Booster: Einweg – stürzt ins Meer (Position geschätzt)",kind:"impact"}); return; }
    const loc=ld.landing_location||ld.location||{}, ty=(ld.type?.abbrev||ld.type?.name||"").toUpperCase();
    let pos=null;
    const la=+(loc.latitude??loc.location?.latitude), lo=+(loc.longitude??loc.location?.longitude);
    if(la&&lo && !(ty==="ASDS")) pos=[la,lo];
    const ab=(loc.abbrev||"").toUpperCase();
    if(!pos && LZ[ab]) pos=LZ[ab];
    if(!pos && /starbase|tower|olp|catch/i.test((loc.name||"")+ty)) pos=LZ.STARBASE;
    if(!pos && /gulf/i.test(loc.name||"")) pos=[26.0,-96.8];
    if(!pos && (ty==="ASDS"||/ocisly|asog|jrti|drone/i.test(loc.name||""))) pos=pointAt(tr,cum, ld.downrange_distance>0?ld.downrange_distance:(orb==="GTO"?650:600));
    if(!pos && ty==="ATL") pos=pointAt(tr,cum,450);
    if(!pos && ty==="RTLS") pos=[lat+0.03,lon+0.03];
    if(pos) landings.push({pos,label:`${ty==="ASDS"?"Drohnenschiff":"Booster-Landung"}: ${loc.name||ty}${ty==="ASDS"?" (Position geschätzt)":""}`,kind:ty==="ASDS"?"ship":"booster"});
  });
  if(!landings.length && !rocket.includes("starship") && !sub){
    const nm2=(l.rocket?.configuration?.name||"").toLowerCase(), fam=ROCKETS.find(x=>x.n.toLowerCase()===nm2);
    if(!(fam&&fam.reu)) landings.push({pos:pointAt(tr,cum,450),label:"Absturzgebiet 1. Stufe (geschätzt)",kind:"impact"});
  }
  if(stage&&stage.mode==="deorbit"){ stage.pos=pointAt(tr,cum,distAt(stage.Tre,{cum,prof})); landings.push({pos:stage.pos,label:`Oberstufe: Wiedereintritt bei T+${mmss(stage.Tre)} (${stage.src})`,kind:"reentry"}); }
  if(rocket.includes("starship")){
    if(!landings.length) landings.push({pos:LZ.STARBASE,label:"Booster: Catch am Turm / Golf (geplant)",kind:"catch"});
    if(returns) landings.push({pos:LZ.STARBASE,label:`Ship: Rückkehr & Catch in Starbase bei T+${mmss(retFit.Tl)}`,kind:"catch"});
    if(suborbital) landings.push({pos:[tr[tr.length-1][0],tr[tr.length-1][1]],label:"Ship: Wasserung Indischer Ozean (geschätzt)",kind:"splash"});
  }
  // Schiffe, Absturzgebiete und Wiedereintritte liegen über Wasser: bei Bedarf entlang der Bahn verschieben
  landings.forEach(x=>{ if(!["ship","impact","reentry","splash"].includes(x.kind) || !onLand(x.pos)) return;
    const d0=nearestCum(tr,cum,x.pos);
    for(let k=1;k<=(x.kind==="reentry"?160:40);k++){ for(const sg of x.kind==="reentry"?[1]:[1,-1]){ const q=pointAt(tr,cum,Math.max(0,d0+sg*k*25)); if(!onLand(q)){ x.pos=q; x.moved=true; return; } } } });
  if(stage&&stage.pos){ const r=landings.find(x=>x.kind==="reentry"); if(r) stage.pos=r.pos; }
  landings.forEach(x=>x.pos=[x.pos[0],norm(x.pos[1])]);
  const az=launchAzimuth(lat,inc,south);
  return {inc,south,suborbital,orbits,P,retFit,stage,prof,az,tMax: (suborbital||sub) ? tr[tr.length-1][2] : tMax, track:tr, cum, landings};
}

function trackPoint(latD,lonD,incD,south,P,t){
  const d2r=Math.PI/180, phi=latD*d2r, i=incD*d2r; let s=Math.sin(phi)/Math.sin(i); s=Math.max(-1,Math.min(1,s));
  const u0= south ? Math.PI-Math.asin(s) : Math.asin(s), lam=u=>Math.atan2(Math.cos(i)*Math.sin(u),Math.cos(u)), Om=lonD*d2r-lam(u0);
  const u=u0+2*Math.PI*t/P; return [Math.asin(Math.sin(i)*Math.sin(u))/d2r, norm((Om+lam(u)+nodeRate(incD,P)*t-OMEGA_E*t)/d2r)]; }
// Drehung der Bahnebene durch die Abplattung der Erde (J2): bei ~30° Neigung etwa −7° pro Tag (rad/s)
function nodeRate(incD,P){ const n=2*Math.PI/P, a=Math.cbrt(398600.4418*(P/(2*Math.PI))**2); return -1.5*1.08263e-3*(6378.137/a)**2*Math.cos(incD*Math.PI/180)*n; }
function onLand(p){ try{ return d3.geoContains(WORLD,[norm(p[1]),p[0]]); }catch(e){ return false; } }
function nearestCum(tr,cum,p){ let bi=0,bd=1e9; tr.forEach((q,i)=>{ const d=hav([q[0],q[1]],p); if(d<bd){bd=d;bi=i;} }); return cum[bi]; }
// Bodenspur einer Kreisbahn (LEO ~ 90 min), inkl. Erdrotation
function groundTrack(latD,lonD,incD,south,tMax,P=5400){
  const d2r=Math.PI/180, phi=latD*d2r, i=incD*d2r;
  let s=Math.sin(phi)/Math.sin(i); s=Math.max(-1,Math.min(1,s));
  const u0= south ? Math.PI-Math.asin(s) : Math.asin(s);
  const lam=u=>Math.atan2(Math.cos(i)*Math.sin(u),Math.cos(u));
  const Om=lonD*d2r-lam(u0), dOm=nodeRate(incD,P);
  const pts=[]; let prev=null, off=0;
  for(let t=0;t<=tMax;t+=20){
    const u=u0+2*Math.PI*t/P;
    const la=Math.asin(Math.sin(i)*Math.sin(u))/d2r;
    let lo=(Om+lam(u)+dOm*t-OMEGA_E*t)/d2r;
    lo=norm(lo);
    if(prev!==null){ const dl=lo+off-prev; if(dl>180) off-=360; else if(dl<-180) off+=360; }
    prev=lo+off; pts.push([la,lo+off,t]);
  }
  return pts;
}
// Bodendistanz zur Zeit t: während des Aufstiegs aus dem Raketen-Profil (065-aufstiegsprofile.js),
// danach Orbitgeschwindigkeit entlang der Bahn (Rückstand gegenüber der Kreisbahn baut sich langsam ab)
function distAt(t,est){
  const P=est.prof, tE=P?profEnd(P):540, dE=P?P.pts[P.pts.length-1][3]:1800;
  if(t<tE) return P?profAt(P,t).d:1800*Math.pow(t/540,2);
  const c=est.cum; if(!c) return dE;
  const ct=x=>{ x=Math.max(0,x); const i=x/20,k=Math.min(Math.floor(i),c.length-1),f=i-k; return k+1<c.length? c[k]+f*(c[k+1]-c[k]) : c[c.length-1];};
  // Ab Brennschluss mit Orbit-Tempo weiter – mit festem Zeitversatz gegenüber der gedachten Kreisbahn ab T-0
  // (kein „Aufholen“ mehr, das machte die Rakete nach SECO ~20 Min lang zu schnell)
  return ct(t-lagT(est,tE,dE));
}
// Zeitversatz: wie viel später als die gedachte Kreisbahn (Start bei T-0) die Rakete die Bodendistanz dE erreicht
function lagT(est,tE,dE){
  if(est._lag!=null) return est._lag; const c=est.cum; let k=c.findIndex(v=>v>=dE);
  const tau=k<=0?0:(k-1+(dE-c[k-1])/Math.max(1e-9,c[k]-c[k-1]))*20;
  const lg=Math.max(0,tE-tau); if(est.track) est._lag=lg; return lg;
}
// Bahn an der Datumsgrenze in Teilstücke schneiden (für viele Orbits nötig)
function segs(pts){ const out=[]; let cur=[];
  pts.forEach(p=>{ const q=[p[0],norm(p[1])]; if(cur.length && Math.abs(q[1]-cur[cur.length-1][1])>180){ out.push(cur); cur=[]; } cur.push(q); });
  if(cur.length) out.push(cur); return out; }
function pointAt(tr,cum,dist){
  for(let k=1;k<tr.length;k++) if(cum[k]>=dist){
    const f=(dist-cum[k-1])/((cum[k]-cum[k-1])||1);
    return [tr[k-1][0]+f*(tr[k][0]-tr[k-1][0]), tr[k-1][1]+f*(tr[k][1]-tr[k-1][1])];
  }
  const e=tr[tr.length-1]; return [e[0],e[1]];
}

function drawRoute(l,est){
  routeLayer.clearLayers(); rocketMarker=null; curPos=null;
  const tr=est.track.map(p=>[p[0],p[1]]);
  const dA=est.prof?est.prof.pts[est.prof.pts.length-1][3]:1800;   // Ende des Aufstiegs (Brennschluss Oberstufe)
  let kA=est.cum.findIndex(c=>c>=dA); if(kA<0) kA=tr.length-1;
  est.kA=kA;
  // Abschnitte: Aufstieg + jeder Orbit (eigene Farbe). Kommend = blass, geflogen = kräftig.
  const perOrbit=Math.round(est.P/20), cols=["#4ea1ff","#7b6cff","#c86bff","#ff6bb5","#ff8f5a","#ffd25a","#7be07b"];
  est.parts=[{a:0,e:kA+1,col:"#4ea1ff",w:3.5,lab:"Aufstieg"}];
  for(let o=0;o<est.orbits;o++){ const a=Math.max(kA,o*perOrbit), e=Math.min(tr.length,(o+1)*perOrbit+1); if(e-a<2) continue;
    est.parts.push({a,e,col:cols[o%cols.length],w:2.2,lab:est.orbits>1?`Orbit ${o+1} / ${est.orbits}`:"Bahn"}); }
  const SH=[-360,0,360], shift=(ls,sh)=>ls.map(seg=>seg.map(q=>[q[0],q[1]+sh]));
  est.parts.forEach(pt=>{ const base=segs(tr.slice(pt.a,pt.e));
    pt.fut=SH.map(sh=>L.polyline(shift(base,sh),{color:pt.col,weight:pt.w*0.7,opacity:.38,smoothFactor:1.5}).bindTooltip(pt.lab+" (noch nicht geflogen)",{sticky:true}).addTo(routeLayer));
    pt.done=SH.map(sh=>L.polyline([],{color:pt.col,weight:pt.w+0.6,opacity:1,smoothFactor:1.5}).bindTooltip(pt.lab+" (geflogen)",{sticky:true}).addTo(routeLayer));
    pt.k=-1; });
  est.landings.forEach(x=> L.marker(x.pos,{icon:L.divIcon({className:"",html:landHtml(x.kind),iconSize:[16,16]})})
    .bindTooltip(x.label).addTo(routeLayer));
  setupDeploy(l);
  rocketMarker=L.marker([+l.pad.latitude,+l.pad.longitude],{icon:L.divIcon({className:"",html:`<div class="rkw"><svg viewBox="0 0 24 24"><path d="${RK_PATH}" fill="#fff" stroke="#4ea1ff" stroke-width="1.3" stroke-linejoin="round"/></svg></div>`,iconSize:[28,28]}),zIndexOffset:1000}).addTo(routeLayer);
  curTrack=est;
  if(!G.on) map.fitBounds(L.latLngBounds(tr.slice(0, est.suborbital?tr.length:Math.min(tr.length,kA*3+1)).map(p=>[p[0],norm(p[1])])).pad(0.3),{paddingBottomRight: innerWidth>=800?[440,0]:[0,innerHeight*0.5]});
}
function placeRocket(t){
  if(!curTrack||!rocketMarker) return;
  const td=teleDist(), d=td!=null?td:distAt(t,curTrack), p=pointAt(curTrack.track,curTrack.cum,d);
  curPos=[p[0],norm(p[1])]; rocketMarker.setLatLng(curPos);
  const gone=curTrack.stage?.mode==="deorbit" && t>curTrack.stage.Tre; rocketMarker.setOpacity(gone?0:1); if(gone) curPos=null;
  const p2=pointAt(curTrack.track,curTrack.cum,d+40); curHdg=bearing(p,p2);
  const rw=rocketMarker.getElement()?.querySelector(".rkw"); if(rw) rw.style.transform=`rotate(${curHdg}deg)`;
  const dc=updateDeploy(t,d);
  // geflogenen Teil kräftig nachzeichnen
  let k=curTrack.cum.findIndex(c=>c>=d); if(k<0) k=curTrack.track.length-1; curK=k; curP=p;
  (curTrack.parts||[]).forEach(pt=>{ const kk=Math.min(pt.e,k+1); if(kk===pt.k) return; pt.k=kk;
    const ls=kk>pt.a? segs([...curTrack.track.slice(pt.a,kk).map(q=>[q[0],q[1]]),...(k<pt.e?[[p[0],p[1]]]:[])]) : [];
    pt.done.forEach((pl,j)=>pl.setLatLngs(ls.map(seg=>seg.map(q=>[q[0],q[1]+[-360,0,360][j]])))); });
  if(follow){ if(G.on){ G.target=null; G.rot[0]=-curPos[1]; G.rot[1]=-curPos[0]; } else map.panTo(curPos,{animate:false}); }
  const tl=document.getElementById("tlab"), pl=document.getElementById("plab");
  if(tl) tl.textContent="T+ "+mmss(t);
  if(pl){ // Teile einzeln in <span> (einzeln übersetzbar), getrennt durch „·“
    const parts=[], st=curTrack.stage;
    if(st?.mode==="deorbit"&&t>st.Tre) parts.push("Oberstufe verglüht"); else if(st?.mode==="deorbit"&&t>st.Td) parts.push("Oberstufe im Wiedereintritt");
    if(td!=null&&TELE.h!=null) parts.push(`GEMESSEN ${TELE.h} km Höhe`,`${TELE.v.toLocaleString(LOC)} km/h`);
    else if(curTrack.prof&&t>0&&t<profEnd(curTrack.prof)){ const q=profAt(curTrack.prof,t); parts.push(`geschätzt ${Math.round(q.h)} km Höhe`,`${(Math.round(q.v/100)*100).toLocaleString(LOC)} km/h`); }
    if(DEP&&dc) parts.push(`${dc}/${DEP.n} ${DEP.label} ausgesetzt`);
    if(curTrack.orbits>1&&t>540) parts.push(`Orbit ${Math.min(curTrack.orbits,Math.floor(t/curTrack.P)+1)}/${curTrack.orbits}`);
    parts.push(`${Math.round(d).toLocaleString(LOC)} km Bodendistanz`,`${p[0].toFixed(1)}°, ${norm(p[1]).toFixed(1)}°`);
    const html="· "+parts.map(x=>`<span>${esc(x)}</span>`).join(" · ");
    if(pl.dataset.h!==html){ pl.dataset.h=html; pl.innerHTML=html; } }
}
