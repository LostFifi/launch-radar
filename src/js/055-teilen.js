// ===================== Link pro Start (teilen) =====================
// …/launch-radar/#start=<id> öffnet direkt diesen Start. Die Adresse wird beim Öffnen/Schliessen nachgeführt.
ICON.share='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
function setHash(id){ try{ history.replaceState(null,"",id?"#start="+encodeURIComponent(id):location.pathname+location.search); }catch(e){} }
function launchUrl(l){ return location.origin+location.pathname+"#start="+encodeURIComponent(l.id); }
async function shareLaunch(id){
  const l=[...launches,...(PAST||[])].find(x=>x.id===id); if(!l) return;
  const name=(l.name.split("|")[1]||l.name).trim(), url=launchUrl(l);
  const text=`${name} – ${i18n(new Date(l.net)>Date.now()?"Start":"gestartet")} ${fmtDate(l.net)}`;
  if(navigator.share){ try{ await navigator.share({title:"LaunchRadar: "+name,text,url}); return; }catch(e){ if(e.name==="AbortError") return; } }
  try{ await navigator.clipboard.writeText(url); toast(i18n("Link kopiert:")+" "+url); }
  catch(e){ prompt(i18n("Link zum Kopieren:"),url); }
}
// Beim ersten Laden: Start aus der Adresse öffnen (kommende, sonst vergangene Starts)
var hashDone=false;
async function openFromHash(){
  if(hashDone) return; const m=location.hash.match(/start=([\w-]+)/); if(!m){ hashDone=true; return; }
  if(!launches.length) return; hashDone=true;
  const id=decodeURIComponent(m[1]); let l=launches.find(x=>x.id===id);
  if(!l){ try{ l=(await loadPast()).find(x=>x.id===id); }catch(e){} }
  if(l) select(l); else toast("Dieser Start ist nicht mehr in der Liste");
}
addEventListener("hashchange",()=>{ hashDone=false; openFromHash(); });
