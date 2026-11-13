// ===================== Erinnerungen =====================
var REM={}; try{ REM=JSON.parse(localStorage.getItem("lr_rem")||"{}"); }catch(e){}
function saveRem(){ try{ localStorage.setItem("lr_rem",JSON.stringify(REM)); }catch(e){} }
function toggleRem(id){
  const l=[...launches,...(PAST||[])].find(x=>x.id===id); if(!l) return;
  if(REM[id]) delete REM[id];
  else { REM[id]={name:l.name,net:l.net,fired:false};
    try{ if(window.Notification && Notification.permission==="default") Notification.requestPermission(); }catch(e){}
    beep(true); toast("Erinnerung gesetzt – 10 Min vor dem Start (die Seite muss offen bleiben)"); }
  saveRem(); const b=document.getElementById("remBtn");
  if(b){ b.className="btn "+(REM[id]?"":"sec2"); b.innerHTML=REM[id]?ICON.bell+" Erinnerung aktiv – entfernen":ICON.bell+" 10 Min vorher erinnern"; } }
function checkRem(){ for(const id in REM){ const r=REM[id], l=launches.find(x=>x.id===id); if(l && l.net!==r.net){ r.net=l.net; r.fired=false; }
    const t=new Date(r.net)-Date.now();
    if(!r.fired && t<=10*60e3 && t>-30*60e3){ r.fired=true; const msg=`${(r.name.split("|")[1]||r.name).trim()} startet in ${Math.max(0,Math.round(t/60e3))} Min!`;
      toast(msg); beep(); try{ if(window.Notification && Notification.permission==="granted") new Notification("LaunchRadar",{body:msg}); }catch(e){} }
    if(t<-6*3600e3) delete REM[id]; }
  saveRem(); }
setInterval(checkRem,15e3);
var actx=null;
function beep(silent){ try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(silent) return;
  [0,.35,.7].forEach(t0=>{ const o=actx.createOscillator(), g=actx.createGain(); o.frequency.value=880;
    g.gain.setValueAtTime(.15,actx.currentTime+t0); g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+t0+.3);
    o.connect(g).connect(actx.destination); o.start(actx.currentTime+t0); o.stop(actx.currentTime+t0+.3); }); }catch(e){} }
