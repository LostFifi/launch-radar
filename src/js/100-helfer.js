// ===================== Helfer =====================
function norm(lo){ return ((lo+540)%360)-180; }
function hav(a,b){ const r=Math.PI/180, dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r;
  const h=Math.sin(dLa/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)**2; return 2*R_E*Math.asin(Math.sqrt(h)); }
function ytId(u){ if(!u) return null; const m=u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/); return m?m[1]:null; }
function esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmtDate(d){ return new Date(d).toLocaleString("de-CH",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function mmss(t){ t=Math.max(0,Math.floor(t)); const h=Math.floor(t/3600); return (h?h+":":"")+String(Math.floor(t%3600/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0"); }
function countdown(net){
  let s=Math.floor((new Date(net)-Date.now())/1000), sign="T−";
  if(s<0){sign="T+"; s=-s;}
  const d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60), x=s%60;
  return `${sign} ${d?d+"d ":""}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`;
}
function fmtRel(iso){ // z.B. "PT2M30S", "-PT45M"
  if(!iso) return ""; const neg=iso.startsWith("-");
  const m=iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/); if(!m) return iso;
  const s=(+m[1]||0)*86400+(+m[2]||0)*3600+(+m[3]||0)*60+Math.round(+m[4]||0);
  const h=Math.floor(s/3600), mi=Math.floor(s%3600/60), se=s%60;
  return (neg?"T− ":"T+ ")+(h?h+":":"")+String(mi).padStart(2,"0")+":"+String(se).padStart(2,"0");
}
// Bild: online Originalbild, sonst eingebettetes Vorschaubild, sonst ausblenden
function imgTag(l,small){ const im=l.image&&typeof l.image==="object"?l.image:null; if(!im) return small?'<div class="th"></div>':"";
  const th=im.thumbnail_url||"", src=small?(th||im.image_url):(im.image_url||th);
  return `<img class="${small?"th":""}" loading="lazy" alt="" src="${esc(src)}" data-th="${esc(th)}" onerror="imgFail(this)">`; }
function imgFail(el){ const s=IMG_SNAP[el.dataset.th]; el.onerror=null;
  if(s && el.src!==s) el.src=s; else if(el.classList.contains("th")) el.style.visibility="hidden"; else el.closest(".hero")?.remove(); }
function toast(t){ const m=document.getElementById("msg"); m.textContent=t; m.style.display="block"; setTimeout(()=>m.style.display="none",5000); }
