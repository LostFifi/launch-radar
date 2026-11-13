// ===================== Vollständige Prüfung: Statistik täglich, Raketen-Datenbank wöchentlich =====================
const LL="https://ll.thespacedevs.com/2.3.0";
async function getAll(url,maxPages){ let out=[], next=url, k=0;
  while(next && k<maxPages){ const r=await fetch(next); if(!r.ok) throw r.status; const j=await r.json(); out=out.concat(j.results||[]); next=j.next; k++;
    if(next) await new Promise(res=>setTimeout(res,1500)); }
  return out; }
function cacheGet(k){ try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch(e){ return null; } }
function cacheSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
function statsFrom(list,year){
  const S={year,asof:new Date().toLocaleDateString(LOC),cut:list.reduce((m,x)=>x.net>m?x.net:m,year+"-01-01T00:00:00Z"),
    provAll:{},ctyAll:{},rockAll:{},total:0,status:{},month:Array(12).fill(0)};
  list.forEach(l=>{ const a=l.status?.abbrev||"?"; S.total++; S.status[a]=(S.status[a]||0)+1; S.month[new Date(l.net).getMonth()]++;
    const pv=l.launch_service_provider?.name||"?", cn=l.pad?.country?.name||l.pad?.location?.country?.name||"?", rk=l.rocket?.configuration?.full_name||l.rocket?.configuration?.name||"?";
    S.provAll[pv]=(S.provAll[pv]||0)+1; const c2=CN_DE[cn]||cn; S.ctyAll[c2]=(S.ctyAll[c2]||0)+1; S.rockAll[rk]=(S.rockAll[rk]||0)+1; });
  S.prov=topN(S.provAll,8); S.cty=topN(S.ctyAll,7); S.rock=topN(S.rockAll,10); return S; }
function rocketFrom(c){ const man=c.manufacturer||{}, cty=Array.isArray(man.country)?man.country[0]:man.country, d=(c.description||"").trim();
  return {id:c.id,n:c.name,v:c.variant||"",fam:(c.families||[]).map(x=>x.name).join(", "),man:man.name||"",mab:man.abbrev||"",cty:cty?.alpha_2_code||"",
    act:!!c.active,reu:!!c.reusable,leo:c.leo_capacity,gto:c.gto_capacity,sso:c.sso_capacity,thr:c.to_thrust,len:c.length,dia:c.diameter,mass:c.launch_mass,cost:c.launch_cost,
    tot:c.total_launch_count||0,suc:c.successful_launches||0,fail:c.failed_launches||0,pend:c.pending_launches||0,al:c.attempted_landings||0,sl:c.successful_landings||0,
    csl:c.consecutive_successful_landings,first:c.maiden_flight,img:c.image?.thumbnail_url||null,wiki:c.wiki_url,d:d.slice(0,420)+(d.length>420?"…":"")}; }
async function fullStats(force){
  const c=cacheGet("lr_full_stats");
  if(c && !force && Date.now()-c.ts<24*3600e3){ STATS0=c.S; FULL.stats=c.ts; return; }
  const y=new Date().getFullYear();
  const list=await getAll(`${LL}/launches/previous/?mode=normal&limit=100&ordering=net&net__gte=${y}-01-01T00:00:00Z`,6);
  if(!list.length) return;
  const S=statsFrom(list.filter(l=>!/^(TBD|TBC|Go|Hold)$/.test(l.status?.abbrev||"")),y);
  STATS0=S; FULL.stats=Date.now(); cacheSet("lr_full_stats",{ts:FULL.stats,S});
}
async function fullDB(force){
  const c=cacheGet("lr_full_db");
  if(c && !force && Date.now()-c.ts<7*24*3600e3){ ROCKETS0=c.R; RCUT=new Date(c.ts).toISOString(); FULL.db=c.ts; return; }
  const list=await getAll(`${LL}/launcher_configurations/?mode=detailed&limit=100`,8);
  if(list.length<100) return;                                     // unvollständig → alten Stand behalten
  const R=list.filter(x=>!x.is_placeholder).map(rocketFrom);
  ROCKETS0=R; FULL.db=Date.now(); RCUT=new Date(FULL.db).toISOString();
  if(!cacheSet("lr_full_db",{ts:FULL.db,R})){ const R2=R.map(x=>({...x,d:x.d.slice(0,160)})); cacheSet("lr_full_db",{ts:FULL.db,R:R2}); }
}
async function fullCheck(){
  // gespeicherte Vollstände sofort nutzen
  const cs=cacheGet("lr_full_stats"), cd=cacheGet("lr_full_db");
  if(cs){ STATS0=cs.S; FULL.stats=cs.ts; } if(cd){ ROCKETS0=cd.R; RCUT=new Date(cd.ts).toISOString(); FULL.db=cd.ts; }
  await refreshCounts(false);
  // fällige Vollprüfungen zeitversetzt (Abfragelimit der Gratis-API schonen)
  setTimeout(async()=>{ try{ const due=!cs||Date.now()-cs.ts>=24*3600e3; if(due){ await fullStats(true); await refreshCounts(true); } }catch(e){ console.warn("Statistik-Prüfung",e); } },90e3);
  setTimeout(async()=>{ try{ const due=!cd||Date.now()-cd.ts>=7*24*3600e3; if(due){ await fullDB(true); await refreshCounts(true); } }catch(e){ console.warn("DB-Prüfung",e); } },6*60e3);
}
