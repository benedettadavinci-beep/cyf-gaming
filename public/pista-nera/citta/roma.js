// città: roma
// La scheda di Roma: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Roma si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.roma = ({ GEO, lowGeos, markerGeos, streetTrees, sampietriniTexture }) => ({
  tall: () => GEO.pines[0], low: lowGeos.columnDrum,
  fa: 'carbonara', faG: () => GEO.carbonara, fb: 'artichoke', fbG: () => GEO.carciofo,
  ramp: ['#ddd2bc', '#c9a227'], gate: ['#8e2434', '#d4a017'], marker: markerGeos.nasone,
  tallCrash: 'crashTree', lowCrash: 'crashColumn', markerCrash: 'crashFountain',
  walls: ['#d9a35a', '#c8703f', '#b24f33', '#e6c184', '#edd7a8', '#cf8e5c', '#a9503c', '#e9c99a'],
  street: { L: 'ruins', R: 'ruins', trees: { geo: streetTrees.pino, every: 24, off: 23 } },   // via dei Fori Imperiali: pini e ruderi su entrambi i lati
  style: 'roma', roof: '#a9583b', bldH: [10, 14], ground: sampietriniTexture,
  theme: { sky: ['#2f7cc8', '#92c1e6', '#efe5d6'], fog: '#e8e0d2', hemi: ['#f7ead8', '#b49b82'], sun: '#fff0cc', spray: '#c9bfb2', sprayOp: 0.5, trail: '#2a2623', trailOp: 0.18, rough: 0.92 }
});
