// città: madrid
// La scheda di Madrid: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Madrid si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.madrid = ({ lowGeos, markerGeos, foodGeos, genTree, slabTexture }) => ({
  tall: () => genTree({ trunk: '#7a4a34', cols: ['#3f6b35', '#4a7a3e', '#35602c'], r: 1.3, h: 3.7, dots: '#d8403a', seed: 9 }), low: lowGeos.geraniumPot,
  fa: 'churro', faG: foodGeos.churro, fb: 'bocadillo', fbG: foodGeos.bocadillo,
  ramp: ['#a86a3a', ['#d8352a', '#e8c026']], gate: ['#d8352a', '#e8c026'], marker: markerGeos.bolard,
  tallCrash: 'crashTree', lowCrash: 'crashPot', markerCrash: 'crashBollard',
  walls: ['#c87f5a', '#d8a878', '#b86a48', '#e2c8a4', '#c08a5c', '#d2b490'],
  street: { L: 'bldg', R: 'bldg' }, props: [['taxiMadrid', 4.3]], setback: 2.6,   // Gran Vía: palazzi monumentali, taxi bianchi con la riga rossa
  style: 'haussmann', roof: '#8a5a3c', bldH: [16, 14], ground: () => slabTexture({ seed: 59, v0: 142 }),
  theme: { sky: ['#1f6fd0', '#7fb4e8', '#f0e8d8'], fog: '#ece4d4', hemi: ['#f8f0dc', '#b8a890'], sun: '#fff2c8', spray: '#c8b088', sprayOp: 0.5, trail: '#2a2623', trailOp: 0.18, rough: 0.92 }
});
