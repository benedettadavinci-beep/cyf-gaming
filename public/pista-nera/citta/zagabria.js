// città: zagabria
// La scheda di Zagabria: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Zagabria si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.zagabria = ({ lowGeos, markerGeos, foodGeos, genLamp, paveTexture }) => ({
  tall: () => genLamp({ pole: '#3a3d42', lamp: '#f5e3a0', kind: 'gas' }), low: lowGeos.crateStack,
  fa: 'licitar', faG: foodGeos.licitar, fb: 'strukli', fbG: foodGeos.strukli,
  ramp: ['#b07a45', ['#d8352a', '#f4f4f4']], gate: [['#d8352a', '#f4f4f4'], ['#f4f4f4', '#d8352a']], marker: markerGeos.ghisa,
  tallCrash: 'crashLamp', lowCrash: 'crashCrate', markerCrash: 'crashBollard',
  walls: ['#e8dcc8', '#e2d0b4', '#d8c8ac', '#e8e0d0', '#dfd4bc', '#e5d8c0'],
  props: [['umbrellaDolac', 2.8], ['tramZagabria', 11], ['umbrellaDolac', 2.8]], setback: 2.6, street: { L: 'bldg', R: 'bldg' },   // Ilica: il tram blu
  style: 'altbau', roof: '#8a4a3a', bldH: [10, 12], ground: () => paveTexture({ seed: 61, size: 13, joint: '#3a3632', tones: [[118, 110, 100], [132, 122, 110], [106, 100, 92]] }),
  theme: { sky: ['#5b83b8', '#a2bcd4', '#e6e8e6'], fog: '#e2e4e2', hemi: ['#eef0ec', '#a8aca4'], sun: '#f6f0dc', spray: '#bcb8b0', sprayOp: 0.5, trail: '#2a2a28', trailOp: 0.18, rough: 0.9 }
});
