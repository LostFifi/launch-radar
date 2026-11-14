// ===================== 3D-Globus =====================
const G={on:false, rot:[60,-20,0], scale:0, target:null, auto:true, ptr:new Map(), drag:null, pinch:null, hits:[]};
const gc=document.getElementById("globe"), gx=gc.getContext("2d"), grat=d3.geoGraticule10();
// Grösse vom sichtbaren Bereich, nicht von innerWidth: auf dem Handy wächst innerWidth, sobald etwas übersteht –
// dann wurde der Globus breiter, die Seite noch breiter (Teufelskreis, Globus „unten rechts“ + seitliches Schieben)
const gW=()=>document.documentElement.clientWidth||innerWidth, gH=()=>document.documentElement.clientHeight||innerHeight;
const HEX={go:"#2ecc71",tbd:"#f5b041",live:"#ff3b3b",ok:"#9b59b6"};
function statusHex(l){ const a=(l.status?.abbrev||"").toLowerCase();
  const st=launchState(l); if(st==="flying"||(l.webcast_live&&st!=="done")) return HEX.live; if(st==="done"&&!/fail/.test(a)) return HEX.go; if(a==="go") return HEX.go; if(a==="success") return HEX.go; if(/fail/.test(a)) return HEX.live; return HEX.tbd; }
function gResize(){ const r=devicePixelRatio||1, w=gW(), h=gH(); gc.width=w*r; gc.height=h*r; gc.style.width=w+"px"; gc.style.height=h+"px"; gx.setTransform(r,0,0,r,0,0);
  if(!G.scale) G.scale=Math.min(w,h)*0.40; }
function panelOpen(){ const p=document.getElementById("panel"); return p.style.display==="block" && !p.classList.contains("min"); }
function gView(){ const w=gW(),h=gH(), po=panelOpen();
  if(w>=800) return {cx:po?(w-450)/2:w/2, cy:h/2+25, sc:G.scale};
  return po ? {cx:w/2, cy:h*0.17+45, sc:Math.min(G.scale,h*0.12)} : {cx:w/2, cy:h/2+25, sc:G.scale}; }
function gDraw(){
  const w=gW(),h=gH(), v=gView();
  gx.fillStyle="#0b0f17"; gx.fillRect(0,0,w,h);
  // Sterne
  gx.fillStyle="rgba(255,255,255,.5)"; for(let i=0;i<120;i++){ const x=(i*7919)%w, y=(i*104729)%h; gx.fillRect(x,y,(i%3)?1:1.5,(i%3)?1:1.5); }
  const proj=d3.geoOrthographic().scale(v.sc).translate([v.cx,v.cy]).rotate(G.rot).clipAngle(90).precision(.6);
  const path=d3.geoPath(proj,gx);
  const g=gx.createRadialGradient(v.cx,v.cy,v.sc*.95,v.cx,v.cy,v.sc*1.18); g.addColorStop(0,"rgba(78,161,255,.35)"); g.addColorStop(1,"rgba(78,161,255,0)");
  gx.fillStyle=g; gx.beginPath(); gx.arc(v.cx,v.cy,v.sc*1.18,0,7); gx.fill();
  gx.beginPath(); path({type:"Sphere"}); gx.fillStyle="#0f1a2e"; gx.fill();
  gx.beginPath(); path(grat); gx.strokeStyle="rgba(255,255,255,.07)"; gx.lineWidth=.6; gx.stroke();
  gx.beginPath(); path(WORLD); gx.fillStyle="#22304a"; gx.fill(); gx.strokeStyle="#3d4d6e"; gx.lineWidth=.5; gx.stroke();
  nightGlobe(gx,path,proj);
  const ctr=[-G.rot[0],-G.rot[1]], vis=ll=>d3.geoDistance([ll[1],ll[0]],ctr)<Math.PI/2-0.01, pt=ll=>proj([ll[1],ll[0]]);
  if(curTrack){
    const c=curTrack.track.map(p=>[p[1],p[0]]);
    (curTrack.parts||[]).forEach(pt=>{
      gx.globalAlpha=.38; gx.lineWidth=pt.w*0.7; gx.strokeStyle=pt.col; gx.beginPath(); path({type:"LineString",coordinates:c.slice(pt.a,pt.e)}); gx.stroke();
      const kk=Math.min(pt.e,curK+1); if(kk>pt.a+0){ const seg=c.slice(pt.a,kk); if(curK<pt.e && curP) seg.push([curP[1],curP[0]]);
        if(seg.length>1){ gx.globalAlpha=1; gx.lineWidth=pt.w+0.6; gx.beginPath(); path({type:"LineString",coordinates:seg}); gx.stroke(); } } });
    gx.globalAlpha=1;
    gx.textAlign="center"; gx.textBaseline="middle";
    curTrack.landings.forEach(x=>{ if(vis(x.pos)){ const q=pt(x.pos); drawLandG(gx,q[0],q[1],x.kind); } });
  }
  G.hits=[]; G.evHits=[];
  if(curTrack?.events && LAYERS.events!==false) curTrack.events.forEach(e=>{ if(!vis(e.pos)) return; const q=pt(e.pos);
    gx.beginPath(); gx.arc(q[0],q[1],4.5,0,7); gx.fillStyle=EVCOL[e.kind]||"#fff"; gx.fill(); gx.lineWidth=1.5; gx.strokeStyle="#0b0f17"; gx.stroke();
    G.evHits.push({x:q[0],y:q[1],e}); });
  satDrawGlobe(gx,proj,path,vis,pt);
  padGroups.forEach(list=>{ const l=list[0], ll=list.site?list.site.ll:[+l.pad.latitude,+l.pad.longitude]; if(!vis(ll)) return; const q=pt(ll);
    gx.beginPath(); gx.arc(q[0],q[1],7,0,7); gx.fillStyle=statusHex(l); gx.fill(); gx.lineWidth=2.5; gx.strokeStyle="#fff"; gx.stroke();
    if(list.length>1){ gx.font="bold 10px sans-serif"; gx.fillStyle="#fff"; gx.fillText(list.length,q[0]+11,q[1]-9); }
    G.hits.push({x:q[0],y:q[1],list}); });
  if(curTrack && depPos.length){ gx.fillStyle="#ff4fd8"; gx.strokeStyle="#0b0f17"; gx.lineWidth=1;
    depPos.forEach(p=>{ if(!vis(p)) return; const q=pt(p); gx.beginPath(); gx.arc(q[0],q[1],3.2,0,7); gx.fill(); }); }
  if(curPos && vis(curPos)){ const q=pt(curPos), r=Math.PI/180, a=[curPos[0]+Math.cos(curHdg*r)*0.5, curPos[1]+Math.sin(curHdg*r)*0.5/Math.max(.2,Math.cos(curPos[0]*r))], q2=pt(a);
    drawRocket(gx,q[0],q[1],Math.atan2(q2[1]-q[1],q2[0]-q[0])+Math.PI/2); }
}
function gLoop(){
  if(G.on){
    if(G.target){ let dl=((G.target[0]-G.rot[0]+540)%360)-180, dp=G.target[1]-G.rot[1];
      G.rot[0]+=dl*.08; G.rot[1]+=dp*.08; if(Math.abs(dl)<.2&&Math.abs(dp)<.2) G.target=null; }
    else if(G.auto && !selected && !G.drag) G.rot[0]+=0.08;
    gDraw();
  }
  requestAnimationFrame(gLoop);
}
gc.addEventListener("pointerdown",e=>{ gc.setPointerCapture(e.pointerId); G.ptr.set(e.pointerId,[e.clientX,e.clientY]); G.target=null; G.auto=false;
  if(G.ptr.size===1) G.drag={x:e.clientX,y:e.clientY,r:[...G.rot],moved:false};
  if(G.ptr.size===2){ const [a,b]=[...G.ptr.values()]; G.pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),s:G.scale}; G.drag=null; } });
// Ereignis-Punkte: Name beim Darüberfahren (wie die Tooltips auf der Karte)
const gtip=document.createElement("div"); gtip.id="gtip"; document.body.appendChild(gtip);
gc.addEventListener("pointermove",e=>{ if(G.ptr.size){ gtip.style.display="none"; return; }
  let best=null,bd=9; (G.evHits||[]).forEach(h=>{ const d=Math.hypot(h.x-e.clientX,h.y-e.clientY); if(d<bd){bd=d;best=h;} });
  if(!best){ gtip.style.display="none"; gc.style.cursor=""; return; }
  const v=best.e; gtip.innerHTML=`<b>${v.rel}</b> · <span>${esc(v.txt)}</span>${v.gen?` <span class="mute">(${v.note})</span>`:""}`;
  gtip.style.display="block"; gtip.style.left=(e.clientX+12)+"px"; gtip.style.top=(e.clientY-28)+"px"; gc.style.cursor="help"; });
gc.addEventListener("pointerleave",()=>{ gtip.style.display="none"; });
gc.addEventListener("pointermove",e=>{ if(!G.ptr.has(e.pointerId)) return; G.ptr.set(e.pointerId,[e.clientX,e.clientY]);
  if(G.pinch && G.ptr.size===2){ const [a,b]=[...G.ptr.values()]; G.scale=Math.max(80,Math.min(4000,G.pinch.s*Math.hypot(a[0]-b[0],a[1]-b[1])/G.pinch.d)); return; }
  if(G.drag){ const dx=e.clientX-G.drag.x, dy=e.clientY-G.drag.y; if(Math.hypot(dx,dy)>4) G.drag.moved=true;
    const k=70/gView().sc; G.rot[0]=G.drag.r[0]+dx*k; G.rot[1]=Math.max(-89,Math.min(89,G.drag.r[1]-dy*k)); } });
function gUp(e){ const d=G.drag; G.ptr.delete(e.pointerId); if(G.ptr.size<2) G.pinch=null;
  if(d && !d.moved){ let best=null,bd=20;
    G.hits.forEach(h=>{ if(h.list){ const dd=Math.hypot(h.x-e.clientX,h.y-e.clientY); if(dd<14){bd=-1;best=h;} } }); if(bd>=0) G.hits.forEach(h=>{ const dd=Math.hypot(h.x-e.clientX,h.y-e.clientY); if(dd<bd){bd=dd;best=h;} });
    if(best && best.sat) selectSat(best.sat,best.g);
    else if(best) openGroup(best.list); }
  G.drag=null; }
gc.addEventListener("pointerup",gUp); gc.addEventListener("pointercancel",gUp);
gc.addEventListener("wheel",e=>{ e.preventDefault(); G.scale=Math.max(80,Math.min(4000,G.scale*Math.exp(-e.deltaY*.0015))); },{passive:false});
addEventListener("resize",gResize);
function setGlobe(on,remember){ if(G.on!==!!on) document.getElementById("globeBtn").onclick(remember); }
document.getElementById("globeBtn").onclick=(remember)=>{
  G.on=!G.on; gc.style.display=G.on?"block":"none"; gtip.style.display="none"; document.body.classList.toggle("globe-on",G.on);
  if(remember!==false){ try{ localStorage.setItem("lr_view",G.on?"globe":"map"); }catch(e){} }   // Wahl merken
  document.getElementById("globeBtn").classList.toggle("on",G.on);
  document.getElementById("globeBtn").innerHTML=G.on?ICON.map+'<span class="lbl">Karte</span>':ICON.globe+'<span class="lbl">Globus</span>';
  if(G.on){ gResize(); G.auto=true; if(selected&&!follow) G.target=[-(+selected.pad.longitude),-(+selected.pad.latitude)]; }
  else { map.invalidateSize(); drawSatMap(); if(selected){ drawRoute(selected,curTrack); const s=document.getElementById("sim"); if(s) placeRocket(+s.value); } }
};
gLoop();
// Startansicht: ?view=map|globe → gespeicherte Wahl (lr_view) → Standard Globus
{ const q=new URLSearchParams(location.search).get("view"); let v=q==="map"||q==="globe"?q:null;
  if(!v){ try{ v=localStorage.getItem("lr_view"); }catch(e){} }
  if((v||"globe")==="globe") setGlobe(true,false); }
