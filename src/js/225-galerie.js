// ===================== Bildergalerien: Raketen-Steckbrief, Start-Galerie, Vollbild =====================
// Bilder: Start-Foto + Missions-Patch (The Space Devs), Raketen-Foto, dazu die Fotos aus dem Wikipedia-Artikel der
// Rakete (Wikimedia Commons, Schnittstelle page/media-list, CORS offen). Jedes Wikipedia-Bild verlinkt auf seine
// Dateiseite (Urheber + Lizenz). Geladen wird erst, wenn ein Steckbrief/Startfenster offen ist; Ergebnis 7 Tage im Cache.
const WIKI_MEM={};
function wikiTitle(url){ const m=/wikipedia\.org\/wiki\/([^#?]+)/.exec(url||""); return m?decodeURIComponent(m[1]):null; }
function wikiImages(title){
  if(!title) return Promise.resolve([]);
  const key="lr_gal_"+title.slice(0,60);
  if(WIKI_MEM[title]) return WIKI_MEM[title];
  const c=cacheGet(key); if(c && Date.now()-c.ts<7*864e5) return WIKI_MEM[title]=Promise.resolve(c.items);
  return WIKI_MEM[title]=fetch("https://en.wikipedia.org/api/rest_v1/page/media-list/"+encodeURIComponent(title.replace(/ /g,"_")))
    .then(r=>r.ok?r.json():{items:[]}).then(d=>{
      const items=(d.items||[]).filter(x=>x.type==="image" && x.showInGallery!==false && x.srcset?.length
          && /\.(jpe?g|png|webp)$/i.test(x.title) && !/logo|flag|icon|symbol|seal|emblem|insignia|patch|diagram|map\b|locator|comparison|chart|sketch/i.test(x.title))
        .slice(0,24).map(x=>{ const s=x.srcset, big=s[s.length-1].src, sm=s[0].src, fix=u=>u.startsWith("//")?"https:"+u:u;
          return {src:fix(sm), full:fix(big), cap:(x.caption?.text||"").replace(/\[\d+\]/g,"").trim(), page:"https://en.wikipedia.org/wiki/"+encodeURIComponent(x.title), credit:"Wikimedia Commons"}; });
      cacheSet(key,{ts:Date.now(),items}); return items; }).catch(()=>[]);
}
function rocketOf(l){ const cfg=l?.rocket?.configuration||{}, nm=(cfg.name||"").toLowerCase(), fn=(cfg.full_name||"").toLowerCase();
  return ROCKETS.find(x=>x.n.toLowerCase()===nm)||ROCKETS.find(x=>x.n.toLowerCase()===fn)||ROCKETS.find(x=>nm&&nm.includes(x.n.toLowerCase()))||null; }
// Wikipedia-Artikel einer Rakete: aus der Datenbank, sonst Familien- bzw. Raketenname als Titel versuchen
function rocketWiki(r){ return r ? (wikiTitle(r.wiki) || (r.fam||"").split(",")[0].trim() || r.n) : null; }

// ---------- Vollbild (Lightbox) ----------
var LB={items:[],i:0};
function openLightbox(items,i){
  LB.items=items; LB.i=i||0;
  let d=document.getElementById("lbox");
  if(!d){ d=document.createElement("div"); d.id="lbox"; document.body.appendChild(d);
    d.addEventListener("click",e=>{ if(e.target===d) closeLightbox(); });
    let sx=null; d.addEventListener("touchstart",e=>{ sx=e.touches[0].clientX; },{passive:true});
    d.addEventListener("touchend",e=>{ if(sx==null) return; const dx=e.changedTouches[0].clientX-sx; if(Math.abs(dx)>50) lbStep(dx<0?1:-1); sx=null; });
    addEventListener("keydown",e=>{ if(document.getElementById("lbox")?.style.display!=="flex") return;
      if(e.key==="Escape") closeLightbox(); if(e.key==="ArrowRight") lbStep(1); if(e.key==="ArrowLeft") lbStep(-1); }); }
  d.style.display="flex"; lbRender(); }
function closeLightbox(){ const d=document.getElementById("lbox"); if(d) d.style.display="none"; }
function lbStep(k){ const n=LB.items.length; if(n<2) return; LB.i=(LB.i+k+n)%n; lbRender(); }
function lbRender(){ const d=document.getElementById("lbox"), it=LB.items[LB.i]; if(!d||!it) return; const n=LB.items.length;
  d.innerHTML=`<button class="lbx" onclick="closeLightbox()" aria-label="Schliessen">×</button>
    ${n>1?`<button class="lbn l" onclick="lbStep(-1)" aria-label="Zurück">‹</button><button class="lbn r" onclick="lbStep(1)" aria-label="Weiter">›</button>`:""}
    <figure><img src="${esc(it.full||it.src)}" alt="${esc(it.cap||"")}" onerror="if(this.src!=='${esc(it.src)}')this.src='${esc(it.src)}'">
    <figcaption>${it.cap?`<span translate="no">${esc(it.cap)}</span><br>`:""}<span class="mute"><span>Bild</span> ${LB.i+1} / ${n} · ${it.page?`<a href="${esc(it.page)}" target="_blank" rel="noopener">${esc(it.credit||"Quelle")} ↗</a>`:`<span translate="no">${esc(it.credit||"")}</span>`}</span></figcaption></figure>`; }

// ---------- Karussell (Startfenster + Steckbrief) ----------
// box: Element mit class="gal"; items werden angezeigt, more (Promise) hängt später weitere Bilder an
var GALS={};
function galHtml(id,items,patch){
  GALS[id]={items:items.slice(),i:0};
  return `<div class="hero gal" id="${id}">
    <img class="gimg" alt="" src="${esc(items[0]?.full||items[0]?.src||"")}" onclick="openLightbox(GALS['${id}'].items,GALS['${id}'].i)" onerror="galFail('${id}')">
    ${patch?`<img class="patch" src="${esc(patch)}" alt="" onerror="this.remove()">`:""}
    <button class="gnav l" onclick="galStep('${id}',-1)" aria-label="Zurück">‹</button><button class="gnav r" onclick="galStep('${id}',1)" aria-label="Weiter">›</button>
    <span class="gcount"></span><span class="cr"></span></div>`; }
function galUpdate(id){ const G2=GALS[id], el=document.getElementById(id); if(!G2||!el) return; const it=G2.items[G2.i], n=G2.items.length;
  const img=el.querySelector(".gimg"); if(it && img.getAttribute("src")!==(it.full||it.src)) img.src=it.full||it.src;
  el.querySelector(".gcount").textContent=n>1?`${G2.i+1} / ${n}`:"";
  el.querySelectorAll(".gnav").forEach(b=>b.style.display=n>1?"":"none");
  el.querySelector(".cr").innerHTML=it?.credit?`<span>Bild</span>: <span translate="no">${esc(it.credit)}</span>`:"";
  const p=el.querySelector(".patch"); if(p) p.style.display=G2.i===0?"":"none"; }
function galStep(id,k){ const G2=GALS[id]; if(!G2||G2.items.length<2) return; G2.i=(G2.i+k+G2.items.length)%G2.items.length; galUpdate(id); }
function galFail(id){ const G2=GALS[id]; if(!G2) return; G2.items.splice(G2.i,1); if(G2.i>=G2.items.length) G2.i=0;
  if(!G2.items.length){ document.getElementById(id)?.remove(); return; } galUpdate(id); }
function galAdd(id,more){ const G2=GALS[id]; if(!G2) return; const have=new Set(G2.items.map(x=>x.full||x.src));
  more.forEach(x=>{ if(!have.has(x.full||x.src)) G2.items.push(x); }); galUpdate(id); }

// Bilder eines Starts: Foto (The Space Devs), Raketenfoto aus der Datenbank, später Wikipedia-Fotos der Rakete
function launchGallery(l){
  const im=l.image&&typeof l.image==="object"?l.image:null, items=[];
  if(im?.image_url||im?.thumbnail_url) items.push({src:im.thumbnail_url||im.image_url, full:im.image_url||im.thumbnail_url, credit:im.credit||"The Space Devs", cap:l.name});
  const r=rocketOf(l); if(r?.img) items.push({src:r.img, full:r.img, credit:"The Space Devs", cap:r.n});
  return {items, r, patch:(l.mission_patches||[])[0]?.image_url}; }
function launchGalHtml(l){ const g=launchGallery(l); if(!g.items.length && !g.r) return "";
  const html=galHtml("galL",g.items.length?g.items:[{src:"",full:""}],g.patch);
  const tok=GALS.galL;   // gehört zu diesem Start – beim schnellen Wechseln nicht in die falsche Galerie schreiben
  setTimeout(()=>{ galUpdate("galL"); wikiImages(rocketWiki(g.r)).then(m=>{ if(GALS.galL!==tok) return;
    if(!g.items.length) tok.items=[]; galAdd("galL",m.slice(0,12)); if(!tok.items.length) document.getElementById("galL")?.remove(); }); },0);
  return html; }

// ---------- Hover-Vorschau in der Raketen-Tabelle ----------
const fineHover=matchMedia("(hover:hover) and (pointer:fine)").matches;
function rPrevShow(e,id){ if(!fineHover) return; const r=ROCKETS.find(x=>x.id===id); if(!r) return;
  let d=document.getElementById("rprev"); if(!d){ d=document.createElement("div"); d.id="rprev"; document.body.appendChild(d); }
  d.innerHTML=`${r.img?`<img src="${esc(r.img)}" alt="" onerror="this.remove()">`:'<div class="noimg">Kein Bild</div>'}<b translate="no">${esc(r.n)}</b><small class="mute">Klicken für den Steckbrief</small>`;
  d.style.display="block"; rPrevMove(e); }
function rPrevMove(e){ const d=document.getElementById("rprev"); if(!d||d.style.display!=="block") return;
  const w=220, x=Math.min(e.clientX+18, innerWidth-w-10), y=Math.min(e.clientY+12, innerHeight-300); d.style.left=x+"px"; d.style.top=Math.max(10,y)+"px"; }
function rPrevHide(){ const d=document.getElementById("rprev"); if(d) d.style.display="none"; }

// ---------- Raketen-Steckbrief ----------
function openRocket(id){
  rPrevHide(); const r=ROCKETS.find(x=>x.id===id); if(!r){ toast("Rakete nicht in der Datenbank gefunden"); return; }
  clearSat(); stopSim(); routeLayer.clearLayers(); selected=null; curTrack=null; curPos=null;
  const P=document.getElementById("panel"); P.classList.add("wide");
  const n=(v,d=0)=>v==null?'<span class="mute">–</span>':v.toLocaleString(LOC,{maximumFractionDigits:d});
  const facts=[["Hersteller",fmtCell(r,"man")],["Familie",esc(r.fam||"–")],["Variante",esc(r.v||"–")],["Status",fmtCell(r,"act")],
    ["Wiederverwendbar",r.reu?ICON.reuse+" ja":"nein"],["Erstflug",r.first?fmtDay(r.first):'<span class="mute">–</span>'],
    ["Nutzlast LEO",r.leo!=null?n(r.leo/1000,1)+" t":n(null)],["Nutzlast GTO",r.gto!=null?n(r.gto/1000,1)+" t":n(null)],["Nutzlast SSO",r.sso!=null?n(r.sso/1000,1)+" t":n(null)],
    ["Startschub",r.thr!=null?n(r.thr)+" kN":n(null)],["Höhe",r.len!=null?n(r.len,1)+" m":n(null)],["Durchmesser",r.dia!=null?n(r.dia,1)+" m":n(null)],
    ["Startmasse",r.mass!=null?n(r.mass)+" t":n(null)],["Preis pro Start",r.cost?n(r.cost/1e6)+" Mio $":n(null)]];
  const tiles=[[n(r.tot),"Flüge"],[r.tot?((r.suc/r.tot)*100).toFixed(0)+" %":"–","Erfolgsquote"],[r.al?`${r.sl}/${r.al}`:"–","Landungen"],[n(r.pend),"geplant"]];
  const nm=r.n.toLowerCase(), next=launches.filter(l=>{ const c=l.rocket?.configuration||{}; return (c.name||"").toLowerCase()===nm||(c.full_name||"").toLowerCase()===nm; }).slice(0,6);
  const items=r.img?[{src:r.img,full:r.img,credit:"The Space Devs",cap:r.n}]:[];
  P.innerHTML=`<div class="hd"><h2 translate="no">${esc(r.n)}</h2><button class="x" onclick="closeP()" aria-label="Schliessen">×</button></div>
   <div class="dbctl"><button class="chip" onclick="openDB()">← zurück zur Tabelle</button>
     <button class="chip" onclick="if(!DB.sel.includes(${r.id})&&DB.sel.length<4)DB.sel.push(${r.id});openDB()">Zum Vergleich hinzufügen</button></div>
   ${galHtml("galR",items.length?items:[{src:"",full:""}])}
   <div class="sec"><div class="tiles">${tiles.map(([v,s])=>`<div class="tile"><div class="big">${v}</div><small>${s}</small></div>`).join("")}</div>
     <div class="grid" style="margin-top:10px">${facts.map(([k,v])=>`<b>${k}</b><span>${v}</span>`).join("")}</div>
     ${r.d?`<p class="mute" translate="no" style="margin-top:10px">${esc(r.d)}</p>`:""}
     ${r.wiki?`<a href="${esc(r.wiki)}" target="_blank" rel="noopener" style="color:var(--acc)">Wikipedia ↗</a>`:""}</div>
   ${next.length?`<div class="sec"><h3>Nächste Starts mit dieser Rakete</h3>${next.map(l=>`<div class="lrow" style="cursor:pointer" onclick="select(launches.find(x=>x.id==='${l.id}'))"><b translate="no">${esc((l.name.split("|")[1]||l.name).trim())}</b> <span class="mute">${esc(fmtDate(l.net))}</span></div>`).join("")}</div>`:""}
   <div class="sec"><h3>Bildergalerie</h3><div class="thumbs" id="rThumbs"><span class="mute">Lade Bilder …</span></div>
     <div class="mute" style="font-size:12px;margin-top:6px">Fotos aus dem Wikipedia-Artikel (Wikimedia Commons) – Urheber und Lizenz beim Antippen über den Link.</div></div>
   <div class="note" style="padding:0 14px 14px">Daten: The Space Devs, Stand ${esc(SNAP_TS)}.</div>`;
  P.style.display="block"; P.scrollTop=0; galUpdate("galR"); const tok=GALS.galR;
  wikiImages(rocketWiki(r)).then(m=>{
    if(GALS.galR!==tok || !document.getElementById("rThumbs")) return;
    if(GALS.galR && !items.length) GALS.galR.items=[];
    galAdd("galR",m); const all=GALS.galR?.items||m;
    document.getElementById("rThumbs").innerHTML=all.length?all.map((x,i)=>`<img loading="lazy" src="${esc(x.src)}" alt="${esc(x.cap||"")}" title="${esc(x.cap||"")}" onclick="openLightbox(GALS.galR.items,${i})" onerror="this.remove()">`).join("")
      :'<span class="mute">Keine Bilder gefunden</span>';
    if(!all.length) document.getElementById("galR")?.remove();
  });
}
