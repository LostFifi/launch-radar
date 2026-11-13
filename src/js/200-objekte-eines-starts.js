// ===================== Objekte eines Starts / neueste Starts =====================
var HL=null;
function allLoaded(){ return Object.values(SATS).flat(); }
async function showLaunchObjects(l){
  const m=/^(\d{4})-(\d{3})/.exec(l?.launch_designator||""), R=document.getElementById("objRes"); if(!m||!R) return;
  const key=m[1].slice(2)+m[2]; R.innerHTML='<div class="mute">Suche …</div>';
  if(/starlink/i.test(l.name)) await loadSats("starlink");
  let found=allLoaded().filter(s=>s.intl&&s.intl.startsWith(key));
  if(!found.length){ try{ const r=await fetch(`https://celestrak.org/NORAD/elements/gp.php?INTDES=${m[0]}&FORMAT=tle`);
      if(r.ok){ const t=await r.text(); if(t.includes("\n1 ")) found=parseTLE(t); } }catch(e){} }
  if(!found.length){ R.innerHTML='<div class="mute" style="margin-top:6px">Keine Bahndaten gefunden – noch nicht katalogisiert, oder offline (CelesTrak nicht erreichbar).</div>'; return; }
  HL={label:(l.name.split("|")[1]||l.name).trim(),sats:found,fresh:false};
  const now=simNow(), gm=satellite.gstime(now); found.forEach(s=>propOne(s,now,gm));
  R.innerHTML=`<div style="margin-top:8px">${found.length} Objekte gefunden, <b style="color:#ff4fd8">pink</b> markiert · <a href="#" style="color:var(--acc)" onclick="HL=null;drawSatMap();document.getElementById('objRes').innerHTML='';return false">ausblenden</a></div>
    <div class="mute" style="max-height:120px;overflow:auto;margin-top:4px">${found.slice(0,80).map((s,i)=>`<a href="#" style="color:var(--acc)" onclick="selectSat(HL.sats[${i}],'hl');return false">${esc(s.name)}</a>`).join(" · ")}</div>`;
  drawSatMap(); const s=found.find(x=>x.ok); if(s){ if(G.on) G.target=[-s.lon,-s.lat]; else map.panTo([s.lat,s.lon]); } }
function setFresh(){ const all=allLoaded().filter(s=>s.intl), cy=String(simNow().getFullYear()).slice(2);
  const keys=[...new Set(all.map(s=>s.intl.slice(0,5)).filter(k=>k.startsWith(cy)))].sort().slice(-3);
  if(!keys.length){ toast("Keine neuen Objekte gefunden"); return; }
  HL={label:"Neueste Starts",sats:all.filter(s=>keys.includes(s.intl.slice(0,5))),fresh:true};
  const now=simNow(), gm=satellite.gstime(now); HL.sats.forEach(s=>propOne(s,now,gm));
  toast(`Pink: ${HL.sats.length} Objekte der 3 neuesten Starts (${keys.map(k=>"20"+k.slice(0,2)+"-"+k.slice(2)).join(", ")}) – frische Starlink-Züge!`); }
function hlDraw2D(sz){ if(!HL||G.on) return; sx.fillStyle="#ff4fd8";
  for(const s of HL.sats){ if(!s.ok) continue; for(const sh of [-360,0,360]){ const p=map.latLngToContainerPoint([s.lat,s.lon+sh]);
    if(p.x<-10||p.y<-10||p.x>sz.x+10||p.y>sz.y+10) continue; sx.beginPath(); sx.arc(p.x,p.y,3.2,0,7); sx.fill(); } } }
function hlDrawGlobe(c,vis,pt){ if(!HL) return; c.fillStyle="#ff4fd8";
  for(const s of HL.sats){ if(!s.ok||!vis([s.lat,s.lon])) continue; const q=pt([s.lat,s.lon]); c.beginPath(); c.arc(q[0],q[1],3.2,0,7); c.fill(); G.hits.push({x:q[0],y:q[1],sat:s,g:"hl"}); } }
function nearestSat(pt){ let best=null,bd=1e9;
  const test=(s,g,lim)=>{ if(!s.ok) return; for(const sh of [-360,0,360]){ const p=map.latLngToContainerPoint([s.lat,s.lon+sh]); const d=Math.hypot(p.x-pt.x,p.y-pt.y); if(d<lim&&d<bd){bd=d;best={s,g};} } };
  if(HL) HL.sats.forEach(s=>test(s,"hl",12));
  for(const g in SAT_SRC){ if(!LAYERS[g]||!SATS[g]) continue; SATS[g].forEach(s=>test(s,g,g==="stations"?22:10)); }
  return best; }
