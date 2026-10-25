// città: lisbona
// La scheda di Lisbona: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Lisbona si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.lisbona = ({ lowGeos, markerGeos, foodGeos, streetTrees, genTree, calcadaTexture }) => ({
  tall: () => genTree({ trunk: '#6a5a4a', cols: ['#8a6ab8', '#9a7ac8', '#7a5aa8'], r: 1.45, dots: '#b89ad8', seed: 13 }), low: lowGeos.crate,
  fa: 'nata', faG: foodGeos.nata, fb: 'sardina', fbG: foodGeos.sardina,
  ramp: ['#b07a45', '#e8c33c'], gate: ['#3f7a3a', '#d8352a'], marker: markerGeos.stonePill,
  tallCrash: 'crashTree', lowCrash: 'crashCrate', markerCrash: 'crashBollard',
  walls: ['#d8e2e4', '#c2d4dc', '#e8d2b4', '#efe4ce', '#b8d0d8', '#e2c0a4'],
  props: [['tramLisbona', 8.5]], setback: 2.6, street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.jacaranda, every: 15 } },   // Avenida da Liberdade: file di alberi
  style: 'azulejos', style2: 'altbau', roof: '#b4603f', bldH: [9, 10], ground: calcadaTexture,
  theme: { sky: ['#2f86d8', '#8fc4ea', '#eef0ea'], fog: '#eaece6', hemi: ['#f6f0e2', '#aab0ac'], sun: '#fff4d4', spray: '#c8c4b8', sprayOp: 0.5, trail: '#2a2a28', trailOp: 0.18, rough: 0.9 }
});
