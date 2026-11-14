// ===================== Live-Telemetrie für alle (Sender → Worker → alle) =====================
// Ein Browser liest wie bisher die Werte aus dem Livestream (240-telemetrie.js) und schickt sie an den Worker
// (/tele/push, Passwort = Statistik-Passwort, steht nach dem Anmelden auf stats.html im Browser). Alle anderen
// holen sie dort ab (/tele/live) – ohne Einrichtung: Werte im Startfenster, Rakete fliegt nach den Messwerten.
var RT={cur:null,hist:[],at:0,skew:0,busy:false,sendAt:0,sendOk:null};
const teleKey=()=>{ try{ return (localStorage.getItem("lr_stats_key")||"").trim(); }catch(e){ return ""; } };
const W_URL=()=>(CONFIG.worker||"").replace(/\/$/,"");

// ---------- Sender ----------
function teleSendOn(){ return !!(CONFIG.worker && teleKey() && TELE.on && TELE.sendOn!==false && selected); }
async function teleSend(){
  if(!teleSendOn() || Date.now()-RT.sendAt<2000) return; RT.sendAt=Date.now();
  const S=TELE.S, st=k=>S[k].last?{v:S[k].v,h:S[k].h}:null;
  const body={id:selected.id, name:selected.name, ts:teleT(Date.now()), s2:st("s2"), s1:TELE.use1?st("s1"):null, d:TELE.d, vh:TELE.vh, pay:TELE.pay&&TELE.pay.id===selected.id?TELE.pay.n:null};
  try{ const r=await fetch(W_URL()+"/tele/push",{method:"POST",headers:{"content-type":"text/plain",authorization:"Bearer "+teleKey()},body:JSON.stringify(body)});
    RT.sendOk=r.ok?Date.now():false; if(r.status===401){ RT.sendOk="key"; } }catch(e){ RT.sendOk=false; }
  const el=document.getElementById("tSend");
  if(el) el.textContent=RT.sendOk==="key"?"Sender-Passwort falsch – auf der Statistik-Seite neu anmelden":RT.sendOk?"An alle gesendet ✓":"Senden fehlgeschlagen";
}
// Schalter im Telemetrie-Fenster (nur sichtbar, wenn dieser Browser Sender sein darf)
function teleSendHtml(){ if(!CONFIG.worker||!teleKey()) return "";
  return `<div class="tsend"><label class="chip" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="tSendOn" ${TELE.sendOn!==false?"checked":""} style="margin:0">An alle senden</label>
    <span class="mute" id="tSend" style="font-size:12px">Sender bereit</span></div>`; }

// ---------- Empfänger ----------
function rtFresh(){ return RT.cur && (Date.now()-RT.at)/1000+RT.cur.age<30; }
function rtFor(l){ return !TELE.on && rtFresh() && l && RT.cur.id===l.id; }
async function rtPoll(){
  if(RT.busy||!CONFIG.worker||document.visibilityState!=="visible") return;
  // nur nachfragen, wenn gerade etwas fliegen könnte (oder schon Werte da sind)
  const near=launches.some(l=>{ const t=Date.now()-netOf(l); return launchState(l)==="flying"||(t>-3600e3&&t<3*3600e3); });
  if(!near && !RT.cur) return;
  RT.busy=true;
  try{ const r=await fetch(W_URL()+"/tele/live",{cache:"no-store"}); if(r.ok){ const d=await r.json();
      RT.cur=d.cur?{...d.cur,age:Math.max(0,(d.now-d.cur.at)/1000)}:null; RT.hist=d.hist||[]; RT.at=Date.now();
      if(RT.cur && !TELE.on && RT.cur.pay!=null){ if(!TELE.pay||TELE.pay.id!==RT.cur.id){ TELE.pay={id:RT.cur.id,n:0,at:Date.now()}; TELE.payTimes=[]; }
        if(RT.cur.pay>=TELE.pay.n){ for(let i=TELE.pay.n;i<RT.cur.pay;i++) TELE.payTimes[i]=RT.cur.ts; TELE.pay.n=RT.cur.pay; TELE.pay.at=Date.now(); } }
      rtRender(); } }catch(e){}
  RT.busy=false;
}
// Bodendistanz aus den Messungen (für die Rakete auf der Karte), weitergerechnet seit dem letzten Wert
function rtDist(){ if(!rtFor(selected)||RT.cur.d==null) return null;
  return RT.cur.d+(RT.cur.vh||0)*Math.min(15,RT.cur.age+(Date.now()-RT.at)/1000); }
function spark(rows,idx,col){ const v=rows.map(r=>r[idx]).filter(x=>x!=null); if(v.length<2) return "";
  const mn=Math.min(...v), mx=Math.max(...v), W=120, H=28, pts=v.map((y,i)=>`${(i/(v.length-1)*W).toFixed(1)},${(H-2-(mx>mn?(y-mn)/(mx-mn):.5)*(H-4)).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6"/></svg>`; }
function rtRender(){
  const box=document.getElementById("rtele"); if(!box) return;
  if(!rtFor(selected)){ box.innerHTML=""; return; }
  const c=RT.cur, ago=Math.round(c.age+(Date.now()-RT.at)/1000), n=x=>x==null?"–":x.toLocaleString(LOC);
  const row=(lab,s,col,hi,vi)=>s&&(s.v!=null||s.h!=null)?`<div class="rtrow"><b style="color:${col}">${lab}</b><span><small>Tempo</small>${n(s.v)} km/h</span><span><small>Höhe</small>${n(s.h)} km</span>${spark(RT.hist,hi,col)}</div>`:"";
  box.innerHTML=`<div class="sec rtele"><h3>Live-Telemetrie <span class="pill" style="background:#1f4d33;color:#7be07b">● gemessen</span></h3>
    ${row(i18n("Stufe 2"),c.s2,TCOL.s2,2,3)}${row(i18n("Stufe 1"),c.s1,TCOL.s1,4,5)}
    ${c.pay?`<div class="mute" style="margin-top:4px">Satelliten ausgesetzt: <b style="color:#ff4fd8">${c.pay}</b></div>`:""}
    <div class="mute" style="font-size:12px;margin-top:6px"><span>Aus dem Livestream gelesen</span> · <span>vor ${ago} s</span> · <span>Der Stream läuft etwas hinter der echten Zeit her.</span></div></div>`; }
setInterval(()=>{ if(rtFor(selected)) rtPoll(); else if(Date.now()-RT.at>20e3) rtPoll(); },3000);
setInterval(()=>{ if(rtFor(selected)) rtRender(); },1000);
setTimeout(rtPoll,4000);
