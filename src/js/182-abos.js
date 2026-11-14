// ===================== Automatische Abos =====================
// Ein Abo ist ein gespeicherter Filter (Regel wie matchRule). Jeder passende kommende Start bekommt automatisch
// eine Erinnerung (REM[id].auto=true). Die Regeln gehen auch an den Worker, der neue Starts selbst erkennt
// und Push-Nachrichten schickt, ohne dass die App offen sein muss.
var SUBS=[]; try{ SUBS=JSON.parse(localStorage.getItem("lr_subs")||"[]"); }catch(e){}
// Einzeln abgewählte Auto-Erinnerungen (sonst würde das Abo sie sofort wieder anlegen)
var REMOFF={}; try{ REMOFF=JSON.parse(localStorage.getItem("lr_rem_off")||"{}"); }catch(e){}
function remOff(id){ REMOFF[id]=Date.now(); for(const k in REMOFF) if(Date.now()-REMOFF[k]>60*864e5) delete REMOFF[k];
  try{ localStorage.setItem("lr_rem_off",JSON.stringify(REMOFF)); }catch(e){} }
function ruleLabel(r){
  const g=Array.isArray(r.grp)&&r.grp.length?r.grp.map(k=>(GROUPS.find(x=>x[0]===k)||[k,k])[1]).join(", "):"";
  const p=[r.chip==="spacex"?"SpaceX":r.chip==="starship"?"Starship":"", g, r.prov, r.cty, r.q?`„${r.q}“`:""].filter(Boolean);
  return p.length?p.join(" · "):"Alle Starts";
}
const ruleKey=r=>JSON.stringify([r.chip||"",(r.grp||[]).join(),r.prov||"",r.cty||"",r.q||""]);
function saveSubs(){ try{ localStorage.setItem("lr_subs",JSON.stringify(SUBS)); }catch(e){} applySubs(true); }
function subscribeFilter(){
  const r=currentRule();
  if(SUBS.some(x=>ruleKey(x)===ruleKey(r))) return toast("Dieses Abo gibt es schon");
  if(!r.chip&&!r.grp&&!r.prov&&!r.cty&&!r.q && !confirm(i18n("Ohne Filter: wirklich bei ALLEN Starts weltweit erinnern? (ca. 5 pro Woche)"))) return;
  SUBS.push(r); saveSubs(); pwaAsk(); beep(true);
  const n=launches.filter(l=>new Date(l.net)>Date.now()&&matchRule(r,l)).length;
  toast(`Abo „${ruleLabel(r)}“ aktiv – ${n} kommende Starts, neue kommen automatisch dazu`);
  if(document.getElementById("lq")) showStartList(LIST_TAB);
}
function removeSub(i){ const r=SUBS.splice(i,1)[0]; saveSubs(); toast(`Abo „${ruleLabel(r)}“ entfernt`); buildLayerMenu(); }
// Erinnerungen an die Abos anpassen: passende kommende Starts (nächste 30 Tage) dazu, nicht mehr passende Auto-Erinnerungen weg
function applySubs(force){
  let ch=false; const now=Date.now();
  launches.forEach(l=>{ const t=new Date(l.net)-now; if(t<10*60e3||t>30*864e5||REM[l.id]||REMOFF[l.id]) return;
    if(SUBS.some(r=>matchRule(r,l))){ REM[l.id]={name:l.name,net:l.net,fired:false,auto:true}; ch=true; } });
  for(const id in REM){ const r=REM[id]; if(!r.auto) continue; const l=launches.find(x=>x.id===id);
    if(l && !SUBS.some(s=>matchRule(s,l))){ delete REM[id]; ch=true; } }
  if(ch||force) saveRem();
}
function subsMenuHtml(){
  return `<h4>Abos</h4>${SUBS.length?SUBS.map((r,i)=>`<div class="subrow">${ICON.bell}<span>${esc(ruleLabel(r))}</span><button class="x" title="Abo entfernen" onclick="removeSub(${i})">×</button></div>`).join("")
    :`<div class="note">Noch keine. In der Liste filtern (z.B. Starship oder ein Land) und „Abonnieren“ tippen – du wirst dann bei jedem passenden Start erinnert.</div>`}`;
}
