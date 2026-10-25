// città: napoli
// La scheda di Napoli: ostacoli alti e bassi, bonus, rampa, porte, segnaletica, facciate, lati della strada, luce.
// Riceve il catalogo K dei modelli condivisi (moduli/citta.js) e restituisce la scheda. Per cambiare l'aspetto di
// Napoli si tocca solo questo file; la pista (forma, ostacoli, tempi) resta uguale per tutte le città (R-309).
// I vincoli di ogni riga sono nella tabella CYF-elementi-per-citta.xlsx e in tools/verifica/tabella_citta.json.
window.PN = window.PN || {};
PN.citta.schede = PN.citta.schede || {};
PN.citta.schede.napoli = ({ GEO, streetTrees, stoneTexture }) => ({
  tall: () => GEO.palms[0], low: () => GEO.rockCity,
  fa: 'pizza', faG: () => GEO.pizza, fb: 'coffee', fbG: () => GEO.coffee,
  ramp: ['#b07a45', '#f2c230'], gate: ['#d8302a', '#2766c6'], marker: () => GEO.bollard,
  tallCrash: 'crashTree', lowCrash: 'crashRock', markerCrash: 'crashBollard',
  walls: ['#e7b65c', '#dd8a5c', '#c9573f', '#f1d999', '#e9a98a', '#d8c7a6', '#b85a43', '#f3e6cf'],
  street: { L: 'bldg', R: 'sea', trees: { geo: streetTrees.palma, every: 26, off: 22.6, sides: [-1] } }, props: [['autoNapoli', 4.3]],   // via Partenope: mare a destra, palazzi e palme a sinistra
  style: 'napoli', roof: '#a89a88', bldH: [10, 14], ground: stoneTexture,
  theme: { sky: ['#2a7fd6', '#86c2ee', '#e6edf1'], fog: '#e1e8ec', hemi: ['#f6ecdc', '#b3a493'], sun: '#fff0cf', spray: '#c7beb3', sprayOp: 0.55, trail: '#262321', trailOp: 0.2, rough: 0.9 }
});
