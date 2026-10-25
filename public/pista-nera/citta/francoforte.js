// città: francoforte
// La scheda di Francoforte: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Francoforte si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.francoforte = ({ lowGeos, markerGeos, foodGeos, genTree, paveTexture }) => ({
  tall: () => genTree({ trunk: '#8a7a5a', trunk2: '#a89a78', cols: ['#4a7a3a', '#55843c', '#3f6b32'], r: 1.45, seed: 11 }), low: lowGeos.barrel,
  fa: 'bembel', faG: foodGeos.bembel, fb: 'brezel', fbG: foodGeos.brezel,
  ramp: ['#b07a45', '#c4372b'], gate: ['#d8352a', '#e8e8e8'], marker: markerGeos.fwPole,
  tallCrash: 'crashTree', lowCrash: 'crashBarrel', markerCrash: 'crashPole',
  walls: ['#efe8da', '#e8dcc8', '#f2ece0', '#e2d4ba', '#efe4ce', '#e8dcc2'],
  street: { L: 'bldg', R: 'bldg' },   // Römerberg: case a graticcio su entrambi i lati
  style: 'fachwerk', roof: '#6a4a3a', bldH: [8, 8], ground: () => paveTexture({ seed: 53, size: 16, joint: '#38342e', tones: [[122, 112, 100], [136, 126, 112], [110, 102, 92]] }),
  theme: { sky: ['#56759c', '#9db0c2', '#dfe1e2'], fog: '#dcdee0', hemi: ['#e8eaec', '#a4a8ac'], sun: '#f2eedd', spray: '#b8bcc0', sprayOp: 0.5, trail: '#2a2a2c', trailOp: 0.18, rough: 0.9 }
});
