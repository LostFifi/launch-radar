// ===================== Aufstiegsprofile je Rakete =====================
// Typische Aufstiegskurven aus veröffentlichten Webcast-Telemetrien und Presse-Kits (gerundet, GESCHÄTZT).
// pts: [T+ s, Höhe km, Tempo km/h, Bodendistanz km]; ev: [T+ s, Ereignis]; meco/seco: Zeitpunkte zum Abgleich mit der Timeline.
const PROFILES={
  f9:{name:"Falcon 9",meco:150,seco:520,
    pts:[[0,0,0,0],[30,2,550,.2],[72,12,1650,4],[100,26,3300,15],[120,40,4800,30],[150,68,8200,75],[160,76,8100,88],[205,108,8900,150],[260,140,10800,260],[330,168,14000,450],[400,186,17800,720],[460,196,22000,1060],[520,205,26800,1500],[540,207,27000,1650]],
    ev:[[72,"Max-Q"],[150,"MECO (Brennschluss Stufe 1)"],[153,"Stufentrennung"],[160,"Zündung Stufe 2 (SES-1)"],[205,"Verkleidung ab"],[520,"SECO-1 (Brennschluss Stufe 2)"]]},
  fh:{name:"Falcon Heavy",meco:184,seco:500,
    pts:[[0,0,0,0],[66,12,1600,4],[150,62,7000,65],[184,90,10500,130],[260,140,12500,300],[380,180,18500,700],[500,200,26500,1450],[520,202,27000,1600]],
    ev:[[66,"Max-Q"],[150,"Seitenbooster aus & Trennung"],[184,"MECO (Zentralstufe)"],[192,"Zündung Stufe 2"],[230,"Verkleidung ab"],[500,"SECO-1"]]},
  ss:{name:"Starship",meco:160,seco:520,
    pts:[[0,0,0,0],[62,11,1500,3],[100,25,2700,12],[160,66,5700,62],[200,84,6000,112],[300,128,10000,300],[400,152,16000,650],[520,165,26200,1450],[540,166,26500,1600]],
    ev:[[62,"Max-Q"],[160,"MECO Super Heavy"],[163,"Hot-Staging"],[170,"Booster: Boostback-Burn"],[520,"SECO Ship"]]},
  el:{name:"Electron",meco:150,seco:525,
    pts:[[0,0,0,0],[70,11,1500,4],[150,78,7000,95],[185,100,7600,150],[300,175,13000,500],[420,210,19500,1000],[525,230,26500,1550],[540,232,27000,1650]],
    ev:[[70,"Max-Q"],[150,"MECO"],[153,"Stufentrennung"],[185,"Verkleidung ab"],[270,"Batteriewechsel"],[525,"SECO"],[540,"Kick-Stage getrennt"]]},
  vu:{name:"Vulcan / Atlas V (Centaur)",meco:300,seco:900,
    pts:[[0,0,0,0],[60,10,1500,3],[140,55,5000,60],[300,150,14000,550],[450,175,18000,1150],[600,180,21500,1950],[750,182,24500,2900],[900,185,27500,3950]],
    ev:[[60,"Max-Q"],[140,"Feststoffbooster ab"],[300,"BECO (Brennschluss Stufe 1)"],[306,"Stufentrennung"],[315,"Verkleidung ab"],[900,"MECO-1 Centaur (Parkbahn)"]]},
  a6:{name:"Ariane 6",meco:468,seco:1000,
    pts:[[0,0,0,0],[70,12,1600,5],[136,62,6000,70],[210,110,7800,180],[300,145,10500,380],[468,190,22000,1250],[700,195,25000,2300],[1000,200,27500,3700]],
    ev:[[70,"Max-Q"],[136,"Feststoffbooster ab"],[210,"Verkleidung ab"],[468,"Kernstufe aus"],[474,"Stufentrennung, Vinci zündet"],[1000,"Vinci aus (Parkbahn)"]]},
  so:{name:"Sojus-2",meco:287,seco:528,
    pts:[[0,0,0,0],[60,9,1400,3],[118,42,5800,45],[155,65,6400,90],[287,165,13500,510],[400,190,19000,1050],[528,200,27000,1750]],
    ev:[[118,"Booster ab (Korolev-Kreuz)"],[155,"Verkleidung ab"],[287,"Kernstufe aus, Trennung"],[528,"Oberstufe aus"]]},
  lv:{name:"LVM3 / GSLV",meco:313,seco:960,
    pts:[[0,0,0,0],[60,8,1300,2],[128,55,5800,50],[313,160,16000,700],[600,175,22000,2000],[960,180,33000,4600]],
    ev:[[128,"Feststoffbooster ab"],[313,"Kernstufe aus"],[320,"Verkleidung / Oberstufe zündet"],[960,"Oberstufe aus (Transferbahn)"]]},
  cz:{name:"Langer Marsch / chinesische Rakete",meco:160,seco:580,
    pts:[[0,0,0,0],[62,10,1400,3],[140,55,6200,60],[160,68,7000,90],[260,140,9500,320],[420,185,17000,900],[580,200,27000,1900]],
    ev:[[62,"Max-Q"],[140,"Booster ab"],[160,"Stufentrennung"],[220,"Verkleidung ab"],[580,"Brennschluss Stufe 2"]]},
  h3:{name:"H3",meco:298,seco:990,
    pts:[[0,0,0,0],[60,10,1500,3],[116,50,5500,45],[210,110,8000,190],[298,150,12000,430],[600,190,20500,1800],[990,200,27500,4300]],
    ev:[[60,"Max-Q"],[116,"Feststoffbooster ab"],[210,"Verkleidung ab"],[298,"MECO"],[306,"Stufentrennung"],[990,"SECO-1"]]},
  ng:{name:"New Glenn",meco:189,seco:800,
    pts:[[0,0,0,0],[75,12,1600,4],[189,80,8200,130],[300,150,11500,420],[500,180,18500,1300],[800,190,27500,3200]],
    ev:[[75,"Max-Q"],[189,"MECO"],[195,"Stufentrennung"],[215,"Verkleidung ab"],[580,"Booster-Landung auf dem Schiff"],[800,"SECO-1"]]},
  gen:{name:"typische Rakete",meco:165,seco:540,
    pts:[[0,0,0,0],[70,12,1500,5],[165,80,7000,110],[300,160,14000,520],[420,190,20000,1060],[540,205,27000,1800]],
    ev:[[70,"Max-Q"],[165,"Brennschluss Stufe 1"],[200,"Verkleidung ab"],[540,"Brennschluss Oberstufe"]]}
};
function profileKey(l){
  const r=(l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"").toLowerCase();
  if(r.includes("starship")) return "ss"; if(r.includes("falcon heavy")) return "fh"; if(r.includes("falcon 9")) return "f9";
  if(r.includes("electron")) return "el"; if(/vulcan|atlas v/.test(r)) return "vu"; if(r.includes("ariane 6")) return "a6";
  if(/soyuz|sojus/.test(r)) return "so"; if(/lvm3|gslv|mark-3|mk iii/.test(r)) return "lv";
  if(/new glenn/.test(r)) return "ng"; if(/\bh3\b|h-iii/.test(r)) return "h3";
  if(/long march|chang zheng|kuaizhou|zhuque|tianlong|ceres|gravity|lijian|kinetica/.test(r)) return "cz"; return "gen";
}
// Profil holen und Zeiten an die Timeline dieses Starts anpassen (MECO, SECO)
function profileFor(l){
  const k=profileKey(l), B=PROFILES[k];
  const tl=rx=>{ const e=(l.timeline||[]).find(t=>rx.test(t.type?.abbrev||"")); return e?relSec(e.relative_time):null; };
  const kn=[[0,0]], mA=tl(/^(MECO|BECO)\b/i), sA=tl(/^SECO(-1)?$/i);
  if(mA>30 && mA/B.meco>0.6 && mA/B.meco<1.6) kn.push([B.meco,mA]);
  if(sA>(kn[kn.length-1][1]+30) && sA/B.seco>0.6 && sA/B.seco<1.6) kn.push([B.seco,sA]);
  const warp=t=>{ for(let i=1;i<kn.length;i++) if(t<=kn[i][0]){ const [p0,a0]=kn[i-1],[p1,a1]=kn[i]; return a0+(t-p0)*(a1-a0)/(p1-p0); }
    const [p0,a0]=kn[kn.length-1]; return a0+(t-p0); };
  return {key:k,name:B.name,fit:kn.length-1,pts:B.pts.map(p=>[warp(p[0]),p[1],p[2],p[3]]),ev:B.ev.map(e=>[warp(e[0]),e[1]])};
}
function profAt(P,t){ const p=P.pts; if(t<=0) return {h:0,v:0,d:0};
  for(let i=1;i<p.length;i++) if(t<=p[i][0]){ const f=(t-p[i-1][0])/(p[i][0]-p[i-1][0]), m=j=>p[i-1][j]+f*(p[i][j]-p[i-1][j]); return {h:m(1),v:m(2),d:m(3)}; }
  const e=p[p.length-1]; return {h:e[1],v:e[2],d:e[3],orbit:true}; }
function profEnd(P){ return P.pts[P.pts.length-1][0]; }
// Startazimut: aus Bahnneigung + Breite (Kugel), korrigiert um die Erddrehung am Startplatz
function launchAzimuth(lat,inc,south){ const r=Math.PI/180, s=Math.cos(inc*r)/Math.cos(lat*r);
  let az=Math.asin(Math.max(-1,Math.min(1,s)))/r; if(south) az=180-az;
  const v=7.8, vx=v*Math.sin(az*r)-0.4651*Math.cos(lat*r), vy=v*Math.cos(az*r); return (Math.atan2(vx,vy)/r+360)%360; }
// Kleines SVG-Diagramm: Höhe (blau) und Tempo (orange) über T+, mit Ereignissen
function profileSvg(P){
  const W=400,H=170,pl=34,pr=40,pt=12,pb=22,tE=profEnd(P), hM=niceMax(Math.max(...P.pts.map(p=>p[1]))), vM=niceMax(Math.max(...P.pts.map(p=>p[2])));
  const X=t=>pl+t/tE*(W-pl-pr), Yh=h=>H-pb-h/hM*(H-pt-pb), Yv=v=>H-pb-v/vM*(H-pt-pb);
  const line=(f,c)=>`<polyline points="${P.pts.map(p=>X(p[0]).toFixed(1)+","+f(p).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="2"/>`;
  const step=60*Math.max(1,niceMax(tE/60/5)); let ticks=""; for(let t=0;t<=tE;t+=step) ticks+=`<text x="${X(t)}" y="${H-6}" text-anchor="middle">T+${mmss(t)}</text>`;
  const evs=P.ev.filter(e=>e[0]<=tE+1).map(e=>`<line x1="${X(e[0])}" x2="${X(e[0])}" y1="${pt}" y2="${H-pb}" stroke="#3a4560" stroke-dasharray="2 3"><title>${esc(e[1])}</title></line>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:460px;height:auto;display:block" role="img" aria-label="Geschätztes Aufstiegsprofil">
    <g font-size="10" fill="#8a96ad">${ticks}
    <text x="${pl-4}" y="${pt+4}" text-anchor="end" fill="#4ea1ff">${hM}</text><text x="${pl-4}" y="${H-pb}" text-anchor="end">0</text>
    <text x="${W-pr+4}" y="${pt+4}" fill="#f5a142">${(vM/1000).toLocaleString(LOC)}k</text>
    <text x="${pl+4}" y="${pt+10}" fill="#4ea1ff">Höhe km</text><text x="${W-pr-4}" y="${pt+10}" text-anchor="end" fill="#f5a142">Tempo km/h</text></g>
    <path d="M${pl} ${H-pb}H${W-pr}" stroke="#232c3f"/>${evs}${line(p=>Yh(p[1]),"#4ea1ff")}${line(p=>Yv(p[2]),"#f5a142")}</svg>`;
}
function profileSection(l,est){
  const P=est.prof; if(!P) return "";
  const fmtV=v=>Math.round(v/100)*100;
  return `<div class="sec"><h3>Aufstieg (geschätzt)</h3>${profileSvg(P)}
    <ul class="tl" style="margin-top:8px">${P.ev.map(e=>{ const q=profAt(P,e[0]); return `<li><span>T+${mmss(e[0])}</span><span>${esc(e[1])} <span class="mute">· ${Math.round(q.h)} km · ${fmtV(q.v).toLocaleString(LOC)} km/h</span></span></li>`; }).join("")}</ul>
    <div class="note">Typisches Profil ${esc(P.name)}${P.fit?`, an die Timeline dieses Starts angepasst (${P.fit===2?"MECO und SECO":"MECO"})`:" (keine Timeline-Zeiten zum Anpassen)"}. Höhe und Tempo sind Schätzungen, keine Messwerte.</div></div>`;
}
