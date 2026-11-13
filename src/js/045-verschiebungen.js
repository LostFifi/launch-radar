// ===================== Verschiebungen erkennen =====================
// Die API liefert nur die aktuelle Startzeit (NET). Wir merken uns jede Startzeit im Browser (localStorage "lr_net")
// und erkennen so, wenn ein Start verschoben wurde. Nur mit echten Daten (live/Cache) – nie mit den veralteten
// Ersatzdaten vom dev-Server, sonst würde ein „Zurückschieben“ erkannt, das es nicht gibt.
var NETH={}; try{ NETH=JSON.parse(localStorage.getItem("lr_net")||"{}"); }catch(e){}
function trackNet(list){
  if(DATA.src!=="live" && DATA.src!=="cache") return;
  const now=Date.now(); let ch=false;
  list.forEach(l=>{ if(!l.id||!l.net) return; const h=NETH[l.id];
    if(!h){ NETH[l.id]={first:l.net,net:l.net,seen:now}; ch=true; return; }
    h.seen=now;
    if(Math.abs(new Date(l.net)-new Date(h.net))>=60e3){ h.prev=h.net; h.net=l.net; h.at=now; h.n=(h.n||0)+1; ch=true; onPostponed(l,h); } });
  for(const id in NETH) if(now-(NETH[id].seen||0)>30*864e5){ delete NETH[id]; ch=true; }   // nach 30 Tagen vergessen
  if(ch) try{ localStorage.setItem("lr_net",JSON.stringify(NETH)); }catch(e){}
}
function fmtShift(ms){ const s=ms<0?"−":"+", m=Math.round(Math.abs(ms)/60e3), d=Math.floor(m/1440), h=Math.floor(m%1440/60), mi=m%60;
  return s+(d?d+" T ":"")+(d||h?h+" h ":"")+(d?"":mi+" Min"); }
// Letzte Verschiebung eines Starts (nur wenn sie in den letzten 7 Tagen erkannt wurde)
function postponed(l){ const h=NETH[l.id]; if(!h||!h.prev||Date.now()-h.at>7*864e5) return null;
  return {prev:h.prev, net:h.net, shift:new Date(h.net)-new Date(h.prev), total:new Date(h.net)-new Date(h.first), n:h.n, at:h.at}; }
function postponedPill(l){ const p=postponed(l); if(!p) return "";
  return `<span class="pill shift" title="Vorher ${esc(fmtDate(p.prev))}">${p.shift>0?"verschoben":"vorgezogen"} ${fmtShift(p.shift)}</span>`; }
function postponedNote(l){ const p=postponed(l); if(!p) return "";
  return `<div class="warnbox" style="margin-top:8px"><b>${p.shift>0?"Verschoben":"Vorgezogen"}</b> um ${fmtShift(p.shift)}: vorher ${esc(fmtDate(p.prev))} → jetzt ${esc(fmtDate(p.net))}${p.n>1?` <span class="mute">(${p.n}× geändert, insgesamt ${fmtShift(p.total)})</span>`:""}<br><span class="mute" style="font-size:12px">Erkannt ${esc(new Date(p.at).toLocaleString("de-CH",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}))}</span></div>`; }
// Meldung, wenn ein Start mit Erinnerung verschoben wurde
function onPostponed(l,h){
  if(!REM[l.id]) return;
  const msg=`${(l.name.split("|")[1]||l.name).trim()}: ${new Date(h.net)>new Date(h.prev)?"verschoben":"vorgezogen"} auf ${fmtDate(h.net)} (${fmtShift(new Date(h.net)-new Date(h.prev))})`;
  toast(msg); notify(msg,"lr-shift-"+l.id);
}
