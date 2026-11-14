// ===================== Sprache (Deutsch / Englisch) =====================
// Quelltexte sind Deutsch. Für Englisch übersetzt eine Schicht alle angezeigten Texte (Textknoten + title/placeholder/
// aria-label) über das Wörterbuch I18N_EN (006-i18n-en.js): exakte Treffer oder Muster mit Platzhaltern {0},{1} …
// Texte ausserhalb des Fensters (Meldungen, Benachrichtigungen, Canvas) laufen über i18n().
// Sprache: ?lang=en|de → gespeicherte Wahl (lr_lang) → Standard Englisch (Umschalter im Ebenen-Menü).
var LANG=(()=>{ const q=new URLSearchParams(location.search).get("lang"); if(q==="en"||q==="de"){ try{ localStorage.setItem("lr_lang",q); }catch(e){} return q; }
  try{ const s=localStorage.getItem("lr_lang"); if(s==="en"||s==="de") return s; }catch(e){}
  return "en"; })();
const LOC=LANG==="en"?"en-GB":"de-CH";
document.documentElement.lang=LANG;
function setLang(l){ try{ localStorage.setItem("lr_lang",l); }catch(e){} const u=new URL(location.href); u.searchParams.delete("lang"); location.href=u.toString(); }

// Wörterbuch vorbereiten: exakte Einträge (Map) + Muster ({0}… → Regex)
let I18N_MAP=null, I18N_PAT=null;
function i18nPrep(){
  if(I18N_MAP) return; I18N_MAP=new Map(); I18N_PAT=[];
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  for(const [de,en] of Object.entries(typeof I18N_EN==="object"?I18N_EN:{})){
    // {0} = beliebiger Text, {n0} = nur Zahl (damit z.B. „{n0} Start“ keinen API-Text wie „Burn Start“ trifft)
    if(/\{n?\d\}/.test(de)){ const parts=de.split(/(\{n?\d\})/), order=[];
      const rx=parts.map(p=>{ const m=p.match(/^\{(n?)(\d)\}$/); if(m){ order.push(+m[2]); return m[1]?"([\\d.,'’\\u202f\\s]*\\d)":"(.+?)"; } return esc(p); }).join("");
      I18N_PAT.push({rx:new RegExp("^"+rx+"$"),order,en}); }
    else I18N_MAP.set(de,en); }
  I18N_PAT.sort((a,b)=>b.rx.source.length-a.rx.source.length);   // spezifischere Muster zuerst
}
// Übersetzt einen ganzen Text (Leerraum aussen bleibt erhalten). Platzhalter werden selbst wieder übersetzt (z.B. „{0} Starts“).
function i18n(s,depth){
  if(LANG!=="en"||s==null) return s; s=String(s); i18nPrep();
  const m=s.match(/^(\s*)([\s\S]*?)(\s*)$/), core=m[2]; if(!core) return s;
  let r=I18N_MAP.get(core);
  if(r==null && !(depth>2)) for(const p of I18N_PAT){ const x=core.match(p.rx); if(x){ const v=x.slice(1); r=p.en.replace(/\{(\d)\}/g,(_,i)=>i18n(v[p.order.indexOf(+i)],(depth||0)+1)); break; } }
  return r==null?s:m[1]+r+m[3];
}
// Live-Übersetzung des Fensters
const I18N_ATTR=["title","placeholder","aria-label"];
function i18nNode(n){
  if(n.nodeType===3){ const v=n.nodeValue; if(v&&v.trim()){ const r=i18n(v); if(r!==v) n.nodeValue=r; } return; }
  if(n.nodeType!==1||n.tagName==="SCRIPT"||n.tagName==="STYLE"||n.closest?.("[translate=no]")) return;
  for(const a of I18N_ATTR){ const v=n.getAttribute&&n.getAttribute(a); if(v){ const r=i18n(v); if(r!==v) n.setAttribute(a,r); } }
  for(const c of n.childNodes) i18nNode(c);
}
if(LANG==="en"){
  const run=()=>{ i18nNode(document.body);
    new MutationObserver(ms=>{ for(const m of ms){
      if(m.type==="characterData") i18nNode(m.target);
      else if(m.type==="attributes") i18nNode(m.target);
      else m.addedNodes.forEach(i18nNode); } })
    .observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:I18N_ATTR}); };
  if(document.body) run(); else addEventListener("DOMContentLoaded",run);
  document.title=i18n(document.title);
}
// Umschalter (im Ebenen-Menü) – Sprachnamen stehen in beiden Sprachen gleich, daher translate="no"
function langMenuHtml(){ return `<h4>Sprache</h4><div translate="no" style="display:flex;gap:6px;margin:4px 0">
  <button class="chip ${LANG==="de"?"on":""}" onclick="setLang('de')">Deutsch</button><button class="chip ${LANG==="en"?"on":""}" onclick="setLang('en')">English</button></div>`; }
// Werkzeug: deutsche Texte im Fenster finden (Sammeln fürs Wörterbuch / Test auf Reste in Englisch)
const DE_HINT=/[äöüÄÖÜß]|\b(der|die|das|und|nicht|mit|von|für|bei|noch|kein|keine|Starts?|Höhe|Bahn|geschätzt|jetzt|zeigen|Liste|Ebenen|Raketen?|erinnern|Erinnerung|Tage|Woche|Monate|Stunden?|wird|werden|ist|sind|oder|aus|nach|vor|über|unter|zum|zur|im|am|Ort|Ziel|Stufe|Wetter|Wolken|Regen|Böen|Sicht|sichtbar|Mond|Sonne|Erde|Verkleidung|Brennschluss|Abflug|Ankunft|Daten|Stand|Uhr)\b/;
function findGerman(root){
  const out=new Set(), w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  for(let n=w.currentNode;n;n=w.nextNode()){
    if(n.nodeType===1){ if(n.closest("[translate=no],script,style")) continue; for(const a of I18N_ATTR){ const v=n.getAttribute(a); if(v&&DE_HINT.test(v)) out.add(v.trim()); } }
    else if(n.parentElement && !n.parentElement.closest("[translate=no],script,style")){ const v=n.nodeValue.trim(); if(v&&DE_HINT.test(v)) out.add(v); } }
  return [...out];
}
