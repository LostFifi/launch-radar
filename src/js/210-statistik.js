// ===================== Statistik =====================
function bars(arr){ const mx=Math.max(...arr.map(x=>x[1]));
  return `<div class="bars">`+arr.map(([k,v])=>`<span>${esc(k)}</span><div class="tr" title="${esc(k)}: ${v} Starts"><div class="f" style="width:${(v/mx*100).toFixed(1)}%;${k==="Andere"?"background:#4a5878":""}"></div></div><span class="v">${v}</span>`).join("")+`</div>`; }
function openStats(){
  clearSat(); stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null;
  const S=STATS, P=document.getElementById("panel"); P.classList.remove("wide");
  const ok=S.status.Success||0, part=S.status["Partial Failure"]||0, fail=S.status.Failure||0;
  const sxp=(S.prov.find(x=>/spacex/i.test(x[0]))||[0,0])[1];
  const MN=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"], mmax=Math.max(...S.month), cm=11-(S.month.slice().reverse().findIndex(v=>v>0));
  const upY=launches.filter(l=>new Date(l.net).getFullYear()===S.year && new Date(l.net)>Date.now()).length;
  P.innerHTML=`<div class="hd"><h2>Raumfahrt-Statistik ${S.year}</h2><button class="x" onclick="closeP()">×</button></div>
   <div class="sec"><div class="tiles">
     <div class="tile"><div class="big">${S.total}</div><small>Orbitale Starts bisher</small></div>
     <div class="tile"><div class="big">${(ok/(ok+fail+part)*100).toFixed(1)}%</div><small>Erfolgsquote</small></div>
     <div class="tile"><div class="big">${fail+part}</div><small>Fehlstarts${part?` (davon ${part} teilweise)`:""}</small></div>
     <div class="tile"><div class="big">${Math.round(sxp/S.total*100)}%</div><small>Anteil SpaceX (${sxp})</small></div>
   </div>${upY?`<div class="note">Dazu ${upY} weitere Starts bis Ende ${S.year} geplant (aus der aktuellen Liste).</div>`:""}</div>
   <div class="sec"><h3>Starts pro Monat</h3><div class="months">${S.month.map((v,i)=>`<div title="${MN[i]}: ${i>cm?"–":v+" Starts"}">${i<=cm?`<span style="color:var(--text)">${v}</span>`:""}<i style="height:${i<=cm?(v/mmax*80).toFixed(0):0}%;${i===cm?"opacity:.55":""}"></i><span>${MN[i]}</span></div>`).join("")}</div>
     <div class="note">Laufender Monat (blasser) noch nicht vollständig.</div></div>
   <div class="sec"><h3>Nach Betreiber</h3>${bars(S.prov)}</div>
   <div class="sec"><h3>Nach Land (Startplatz)</h3>${bars(S.cty)}</div>
   <div class="sec"><h3>Nach Rakete</h3>${bars(S.rock)}</div>
   <div class="sec note">Quelle: The Space Devs (Launch Library 2) · ${esc(standText())}. Gezählt werden orbitale Startversuche ab 1.1.${S.year}.</div>`;
  P.style.display="block"; P.scrollTop=0; }
