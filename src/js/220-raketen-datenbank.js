// ===================== Raketen-Datenbank =====================
var DB={q:"",f:"all",flown:true,reu:false,sort:"tot",dir:-1,sel:[]};
const DBCOLS=[["n","Rakete"],["man","Hersteller"],["act","Status"],["leo","LEO (t)",1],["gto","GTO (t)",1],["thr","Schub (kN)",1],["len","Höhe (m)",1],["mass","Masse (t)",1],["tot","Flüge",1],["rate","Erfolg",1],["sl","Landungen",1],["first","Erstflug"],["cost","Preis (Mio $)",1]];
function rVal(r,k){ switch(k){ case "rate": return r.tot? r.suc/r.tot : null; case "leo": case "gto": case "sso": return r[k]!=null? r[k]/1000 : null;
  case "cost": return r.cost? r.cost/1e6 : null; case "act": return r.act?1:0; case "man": return r.mab||r.man||null; case "sl": return r.al? r.sl : null; default: return r[k]; } }
function fmtCell(r,k){ const v=rVal(r,k); if(v==null||v==="") return '<span class="mute">–</span>';
  switch(k){
    case "n": return `<b>${esc(r.n)}</b>${r.reu?' <span title="wiederverwendbar">'+ICON.reuse+'</span>':""}`;
    case "man": return esc(v)+(r.cty?` <span class="mute">${esc(r.cty)}</span>`:"");
    case "act": return r.act?'<span class="pill" style="background:#1f4d33;color:#7be07b">aktiv</span>':'<span class="pill" style="background:#33384a;color:#aab">inaktiv</span>';
    case "leo": case "gto": return v.toLocaleString("de-CH",{maximumFractionDigits:1});
    case "thr": case "mass": return Math.round(v).toLocaleString("de-CH");
    case "len": return v.toFixed(1);
    case "rate": return (v*100).toFixed(0)+" %";
    case "sl": return `${r.sl}/${r.al}`;
    case "first": return String(v).slice(0,4);
    case "cost": return v.toLocaleString("de-CH",{maximumFractionDigits:0});
    default: return esc(v); } }
function dbRows(){ const q=DB.q.toLowerCase().trim();
  const rows=ROCKETS.filter(r=>(DB.f==="all"||(DB.f==="act")===r.act)&&(!DB.flown||r.tot>0)&&(!DB.reu||r.reu)&&(!q||(r.n+" "+r.fam+" "+r.man+" "+r.mab).toLowerCase().includes(q)));
  rows.sort((a,b)=>{ const x=rVal(a,DB.sort), y=rVal(b,DB.sort); if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1; return (x>y?1:x<y?-1:0)*DB.dir; });
  return rows; }
function openDB(){
  clearSat(); stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null;
  const P=document.getElementById("panel"); P.classList.add("wide");
  const chip=(v,l)=>`<button class="chip ${DB.f===v?"on":""}" onclick="DB.f='${v}';openDB()">${l}</button>`;
  P.innerHTML=`<div class="hd"><h2>Raketen-Datenbank <span class="mute" style="font-weight:400;font-size:13px">${ROCKETS.length} Raketen & Varianten · ${esc(standText("db"))}</span></h2><button class="x" onclick="closeP()">×</button></div>
   <div class="dbctl"><input type="search" id="dbQ" placeholder="Suchen: Falcon, Ariane, Long March, SpaceX …" value="${esc(DB.q)}">
     ${chip("all","Alle")}${chip("act","Aktiv")}${chip("ina","Inaktiv")}
     <label class="chip"><input type="checkbox" ${DB.flown?"checked":""} onchange="DB.flown=this.checked;renderDBTable()"> nur geflogene</label>
     <label class="chip"><input type="checkbox" ${DB.reu?"checked":""} onchange="DB.reu=this.checked;renderDBTable()"> wiederverwendbar</label>
     <button class="btn" id="cmpBtn" style="margin:0" onclick="openCompare()">Vergleichen (${DB.sel.length})</button></div>
   <div class="note" style="padding:6px 14px">Bis zu 4 Raketen antippen (☑), dann „Vergleichen“. Spaltenkopf antippen = sortieren. <span id="dbN"></span></div>
   <div class="tw"><table class="db" id="dbT"></table></div>`;
  P.style.display="block"; P.scrollTop=0;
  document.getElementById("dbQ").oninput=e=>{ DB.q=e.target.value; renderDBTable(); };
  renderDBTable(); }
function renderDBTable(){ const T=document.getElementById("dbT"); if(!T) return; const rows=dbRows();
  document.getElementById("dbN").textContent=`· ${rows.length} Treffer`;
  T.innerHTML=`<thead><tr><th></th>${DBCOLS.map(([k,l,num])=>`<th class="${num?"num":""} ${DB.sort===k?"s":""}" data-k="${k}">${l}${DB.sort===k?(DB.dir<0?" ▼":" ▲"):""}</th>`).join("")}</tr></thead>
   <tbody>${rows.slice(0,400).map(r=>`<tr data-id="${r.id}" class="${DB.sel.includes(r.id)?"sel":""}"><td>${DB.sel.includes(r.id)?"☑":"☐"}</td>${DBCOLS.map(([k,,num])=>`<td class="${num?"num":""}">${fmtCell(r,k)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  T.querySelectorAll("th[data-k]").forEach(th=>th.onclick=()=>{ const k=th.dataset.k; if(DB.sort===k) DB.dir*=-1; else { DB.sort=k; DB.dir=(k==="n"||k==="man"||k==="first")?1:-1; } renderDBTable(); });
  T.querySelectorAll("tbody tr").forEach(tr=>tr.onclick=()=>{ const id=+tr.dataset.id, i=DB.sel.indexOf(id);
    if(i>=0) DB.sel.splice(i,1); else { if(DB.sel.length>=4){ toast("Maximal 4 Raketen gleichzeitig vergleichen"); return; } DB.sel.push(id); }
    document.getElementById("cmpBtn").textContent=`Vergleichen (${DB.sel.length})`; renderDBTable(); }); }
function openCompare(ids){
  ids=ids||DB.sel; if(!ids.length){ toast("Zuerst Raketen in der Tabelle antippen"); return; }
  const rs=ids.map(id=>ROCKETS.find(r=>r.id===id)).filter(Boolean), P=document.getElementById("panel"); P.classList.add("wide");
  const row=(lab,k,fmt,bar)=>{ const vals=rs.map(r=>rVal(r,k)), mx=Math.max(...vals.filter(v=>typeof v==="number"),0);
    return `<tr><th>${lab}</th>${rs.map((r,i)=>{ const v=vals[i]; const txt=fmt?fmt(r,v):fmtCell(r,k);
      return `<td>${txt}${bar&&typeof v==="number"&&mx>0?`<div class="mb" style="width:${(v/mx*100).toFixed(0)}%"></div>`:""}</td>`; }).join("")}</tr>`; };
  const n=(v,d=0)=>v==null?'<span class="mute">–</span>':v.toLocaleString("de-CH",{maximumFractionDigits:d});
  P.innerHTML=`<div class="hd"><h2>Vergleich</h2><button class="x" onclick="closeP()">×</button></div>
   <div class="dbctl"><button class="chip" onclick="openDB()">← zurück zur Tabelle</button></div>
   <div class="tw" style="padding:0 6px 10px"><table class="cmp">
    <tr><th></th>${rs.map(r=>`<td><b style="font-size:15px">${esc(r.n)}</b>${r.v?`<div class="mute">${esc(r.v)}</div>`:""}</td>`).join("")}</tr>
    <tr><th></th>${rs.map(r=>`<td>${r.img?`<img src="${esc(r.img)}" alt="" onerror="this.remove()">`:""}</td>`).join("")}</tr>
    ${row("Hersteller","man")}
    <tr><th>Familie</th>${rs.map(r=>`<td>${esc(r.fam||"–")}</td>`).join("")}</tr>
    ${row("Status","act")}
    <tr><th>Wiederverwendbar</th>${rs.map(r=>`<td>${r.reu?ICON.reuse+" ja":"nein"}</td>`).join("")}</tr>
    ${row("Nutzlast LEO","leo",(r,v)=>v==null?n(v):n(v,1)+" t",1)}
    ${row("Nutzlast GTO","gto",(r,v)=>v==null?n(v):n(v,1)+" t",1)}
    ${row("Nutzlast SSO","sso",(r,v)=>v==null?n(v):n(v,1)+" t",1)}
    ${row("Startschub","thr",(r,v)=>v==null?n(v):n(v)+" kN",1)}
    ${row("Höhe","len",(r,v)=>v==null?n(v):n(v,1)+" m",1)}
    ${row("Durchmesser","dia",(r,v)=>v==null?n(v):n(v,1)+" m",1)}
    ${row("Startmasse","mass",(r,v)=>v==null?n(v):n(v)+" t",1)}
    ${row("Preis pro Start","cost",(r,v)=>v==null?n(v):n(v)+" Mio $",1)}
    ${row("Flüge","tot",(r,v)=>n(v)+(r.pend?` <span class="mute">(+${r.pend} geplant)</span>`:""),1)}
    ${row("Erfolgreich","suc",(r,v)=>n(v),1)}
    ${row("Fehlschläge","fail",(r,v)=>n(v),1)}
    ${row("Erfolgsquote","rate",(r,v)=>v==null?n(v):(v*100).toFixed(1)+" %",1)}
    ${row("Landungen","sl",(r,v)=>r.al?`${r.sl} von ${r.al}`:'<span class="mute">–</span>',1)}
    ${row("Landungen in Serie","csl",(r,v)=>n(v),1)}
    ${row("Erstflug","first",(r,v)=>v?fmtDay(v):n(null))}
    <tr><th>Beschreibung</th>${rs.map(r=>`<td style="font-size:12px;color:var(--mute)">${esc(r.d||"")}${r.wiki?`<br><a href="${esc(r.wiki)}" target="_blank" rel="noopener" style="color:var(--acc)">Wikipedia ↗</a>`:""}</td>`).join("")}</tr>
   </table></div><div class="note" style="padding:0 14px 14px">Balken = Wert im Verhältnis zum grössten der verglichenen Raketen. Quelle: The Space Devs, Stand ${esc(SNAP_TS)}.</div>`;
  P.style.display="block"; P.scrollTop=0; }
function openRocketByName(name){ const nm=(name||"").toLowerCase(); const r=ROCKETS.find(x=>x.n.toLowerCase()===nm)||ROCKETS.find(x=>nm.includes(x.n.toLowerCase()));
  if(r) openCompare([r.id]); else toast("Rakete nicht in der Datenbank gefunden"); }
