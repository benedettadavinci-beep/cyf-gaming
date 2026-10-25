// città: zurigo
// La scheda di Zurigo: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Zurigo si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.zurigo = ({ lowGeos, markerGeos, foodGeos, streetTrees, genTree, paveTexture }) => ({
  tall: () => genTree({ trunk: '#5f4a38', cols: ['#2f5a28', '#3a6a30', '#285022'], r: 1.5, dots: '#f0e8d0', seed: 19 }), low: lowGeos.cheese,
  fa: 'cioccolato', faG: foodGeos.cioccolato, fb: 'luxemburgerli', fbG: foodGeos.luxemburgerli,
  ramp: ['#b07a45', '#5aa0d8'], gate: ['#e8e8e8', '#5aa0d8'], marker: markerGeos.zhPole,
  tallCrash: 'crashTree', lowCrash: 'crashCheese', markerCrash: 'crashPole',
  walls: ['#e2d8c4', '#d8c8b0', '#e8e0d0', '#cfc0a8', '#e5dcc8', '#d2c4ac'],
  props: [['tramZurigo', 12]], setback: 2.6, street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.tiglio, every: 20 } },   // Bahnhofstrasse: tram e tigli, niente auto
  style: 'napoli', roof: '#7a4a3a', bldH: [9, 10], ground: () => paveTexture({ seed: 71, size: 15, joint: '#3a3835', tones: [[130, 124, 116], [144, 138, 128], [120, 116, 108]], rails: true }),
  theme: { sky: ['#2e7ac8', '#93c0e6', '#ecf2f6'], fog: '#e8eef2', hemi: ['#f2f6fa', '#a8b2b8'], sun: '#fcf6e4', spray: '#c4c8cc', sprayOp: 0.5, trail: '#2a2c2e', trailOp: 0.18, rough: 0.9 }
});
