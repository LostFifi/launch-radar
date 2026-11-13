// ===================== Icons (SVG statt Emojis) =====================
const RK_PATH="M12 1.5c2.6 2.3 4.1 5.8 4.1 9.8v4.2l2.4 2.9v2.1l-4.6-1.6h-3.8l-4.6 1.6v-2.1l2.4-2.9v-4.2c0-4 1.5-7.5 4.1-9.8z";
const ICON={
  rocket:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="'+RK_PATH+'"/><circle cx="12" cy="9.5" r="1.7"/></svg>',
  list:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
  globe:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><ellipse cx="12" cy="12" rx="4.2" ry="9.5"/><path d="M2.5 12h19"/></svg>',
  map:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 3.5v14.5M15 6v14.5"/></svg>',
  layers:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l9.5 5-9.5 5-9.5-5z"/><path d="M2.5 12.5l9.5 5 9.5-5"/><path d="M2.5 16.5l9.5 5 9.5-5"/></svg>',
  stats:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/></svg>',
  clock:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  bell:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="vertical-align:-2px"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  sat:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" style="vertical-align:-2px"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M2 8.5l5 1v5l-5 1zM22 8.5l-5 1v5l5 1zM12 15v4"/></svg>',
  reuse:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#7be07b" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-1px"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>'
};
document.querySelectorAll("[data-ic]").forEach(el=>el.insertAdjacentHTML("afterbegin",ICON[el.dataset.ic]));
// Lande-Markierungen: Farbe je Art
const LAND={booster:{c:"#2ecc71",t:"Booster-Landung"},ship:{c:"#4ec9e0",t:"Drohnenschiff"},catch:{c:"#ffd25a",t:"Catch / Rückkehr"},splash:{c:"#c86bff",t:"Wasserung"},reentry:{c:"#ff6b3d",t:"Wiedereintritt"},impact:{c:"#8a96ad",t:"Absturzgebiet"}};
function landHtml(k){ return `<div class="lm" style="--c:${LAND[k].c}"></div>`; }
function bearing(a,b){ const r=Math.PI/180, la1=a[0]*r, la2=b[0]*r, dl=(b[1]-a[1])*r;
  return Math.atan2(Math.sin(dl)*Math.cos(la2), Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dl))/r; }
const RK2D=new Path2D(RK_PATH);
function drawRocket(c,x,y,ang){ c.save(); c.translate(x,y); c.rotate(ang); c.scale(1.15,1.15); c.translate(-12,-12);
  c.shadowColor="#4ea1ff"; c.shadowBlur=10; c.fillStyle="#fff"; c.fill(RK2D); c.shadowBlur=0; c.lineWidth=1.3; c.strokeStyle="#4ea1ff"; c.stroke(RK2D); c.restore(); }
function drawLandG(c,x,y,k){ c.save(); c.translate(x,y); c.rotate(Math.PI/4); c.fillStyle="#0b0f17"; c.strokeStyle=LAND[k].c; c.lineWidth=2.2; c.fillRect(-5,-5,10,10); c.strokeRect(-5,-5,10,10); c.restore(); }
