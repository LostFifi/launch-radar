// ===================== Satelliten-Knopf in der Kopfzeile =====================
// Macht ISS, Raumstationen und Satelliten-Ebenen direkt sichtbar (früher nur im Ebenen-Menü versteckt).
// Gleiche Schalter wie im Ebenen-Menü (LAYERS), gleiche Ladefunktion (loadSats).
async function satShow(k,on){
  LAYERS[k]=on; try{ localStorage.setItem("lr_layers",JSON.stringify(LAYERS)); }catch(e){}
  if(on) await loadSats(k); else if(selSat&&selSat.g===k) closeP();
  propAll(true);
}
async function followStation(re){
  satMenuClose();
  if(!LAYERS.stations) await satShow("stations",true); else await loadSats("stations");
  const s=(SATS.stations||[]).find(x=>re.test(x.name));
  if(!s){ toast(i18n("Bahndaten nicht verfügbar")); return; }
  if(!s.ok) propOne(s,simNow(),satellite.gstime(simNow()));
  selectSat(s,"stations");
}
function satMenuBuild(){
  const row=k=>`<label class="gmr"><input type="checkbox" data-s="${k}" ${LAYERS[k]?"checked":""}><span class="dot" style="background:${SAT_SRC[k].color}"></span><span>${SAT_SRC[k].label}</span>${SATS[k]?.length?`<small>${SATS[k].length.toLocaleString(LOC)}</small>`:""}</label>`;
  const m=document.getElementById("satMenu");
  m.innerHTML=`<div class="gmh"><b>Satelliten &amp; ISS</b></div>
    <button class="gma" onclick="followStation(/ISS \\(ZARYA\\)/)">${ICON.sat}<span>ISS jetzt verfolgen</span></button>
    <button class="gma" onclick="followStation(/TIANHE/)">${ICON.sat}<span>Tiangong jetzt verfolgen</span></button>
    <button class="gma" onclick="satMenuClose();openPasses()">${ICON.eye}<span>ISS-Überflüge bei mir</span></button>
    <div class="gms">Auf der Karte zeigen</div>
    ${Object.keys(SAT_SRC).map(row).join("")}
    <div class="gmf">Live berechnet aus Bahndaten (CelesTrak). Antippen eines Punkts auf der Karte zeigt Details.</div>`;
  m.querySelectorAll("input").forEach(i=>i.onchange=async()=>{ await satShow(i.dataset.s,i.checked); satMenuBuild(); });
}
function satMenuClose(){ document.getElementById("satMenu").style.display="none"; document.getElementById("satBtn").setAttribute("aria-expanded","false"); }
function satMenuOpen(anchor){
  const m=document.getElementById("satMenu"), b=anchor||document.getElementById("satBtn");
  satMenuBuild(); const r=b.getBoundingClientRect(); m.style.left=Math.max(8,Math.min(r.left,innerWidth-288))+"px"; m.style.top=(r.bottom+6)+"px";
  m.style.display="block"; document.getElementById("satBtn").setAttribute("aria-expanded","true");
}
document.getElementById("satBtn").onclick=e=>{ e.stopPropagation(); if(document.getElementById("satMenu").style.display==="block") return satMenuClose(); satMenuOpen(); };
document.addEventListener("click",e=>{ if(!e.target.closest("#satMenu,#satBtn,#heroSat")) satMenuClose(); });
