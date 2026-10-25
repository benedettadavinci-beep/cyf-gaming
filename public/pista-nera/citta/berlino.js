// città: berlino
// La scheda di Berlino: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Berlino si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.berlino = ({ lowGeos, markerGeos, foodGeos, streetTrees, genTree, asphaltTexture }) => ({
  tall: () => genTree({ trunk: '#6a5a46', cols: ['#5a8a3e', '#6a9a48', '#4f7a36'], r: 1.5, seed: 17 }), low: lowGeos.graffitiBlock,
  fa: 'currywurst', faG: foodGeos.currywurst, fb: 'berliner', fbG: foodGeos.berliner,
  ramp: ['#9aa0a6', '#b05ad0', true], gate: ['#d8352a', '#d4a017'], marker: markerGeos.ampel,
  tallCrash: 'crashTree', lowCrash: 'crashBlock', markerCrash: 'crashLight',
  walls: ['#c8c2b4', '#b8ac9c', '#cfc8ba', '#a8a096', '#bfb8a8', '#c2bcae'],
  props: [['wallBerlino', 6]], setback: 2.6, edge: 'walk', street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.tiglio, every: 12 } },   // Unter den Linden: file fitte di tigli
  style: 'altbau', roof: '#6d7276', bldH: [13, 12], ground: () => asphaltTexture({ seed: 67, base: '#4a4d50' }),
  theme: { sky: ['#5d7792', '#9fb0bf', '#dfe2e4'], fog: '#dcdfe1', hemi: ['#e6e9ec', '#9ea4a8'], sun: '#eeeee6', spray: '#b4b8bc', sprayOp: 0.5, trail: '#2c2e30', trailOp: 0.18, rough: 0.9 }
});
