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
// Timeline-Schritte, wenn die API keine liefert: Aufstiegsprofil + bekannte Missionsschritte
function missionTimeline(l){
  const mp=missionProfile(l); if(!mp?.events) return [];
  let ev=[]; try{ ev=(PROFILES[profileKey(l)]?.ev||[]).slice(); }catch(e){}
  return ev.concat(mp.events).sort((a,b)=>a[0]-b[0]).map(([s,txt])=>({s,txt}));
}
