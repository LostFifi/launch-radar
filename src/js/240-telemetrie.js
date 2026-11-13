// ===================== Echte Telemetrie aus dem Livestream (Texterkennung) =====================
// Liest Stufe 1 und Stufe 2 gleichzeitig (je ein Bildbereich). Stufe 2 bewegt die Rakete auf der Karte.
// TELE.v / TELE.h / teleDist() = Stufe 2 (werden in der Routen-Anzeige verwendet).
function teleStage(){ return {region:null,last:null,v:null,h:null,hist:[],ok:0,bad:0,raw:""}; }
var TELE={on:false,auto:false,stream:null,video:null,worker:null,busy:false,timer:null,use1:true,edit:"s2",t0:null,
  d:null,vh:0,v:null,h:null,S:{s1:teleStage(),s2:teleStage()}};
// Bereiche im Stream: untere 32 %, linke Hälfte = Stufe 1 (Booster), rechte Hälfte = Stufe 2 (Ship/Oberstufe).
// Bewusst grosszügig – die Einblendungen sitzen je nach Stream und Flugphase etwas anders.
const TPRESET={s2:[0.5,0.68,0.5,0.32],s1:[0,0.68,0.5,0.32]};
const TLIM={s1:{v:12000,h:300},s2:{v:32000,h:3000}};          // Plausibilitätsgrenzen je Stufe
const TCOL={s1:"#f5a142",s2:"#4ea1ff"}, TLAB={s1:"Stufe 1",s2:"Stufe 2"};
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function openTele(){
  const B=document.getElementById("tele"); B.style.display="flex";
  if(TELE.on) return teleUI();
  B.innerHTML=`<div class="thd"><b>Echte Telemetrie</b><button class="x" onclick="teleStop()">×</button></div>
   <ol class="tsteps"><li>Öffne den Livestream (YouTube oder X) in einem <b>anderen Tab</b> und lass ihn laufen.</li>
     <li>Tippe unten auf „Stream-Tab teilen“ und wähle diesen Tab aus.</li>
     <li>Ziehe in der Vorschau je einen Rahmen um die Anzeige von Stufe 1 und Stufe 2 (Geschwindigkeit + Höhe).</li></ol>
   <button class="btn" onclick="teleStart()">Stream-Tab teilen</button>
   ${PIP.yt?`<button class="btn sec2" onclick="teleAuto()">Mini-Fenster verwenden (1 Klick)</button>`:""}
   <div class="note"><b>Einfacher:</b> Stream im Mini-Fenster abspielen und dort „Telemetrie“ drücken – dann nur noch „Diesen Tab teilen“ bestätigen.</div>
   <div class="note">Funktioniert in Chrome oder Edge am Computer (Bildschirm teilen gibt es auf dem Handy nicht). Die Werte werden lokal per Texterkennung gelesen, nichts wird hochgeladen.</div>`;
  teleChrome(B);
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
  document.getElementById("tele").style.display="flex"; buildTeleBox(); document.getElementById("tStat").textContent="Texterkennung wird geladen …";
  try{
    if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    TELE.worker=await Tesseract.createWorker("eng");
    await TELE.worker.setParameters({tessedit_char_whitelist:"0123456789:KMHSPEDALTUI/ ",tessedit_pageseg_mode:"6"});
  }catch(e){ toast("Texterkennung konnte nicht geladen werden (Internet nötig)"); return teleStop(); }
  TELE.timer=setInterval(teleTick,1000); teleTick();
}
function buildTeleBox(){
  const B=document.getElementById("tele");
  const big=k=>`<div class="tst" style="--c:${TCOL[k]}"><div class="tsh"><i></i>${TLAB[k]} <span class="pill" id="tB_${k}">wartet</span></div>
     <div class="tbig"><div><small>Tempo</small><b id="tV_${k}">–</b></div><div><small>Höhe</small><b id="tH_${k}">–</b></div>${k==="s2"?`<div><small>Bodendistanz</small><b id="tD">–</b></div>`:`<div><small>Steigrate</small><b id="tR_s1">–</b></div>`}</div>
     ${k==="s2"?`<div class="mute" id="tPay" style="font-size:12px;margin-top:4px"></div>`:""}</div>`;
  B.innerHTML=`<div class="thd"><b>Echte Telemetrie</b><button class="x" onclick="teleStop()">×</button></div>
   ${big("s2")}${big("s1")}
   <div class="tch"><canvas id="tChH" width="640" height="200"></canvas><canvas id="tChV" width="640" height="200"></canvas></div>
   <canvas id="tPrev" width="320" height="180" title="Rahmen ziehen"></canvas>
   ${TELE.auto?"":`<div class="note" style="margin-top:0">Ziehe in der Vorschau einen Rahmen um alle Tempo-/Höhen-Anzeigen (beide Stufen).</div>`}
   <div class="tbtns">
     <label class="chip" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="tUse1" ${TELE.use1?"checked":""} style="margin:0">Stufe 1 lesen</label>
     <button class="chip" onclick="teleCSV()" title="Messwerte als CSV-Datei speichern">CSV</button></div>
   <details class="tdbg" open><summary>Was die App sieht</summary><div id="tDbg" class="mute" style="font-size:12px">Noch kein Bild.</div></details>
   <div class="note" id="tStat"></div>`;
  teleChrome(B);
  document.getElementById("tUse1").onchange=e=>{ TELE.use1=e.target.checked; teleUI(); };
  const cv=document.getElementById("tPrev"); let st=null;
  cv.style.display=TELE.auto?"none":"block";
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]; };
  cv.onpointerdown=e=>{ cv.setPointerCapture(e.pointerId); st=pos(e); };
  cv.onpointermove=e=>{ if(!st) return; const q=pos(e);
    TELE.area=[Math.min(st[0],q[0]),Math.min(st[1],q[1]),Math.max(.03,Math.abs(q[0]-st[0])),Math.max(.03,Math.abs(q[1]-st[1]))]; drawTelePrev(); };
  cv.onpointerup=()=>{ st=null; TELE.S.s1.last=null; TELE.S.s2.last=null; };
}
function teleRegion(k){ return TELE.auto?autoRegion(TPRESET[k]):TELE.S[k].region; }
function drawTelePrev(){
  const cv=document.getElementById("tPrev"), v=TELE.video; if(!cv||!v||!v.videoWidth||TELE.auto) return;
  cv.height=Math.round(cv.width*v.videoHeight/v.videoWidth);
  const c=cv.getContext("2d"); c.drawImage(v,0,0,cv.width,cv.height);
  const [x,y,w,hh]=TELE.area||TSTRIP; c.strokeStyle="#4ea1ff"; c.lineWidth=3; c.strokeRect(x*cv.width,y*cv.height,w*cv.width,hh*cv.height); }
// Bildausschnitt vergrössern und aufbereiten: nur fast-weisse Pixel (alle Farbkanäle hell) gelten als Schrift →
// schwarz auf weiss. Orange Flammen, blauer Himmel und graue Flächen fallen weg.
// open>0: dünne Linien (Kreise um die Starship-Anzeigen, winzige Beschriftungen) wegfiltern, dicke Ziffern bleiben.
function teleCanvas(region,target,open){
  const v=TELE.video, W=v.videoWidth, H=v.videoHeight, [rx,ry,rw,rh]=region;
  const sc=Math.max(1,target/(rw*W)), c=document.createElement("canvas"); c.width=Math.round(rw*W*sc); c.height=Math.round(rh*H*sc);
  const x=c.getContext("2d"); x.drawImage(v,rx*W,ry*H,rw*W,rh*H,0,0,c.width,c.height);
  const im=x.getImageData(0,0,c.width,c.height), p=im.data, w=c.width, h=c.height; let m=new Uint8Array(w*h);
  for(let i=0,j=0;i<p.length;i+=4,j++){ const mn=Math.min(p[i],p[i+1],p[i+2]), mx=Math.max(p[i],p[i+1],p[i+2]); m[j]=(mn>170&&mx-mn<60)?1:0; }
  if(open){ const op=(src,er)=>{ const d=new Uint8Array(w*h); for(let y=1;y<h-1;y++) for(let xx=1;xx<w-1;xx++){ const i=y*w+xx;
      const n=src[i-1]+src[i+1]+src[i-w]+src[i+w]+src[i-w-1]+src[i-w+1]+src[i+w-1]+src[i+w+1]+src[i]; d[i]=er?(n===9?1:0):(n>0?1:0); } return d; };
    for(let k=0;k<open;k++) m=op(m,true); for(let k=0;k<open;k++) m=op(m,false); }
  for(let i=0,j=0;i<p.length;i+=4,j++){ const o=m[j]?0:255; p[i]=p[i+1]=p[i+2]=o; }
  x.putImageData(im,0,0); return c;
}
async function teleOCR(region){
  const c=teleCanvas(region,900,0); TELE.dbg=TELE.dbg||{}; TELE.dbg[TELE.cur]=c;   // für „Was die App sieht“
  await TELE.worker.setParameters({tessedit_pageseg_mode:"6"});
  return (await TELE.worker.recognize(c)).data.text;
}
// ---------- Streifen-Modus: ganzen unteren Streifen lesen, Zahlenpaare (Tempo, Höhe) mit Position finden ----------
// Für Layouts wie Starship: runde Anzeigen „(26046)“ „(274)“ mit winzigen Beschriftungen, Lage je nach Flugphase verschieden.
const TSTRIP=[0,0.74,1,0.25];
async function teleOCRStrip(region,open){
  const c=teleCanvas(region,2200,open);
  await TELE.worker.setParameters({tessedit_pageseg_mode:"11"});
  const {data}=await TELE.worker.recognize(c,{},{text:true,blocks:true});
  let words=(data.words||[]).slice();
  if(!words.length&&data.blocks) data.blocks.forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>words.push(...(l.words||[])))));
  return {c,text:data.text||"",words:words.map(w=>({t:String(w.text||""),x:w.bbox.x0,x1:w.bbox.x1,y:w.bbox.y0,h:Math.max(1,w.bbox.y1-w.bbox.y0)}))};
}
// ---------- Ziffern-Gruppen finden und einzeln lesen (robust für runde Anzeigen, kleine Mini-Fenster) ----------
// 1) Ausschnitt in Originalgrösse, helle Pixel markieren, zusammenhängende Flecken suchen
// 2) Kreise (dünn, kaum gefüllt) und winzige Beschriftungen weglassen, Ziffern zu Wörtern zusammenfassen
// 3) jedes Wort stark vergrössern und einzeln lesen (nur Ziffern und „:“) – Uhrzeiten werden aussortiert
async function teleReadGroups(region){
  const v=TELE.video, W=v.videoWidth, H=v.videoHeight, [rx,ry,rw,rh]=region;
  // vorab auf ~1600 px Breite vergrössern (weich) – trennt kleine Ziffern sauberer vom Kreis
  const up=Math.max(1,Math.min(4,1600/(rw*W))), w=Math.max(8,Math.round(rw*W*up)), h=Math.max(8,Math.round(rh*H*up));
  const src=document.createElement("canvas"); src.width=w; src.height=h; const sx=src.getContext("2d"); sx.imageSmoothingQuality="high"; sx.drawImage(v,rx*W,ry*H,rw*W,rh*H,0,0,w,h);
  const px=sx.getImageData(0,0,w,h).data, m=new Uint8Array(w*h);
  for(let i=0,j=0;i<px.length;i+=4,j++){ const mn=Math.min(px[i],px[i+1],px[i+2]), mx=Math.max(px[i],px[i+1],px[i+2]); m[j]=(.3*px[i]+.59*px[i+1]+.11*px[i+2]>150&&mx-mn<90)?1:0; }
  const lab=new Int32Array(w*h), comps=[], st=[];
  for(let s=0;s<w*h;s++){ if(!m[s]||lab[s]) continue; const id=comps.length+1; let x0=w,x1=0,y0=h,y1=0,n=0; st.push(s); lab[s]=id;
    while(st.length){ const q=st.pop(), qx=q%w, qy=(q-qx)/w; n++; if(qx<x0)x0=qx; if(qx>x1)x1=qx; if(qy<y0)y0=qy; if(qy>y1)y1=qy;
      for(const d of [q-1,q+1,q-w,q+w]){ if(d<0||d>=w*h||lab[d]||!m[d]) continue; if((d===q-1&&qx===0)||(d===q+1&&qx===w-1)) continue; lab[d]=id; st.push(d); } }
    comps.push({x0,x1,y0,y1,n,cw:x1-x0+1,ch:y1-y0+1}); }
  let cs=comps.filter(c=>c.ch>=Math.max(4,h*0.035)&&c.ch<=h*0.6&&c.n/(c.cw*c.ch)>=0.14&&c.cw<=c.ch*2.2);
  // Schriftgrösse nur aus ziffernähnlichen Flecken bestimmen (Seitenverhältnis + Füllung) – Kreisbögen sind oft
  // dicker und grösser als die Ziffern und würden sonst die Ziffern als „zu klein“ verdrängen
  const dig=cs.filter(c=>c.cw/c.ch>=0.35&&c.cw/c.ch<=0.95&&c.n/(c.cw*c.ch)>=0.22);
  const Href=dig.length?Math.max(...dig.map(c=>c.ch)):Math.max(0,...cs.map(c=>c.ch));
  cs=cs.filter(c=>c.ch>=Href*0.55&&c.ch<=Href*1.25).sort((a,b)=>a.x0-b.x0);   // nur Schrift in Ziffern-Grösse
  const words=[]; for(const c of cs){ const p=words[words.length-1], ov=p?Math.min(p.y1,c.y1)-Math.max(p.y0,c.y0):0;
    if(p&&c.x0-p.x1<=Math.max(p.y1-p.y0,c.ch)*0.75&&ov>Math.min(p.y1-p.y0,c.ch)*0.5){ p.x1=Math.max(p.x1,c.x1); p.y0=Math.min(p.y0,c.y0); p.y1=Math.max(p.y1,c.y1); }
    else words.push({x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1}); }
  await TELE.worker.setParameters({tessedit_pageseg_mode:"7",tessedit_char_whitelist:"0123456789:"});
  const out=[];
  // Seitlich grosszügig ausschneiden: Ziffern, die den Kreis berühren, wurden oben evtl. mit ihm aussortiert
  for(const wd of words.slice(0,12)){ const wh=wd.y1-wd.y0+1, py=Math.ceil(wh*0.4), pxx=Math.ceil(wh*1.1), cw=wd.x1-wd.x0+1+2*pxx, ch=wh+2*py, sc=Math.max(2,90/wh);
    const c=document.createElement("canvas"); c.width=Math.round(cw*sc); c.height=Math.round(ch*sc); const x=c.getContext("2d"); x.imageSmoothingQuality="high";
    x.fillStyle="#000"; x.fillRect(0,0,c.width,c.height); x.drawImage(src,wd.x0-pxx,wd.y0-py,cw,ch,0,0,c.width,c.height);
    const im=x.getImageData(0,0,c.width,c.height), p=im.data; for(let i=0;i<p.length;i+=4){ const o=(.3*p[i]+.59*p[i+1]+.11*p[i+2])>150?0:255; p[i]=p[i+1]=p[i+2]=o; } x.putImageData(im,0,0);
    const t=((await TELE.worker.recognize(c)).data.text||"").replace(/\s+/g,"");
    out.push({t,x:wd.x0,x1:wd.x1,y:wd.y0,h:wh}); }
  // Beschriftung um jede Zahl lesen (klein, über/unter der Zahl): SPEED · ALTITUDE · PAYLOADS DEPLOYED
  // Die Zahl selbst wird dafür schwarz übermalt, damit nur die Buchstaben gelesen werden.
  await TELE.worker.setParameters({tessedit_pageseg_mode:"6",tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZ/"});
  for(const o of out){ if(!/^\d{1,6}$/.test(o.t)) continue;
    const bx=Math.max(0,o.x-o.h*1.6), by=Math.max(0,o.y-o.h*1.5), bw=Math.min(w-bx,(o.x1-o.x)+o.h*3.2), bh=Math.min(h-by,o.h*3.7), sc=Math.max(2,130/o.h);
    const c=document.createElement("canvas"); c.width=Math.round(bw*sc); c.height=Math.round(bh*sc); const x=c.getContext("2d"); x.imageSmoothingQuality="high";
    x.drawImage(src,bx,by,bw,bh,0,0,c.width,c.height); x.fillStyle="#000"; x.fillRect((o.x-bx-o.h*0.15)*sc,(o.y-by-o.h*0.1)*sc,(o.x1-o.x+o.h*0.3)*sc,o.h*1.2*sc);
    const im=x.getImageData(0,0,c.width,c.height), p=im.data; for(let i=0;i<p.length;i+=4){ const v=(.3*p[i]+.59*p[i+1]+.11*p[i+2])>140?0:255; p[i]=p[i+1]=p[i+2]=v; } x.putImageData(im,0,0);
    o.lab=((await TELE.worker.recognize(c)).data.text||"").toUpperCase().replace(/[^A-Z\/]+/g," ").trim(); }
  await TELE.worker.setParameters({tessedit_char_whitelist:"0123456789:KMHSPEDALTUI/ "});
  // Vorschau: Ausschnitt mit Rahmen um die gefundenen Gruppen
  const dbg=document.createElement("canvas"), ds=Math.min(4,700/w); dbg.width=Math.round(w*ds); dbg.height=Math.round(h*ds); const dx=dbg.getContext("2d");
  dx.drawImage(src,0,0,dbg.width,dbg.height); dx.lineWidth=2; dx.font="bold 14px sans-serif";
  out.forEach(o=>{ const ok=/^\d{1,6}$/.test(o.t), k=teleKind(o); dx.strokeStyle=ok?"#2ecc71":"#ff6b6b"; dx.strokeRect(o.x*ds-2,o.y*ds-2,(o.x1-o.x+1)*ds+4,o.h*ds+4);
    dx.fillStyle=ok?"#2ecc71":"#ff6b6b"; dx.fillText((o.t||"?")+(k?" "+{sp:"km/h",al:"km",pay:"Sat."}[k]:""),o.x*ds,Math.max(14,o.y*ds-6)); });
  return {words:out,c:dbg,text:out.map(o=>o.t).filter(Boolean).join(" ")};
}
// Art einer Zahl aus ihrer Beschriftung: Tempo, Höhe oder ausgesetzte Satelliten (null = unbekannt)
function teleKind(o){ const l=o.lab||""; if(/PAY|LOAD|DEPL|PLOY/.test(l)) return "pay"; if(/ALT|TITU/.test(l)) return "al"; if(/SPE|PEED|KM\s*\/\s*H|KMH/.test(l)) return "sp"; return null; }
function stripPairs(words){
  // reine Zahlen; Uhrzeiten (mit „:“) und Zahlen mit Buchstaben weglassen – auch Zahlen direkt nach einem „xx:“ (Rest der Uhr)
  const colon=words.filter(w=>/:/.test(w.t));
  let n=words.filter(w=>/^\d{1,6}$/.test(w.t) && !colon.some(c=>w.x>=c.x && w.x-c.x1<c.h*2 && Math.abs(w.y-c.y)<c.h)).map(w=>({...w,v:+w.t,k:teleKind(w)}));
  // „PAYLOADS DEPLOYED“: Anzahl merken, nicht als Höhe verwenden
  const pay=n.find(q=>q.k==="pay"); TELE.payNow=pay?pay.v:null; n=n.filter(q=>q.k!=="pay");
  // Mit Beschriftung eindeutig: Tempo (+ Höhe falls vorhanden) – ein Paar je Tempo-Anzeige
  if(n.some(q=>q.k==="sp")){ const sp=n.filter(q=>q.k==="sp").sort((a,b)=>a.x-b.x), al=n.filter(q=>q.k==="al");
    return sp.map(s=>{ const a=al.filter(q=>q.x>s.x).sort((x,y)=>x.x-y.x)[0]; return {sp:s.v,al:a&&a.x-s.x1<s.h*8?a.v:null,x:s.x}; }); }
  n.sort((a,b)=>a.x-b.x);
  const m=[]; for(const q of n){ const p=m[m.length-1];   // „26“ „046“ → 26046 (Tausender-Abstand)
    if(p&&q.t.length===3&&p.t.length<=3&&q.x-p.x1<p.h*0.9&&Math.abs(q.y-p.y)<p.h*0.6){ p.t+=q.t; p.v=+p.t; p.x1=q.x1; } else m.push({...q}); }
  // Uhr-Reste (mehrere 2-stellige Zahlen dicht nebeneinander, z.B. 00 24 03) weglassen
  const clean=m.filter((q,i)=>!(q.t.length===2&&((m[i+1]&&m[i+1].t.length===2&&m[i+1].x-q.x1<q.h*1.2)||(m[i-1]&&m[i-1].t.length===2&&q.x-m[i-1].x1<q.h*1.2))));
  const pairs=[]; for(let i=0;i+1<clean.length;i++){ const a=clean[i], b=clean[i+1];
    if(a.v>=b.v&&b.v<=3000&&a.v<=32000&&b.x-a.x1<a.h*8&&Math.abs(a.y-b.y)<a.h){ pairs.push({sp:a.v,al:b.v,x:a.x}); i++; } }
  return pairs;
}
// Paare den Stufen zuordnen: zwei Paare = links Booster, rechts Ship; ein Paar = Ship
// (in den ersten ~2:50 nach dem Start fliegen beide Stufen noch zusammen → gilt für beide)
function stripAssign(pairs){
  const ts=selected?(Date.now()-netOf(selected))/1000:null;
  if(pairs.length>=2) return {s1:pairs[0],s2:pairs[pairs.length-1]};
  if(pairs.length===1){ const p=pairs[0]; return (ts!=null&&ts<170&&p.sp<9000)?{s1:p,s2:p}:{s2:p}; }
  return {};
}
// Vorschau: aufbereiteter Bildausschnitt je Stufe + erkannter Text (zum Prüfen, ob der Bereich stimmt)
function teleDebug(){
  const box=document.getElementById("tDbg"); if(!box||!TELE.dbg) return;
  if(TELE.dbg.strip){   // Streifen-Modus: ein Bild, erkannter Text, gefundene Paare
    if(box.dataset.ready!=="strip"){ box.innerHTML=`<canvas id="tDbgS" style="width:100%;height:auto;background:#fff;border-radius:6px;margin:3px 0"></canvas><div id="tDbgST" style="word-break:break-word"></div>`; box.dataset.ready="strip"; }
    const src=TELE.dbg.strip, cv=document.getElementById("tDbgS"); cv.width=Math.min(700,src.width); cv.height=Math.round(cv.width*src.height/src.width); cv.getContext("2d").drawImage(src,0,0,cv.width,cv.height);
    const P=TELE.strip?.pairs||[], pf=document.getElementById("pipFrame");
    const small=TELE.auto&&pf&&pf.getBoundingClientRect().width<700;
    document.getElementById("tDbgST").textContent=(TELE.strip?.text?`„${TELE.strip.text}“`:"(kein Text erkannt)")+" → "+(P.length?P.map((p,i)=>`Paar ${i+1}: ${p.sp} km/h · ${p.al??"–"} km`).join(" | "):"keine Werte")
      +(TELE.strip?.pay!=null?` · ${TELE.strip.pay} Satelliten ausgesetzt`:"")
      +(small?" · Tipp: Mini-Fenster grösser ziehen (mind. ~720 px) – kleine Ziffern werden schlecht erkannt.":"");
    return; }
  if(!box.dataset.ready){ box.innerHTML=["s2","s1"].map(k=>`<div style="margin:6px 0"><div style="color:${TCOL[k]};font-weight:700">${TLAB[k]}</div><canvas id="tDbg_${k}" style="width:100%;height:auto;background:#fff;border-radius:6px;margin:3px 0"></canvas><div id="tDbgT_${k}" style="word-break:break-word"></div></div>`).join(""); box.dataset.ready=1; }
  for(const k of ["s2","s1"]){ const src=TELE.dbg[k], cv=document.getElementById("tDbg_"+k), tx=document.getElementById("tDbgT_"+k); if(!cv) continue;
    cv.parentElement.style.display=(k==="s1"&&!TELE.use1)?"none":"";
    if(src){ cv.width=Math.min(600,src.width); cv.height=Math.round(cv.width*src.height/src.width); cv.getContext("2d").drawImage(src,0,0,cv.width,cv.height); }
    const S=TELE.S[k], x=teleExtract(S.raw||"");
    tx.textContent=(S.raw?`„${S.raw}“`:"(kein Text erkannt)")+` → Tempo ${x.sp??"–"} · Höhe ${x.al??"–"}`; }
}
// Zahlen aus dem erkannten Text holen – egal ob neben oder unter der Beschriftung:
//   „SPEED 5 300 KM/H“ · „SPEED ALTITUDE \n 5 300 62 \n KM/H KM“ · „5 300 KM/H“ · nur „ALTITUDE 62 KM“
function teleExtract(text){
  const t=String(text).toUpperCase().replace(/[^0-9A-Z\n\/ ]/g," ");
  const lines=t.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const nums=s=>(String(s).replace(/KM\s*\/?\s*H|KM/g," ").match(/\d{1,3}(?: \d{3})+|\d+/g)||[]).map(x=>+x.replace(/ /g,""));
  const S_RX=/SPEED|SPEE|PEED|SP[E3]D/, A_RX=/ALT|LTITU|TITUDE/;
  let sp=null, al=null;
  lines.forEach((ln,i)=>{
    const hs=S_RX.test(ln), ha=A_RX.test(ln); if(!hs&&!ha) return;
    let n=nums(ln); if(!n.length) n=nums(lines[i+1]||"");
    if(hs&&ha){ if(n.length>=2){ const sFirst=ln.search(S_RX)<ln.search(A_RX); if(sp==null) sp=sFirst?n[0]:n[1]; if(al==null) al=sFirst?n[1]:n[0]; } }
    else if(hs){ if(n.length&&sp==null) sp=n[0]; }
    else if(n.length&&al==null) al=n[0];
  });
  if(sp==null){ const m=t.match(/(\d{1,3}(?: \d{3})+|\d+)\s*KM\s*\/\s*H/); if(m) sp=+m[1].replace(/ /g,""); }
  if(al==null){ const m=t.match(/(\d{1,3}(?: \d{3})+|\d+)\s*KM(?!\s*\/?\s*H)/); if(m) al=+m[1].replace(/ /g,""); }
  return {sp,al};
}
async function teleTick(){
  if(!TELE.on||TELE.busy||!TELE.worker||!TELE.video?.videoWidth) return; TELE.busy=true;
  try{
    drawTelePrev();
    {
      // Ganzer unterer Streifen (bzw. selbst gezogener Rahmen), Paare suchen; ohne Treffer nochmals mit Linienfilter
      const reg=TELE.auto?autoRegion(TSTRIP):(TELE.area||TSTRIP);
      if(reg){ let r=await teleReadGroups(reg), pairs=stripPairs(r.words);
        if(!pairs.length){ const r2=await teleOCRStrip(reg,0), p2=stripPairs(r2.words); if(p2.length||teleExtract(r2.text).sp!=null){ r=r2; pairs=p2; } }
        // Zweite Anzeige wechselt bei Starship zwischen ALTITUDE und PAYLOADS DEPLOYED. Ohne lesbare Beschriftung:
        // kleine Ganzzahl (≤ Anzahl Satelliten) nach Höhe > 80 km oder im Aussetz-Zeitraum = Satelliten-Anzahl, nicht Höhe
        { const ts=selected?(Date.now()-netOf(selected))/1000:null, lastH=TELE.S.s2.h, maxN=Math.max(60,DEP?.n||0);
          const inWin=DEP&&ts!=null&&ts>DEP.t0-300&&ts<DEP.t1+1800;
          pairs.forEach(p=>{ if(p.al!=null&&p.al<=maxN&&TELE.payNow==null&&((lastH!=null&&lastH>80)||inWin)){ TELE.payNow=p.al; p.al=null; } }); }
        let as=stripAssign(pairs);
        if(!pairs.length){ const x=teleExtract(r.text); if(x.sp!=null||x.al!=null) as={s2:x}; }   // Layout mit Beschriftungen
        TELE.dbg={strip:r.c}; TELE.strip={text:r.text.replace(/\s+/g," ").trim().slice(0,80),pairs,pay:TELE.payNow};
        // „PAYLOADS DEPLOYED“: Anzahl ausgesetzter Satelliten (nur steigend, erst nach T-0) → Punkte auf der Karte
        const now=Date.now(), pre=selected&&now<netOf(selected)-5000, n=TELE.payNow;
        if(n!=null&&!pre&&n<=200&&(!TELE.pay||TELE.pay.id!==selected?.id||n>=TELE.pay.n)){
          if(!TELE.pay||TELE.pay.id!==selected?.id){ TELE.pay={id:selected?.id,n:0,at:now}; TELE.payTimes=[]; }
          for(let i=TELE.pay.n;i<n;i++) TELE.payTimes[i]=teleT(now);
          TELE.pay.n=n; TELE.pay.at=now; }
        for(const k of ["s2","s1"]){ if(k==="s1"&&!TELE.use1) continue; const a=as[k];
          if(a) teleAccept(k,a.sp,a.al,TELE.strip.text); else { TELE.S[k].bad++; TELE.S[k].raw=TELE.strip.text; } } }
    }
    teleDebug();
    teleUI();
  }catch(e){ console.warn(e); }
  TELE.busy=false;
}
function teleParse(k,text){ const x=teleExtract(text); teleAccept(k,x.sp,x.al,text); }
function teleAccept(k,sp,al,text){
  const S=TELE.S[k], lim=TLIM[k];
  S.raw=String(text||"").replace(/\s+/g," ").trim().slice(0,60);
  const now=Date.now(), L=S.last;
  // Vor dem Start (T−) nichts übernehmen: Rakete bleibt am Boden, Anzeige „wartet auf den Start“
  if(selected && TELE.t0==null && now < new Date(netOf(selected)).getTime()-5000){ S.pre=(S.pre||0)+1; return; }
  // Jeden Wert einzeln prüfen (Bereich + kein unmöglicher Sprung); fehlt einer, gilt der letzte bekannte
  const dt=L?(now-L.t)/1000:0;
  if(sp!=null && (sp>lim.v || (L&&L.v!=null&&Math.abs(sp-L.v)>3000*dt+800))) sp=null;
  if(al!=null && (al>lim.h || (L&&L.h!=null&&Math.abs(al-L.h)>20*dt+8))) al=null;
  if(sp==null && al==null){ S.bad++; return; }
  if(sp==null) sp=L?.v??null; if(al==null) al=L?.h??null;
  if(sp==null || al==null){ S.v=sp??S.v; S.h=al??S.h; S.last={t:now,v:sp,h:al}; S.ok++; return; }   // erst ein Wert bekannt: anzeigen, noch nicht rechnen
  if(k==="s2"){
    if(L&&L.v!=null&&L.h!=null){ const vk=(sp+L.v)/2/3600, dh=(al-L.h)/dt; TELE.vh=Math.sqrt(Math.max(0,vk*vk-dh*dh)); TELE.d=(TELE.d||0)+TELE.vh*dt; }
    else if(TELE.d==null){ const ts=selected?(now-new Date(netOf(selected)))/1000:0; TELE.d=(curTrack&&ts>0)?distAt(ts,curTrack):0; }
    TELE.v=sp; TELE.h=al;
  }
  S.rate=L&&L.h!=null&&dt>0?(al-L.h)/dt:null;
  S.last={t:now,v:sp,h:al}; S.v=sp; S.h=al; S.ok++;
  // Gemessenes Tempo nach T-0 = Start ist erfolgt (auch wenn die API noch „Go“ meldet)
  if(selected && sp>300 && S.ok>=2 && !LAUNCHED[selected.id] && launchState(selected)!=="flying") confirmLaunch(selected.id);
  S.hist.push([teleT(now),al,sp]); if(S.hist.length>1800) S.hist.shift();
  teleSave(false);
  if(k==="s2" && curTrack && selected){ const s=document.getElementById("sim"), ts=Math.max(0,(now-new Date(netOf(selected)))/1000); if(s) s.value=ts; placeRocket(ts); }
}
// Zeitachse: T+ Sekunden ab Startzeit (falls ein Start gewählt und schon gestartet), sonst Sekunden seit Messbeginn
function teleT(now){
  if(selected){ const ts=(now-new Date(netOf(selected)))/1000; if(ts>-120 && ts<4*3600) return ts; }
  if(TELE.t0==null) TELE.t0=now; return (now-TELE.t0)/1000;
}
function teleDist(){ if(!TELE.on||TELE.d==null||!TELE.S.s2.last) return null; return TELE.d+TELE.vh*Math.min(3,(Date.now()-TELE.S.s2.last.t)/1000); }
function teleUI(){
  if(!document.getElementById("tV_s2")) return;
  for(const k of ["s1","s2"]){ const S=TELE.S[k], fresh=S.last&&Date.now()-S.last.t<4000, b=document.getElementById("tB_"+k), off=k==="s1"&&!TELE.use1;
    const pre=!off && selected && TELE.t0==null && Date.now()<new Date(netOf(selected)).getTime()-5000;
    b.textContent=off?"aus":pre?"wartet auf den Start":fresh?"● gemessen":"keine Werte"; b.style.background=off||pre?"#33384a":fresh?"#1f4d33":"#4d3a1f"; b.style.color=off||pre?"#aab":fresh?"#7be07b":"#f5b041";
    document.getElementById("tV_"+k).textContent=S.v!=null?S.v.toLocaleString(LOC)+" km/h":"–";
    document.getElementById("tH_"+k).textContent=S.h!=null?S.h.toLocaleString(LOC)+" km":"–"; }
  document.getElementById("tD").textContent=TELE.d!=null?Math.round(TELE.d).toLocaleString(LOC)+" km":"–";
  const tp=document.getElementById("tPay"); if(tp) tp.textContent=TELE.pay&&TELE.pay.n?`Satelliten ausgesetzt: ${TELE.pay.n} (gemessen)`:"";
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
  c.font="11px sans-serif"; c.fillStyle="#8a96ad"; c.textBaseline="alphabetic"; c.textAlign="left"; c.fillText(i18n(title+" ("+unit+")"),pad.l,11);
  if(!ser.length){ c.fillText(i18n("noch keine Messwerte"),pad.l,H/2+8); return; }
  const all=ser.flatMap(s=>s.h), t0=Math.min(...all.map(q=>q[0])), t1=Math.max(t0+10,...all.map(q=>q[0]));
  const ymax=niceMax(Math.max(1,...all.map(q=>q[col])));
  const X=t=>pad.l+(t-t0)/(t1-t0)*(W-pad.l-pad.r), Y=v=>H-pad.b-v/ymax*(H-pad.t-pad.b);
  c.strokeStyle="#232c3f"; c.lineWidth=1; c.fillStyle="#8a96ad"; c.font="10px sans-serif"; c.textAlign="right";
  for(let i=0;i<=4;i+=2){ const v=ymax*i/4, y=Y(v); c.beginPath(); c.moveTo(pad.l,y); c.lineTo(W-pad.r,y); c.stroke(); c.fillText(v.toLocaleString(LOC),pad.l-4,y+3); }
  c.textAlign="center"; const step=niceMax((t1-t0)/Math.max(2,Math.floor(W/90)));
  for(let t=Math.ceil(t0/step)*step;t<=t1;t+=step) c.fillText((t<0?"T−":"T+")+mmss(Math.abs(t)),X(t),H-3);
  c.textAlign="left";
  // Schätzung aus dem Aufstiegsprofil zum Vergleich (gestrichelt), nur wenn die Zeitachse T+ des gewählten Starts ist
  if(curTrack?.prof && selected && TELE.t0==null){ const P=curTrack.prof; c.save(); c.beginPath(); c.rect(pad.l,pad.t,W-pad.l-pad.r,H-pad.t-pad.b); c.clip();
    c.beginPath(); let first=true; for(let t=Math.max(0,t0);t<=Math.min(t1,profEnd(P));t+=Math.max(1,(t1-t0)/120)){ const q=profAt(P,t), y=Y(col===1?q.h:q.v); first?c.moveTo(X(t),y):c.lineTo(X(t),y); first=false; }
    c.setLineDash([4,4]); c.strokeStyle="#8a96ad"; c.lineWidth=1.5; c.stroke(); c.restore();
    c.fillStyle="#8a96ad"; c.font="10px sans-serif"; c.textAlign="right"; c.fillText(i18n("- - Schätzung"),W-pad.r,11); c.textAlign="left"; }
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
// Messwerte pro Start im Browser speichern (für den Start-Rückblick); höchstens alle 10 s, die letzten 8 Starts
var TELEST={}; try{ TELEST=JSON.parse(localStorage.getItem("lr_tele")||"{}"); }catch(e){}
let teleSavedAt=0;
function teleSave(force){
  if(!selected || TELE.t0!=null) return;                       // nur mit echter T+-Zeitachse eines gewählten Starts
  if(!force && Date.now()-teleSavedAt<10e3) return; teleSavedAt=Date.now();
  const thin=h=>{ const st=Math.max(1,Math.ceil(h.length/400)); return h.filter((_,i)=>i%st===0).map(q=>[Math.round(q[0]),q[1],q[2]]); };
  const s1=thin(TELE.S.s1.hist), s2=thin(TELE.S.s2.hist); if(!s1.length&&!s2.length) return;
  TELEST[selected.id]={at:Date.now(),name:selected.name,s1,s2};
  const ids=Object.keys(TELEST).sort((a,b)=>TELEST[b].at-TELEST[a].at); ids.slice(8).forEach(id=>delete TELEST[id]);
  try{ localStorage.setItem("lr_tele",JSON.stringify(TELEST)); }catch(e){}
}
// Teilen beendet: Aufnahme stoppen, Diagramme bleiben sichtbar (× schliesst ganz)
function teleEnd(){ teleSave(true);
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
