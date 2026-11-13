// ===================== Vergangene Starts + Booster =====================
var PAST=null;
async function loadPast(){ if(PAST) return PAST; let c=null;
  try{ c=JSON.parse(localStorage.getItem("lr_past")||"null"); }catch(e){}
  if(c && Date.now()-c.ts<3600e3){ PAST=c.data; return PAST; }
  try{ const r=await fetch(CONFIG.worker?CONFIG.worker+"/previous":"https://ll.thespacedevs.com/2.3.0/launches/previous/?mode=detailed&limit=30"); if(!r.ok) throw 0;
    PAST=(await r.json()).results; try{ localStorage.setItem("lr_past",JSON.stringify({ts:Date.now(),data:PAST})); }catch(e){} }
  catch(e){ PAST=PAST_SNAP; }
  return PAST; }
function applyFilter(list){ return list.filter(matchFilter); }
var LIST_TAB="up";
async function showStartList(tab){
  LIST_TAB=tab=tab||LIST_TAB;
  const all=tab==="past"?await loadPast():launches, list=applyFilter(all).sort((a,b)=>tab==="past"?new Date(b.net)-new Date(a.net):new Date(a.net)-new Date(b.net));
  showList(list,tab==="past"?"Vergangene Starts":"Kommende Starts",tab);
  // Such-/Filterleiste (Optionen aus allen Starts dieser Liste, damit man sich nicht „wegfiltern“ kann)
  const opts=(f,cur)=>[...new Set(all.map(f))].sort((a,b)=>a.localeCompare(b,"de")).map(v=>`<option ${v===cur?"selected":""}>${esc(v)}</option>`).join("");
  document.querySelector("#panel .tabs").insertAdjacentHTML("afterend",`<div class="dbctl lfilt">
    <input type="search" id="lq" placeholder="Suchen: Rakete, Mission, Ort …" value="${esc(FILT.q)}">
    <select id="lp"><option value="">Alle Betreiber</option>${opts(provOf,FILT.prov)}</select>
    <select id="lc"><option value="">Alle Länder</option>${opts(countryOf,FILT.cty)}</select>
    ${filterActive()?`<button class="chip" id="lx">Filter löschen</button>`:""}
    ${tab==="up"?(SUBS.some(x=>ruleKey(x)===ruleKey(currentRule()))?`<span class="chip on" title="Abo aktiv – entfernen im Ebenen-Menü">${ICON.bell} abonniert</span>`
      :`<button class="chip" onclick="subscribeFilter()" title="Bei jedem Start dieses Filters erinnern – auch künftigen">${ICON.bell} ${filterActive()||filter!=="all"?"Abonnieren":"Alle abonnieren"}</button>`):""}
    <span class="mute" style="font-size:12px">${list.length} von ${all.length}</span></div>
    ${list.length?"":`<div class="sec mute">Keine Starts für diesen Filter.</div>`}`);
  const q=document.getElementById("lq"); let tm=null;
  q.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{ FILT.q=q.value.trim(); applyListFilter(true); },250); };
  document.getElementById("lp").onchange=e=>{ FILT.prov=e.target.value; applyListFilter(); };
  document.getElementById("lc").onchange=e=>{ FILT.cty=e.target.value; applyListFilter(); };
  const x=document.getElementById("lx"); if(x) x.onclick=()=>{ FILT={q:"",prov:"",cty:""}; applyListFilter(); };
}
// Liste neu zeichnen (Suchfeld behält Fokus) und Karte nachführen
async function applyListFilter(keepFocus){
  const pos=keepFocus?document.getElementById("lq").selectionStart:null;
  render(); await showStartList(LIST_TAB);
  if(keepFocus){ const q=document.getElementById("lq"); q.focus(); try{ q.setSelectionRange(pos,pos); }catch(e){} }
}
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
