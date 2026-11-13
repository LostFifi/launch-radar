// ===================== Simulierte Zeit (Zeitraffer) =====================
var SIM={speed:1,base:Date.now(),anchor:Date.now()};
function simNow(){ return new Date(SIM.base+(Date.now()-SIM.anchor)*SIM.speed); }
