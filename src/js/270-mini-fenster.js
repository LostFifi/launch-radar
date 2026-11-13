// ===================== Mini-Fenster für den Livestream =====================
var PIP={yt:null,big:false};
function openPip(yt,title){
  const W=document.getElementById("pip"); PIP.yt=yt;
  W.innerHTML=`<div class="pbar"><b>${esc(title||"Livestream")}</b>
     <button class="chip" id="pTele" title="Telemetrie automatisch aus diesem Fenster lesen">Telemetrie</button>
     <button class="pb" id="pSize" title="Grösse">⤢</button><button class="pb" onclick="closePip()" title="Schliessen">×</button></div>
   <div class="pv"><iframe id="pipFrame" referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  W.style.display="block"; W.classList.toggle("big",PIP.big);
  document.getElementById("pSize").onclick=()=>{ PIP.big=!PIP.big; W.classList.toggle("big",PIP.big); };
  document.getElementById("pTele").onclick=()=>teleAuto();
  // verschieben
  const bar=W.querySelector(".pbar"); let s=null;
  bar.onpointerdown=e=>{ if(e.target.closest("button")) return; bar.setPointerCapture(e.pointerId); const r=W.getBoundingClientRect(); s=[e.clientX-r.left,e.clientY-r.top]; };
  bar.onpointermove=e=>{ if(!s) return; W.style.left=Math.max(0,Math.min(innerWidth-80,e.clientX-s[0]))+"px"; W.style.top=Math.max(0,Math.min(innerHeight-40,e.clientY-s[1]))+"px"; W.style.right="auto"; W.style.bottom="auto"; };
  bar.onpointerup=()=>{ s=null; };
}
function closePip(){ const W=document.getElementById("pip"); W.style.display="none"; W.innerHTML=""; PIP.yt=null; if(TELE.auto) teleStop(); }
// Telemetrie mit einem Klick: diesen Tab teilen, Bereich = Mini-Fenster (unten rechts = Stufe 2)
async function teleAuto(){
  if(!navigator.mediaDevices?.getDisplayMedia){ toast("Geht nur in Chrome oder Edge am Computer"); return; }
  if(TELE.on) teleStop();
  try{ TELE.stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:5,displaySurface:"browser"},audio:false,preferCurrentTab:true,selfBrowserSurface:"include",surfaceSwitching:"exclude"}); }
  catch(e){ toast("Teilen abgebrochen"); return; }
  const v=document.createElement("video"); v.muted=true; v.playsInline=true; v.srcObject=TELE.stream; await v.play().catch(()=>{}); TELE.video=v;
  TELE.stream.getVideoTracks()[0].onended=teleStop;
  TELE.on=true; TELE.auto=true; TELE.sub=TPRESET.s2; TELE.d=null; TELE.last=null; TELE.hist=[]; TELE.ok=0; TELE.bad=0;
  document.getElementById("tele").style.display="block"; buildTeleBox();
  document.querySelectorAll("#tele [data-tp]").forEach(b=>b.onclick=()=>{ TELE.sub=TPRESET[b.dataset.tp]; TELE.last=null; });
  document.getElementById("tStat").textContent="Texterkennung wird geladen …";
  try{ if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    TELE.worker=await Tesseract.createWorker("eng"); await TELE.worker.setParameters({tessedit_char_whitelist:"0123456789KMHSPEDALTU/ ",tessedit_pageseg_mode:"6"}); }
  catch(e){ toast("Texterkennung konnte nicht geladen werden"); return teleStop(); }
  TELE.timer=setInterval(teleTick,1000); teleTick();
}
// Bereich im geteilten Tab aus der Lage des Mini-Fensters berechnen
function autoRegion(){ const f=document.getElementById("pipFrame"); if(!f) return null; const r=f.getBoundingClientRect(), s=TELE.sub||TPRESET.s2;
  return [(r.left+s[0]*r.width)/innerWidth,(r.top+s[1]*r.height)/innerHeight,s[2]*r.width/innerWidth,s[3]*r.height/innerHeight]; }
