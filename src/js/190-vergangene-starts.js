// ===================== Vergangene Starts + Booster =====================
var PAST=null;
async function loadPast(){ if(PAST) return PAST; let c=null;
  try{ c=JSON.parse(localStorage.getItem("lr_past")||"null"); }catch(e){}
  if(c && Date.now()-c.ts<3600e3){ PAST=c.data; return PAST; }
  try{ const r=await fetch("https://ll.thespacedevs.com/2.3.0/launches/previous/?mode=detailed&limit=30"); if(!r.ok) throw 0;
    PAST=(await r.json()).results; try{ localStorage.setItem("lr_past",JSON.stringify({ts:Date.now(),data:PAST})); }catch(e){} }
  catch(e){ PAST=PAST_SNAP; }
  return PAST; }
function applyFilter(list){ return list.filter(l=>{ const p=(l.launch_service_provider?.name||"").toLowerCase(), r=(l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"").toLowerCase();
  return filter==="spacex"?p.includes("spacex"):filter==="starship"?r.includes("starship"):true; }); }
async function showStartList(tab){
  if(tab==="past"){ const p=await loadPast(); showList(applyFilter(p).sort((a,b)=>new Date(b.net)-new Date(a.net)),"Vergangene Starts","past"); }
  else showList(visible().slice().sort((a,b)=>new Date(a.net)-new Date(b.net)),"Kommende Starts","up"); }
function landIcons(l){ return (l.rocket?.launcher_stage||[]).map(s=>s.landing?.success===true?'<span class="pill" style="background:#1f4d33;color:#7be07b">Landung ✓</span>':s.landing?.success===false?'<span class="pill" style="background:#4d1f26;color:#ff8a8a">Landung ✗</span>':"").join(""); }
function fmtDur(iso){ const m=/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso||""); if(!m) return iso; return [m[1]&&m[1]+" Tage",m[2]&&m[2]+" Std",!m[1]&&m[3]&&m[3]+" Min"].filter(Boolean).join(" "); }
function fmtDay(d){ return new Date(d).toLocaleDateString("de-CH",{day:"2-digit",month:"2-digit",year:"numeric"}); }
function boosterCard(s){ const la=s.launcher; if(!la||la.flights==null) return "";
  const st=typeof la.status==="object"?la.status?.name:la.status;
  return `<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--acc)">Booster-Steckbrief ${esc(la.serial_number||"")}</summary>
   <div class="tiles" style="margin-top:8px">
     <div class="tile"><div class="big">${la.flights}</div><small>Flüge</small></div>
     <div class="tile"><div class="big">${la.successful_landings??0}/${la.attempted_landings??0}</div><small>Landungen ok / versucht</small></div>
     ${la.fastest_turnaround?`<div class="tile"><div class="big" style="font-size:18px">${fmtDur(la.fastest_turnaround)}</div><small>schnellste Wende</small></div>`:""}
   </div><div class="grid" style="margin-top:8px">
     <b>Erstflug</b><span>${la.first_launch_date?fmtDay(la.first_launch_date):"–"}</span>
     <b>Letzter Flug</b><span>${la.last_launch_date?fmtDay(la.last_launch_date):"–"}</span>
     <b>Status</b><span>${esc(st||"–")}${la.flight_proven?" · flight-proven":""}</span>
   </div>${la.details?`<p class="mute">${esc(la.details)}</p>`:""}</details>`; }
