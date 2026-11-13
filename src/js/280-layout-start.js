// ===================== Layout & Start =====================
function layoutTop(){ const hh=document.querySelector("header").offsetHeight;
  document.getElementById("live").style.top=(hh+4)+"px"; document.getElementById("layers").style.top=(hh+4)+"px";
  document.getElementById("panel").style.top=innerWidth>=800?(hh+6)+"px":"";
  const ms=document.getElementById("msg"); if(innerWidth<800){ ms.style.top=(hh+50)+"px"; ms.style.bottom="auto"; } else { ms.style.top=""; ms.style.bottom=""; } }
addEventListener("resize",layoutTop);
document.getElementById("statBtn").onclick=openStats;
document.getElementById("dbBtn").onclick=()=>openDB();
buildTimebar(); layoutTop(); updateNight(true); updTimeUI();
fullCheck(); setInterval(()=>refreshCounts(false),3*3600e3); setInterval(fullCheck,6*3600e3);
setTimeout(async()=>{ if(LAYERS.fresh){ await loadSats("starlink"); setFresh(); } },1500);

setInterval(load, CACHE_MIN*60e3+5000);
load();
