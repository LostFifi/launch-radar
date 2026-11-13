// ===================== Zeitraffer-Leiste =====================
function setSpeed(s){ SIM.base=simNow().getTime(); SIM.anchor=Date.now(); SIM.speed=s; propAll(true); }
function simReset(){ SIM.base=Date.now(); SIM.anchor=Date.now(); SIM.speed=1; propAll(true); }
function simShift(min){ SIM.base=simNow().getTime()+min*60e3; SIM.anchor=Date.now(); propAll(true); }
function buildTimebar(){ const T=document.getElementById("timebar");
  T.innerHTML=`<span title="Simulierte Zeit für Satelliten & Tag/Nacht" style="display:inline-flex;color:var(--mute)">${ICON.clock}</span><b id="tbT"></b>`+
    [1,60,600,3600].map(s=>`<button class="chip" data-sp="${s}" onclick="setSpeed(${s})">${s}×</button>`).join("")+
    `<button class="chip tbx" onclick="simShift(-60)">−1h</button><button class="chip tbx" onclick="simShift(60)">+1h</button>
     <button class="chip" id="tbNow" onclick="simReset()">Jetzt</button>`; }
function updTimeUI(){ const T=document.getElementById("timebar"); if(!T||!T.firstChild) return;
  if(!LAYERS.time){ T.style.display="none"; return; } T.style.display="flex";
  const t=simNow(); document.getElementById("tbT").textContent=t.toLocaleString(LOC,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  T.querySelectorAll("[data-sp]").forEach(b=>b.classList.toggle("on",+b.dataset.sp===SIM.speed));
  document.getElementById("tbNow").style.display=(SIM.speed!==1||Math.abs(t-Date.now())>5000)?"":"none"; }
