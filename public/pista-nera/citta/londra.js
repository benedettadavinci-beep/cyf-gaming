// città: londra
// La scheda di Londra: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Londra si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.londra = ({ lowGeos, markerGeos, foodGeos, genTree, asphaltTexture }) => ({
  tall: () => genTree({ trunk: '#8a7a5a', trunk2: '#a89a78', cols: ['#4a7a3a', '#5a8a46', '#3f6b32'], r: 1.5, seed: 5 }), low: lowGeos.planterBrick,
  fa: 'tea', faG: foodGeos.tea, fb: 'fishchips', fbG: foodGeos.fishchips,
  ramp: ['#b07a45', '#c4372b'], gate: ['#d8352a', '#2753b8'], marker: markerGeos.ukBollard,
  tallCrash: 'crashTree', lowCrash: 'crashPlanter', markerCrash: 'crashBollard',
  walls: ['#9a6a4e', '#8a5a40', '#b08060', '#7a4a34', '#a06a4a', '#8f5f44'],
  props: [['phoneBox', 1], ['taxiLondra', 4.3], ['busLondra', 10.5], ['taxiLondra', 4.3]], setback: 2.6, edge: 'lines', street: { L: 'bldg', R: 'bldg' },   // Oxford Street: bus rossi e taxi neri
  style: 'brick', roof: '#55585c', bldH: [9, 10], ground: () => asphaltTexture({ seed: 47, base: '#3a3d40', wet: true }),
  theme: { sky: ['#6a7585', '#9aa4ae', '#d4d7d9'], fog: '#d2d5d8', hemi: ['#dde2e8', '#9aa0a8'], sun: '#e8e8e4', spray: '#bcd4e2', sprayOp: 0.65, trail: '#3a4248', trailOp: 0.3, rough: 0.6, part: { col: '#a8c2d4', size: 0.05, fall: 9, sway: 0, op: 0.45 } }
});
