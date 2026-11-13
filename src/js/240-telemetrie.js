// ===================== Echte Telemetrie aus dem Livestream (Texterkennung) =====================
var TELE={on:false,d:null,v:null,h:null,last:null,hist:[],region:null,worker:null,busy:false,timer:null,stream:null,video:null,ok:0,bad:0,vh:0};
const TPRESET={s2:[0.64,0.78,0.35,0.21],s1:[0.01,0.78,0.35,0.21]};
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function openTele(){
  const B=document.getElementById("tele"); B.style.display="block";
  if(TELE.on) return teleUI();
  B.innerHTML=`<div class="thd"><b>Echte Telemetrie</b><button class="x" onclick="teleStop()">×</button></div>
   <ol class="tsteps"><li>Öffne den Livestream (YouTube oder X) in einem <b>anderen Tab</b> und lass ihn laufen.</li>
     <li>Tippe unten auf „Stream-Tab teilen“ und wähle diesen Tab aus.</li>
     <li>Ziehe in der Vorschau einen Rahmen um die Anzeige mit Geschwindigkeit und Höhe.</li></ol>
   <button class="btn" onclick="teleStart()">Stream-Tab teilen</button>
   ${PIP.yt?`<button class="btn sec2" onclick="teleAuto()">Mini-Fenster verwenden (1 Klick)</button>`:""}
   <div class="note"><b>Einfacher:</b> Stream im Mini-Fenster abspielen und dort „Telemetrie“ drücken – dann nur noch „Diesen Tab teilen“ bestätigen.</div>
   <div class="note">Funktioniert in Chrome oder Edge am Computer (Bildschirm teilen gibt es auf dem Handy nicht). Die Werte werden lokal per Texterkennung gelesen, nichts wird hochgeladen.</div>`;
}
async function teleStart(){
  if(!navigator.mediaDevices?.getDisplayMedia){ toast("Bildschirm teilen geht hier nicht – Datei in Chrome oder Edge am Computer öffnen"); return; }
  try{ TELE.stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:5},audio:false}); }catch(e){ toast("Teilen abgebrochen"); return; }
  const v=document.createElement("video"); v.muted=true; v.playsInline=true; v.srcObject=TELE.stream; await v.play().catch(()=>{}); TELE.video=v;
  TELE.stream.getVideoTracks()[0].onended=teleStop;
  TELE.on=true; TELE.d=null; TELE.last=null; TELE.hist=[]; TELE.ok=0; TELE.bad=0; TELE.region=TELE.region||TPRESET.s2;
  buildTeleBox(); document.getElementById("tStat").textContent="Texterkennung wird geladen …";
  try{
    if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    TELE.worker=await Tesseract.createWorker("eng");
    await TELE.worker.setParameters({tessedit_char_whitelist:"0123456789KMHSPEDALTU/ ",tessedit_pageseg_mode:"6"});
  }catch(e){ toast("Texterkennung konnte nicht geladen werden (Internet nötig)"); return teleStop(); }
  TELE.timer=setInterval(teleTick,1000); teleTick();
}
function buildTeleBox(){
  const B=document.getElementById("tele");
  B.innerHTML=`<div class="thd"><b>Echte Telemetrie</b> <span class="pill" id="tBadge" style="background:#33384a;color:#aab">wartet</span><button class="x" onclick="teleStop()">×</button></div>
   <div class="tbig"><div><small>Geschwindigkeit</small><b id="tV">–</b></div><div><small>Höhe</small><b id="tH">–</b></div><div><small>Bodendistanz</small><b id="tD">–</b></div></div>
   <canvas id="tSpark" width="320" height="54"></canvas>
   <canvas id="tPrev" width="320" height="180" title="Rahmen ziehen"></canvas>
   <div class="tbtns"><button class="chip" data-tp="s1">Stufe 1 (links unten)</button><button class="chip" data-tp="s2">Stufe 2 (rechts unten)</button></div>
   <div class="note" id="tStat"></div>`;
  B.querySelectorAll("[data-tp]").forEach(b=>b.onclick=()=>{ TELE.region=TPRESET[b.dataset.tp]; TELE.last=null; drawTelePrev(); });
  const cv=document.getElementById("tPrev"); let st=null;
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]; };
  cv.onpointerdown=e=>{ cv.setPointerCapture(e.pointerId); st=pos(e); };
  cv.onpointermove=e=>{ if(!st) return; const q=pos(e); TELE.region=[Math.min(st[0],q[0]),Math.min(st[1],q[1]),Math.max(.03,Math.abs(q[0]-st[0])),Math.max(.03,Math.abs(q[1]-st[1]))]; drawTelePrev(); };
  cv.onpointerup=()=>{ st=null; TELE.last=null; };
}
function drawTelePrev(){
  const cv=document.getElementById("tPrev"), v=TELE.video; if(!cv||!v||!v.videoWidth) return;
  cv.height=Math.round(cv.width*v.videoHeight/v.videoWidth);
  const c=cv.getContext("2d"); c.drawImage(v,0,0,cv.width,cv.height);
  const [x,y,w,hh]=TELE.region; c.fillStyle="rgba(0,0,0,.45)";
  c.fillRect(0,0,cv.width,y*cv.height); c.fillRect(0,(y+hh)*cv.height,cv.width,cv.height); c.fillRect(0,y*cv.height,x*cv.width,hh*cv.height); c.fillRect((x+w)*cv.width,y*cv.height,cv.width,hh*cv.height);
  c.strokeStyle="#4ea1ff"; c.lineWidth=2; c.strokeRect(x*cv.width,y*cv.height,w*cv.width,hh*cv.height); }
async function teleTick(){
  if(!TELE.on||TELE.busy||!TELE.worker||!TELE.video?.videoWidth) return; TELE.busy=true;
  try{
    if(TELE.auto){ const ar=autoRegion(); if(!ar){ TELE.busy=false; return; } TELE.region=ar; }
    const v=TELE.video, W=v.videoWidth, H=v.videoHeight, [rx,ry,rw,rh]=TELE.region;
    const sc=Math.max(1,900/(rw*W)), c=document.createElement("canvas"); c.width=Math.round(rw*W*sc); c.height=Math.round(rh*H*sc);
    const x=c.getContext("2d"); x.drawImage(v,rx*W,ry*H,rw*W,rh*H,0,0,c.width,c.height);
    const im=x.getImageData(0,0,c.width,c.height), p=im.data;          // helle Schrift -> schwarz auf weiss
    for(let i=0;i<p.length;i+=4){ const g=.3*p[i]+.59*p[i+1]+.11*p[i+2], o=g>140?0:255; p[i]=p[i+1]=p[i+2]=o; }
    x.putImageData(im,0,0); drawTelePrev();
    const r=await TELE.worker.recognize(c); teleParse(r.data.text);
  }catch(e){ console.warn(e); }
  TELE.busy=false;
}
function teleParse(text){
  const t=text.toUpperCase().replace(/[^0-9A-Z\n ]/g," ");
  let sp=null, al=null;
  const ms=t.match(/SPEED[^0-9\n]*([0-9][0-9 ]{0,7}[0-9]|[0-9])/), ma=t.match(/ALT[A-Z]*[^0-9\n]*([0-9][0-9 ]{0,5}[0-9]|[0-9])/);
  if(ms) sp=+ms[1].replace(/ /g,""); if(ma) al=+ma[1].replace(/ /g,"");
  if(sp==null||al==null){ const n=(t.replace(/(\d) (\d{3})\b/g,"$1$2").match(/\d{1,6}/g)||[]).map(Number); if(n.length>=2){ if(sp==null) sp=n[0]; if(al==null) al=n[1]; } }
  const now=Date.now(), L=TELE.last;
  let okv = sp!=null && al!=null && sp<=32000 && al<=3000;
  if(okv && L){ const dt=(now-L.t)/1000; if(Math.abs(sp-L.v)>3000*dt+800 || Math.abs(al-L.h)>20*dt+8) okv=false; }
  if(!okv){ TELE.bad++; return teleUI(text); }
  if(L){ const dt=(now-L.t)/1000, vk=(sp+L.v)/2/3600, dh=(al-L.h)/dt; TELE.vh=Math.sqrt(Math.max(0,vk*vk-dh*dh)); TELE.d=(TELE.d||0)+TELE.vh*dt; }
  else if(TELE.d==null){ const ts=selected?(now-new Date(selected.net))/1000:0; TELE.d=(curTrack&&ts>0)?distAt(ts,curTrack):0; }
  TELE.last={t:now,v:sp,h:al}; TELE.v=sp; TELE.h=al; TELE.ok++;
  TELE.hist.push([now,al,sp]); if(TELE.hist.length>900) TELE.hist.shift();
  teleUI(text);
  if(curTrack && selected){ const s=document.getElementById("sim"), ts=Math.max(0,(now-new Date(selected.net))/1000); if(s) s.value=ts; placeRocket(ts); }
}
function teleDist(){ if(!TELE.on||TELE.d==null||!TELE.last) return null; return TELE.d+TELE.vh*Math.min(3,(Date.now()-TELE.last.t)/1000); }
function teleUI(raw){
  const B=document.getElementById("tele"); if(!B||!document.getElementById("tV")) return;
  const fresh=TELE.last && Date.now()-TELE.last.t<4000, badge=document.getElementById("tBadge");
  badge.textContent=fresh?"● gemessen":"keine Werte"; badge.style.background=fresh?"#1f4d33":"#4d3a1f"; badge.style.color=fresh?"#7be07b":"#f5b041";
  document.getElementById("tV").textContent=TELE.v!=null?TELE.v.toLocaleString("de-CH")+" km/h":"–";
  document.getElementById("tH").textContent=TELE.h!=null?TELE.h.toLocaleString("de-CH")+" km":"–";
  document.getElementById("tD").textContent=TELE.d!=null?Math.round(TELE.d).toLocaleString("de-CH")+" km":"–";
  document.getElementById("tStat").textContent=`Gelesen: ${TELE.ok} · verworfen: ${TELE.bad}${raw?` · zuletzt erkannt: „${raw.replace(/\s+/g," ").trim().slice(0,40)}“`:""}`;
  const sp=document.getElementById("tSpark"), c=sp.getContext("2d"); c.clearRect(0,0,sp.width,sp.height);
  const hs=TELE.hist.slice(-300); if(hs.length>1){ const mx=Math.max(...hs.map(q=>q[1]),1), t0=hs[0][0], t1=hs[hs.length-1][0]||t0+1;
    c.beginPath(); hs.forEach((q,i)=>{ const X=(q[0]-t0)/Math.max(1,t1-t0)*(sp.width-4)+2, Y=sp.height-4-(q[1]/mx)*(sp.height-14); i?c.lineTo(X,Y):c.moveTo(X,Y); });
    c.strokeStyle="#4ea1ff"; c.lineWidth=2; c.stroke(); c.fillStyle="#8a96ad"; c.font="10px sans-serif"; c.fillText("Höhe-Verlauf (max "+mx+" km)",4,11); }
}
function teleStop(){
  if(TELE.timer) clearInterval(TELE.timer); TELE.timer=null;
  try{ TELE.stream?.getTracks().forEach(t=>t.stop()); }catch(e){}
  try{ TELE.worker?.terminate(); }catch(e){} TELE.worker=null;
  TELE.on=false; TELE.auto=false; TELE.d=null; TELE.last=null; document.getElementById("tele").style.display="none";
  const s=document.getElementById("sim"); if(s&&curTrack) placeRocket(+s.value);
}
document.addEventListener("click",e=>{ if(e.target.closest("#teleBtn")) openTele(); });
