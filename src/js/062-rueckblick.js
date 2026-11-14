// ===================== Start-Rückblick =====================
// Für Starts, die vorbei sind: Ergebnis, Verschiebungen, Booster-Landung, Aufzeichnung, eigene Telemetrie vs. Schätzung.
function reviewSection(l,est){
  const st=launchState(l); if(st!=="done" && !(st==="flying" && Date.now()-new Date(l.net)>3*3600e3)) return "";
  const a=(l.status?.abbrev||"").toLowerCase(), ok=a==="success", part=/partial/.test(a), fail=/fail/.test(a)&&!part;
  const res=ok?["Erfolgreich","var(--go)"]:part?["Teilerfolg","var(--tbd)"]:fail?["Fehlstart","var(--live)"]
    :/deploy/.test(((l.status?.name||"")+a).toLowerCase())?["Nutzlast ausgesetzt","var(--go)"]:flownStatus(l)||LAUNCHED[l.id]?["Gestartet – Ergebnis noch offen","var(--go)"]:[l.status?.name||"?","var(--tbd)"];
  const ago=Math.round((Date.now()-new Date(l.net))/864e5), h=NETH[l.id];
  const shift=h&&h.first&&Math.abs(new Date(l.net)-new Date(h.first))>=60e3?new Date(l.net)-new Date(h.first):0;
  const rows=[["Start",`${fmtDate(l.net)} <span class="mute">(${ago<1?"heute":ago===1?"gestern":"vor "+ago+" Tagen"})</span>`]];
  if(shift) rows.push(["Ursprünglich",`${fmtDate(h.first)} <span class="mute">(${fmtShift(shift)})</span>`]);
  if(l.mission?.orbit?.name) rows.push(["Zielbahn",esc(l.mission.orbit.name)+(ok?" – erreicht":"")]);
  (l.rocket?.launcher_stage||[]).forEach(s=>{ const ld=s.landing, la=s.launcher; if(!ld) return;
    const where=ld.landing_location?.name||ld.landing_location?.abbrev||"";
    rows.push([/^booster/i.test(la?.serial_number||"")?esc(la.serial_number):`Booster ${esc(la?.serial_number||"")}`, ld.attempt===false?"nicht geborgen (Einweg)":ld.success===true?`<span style="color:#7be07b">${isCatch(ld)?"Am Turm gefangen":"Landung erfolgreich"}</span>${where?" · "+esc(where):""}${la?.flights?` · ${la.flights}. Flug`:""}`
      :landAborted(ld)?`<span style="color:var(--tbd)" title="${esc(ld.description||"")}">Landung abgebrochen</span>`:ld.success===false?`<span style="color:#ff8a8a">Landung fehlgeschlagen</span>${where?" · "+esc(where):""}`:"Ergebnis noch offen"]); });
  // 2. Stufe / Raumschiff (z.B. Starship-Ship, Dragon): Landung bzw. Rückkehr
  (l.rocket?.spacecraft_stage||[]).forEach(x=>{ const ld=x.landing, sc=x.spacecraft||{}; if(!ld || ld.attempt==null && ld.success==null) return;
    const where=ld.landing_location?.name||ld.landing_location?.abbrev||"";
    rows.push([esc(sc.name||sc.serial_number||"Raumschiff"), ld.attempt===false?"keine Landung geplant":ld.success===true?`<span style="color:#7be07b">${isCatch(ld)?"Am Turm gefangen":"Landung erfolgreich"}</span>${where?" · "+esc(where):""}`
      :landAborted(ld)?`<span style="color:var(--tbd)" title="${esc(ld.description||"")}">Landung abgebrochen</span>`:ld.success===false?`<span style="color:#ff8a8a">Landung fehlgeschlagen</span>`:"Ergebnis noch offen"]); });
  const vids=(l.vid_urls||[]).slice().sort((x,y)=>(x.priority||99)-(y.priority||99)), yt=vids.map(v=>ytId(v.url)).find(Boolean);
  const T=TELEST[l.id];
  return `<div class="sec review"><h3>Rückblick</h3>
    <div class="wxhead"><span class="pill" style="background:${res[1]};color:#000">${esc(res[0])}</span>${fail||part?`<span class="mute">${esc(l.failreason||"")}</span>`:""}</div>
    <div class="grid">${rows.map(r=>`<b>${r[0]}</b><span>${r[1]}</span>`).join("")}</div>
    ${yt?`<button class="btn sec2" onclick="openPip('${yt}','${esc((l.name.split("|")[1]||l.name).trim()).replace(/'/g,"")}')">▶ Aufzeichnung ansehen</button>`:vids[0]?`<a class="btn sec2" href="${esc(vids[0].url)}" target="_blank" rel="noopener">▶ Aufzeichnung</a>`:""}
    ${T?reviewTele(T,est):""}</div>`;
}
// Eigene Messung (Texterkennung) neben der Schätzung aus dem Aufstiegsprofil
function reviewTele(T,est){
  const P=est.prof, all=[...T.s1,...T.s2]; if(!all.length) return "";
  const t1=Math.max(...all.map(q=>q[0])), t0=Math.max(0,Math.min(...all.map(q=>q[0])));
  const mx=k=>{ const v=[...T.s2.map(q=>q[k])]; return v.length?Math.max(...v):null; };
  const chart=(col,title,unit)=>{ const W=400,H=120,pl=40,pr=8,pt=14,pb=18;
    const ser=[["#4ea1ff",T.s2],["#f5a142",T.s1]].filter(s=>s[1].length);
    const est=P?Array.from({length:60},(_,i)=>{ const t=t0+(t1-t0)*i/59, q=profAt(P,t); return [t,q.h,q.v]; }):[];
    const ym=niceMax(Math.max(1,...all.map(q=>q[col]),...est.filter(q=>q[0]<=profEnd(P||{pts:[[0]]})).map(q=>q[col])));
    const X=t=>pl+(t-t0)/Math.max(1,t1-t0)*(W-pl-pr), Y=v=>H-pb-Math.min(v,ym)/ym*(H-pt-pb);
    const line=(pts,c,dash)=>`<polyline points="${pts.map(q=>X(q[0]).toFixed(1)+","+Y(q[col]).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="${dash?1.5:2}" ${dash?'stroke-dasharray="4 4"':""}/>`;
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:460px;display:block;margin-top:6px"><g font-size="10" fill="#8a96ad">
      <text x="${pl}" y="10">${title} (${unit})</text><text x="${pl-4}" y="${pt+4}" text-anchor="end">${ym.toLocaleString(LOC)}</text><text x="${pl-4}" y="${H-pb}" text-anchor="end">0</text>
      <text x="${pl}" y="${H-4}">T+${mmss(t0)}</text><text x="${W-pr}" y="${H-4}" text-anchor="end">T+${mmss(t1)}</text></g>
      <path d="M${pl} ${H-pb}H${W-pr}" stroke="#232c3f"/>${est.length?line(est,"#8a96ad",true):""}${ser.map(s=>line(s[1],s[0])).join("")}</svg>`; };
  return `<details class="ownm"><summary>Deine Messung</summary>
    <div class="mute" style="font-size:12px">Gemessen mit „Echte Telemetrie“: <span style="color:#4ea1ff">Stufe 2</span>${T.s1.length?`, <span style="color:#f5a142">Stufe 1</span>`:""} · gestrichelt = Schätzung${mx(2)!=null?` · höchstes gemessenes Tempo ${mx(2).toLocaleString(LOC)} km/h, Höhe ${mx(1)} km`:""}</div>
    ${chart(1,"Höhe","km")}${chart(2,"Tempo","km/h")}</details>`;
}
