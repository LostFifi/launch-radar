// ===================== UI =====================
document.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-f]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
  filter=b.dataset.f; closeP(); render();
});
document.getElementById("listBtn").onclick=()=>showStartList("up");
setInterval(()=>{ updateNext(); if(selected){const c=document.getElementById("cd"); if(c) c.textContent=countdown(selected.net);} },1000);
