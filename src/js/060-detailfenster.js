// ===================== Detailfenster =====================
function select(l){
  clearSat(); selected=l; stopSim(); setHash(l.id);
  const P=document.getElementById("panel"); P.classList.remove("wide");
  const cfg=l.rocket?.configuration||{};
  const m=l.mission||{};
  const est=estimateProfile(l);
  const stages=(l.rocket?.launcher_stage||[]);
  const vids=(l.vid_urls||[]).slice().sort((a,b)=>(a.priority||99)-(b.priority||99));
  const yt=vids.map(v=>ytId(v.url)).find(Boolean);

  let html=`<div class="hd"><h2>${esc(l.name)}<br>
     <span class="badge" style="background:${statusColor(l)};color:#000">${esc(l.status?.name||"")}</span>
     ${l.webcast_live?' <span class="badge" style="background:var(--live)">● LIVE</span>':""}</h2>
     <button class="x" onclick="closeP()">×</button></div>`;

  html+=reviewSection(l,est);   // Rückblick (nur nach dem Start) ganz oben
  html+="<!--SIM-->";
  // Bild + Missions-Patch
  const im=l.image&&typeof l.image==="object"?l.image:null, patch=(l.mission_patches||[])[0];
  if(im) html+=`<div class="hero">${imgTag(l,false)}
     ${patch?`<img class="patch" src="${esc(patch.image_url)}" alt="" onerror="this.remove()">`:""}
     ${im.credit?`<span class="cr">Bild: ${esc(im.credit)}</span>`:""}</div>`;

  // Livestream
  html+=`<div class="sec"><h3>Livestream</h3>`;
  const local = location.protocol!=="http:" && location.protocol!=="https:";
  if(yt) html+=`<button class="btn" onclick="openPip('${yt}','${esc((l.name.split("|")[1]||l.name).trim()).replace(/'/g,"")}')" style="margin-top:0">▶ Im Mini-Fenster abspielen</button>${local?`<div class="note">Hinweis: YouTube spielt nur ab, wenn die Seite online ist (nicht als lokale Datei).</div>`:""}`;
  else if(false) html+="";
  else html+=`<div class="mute">${vids.length?"Stream nicht einbettbar (z.B. auf X) – öffne ihn direkt:":"Noch kein Stream veröffentlicht (meist ca. 1 h vor Start)."}</div>`;
  vids.slice(0,3).forEach(v=> html+=` <a class="btn ${yt?"sec2":""}" href="${esc(v.url)}" target="_blank" rel="noopener">▶ ${esc(v.publisher||v.source||"Stream")}</a>`);
  html+=`</div>`;

  // Countdown
  html+=`<div class="sec"><h3>Start (NET)</h3><div class="cd" id="cd">${countdown(l.net)}</div>
     <div class="mute">${fmtDate(l.net)} ${l.probability!=null&&l.probability>=0?`· Wetter-Go: ${l.probability}%`:""}</div>${postponedNote(l)}
     ${new Date(l.net)>Date.now()?`<button class="btn ${REM[l.id]?"":"sec2"}" id="remBtn" onclick="toggleRem('${l.id}')">${REM[l.id]?ICON.bell+" Erinnerung aktiv – entfernen":ICON.bell+" 10 Min vorher erinnern"}</button>`:""}
     <button class="btn sec2" onclick="shareLaunch('${l.id}')">${ICON.share} Teilen</button></div>`+weatherSection(l)+viewSection(l,est);

  // Missionsprofil
  html+=`<div class="sec"><h3>Missionsprofil</h3><div class="grid">
     <b>Rakete</b><span>${esc(cfg.full_name||cfg.name||"–")} <a href="#" style="color:var(--acc)" onclick="openRocketByName('${esc(cfg.name||"")}');return false">Daten ↗</a></span>
     <b>Betreiber</b><span>${esc(l.launch_service_provider?.name||"–")}</span>
     <b>Mission</b><span>${esc(m.name||"–")}</span>
     <b>Typ</b><span>${esc(m.type||"–")}</span>
     <b>Zielbahn</b><span>${esc(m.orbit?.name||"–")} ${m.orbit?.abbrev?`(${esc(m.orbit.abbrev)})`:""}</span>
     <b>Startplatz</b><span>${esc(l.pad?.name||"")}, ${esc(l.pad?.location?.name||"")}</span>
     <b>Bahnneigung</b><span>≈ ${est.inc.toFixed(1)}° <span class="mute">(geschätzt)</span></span>
     ${est.suborbital||!est.az?"":`<b>Startrichtung</b><span>≈ ${Math.round(est.az)}° (${compass(est.az)}) <span class="mute">(geschätzt, inkl. Erddrehung)</span></span>`}
   </div>${m.description?`<p>${esc(m.description)}</p>`:""}</div>`+deepSection(l,est)+profileSection(l,est);

  // Booster & Landung
  html+=`<div class="sec"><h3>Booster (1. Stufe)</h3>`;
  if(stages.length){
    html+=stages.map(s=>boosterBlock(l,s)).join('<hr class="sthr">');
  } else html+=`<div class="mute">Noch keine Booster-Infos veröffentlicht.</div>`;
  html+=`</div>${spacecraftSection(l)}<div class="sec" style="padding-top:0;border:0">`;
  if(est.landings.length) html+=`<div class="note">Auf der Karte: ${est.landings.map(x=>`<span class="lg" style="--c:${LAND[x.kind].c}"></span>${esc(x.label)}`).join(" · ")}</div>`;
  html+=`</div>`;

  // Objekte im Orbit (nach dem Start)
  if(new Date(l.net)<Date.now()-3600e3){
    html+=`<div class="sec"><h3>Objekte im Orbit</h3>${l.launch_designator?`<div class="mute">COSPAR-Kennung: ${esc(l.launch_designator)}</div>
      <button class="btn" onclick="showLaunchObjects(selected)">${ICON.sat} Satelliten & Stufen dieses Starts zeigen</button>`:
      `<div class="mute">Noch keine COSPAR-Kennung vergeben – Bahndaten folgen meist 1–3 Tage nach dem Start.</div>`}<div id="objRes"></div></div>`;
  }
  // Timeline
  if(l.timeline?.length){
    html+=`<div class="sec"><h3>Ablauf (Timeline)</h3><ul class="tl">`+
      l.timeline.map(t=>`<li><span>${fmtRel(t.relative_time)}</span><span>${esc(t.type?.abbrev||t.type?.description||"")}</span></li>`).join("")+`</ul></div>`;
  }

  // Live-Updates
  const st=(l.status?.abbrev||"");
  const failed=/fail/i.test(st);
  if(failed) html+=`<div class="sec" style="background:#2a0f14"><h3>Achtung: ${esc(l.status?.name)}</h3><div>${esc(l.failreason||"Fehlstart gemeldet.")} Die wirkliche Position ist unbekannt – die Route unten ist nur der Plan.</div></div>`;
  if(l.updates?.length){
    html+=`<div class="sec"><h3>Live-Updates</h3><ul class="tl">`+
      l.updates.slice(0,6).map(u=>`<li><span>${new Date(u.created_on).toLocaleString("de-CH",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span>${esc(u.comment)}</span></li>`).join("")+`</ul></div>`;
  }
  // Route-Details (Erklärungen) weiter unten
  html+=`<div class="sec"><h3>Route & Bahn</h3>
    <div>Blass = noch kommend, kräftig = schon geflogen. Jeder Orbit hat eine eigene Farbe${est.suborbital?"; die Bahn endet mit der Wasserung":""}.</div>
    ${est.retFit?`<div class="note">Rückkehr: Deorbit-Burn T+${mmss(est.retFit.Td)}, Catch in Starbase T+${mmss(est.retFit.Tl)} (laut Timeline). Die Bahn ist so berechnet, dass sie dort endet (Neigung ≈ ${est.inc.toFixed(1)}°, Umlaufzeit ${(est.P/60).toFixed(1)} min).</div>`:""}
    ${DEPINFO(l)}
    ${est.stage?`<div class="note" style="color:var(--text)"><span class="lg" style="--c:${est.stage.mode==="deorbit"?"#ff6b3d":"#8a96ad"}"></span><b>Oberstufe:</b> ${esc(est.stage.label)}${est.stage.mode==="deorbit"?` · Deorbit-Burn T+${mmss(est.stage.Td)}, Wiedereintritt ca. T+${mmss(est.stage.Tre)} (${est.stage.src})`:""}.</div>`:""}
    <div class="note">Hinweis: Die Route ist eine Schätzung aus Startplatz + Bahnneigung. Raketen senden keine öffentlichen Positionsdaten wie Flugzeuge (ADS-B). Während eines echten Starts folgt das Raketen-Symbol automatisch der Zeit seit dem Start.</div>
    ${l.flightclub_url?`<a class="btn sec2" href="${esc(l.flightclub_url)}" target="_blank" rel="noopener">Präzise Bahn bei FlightClub.io</a>`:""}
  </div>`;
  // Simulation ganz oben (direkt unter dem Titel)
  const pp=payloadPlan(l);
  const simHtml=`<div class="sec simtop"><div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><b id="tlab">T+ 00:00</b> <span class="mute" id="plab"></span></div>
    <input type="range" id="sim" min="0" max="${est.tMax}" value="0" step="1">
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
      <button class="btn" id="play" style="margin:0">▶ Flug simulieren</button>
      <span class="spd" style="margin:0">${[10,60,600].map(s=>`<button class="chip ${s===60?"on":""}" data-ps="${s}">${s}×</button>`).join("")}<button class="chip" id="follow">Kamera folgt</button><button class="chip" id="teleBtn" title="Echte Werte aus dem Livestream lesen">Echte Telemetrie</button></span>
      ${pp?`<button class="btn sec2" id="jumpDep" style="margin:0">Zum Aussetzen (${pp.n>1?pp.n+"× ":""}${esc(pp.label)})</button>`:""}
    </div></div>`;
  html=html.replace("<!--SIM-->",simHtml);
  P.innerHTML=html; P.style.display="block"; P.scrollTop=0;
  loadWeather(l);
  drawRoute(l,est);
  if(G.on) G.target=[-(+l.pad.longitude), -(+l.pad.latitude)];

  const s=document.getElementById("sim"); playSpeed=60;
  P.querySelectorAll("[data-ps]").forEach(b=>b.onclick=()=>{ playSpeed=+b.dataset.ps; P.querySelectorAll("[data-ps]").forEach(x=>x.classList.toggle("on",x===b)); });
  follow=false; const fb=document.getElementById("follow"); fb.onclick=()=>{ follow=!follow; fb.classList.toggle("on",follow); if(follow&&curPos&&!G.on) map.setView(curPos,Math.max(map.getZoom(),6)); };
  const jb=document.getElementById("jumpDep"); if(jb) jb.onclick=()=>{ const p=payloadPlan(l); if(!p) return; stopSim(); s.value=Math.max(0,p.t0-60); placeRocket(+s.value); playSpeed=p.t1>p.t0?60:10;
    follow=true; fb.classList.add("on"); if(G.on) G.scale=Math.max(G.scale,1400); else map.setView(curPos,7,{animate:false});
    P.querySelectorAll("[data-ps]").forEach(x=>x.classList.toggle("on",+x.dataset.ps===playSpeed)); document.getElementById("play").click(); };
  s.oninput=()=>{stopSim(false); placeRocket(+s.value);};
  document.getElementById("play").onclick=()=>{
    if(simTimer){stopSim();return;}
    document.getElementById("play").textContent="⏸ Pause";
    simTimer=setInterval(()=>{ let v=+s.value+playSpeed*0.05; if(v>est.tMax) v=0; s.value=v; placeRocket(v); },50);
  };
  // echter Flug läuft?
  // nur mitfliegen, wenn der Start bestätigt ist (oder kurz nach T-0 mit frischen Daten); sonst ist er evtl. verschoben
  const tSince=(Date.now()-new Date(l.net))/1000, lst=launchState(l);
  if(tSince>0 && tSince<est.tMax && !failed && lst!=="unconfirmed"){ s.value=tSince; placeRocket(tSince); liveFollow(l,est); }
  else placeRocket(0);
  if(lst==="unconfirmed" && tSince>0 && tSince<6*3600){
    document.querySelector("#panel .simtop").insertAdjacentHTML("afterbegin",`<div class="warnbox"><b>Start nicht bestätigt.</b> Die Startzeit ist vorbei, der Status ist aber noch „${esc(l.status?.name||"?")}“ – der Start ist wahrscheinlich verschoben. ${esc(dataInfo())}. Die Simulation unten zeigt nur den Plan.</div>`); }
  else if(lst==="likely") document.querySelector("#panel .simtop").insertAdjacentHTML("afterbegin",`<div class="warnbox">Start vermutlich erfolgt, aber noch nicht bestätigt (${esc(dataInfo())}).</div>`);
}

function liveFollow(l,est){
  simTimer=setInterval(()=>{
    const t=(Date.now()-new Date(l.net))/1000; if(t>est.tMax || launchState(selected||l)==="unconfirmed") return stopSim();
    const s=document.getElementById("sim"); if(s) s.value=t; placeRocket(t);
  },1000);
}
function stopSim(resetBtn=true){
  if(simTimer){clearInterval(simTimer); simTimer=null;}
  const b=document.getElementById("play"); if(b&&resetBtn!==false) b.textContent="▶ Flug simulieren";
}
