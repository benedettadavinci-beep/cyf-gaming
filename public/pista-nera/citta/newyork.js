// città: newyork
// La scheda di New York: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// New York si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.newyork = ({ lowGeos, markerGeos, foodGeos, genLamp, asphaltTexture }) => ({
  tall: () => genLamp({ pole: '#2e3034', lamp: '#f5e3a0', kind: 'ny' }), low: lowGeos.trashBags,
  fa: 'hotdog', faG: foodGeos.hotdog, fb: 'bagel', fbG: foodGeos.bagel,
  ramp: ['#8a9299', '#e8c33c'], gate: ['#e8842a', '#2753b8'], marker: markerGeos.hydrant,
  tallCrash: 'crashLamp', lowCrash: 'crashTrash', markerCrash: 'crashHydrant',
  walls: ['#7a4a34', '#8a5a40', '#6a3f2c', '#9a6a4e', '#5f3a2a', '#845640'],
  props: [['taxiNY', 4.7], ['taxiNY', 4.7]], setback: 2.6, street: { L: 'bldg', R: 'bldg' },   // Broadway: grattacieli e taxi gialli
  style: 'brickfe', roof: '#4a4d52', bldH: [28, 32], ground: () => asphaltTexture({ seed: 73, base: '#3f4144', lines: '#d8b02c', manholes: true }),
  theme: { sky: ['#4a7bb8', '#95b4d0', '#e2e3de'], fog: '#dedfda', hemi: ['#eceee8', '#a0a4a0'], sun: '#f6eeda', spray: '#b0b4b8', sprayOp: 0.5, trail: '#28292b', trailOp: 0.18, rough: 0.9 }
});
