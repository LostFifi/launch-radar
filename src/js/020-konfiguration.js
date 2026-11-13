// ===================== Konfiguration =====================
const API = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=40&mode=detailed&hide_recent_previous=false";
const API_DEV = API.replace("ll.thespacedevs","lldev.thespacedevs"); // Fallback (keine Rate-Limits, evtl. älter)
const CACHE_MIN = 15;  // Free-API erlaubt ~15 Abrufe/Stunde → Cache
const OMEGA_E = 7.2921159e-5, R_E = 6371;

// Bekannte Landezonen (Fallback, falls API keine Koordinaten liefert)
const LZ = {
  "LZ-1":[28.4858,-80.5444], "LZ-2":[28.4876,-80.5441], "LZ-40":[28.5618,-80.5772],
  "LZ-4":[34.6328,-120.6156], "SLC-6":[34.5813,-120.6266],
  "STARBASE":[25.9967,-97.1543], "OLP-A":[25.9967,-97.1543], "OLP-B":[25.9963,-97.1559]
};
