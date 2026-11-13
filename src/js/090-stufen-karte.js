// ===================== Einheitliche Stufen-Karte (Booster & Ship) =====================
function stageImg(im,fallbackUrl){
  if(im&&typeof im==="object"&&(im.image_url||im.thumbnail_url)){ const th=im.thumbnail_url||"";
    return `<img src="${esc(im.thumbnail_url||im.image_url)}" data-th="${esc(th)}" onerror="stageImgFail(this)" class="stimg" alt="">`; }
  if(fallbackUrl) return `<img src="${esc(fallbackUrl)}" onerror="stageImgFail(this)" class="stimg" alt="">`;
  return `<div class="stimg ph">${ICON.rocket}</div>`; }
function stageImgFail(el){ el.onerror=null;
  snapData("img").then(m=>{ const s=m&&m[el.dataset.th];
    if(s && el.src!==s){ el.src=s; el.onerror=()=>el.outerHTML=`<div class="stimg ph">${ICON.rocket}</div>`; } else el.outerHTML=`<div class="stimg ph">${ICON.rocket}</div>`; }); }
function landResult(ld){ return ld.success===true?[["Ergebnis",'<span style="color:#7be07b">✓ Landung erfolgreich</span>']]:ld.success===false?[["Ergebnis",'<span style="color:#ff8a8a">✗ Landung fehlgeschlagen</span>']]:[]; }
function stageCard(o){
  const g=rows=>rows.filter(r=>r&&r[1]!=null&&r[1]!=="").map(([k,v])=>`<b>${k}</b><span>${v}</span>`).join("");
  const D='<span class="mute">–</span>', v=x=>(x==null||x==="")?D:x;
  // Steckbrief: immer die gleichen Kacheln und Zeilen in gleicher Reihenfolge (fehlt ein Wert: –)
  const S=o.st;
  const tiles=[[S.flights,"bisherige Flüge"],[S.landings,"Landungen ok / versucht"],[S.turn,"schnellste Wende"]];
  const grid=[["Status",S.status],["Erstflug",S.first],["Letzter Flug",S.last],["Zeit im All",S.space],["Höhe",S.height],["Durchmesser",S.dia],["Baureihe",S.fam],["Erstflug Baureihe",S.famFirst]];
  return `<div class="stcard"><div class="sttop">${o.img}<div class="grid" style="flex:1">${g(o.rows)}</div></div>
    ${o.desc?`<p class="mute">${esc(o.desc)}</p>`:""}
    <details style="margin-top:6px"><summary style="cursor:pointer;color:var(--acc)">${esc(o.sum)}</summary>
      <div class="tiles" style="margin-top:8px">${tiles.map(([x,s])=>`<div class="tile"><div class="big" ${String(x??"").length>5?'style="font-size:18px"':""}>${v(x)}</div><small>${s}</small></div>`).join("")}</div>
      <div class="grid" style="margin-top:8px">${grid.map(([k,x])=>`<b>${k}</b><span>${v(x)}</span>`).join("")}</div>${o.more?`<p class="mute">${esc(o.more)}</p>`:""}</details></div>`; }
// Höhe der 1. Stufe: bekannte Werte, bei Starship = Gesamthöhe minus Ship
const STAGE1_H={"falcon 9":41.2,"falcon heavy":41.2,"new glenn":57.5};
function boosterHeight(l,fam){
  const nm=(l.rocket?.configuration?.name||"").toLowerCase();
  const sc=(l.rocket?.spacecraft_stage||[])[0]?.spacecraft?.spacecraft_config;
  if(/starship/.test(nm) && fam?.len && sc?.height) return fmtN(fam.len-sc.height,"m",1)+' <span class="mute">(Gesamthöhe − Ship)</span>';
  for(const k in STAGE1_H) if(nm.startsWith(k)) return fmtN(STAGE1_H[k],"m",1);
  return null; }
const fmtN=(v,u,d=0)=>v==null?null:(+v).toLocaleString(LOC,{maximumFractionDigits:d})+" "+u;
function boosterBlock(l,s){
  const la=s.launcher||{}, ld=s.landing||{}, loc=ld.landing_location||ld.location||{}, cfg=l.rocket?.configuration||{};
  const isSS=/starship/i.test(cfg.name||""), st=typeof la.status==="object"?la.status?.name:la.status;
  const nm=(cfg.name||"").toLowerCase(), fam=ROCKETS.find(x=>x.n.toLowerCase()===nm)||ROCKETS.find(x=>nm.includes(x.n.toLowerCase()));
  const first=la.flights===0?"dieser Flug":(la.first_launch_date?fmtDay(la.first_launch_date):null);
  return stageCard({
    img:stageImg(la.image||l.image, fam?.img),
    rows:[["Name",`<b>${esc(la.serial_number||"unbekannt")}</b>${s.reused?" "+ICON.reuse:""}`],
          ["Typ",`${esc(isSS?"Super Heavy":(cfg.name||"–"))} <span class="mute">· 1. Stufe</span>`],
          ["Landung",`${ld.attempt===false?"keine (Einweg)":esc(ld.type?.name||"–")}${loc.name?` · ${esc(loc.name)}${loc.abbrev?` (${esc(loc.abbrev)})`:""}`:""}`],
          ...landResult(ld)],
    desc:ld.description, sum:`Booster-Steckbrief ${la.serial_number||""}`, more:la.details,
    st:{flights:la.flights??null, landings:la.attempted_landings!=null?`${la.successful_landings??0}/${la.attempted_landings}`:null,
        turn:la.fastest_turnaround?fmtDur(la.fastest_turnaround):null,
        status:esc(st||"")+(la.flight_proven?" · flight-proven":""), first, last:la.last_launch_date?fmtDay(la.last_launch_date):(la.flights===0?"–":null),
        space:null, height:boosterHeight(l,fam), dia:fam?fmtN(fam.dia,"m",1):null,
        fam:fam?`${esc(fam.n)}: ${fam.tot} Flüge · ${fam.sl}/${fam.al} Landungen`:null, famFirst:fam?.first?fmtDay(fam.first):null} });
}
function shipBlock(l,x){
  const sc=x.spacecraft||{}, cf=sc.spacecraft_config||{}, ld=x.landing||{}, loc=ld.landing_location||{}, isSS=/starship/i.test(l.rocket?.configuration?.name||"");
  const st=typeof sc.status==="object"?sc.status?.name:sc.status;
  return stageCard({
    img:stageImg(sc.image||l.image),
    rows:[["Name",`<b>${esc(sc.name||"–")}</b>${sc.serial_number&&sc.serial_number!==sc.name?` <span class="mute">(${esc(sc.serial_number)})</span>`:""}`],
          ["Typ",`${esc(cf.name||"–")} <span class="mute">· ${isSS?"2. Stufe":esc(cf.type||"Raumschiff")}</span>`],
          ["Landung",`${ld.attempt===false?"keine (Einweg)":esc(ld.type?.name||(loc.name?"geplant":"–"))}${loc.name?` · ${esc(loc.name)}${loc.abbrev?` (${esc(loc.abbrev)})`:""}`:""}`],
          ...landResult(ld)],
    desc:ld.description, sum:`${isSS?"Ship":"Raumschiff"}-Steckbrief ${sc.serial_number||sc.name||""}`, more:sc.description,
    st:{flights:sc.flights_count??null, landings:sc.flights_count===0?"0/0":null,
        turn:sc.fastest_turnaround?fmtDur(sc.fastest_turnaround):null,
        status:esc(st||"")+(sc.in_space?" · gerade im All":""), first:sc.flights_count===0?"dieser Flug":null, last:sc.flights_count===0?"–":null,
        space:sc.time_in_space&&sc.time_in_space!=="P0D"?fmtDur(sc.time_in_space):"0", height:fmtN(cf.height,"m",1), dia:fmtN(cf.diameter,"m",1),
        fam:cf.total_launch_count!=null?`${esc(cf.name||"")}: ${cf.total_launch_count} Flüge · ${cf.successful_landings??0}/${cf.attempted_landings??0} Landungen`:null,
        famFirst:cf.maiden_flight?fmtDay(cf.maiden_flight):null} });
}
function spacecraftSection(l){
  const list=l.rocket?.spacecraft_stage||[]; if(!list.length) return "";
  const isSS=/starship/i.test(l.rocket?.configuration?.name||"");
  return `<div class="sec"><h3>${isSS?"Ship (2. Stufe)":"Raumschiff"}</h3>`+list.map(x=>shipBlock(l,x)).join('<hr class="sthr">')+`</div>`; }
