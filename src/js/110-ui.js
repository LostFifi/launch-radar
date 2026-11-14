// ===================== UI =====================
// Ein Filter-Knopf oben: „Alle“ (leuchtet) → Liste der Anbieter, alle angehakt; einzelne abwählen
function grpLabel(){ const s=grpSel();
  if(grpAll()) return "Alle"; if(!s.length) return "Keine";
  if(s.length<=2) return s.map(k=>i18n(GROUPS.find(g=>g[0]===k)[1])).join(", ");
  if(GRP_OFF.size<=2) return i18n("Alle ausser")+" "+[...GRP_OFF].map(k=>GROUPS.find(g=>g[0]===k)?.[1]||k).map(i18n).join(", ");
  return `${s.length} ${i18n("Anbieter")}`; }
function grpSave(){ try{ localStorage.setItem("lr_grp_off",JSON.stringify([...GRP_OFF])); }catch(e){}
  const b=document.getElementById("grpBtn"); b.querySelector(".lbl").textContent=grpLabel(); b.classList.toggle("part",!grpAll());
  closeP(); render(); if(document.getElementById("grpMenu").style.display==="block") grpMenuBuild(); }
function grpMenuBuild(){
  const cnt={}; launches.forEach(l=>{ const g=launchGroup(l); cnt[g]=(cnt[g]||0)+1; });
  document.getElementById("grpMenu").innerHTML=`<div class="gmh"><b>Anbieter</b><span><button onclick="GRP_OFF.clear();grpSave()">Alle</button> · <button onclick="GROUPS.forEach(g=>GRP_OFF.add(g[0]));grpSave()">Keine</button></span></div>
    ${GROUPS.map(([k,lab])=>`<label class="gmr${cnt[k]?"":" empty"}"><input type="checkbox" data-g="${k}" ${GRP_OFF.has(k)?"":"checked"}><span>${lab}</span><small>${cnt[k]||0}</small></label>`).join("")}
    <div class="gmf">Land, Betreiber und Suche: in der <button onclick="grpMenuClose();showStartList('up')">Liste</button></div>`;
  document.querySelectorAll("#grpMenu input[data-g]").forEach(i=>i.onchange=()=>{ if(i.checked) GRP_OFF.delete(i.dataset.g); else GRP_OFF.add(i.dataset.g); grpSave(); }); }
function grpMenuClose(){ document.getElementById("grpMenu").style.display="none"; document.getElementById("grpBtn").setAttribute("aria-expanded","false"); }
document.getElementById("grpBtn").onclick=e=>{ e.stopPropagation(); const m=document.getElementById("grpMenu");
  if(m.style.display==="block") return grpMenuClose();
  grpMenuBuild(); const r=e.currentTarget.getBoundingClientRect(); m.style.left=Math.max(8,Math.min(r.left,innerWidth-268))+"px"; m.style.top=(r.bottom+6)+"px";
  m.style.display="block"; e.currentTarget.setAttribute("aria-expanded","true"); };
document.addEventListener("click",e=>{ if(!e.target.closest("#grpMenu,#grpBtn")) grpMenuClose(); });
{ const b=document.getElementById("grpBtn"); b.querySelector(".lbl").textContent=grpLabel(); b.classList.toggle("part",!grpAll()); }
document.getElementById("listBtn").onclick=()=>showStartList("up");
setInterval(()=>{ updateNext(); if(selected){const c=document.getElementById("cd"); if(c && !c.classList.contains("ago")) c.textContent=countdown(selected.net);} },1000);
