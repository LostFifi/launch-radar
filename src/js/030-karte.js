// ===================== Karte =====================
const map = L.map("map",{zoomControl:false,worldCopyJump:true,minZoom:2}).setView([25,-40],3);
L.control.zoom({position:"bottomleft"}).addTo(map);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",{
  attribution:'Karte &copy; Esri | Daten: The Space Devs (Launch Library 2)',maxZoom:12}).addTo(map);
// Eingebaute Weltkarte (funktioniert auch offline / in Vorschauen)
// Für die 2D-Karte: Polygone über die Datumsgrenze (Fiji, Russland) entwirren – sonst entstehen Querstreifen
const WORLD2D=JSON.parse(JSON.stringify(WORLD));
(function(){ const fx=ring=>{ const lo=ring.map(p=>p[0]); if(Math.max(...lo)-Math.min(...lo)<=180||Math.min(...ring.map(p=>p[1]))<-60) return ring; return ring.map(p=>[p[0]<0?p[0]+360:p[0],p[1]]); };
  WORLD2D.features.forEach(f=>{ const g=f.geometry; g.coordinates = g.type==="Polygon" ? g.coordinates.map(fx) : g.coordinates.map(pl=>pl.map(fx)); }); })();
for(const sh of [-360,0,360]) L.geoJSON(WORLD2D,{coordsToLatLng:c=>L.latLng(c[1],c[0]+sh),style:{color:"#3a4560",weight:.7,fillColor:"#1a2133",fillOpacity:1},interactive:false}).addTo(map);
const padLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);

let curK = 0, curP = null, follow = false, playSpeed = 60, curHdg = 0, launches = [], filter = "all", selected = null, simTimer = null, rocketMarker = null, curTrack = null, curPos = null, padGroups = [];
