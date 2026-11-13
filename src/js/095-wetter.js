// ===================== Wetter am Startplatz (Open-Meteo, gratis, ohne Schlüssel) =====================
// Vorhersage für die Startstunde (bis 15 Tage im Voraus) + eigene Faustregeln → Einschätzung (GESCHÄTZT).
// Die offizielle Wetter-Prognose des Betreibers (l.probability, z.B. 45th Weather Squadron) steht separat.
const WX_VARS="temperature_2m,precipitation_probability,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cape,weather_code,wind_speed_250hPa";
var WXC={}; try{ WXC=JSON.parse(localStorage.getItem("lr_wx")||"{}"); }catch(e){}
function weatherSection(l){
  const dt=new Date(l.net)-Date.now();
  if(dt<-2*3600e3 || dt>15*864e5) return "";
  return `<div class="sec" id="wxSec"><h3>Wetter am Startplatz</h3><div class="mute">Vorhersage wird geladen …</div></div>`;
}
async function loadWeather(l){
  const box=document.getElementById("wxSec"); if(!box) return;
  const lat=(+l.pad.latitude).toFixed(2), lon=(+l.pad.longitude).toFixed(2), key=lat+","+lon;
  let j=WXC[key]&&Date.now()-WXC[key].ts<3600e3?WXC[key].j:null;     // 1 h zwischenspeichern
  if(!j){ try{ const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${WX_VARS}&wind_speed_unit=kmh&timezone=UTC&forecast_days=16`);
      if(!r.ok) throw r.status; j=await r.json(); WXC[key]={ts:Date.now(),j};
      for(const k in WXC) if(Date.now()-WXC[k].ts>6*3600e3) delete WXC[k];
      try{ localStorage.setItem("lr_wx",JSON.stringify(WXC)); }catch(e){} }
    catch(e){ if(selected===l && document.getElementById("wxSec")) box.innerHTML=`<h3>Wetter am Startplatz</h3><div class="mute">Wettervorhersage nicht erreichbar (offline?).</div>`; return; } }
  if(selected!==l) return;
  const H=j.hourly, t=new Date(l.net), iso=t.toISOString().slice(0,13)+":00", i=H.time.indexOf(iso);
  if(i<0){ box.innerHTML=`<h3>Wetter am Startplatz</h3><div class="mute">Keine Vorhersage für diese Startzeit.</div>`; return; }
  const v=k=>H[k][i], w=wxAssess(v);
  const dirs=["N","NO","O","SO","S","SW","W","NW"], dir=dirs[Math.round(v("wind_direction_10m")/45)%8];
  box.innerHTML=`<h3>Wetter am Startplatz <span class="mute" style="text-transform:none;letter-spacing:0">· ${fmtDate(l.net)}</span></h3>
    <div class="wxhead"><span class="pill" style="background:${w.col};color:#000">${w.label}</span><span class="mute">${esc(wxText(v("weather_code")))}</span></div>
    <div class="tiles wxt">
      <div class="tile"><small>Wind (Böen)</small><div class="big">${Math.round(v("wind_speed_10m"))}<span class="u"> (${Math.round(v("wind_gusts_10m"))}) km/h</span></div><small>aus ${dir}</small></div>
      <div class="tile"><small>Wolken</small><div class="big">${Math.round(v("cloud_cover"))}<span class="u"> %</span></div><small>Regen ${v("precipitation_probability")??"–"} %</small></div>
      <div class="tile"><small>Gewitter-Energie</small><div class="big">${Math.round(v("cape"))}<span class="u"> J/kg</span></div><small>CAPE</small></div>
      <div class="tile"><small>Höhenwind (~10 km)</small><div class="big">${Math.round(v("wind_speed_250hPa"))}<span class="u"> km/h</span></div><small>${Math.round(v("temperature_2m"))} °C am Boden</small></div>
    </div>
    ${w.why.length?`<ul class="tl" style="margin-top:8px">${w.why.map(x=>`<li><span style="min-width:0;color:${x[0]}">●</span><span>${esc(x[1])}</span></li>`).join("")}</ul>`:""}
    <div class="note">Vorhersage Open-Meteo für die Startstunde. Einschätzung nach eigenen Faustregeln (geschätzt) – die Grenzwerte sind je Rakete verschieden.
      ${l.probability!=null&&l.probability>=0?` Offizielle Prognose des Betreibers: <b style="color:var(--text)">${l.probability}% Wetter-Go</b>.`:""}</div>`;
}
// Faustregeln, angelehnt an typische Startregeln (Falcon 9: Bodenwind ~55 km/h, Blitz-/Ambossregeln, Höhenwind-Scherung)
function wxAssess(v){
  const why=[], R="#ff6b6b", Y="#f5b041";
  const gust=v("wind_gusts_10m"), code=v("weather_code"), cape=v("cape"), rain=v("precipitation_probability")||0, cl=v("cloud_cover"), up=v("wind_speed_250hPa");
  if(gust>55) why.push([R,`Starke Böen (${Math.round(gust)} km/h) – über üblichen Grenzwerten`]); else if(gust>40) why.push([Y,`Böig (${Math.round(gust)} km/h) – nahe an Grenzwerten`]);
  if(code>=95) why.push([R,"Gewitter vorhergesagt – Blitzregeln verbieten den Start"]); else if(cape>1000) why.push([Y,`Gewitter möglich (CAPE ${Math.round(cape)} J/kg)`]);
  if(rain>=60) why.push([Y,`Regen wahrscheinlich (${rain} %) – oft mit dicken Wolken (Cumulus-Regel)`]);
  if(cl>=90 && (rain>=40||cape>500)) why.push([Y,"Dichte Bewölkung – Risiko für ausgelöste Blitze"]);
  if(up>200) why.push([Y,`Sehr starker Höhenwind (${Math.round(up)} km/h) – Scherung kann zum Abbruch führen`]);
  const red=why.some(x=>x[0]===R), yel=why.length>0;
  return {why, label:red?"Wetter kritisch":yel?"Wetter unsicher":"Wetter gut", col:red?"#ff6b6b":yel?"#f5b041":"#2ecc71"};
}
function wxText(c){ return c==null?"":c===0?"klar":c<=2?"leicht bewölkt":c===3?"bedeckt":c<=48?"Nebel":c<=57?"Niesel":c<=67?"Regen":c<=77?"Schnee":c<=82?"Regenschauer":c<=86?"Schneeschauer":"Gewitter"; }
