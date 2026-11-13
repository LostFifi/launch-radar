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
  let st; try{ st=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:5,displaySurface:"browser"},audio:false,preferCurrentTab:true,selfBrowserSurface:"include",surfaceSwitching:"exclude"}); }
  catch(e){ toast("Teilen abgebrochen"); return; }
  teleBegin(st,true);
}
// Bereich im geteilten Tab aus der Lage des Mini-Fensters berechnen (s = Ausschnitt im Video, z.B. TPRESET.s1)
function autoRegion(s){ const f=document.getElementById("pipFrame"); if(!f) return null; const r=f.getBoundingClientRect();
  return [(r.left+s[0]*r.width)/innerWidth,(r.top+s[1]*r.height)/innerHeight,s[2]*r.width/innerWidth,s[3]*r.height/innerHeight]; }
