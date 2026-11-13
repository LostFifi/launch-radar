// ===================== Reise zum Mond, Mars und zu den Lagrange-Punkten =====================
// Schematische Ansicht (von oben auf die Bahnebene): Transferbahn als Hohmann-Ellipse, Position der Sonde aus der Zeit
// seit dem Abflug (Kepler-Gleichung). Mond- und Planetenpositionen mit einfachen Näherungsformeln. Alles GESCHÄTZT.
function deepInfo(l){
  const orb=(l.mission?.orbit?.abbrev||"").toUpperCase(), on=(l.mission?.orbit?.name||"").toLowerCase(),
        txt=[l.name,l.mission?.name,l.mission?.description].join(" ").toLowerCase();
  let kind=null;
  if(/mars/.test(on)||/\bmars\b/.test(txt)&&/(transfer|orbiter|lander|rover|sample|mission to mars)/.test(txt)) kind="mars";
  else if(["TLI","LO","LUNAR"].includes(orb)||/lunar|moon/.test(on)||/(artemis|chang'?e|clps|blue ghost|\bim-\d|griffin|lunar|\bmoon\b|mond)/.test(txt)&&!/starlink/.test(txt)) kind="moon";
  else if(orb==="L1"||/\bl1\b/.test(on)) kind="l1";
  else if(orb==="L2"||/\bl2\b/.test(on)) kind="l2";
  if(!kind) return null;
  // Reisedauer (Tage): Mond direkt ~4,5 T, energiesparend (ballistisch) ~3–4 Monate; Mars ~7 Monate; L2 ~30 T; L1 ~100 T
  const slow=/low[- ]energy|ballistic|weak stability|energiesparend/.test(txt);
  const days=kind==="moon"?(slow?100:/artemis|crew|orion/.test(txt)?4.5:5):kind==="mars"?210:kind==="l2"?30:100;
  const label={moon:"Reise zum Mond",mars:"Reise zum Mars",l1:"Reise zum Lagrange-Punkt L1",l2:"Reise zum Lagrange-Punkt L2"}[kind];
  return {kind,days,slow,label};
}
const J2000=t=>t/864e5+2440587.5-2451545;            // Tage seit J2000 (t in ms)
function moonPos(t){ const n=J2000(t), r=Math.PI/180, M=(134.963+13.064993*n)*r;
  return {lon:((218.316+13.176396*n+6.289*Math.sin(M))%360+360)%360, km:385001-20905*Math.cos(M)}; }
function planetLon(p,t){ const n=J2000(t); return ((p==="earth"?100.464+0.98560911*n:355.433+0.52403840*n)%360+360)%360; }
// Ort auf einer Transfer-Ellipse (Perizentrum rp, Apozentrum ra) nach Zeitanteil f (0..1 = halbe Ellipse)
function transferPoint(rp,ra,f){
  const a=(rp+ra)/2, e=(ra-rp)/(ra+rp), M=Math.PI*Math.max(0,Math.min(1,f)); let E=M;
  for(let i=0;i<20;i++) E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
  const nu=2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2),Math.sqrt(1-e)*Math.cos(E/2)); return {r:a*(1-e*Math.cos(E)),nu};
}
function deepState(l,est,D){
  const tDep=new Date(l.net).getTime()+((est&&est.prof?profEnd(est.prof):540)+30*60)*1000;   // Abflug nach ~1 Parkbahn-Halbumlauf
  const tArr=tDep+D.days*864e5, now=Date.now(), f=(now-tDep)/(tArr-tDep);
  return {tDep,tArr,f,phase:now<new Date(l.net)?"geplant":f<0?"in der Parkbahn":f<1?"unterwegs":"angekommen"};
}
function deepSvg(l,est,D){
  const S=deepState(l,est,D), W=320,H=320,c=160, deg=Math.PI/180, P=(r,a)=>[c+r*Math.cos(a*deg),c-r*Math.sin(a*deg)];
  const path=(n,fn)=>Array.from({length:n+1},(_,i)=>fn(i/n).map(v=>v.toFixed(1)).join(",")).join(" ");
  let g="", note="";
  if(D.kind==="moon"){
    const R=130, k=R/384400, mA=moonPos(S.tArr), mN=moonPos(Date.now()), th=mA.lon+180, rp=6700, ra=mA.km;
    g+=`<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="#232c3f" stroke-dasharray="3 4"/>`;
    g+=`<polyline points="${path(60,f=>{ const q=transferPoint(rp,ra,f); return P(q.r*k,th+q.nu/deg); })}" fill="none" stroke="#4ea1ff" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    const [mx,my]=P(mA.km*k,mA.lon), [nx,ny]=P(mN.km*k,mN.lon);
    g+=`<circle cx="${nx}" cy="${ny}" r="6" fill="#c9ced8"/><text x="${nx}" y="${ny-10}" text-anchor="middle">Mond jetzt</text>`;
    if(Math.hypot(mx-nx,my-ny)>14) g+=`<circle cx="${mx}" cy="${my}" r="5" fill="none" stroke="#c9ced8" stroke-dasharray="2 2"/><text x="${mx}" y="${my+16}" text-anchor="middle">bei Ankunft</text>`;
    g+=`<circle cx="${c}" cy="${c}" r="9" fill="#2f6fd6"/><text x="${c}" y="${c+22}" text-anchor="middle">Erde</text>`;
    if(S.f>=0&&S.f<=1){ const q=transferPoint(rp,ra,S.f), [sx,sy]=P(q.r*k,th+q.nu/deg); g+=sonde(sx,sy); note=`${Math.round(q.r).toLocaleString("de-CH")} km von der Erde`; }
  } else if(D.kind==="mars"){
    const RE=78, RM=RE*1.524, lE=planetLon("earth",S.tDep), mA=planetLon("mars",S.tArr);
    g+=`<circle cx="${c}" cy="${c}" r="${RE}" fill="none" stroke="#1f3b66"/><circle cx="${c}" cy="${c}" r="${RM}" fill="none" stroke="#5a2a1f"/>`;
    g+=`<polyline points="${path(80,f=>{ const q=transferPoint(1,1.524,f); return P(q.r*RE,lE+q.nu/deg); })}" fill="none" stroke="#4ea1ff" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    const [ex,ey]=P(RE,planetLon("earth",Date.now())), [mx,my]=P(RM,planetLon("mars",Date.now())), [ax,ay]=P(RM,mA);
    g+=`<circle cx="${c}" cy="${c}" r="10" fill="#ffd25a"/><text x="${c}" y="${c+24}" text-anchor="middle">Sonne</text>`;
    g+=`<circle cx="${ex}" cy="${ey}" r="6" fill="#2f6fd6"/><text x="${ex}" y="${ey-10}" text-anchor="middle">Erde</text>`;
    g+=`<circle cx="${mx}" cy="${my}" r="5" fill="#d0603a"/><text x="${mx}" y="${my-9}" text-anchor="middle">Mars</text>`;
    if(Math.hypot(ax-mx,ay-my)>14) g+=`<circle cx="${ax}" cy="${ay}" r="5" fill="none" stroke="#d0603a" stroke-dasharray="2 2"/><text x="${ax}" y="${ay+16}" text-anchor="middle">Mars bei Ankunft</text>`;
    if(S.f>=0&&S.f<=1){ const q=transferPoint(1,1.524,S.f), [sx,sy]=P(q.r*RE,lE+q.nu/deg); g+=sonde(sx,sy); note=`${(q.r*149.6).toFixed(0)} Mio. km von der Sonne`; }
  } else {   // L1 Richtung Sonne, L2 von der Sonne weg (je ~1,5 Mio. km); Sonne rechts
    const sgn=D.kind==="l1"?1:-1, R=120, [lx,ly]=[c+sgn*R,c];
    g+=`<text x="${W-6}" y="18" text-anchor="end">→ zur Sonne</text><circle cx="${c}" cy="${c}" r="${R*384400/1.5e6}" fill="none" stroke="#232c3f" stroke-dasharray="3 4"/>`;
    g+=`<path d="M${c} ${c}Q${c+sgn*R*.5} ${c-60} ${lx} ${ly}" fill="none" stroke="#4ea1ff" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    g+=`<circle cx="${c}" cy="${c}" r="9" fill="#2f6fd6"/><text x="${c}" y="${c+22}" text-anchor="middle">Erde</text>`;
    g+=`<circle cx="${lx}" cy="${ly}" r="4" fill="none" stroke="#ffd25a"/><text x="${lx}" y="${ly+18}" text-anchor="middle">${D.kind.toUpperCase()}</text>`;
    if(S.f>=0&&S.f<=1){ const f=S.f, x=(1-f)*(1-f)*c+2*(1-f)*f*(c+sgn*R*.5)+f*f*lx, y=(1-f)*(1-f)*c+2*(1-f)*f*(c-60)+f*f*ly; g+=sonde(x,y); note=`${Math.round(f*1.5e6).toLocaleString("de-CH")} km von der Erde`; }
  }
  return {svg:`<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:340px;display:block;margin:0 auto" role="img" aria-label="${esc(D.label)}"><rect width="${W}" height="${H}" rx="10" fill="#070a10"/><g font-size="10" fill="#8a96ad">${g}</g></svg>`,S,note};
  function sonde(x,y){ return `<circle cx="${x}" cy="${y}" r="8" fill="#4ea1ff33"/><circle cx="${x}" cy="${y}" r="3.5" fill="#fff"/><text x="${x+8}" y="${y-8}" fill="#fff">Sonde</text>`; }
}
function deepSection(l,est){
  const D=deepInfo(l); if(!D) return "";
  const {svg,S,note}=deepSvg(l,est,D), dd=t=>new Date(t).toLocaleDateString("de-CH",{day:"2-digit",month:"2-digit",year:"numeric"});
  const prog=S.f>0&&S.f<1?`Tag ${Math.floor((Date.now()-S.tDep)/864e5)+1} von ~${Math.round(D.days)}`:"";
  return `<div class="sec"><h3>${esc(D.label)} <span class="mute" style="text-transform:none;letter-spacing:0">· schematisch, geschätzt</span></h3>${svg}
    <div class="grid" style="margin-top:8px"><b>Status</b><span>${S.phase}${prog?" · "+prog:""}${note?" · "+note:""}</span>
    <b>Abflug</b><span>${dd(S.tDep)} <span class="mute">(nach der Parkbahn)</span></span><b>Ankunft</b><span>≈ ${dd(S.tArr)} <span class="mute">(${D.days<10?D.days.toString().replace(".",",")+" Tage":Math.round(D.days/30)+" Monate"}${D.slow?", energiesparende Bahn":""})</span></span></div>
    <div class="note">Blick von oben auf die Bahnebene, Abstände nicht massstäblich zur Grösse. Transferbahn als Ellipse vereinfacht – echte Missionen fliegen Korrekturen, Vorbeiflüge oder lange Spiralen.</div></div>`;
}
