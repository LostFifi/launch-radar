// Erzeugt data/world.json (Ländergrenzen, 1:110 Mio., gerundet) aus world-atlas
const t=require("world-atlas/countries-110m.json"), tc=require("topojson-client"), fs=require("fs"), path=require("path");
const g=tc.feature(t,t.objects.countries);
const r=a=>Array.isArray(a[0])?a.map(r):[+a[0].toFixed(2),+a[1].toFixed(2)];
g.features.forEach(f=>{f.geometry.coordinates=r(f.geometry.coordinates);f.properties={};delete f.id});
fs.writeFileSync(path.join(__dirname,"..","data","world.json"),JSON.stringify(g));
console.log("world.json geschrieben");
