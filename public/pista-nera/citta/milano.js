// città: milano
// La scheda di Milano: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Milano si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.milano = ({ lowGeos, markerGeos, foodGeos, genLamp, paveTexture }) => ({
  tall: () => genLamp({ pole: '#2a2c30', lamp: '#f5e3a0', kind: 'gas' }), low: lowGeos.panettone,
  fa: 'cotoletta', faG: foodGeos.cotoletta, fb: 'risotto', fbG: foodGeos.risotto,
  ramp: ['#8a9299', '#c4372b'], gate: ['#e8e8e8', '#c4372b'], marker: markerGeos.ghisa,
  tallCrash: 'crashLamp', lowCrash: 'crashBollard', markerCrash: 'crashBollard',
  walls: ['#e8dcc8', '#d8c8ac', '#e2d0b4', '#cfc0a8', '#e8e2d2', '#d2bfa0'],
  street: { L: 'bldg', R: 'bldg' }, setback: 1.2,   // corso Vittorio Emanuele II: pedonale, palazzi con vetrine, niente tram
  style: 'altbau', roof: '#7d8287', bldH: [12, 16], ground: () => paveTexture({ seed: 41, size: 14, joint: '#2e2c2a', tones: [[96, 90, 86], [108, 100, 94], [88, 84, 82]], rails: true }),
  theme: { sky: ['#5a84b0', '#9fb6cc', '#e0e3e4'], fog: '#dcdfe0', fogN: 40, fogF: 150, hemi: ['#e8ecf0', '#a8adb4'], sun: '#f2ead8', spray: '#b8bcc0', sprayOp: 0.5, trail: '#2a2a2c', trailOp: 0.18, rough: 0.9 }
});
