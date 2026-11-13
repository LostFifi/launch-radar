// ===================== Info-Fenster einklappen (v.a. Handy) =====================
const ICO_MIN='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const ICO_PLAY='<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>';
const ICO_PAUSE='<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
const PNL=document.getElementById("panel");
function setMin(on){ PNL.classList.toggle("min",on); if(!on) PNL.scrollTop=0; syncMini();
  if(G.on) return; setTimeout(()=>map.invalidateSize(),50); }
function decoratePanel(){
  if(PNL.querySelector(".grab")) return;               // schon dekoriert
  const hd=PNL.querySelector(".hd"); if(!hd) return;
  PNL.insertAdjacentHTML("afterbegin",'<div class="grab" title="Ein-/ausklappen"><i></i></div>');
  const x=hd.querySelector(".x"); if(x) x.insertAdjacentHTML("beforebegin",`<button class="minbtn" title="Ein-/ausklappen">${ICO_MIN}</button>`);
  hd.insertAdjacentHTML("afterend",`<div class="mini"><button class="chip" id="mPlay">${ICO_PLAY}</button><b id="mT"></b><span class="mute" id="mInfo"></span></div>`);
  PNL.querySelector(".grab").onclick=()=>setMin(!PNL.classList.contains("min"));
  PNL.querySelector(".minbtn").onclick=e=>{ e.stopPropagation(); setMin(!PNL.classList.contains("min")); };
  hd.querySelector("h2").onclick=()=>{ if(PNL.classList.contains("min")) setMin(false); };
  document.getElementById("mPlay").onclick=()=>{ const b=document.getElementById("play"); if(b) b.click(); syncMini(); };
  // Wischen: nach unten = einklappen, nach oben = ausklappen
  let y0=null; const zone=[PNL.querySelector(".grab"),hd];
  zone.forEach(z=>{ z.addEventListener("touchstart",e=>{ y0=e.touches[0].clientY; },{passive:true});
    z.addEventListener("touchend",e=>{ if(y0==null) return; const dy=e.changedTouches[0].clientY-y0; y0=null;
      if(dy>35) setMin(true); else if(dy<-35) setMin(false); }); });
  syncMini();
}
function syncMini(){ const m=PNL.querySelector(".mini"); if(!m) return;
  const has=!!(selected && curTrack && document.getElementById("sim")); m.classList.toggle("on",has); if(!has) return;
  const tl=document.getElementById("tlab"), pl=document.getElementById("plab");
  document.getElementById("mT").textContent=tl?tl.textContent:"";
  document.getElementById("mInfo").textContent=pl?pl.textContent.replace(/^·\s*/,""):"";
  document.getElementById("mPlay").innerHTML=simTimer?ICO_PAUSE:ICO_PLAY; }
new MutationObserver(()=>decoratePanel()).observe(PNL,{childList:true});
// Beim Simulieren auf dem Handy automatisch einklappen, damit die Karte frei ist
PNL.addEventListener("click",e=>{ const t=e.target.closest("#play,#jumpDep"); if(t && innerWidth<800) setTimeout(()=>{ if(simTimer) setMin(true); },60); },true);
setInterval(()=>{ if(PNL.classList.contains("min")) syncMini(); },250);
