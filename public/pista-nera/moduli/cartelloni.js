// modulo: cartelloni
// dipende da: base
// Cartelloni sui palazzi delle città (R-535, dalla 0.31.4, Luigi 18/11): sulla facciata verso la strada; dalla 0.31.5
// solo su 3 palazzi su 10 (Luigi: "troppe, riduci del 70%"), circa 4-5 per lato a vista.
// Oggi mostrano la sigla CYF; domani la pubblicità: immagini o loghi diversi, presi dall'elenco in config.js
// (window.CYF.cartelloni.annunci). Ogni annuncio è { immagine: 'https://…/logo.png' } oppure { testo: 'CYF' };
// un'immagine che non si carica mostra CYF al suo posto. Il palazzo n. i della pista mostra l'annuncio i % elenco,
// così tutti i giocatori vedono gli stessi cartelloni negli stessi posti (niente numeri casuali: la pista non cambia).
// Un solo pannello e un solo materiale per annuncio, condivisi da tutti i palazzi: pochi costi anche sul telefono.
// Sul portale (CrazyGames, Poki) gli annunci di terzi non sono ammessi: lì il gioco passa { soloCYF: true }.
// Si crea con PN.cartelloni({ ANISO, soloCYF }) dal gioco; pannello(lato) restituisce una Mesh pronta da attaccare.
window.PN = window.PN || {};
PN.cartelloni = ({ ANISO = 1, soloCYF = false } = {}) => {
  const { TAU } = PN.base;
  const LARGO = 6, ALTO = 3;   // metri: il formato 2:1 dei cartelloni stradali
  const CFG = (window.CYF && window.CYF.cartelloni) || {};
  const elenco = !soloCYF && Array.isArray(CFG.annunci) && CFG.annunci.length ? CFG.annunci : [{ testo: 'CYF' }];
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", Arial, sans-serif';
  const geo = new THREE.PlaneGeometry(LARGO, ALTO);
  const mats = [];

  // disegno di un cartellone con il testo (CYF, o il nome di un inserzionista senza immagine): fondo blu notte,
  // cornice bianca, scritta arancione come lo stemma; due puntini come sullo striscione degli archi (R-514)
  function texturaTesto(testo) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#13233a'; g.fillRect(0, 0, 512, 256);
    g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.strokeRect(7, 7, 498, 242);
    const corto = String(testo).length <= 4;
    g.font = '700 ' + (corto ? 170 : 90) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.strokeText(testo, 256, 136, 440);
    g.fillStyle = '#ff5a1f'; g.fillText(testo, 256, 136, 440);
    if (corto) { g.fillStyle = '#ffffff'; for (const x of [56, 456]) { g.beginPath(); g.arc(x, 128, 9, 0, TAU); g.fill(); } }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(8, ANISO);
    return t;
  }
  // materiale dell'annuncio n. i, fatto la prima volta che serve. Non prende luce (si legge anche controsole, come
  // un'insegna). Con un'immagine: prima CYF, poi l'immagine appena arriva; se non arriva resta CYF.
  function materiale(i) {
    if (mats[i]) return mats[i];
    const a = elenco[i] || {};
    const m = new THREE.MeshBasicMaterial({ map: texturaTesto(a.testo || 'CYF'), side: THREE.FrontSide });
    if (a.immagine) {
      const L = new THREE.TextureLoader(); L.setCrossOrigin('anonymous');
      L.load(a.immagine, t => { t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(8, ANISO); const vecchia = m.map; m.map = t; m.needsUpdate = true; vecchia.dispose(); }, undefined, () => {});
    }
    return (mats[i] = m);
  }
  // pannello per il palazzo n. n (contato dall'inizio della pista): una Mesh con la faccia davanti verso +z
  // (chi lo usa lo gira verso la strada)
  function pannello(n) {
    const m = new THREE.Mesh(geo, materiale(((n % elenco.length) + elenco.length) % elenco.length));
    m.userData.cartellone = true;
    return m;
  }
  return { LARGO, ALTO, pannello, quanti: () => elenco.length };
};
