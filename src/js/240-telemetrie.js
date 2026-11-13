// ===================== Echte Telemetrie aus dem Livestream (Texterkennung) =====================
// Liest Stufe 1 und Stufe 2 gleichzeitig (je ein Bildbereich). Stufe 2 bewegt die Rakete auf der Karte.
// TELE.v / TELE.h / teleDist() = Stufe 2 (werden in der Routen-Anzeige verwendet).
function teleStage(){ return {region:null,last:null,v:null,h:null,hist:[],ok:0,bad:0,raw:""}; }
var TELE={on:false,auto:false,stream:null,video:null,worker:null,busy:false,timer:null,use1:true,edit:"s2",t0:null,
  d:null,vh:0,v:null,h:null,S:{s1:teleStage(),s2:teleStage()}};
const TPRESET={s2:[0.64,0.78,0.35,0.21],s1:[0.01,0.78,0.35,0.21]};
const TLIM={s1:{v:12000,h:300},s2:{v:32000,h:3000}};          // Plausibilitätsgrenzen je Stufe
const TCOL={s1:"#f5a142",s2:"#4ea1ff"}, TLAB={s1:"Stufe 1",s2:"Stufe 2"};
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function openTele(){
  const B=document.getElementById("tele"); B.style.display="block";
  if(TELE.on) return teleUI();
  B.innerHTML=`<div class="thd"><b>Echte Telemetrie</b><button class="x" onclick="teleStop()">×</button></div>
   <ol class="tsteps"><li>Öffne den Livestream (YouTube oder X) in einem <b>anderen Tab</b> und lass ihn laufen.</li>
     <li>Tippe unten auf „Stream-Tab teilen“ und wähle diesen Tab aus.</li>
     <li>Ziehe in der Vorschau je einen Rahmen um die Anzeige von Stufe 1 und Stufe 2 (Geschwindigkeit + Höhe).</li></ol>
   <button class="btn" onclick="teleStart()">Stream-Tab teilen</button>
   ${PIP.yt?`<button class="btn sec2" onclick="teleAuto()">Mini-Fenster verwenden (1 Klick)</button>`:""}
   <div class="note"><b>Einfacher:</b> Stream im Mini-Fenster abspielen und dort „Telemetrie“ drücken – dann nur noch „Diesen Tab teilen“ bestätigen.</div>
   <div class="note">Funktioniert in Chrome oder Edge am Computer (Bildschirm teilen gibt es auf dem Handy nicht). Die Werte werden lokal per Texterkennung gelesen, nichts wird hochgeladen.</div>`;
}
async function teleStart(){
  if(!navigator.mediaDevices?.getDisplayMedia){ toast("Bildschirm teilen geht hier nicht – Datei in Chrome oder Edge am Computer öffnen"); return; }
  let st; try{ st=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:5},audio:false}); }catch(e){ toast("Teilen abgebrochen"); return; }
  teleBegin(st,false);
}
// Gemeinsamer Start für manuell (anderer Tab) und automatisch (Mini-Fenster in diesem Tab)
async function teleBegin(stream,auto){
  if(TELE.on) teleStop();
  TELE.stream=stream; const v=document.createElement("video"); v.muted=true; v.playsInline=true; v.srcObject=stream; await v.play().catch(()=>{}); TELE.video=v;
  stream.getVideoTracks()[0].onended=teleEnd;
  const keep={s1:TELE.S.s1.region,s2:TELE.S.s2.region};
  Object.assign(TELE,{on:true,auto,d:null,vh:0,v:null,h:null,t0:null,S:{s1:teleStage(),s2:teleStage()}});
  TELE.S.s1.region=auto?null:keep.s1||TPRESET.s1; TELE.S.s2.region=auto?null:keep.s2||TPRESET.s2;
  document.getElementById("tele").style.display="block"; buildTeleBox(); document.getElementById("tStat").textContent="Texterkennung wird geladen …";
  try{
    if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    TELE.worker=await Tesseract.createWorker("eng");
    await TELE.worker.setParameters({tessedit_char_whitelist:"0123456789KMHSPEDALTU/ ",tessedit_pageseg_mode:"6"});
  }catch(e){ toast("Texterkennung konnte nicht geladen werden (Internet nötig)"); return teleStop(); }
  TELE.timer=setInterval(teleTick,1000); teleTick();
}
function buildTeleBox(){
  const B=document.getElementById("tele");
  const big=k=>`<div class="tst" style="--c:${TCOL[k]}"><div class="tsh"><i></i>${TLAB[k]} <span class="pill" id="tB_${k}">wartet</span></div>
     <div class="tbig"><div><small>Tempo</small><b id="tV_${k}">–</b></div><div><small>Höhe</small><b id="tH_${k}">–</b></div>${k==="s2"?`<div><small>Bodendistanz</small><b id="tD">–</b></div>`:`<div><small>Steigrate</small><b id="tR_s1">–</b></div>`}</div></div>`;
  B.innerHTML=`<div class="thd"><b>Echte Telemetrie</b><button class="x" onclick="teleStop()">×</button></div>
   ${big("s2")}${big("s1")}
   <div class="tch"><canvas id="tChH" width="640" height="200"></canvas><canvas id="tChV" width="640" height="200"></canvas></div>
   <canvas id="tPrev" width="320" height="180" title="Rahmen ziehen"></canvas>
   <div class="tbtns">${TELE.auto?"":`<span class="mute" style="font-size:12px;align-self:center">Rahmen für:</span>`}
     <button class="chip" data-te="s1">Stufe 1</button><button class="chip" data-te="s2">Stufe 2</button>
     <label class="chip" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="tUse1" ${TELE.use1?"checked":""} style="margin:0">Stufe 1 lesen</label>
     <button class="chip" onclick="teleCSV()" title="Messwerte als CSV-Datei speichern">CSV</button></div>
   <div class="note" id="tStat"></div>`;
  const mark=()=>B.querySelectorAll("[data-te]").forEach(b=>b.classList.toggle("on",b.dataset.te===TELE.edit));
  B.querySelectorAll("[data-te]").forEach(b=>b.onclick=()=>{ TELE.edit=b.dataset.te; if(!TELE.auto&&!TELE.S[TELE.edit].region) TELE.S[TELE.edit].region=TPRESET[TELE.edit]; mark(); drawTelePrev(); });
  mark();
  document.getElementById("tUse1").onchange=e=>{ TELE.use1=e.target.checked; teleUI(); };
  const cv=document.getElementById("tPrev"); let st=null;
  cv.style.display=TELE.auto?"none":"block";
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]; };
  cv.onpointerdown=e=>{ cv.setPointerCapture(e.pointerId); st=pos(e); };
  cv.onpointermove=e=>{ if(!st) return; const q=pos(e), S=TELE.S[TELE.edit];
    S.region=[Math.min(st[0],q[0]),Math.min(st[1],q[1]),Math.max(.03,Math.abs(q[0]-st[0])),Math.max(.03,Math.abs(q[1]-st[1]))]; drawTelePrev(); };
  cv.onpointerup=()=>{ st=null; TELE.S[TELE.edit].last=null; };
}
function teleRegion(k){ return TELE.auto?autoRegion(TPRESET[k]):TELE.S[k].region; }
function drawTelePrev(){
  const cv=document.getElementById("tPrev"), v=TELE.video; if(!cv||!v||!v.videoWidth||TELE.auto) return;
  cv.height=Math.round(cv.width*v.videoHeight/v.videoWidth);
  const c=cv.getContext("2d"); c.drawImage(v,0,0,cv.width,cv.height);
  for(const k of ["s1","s2"]){ const r=TELE.S[k].region; if(!r||(k==="s1"&&!TELE.use1)) continue; const [x,y,w,hh]=r;
    c.strokeStyle=TCOL[k]; c.lineWidth=k===TELE.edit?3:1.5; c.setLineDash(k===TELE.edit?[]:[4,3]); c.strokeRect(x*cv.width,y*cv.height,w*cv.width,hh*cv.height);
    c.setLineDash([]); c.fillStyle=TCOL[k]; c.font="bold 11px sans-serif"; c.fillText(k==="s1"?"1":"2",x*cv.width+4,y*cv.height+12); } }
async function teleOCR(region){
  const v=TELE.video, W=v.videoWidth, H=v.videoHeight, [rx,ry,rw,rh]=region;
  const sc=Math.max(1,900/(rw*W)), c=document.createElement("canvas"); c.width=Math.round(rw*W*sc); c.height=Math.round(rh*H*sc);
  const x=c.getContext("2d"); x.drawImage(v,rx*W,ry*H,rw*W,rh*H,0,0,c.width,c.height);
  const im=x.getImageData(0,0,c.width,c.height), p=im.data;          // helle Schrift -> schwarz auf weiss
  for(let i=0;i<p.length;i+=4){ const g=.3*p[i]+.59*p[i+1]+.11*p[i+2], o=g>140?0:255; p[i]=p[i+1]=p[i+2]=o; }
  x.putImageData(im,0,0);
  return (await TELE.worker.recognize(c)).data.text;
}
async function teleTick(){
  if(!TELE.on||TELE.busy||!TELE.worker||!TELE.video?.videoWidth) return; TELE.busy=true;
  try{
    drawTelePrev();
    for(const k of TELE.use1?["s2","s1"]:["s2"]){ const r=teleRegion(k); if(!r) continue; teleParse(k,await teleOCR(r)); }
    teleUI();
  }catch(e){ console.warn(e); }
  TELE.busy=false;
}
function teleParse(k,text){
  const S=TELE.S[k], lim=TLIM[k], t=text.toUpperCase().replace(/[^0-9A-Z\n ]/g," ");
  S.raw=text.replace(/\s+/g," ").trim().slice(0,40);
  let sp=null, al=null;
  const ms=t.match(/SPEED[^0-9\n]*([0-9][0-9 ]{0,7}[0-9]|[0-9])/), ma=t.match(/ALT[A-Z]*[^0-9\n]*([0-9][0-9 ]{0,5}[0-9]|[0-9])/);
  if(ms) sp=+ms[1].replace(/ /g,""); if(ma) al=+ma[1].replace(/ /g,"");
  if(sp==null||al==null){ const n=(t.replace(/(\d) (\d{3})\b/g,"$1$2").match(/\d{1,6}/g)||[]).map(Number); if(n.length>=2){ if(sp==null) sp=n[0]; if(al==null) al=n[1]; } }
  const now=Date.now(), L=S.last;
  let okv = sp!=null && al!=null && sp<=lim.v && al<=lim.h;
  if(okv && L){ const dt=(now-L.t)/1000; if(Math.abs(sp-L.v)>3000*dt+800 || Math.abs(al-L.h)>20*dt+8) okv=false; }
  if(!okv){ S.bad++; return; }
  if(k==="s2"){
    if(L){ const dt=(now-L.t)/1000, vk=(sp+L.v)/2/3600, dh=(al-L.h)/dt; TELE.vh=Math.sqrt(Math.max(0,vk*vk-dh*dh)); TELE.d=(TELE.d||0)+TELE.vh*dt; }
    else if(TELE.d==null){ const ts=selected?(now-new Date(selected.net))/1000:0; TELE.d=(curTrack&&ts>0)?distAt(ts,curTrack):0; }
    TELE.v=sp; TELE.h=al;
  }
  S.rate=L?(al-L.h)/((now-L.t)/1000):null;
  S.last={t:now,v:sp,h:al}; S.v=sp; S.h=al; S.ok++;
  S.hist.push([teleT(now),al,sp]); if(S.hist.length>1800) S.hist.shift();
  if(k==="s2" && curTrack && selected){ const s=document.getElementById("sim"), ts=Math.max(0,(now-new Date(selected.net))/1000); if(s) s.value=ts; placeRocket(ts); }
}
// Zeitachse: T+ Sekunden ab Startzeit (falls ein Start gewählt und schon gestartet), sonst Sekunden seit Messbeginn
function teleT(now){
  if(selected){ const ts=(now-new Date(selected.net))/1000; if(ts>-120 && ts<4*3600) return ts; }
  if(TELE.t0==null) TELE.t0=now; return (now-TELE.t0)/1000;
}
function teleDist(){ if(!TELE.on||TELE.d==null||!TELE.S.s2.last) return null; return TELE.d+TELE.vh*Math.min(3,(Date.now()-TELE.S.s2.last.t)/1000); }
function teleUI(){
  if(!document.getElementById("tV_s2")) return;
  for(const k of ["s1","s2"]){ const S=TELE.S[k], fresh=S.last&&Date.now()-S.last.t<4000, b=document.getElementById("tB_"+k), off=k==="s1"&&!TELE.use1;
    b.textContent=off?"aus":fresh?"● gemessen":"keine Werte"; b.style.background=off?"#33384a":fresh?"#1f4d33":"#4d3a1f"; b.style.color=off?"#aab":fresh?"#7be07b":"#f5b041";
    document.getElementById("tV_"+k).textContent=S.v!=null?S.v.toLocaleString("de-CH")+" km/h":"–";
    document.getElementById("tH_"+k).textContent=S.h!=null?S.h.toLocaleString("de-CH")+" km":"–"; }
  document.getElementById("tD").textContent=TELE.d!=null?Math.round(TELE.d).toLocaleString("de-CH")+" km":"–";
  const r=TELE.S.s1.rate; document.getElementById("tR_s1").textContent=r!=null&&TELE.use1?(r>=0?"+":"")+r.toFixed(1)+" km/s":"–";
  const st=k=>`${TLAB[k]}: ${TELE.S[k].ok} gelesen, ${TELE.S[k].bad} verworfen${TELE.S[k].raw?` („${TELE.S[k].raw}“)`:""}`;
  document.getElementById("tStat").textContent=st("s2")+(TELE.use1?" · "+st("s1"):"");
  teleChart("tChH",1,"Höhe","km"); teleChart("tChV",2,"Tempo","km/h");
}
// Liniendiagramm über T+ für beide Stufen
function teleChart(id,col,title,unit){
  const cv=document.getElementById(id); if(!cv||!cv.clientWidth) return; const c=cv.getContext("2d"), r=devicePixelRatio||1;
  const W=cv.clientWidth, H=Math.round(W*5/16); if(cv.width!==Math.round(W*r)){ cv.width=Math.round(W*r); cv.height=Math.round(H*r); }
  c.setTransform(r,0,0,r,0,0); c.fillStyle="#0f1525"; c.fillRect(0,0,W,H);
  const ser=["s2","s1"].filter(k=>k==="s2"||TELE.use1).map(k=>({k,h:TELE.S[k].hist})).filter(s=>s.h.length);
  const pad={l:42,r:8,t:16,b:16};
  c.font="11px sans-serif"; c.fillStyle="#8a96ad"; c.textBaseline="alphabetic"; c.textAlign="left"; c.fillText(title+" ("+unit+")",pad.l,11);
  if(!ser.length){ c.fillText("noch keine Messwerte",pad.l,H/2+8); return; }
  const all=ser.flatMap(s=>s.h), t0=Math.min(...all.map(q=>q[0])), t1=Math.max(t0+10,...all.map(q=>q[0]));
  const ymax=niceMax(Math.max(1,...all.map(q=>q[col])));
  const X=t=>pad.l+(t-t0)/(t1-t0)*(W-pad.l-pad.r), Y=v=>H-pad.b-v/ymax*(H-pad.t-pad.b);
  c.strokeStyle="#232c3f"; c.lineWidth=1; c.fillStyle="#8a96ad"; c.font="10px sans-serif"; c.textAlign="right";
  for(let i=0;i<=4;i+=2){ const v=ymax*i/4, y=Y(v); c.beginPath(); c.moveTo(pad.l,y); c.lineTo(W-pad.r,y); c.stroke(); c.fillText(v.toLocaleString("de-CH"),pad.l-4,y+3); }
  c.textAlign="center"; const step=niceMax((t1-t0)/Math.max(2,Math.floor(W/90)));
  for(let t=Math.ceil(t0/step)*step;t<=t1;t+=step) c.fillText((t<0?"T−":"T+")+mmss(Math.abs(t)),X(t),H-3);
  c.textAlign="left";
  // Schätzung aus dem Aufstiegsprofil zum Vergleich (gestrichelt), nur wenn die Zeitachse T+ des gewählten Starts ist
  if(curTrack?.prof && selected && TELE.t0==null){ const P=curTrack.prof; c.save(); c.beginPath(); c.rect(pad.l,pad.t,W-pad.l-pad.r,H-pad.t-pad.b); c.clip();
    c.beginPath(); let first=true; for(let t=Math.max(0,t0);t<=Math.min(t1,profEnd(P));t+=Math.max(1,(t1-t0)/120)){ const q=profAt(P,t), y=Y(col===1?q.h:q.v); first?c.moveTo(X(t),y):c.lineTo(X(t),y); first=false; }
    c.setLineDash([4,4]); c.strokeStyle="#8a96ad"; c.lineWidth=1.5; c.stroke(); c.restore();
    c.fillStyle="#8a96ad"; c.font="10px sans-serif"; c.textAlign="right"; c.fillText("- - Schätzung",W-pad.r,11); c.textAlign="left"; }
  ser.forEach(s=>{ c.beginPath(); s.h.forEach((q,i)=>i?c.lineTo(X(q[0]),Y(q[col])):c.moveTo(X(q[0]),Y(q[col]))); c.strokeStyle=TCOL[s.k]; c.lineWidth=2; c.stroke();
    const q=s.h[s.h.length-1]; c.beginPath(); c.arc(X(q[0]),Y(q[col]),3,0,7); c.fillStyle=TCOL[s.k]; c.fill(); });
}
function niceMax(v){ const p=10**Math.floor(Math.log10(v)), f=v/p; return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p; }
function teleCSV(){
  const rows=[["stufe","t_sekunden","hoehe_km","tempo_kmh"]];
  for(const k of ["s1","s2"]) TELE.S[k].hist.forEach(q=>rows.push([k==="s1"?1:2,q[0].toFixed(1),q[1],q[2]]));
  if(rows.length<2) return toast("Noch keine Messwerte");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(";")).join("\n")],{type:"text/csv"}));
  a.download="telemetrie-"+((selected?.name||"start").split("|").pop().trim().replace(/[^\w-]+/g,"_"))+".csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
// Teilen beendet: Aufnahme stoppen, Diagramme bleiben sichtbar (× schliesst ganz)
function teleEnd(){
  if(TELE.timer) clearInterval(TELE.timer); TELE.timer=null;
  try{ TELE.stream?.getTracks().forEach(t=>t.stop()); }catch(e){}
  try{ TELE.worker?.terminate(); }catch(e){} TELE.worker=null;
  const was=TELE.on; TELE.on=false; TELE.auto=false; TELE.d=null;
  const s=document.getElementById("sim"); if(s&&curTrack) placeRocket(+s.value);
  if(was && document.getElementById("tStat") && (TELE.S.s1.hist.length||TELE.S.s2.hist.length)){
    teleUI(); document.getElementById("tStat").textContent="Messung beendet – Diagramme und CSV bleiben bis zum Schliessen erhalten.";
    const p=document.getElementById("tPrev"); if(p) p.style.display="none"; return true; }
  return false;
}
function teleStop(){ teleEnd(); document.getElementById("tele").style.display="none"; }
document.addEventListener("click",e=>{ if(e.target.closest("#teleBtn")) openTele(); });
