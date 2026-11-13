// ===================== Mini-Fenster für den Livestream =====================
// ---------- Fenster verschieben (an der Kopfzeile) und vergrössern (Griff unten rechts) ----------
function pinTopLeft(box){ const r=box.getBoundingClientRect(); Object.assign(box.style,{left:r.left+"px",top:r.top+"px",right:"auto",bottom:"auto"}); }
function makeDraggable(box,handle){
  let s=null;
  handle.style.touchAction="none"; handle.style.cursor="move";
  handle.onpointerdown=e=>{ if(e.target.closest("button,input,label,a")) return; handle.setPointerCapture(e.pointerId); pinTopLeft(box); const r=box.getBoundingClientRect(); s=[e.clientX-r.left,e.clientY-r.top]; document.body.classList.add("resizing"); };
  handle.onpointermove=e=>{ if(!s) return; box.style.left=Math.max(0,Math.min(innerWidth-80,e.clientX-s[0]))+"px"; box.style.top=Math.max(0,Math.min(innerHeight-40,e.clientY-s[1]))+"px"; };
  handle.onpointerup=handle.onpointercancel=()=>{ s=null; document.body.classList.remove("resizing"); };
}
function addGrip(box,o={}){
  box.querySelector(":scope > .grip")?.remove();
  const g=document.createElement("div"); g.className="grip"; g.title="Grösse ändern"; box.appendChild(g); let s=null;
  g.onpointerdown=e=>{ e.preventDefault(); e.stopPropagation(); g.setPointerCapture(e.pointerId); pinTopLeft(box); const r=box.getBoundingClientRect(); s={x:e.clientX,y:e.clientY,w:r.width,h:r.height}; document.body.classList.add("resizing"); };
  g.onpointermove=e=>{ if(!s) return; const r=box.getBoundingClientRect();
    box.style.width=Math.max(o.minW||240,Math.min(innerWidth-r.left-4,s.w+e.clientX-s.x))+"px"; box.style.maxWidth="none";
    if(o.h){ box.style.height=Math.max(o.minH||140,Math.min(innerHeight-r.top-4,s.h+e.clientY-s.y))+"px"; box.style.maxHeight="none"; }
    o.onResize&&o.onResize(); };
  g.onpointerup=g.onpointercancel=()=>{ s=null; document.body.classList.remove("resizing"); o.onResize&&o.onResize(); };
}
// Telemetrie-Fenster: Inhalt scrollt innen, Fenster verschieb- und vergrösserbar
function teleChrome(B){
  if(!B.querySelector(":scope > .tin")){ const w=document.createElement("div"); w.className="tin"; while(B.firstChild) w.appendChild(B.firstChild); B.appendChild(w); }
  const hd=B.querySelector(".thd"); if(hd) makeDraggable(B,hd);
  addGrip(B,{h:true,minW:280,minH:160,onResize:()=>{ if(typeof teleUI==="function") teleUI(); }});
}
var PIP={yt:null,big:false};
function openPip(yt,title){
  const W=document.getElementById("pip"); PIP.yt=yt;
  W.innerHTML=`<div class="pbar"><b>${esc(title||"Livestream")}</b>
     <button class="chip" id="pTele" title="Telemetrie automatisch aus diesem Fenster lesen">Telemetrie</button>
     <button class="pb" id="pSize" title="Grösse">⤢</button><button class="pb" onclick="closePip()" title="Schliessen">×</button></div>
   <div class="pv"><iframe id="pipFrame" referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  W.style.display="block"; W.classList.toggle("big",PIP.big);
  addGrip(W,{minW:240});   // Stream stufenlos vergrössern (Höhe folgt dem 16:9-Format)
  document.getElementById("pSize").onclick=()=>{ PIP.big=!PIP.big; W.style.width=""; W.classList.toggle("big",PIP.big); };
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
