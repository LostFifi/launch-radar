// ===================== Tag/Nacht-Grenze =====================
var nightLayer=null, lastNight=0;
function sunPos(d){ const n=d.getTime()/86400000+2440587.5-2451545.0, r=Math.PI/180;
  const L0=(280.46+0.9856474*n)%360, g=(357.528+0.9856003*n)*r, lam=(L0+1.915*Math.sin(g)+0.02*Math.sin(2*g))*r, eps=(23.439-4e-7*n)*r;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lam)), ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam));
  const gmst=(280.46061837+360.98564736629*n)%360; return {lat:dec/r, lon:norm(ra/r-gmst)}; }
function nightPoly(sun){ const dec=Math.abs(sun.lat)<0.2?(sun.lat<0?-0.2:0.2):sun.lat, pts=[];
  for(let lo=-180;lo<=180;lo+=2) pts.push([Math.atan(-Math.cos((lo-sun.lon)/D)/Math.tan(dec/D))*D,lo]);
  const pole=dec>0?-85:85; return [...pts,[pole,180],[pole,-180]]; }
function updateNight(force){
  const now=Date.now(); if(!force && SIM.speed===1 && now-lastNight<30e3) return; lastNight=now;
  if(!map.getPane("night")){ map.createPane("night"); map.getPane("night").style.zIndex=350; map.getPane("night").style.pointerEvents="none"; }
  if(nightLayer){ map.removeLayer(nightLayer); nightLayer=null; }
  if(!LAYERS.night) return;
  const sun=sunPos(simNow()), poly=nightPoly(sun);
  nightLayer=L.layerGroup([-360,0,360].flatMap(sh=>[
    L.polygon(poly.map(p=>[p[0],p[1]+sh]),{pane:"night",stroke:false,fillColor:"#000",fillOpacity:.5,interactive:false})])).addTo(map);
}
function nightGlobe(c,path,proj){
  if(!LAYERS.night) return; const sun=sunPos(simNow()), anti=[sun.lon+180,-sun.lat];
  c.beginPath(); path(d3.geoCircle().center([sun.lon,sun.lat]).radius(84)()); c.fillStyle="rgba(140,180,255,.10)"; c.fill();
  c.beginPath(); path(d3.geoCircle().center(anti).radius(96)()); c.fillStyle="rgba(0,0,12,.25)"; c.fill();
  c.beginPath(); path(d3.geoCircle().center(anti).radius(90)()); c.fillStyle="rgba(0,0,12,.5)"; c.fill();

}
