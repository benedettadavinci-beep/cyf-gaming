// città: parigi
// La scheda di Parigi: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Parigi si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.parigi = ({ lowGeos, markerGeos, foodGeos, streetTrees, morrisColumn, paveTexture }) => ({
  tall: morrisColumn, low: lowGeos.planterStone,
  fa: 'croissant', faG: foodGeos.croissant, fb: 'macaron', fbG: foodGeos.macaron,
  ramp: ['#3f5a42', '#5a7a5e'], gate: ['#2753b8', '#d8352a'], marker: markerGeos.potelet,
  tallCrash: 'crashColumn', lowCrash: 'crashPlanter', markerCrash: 'crashBollard',
  walls: ['#ddd2bc', '#e2d8c4', '#d8cbb2', '#e8dfcc', '#d2c6ae', '#e5dcc8'],
  street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.platano, every: 16 } }, props: [['autoParigi', 4.3]], setback: 2.6,   // Champs-Élysées: platani davanti ai palazzi, qualche auto
  style: 'haussmann', roof: '#6a7078', bldH: [13, 10], ground: () => paveTexture({ seed: 43, size: 18, joint: '#3a3835', tones: [[128, 122, 114], [142, 136, 126], [118, 114, 108]] }),
  theme: { sky: ['#4a7dbd', '#a4c2dd', '#e8e4da'], fog: '#e4e1d8', hemi: ['#f2ecdc', '#aaa298'], sun: '#fff0d0', spray: '#c2b8a8', sprayOp: 0.5, trail: '#2a2623', trailOp: 0.18, rough: 0.9, part: { col: '#c08a3c', size: 0.15, fall: 0.5, sway: 1.5, op: 0.9 } }
});
