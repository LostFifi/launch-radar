// ===================== Bekannte Missionsprofile =====================
// Für Missionen, bei denen die API keine Timeline liefert, aber der Ablauf öffentlich bekannt ist (Presse-Kit,
// NASASpaceFlight). Ergänzt die Schätzung in estimateProfile()/payloadPlan(): Bahnneigung, Anzahl Satelliten,
// Zeitfenster fürs Aussetzen, Deorbit/Wiedereintritt der Oberstufe und zusätzliche Timeline-Schritte.
// Zeiten in Sekunden nach dem Abheben. Neue Einträge oben einfügen (erster Treffer gilt).
const MISSION_PROFILES=[
  { // ULA Vulcan mit Amazon Leo (ehemals Kuiper): 2 Centaur-Zündungen bis 450 km / 51,9°, 21 Trennungen ab T+1:17
    // über 25:40 Min, danach 219 s Freiflug und 3. Zündung → Wiedereintritt über dem Pazifik.
    match:(l,r,n)=>/vulcan/.test(r) && /amazon leo|kuiper/.test(n),
    src:"laut ULA-Missionsprofil (NASASpaceFlight)",
    inc:51.9, alt:450, n:n=>/\blv-01\b/.test(n)?40:null,
    deploy:[4620,6160], deorbit:6380,
    // Zeitpunkt des Wiedereintritts nicht veröffentlicht: geschätzt, wann die Bahn nach der Zündung den Südpazifik erreicht
    reentry:10200,
    events:[[4620,"Erste Satelliten-Trennung"],[6160,"Letzte Trennung (21 Trennvorgänge)"],
      [6380,"Centaur: 3. Zündung (Deorbit)"],[10200,"Centaur: Wiedereintritt über dem Südpazifik (Zeit geschätzt)"]] },
  { // Progress-Frachter (Sojus-2.1a/b): Trennung bei T+8:48, schnelles 2-Orbit-Rendezvous mit der ISS
    match:(l,r,n)=>/soyuz|sojus/.test(r) && /progress/.test(n), src:"typischer Ablauf Progress (2-Orbit-Rendezvous)",
    inc:51.64, n:()=>1, deploy:[528,528], dock:12300, events:[[528,"Progress trennt sich von der Oberstufe"],[12300,"Andocken an die ISS (typisch ca. 3,5 h)"]] },
  { // Sojus-MS mit Besatzung: gleiches schnelles Rendezvous
    match:(l,r,n)=>/soyuz|sojus/.test(r) && /soyuz ms|sojus ms/.test(n), src:"typischer Ablauf Sojus MS (2-Orbit-Rendezvous)",
    inc:51.64, n:()=>1, deploy:[528,528], dock:11400, events:[[528,"Sojus trennt sich von der Oberstufe"],[11400,"Andocken an die ISS (typisch ca. 3 h)"]] },
  { // Shenzhou (Langer Marsch 2F): Trennung ~T+9:50, Andocken an Tiangong nach rund 6,5 h
    match:(l,r,n)=>/shenzhou/.test(n), src:"typischer Ablauf Shenzhou (schnelles Rendezvous)",
    inc:41.5, n:()=>1, deploy:[590,590], dock:23400, events:[[590,"Shenzhou trennt sich von der Rakete"],[23400,"Andocken an Tiangong (typisch ca. 6,5 h)"]] },
  { // Tianzhou-Frachter (Langer Marsch 7): Trennung ~T+10 Min, Andocken nach rund 3 h
    match:(l,r,n)=>/tianzhou/.test(n), src:"typischer Ablauf Tianzhou (schnelles Rendezvous)",
    inc:41.5, n:()=>1, deploy:[600,600], dock:11000, events:[[600,"Tianzhou trennt sich von der Rakete"],[11000,"Andocken an Tiangong (typisch ca. 3 h)"]] },
  { // Amazon Leo allgemein (andere Raketen): nur die Bahnneigung der ersten Schale ist sicher
    match:(l,r,n)=>/amazon leo|kuiper/.test(n), inc:51.9, alt:450, src:"Bahnebene der Konstellation" },
];
function missionProfile(l){
  if(!l) return null; if(l._mp!==undefined) return l._mp;
  const r=(l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"").toLowerCase(), n=(l.name||"").toLowerCase();
  const p=MISSION_PROFILES.find(x=>x.match(l,r,n))||null;
  const out=p?{...p, n:typeof p.n==="function"?p.n(n):p.n}:null;
  try{ Object.defineProperty(l,"_mp",{value:out,enumerable:false,configurable:true}); }catch(e){}
  return out;
}
// Art eines Ereignisses (Farbe auf der Karte)
function evKind(txt,s,est){ const t=String(txt).toLowerCase();
  if(/dock|andock|berth/.test(t)) return "dock";
  if(/trennt sich von|letzte trennung|nutzlast|payload|satellit|deploy|spacecraft sep|dragon sep|ausgesetzt/.test(t) && !/kick|stage \d|stufe \d|booster|fairing|verkleidung/.test(t)) return "pay";
  if(/deorbit|reentry|re-entry|wiedereintritt|landing|landung|splash|catch|wasserung/.test(t)) return "land";
  return s<=((est?.prof?.pts?.slice(-1)[0]?.[0])||600)+60 ? "asc" : "burn"; }
// Alle Ereignisse eines Starts: offizielle Timeline der API – sonst erzeugt aus Aufstiegsprofil, bekanntem
// Missionsprofil (oben), Nutzlast-Plan und Oberstufe. {s: Sekunden nach T-0, txt, kind, gen: erzeugt?}
function launchEvents(l,est){
  if(l.timeline?.length) return l.timeline.map(t=>{ const s=relSec(t.relative_time)??0, txt=t.type?.abbrev||t.type?.description||""; return {s,txt,kind:evKind(txt,s,est),rel:fmtRel(t.relative_time)}; })
    .sort((a,b)=>a.s-b.s);
  let ev=[]; try{ ev=(est?.prof?.ev || PROFILES[profileKey(l)]?.ev || []).map(([s,txt])=>[s,txt]); }catch(e){}
  const mp=missionProfile(l);
  if(mp?.events) ev=ev.concat(mp.events);
  else {
    const pp=payloadPlan(l);
    if(pp){ if(pp.n>1 && pp.t1>pp.t0) ev.push([pp.t0,"Erste Nutzlast-Trennung"],[pp.t1,"Letzte Nutzlast-Trennung"]); else ev.push([pp.t0,"Nutzlast-Trennung"]); }
    const st=est?.stage; if(st?.mode==="deorbit"){ ev.push([st.Td,"Oberstufe: Deorbit-Zündung"],[st.Tre,"Oberstufe: Wiedereintritt"]); }
  }
  return ev.filter(e=>e[0]>0).sort((a,b)=>a[0]-b[0]).map(([s,txt])=>({s,txt,kind:evKind(txt,s,est),rel:"T+ "+mmss(s),gen:true,note:mp?.events?"ungefähr":"geschätzt"}));
}
