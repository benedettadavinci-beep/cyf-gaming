// modulo: rilievo
// dipende da: base
// R-513, seconda parte (riga 4 dei prossimi passi, dalla 0.40.0): neve e asfalto con il rilievo. Il terreno della pista
// prende una "mappa delle normali" ricavata dalla sua stessa piastrella dipinta (le righe della neve battuta, i
// sampietrini di Roma, le pietre di Napoli, la grana dell'asfalto): i punti chiari sono un po' più alti di quelli scuri,
// così con la luce del sole le righe della neve e le fughe tra le pietre fanno ombre e riflessi piccoli e si vede il
// rilievo; sulla neve in più una grana fine e casuale. Niente immagini da scaricare: si calcola una volta per scenario
// (tela di 512 punti sul PC e 256 sul telefono, meno di 50 ms) e si ricorda.
// Effetto pesante solo dove il dispositivo regge (R-513): con qualità alta e media sì, con la bassa no. Se la qualità
// automatica (A-14) cambia mentre si gioca, passo() se ne accorge e accende o spegne il rilievo.
// Solo grafica: la forma della pista, la guida e le collisioni non cambiano.
// Si crea con PN.rilievo({ materiale, grafica, telefono }) una volta sola, dal gioco: materiale è quello del terreno
// (con la sua piastrella in `map`), grafica la qualità automatica (dà livello). Il gioco chiama applica(scenario) dopo
// aver messo la piastrella dello scenario, e passo() a ogni fotogramma (costa un confronto).
window.PN = window.PN || {};
PN.rilievo = (() => {
  // quanto si vede il rilievo: neve più morbida, pietre e sampietrini più marcati
  const FORZA = { neve: 0.5, roma: 1.1, napoli: 1.1 };
  const FORZA_CITTA = 0.8;
  const GRANA = { neve: 0.06 };   // grana casuale in più (0 = solo il disegno della piastrella)
  const ACCESO = { alta: true, media: true, bassa: false };
  return ({ materiale, grafica, telefono }) => {
    const { mulberry32 } = PN.base;
    const LATO = telefono ? 256 : 512;
    const cache = new Map();   // piastrella → mappa delle normali
    let scenario = null, livello = null, costruite = 0, msUltima = 0;

    // altezza = luminosità della piastrella (più la grana), poi la pendenza con le differenze tra i vicini; i bordi si
    // leggono dall'altra parte (la piastrella si ripete), così non si vedono giunture
    function costruisci(mappa, nome) {
      const t0 = performance.now();
      const src = mappa.image;
      const c = document.createElement('canvas'); c.width = c.height = LATO;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0, LATO, LATO);
      const px = g.getImageData(0, 0, LATO, LATO), d = px.data, N = LATO * LATO;
      const h = new Float32Array(N), rr = mulberry32(17), grana = GRANA[nome] || 0;
      for (let i = 0; i < N; i++) h[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255 + (rr() - 0.5) * grana;
      // un passaggio di sfocatura leggera: il rilievo è morbido, non a gradini
      const m = new Float32Array(N);
      for (let y = 0; y < LATO; y++) for (let x = 0; x < LATO; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += h[((y + dy + LATO) % LATO) * LATO + (x + dx + LATO) % LATO] * (dx && dy ? 1 : dx || dy ? 2 : 4);
        m[y * LATO + x] = s / 16;
      }
      const K = LATO / 64;   // pendenza in proporzione alla misura della tela (stessa forza sul PC e sul telefono)
      for (let y = 0; y < LATO; y++) for (let x = 0; x < LATO; x++) {
        const a = (yy, xx) => m[((yy + LATO) % LATO) * LATO + (xx + LATO) % LATO];
        const gx = (a(y - 1, x + 1) + 2 * a(y, x + 1) + a(y + 1, x + 1)) - (a(y - 1, x - 1) + 2 * a(y, x - 1) + a(y + 1, x - 1));
        const gy = (a(y + 1, x - 1) + 2 * a(y + 1, x) + a(y + 1, x + 1)) - (a(y - 1, x - 1) + 2 * a(y - 1, x) + a(y - 1, x + 1));
        // nella tela y cresce verso il basso, nella texture verso l'alto: per questo il segno di gy è diverso
        let nx = -gx * K, ny = gy * K, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const o = (y * LATO + x) * 4;
        d[o] = Math.round((nx * 0.5 + 0.5) * 255); d[o + 1] = Math.round((ny * 0.5 + 0.5) * 255); d[o + 2] = Math.round((nz * 0.5 + 0.5) * 255); d[o + 3] = 255;
      }
      g.putImageData(px, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.copy(mappa.repeat);
      tex.anisotropy = mappa.anisotropy;
      costruite++; msUltima = performance.now() - t0;
      return tex;
    }

    function metti() {
      const mappa = materiale.map;
      const prima = !!materiale.normalMap;
      if (!ACCESO[livello] || !mappa || !mappa.image) { materiale.normalMap = null; }
      else {
        if (!cache.has(mappa)) cache.set(mappa, costruisci(mappa, scenario));
        materiale.normalMap = cache.get(mappa);
        const f = FORZA[scenario] ?? FORZA_CITTA;
        materiale.normalScale.set(f, f);
      }
      if (prima !== !!materiale.normalMap) materiale.needsUpdate = true;   // con o senza rilievo il programma è diverso
    }
    function applica(nome) { scenario = nome; livello = grafica.livello; metti(); }
    function passo() { if (scenario && grafica.livello !== livello) { livello = grafica.livello; metti(); } }
    const conta = () => ({ acceso: !!materiale.normalMap, lato: LATO, costruite, msUltima: +msUltima.toFixed(1), forza: materiale.normalScale.x });
    return { applica, passo, conta, FORZA, FORZA_CITTA, ACCESO };
  };
})();
