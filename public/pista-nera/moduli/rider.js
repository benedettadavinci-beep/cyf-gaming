// modulo: rider
// dipende da: base, calendario
// Il modello del rider (lo stesso per te e per gli avversari): forme arrotondate, giacca con lo stemma CYF e la maglia
// della città o il colore scelto (JERSEYS; dalla 0.23.0 anche le maglie esclusive della settimana, jerseyOf, R-245),
// capelli a caso tra 6 acconciature o scelti dal giocatore (setLook, myHair), tavola da neve o skateboard,
// pantaloni, casco e tipo di tavola scelti nella schermata "Modifica il personaggio" (setGear, myGear, R-227…R-229),
// posa (pose) che segue curva, salto, grab e switch.
// Solo modello e animazione: niente fisica, niente stato di gioco.
window.PN = window.PN || {};
PN.rider = (() => {
  const { TAU, lin, store, mulberry32 } = PN.base;
  // ---------- riders (local and remote share the same model) ----------
  const RM = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.7, metalness: 0 });
  const SHARED = { stripe: RM('#ff5a1f'), glove: RM('#141414'), boot: RM('#1b1b1b'), skin: RM('#dfae8c'), goggle: new THREE.MeshStandardMaterial({ color: lin('#ffb347'), roughness: 0.15, metalness: 0.6 }) };
  // skateboard (R-217): ruote da 9 cm di diametro e 4 cm di larghezza, da cruiser, con il mozzo scuro e il cuscinetto
  const WHEEL_R = 0.045, WHEEL_W = 0.04;
  const SKATE = {
    grip: RM('#1c1c1e'), truck: new THREE.MeshStandardMaterial({ color: lin('#9aa3ad'), roughness: 0.35, metalness: 0.7 }),
    hub: RM('#3a3f46'),
    wheelGeo: new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 28), hubGeo: new THREE.CylinderGeometry(WHEEL_R * 0.45, WHEEL_R * 0.45, WHEEL_W + 0.002, 18),
    lipGeo: new THREE.TorusGeometry(WHEEL_R - 0.004, 0.006, 8, 28)   // bordo arrotondato della ruota
  };
  // la tavola da skate sta sopra le ruote: rispetto alla tavola da neve il rider sale di LIFT
  const DECK_Y = WHEEL_R * 2 + 0.006, LIFT = DECK_Y + 0.012 - 0.068;
  // in città il rider è vestito da skater (R-218): viso scoperto, mani nude, scarpe da skate
  const STREET = { sole: RM('#f2f1ec'), shoe: RM('#2b2f36'), lace: RM('#e8e6df'), eye: RM('#f6f4ef'), iris: RM('#4a3426'), brow: RM('#4a3628'), lip: RM('#b07468') };
  const UP = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3(), tmpE = new THREE.Vector3(), tmpH = new THREE.Vector3(), GRAB_HAND = new THREE.Vector3(0.2, 0.12, -0.08);
  const PIVOT = new THREE.Vector3();
  // ruota il corpo attorno al baricentro (circa 0,6 m sopra la tavola), non attorno ai piedi
  // quanto il rider è girato al contrario (0 = normale, 1 = dopo un 180°), in modo continuo durante l'avvitamento
  const switchOf = spin => (1 - Math.cos(spin)) / 2;
  function bodyTurn(b, rx, ry, rz) {
    b.rotation.set(rx, ry, rz);
    PIVOT.set(0, 0.6, 0).applyEuler(b.rotation);
    b.position.set(-PIVOT.x, 0.6 - PIVOT.y, -PIVOT.z);
  }
  // ---------- modello del rider: forme arrotondate (niente cubi, testa e busto modellati) ----------
  const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  // lastra con i bordi arrotondati (tavole, deck): w = larghezza (x), l = lunghezza (z), h = spessore (y)
  function roundedSlab(w, l, r, h) {
    const s = new THREE.Shape(), x0 = -w / 2, y0 = -l / 2;
    s.moveTo(x0 + r, y0);
    s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    s.lineTo(x0 + w, y0 + l - r); s.quadraticCurveTo(x0 + w, y0 + l, x0 + w - r, y0 + l);
    s.lineTo(x0 + r, y0 + l); s.quadraticCurveTo(x0, y0 + l, x0, y0 + l - r);
    s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    const bev = Math.min(h * 0.4, 0.008);
    const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -(h - 2 * bev) / 2);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  const RIDER_GEO = {
    // busto: dai fianchi (y = 0) al collo, schiacciato davanti-dietro e largo di spalle
    // giacca da snowboard: scende sotto la vita e copre l'attacco del bacino
    torso: lathe([[0.001, 0.02], [0.13, -0.06], [0.15, -0.1], [0.152, -0.02], [0.144, 0.07], [0.136, 0.17], [0.15, 0.28], [0.168, 0.38], [0.166, 0.45], [0.135, 0.51], [0.075, 0.555], [0.001, 0.57]], 28).scale(0.74, 1, 1.22),
    band: lathe([[0.15, -0.105], [0.158, -0.09], [0.158, -0.055], [0.15, -0.045]], 28).scale(0.76, 1, 1.24),
    hood: new THREE.SphereGeometry(0.1, 16, 10).scale(0.55, 0.62, 1.15),
    zip: new THREE.BoxGeometry(0.008, 0.5, 0.014),
    // bacino con i pantaloni larghi: unisce le due cosce, niente fessura da manichino
    pelvis: new THREE.SphereGeometry(0.15, 22, 14).scale(0.78, 0.62, 1.14),
    collar: new THREE.TorusGeometry(0.062, 0.026, 8, 20).rotateX(Math.PI / 2),
    // testa a uovo, maschera da neve avvolgente con elastico
    head: lathe([[0.001, -0.125], [0.05, -0.12], [0.08, -0.095], [0.098, -0.04], [0.104, 0.02], [0.1, 0.08], [0.074, 0.125], [0.001, 0.142]], 24).scale(1.08, 1, 0.9),
    goggle: new THREE.CylinderGeometry(0.128, 0.128, 0.064, 26, 1, false, Math.PI / 2 - 1.0, 2.0).scale(1.1, 1, 0.98),
    goggleFrame: new THREE.CylinderGeometry(0.131, 0.131, 0.076, 26, 1, true, Math.PI / 2 - 1.05, 2.1).scale(1.1, 1, 0.98),
    strap: new THREE.TorusGeometry(0.15, 0.012, 6, 32).rotateX(Math.PI / 2).scale(1.1, 1, 0.99),
    nose: new THREE.SphereGeometry(0.024, 12, 8).scale(1.1, 1.3, 0.85),
    // scaldacollo tirato fin sopra il mento
    gaiter: lathe([[0.058, -0.2], [0.064, -0.14], [0.07, -0.09], [0.074, -0.05], [0.07, -0.03]], 22).scale(1.12, 1, 1.0),
    neck: new THREE.CylinderGeometry(0.048, 0.054, 0.14, 14),
    joint: r => new THREE.SphereGeometry(r, 14, 10),
    limb: r => new THREE.CylinderGeometry(r, r * 0.86, 1, 14),
    // arti modellati (y da -0,5 a 0,5, poi allungati fino alla lunghezza giusta): pantaloni larghi, maniche morbide
    thigh: lathe([[0.001, -0.5], [0.078, -0.5], [0.083, -0.36], [0.092, -0.08], [0.099, 0.22], [0.097, 0.44], [0.001, 0.5]], 18),
    shin: lathe([[0.001, -0.5], [0.09, -0.5], [0.086, -0.4], [0.077, -0.12], [0.081, 0.18], [0.08, 0.42], [0.001, 0.5]], 18),
    uarm: lathe([[0.001, -0.5], [0.066, -0.48], [0.068, -0.22], [0.063, 0.18], [0.058, 0.5], [0.001, 0.5]], 16),
    farm: lathe([[0.001, -0.5], [0.057, -0.5], [0.056, -0.22], [0.05, 0.22], [0.06, 0.38], [0.062, 0.5], [0.001, 0.5]], 16),
    // muffola con il pollice
    glove: new THREE.SphereGeometry(0.06, 16, 12).scale(0.85, 1.25, 0.95),
    thumb: new THREE.SphereGeometry(0.026, 10, 8).scale(1, 1.5, 1),
    cuff: new THREE.CylinderGeometry(0.062, 0.058, 0.07, 14),
    // scarponi ovali con la punta arrotondata
    boot: new THREE.CylinderGeometry(0.07, 0.078, 0.13, 16).scale(1.45, 1, 0.95),
    toe: new THREE.SphereGeometry(0.07, 14, 8, 0, TAU, 0, Math.PI / 2).scale(1.45, 0.6, 0.95),
    snowboard: roundedSlab(0.3, 1.5, 0.15, 0.03),
    stripe: roundedSlab(0.05, 1.1, 0.025, 0.006),
    binding: new THREE.CylinderGeometry(0.11, 0.11, 0.035, 18, 1, true, -Math.PI / 2, Math.PI).scale(1, 1, 0.75),
    baseplate: new THREE.CylinderGeometry(0.03, 0.036, 0.034, 12),
    kingpin: new THREE.CylinderGeometry(0.02, 0.024, 0.03, 10),
    // in città (R-218): viso e scarpe da skate
    // occhi a mandorla piccoli con l'iride grande (come quelli veri: il bianco si vede poco), sopracciglia sottili, labbra
    eye: new THREE.SphereGeometry(0.012, 14, 10).scale(0.5, 0.62, 1),
    iris: new THREE.SphereGeometry(0.0068, 12, 8).scale(0.45, 1, 1),
    brow: new THREE.CylinderGeometry(0.0032, 0.0032, 0.032, 8).rotateX(Math.PI / 2),
    mouth: new THREE.CylinderGeometry(0.0035, 0.0035, 0.036, 8).rotateX(Math.PI / 2),
    ear: new THREE.SphereGeometry(0.026, 12, 10).scale(0.55, 1.15, 0.45),
    sole: roundedSlab(0.1, 0.258, 0.045, 0.02),
    shoe: lathe([[0.001, 0], [0.052, 0], [0.056, 0.03], [0.05, 0.06], [0.034, 0.075], [0.001, 0.08]], 20).scale(2.35, 1, 0.92),
    lace: new THREE.BoxGeometry(0.06, 0.006, 0.05),
    hand: new THREE.SphereGeometry(0.052, 16, 12).scale(0.75, 1.25, 0.95)
  };
  // maglie delle città: solo i colori tradizionali, senza nomi o stemmi delle squadre
  // ---------- capelli (R-220): niente casco, sei acconciature, tre maschili e tre femminili ----------
  // Coordinate della testa: il davanti è +x, la cima della testa è a y = 0,142, raggio ~0,11. La calotta copre la
  // testa ed è inclinata all'indietro (la fronte resta scoperta); le acconciature lunghe hanno una "tenda" aperta davanti.
  // la calotta deve superare la cima della testa (y = 0,142): centro a y = 0,03 e un po' più alta che larga
  const cap = (r, th, rot) => { const g = new THREE.SphereGeometry(r, 30, 14, 0, TAU, 0, Math.PI * th).scale(1.08, 1.06, 0.93); g.rotateZ(rot); g.translate(-0.006, 0.03, 0); return g; };
  // tenda: capelli che scendono dietro e ai lati, aperti davanti (gap di 0,6π attorno a +x), dall'altezza y0 per h metri;
  // profilo morbido: aderente alla testa in alto, un po' gonfio a metà, le punte che rientrano
  const curtain = (rt, rb, h, y0) => {
    const pts = [[rt, 0], [rt * 1.06, -h * 0.25], [rb, -h * 0.6], [rb * 0.96, -h * 0.9], [rb * 0.82, -h]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 28, Math.PI * 0.8, Math.PI * 1.4).scale(1.05, 1, 0.95); g.translate(-0.012, y0, 0); return g;
  };
  const HAIR_STYLES = [
    { name: 'corti', female: false, parts: () => [cap(0.117, 0.56, 0.45)] },
    { name: 'rasati', female: false, parts: () => [cap(0.1135, 0.53, 0.5)] },
    { name: 'ciuffo', female: false, parts: () => { const q = new THREE.SphereGeometry(0.06, 18, 10).scale(1.25, 0.55, 1.45); q.rotateZ(-0.35); q.translate(0.055, 0.13, 0); return [cap(0.117, 0.56, 0.45), q]; } },
    { name: 'lunghi', female: true, parts: () => [cap(0.119, 0.6, 0.4), curtain(0.112, 0.132, 0.32, 0.06)] },
    { name: 'coda', female: true, parts: () => {
      const knot = new THREE.SphereGeometry(0.036, 14, 10); knot.translate(-0.125, 0.04, 0);
      const tail = new THREE.CylinderGeometry(0.032, 0.012, 0.22, 14); tail.rotateZ(-0.3); tail.translate(-0.16, -0.06, 0);
      return [cap(0.118, 0.58, 0.4), knot, tail]; } },
    { name: 'caschetto', female: true, parts: () => [cap(0.119, 0.6, 0.4), curtain(0.114, 0.124, 0.17, 0.05)] }
  ];
  const HAIR_COLORS = ['#1f1a17', '#3b2a1f', '#6b4a30', '#c9a25e', '#8a4a2a'];   // nero, castano scuro, castano, biondo, ramato
  const hairGeo = HAIR_STYLES.map(() => null), hairMat = {};
  const hairMaterial = c => hairMat[c] || (hairMat[c] = new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
  // acconciatura e colore scelti "a caso" ma sempre uguali per lo stesso giocatore: si parte dal suo codice (S-32)
  // capelli scelti dal giocatore (R-225): "forma:colore", per esempio "coda:3"; una parte vuota vuol dire "a caso"
  function lookOf(id, scelta) {
    let h = 2166136261;
    for (const ch of String(id || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const L = { style: h % HAIR_STYLES.length, color: (h >>> 8) % HAIR_COLORS.length };
    const [sn, ci] = String(scelta || '').split(':');
    const si = HAIR_STYLES.findIndex(x => x.name === sn);
    if (si >= 0) L.style = si;
    if (/^[0-9]$/.test(ci || '') && +ci < HAIR_COLORS.length) L.color = +ci;
    return L;
  }
  const HAIR_RE = /^[a-z]{0,12}:[0-9]?$/;
  const myHair = () => { const v = store.get('cyf.hair') || ''; return HAIR_RE.test(v) ? v : ''; };

  // ---------- pantaloni, casco e tavola (R-228) ----------
  // Si salvano come testo corto: pantaloni "3" (indice del colore), casco e tavola "tipo:colore" (es. "integrale:2").
  // Vuoto = come prima (pantaloni blu, niente casco, skate classico in legno e snowboard blu notte).
  const PANTS_DEFAULT = '#2a3d58';
  const PANTS = ['#3d5f8f', '#1f2126', '#6d727a', '#b8a07a', '#4f5b36', '#a3312a', '#e4e4df'];   // jeans, neri, grigi, beige, verde militare, rossi, bianchi
  const HELMETS = ['skate', 'integrale', 'sci'];
  const HELMET_COLORS = ['#eef0f2', '#1d1f24', '#d4322a', '#2a63c9', '#f0c419', '#ff6a1f'];     // bianco, nero, rosso, blu, giallo, arancione
  const BOARDS = ['classico', 'cruiser', 'longboard'];
  const BOARD_COLORS = ['#1d1f24', '#d4322a', '#2a63c9', '#1f8a4c', '#f0c419', '#e889b5', '#eef0f2', '#8a4fc4'];   // nero, rosso, blu, verde, giallo, rosa, bianco, viola
  const GEAR_RE = /^[a-z]{0,12}:[0-9]?$/, PANTS_RE = /^[0-9]?$/;
  const gearVal = (v, re) => (typeof v === 'string' && re.test(v) ? v : '');
  // pulisce le scelte (arrivate dal dispositivo, dal server o da un altro giocatore)
  const cleanGear = g => ({ p: gearVal(g && g.p, PANTS_RE), e: gearVal(g && g.e, GEAR_RE), s: gearVal(g && g.s, GEAR_RE) });
  const myGear = () => cleanGear({ p: store.get('cyf.pants') || '', e: store.get('cyf.helmet') || '', s: store.get('cyf.board') || '' });
  const pick = (list, i, def) => (/^[0-9]$/.test(i || '') && +i < list.length ? list[+i] : def);
  // forme dei caschi, condivise da tutti i rider. Coordinate della testa: davanti +x, cima a y = 0,142.
  // Nella SphereGeometry di three.js phi = π è il davanti (+x): l'integrale lascia aperto il viso attorno a phi = π.
  const helmetGeo = {};
  function helmetParts(type) {
    if (helmetGeo[type]) return helmetGeo[type];
    const shell = (r, th, tilt, sx = 1.06, sz = 0.96) => { const g = new THREE.SphereGeometry(r, 30, 14, 0, TAU, 0, Math.PI * th).scale(sx, 1.02, sz); g.rotateZ(tilt); g.translate(-0.008, 0.024, 0); return g; };
    let parts;
    if (type === 'skate') parts = [{ g: shell(0.14, 0.52, 0.14) }, { g: new THREE.TorusGeometry(0.139, 0.007, 6, 40).rotateX(Math.PI / 2).scale(1.06, 1, 0.96).translate(0, -0.0025, 0).rotateZ(0.14).translate(-0.008, 0.024, 0), dark: true }];
    else if (type === 'sci') {
      const pad = s => { const g = new THREE.SphereGeometry(0.05, 14, 10).scale(0.7, 1, 0.42); g.translate(-0.012, -0.03, s * 0.112); return { g, dark: true }; };
      parts = [{ g: shell(0.143, 0.56, 0.24) }, pad(1), pad(-1)];
    } else {
      // integrale: calotta intera in alto, sotto aperta davanti per il viso, mentoniera e frontino
      const top = new THREE.SphereGeometry(0.146, 30, 10, 0, TAU, 0, Math.PI * 0.42).scale(1.04, 1.04, 0.95);
      const low = new THREE.SphereGeometry(0.146, 30, 8, Math.PI + 0.68, TAU - 1.36, Math.PI * 0.42, Math.PI * 0.28).scale(1.04, 1.04, 0.95);
      // mentoniera: un arco basso davanti alla bocca, che si unisce ai lati della calotta
      const chin = new THREE.TorusGeometry(0.13, 0.016, 8, 24, Math.PI * 0.5).rotateX(Math.PI / 2).rotateY(Math.PI * 0.25).scale(1.06, 1.4, 0.93);
      chin.translate(-0.004, -0.088, 0);
      const peak = new THREE.BoxGeometry(0.06, 0.007, 0.15); peak.rotateZ(-0.3); peak.translate(0.152, 0.098, 0);
      for (const g of [top, low]) g.translate(-0.004, 0.012, 0);
      parts = [{ g: top }, { g: low }, { g: chin }, { g: peak, dark: true }];
    }
    return (helmetGeo[type] = parts);
  }
  // tavole da skate (R-228): stessa altezza dal suolo per tutte (le ruote sono uguali), cambiano forma, lunghezza e carrelli
  const SKATE_TYPES = {
    classico: { w: 0.21, l: 0.56, tail: 0.17, tailA: 0.38, truck: 0.2, axle: 0.17, wheel: '#f1e4c4' },
    cruiser: { w: 0.235, l: 0.6, tail: 0.09, tailA: 0.22, truck: 0.2, axle: 0.19, wheel: '#7fd1c1' },
    longboard: { w: 0.235, l: 1.0, tail: 0, tailA: 0, truck: 0.36, axle: 0.2, wheel: '#f39c3d' }
  };
  const skateGeo = {};
  const skateParts = type => skateGeo[type] || (skateGeo[type] = (() => {
    const T = SKATE_TYPES[type];
    return {
      deck: roundedSlab(T.w, T.l, Math.min(0.1, T.w / 2 - 0.005) * (T.tail ? 0.2 : 1), 0.018), grip: roundedSlab(T.w - 0.01, T.l - 0.01, T.tail ? 0.02 : 0.1, 0.004),
      tail: T.tail ? roundedSlab(T.w, T.tail, Math.min(0.1, T.tail * 0.6), 0.018) : null,
      hanger: new THREE.CylinderGeometry(0.013, 0.013, T.axle, 10).rotateZ(Math.PI / 2),
      wheel: new THREE.MeshStandardMaterial({ color: lin(T.wheel), roughness: 0.55, metalness: 0 })
    };
  })());

  const JERSEYS = {
    napoli: { body: ['#1e8fd6'], sleeves: '#1e8fd6' },
    roma: { body: ['#8e2434'], sleeves: '#e8a21a' },
    'milano-rossonera': { body: ['#c8102e', '#15151a'], sleeves: '#15151a' },
    'milano-nerazzurra': { body: ['#1b3c8c', '#15151a'], sleeves: '#15151a' },
    'torino-granata': { body: ['#7f2231'], sleeves: '#7f2231' },
    'torino-bianconera': { body: ['#f4f4f4', '#15151a'], sleeves: '#f4f4f4' },
    palermo: { body: ['#e7a4bd', '#15151a'], sleeves: '#15151a' },
    bologna: { body: ['#8e2434', '#1b2a6b'], sleeves: '#1b2a6b' },
    // colori a scelta del giocatore (R-221): giacca e maniche dello stesso colore
    'colore-arancione': { body: ['#ff5a1f'], sleeves: '#ff5a1f', color: true }, 'colore-blu': { body: ['#2f7fd0'], sleeves: '#2f7fd0', color: true },
    'colore-verde': { body: ['#1f8a4c'], sleeves: '#1f8a4c', color: true }, 'colore-giallo': { body: ['#e2b007'], sleeves: '#e2b007', color: true },
    'colore-viola': { body: ['#9b4dca'], sleeves: '#9b4dca', color: true }, 'colore-rosso': { body: ['#e2352b'], sleeves: '#e2352b', color: true },
    'colore-nero': { body: ['#23262c'], sleeves: '#23262c', color: true }, 'colore-bianco': { body: ['#eceff2'], sleeves: '#eceff2', color: true }
  };
  // maglie esclusive della settimana (R-245, S-47): "settimana<N>", colori della città in evidenza quella settimana, fascia
  // con il nome della città e il numero. Si creano quando servono (anche per gli altri giocatori che le indossano)
  const SETTIMANA = {   // città → [giacca, fascia e maniche, testo sulla fascia]
    napoli: ['#1e8fd6', '#f3f3f3', '#13233a'], roma: ['#8e2434', '#e8a21a', '#13233a'], milano: ['#15151a', '#e8e8e8', '#13233a'],
    parigi: ['#1b3c8c', '#e2352b', '#ffffff'], londra: ['#c8102e', '#1b3c8c', '#ffffff'], francoforte: ['#15151a', '#ff5a1f', '#13233a'],
    madrid: ['#f4f4f4', '#c8102e', '#ffffff'], lisbona: ['#1f8a4c', '#e8a21a', '#13233a'], zagabria: ['#2f7fd0', '#ffffff', '#13233a'],
    berlino: ['#15151a', '#e2b007', '#13233a'], zurigo: ['#2f7fd0', '#eceff2', '#13233a'], newyork: ['#1b3c8c', '#ff8c1a', '#13233a'], neve: ['#eceff2', '#2f7fd0', '#ffffff']
  };
  const NOME_CITTA = { napoli: 'NAPOLI', roma: 'ROMA', milano: 'MILANO', parigi: 'PARIGI', londra: 'LONDRA', francoforte: 'FRANCOFORTE', madrid: 'MADRID', lisbona: 'LISBONA', zagabria: 'ZAGABRIA', berlino: 'BERLINO', zurigo: 'ZURIGO', newyork: 'NEW YORK', neve: 'NEVE' };
  const JERSEY_BASE = Object.keys(JERSEYS);   // le maglie di tutti (città e colori): gli avversari del software vestono solo queste
  function jerseyOf(name) {
    if (!name || typeof name !== 'string') return null;
    if (JERSEYS[name]) return JERSEYS[name];
    const n = PN.calendario ? PN.calendario.numeroDelPremio(name) : 0;
    if (!n) return null;
    const scena = PN.calendario.scenaDi(n), C = SETTIMANA[scena] || SETTIMANA.neve;
    JERSEYS[name] = { body: [C[0]], sleeves: C[1], settimana: n, scena, fascia: C[1], testo: C[2] };
    return JERSEYS[name];
  }
  const myJersey = () => { const v = store.get('cyf.jersey') || ''; return jerseyOf(v) ? v : ''; };
  // aspetto degli avversari guidati dal software (R-234): scelto a caso dal loro codice, quindi uguale su ogni dispositivo
  function lookBot(id) {
    let h = 2166136261;
    for (const ch of String(id || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const r = mulberry32(h), any = n => Math.floor(r() * n);
    const js = JERSEY_BASE;
    return {
      j: r() < 0.6 ? js[any(js.length)] : '', h: HAIR_STYLES[any(HAIR_STYLES.length)].name + ':' + any(HAIR_COLORS.length),
      p: r() < 0.7 ? String(any(PANTS.length)) : '', e: r() < 0.45 ? HELMETS[any(HELMETS.length)] + ':' + any(HELMET_COLORS.length) : '',
      s: BOARDS[any(BOARDS.length)] + ':' + (r() < 0.3 ? '' : any(BOARD_COLORS.length))
    };
  }
  // la giacca è una texture per colore o maglia, con lo stemma CYF sui fianchi, sul petto e sulla schiena (R-216, al posto delle ali)
  const jacketTex = new Map();
  // stemma CYF: scudo bianco bordato di blu notte, fascia arancione con la cima innevata e la scritta CYF.
  // Disegnato in 256 x 256 e stirato in w x h pixel della texture, perché la superficie del busto è ovale.
  function drawBadge(g, cx, cy, w, h) {
    g.save(); g.translate(cx, cy); g.scale(w / 256, h / 256); g.translate(-128, -128);
    const shield = () => {
      g.beginPath(); g.moveTo(128, 10);
      g.quadraticCurveTo(188, 34, 236, 30); g.quadraticCurveTo(244, 150, 128, 246);
      g.quadraticCurveTo(12, 150, 20, 30); g.quadraticCurveTo(68, 34, 128, 10); g.closePath();
    };
    g.lineJoin = 'round';
    shield(); g.fillStyle = '#ffffff'; g.fill();
    g.save(); shield(); g.clip();
    g.fillStyle = '#ff5a1f'; g.fillRect(0, 150, 256, 110);              // fascia arancione in basso
    g.beginPath(); g.moveTo(60, 150); g.lineTo(128, 96); g.lineTo(196, 150); g.closePath();   // la cima della montagna
    g.fillStyle = '#13233a'; g.fill();
    g.beginPath(); g.moveTo(108, 112); g.lineTo(128, 96); g.lineTo(148, 112); g.lineTo(136, 108); g.lineTo(128, 116); g.lineTo(120, 108); g.closePath();
    g.fillStyle = '#ffffff'; g.fill();
    g.restore();
    shield(); g.lineWidth = 14; g.strokeStyle = '#13233a'; g.stroke();
    g.fillStyle = '#13233a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 78px "Arial Black", Arial, Helvetica, sans-serif';
    g.fillText('CYF', 128, 62);
    g.restore();
  }
  function jacketTexture(hex, jersey = '') {
    const key = jersey || hex;
    if (jacketTex.has(key)) return jacketTex.get(key);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const J = jerseyOf(jersey);
    const body = J ? J.body : [hex];
    g.fillStyle = body[0]; g.fillRect(0, 0, 1024, 512);
    if (body.length === 2) { g.fillStyle = body[1]; for (let x = 0; x < 1024; x += 256) g.fillRect(x + 128, 0, 128, 512); }   // strisce verticali
    // cuciture e pieghe leggere
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 300, 1024, 6);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 306, 1024, 4);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(250, 0, 5, 512); g.fillRect(762, 0, 5, 512);
    if (J && J.settimana) {
      // maglia della settimana (R-245): fascia attorno al busto con il nome della città e il numero, sulla schiena (u = 0,75)
      // grande e sul petto (u = 0,25) piccola; lo stemma CYF resta sopra la fascia come sulle altre maglie
      g.fillStyle = J.fascia; g.fillRect(0, 330, 1024, 96);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 330, 1024, 4); g.fillRect(0, 422, 1024, 4);
      const txt = (NOME_CITTA[J.scena] || J.scena.toUpperCase()) + ' #' + J.settimana;
      g.fillStyle = J.testo; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 54px "Arial Black", Arial, Helvetica, sans-serif'; g.fillText(txt, 0.75 * 1024, 378, 300);
      g.font = '900 30px "Arial Black", Arial, Helvetica, sans-serif'; g.fillText(txt, 0.25 * 1024, 378, 180);
    }
    // u = 0 è il fianco +z (quello che vede la telecamera), 0,25 il petto (+x), 0,5 l'altro fianco (si vede in "switch"),
    // 0,75 la schiena (-x); v cresce verso il collo
    for (const u of [0, 1]) drawBadge(g, u * 1024, 512 - 0.55 * 512, 120, 96);
    drawBadge(g, 0.5 * 1024, 512 - 0.55 * 512, 120, 96);
    drawBadge(g, 0.25 * 1024 + 34, 512 - 0.62 * 512, 70, 56);           // piccolo sul petto, accanto alla cerniera
    drawBadge(g, 0.75 * 1024, 512 - 0.57 * 512, 150, 124);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    jacketTex.set(key, tex);
    return tex;
  }
  function makeRider(jacketHex) {
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    const body = new THREE.Group();
    group.add(body);
    const jacket = new THREE.MeshStandardMaterial({ map: jacketTexture(jacketHex), roughness: 0.75, metalness: 0 });   // la maglia arriva con setColor
    const sleeve = RM(jacketHex), jacketDark = RM(jacketHex);
    // materiali propri di questo rider, perché pantaloni, casco e tavola li sceglie ognuno (R-228)
    const pants = RM(PANTS_DEFAULT), boardMat = RM('#121c2b'), deckMat = RM('#b9783f');
    const helmetMat = new THREE.MeshStandardMaterial({ color: lin(HELMET_COLORS[1]), roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }), helmetDark = RM('#202227');
    jacketDark.color.multiplyScalar(0.7);
    // figure: tutto il rider tranne le tavole; in città sale di LIFT, perché la tavola da skate è più alta (R-217)
    const figure = new THREE.Group();
    const mesh = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; (parent || figure).add(m); return m; };
    const G = RIDER_GEO;
    const snowOnly = [], streetOnly = [];   // pezzi che si vedono solo sulla neve o solo in città
    // snowboard (neve) e skateboard con le rotelle (città senza neve): se ne vede uno alla volta
    const snowG = new THREE.Group(), skateG = new THREE.Group();
    body.add(snowG, skateG, figure);   // in quest'ordine: le prove leggono body.children[0] (neve) e [1] (skate)
    mesh(G.snowboard, boardMat, snowG).position.y = 0.05;
    mesh(G.stripe, SHARED.stripe, snowG).position.y = 0.067;
    for (const s of [-1, 1]) {
      const bind = mesh(G.binding, SHARED.boot, snowG);
      bind.position.set(-0.01, 0.12, s * 0.26);
      bind.rotation.y = Math.PI;
      const boot = mesh(G.boot, SHARED.boot);
      boot.position.set(0.02, 0.135, s * 0.26);
      const toe = mesh(G.toe, SHARED.boot); toe.position.set(0.02, 0.2, s * 0.26);
      snowOnly.push(boot, toe);
      // scarpa da skate: suola bianca, tomaia scura, lacci chiari; la punta verso il petto (+x), come lo scarpone
      const sole = mesh(G.sole, STREET.sole); sole.position.set(0.03, 0.081, s * 0.25); sole.rotation.y = Math.PI / 2;
      const shoe = mesh(G.shoe, STREET.shoe); shoe.position.set(0.035, 0.09, s * 0.25);
      const lace = mesh(G.lace, STREET.lace); lace.position.set(0.07, 0.152, s * 0.25); lace.rotation.z = -0.35;
      streetOnly.push(sole, shoe, lace);
    }
    // tavola da skate: ruote a terra (il fondo delle ruote a y = 0), carrelli sopra, poi la tavola.
    // Un gruppo per tipo (classico, cruiser, longboard), costruito la prima volta che serve; se ne vede uno.
    const AX = WHEEL_R;   // altezza dell'asse delle ruote
    const skateBuilt = {};
    function buildSkate(type) {
      const T = SKATE_TYPES[type], P = skateParts(type), sg = new THREE.Group();
      mesh(P.deck, deckMat, sg).position.y = DECK_Y;
      mesh(P.grip, SKATE.grip, sg).position.y = DECK_Y + 0.012;
      for (const s of [-1, 1]) {
        if (P.tail) { const tail = mesh(P.tail, deckMat, sg); tail.position.set(0, DECK_Y + 0.016, s * (T.l / 2 + T.tail / 2 - 0.025)); tail.rotation.x = -s * T.tailA; }
        const z = s * T.truck;
        mesh(G.baseplate, SKATE.truck, sg).position.set(0, DECK_Y - 0.026, z);
        mesh(G.kingpin, SKATE.truck, sg).position.set(0, AX + 0.02, z);
        mesh(P.hanger, SKATE.truck, sg).position.set(0, AX, z);
        for (const w of [-1, 1]) {
          const x = w * (T.axle / 2 + WHEEL_W / 2);
          const wheel = mesh(SKATE.wheelGeo, P.wheel, sg); wheel.position.set(x, AX, z); wheel.rotation.z = Math.PI / 2;
          const hub = mesh(SKATE.hubGeo, SKATE.hub, sg); hub.position.set(x, AX, z); hub.rotation.z = Math.PI / 2;
          for (const e of [-1, 1]) { const lip = mesh(SKATE.lipGeo, P.wheel, sg); lip.position.set(x + e * (WHEEL_W / 2 - 0.004), AX, z); lip.rotation.y = Math.PI / 2; }
        }
      }
      skateG.add(sg);
      return sg;
    }
    let skateNow = '';
    function showSkate(type) {
      if (!SKATE_TYPES[type]) type = 'classico';
      if (type === skateNow) return;
      skateNow = type;
      if (!skateBuilt[type]) skateBuilt[type] = buildSkate(type);
      for (const k in skateBuilt) skateBuilt[k].visible = k === type;
    }
    showSkate('classico');
    skateG.visible = false;
    function setBoard(kind) {
      const city = kind === 'skate';
      snowG.visible = !city; skateG.visible = city;
      figure.position.y = city ? LIFT : 0;
      for (const m of snowOnly) m.visible = !city;
      for (const m of streetOnly) m.visible = city;
      setHands(city);
    }
    const limb = (r, mat) => mesh(G.limb(r), mat);
    const joint = (r, mat) => mesh(G.joint(r), mat);
    const L = {
      thighL: mesh(G.thigh, pants), thighR: mesh(G.thigh, pants), shinL: mesh(G.shin, pants), shinR: mesh(G.shin, pants),
      uarmL: mesh(G.uarm, sleeve), uarmR: mesh(G.uarm, sleeve), farmL: mesh(G.farm, sleeve), farmR: mesh(G.farm, sleeve)
    };
    const JM = {
      kneeL: joint(0.085, pants), kneeR: joint(0.085, pants), hipL: joint(0.098, pants), hipR: joint(0.098, pants),
      shL: joint(0.074, sleeve), shR: joint(0.074, sleeve), elL: joint(0.062, sleeve), elR: joint(0.062, sleeve)
    };
    const pelvis = mesh(G.pelvis, pants);
    const torso = mesh(G.torso, jacket);
    mesh(G.band, jacketDark, torso);
    mesh(G.collar, jacketDark, torso).position.y = 0.535;
    mesh(G.hood, jacketDark, torso).position.set(-0.1, 0.5, 0);           // cappuccio arrotolato sulla schiena
    mesh(G.zip, SHARED.glove, torso).position.set(0.118, 0.22, 0);        // cerniera davanti
    const headG = new THREE.Group();
    figure.add(headG);
    mesh(G.neck, SHARED.skin, headG).position.y = -0.15;
    mesh(G.head, SHARED.skin, headG);
    mesh(G.nose, SHARED.skin, headG).position.set(0.112, -0.005, 0);
    // sulla neve: scaldacollo e maschera con l'elastico sopra i capelli (niente casco dalla 0.12.2, R-220)
    const gaiter = mesh(G.gaiter, jacketDark, headG);
    const strap = mesh(G.strap, SHARED.glove, headG); strap.position.y = 0.03; strap.scale.set(0.78, 1, 0.78);
    const gFrame = mesh(G.goggleFrame, SHARED.glove, headG); gFrame.position.set(-0.004, 0.026, 0); gFrame.scale.setScalar(0.9);
    const goggle = mesh(G.goggle, SHARED.goggle, headG); goggle.position.set(0, 0.026, 0); goggle.scale.setScalar(0.9);
    snowOnly.push(gaiter, strap, gFrame, goggle);
    // capelli: un gruppo che si ricostruisce con setLook(codice del giocatore)
    const hairG = new THREE.Group();
    headG.add(hairG);
    let lookNow = '', hairStyle = 0, helmetOn = false;
    function setLook(id, scelta) {
      const L2 = lookOf(id, scelta), key = L2.style + ':' + L2.color;
      if (key === lookNow) return L2;
      lookNow = key; hairStyle = L2.style;
      while (hairG.children.length) hairG.remove(hairG.children[0]);
      if (!hairGeo[L2.style]) hairGeo[L2.style] = HAIR_STYLES[L2.style].parts();
      for (const g of hairGeo[L2.style]) mesh(g, hairMaterial(HAIR_COLORS[L2.color]), hairG);
      hairUnderHelmet();
      return L2;
    }
    // con il casco la calotta dei capelli (e il ciuffo) sta sotto il casco: si vedono solo i capelli lunghi e la coda (S-36)
    function hairUnderHelmet() {
      hairG.children.forEach((m, i) => { m.visible = !helmetOn || (i > 0 && HAIR_STYLES[hairStyle].name !== 'ciuffo'); });
    }
    setLook('');
    // casco (R-228): un gruppo per tipo, costruito la prima volta che serve
    const helmetG = new THREE.Group(), helmetBuilt = {};
    headG.add(helmetG);
    // viso (il davanti della testa è +x): occhi con l'iride, sopracciglia, bocca; le orecchie si vedono sempre
    for (const s of [-1, 1]) {
      const eye = mesh(G.eye, STREET.eye, headG); eye.position.set(0.107, 0.022, s * 0.036);
      const iris = mesh(G.iris, STREET.iris, headG); iris.position.set(0.1118, 0.0215, s * 0.036);
      const brow = mesh(G.brow, STREET.brow, headG); brow.position.set(0.1105, 0.043, s * 0.037); brow.rotation.x = s * 0.18;
      const ear = mesh(G.ear, SHARED.skin, headG); ear.position.set(-0.004, 0.005, s * 0.094);
      streetOnly.push(eye, iris, brow);
    }
    const mouth = mesh(G.mouth, STREET.lip, headG); mouth.position.set(0.101, -0.058, 0);
    streetOnly.push(mouth);
    // mani: guanti da neve con il polsino sulla neve, mani nude in città
    const gloveL = mesh(G.glove, SHARED.glove), gloveR = mesh(G.glove, SHARED.glove);
    for (const [gl, s] of [[gloveL, 1], [gloveR, -1]]) {
      const th = mesh(G.thumb, SHARED.glove, gl); th.position.set(0.045, 0.01, -s * 0.02); th.rotation.z = -0.5;
      const cuff = mesh(G.cuff, SHARED.glove, gl); cuff.position.y = -0.055;
      gl.userData = { th, cuff };
    }
    const handL = mesh(G.hand, SHARED.skin, gloveL), handR = mesh(G.hand, SHARED.skin, gloveR);
    for (const [h, s] of [[handL, 1], [handR, -1]]) { const th = mesh(G.thumb, SHARED.skin, h); th.scale.setScalar(0.85); th.position.set(0.04, 0.012, -s * 0.018); th.rotation.z = -0.5; }
    streetOnly.push(handL, handR);
    // in città il guanto resta come "mano" invisibile: si nasconde solo il suo aspetto (materiale), così pose() non cambia
    const GLOVE_HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
    const setHands = city => { for (const gl of [gloveL, gloveR]) { gl.material = city ? GLOVE_HIDDEN : SHARED.glove; gl.userData.th.visible = gl.userData.cuff.visible = !city; } };
    const J = {}; ['ankL', 'ankR', 'kneeL', 'kneeR', 'hipL', 'hipR', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR'].forEach(k => J[k] = new THREE.Vector3());
    function setLimb(m, a, b) {
      tmpV.subVectors(b, a);
      const len = tmpV.length();
      m.position.copy(a).addScaledVector(tmpV, 0.5);
      m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(UP, tmpV.normalize());
    }
    // k: quanto è accovacciato; arms: braccia aperte; twist: torsione; grab: presa della tavola; fwd: peso in avanti (frenata);
    // sw: 0 = posizione normale, 1 = "switch" (dopo un 180° la tavola va al contrario): tutto il corpo si specchia,
    // così testa, spalle e braccio davanti restano verso dove si va (R-215). Nel mezzo dell'avvitamento si passa con continuità.
    // hand: 0..1 mano destra alzata ("Sono pronto", R-222); thr: 0..1 avanzamento del lancio della banana (R-224):
    // fino a 0,4 il braccio va indietro e in alto, poi si distende in avanti verso dove si va (-z)
    const JR = {}; ['ankL', 'ankR', 'kneeL', 'kneeR', 'hipL', 'hipR', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR'].forEach(k => JR[k] = new THREE.Vector3());
    function pose(k, arms, twist, grab = 0, fwd = 0, sw = 0, hand = 0, thr = 0) {
      const fz = -fwd * 0.09;   // il davanti della tavola è verso -z
      J.ankL.set(0.02, 0.17, 0.26); J.ankR.set(0.02, 0.17, -0.26);
      const kneeX = 0.1 + k * 0.17, kneeY = 0.55 - k * 0.13;
      J.kneeL.set(kneeX, kneeY, 0.24 + fz * 0.5); J.kneeR.set(kneeX, kneeY, -0.24 + fz * 0.5);
      const hipX = -0.04 - k * 0.12, hipY = 0.93 - k * 0.25 + fwd * 0.03;
      J.hipL.set(hipX, hipY, 0.11 + fz); J.hipR.set(hipX, hipY, -0.11 + fz);
      const lean = 0.25 + k * 0.35;
      const tilt = -fwd * 0.22;                 // busto inclinato verso il davanti della tavola
      const open = 0.2;                         // spalle un po' aperte verso il davanti della tavola, come i rider veri
      const m = 1 - 2 * sw;                     // specchio davanti-dietro: le rotazioni attorno a x e y cambiano segno
      pelvis.position.set(hipX + 0.005, hipY - 0.03, fz * m);
      pelvis.rotation.set(tilt * 0.5 * m, open * 0.5 * m, -lean * 0.5);
      torso.position.set(hipX, hipY - 0.02, fz * m);
      torso.rotation.set((twist * 0.4 + tilt) * m, open * m, -lean);
      const shX = hipX + Math.sin(lean) * 0.5, shY = hipY + Math.cos(lean) * 0.5 * Math.cos(tilt), shZ = fz - Math.sin(tilt) * 0.5;
      // testa girata verso dove si va (il davanti della tavola, -z) e più dritta del busto
      headG.position.set(shX + 0.06, shY + 0.2, shZ * m);
      headG.rotation.set(tilt * 0.4 * m, (0.95 - twist * 0.5) * m, -lean * 0.3);
      const so = Math.sin(open) * 0.19, co = Math.cos(open) * 0.19;
      J.shL.set(shX + so, shY - 0.03, co + shZ); J.shR.set(shX - so, shY - 0.03, -co + shZ);
      // braccio davanti (R, verso il muso della tavola) teso in avanti, braccio dietro (L) morbido vicino al fianco;
      // con arms = 1 (in aria o in curva stretta) si aprono entrambi per l'equilibrio
      const a = arms, sR = J.shR, sL = J.shL;
      J.elR.set(sR.x + 0.1 - a * 0.02, sR.y - 0.21 + a * 0.15, sR.z - 0.13 - a * 0.16);
      J.haR.set(sR.x + 0.24 - a * 0.06, sR.y - 0.36 + a * 0.33, sR.z - 0.29 - a * 0.27);
      J.elL.set(sL.x + 0.03 + a * 0.03, sL.y - 0.23 + a * 0.14, sL.z + 0.07 + a * 0.17);
      J.haL.set(sL.x + 0.14 + a * 0.05, sL.y - 0.44 + a * 0.3, sL.z + 0.08 + a * 0.3);
      if (grab > 0) {   // presa della tavola: mano dietro sulla lamina, gomito piegato
        J.haR.lerp(GRAB_HAND, grab);
        J.elR.lerp(tmpE.set(shX + 0.16, shY - 0.3, -0.24), grab);
      }
      if (hand > 0) {   // mano alzata sopra la testa
        J.elR.lerp(tmpE.set(sR.x + 0.04, sR.y + 0.24, sR.z - 0.05), hand);
        J.haR.lerp(tmpE.set(sR.x + 0.07, sR.y + 0.5, sR.z - 0.07), hand);
      }
      if (thr > 0 && thr < 1) {   // lancio: indietro e su, poi avanti
        const env = Math.sin(thr * Math.PI), f = thr < 0.4 ? 0 : Math.min(1, (thr - 0.4) / 0.6);
        tmpH.set(sR.x - 0.14 + f * 0.42, sR.y + 0.34 - f * 0.2, sR.z + 0.12 - f * 0.6);
        J.haR.lerp(tmpH, env);
        J.elR.lerp(tmpE.set((sR.x + tmpH.x) / 2, (sR.y + tmpH.y) / 2 + 0.06, (sR.z + tmpH.z) / 2), env);
      }
      if (sw > 0) {
        // switch: ogni giunto va verso lo specchio del suo gemello (sinistra ↔ destra, z → -z)
        for (const n in J) JR[n].copy(J[n]);
        for (const n in J) { const t = JR[n.endsWith('L') ? n.slice(0, -1) + 'R' : n.slice(0, -1) + 'L']; J[n].lerp(tmpE.set(t.x, t.y, -t.z), sw); }
      }
      setLimb(L.shinL, J.ankL, J.kneeL); setLimb(L.shinR, J.ankR, J.kneeR);
      setLimb(L.thighL, J.kneeL, J.hipL); setLimb(L.thighR, J.kneeR, J.hipR);
      setLimb(L.uarmL, J.shL, J.elL); setLimb(L.uarmR, J.shR, J.elR);
      setLimb(L.farmL, J.elL, J.haL); setLimb(L.farmR, J.elR, J.haR);
      for (const n of ['kneeL', 'kneeR', 'hipL', 'hipR', 'shL', 'shR', 'elL', 'elR']) JM[n].position.copy(J[n]);
      gloveL.position.copy(J.haL); gloveR.position.copy(J.haR);
      gloveL.quaternion.copy(L.farmL.quaternion); gloveR.quaternion.copy(L.farmR.quaternion);
      gloveL.translateY(0.04); gloveR.translateY(0.04);
    }
    function setColor(hex, jersey = '') {
      const J = jerseyOf(jersey);
      jacket.map = jacketTexture(hex, J ? jersey : '');
      jacket.needsUpdate = true;
      sleeve.color.copy(lin(J ? J.sleeves : hex));
      jacketDark.color.copy(lin(J ? J.body[0] : hex)).multiplyScalar(0.7);
    }
    // pantaloni, casco e tavola (R-228): { p, e, s } come in myGear(); i valori sconosciuti tornano a quelli normali
    let gearNow = '';
    function setGear(g) {
      const G2 = cleanGear(g), key = G2.p + '|' + G2.e + '|' + G2.s;
      if (key === gearNow) return G2;
      gearNow = key;
      pants.color.copy(lin(pick(PANTS, G2.p, PANTS_DEFAULT)));
      const [et, ec] = G2.e.split(':');
      helmetOn = HELMETS.includes(et);
      for (const k in helmetBuilt) helmetBuilt[k].visible = k === et;
      if (helmetOn && !helmetBuilt[et]) { const hg = new THREE.Group(); for (const p of helmetParts(et)) mesh(p.g, p.dark ? helmetDark : helmetMat, hg); helmetG.add(hg); helmetBuilt[et] = hg; }
      helmetMat.color.copy(lin(pick(HELMET_COLORS, ec, HELMET_COLORS[1])));
      // sulla neve con il casco: elastico e maschera sopra il casco
      strap.scale.set(helmetOn ? 0.95 : 0.78, 1, helmetOn ? 0.95 : 0.78);
      const gs = helmetOn ? 1.04 : 0.9; gFrame.scale.setScalar(gs); goggle.scale.setScalar(gs);
      hairUnderHelmet();
      const [st, sc] = G2.s.split(':');
      showSkate(st);
      deckMat.color.copy(lin(pick(BOARD_COLORS, sc, '#b9783f')));
      boardMat.color.copy(lin(pick(BOARD_COLORS, sc, '#121c2b')));
      return G2;
    }
    pose(0.3, 0.2, 0);
    setBoard('snow');
    return { group, body, pose, setColor, setBoard, setLook, setGear };
  }
  return { JERSEYS, JERSEY_BASE, jerseyOf, HAIR_STYLES, HAIR_COLORS, HAIR_RE, PANTS, HELMETS, HELMET_COLORS, BOARDS, BOARD_COLORS, cleanGear, lookOf, lookBot, myHair, myGear, myJersey, jacketTexture, switchOf, bodyTurn, makeRider };
})();
