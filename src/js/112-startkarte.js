// ===================== Startkarte (erster Eindruck) =====================
// Solange kein Fenster offen ist: grosse Karte mit dem nächsten Start + Countdown und zwei klaren Knöpfen.
// Wird von updateNext() (050) jede Sekunde aufgerufen. × blendet sie für diese Sitzung aus → dann wieder der kleine „Nächster:“-Chip.
var HERO={id:null, off:false};
try{ HERO.off=sessionStorage.getItem("lr_hero_off")==="1"; }catch(e){}
function heroClose(){ HERO.off=true; try{ sessionStorage.setItem("lr_hero_off","1"); }catch(e){} heroUpdate(null); }
function heroUpdate(n){
  let el=document.getElementById("hero");
  const panelOpen=getComputedStyle(document.getElementById("panel")).display!=="none";
  const busy=panelOpen || document.getElementById("layers")?.style.display==="block";
  const show=!!n && !HERO.off && !busy;
  document.getElementById("next").style.display=show?"none":"";
  if(!show){ if(el) el.style.display="none"; return; }
  if(!el){ el=document.createElement("div"); el.id="hero"; document.body.appendChild(el); }
  el.style.display="";
  const st=launchState(n), past=new Date(n.net)<Date.now();
  if(HERO.id!==n.id){ HERO.id=n.id;
    const name=(n.name.split("|")[1]||n.name).trim(), rocket=n.rocket?.configuration?.name||n.name.split("|")[0].trim();
    el.innerHTML=`<button class="hx" onclick="heroClose()" aria-label="${i18n("Schliessen")}">×</button>
      <div class="hrow">${imgTag(n,true)}<div class="hmain">
        <div class="hk" id="heroK"></div>
        <div class="hn">${esc(name)}</div>
        <div class="hs"><span>${esc(rocket)}</span> · <span>${esc(shortLoc(n.pad?.location?.name)||"")}</span></div>
      </div></div>
      <div class="hcd" id="heroCd"></div>
      <div class="hd2" id="heroDt"></div>
      <div class="hb"><button class="btn" id="heroGo">${i18n("Verfolgen")}</button><button class="btn sec2" id="heroAll">${i18n("Alle Starts")}</button></div>`;
    el.querySelector("#heroGo").onclick=()=>select(n);
    el.querySelector("#heroAll").onclick=()=>document.getElementById("listBtn").click();
  }
  document.getElementById("heroK").innerHTML=past?(st==="unconfirmed"?`<span style="color:var(--tbd)">${i18n("Startzeit vorbei, nicht bestätigt")}</span>`:`<span class="hlive">${i18n("Gerade gestartet")}</span>`):i18n("Nächster Start");
  document.getElementById("heroCd").textContent=countdown(n.net);
  document.getElementById("heroDt").textContent=fmtDate(n.net);
}
