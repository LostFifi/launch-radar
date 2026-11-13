// ===================== Karte =====================
const map = L.map("map",{zoomControl:false,worldCopyJump:true,minZoom:2,maxZoom:14,zoomSnap:0.5,wheelPxPerZoomLevel:90}).setView([25,-40],3);
L.control.zoom({position:"bottomleft"}).addTo(map);
// Hintergrund: Esri World Dark Gray (ohne API-Schlüssel). Auf hochauflösenden Bildschirmen (Handy, Retina) werden
// Kacheln der nächsten Zoomstufe in halber Grösse geladen → scharf statt verpixelt.
// Beschriftungen als eigene Ebene über Nacht-Schatten und Routen, in normaler Grösse (sonst zu klein zum Lesen).
map.createPane("fallback").style.zIndex=150;                     // Offline-Weltkarte liegt UNTER den Kacheln
map.createPane("labels"); map.getPane("labels").style.zIndex=420; map.getPane("labels").style.pointerEvents="none";
const ESRI="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/{style}/MapServer/tile/{z}/{y}/{x}";
L.tileLayer(ESRI,{style:"World_Dark_Gray_Base",maxNativeZoom:15,maxZoom:15,detectRetina:true,   // Retina: Leaflet zieht 1 Stufe ab und lädt z+1
  attribution:'Karte &copy; Esri, HERE, Garmin, &copy; OpenStreetMap | Daten: The Space Devs'}).addTo(map);
L.tileLayer(ESRI,{style:"World_Dark_Gray_Reference",maxNativeZoom:16,maxZoom:14,pane:"labels"}).addTo(map);
map.attributionControl.addAttribution('<a href="datenschutz.html" target="_blank" rel="noopener">Datenschutz</a>');
// Eingebaute Weltkarte (nur sichtbar, wenn die Kacheln nicht laden: offline / in Vorschauen)
// Für die 2D-Karte: Polygone über die Datumsgrenze (Fiji, Russland) entwirren – sonst entstehen Querstreifen
const WORLD2D=JSON.parse(JSON.stringify(WORLD));
(function(){ const fx=ring=>{ const lo=ring.map(p=>p[0]); if(Math.max(...lo)-Math.min(...lo)<=180||Math.min(...ring.map(p=>p[1]))<-60) return ring; return ring.map(p=>[p[0]<0?p[0]+360:p[0],p[1]]); };
  WORLD2D.features.forEach(f=>{ const g=f.geometry; g.coordinates = g.type==="Polygon" ? g.coordinates.map(fx) : g.coordinates.map(pl=>pl.map(fx)); }); })();
for(const sh of [-360,0,360]) L.geoJSON(WORLD2D,{coordsToLatLng:c=>L.latLng(c[1],c[0]+sh),style:{color:"#3a4560",weight:.7,fillColor:"#1a2133",fillOpacity:1},interactive:false,pane:"fallback"}).addTo(map);
const padLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);

let curK = 0, curP = null, follow = false, playSpeed = 60, curHdg = 0, launches = [], filter = "all", selected = null, simTimer = null, rocketMarker = null, curTrack = null, curPos = null, padGroups = [];
