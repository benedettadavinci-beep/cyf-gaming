// modulo: citta
// dipende da: base, lingua, geometria, pista
// Tutto l'aspetto delle città: modelli di Napoli e Roma, modelli delle altre 10 città (alberi, ostacoli bassi, segnaletica,
// bonus, rampa, oggetti ai lati), fondi stradali, facciate e palazzi, la scheda di ogni città (CITY_CFG) e il traguardo.
// Non sa niente dello stato del gioco: riceve il nome della città e restituisce modelli e materiali.
// Si crea con PN.citta({ world, ANISO, pista }) una volta sola, dal gioco (pista è l'istanza di PN.pista).
window.PN = window.PN || {};
PN.citta = ({ world, ANISO, pista }) => {
  const { TAU, lin, mulberry32 } = PN.base;
  const { tr, fmtLen } = PN.lingua;
  const { merge, lumpy, vcMat, GEO, gateGeo } = PN.geometria;
  const { center, hgt, groundCanvas, stoneTexture, sampietriniTexture, GROUND_MAKE } = pista;
  // --- scenario Napoli ---
  function palm() {
    const parts = [];
    let x = 0;
    for (let i = 0; i < 7; i++) {
      x += 0.05 + i * 0.012;
      parts.push({ geo: new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, 0.85, 7), color: i % 2 ? '#7a5b3d' : '#8d6b49', x, y: 0.42 + i * 0.8 });
    }
    const topY = 0.42 + 6 * 0.8 + 0.4;
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.BoxGeometry(0.42, 0.04, 2.5).translate(0, 0, 1.25).rotateX(0.35 + (i % 3) * 0.12);
      parts.push({ geo: leaf, color: ['#2f6b2a', '#3b7d32', '#28602a'][i % 3], ry: i * TAU / 9, x, y: topY });
    }
    for (let i = 0; i < 3; i++) parts.push({ geo: new THREE.SphereGeometry(0.12, 6, 5), color: '#6b4a22', x: x + Math.cos(i * 2.1) * 0.18, y: topY - 0.15, z: Math.sin(i * 2.1) * 0.18 });
    parts.push({ geo: new THREE.CylinderGeometry(0.55, 0.6, 0.18, 10), color: '#9a948c', y: 0.05 });
    return merge(parts);
  }
  function pizzaGeo() {
    const parts = [
      { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.07, 22), color: '#d89a4e' },
      { geo: new THREE.CylinderGeometry(0.35, 0.35, 0.03, 22), color: '#c4361f', y: 0.04 }
    ];
    const spots = [[0.1, 0.05], [-0.14, 0.12], [0.02, -0.17], [-0.08, -0.04], [0.19, -0.1], [-0.2, -0.13]];
    for (const [px, pz] of spots) parts.push({ geo: new THREE.CylinderGeometry(0.065, 0.075, 0.03, 9), color: '#f7f1e1', x: px, y: 0.06, z: pz });
    for (const [px, pz, r] of [[0.0, 0.18, 0.4], [0.16, 0.12, 1.4], [-0.19, 0.0, 2.2]]) parts.push({ geo: new THREE.BoxGeometry(0.1, 0.02, 0.05), color: '#2e7d32', x: px, y: 0.08, z: pz, ry: r });
    const g = merge(parts);
    g.rotateX(0.95);
    g.scale(1.35, 1.35, 1.35);
    return g;
  }
  function coffeeGeo() {
    const g = merge([
      { geo: new THREE.CylinderGeometry(0.25, 0.2, 0.035, 22), color: '#f4f4f2' },
      { geo: new THREE.CylinderGeometry(0.15, 0.105, 0.22, 18), color: '#fbfbf9', y: 0.13 },
      { geo: new THREE.CylinderGeometry(0.135, 0.135, 0.012, 18), color: '#5a3018', y: 0.236 },
      { geo: new THREE.TorusGeometry(0.06, 0.02, 6, 12), color: '#fbfbf9', x: 0.16, y: 0.14 }
    ]);
    g.rotateX(0.35);
    g.scale(1.7, 1.7, 1.7);
    return g;
  }
  GEO.palms = [palm()];
  GEO.bollard = merge([
    { geo: new THREE.CylinderGeometry(0.085, 0.1, 0.95, 8), color: '#2b2b2e', y: 0.47 },
    { geo: new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), color: '#f2f2f2', y: 0.78 },
    { geo: new THREE.SphereGeometry(0.09, 8, 6), color: '#2b2b2e', y: 0.96 }
  ]);
  GEO.pizza = pizzaGeo();
  GEO.coffee = coffeeGeo();
  GEO.rampWood = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.6, 0); shape.lineTo(4, 0); shape.lineTo(4, 1.1); shape.quadraticCurveTo(1.6, 0.55, -0.6, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 1, curveSegments: 6 });
    g.translate(-2, 0, -1.5);
    g.rotateY(Math.PI / 2);
    return merge([{ geo: g, color: '#b07a45' }, { geo: new THREE.BoxGeometry(3.3, 0.06, 0.14), color: '#f2c230', y: 1.18, z: -2 }]);
  })();
  // --- scenario Roma ---
  // pino domestico (a ombrello): tronco alto e inclinato, chioma larga e piatta
  function umbrellaPine() {
    const rr = mulberry32(23);
    const parts = [];
    let x = 0;
    for (let i = 0; i < 6; i++) {
      x += 0.06 + i * 0.02;
      parts.push({ geo: new THREE.CylinderGeometry(0.15 - i * 0.012, 0.19 - i * 0.012, 0.9, 8), color: i % 2 ? '#6e5240' : '#7b5c47', x, y: 0.45 + i * 0.85 });
    }
    const top = 0.45 + 5 * 0.85 + 0.3;
    parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.1, 1.2, 6), color: '#6e5240', x: x - 0.5, y: top - 0.2, sx: 1, sy: 1, sz: 1 });
    for (let i = 0; i < 9; i++) {
      const a = i * TAU / 9 + rr() * 0.4, d = i ? 1.3 + rr() * 0.6 : 0;
      const r = 1.15 + rr() * 0.35;
      parts.push({ geo: new THREE.SphereGeometry(r, 12, 7), color: ['#36502f', '#3f5c35', '#2e4629'][i % 3], sx: 1, sy: 0.38, sz: 1, x: x + Math.cos(a) * d, y: top + 0.35 + rr() * 0.3, z: Math.sin(a) * d });
    }
    parts.push({ geo: new THREE.SphereGeometry(1.0, 12, 7), color: '#4a6a3e', sx: 1.6, sy: 0.32, sz: 1.6, x, y: top + 0.75 });
    return merge(parts);
  }
  function carbonaraGeo() {
    const rr = mulberry32(31);
    const parts = [
      { geo: new THREE.CylinderGeometry(0.46, 0.3, 0.06, 28), color: '#f6f4ef' },
      { geo: new THREE.TorusGeometry(0.44, 0.03, 6, 28).rotateX(Math.PI / 2), color: '#e9e5dc', y: 0.03 },
      { geo: new THREE.SphereGeometry(0.3, 18, 10, 0, TAU, 0, Math.PI / 2), color: '#efd27c', sx: 1, sy: 0.55, sz: 1, y: 0.03 }
    ];
    // spaghetti: anelli sopra il nido
    for (let i = 0; i < 7; i++) parts.push({ geo: new THREE.TorusGeometry(0.1 + rr() * 0.14, 0.014, 5, 20).rotateX(Math.PI / 2 + (rr() - 0.5) * 0.6), color: i % 2 ? '#f4dc8c' : '#e9c46a', x: (rr() - 0.5) * 0.12, y: 0.1 + rr() * 0.08, z: (rr() - 0.5) * 0.12 });
    // guanciale, pepe e pecorino
    for (let i = 0; i < 9; i++) parts.push({ geo: new THREE.BoxGeometry(0.07, 0.04, 0.05), color: i % 3 ? '#b4543c' : '#ecd2bf', x: (rr() - 0.5) * 0.4, y: 0.15 + rr() * 0.05, z: (rr() - 0.5) * 0.4, ry: rr() * 3 });
    for (let i = 0; i < 14; i++) parts.push({ geo: new THREE.BoxGeometry(0.018, 0.018, 0.018), color: i % 2 ? '#1d1a17' : '#fbf6e8', x: (rr() - 0.5) * 0.42, y: 0.19, z: (rr() - 0.5) * 0.42 });
    const g = merge(parts);
    g.rotateX(0.75);
    g.scale(1.45, 1.45, 1.45);
    return g;
  }
  function carciofoGeo() {
    const parts = [{ geo: new THREE.CylinderGeometry(0.05, 0.07, 0.4, 8), color: '#8aa25a', y: -0.2 }];
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const n = 8, rad = 0.2 - r * 0.028, y = r * 0.085, tilt = 0.55 - r * 0.09;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n + r * 0.4;
        const petal = new THREE.SphereGeometry(0.11, 8, 6).scale(0.75, 1.35, 0.42).translate(0, 0.1, 0).rotateX(tilt);
        parts.push({ geo: petal, color: r === 4 ? '#7a6a7e' : r === 3 ? '#6c7d4c' : (i % 2 ? '#5f8237' : '#6d9140'), ry: a, x: Math.sin(a) * rad * 0.6, y, z: Math.cos(a) * rad * 0.6 });
      }
    }
    parts.push({ geo: new THREE.SphereGeometry(0.08, 8, 6), color: '#6b5675', y: 0.45 });
    const g = merge(parts);
    g.scale(1.55, 1.55, 1.55);
    g.translate(0, 0.25, 0);
    return g;
  }
  GEO.pines = [umbrellaPine()];
  GEO.carbonara = carbonaraGeo();
  GEO.carciofo = carciofoGeo();
  GEO.travertino = merge([
    { geo: new THREE.CylinderGeometry(0.13, 0.15, 0.8, 10), color: '#ddd2bc', y: 0.4 },
    { geo: new THREE.SphereGeometry(0.135, 10, 6, 0, TAU, 0, Math.PI / 2), color: '#e6dcc8', y: 0.8 },
    { geo: new THREE.CylinderGeometry(0.18, 0.18, 0.06, 10), color: '#cfc3ab', y: 0.03 }
  ]);
  // facciate: una texture per colore, finestre con persiane verdi e balconcini
  // ---------- altre città (dalla tabella di Luigi: CYF-elementi-per-citta.xlsx) ----------
  // Ogni città cambia l'aspetto ma non gli ingombri di ostacoli, bonus, rampe e porte (uguali alla neve);
  // la forma della strada invece è propria di ogni città (R-312, vedi TRACKS), con gli oggetti nella stessa sequenza (R-309).

  // --- fondi stradali ---
  const paveTexture = cfg => groundCanvas(g => {
    const rr = mulberry32(cfg.seed);
    g.fillStyle = cfg.joint; g.fillRect(0, 0, 512, 512);
    const S = cfg.size;
    for (let row = 0; row < 512 / S; row++) {
      const shift = row % 2 ? S / 2 : 0;
      for (let x = -S; x < 512 + S; x += S) {
        const base = cfg.tones[Math.floor(rr() * cfg.tones.length)];
        const w = (rr() - 0.5) * 8;
        g.fillStyle = 'rgb(' + (base[0] + w) + ',' + (base[1] + w) + ',' + (base[2] + w) + ')';
        const x0 = x + shift + 1 + rr() * 0.8, y0 = row * S + 1 + rr() * 0.8;
        g.fillRect(x0, y0, S - 2.2, S - 2.2);
        g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(x0, y0, S - 2.2, 1.3);
        g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x0, y0 + S - 3.2, S - 2.2, 1.2);
      }
    }
    if (cfg.rails) {   // una coppia di rotaie del tram per piastrella (8 m)
      for (const rx of [196, 290]) {
        g.fillStyle = '#3a3b3d'; g.fillRect(rx - 5, 0, 10, 512);
        g.fillStyle = '#9ba2a8'; g.fillRect(rx - 2, 0, 4, 512);
      }
    }
  });
  const asphaltTexture = cfg => groundCanvas(g => {
    const rr = mulberry32(cfg.seed);
    g.fillStyle = cfg.base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.10)'; g.fillRect(rr() * 512, rr() * 512, 1.3, 1.3); }
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(rr() * 512, rr() * 512, 20 + rr() * 60, 8 + rr() * 20); }   // rattoppi
    if (cfg.lines) {   // doppia linea gialla per piastrella
      g.fillStyle = cfg.lines;
      g.fillRect(242, 0, 8, 512); g.fillRect(262, 0, 8, 512);
    }
    if (cfg.manholes) for (const [mx, my] of [[120, 130], [390, 360]]) {
      g.fillStyle = '#17181a'; g.beginPath(); g.arc(mx, my, 20, 0, TAU); g.fill();
      g.strokeStyle = '#3c3f43'; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.arc(mx, my, 13, 0, TAU); g.stroke();
    }
    if (cfg.wet) { g.fillStyle = 'rgba(190,210,225,0.07)'; for (let i = 0; i < 14; i++) g.fillRect(rr() * 512, rr() * 512, 30 + rr() * 90, 10 + rr() * 30); }
  });
  const slabTexture = cfg => groundCanvas(g => {
    const rr = mulberry32(cfg.seed);
    g.fillStyle = '#6f6c66'; g.fillRect(0, 0, 512, 512);
    const H = 64, W = 128;
    for (let row = 0; row < 512 / H; row++) {
      const shift = row % 2 ? W / 2 : 0;
      for (let x = -W; x < 512 + W; x += W) {
        const v = cfg.v0 + Math.floor(rr() * 20);
        g.fillStyle = 'rgb(' + v + ',' + (v - 2) + ',' + (v - 6) + ')';
        g.fillRect(x + shift + 2, row * H + 2, W - 4, H - 4);
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + shift + 2, row * H + 2, W - 4, 2.5);
        for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x + shift + 4 + rr() * (W - 8), row * H + 4 + rr() * (H - 8), 2, 2); }
      }
    }
  });
  // calçada portoghese: mosaico bianco con onde nere (e rotaie del tram)
  const calcadaTexture = () => groundCanvas(g => {
    const rr = mulberry32(77);
    g.fillStyle = '#cfc7b4'; g.fillRect(0, 0, 512, 512);
    const S = 10;
    for (let y = 0; y < 512; y += S) for (let x = 0; x < 512; x += S) {
      const cx = x + S / 2, wave = Math.sin((y + 40 * Math.sin(x / 90)) / 46);
      const dark = Math.abs(wave) < 0.3;
      const v = dark ? 56 + rr() * 22 : 212 + rr() * 30;
      g.fillStyle = 'rgb(' + v + ',' + (v - 4) + ',' + (v - 10) + ')';
      g.fillRect(x + 0.8, y + 0.8, S - 1.6, S - 1.6);
    }
    for (const rx of [196, 290]) { g.fillStyle = '#4a4b4d'; g.fillRect(rx - 5, 0, 10, 512); g.fillStyle = '#a6aaae'; g.fillRect(rx - 2, 0, 4, 512); }
  });

  // --- alberi e pali alti (prendono il posto dell'abete: fusto ≈ 0,8 m, alto ≈ 5,5 m) ---
  function genTree(cfg) {
    const rr = mulberry32(cfg.seed || 7);
    const parts = [];
    const h = cfg.h || 4.1;
    for (let i = 0; i < 5; i++) parts.push({ geo: new THREE.CylinderGeometry(0.15 - i * 0.013, 0.18 - i * 0.013, h / 5 + 0.12, 8), color: i % 2 ? cfg.trunk : (cfg.trunk2 || cfg.trunk), y: h / 10 + i * h / 5 });
    const n = cfg.blobs || 7;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + rr() * 0.5, d = i ? 0.6 + rr() * 0.55 : 0;
      const r = cfg.r * (0.75 + rr() * 0.4);
      parts.push({ geo: new THREE.SphereGeometry(r, 10, 7), color: cfg.cols[i % cfg.cols.length], x: Math.cos(a) * d, y: h + (rr() - 0.3) * 0.9, z: Math.sin(a) * d });
    }
    if (cfg.dots) for (let i = 0; i < 24; i++) { const a = rr() * TAU, d = rr() * cfg.r * 1.25; parts.push({ geo: new THREE.SphereGeometry(0.08, 6, 5), color: cfg.dots, x: Math.cos(a) * d, y: h + 0.1 + rr() * 1.3, z: Math.sin(a) * d }); }
    return merge(parts);
  }
  // alberi delle strade famose (sezione 12): platano, tiglio, jacaranda
  const streetTrees = {
    platano: () => genTree({ trunk: '#b8b09a', trunk2: '#8a8a78', cols: ['#4f7f38', '#5c8e44', '#447232'], r: 1.7, h: 4.6, seed: 23 }),
    tiglio: () => genTree({ trunk: '#6a5a46', trunk2: '#7a6a54', cols: ['#5a8a3e', '#6a9a48', '#4f7a36'], r: 1.55, h: 4.3, seed: 29 }),
    jacaranda: () => genTree({ trunk: '#6a5a4a', cols: ['#8a6ab8', '#9a7ac8', '#7a5aa8'], r: 1.5, h: 4.2, dots: '#b89ad8', seed: 13 }),
    pino: () => GEO.pines[0],
    palma: () => GEO.palms[0]
  };
  function genLamp(cfg) {
    const parts = [
      { geo: new THREE.CylinderGeometry(0.22, 0.3, 0.45, 10), color: cfg.pole, y: 0.22 },
      { geo: new THREE.CylinderGeometry(0.06, 0.1, 4.7, 8), color: cfg.pole, y: 2.8 }
    ];
    if (cfg.kind === 'gas') {
      parts.push({ geo: new THREE.BoxGeometry(0.34, 0.46, 0.34), color: cfg.lamp, y: 5.35 });
      parts.push({ geo: new THREE.ConeGeometry(0.33, 0.26, 4), color: cfg.pole, y: 5.7, ry: Math.PI / 4 });
      parts.push({ geo: new THREE.SphereGeometry(0.05, 6, 5), color: cfg.pole, y: 5.86 });
    } else {   // braccio curvo con lampada a goccia (New York)
      parts.push({ geo: new THREE.TorusGeometry(0.72, 0.045, 8, 14, Math.PI / 2), color: cfg.pole, x: -0.72, y: 5.15 });
      parts.push({ geo: new THREE.SphereGeometry(0.17, 10, 8), color: cfg.lamp, sx: 1, sy: 1.35, sz: 1, x: -1.42, y: 4.98 });
    }
    return merge(parts);
  }
  // colonna Morris parigina: corpo verde scuro, fascia per i manifesti, cupola
  function morrisColumn() {
    const parts = [
      { geo: new THREE.CylinderGeometry(0.72, 0.78, 0.3, 14), color: '#2c3a2e', y: 0.15 },
      { geo: new THREE.CylinderGeometry(0.6, 0.62, 3.5, 14), color: '#35472f', y: 2.05 },
      { geo: new THREE.CylinderGeometry(0.63, 0.63, 2.0, 14), color: '#d9cbb2', y: 2.1 }
    ];
    for (let i = 0; i < 3; i++) parts.push({ geo: new THREE.BoxGeometry(0.02, 1.5, 0.7), color: ['#b33a3a', '#2f5f8f', '#caa23c'][i], x: Math.cos(i * TAU / 3) * 0.635, y: 2.1, z: Math.sin(i * TAU / 3) * 0.635, ry: -i * TAU / 3 + Math.PI / 2 });
    parts.push({ geo: new THREE.CylinderGeometry(0.72, 0.6, 0.22, 14), color: '#2c3a2e', y: 3.95 });
    parts.push({ geo: new THREE.SphereGeometry(0.58, 14, 8, 0, TAU, 0, Math.PI / 2), color: '#35472f', sx: 1, sy: 0.75, sz: 1, y: 4.05 });
    parts.push({ geo: new THREE.SphereGeometry(0.1, 8, 6), color: '#2c3a2e', y: 4.62 });
    return merge(parts);
  }

  // --- ostacoli bassi (prendono il posto della roccia: raggio ≈ 1,1 m, alto ≈ 0,75 m) ---
  const lowGeos = {
    panettone: () => merge([
      { geo: new THREE.CylinderGeometry(0.88, 0.95, 0.18, 16), color: '#8f949a', y: 0.09 },
      { geo: new THREE.SphereGeometry(0.85, 16, 10, 0, TAU, 0, Math.PI / 2), color: '#aab0b6', sx: 1, sy: 0.75, sz: 1, y: 0.16 }
    ]),
    planterStone: () => {
      const parts = [
        { geo: new THREE.CylinderGeometry(0.92, 0.82, 0.5, 14), color: '#b9b2a4', y: 0.25 },
        { geo: new THREE.TorusGeometry(0.9, 0.07, 8, 16).rotateX(Math.PI / 2), color: '#c8c2b4', y: 0.52 },
        { geo: new THREE.SphereGeometry(0.72, 12, 8, 0, TAU, 0, Math.PI / 2), color: '#3f6b35', sx: 1.1, sy: 0.55, sz: 1.1, y: 0.5 }
      ];
      for (let i = 0; i < 8; i++) parts.push({ geo: new THREE.SphereGeometry(0.05, 6, 5), color: i % 2 ? '#d9534f' : '#e8c33c', x: Math.cos(i * 0.9) * 0.5, y: 0.78, z: Math.sin(i * 0.9) * 0.5 });
      return merge(parts);
    },
    planterBrick: () => {
      const parts = [
        { geo: new THREE.BoxGeometry(1.7, 0.5, 1.0), color: '#9a523c', y: 0.25 },
        { geo: new THREE.BoxGeometry(1.8, 0.09, 1.1), color: '#c9c0b2', y: 0.53 },
        { geo: new THREE.SphereGeometry(0.6, 12, 8, 0, TAU, 0, Math.PI / 2), color: '#41682f', sx: 1.35, sy: 0.55, sz: 0.8, y: 0.52 }
      ];
      for (let y = 0.08; y < 0.45; y += 0.14) parts.push({ geo: new THREE.BoxGeometry(1.72, 0.015, 1.02), color: '#d8cfc0', y });
      return merge(parts);
    },
    barrel: () => {
      const parts = [{ geo: new THREE.CylinderGeometry(0.52, 0.52, 1.5, 14).rotateZ(Math.PI / 2), color: '#8a6038', y: 0.54 }];
      for (const bx of [-0.55, 0, 0.55]) parts.push({ geo: new THREE.TorusGeometry(0.53, 0.035, 8, 16).rotateY(Math.PI / 2), color: '#3c3f43', x: bx, y: 0.54 });
      for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.5, 0.14, 0.3), color: '#6d4a2a', x: s * 0.5, y: 0.07, z: 0.3 * s });
      parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8).rotateX(Math.PI / 2), color: '#caa23c', y: 0.54, z: 0.53 });
      return merge(parts);
    },
    geraniumPot: () => {
      const parts = [
        { geo: new THREE.CylinderGeometry(0.72, 0.5, 0.62, 14), color: '#b06a44', y: 0.31 },
        { geo: new THREE.CylinderGeometry(0.76, 0.72, 0.12, 14), color: '#c07a50', y: 0.62 },
        { geo: new THREE.SphereGeometry(0.62, 12, 8, 0, TAU, 0, Math.PI / 2), color: '#3f6b35', sx: 1.05, sy: 0.6, sz: 1.05, y: 0.62 }
      ];
      for (let i = 0; i < 10; i++) parts.push({ geo: new THREE.SphereGeometry(0.07, 6, 5), color: i % 3 ? '#d8403a' : '#e86a7a', x: Math.cos(i * 0.63) * (0.2 + (i % 3) * 0.16), y: 0.86 + (i % 2) * 0.08, z: Math.sin(i * 0.63) * (0.2 + (i % 3) * 0.16) });
      return merge(parts);
    },
    crate: () => {
      const parts = [{ geo: new THREE.BoxGeometry(1.5, 0.6, 1.0), color: '#b08954', y: 0.3 }];
      for (const s of [-0.72, -0.24, 0.24, 0.72]) parts.push({ geo: new THREE.BoxGeometry(0.05, 0.64, 1.02), color: '#8a6638', x: s, y: 0.3 });
      for (let i = 0; i < 9; i++) parts.push({ geo: new THREE.SphereGeometry(0.12, 8, 6), color: i % 2 ? '#e8902c' : '#d8b02c', x: -0.55 + (i % 3) * 0.55, y: 0.66, z: -0.25 + Math.floor(i / 3) * 0.25 });
      return merge(parts);
    },
    crateStack: () => {
      const parts = [];
      for (const [cx, cy, cz, ry] of [[-0.3, 0.22, 0, 0], [0.55, 0.22, 0.1, 0.3], [0.1, 0.62, 0, -0.15]]) {
        parts.push({ geo: new THREE.BoxGeometry(1.0, 0.44, 0.7), color: '#b08954', x: cx, y: cy, z: cz, ry });
        for (let i = 0; i < 4; i++) parts.push({ geo: new THREE.SphereGeometry(0.1, 8, 6), color: ['#d8403a', '#e8902c', '#7fb043', '#e8c33c'][i], x: cx - 0.3 + i * 0.2, y: cy + 0.26, z: cz, ry });
      }
      return merge(parts);
    },
    graffitiBlock: () => {
      const parts = [{ geo: new THREE.BoxGeometry(1.7, 0.72, 0.85), color: '#9aa0a6', y: 0.36 }];
      const rr = mulberry32(9);
      for (let i = 0; i < 8; i++) parts.push({ geo: new THREE.BoxGeometry(0.28 + rr() * 0.3, 0.16 + rr() * 0.2, 0.02), color: ['#d8403a', '#2f8fd0', '#e8c33c', '#7fb043', '#b05ad0'][i % 5], x: -0.6 + rr() * 1.2, y: 0.2 + rr() * 0.36, z: 0.435 * (i % 2 ? 1 : -1) });
      return merge(parts);
    },
    cheese: () => {
      const parts = [
        { geo: new THREE.CylinderGeometry(0.85, 0.88, 0.56, 18), color: '#e2b84a', y: 0.28 },
        { geo: new THREE.CylinderGeometry(0.86, 0.86, 0.1, 18), color: '#f2d879', y: 0.56 }
      ];
      const rr = mulberry32(14);
      for (let i = 0; i < 7; i++) parts.push({ geo: new THREE.SphereGeometry(0.05, 6, 5), color: '#c49a30', x: (rr() - 0.5) * 1.3, y: 0.62, z: (rr() - 0.5) * 1.3 });
      return merge(parts);
    },
    trashBags: () => {
      const rr = mulberry32(21);
      const parts = [];
      for (const [cx, cy, cz, r] of [[-0.45, 0.3, 0.1, 0.48], [0.35, 0.32, -0.15, 0.52], [0.05, 0.62, 0.15, 0.4], [0.75, 0.24, 0.3, 0.34]]) {
        parts.push({ geo: lumpy(new THREE.SphereGeometry(r, 10, 7), 0.12, rr), color: '#2d3137', x: cx, y: cy, z: cz, sx: 1, sy: 0.85, sz: 1 });
        parts.push({ geo: new THREE.SphereGeometry(0.07, 6, 5), color: '#15171a', x: cx, y: cy + r * 0.8, z: cz });
      }
      return merge(parts);
    },
    columnDrum: () => {
      const parts = [{ geo: new THREE.CylinderGeometry(0.68, 0.68, 1.1, 18).rotateZ(Math.PI / 2), color: '#d9cfba', y: 0.6 }];
      for (let i = 0; i < 12; i++) parts.push({ geo: new THREE.BoxGeometry(1.12, 0.07, 0.1), color: '#c4b9a2', y: 0.6 + Math.sin(i * TAU / 12) * 0.62, z: Math.cos(i * TAU / 12) * 0.62, ry: 0, sx: 1, sy: 1, sz: 1 });
      parts.push({ geo: new THREE.CylinderGeometry(0.5, 0.5, 0.12, 18).rotateZ(Math.PI / 2), color: '#ccc1aa', x: 0.61, y: 0.6 });
      return merge(parts);
    }
  };

  // --- segnaletica laterale (prende il posto della palina: sottile, ogni 22 m) ---
  const markerGeos = {
    nasone: () => merge([
      { geo: new THREE.CylinderGeometry(0.17, 0.2, 1.08, 12), color: '#4a4d52', y: 0.54 },
      { geo: new THREE.SphereGeometry(0.17, 10, 7, 0, TAU, 0, Math.PI / 2), color: '#53565c', y: 1.08 },
      { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6).rotateX(1.2), color: '#6a6d73', y: 0.78, z: 0.2 },
      { geo: new THREE.CylinderGeometry(0.26, 0.3, 0.08, 12), color: '#8f949a', y: 0.04 }
    ]),
    potelet: () => merge([
      { geo: new THREE.CylinderGeometry(0.055, 0.07, 1.15, 8), color: '#4a3b2e', y: 0.57 },
      { geo: new THREE.SphereGeometry(0.09, 8, 6), color: '#8a6d3b', y: 1.2 }
    ]),
    ukBollard: () => merge([
      { geo: new THREE.CylinderGeometry(0.12, 0.17, 0.95, 10), color: '#1d1f24', y: 0.47 },
      { geo: new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), color: '#e8e8e8', y: 0.78 },
      { geo: new THREE.SphereGeometry(0.12, 10, 7), color: '#1d1f24', y: 1.0 }
    ]),
    fwPole: () => {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push({ geo: new THREE.CylinderGeometry(0.055, 0.055, 0.2, 8), color: i % 2 ? '#e8e8e8' : '#c43a3a', y: 0.1 + i * 0.2 });
      parts.push({ geo: new THREE.SphereGeometry(0.07, 8, 6), color: '#c43a3a', y: 1.26 });
      return merge(parts);
    },
    stonePill: () => merge([
      { geo: new THREE.CylinderGeometry(0.16, 0.19, 0.85, 10), color: '#cfc7b4', y: 0.42 },
      { geo: new THREE.SphereGeometry(0.16, 10, 7, 0, TAU, 0, Math.PI / 2), color: '#dcd4c2', y: 0.85 }
    ]),
    ampel: () => merge([
      { geo: new THREE.CylinderGeometry(0.05, 0.06, 1.45, 8), color: '#4a4d52', y: 0.72 },
      { geo: new THREE.BoxGeometry(0.26, 0.42, 0.14), color: '#2a2c30', y: 1.62 },
      { geo: new THREE.BoxGeometry(0.14, 0.14, 0.02), color: '#3ddc68', y: 1.54, z: 0.075 },
      { geo: new THREE.BoxGeometry(0.14, 0.14, 0.02), color: '#7a2a28', y: 1.72, z: 0.075 },
      { geo: new THREE.BoxGeometry(0.3, 0.05, 0.18), color: '#2a2c30', y: 1.86 }
    ]),
    zhPole: () => merge([
      { geo: new THREE.CylinderGeometry(0.05, 0.06, 1.1, 8), color: '#eef0f2', y: 0.55 },
      { geo: new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8), color: '#2f6fc0', y: 0.86 },
      { geo: new THREE.SphereGeometry(0.06, 8, 6), color: '#2f6fc0', y: 1.13 }
    ]),
    hydrant: () => merge([
      { geo: new THREE.CylinderGeometry(0.2, 0.24, 0.2, 10), color: '#8a2a22', y: 0.1 },
      { geo: new THREE.CylinderGeometry(0.17, 0.2, 0.55, 10), color: '#c4372b', y: 0.45 },
      { geo: new THREE.SphereGeometry(0.17, 10, 7, 0, TAU, 0, Math.PI / 2), color: '#c4372b', y: 0.72 },
      { geo: new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8).rotateZ(Math.PI / 2), color: '#a02e24', y: 0.5 },
      { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), color: '#e8c33c', y: 0.84 }
    ])
  };

  // --- bonus da raccogliere (prendono il posto dei cristalli: sospesi a 0,9 m) ---
  const plate = (r, col) => [
    { geo: new THREE.CylinderGeometry(r, r * 0.65, 0.05, 22), color: col || '#f6f4ef' },
    { geo: new THREE.TorusGeometry(r * 0.96, 0.025, 6, 24).rotateX(Math.PI / 2), color: '#e9e5dc', y: 0.03 }
  ];
  const tilt = (g, s) => { g.rotateX(0.75); g.scale(s, s, s); return g; };
  const foodGeos = {
    suppli: () => {
      const rr = mulberry32(3);
      const parts = plate(0.42);
      for (const [x, z, ry] of [[-0.12, 0.08, 0.3], [0.14, -0.02, 1.2], [0.0, -0.16, 2.2]]) {
        parts.push({ geo: new THREE.SphereGeometry(0.16, 10, 8), color: '#c87f32', sx: 1.5, sy: 0.85, sz: 0.9, x, y: 0.14, z, ry });
      }
      for (let i = 0; i < 8; i++) parts.push({ geo: new THREE.SphereGeometry(0.018, 5, 4), color: '#8a5a22', x: (rr() - 0.5) * 0.6, y: 0.24, z: (rr() - 0.5) * 0.5 });
      return tilt(merge(parts), 1.5);
    },
    maritozzo: () => tilt(merge([
      ...plate(0.4),
      { geo: new THREE.SphereGeometry(0.3, 14, 10), color: '#9a6232', sx: 1.25, sy: 0.75, sz: 0.9, y: 0.2 },
      { geo: new THREE.BoxGeometry(0.62, 0.3, 0.1), color: '#fbf8f0', y: 0.22, ry: 0.25 },
      { geo: new THREE.SphereGeometry(0.05, 6, 5), color: '#fbf8f0', x: 0.25, y: 0.34, z: -0.05 }
    ]), 1.5),
    cotoletta: () => tilt(merge([
      ...plate(0.46),
      { geo: new THREE.SphereGeometry(0.3, 14, 10), color: '#cd8f3e', sx: 1.4, sy: 0.3, sz: 1.1, y: 0.1 },
      { geo: new THREE.CylinderGeometry(0.09, 0.1, 0.22, 8).rotateZ(1.3), color: '#cd8f3e', x: 0.45, y: 0.1, z: 0.1 },
      { geo: new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), color: '#f2e04a', x: -0.28, y: 0.12, z: -0.22 }
    ]), 1.5),
    risotto: () => {
      const rr = mulberry32(6);
      const parts = [...plate(0.46), { geo: new THREE.SphereGeometry(0.34, 16, 10, 0, TAU, 0, Math.PI / 2), color: '#efc84a', sx: 1.1, sy: 0.5, sz: 1.1, y: 0.04 }];
      for (let i = 0; i < 10; i++) parts.push({ geo: new THREE.SphereGeometry(0.02, 5, 4), color: '#c4702a', x: (rr() - 0.5) * 0.5, y: 0.22, z: (rr() - 0.5) * 0.5 });
      return tilt(merge(parts), 1.5);
    },
    croissant: () => {
      const parts = [];
      for (let i = -2; i <= 2; i++) {
        const k = 1 - Math.abs(i) * 0.26;
        parts.push({ geo: new THREE.SphereGeometry(0.19 * k + 0.05, 10, 8), color: i % 2 ? '#c8862e' : '#da9a3c', sx: 1, sy: 0.85, sz: 1.25, x: Math.sin(i * 0.55) * 0.42, y: 0.16 * k, z: -Math.cos(i * 0.55) * 0.42 + 0.42, ry: -i * 0.55 });
      }
      return tilt(merge(parts), 1.55);
    },
    macaron: () => tilt(merge([
      { geo: new THREE.CylinderGeometry(0.34, 0.3, 0.13, 18), color: '#e889a8', y: 0.065 },
      { geo: new THREE.CylinderGeometry(0.32, 0.32, 0.07, 18), color: '#fbf3ea', y: 0.17 },
      { geo: new THREE.CylinderGeometry(0.3, 0.34, 0.13, 18), color: '#e889a8', y: 0.27 }
    ]), 1.55),
    tea: () => tilt(merge([
      { geo: new THREE.CylinderGeometry(0.26, 0.21, 0.035, 22), color: '#f4f4f2' },
      { geo: new THREE.CylinderGeometry(0.16, 0.11, 0.22, 18), color: '#fbfbf9', y: 0.13 },
      { geo: new THREE.CylinderGeometry(0.145, 0.145, 0.012, 18), color: '#b4682a', y: 0.237 },
      { geo: new THREE.TorusGeometry(0.065, 0.02, 6, 12), color: '#fbfbf9', x: 0.17, y: 0.14 },
      { geo: new THREE.BoxGeometry(0.07, 0.015, 0.1), color: '#e8e2d4', x: 0.2, y: 0.03, z: 0.14 }
    ]), 1.65),
    fishchips: () => {
      const rr = mulberry32(8);
      const parts = [
        { geo: new THREE.CylinderGeometry(0.3, 0.12, 0.5, 10, 1, true), color: '#e8dcc2', y: 0.25 },
        { geo: new THREE.SphereGeometry(0.2, 10, 8), color: '#cd8f3e', sx: 1.6, sy: 0.5, sz: 0.7, x: 0.1, y: 0.56, ry: 0.5 }
      ];
      for (let i = 0; i < 9; i++) parts.push({ geo: new THREE.BoxGeometry(0.05, 0.3, 0.05), color: '#e8b84a', x: (rr() - 0.5) * 0.3, y: 0.52 + rr() * 0.1, z: (rr() - 0.5) * 0.3, ry: rr() * 3, sx: 1, sy: 1, sz: 1 });
      return tilt(merge(parts), 1.35);
    },
    bembel: () => tilt(merge([
      { geo: new THREE.CylinderGeometry(0.2, 0.26, 0.14, 14), color: '#b8bcc2', y: 0.07 },
      { geo: new THREE.SphereGeometry(0.3, 14, 10), color: '#c8ccd2', sx: 1, sy: 1.05, sz: 1, y: 0.38 },
      { geo: new THREE.CylinderGeometry(0.12, 0.17, 0.2, 12), color: '#c8ccd2', y: 0.72 },
      { geo: new THREE.TorusGeometry(0.11, 0.035, 6, 12).rotateY(Math.PI / 2), color: '#b8bcc2', x: -0.3, y: 0.5 },
      { geo: new THREE.TorusGeometry(0.3, 0.03, 6, 16).rotateX(Math.PI / 2), color: '#3a5fa8', y: 0.45 },
      { geo: new THREE.SphereGeometry(0.06, 8, 6), color: '#3a5fa8', x: 0.22, y: 0.32, z: 0.14 }
    ]), 1.4),
    brezel: () => tilt(merge([
      { geo: new THREE.TorusGeometry(0.2, 0.075, 8, 16), color: '#8a4f22', x: -0.16, y: 0.08 },
      { geo: new THREE.TorusGeometry(0.2, 0.075, 8, 16), color: '#8a4f22', x: 0.16, y: 0.08 },
      { geo: new THREE.TorusGeometry(0.3, 0.08, 8, 18), color: '#95561f', y: 0.1 },
      { geo: new THREE.SphereGeometry(0.02, 4, 4), color: '#fbf6e8', x: 0.1, y: 0.2 },
      { geo: new THREE.SphereGeometry(0.02, 4, 4), color: '#fbf6e8', x: -0.2, y: 0.18, z: 0.1 },
      { geo: new THREE.SphereGeometry(0.02, 4, 4), color: '#fbf6e8', x: 0.05, y: 0.18, z: -0.2 }
    ]), 1.45),
    churro: () => {
      const parts = [];
      for (const [a, ry] of [[-0.3, 0.5], [0.0, 0.0], [0.3, -0.5]]) {
        parts.push({ geo: new THREE.CylinderGeometry(0.075, 0.075, 0.85, 8).rotateZ(1.1), color: '#c8862e', x: a, y: 0.18 + Math.abs(a) * 0.1, z: a * 0.4, ry });
      }
      parts.push({ geo: new THREE.CylinderGeometry(0.18, 0.14, 0.18, 12), color: '#6a3a1e', x: 0.42, y: 0.1, z: -0.3 });
      return tilt(merge(parts), 1.45);
    },
    bocadillo: () => tilt(merge([
      { geo: new THREE.SphereGeometry(0.3, 14, 10), color: '#d8a65a', sx: 1.7, sy: 0.55, sz: 0.75, y: 0.26 },
      { geo: new THREE.SphereGeometry(0.3, 14, 10), color: '#e8c384', sx: 1.65, sy: 0.4, sz: 0.72, y: 0.1 },
      { geo: new THREE.TorusGeometry(0.1, 0.035, 6, 12).rotateX(Math.PI / 2), color: '#f2e2c4', x: 0.25, y: 0.2, z: 0.12 },
      { geo: new THREE.TorusGeometry(0.09, 0.03, 6, 12).rotateX(Math.PI / 2), color: '#f2e2c4', x: -0.2, y: 0.2, z: -0.1 }
    ]), 1.45),
    nata: () => tilt(merge([
      ...plate(0.36),
      { geo: new THREE.CylinderGeometry(0.26, 0.2, 0.16, 16), color: '#d8b069', y: 0.1 },
      { geo: new THREE.CylinderGeometry(0.21, 0.21, 0.05, 16), color: '#e8c33c', y: 0.19 },
      { geo: new THREE.SphereGeometry(0.045, 6, 5), color: '#6a3a1e', x: 0.06, y: 0.22 },
      { geo: new THREE.SphereGeometry(0.035, 6, 5), color: '#6a3a1e', x: -0.08, y: 0.22, z: 0.05 }
    ]), 1.6),
    sardina: () => tilt(merge([
      ...plate(0.44),
      { geo: new THREE.SphereGeometry(0.22, 14, 10), color: '#9fb6c6', sx: 1.9, sy: 0.5, sz: 0.55, y: 0.12 },
      { geo: new THREE.ConeGeometry(0.12, 0.22, 8).rotateZ(Math.PI / 2), color: '#8aa2b2', x: -0.5, y: 0.12 },
      { geo: new THREE.SphereGeometry(0.03, 6, 5), color: '#15171a', x: 0.32, y: 0.16, z: 0.08 }
    ]), 1.5),
    licitar: () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.3);
      shape.bezierCurveTo(0.42, 0.05, 0.3, 0.34, 0, 0.14);
      shape.bezierCurveTo(-0.3, 0.34, -0.42, 0.05, 0, -0.3);
      const heart = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 10 });
      heart.rotateX(-0.3);
      return tilt(merge([
        { geo: heart, color: '#c4372b', y: 0.2 },
        { geo: new THREE.SphereGeometry(0.045, 6, 5), color: '#fbf6f0', y: 0.28, z: 0.12 },
        { geo: new THREE.SphereGeometry(0.035, 6, 5), color: '#3a5fa8', x: 0.12, y: 0.24, z: 0.12 }
      ]), 1.45);
    },
    strukli: () => tilt(merge([
      ...plate(0.44),
      { geo: new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10).rotateX(Math.PI / 2), color: '#f2e8d4', x: -0.18, y: 0.1 },
      { geo: new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10).rotateX(Math.PI / 2), color: '#efe2ca', x: 0.06, y: 0.1, ry: 0.15 },
      { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.44, 10).rotateX(Math.PI / 2), color: '#f2e8d4', x: 0.3, y: 0.1, ry: -0.1 },
      { geo: new THREE.SphereGeometry(0.1, 8, 6), color: '#fbf8f0', sx: 1.6, sy: 0.3, sz: 1.2, y: 0.2 }
    ]), 1.5),
    currywurst: () => {
      const parts = [...plate(0.44)];
      for (let i = 0; i < 6; i++) parts.push({ geo: new THREE.CylinderGeometry(0.13, 0.13, 0.09, 12), color: '#b4543c', x: -0.3 + i * 0.12, y: 0.12, z: Math.sin(i * 1.1) * 0.08, ry: 0.3 });
      for (let i = 0; i < 7; i++) parts.push({ geo: new THREE.SphereGeometry(0.05, 6, 5), color: '#a02e1a', x: -0.25 + i * 0.09, y: 0.19, z: Math.sin(i * 1.4) * 0.07 });
      parts.push({ geo: new THREE.SphereGeometry(0.02, 4, 4), color: '#e8c33c', x: 0.1, y: 0.23 });
      parts.push({ geo: new THREE.SphereGeometry(0.02, 4, 4), color: '#e8c33c', x: -0.15, y: 0.23, z: 0.05 });
      return tilt(merge(parts), 1.5);
    },
    berliner: () => {
      const rr = mulberry32(12);
      const parts = [
        ...plate(0.38),
        { geo: new THREE.SphereGeometry(0.3, 14, 10), color: '#d8a65a', sx: 1.1, sy: 0.72, sz: 1.1, y: 0.2 },
        { geo: new THREE.SphereGeometry(0.05, 6, 5), color: '#a02e3a', x: 0.3, y: 0.18 }
      ];
      for (let i = 0; i < 12; i++) parts.push({ geo: new THREE.SphereGeometry(0.015, 4, 4), color: '#ffffff', x: (rr() - 0.5) * 0.5, y: 0.36 + rr() * 0.08, z: (rr() - 0.5) * 0.5 });
      return tilt(merge(parts), 1.5);
    },
    cioccolato: () => {
      const parts = [{ geo: new THREE.BoxGeometry(0.72, 0.07, 0.46), color: '#5a3318', y: 0.05 }];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) parts.push({ geo: new THREE.BoxGeometry(0.2, 0.035, 0.19), color: '#6a3f20', x: -0.23 + i * 0.23, y: 0.1, z: -0.11 + j * 0.22 });
      parts.push({ geo: new THREE.BoxGeometry(0.2, 0.09, 0.48), color: '#c8ccd2', x: -0.38, y: 0.05 });
      return tilt(merge(parts), 1.55);
    },
    luxemburgerli: () => {
      const parts = [...plate(0.4)];
      const cols = ['#e889a8', '#8fc8e8', '#e8c33c', '#b8e0a0', '#d8b8e8'];
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5, d = i ? 0.22 : 0;
        parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.09, 0.05, 12), color: cols[i], x: Math.cos(a) * d, y: 0.06 + (i ? 0 : 0.06), z: Math.sin(a) * d });
        parts.push({ geo: new THREE.CylinderGeometry(0.09, 0.1, 0.05, 12), color: cols[i], x: Math.cos(a) * d, y: 0.12 + (i ? 0 : 0.06), z: Math.sin(a) * d });
      }
      return tilt(merge(parts), 1.55);
    },
    hotdog: () => {
      const parts = [
        { geo: new THREE.SphereGeometry(0.16, 12, 9), color: '#d8a65a', sx: 2.4, sy: 0.75, sz: 0.65, y: 0.1, z: 0.07 },
        { geo: new THREE.SphereGeometry(0.16, 12, 9), color: '#d8a65a', sx: 2.4, sy: 0.75, sz: 0.65, y: 0.1, z: -0.07 },
        { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.78, 10).rotateZ(Math.PI / 2), color: '#b4503c', y: 0.19 }
      ];
      for (let i = 0; i < 6; i++) parts.push({ geo: new THREE.BoxGeometry(0.07, 0.02, 0.04), color: '#e8c33c', x: -0.28 + i * 0.11, y: 0.26, z: (i % 2 ? 0.03 : -0.03), ry: 0.5 });
      return tilt(merge(parts), 1.5);
    },
    bagel: () => {
      const rr = mulberry32(16);
      const parts = [{ geo: new THREE.TorusGeometry(0.26, 0.12, 10, 20).rotateX(Math.PI / 2), color: '#cd8f3e', y: 0.12 }];
      for (let i = 0; i < 14; i++) { const a = rr() * TAU, d = 0.17 + rr() * 0.17; parts.push({ geo: new THREE.SphereGeometry(0.014, 4, 4), color: '#f2e8cf', x: Math.cos(a) * d, y: 0.23, z: Math.sin(a) * d }); }
      return tilt(merge(parts), 1.55);
    }
  };

  // paletti mancanti e rampa generica colorata
  markerGeos.ghisa = () => merge([
    { geo: new THREE.CylinderGeometry(0.075, 0.09, 1.05, 8), color: '#3a3d42', y: 0.52 },
    { geo: new THREE.TorusGeometry(0.085, 0.02, 6, 12).rotateX(Math.PI / 2), color: '#53565c', y: 0.88 },
    { geo: new THREE.SphereGeometry(0.095, 8, 6), color: '#3a3d42', y: 1.08 }
  ]);
  markerGeos.bolard = () => merge([
    { geo: new THREE.CylinderGeometry(0.1, 0.13, 0.92, 10), color: '#26282c', y: 0.46 },
    { geo: new THREE.SphereGeometry(0.1, 8, 6, 0, TAU, 0, Math.PI / 2), color: '#26282c', y: 0.92 }
  ]);
  // rampa della città: bordo di un colore, a scacchi/strisce (array di colori) e, se richiesto, graffiti sui fianchi (Berlino)
  function rampCity(body, edge, graffiti) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.6, 0); shape.lineTo(4, 0); shape.lineTo(4, 1.1); shape.quadraticCurveTo(1.6, 0.55, -0.6, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 1, curveSegments: 6 });
    g.translate(-2, 0, -1.5);
    g.rotateY(Math.PI / 2);
    const parts = [{ geo: g, color: body }];
    if (Array.isArray(edge)) {
      const n = 10, w = 3.3 / n;
      for (let i = 0; i < n; i++) parts.push({ geo: new THREE.BoxGeometry(w, 0.06, 0.14), color: edge[i % edge.length], x: -1.65 + w / 2 + i * w, y: 1.18, z: -2 });
    } else parts.push({ geo: new THREE.BoxGeometry(3.3, 0.06, 0.14), color: edge, y: 1.18, z: -2 });
    if (graffiti) {
      const rr = mulberry32(27);
      const cols = ['#d8403a', '#2f8fd0', '#e8c33c', '#7fb043', '#b05ad0'];
      for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
        const z = -1.7 + i * 0.75, h = 0.95 - (z + 2) * 0.19;   // il fianco si abbassa verso la base
        parts.push({ geo: new THREE.BoxGeometry(0.02, h * (0.25 + rr() * 0.3), 0.35 + rr() * 0.4), color: cols[(i + (sx > 0 ? 2 : 0)) % 5], x: sx * 1.52, y: h * (0.3 + rr() * 0.35), z });
      }
    }
    return merge(parts);
  }

  // --- oggetti ai lati della strada (riga "Elementi ai lati" della tabella): tram, cabine, bus, taxi, ombrelloni, Muro ---
  // Sono solo decorazione: stanno sul marciapiede, fuori dalla pista (oltre 22,4 m dal centro), dove la telecamera non entra.
  function tramGeo(cfg) {
    const L = cfg.len || 11, parts = [];
    parts.push({ geo: new THREE.BoxGeometry(2.3, 1.1, L), color: cfg.body, y: 0.95 });                 // cassa, parte bassa
    parts.push({ geo: new THREE.BoxGeometry(2.3, 1.05, L), color: cfg.top || cfg.body, y: 2.05 });     // parte alta
    parts.push({ geo: new THREE.BoxGeometry(2.25, 0.3, L - 0.2), color: cfg.roof || '#d8d8d4', y: 2.75 });
    for (const sx of [-1, 1]) for (let i = 0; i < Math.floor(L / 1.6); i++) parts.push({ geo: new THREE.BoxGeometry(0.02, 0.7, 1.1), color: '#1f2a36', x: sx * 1.16, y: 2.05, z: -L / 2 + 1.0 + i * 1.6 });   // finestrini
    for (const sz of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(1.4, 0.8, 0.02), color: '#1f2a36', y: 2.05, z: sz * (L / 2 + 0.005) });   // parabrezza
    for (const sz of [-1, 1]) { parts.push({ geo: new THREE.BoxGeometry(2.0, 0.6, 1.2), color: '#2a2d31', y: 0.3, z: sz * (L / 2 - 2) }); for (const sx of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12).rotateZ(Math.PI / 2), color: '#17191c', x: sx * 1.0, y: 0.35, z: sz * (L / 2 - 2) }); }   // carrelli e ruote
    parts.push({ geo: new THREE.BoxGeometry(0.06, 0.9, 0.06), color: '#3a3d42', x: 0, y: 3.35, z: 0.6 });
    parts.push({ geo: new THREE.BoxGeometry(0.06, 0.9, 0.06), color: '#3a3d42', x: 0, y: 3.35, z: -0.6 });
    parts.push({ geo: new THREE.BoxGeometry(1.2, 0.05, 0.08), color: '#3a3d42', y: 3.8, z: 0 });   // pantografo
    if (cfg.stripe) parts.push({ geo: new THREE.BoxGeometry(2.32, 0.12, L), color: cfg.stripe, y: 1.52 });
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.22, 0.22, 0.03), color: '#fff2b0', x: sx * 0.8, y: 1.0, z: sz * (L / 2 + 0.01) });   // fari
    return merge(parts);
  }
  const propGeos = {
    tramMilano: () => tramGeo({ body: '#e8842a', top: '#f6e9c8', roof: '#c9bfa8', stripe: '#e8842a', len: 11 }),          // "Carrelli" arancione e crema
    tramLisbona: () => tramGeo({ body: '#f2c230', top: '#f2c230', roof: '#eeeeea', len: 8.5 }),                           // Remodelado giallo
    tramZurigo: () => tramGeo({ body: '#2a5db0', top: '#f4f6f8', roof: '#d8dde2', len: 12 }),                             // VBZ blu e bianco
    phoneBox: () => merge([
      { geo: new THREE.BoxGeometry(1.0, 2.3, 1.0), color: '#c4372b', y: 1.15 },
      { geo: new THREE.BoxGeometry(1.06, 0.1, 1.06), color: '#a52a22', y: 2.35 },
      { geo: new THREE.SphereGeometry(0.62, 12, 6, 0, TAU, 0, Math.PI / 2), color: '#c4372b', sx: 1, sy: 0.35, sz: 1, y: 2.4 },
      ...[-1, 1].flatMap(s => [
        { geo: new THREE.BoxGeometry(0.02, 1.5, 0.7), color: '#2b3340', x: s * 0.505, y: 1.1 },
        { geo: new THREE.BoxGeometry(0.7, 1.5, 0.02), color: '#2b3340', z: s * 0.505, y: 1.1 },
        { geo: new THREE.BoxGeometry(0.02, 0.22, 0.8), color: '#f4ecd8', x: s * 0.51, y: 2.05 },
        { geo: new THREE.BoxGeometry(0.8, 0.22, 0.02), color: '#f4ecd8', z: s * 0.51, y: 2.05 }
      ])
    ]),
    busLondra: () => {
      const L = 10.5, parts = [
        { geo: new THREE.BoxGeometry(2.5, 3.9, L), color: '#c4372b', y: 2.35 },
        { geo: new THREE.BoxGeometry(2.45, 0.2, L - 0.3), color: '#d8d2c8', y: 4.4 }
      ];
      for (const sx of [-1, 1]) for (const y of [1.6, 3.5]) for (let i = 0; i < 6; i++) parts.push({ geo: new THREE.BoxGeometry(0.02, 0.9, 1.2), color: '#1f2a36', x: sx * 1.26, y, z: -L / 2 + 1.0 + i * 1.65 });
      for (const y of [1.6, 3.5]) parts.push({ geo: new THREE.BoxGeometry(2.0, 1.0, 0.02), color: '#1f2a36', y, z: -L / 2 - 0.005 });
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14).rotateZ(Math.PI / 2), color: '#17191c', x: sx * 1.1, y: 0.5, z: sz * 3.3 });
      parts.push({ geo: new THREE.BoxGeometry(2.3, 0.5, 0.04), color: '#f4ecd8', y: 2.7, z: -L / 2 - 0.02 });   // tabella del percorso
      return merge(parts);
    },
    umbrellaDolac: () => {
      const parts = [
        { geo: new THREE.CylinderGeometry(0.04, 0.05, 2.3, 8), color: '#5a4a3a', y: 1.15 },
        { geo: new THREE.ConeGeometry(1.35, 0.5, 12, 1, true), color: '#d8302a', y: 2.45 },
        { geo: new THREE.TorusGeometry(1.33, 0.03, 6, 24).rotateX(Math.PI / 2), color: '#f4f4f4', y: 2.21 },
        { geo: new THREE.SphereGeometry(0.06, 8, 6), color: '#f4f4f4', y: 2.72 },
        { geo: new THREE.BoxGeometry(1.6, 0.08, 0.9), color: '#b08954', y: 0.85 },                   // banco del mercato
        { geo: new THREE.BoxGeometry(1.5, 0.75, 0.8), color: '#8a6638', y: 0.42 }
      ];
      for (let i = 0; i < 12; i++) parts.push({ geo: new THREE.SphereGeometry(0.09, 8, 6), color: ['#d8403a', '#e8902c', '#7fb043', '#e8c33c'][i % 4], x: -0.6 + (i % 4) * 0.4, y: 0.98, z: -0.25 + Math.floor(i / 4) * 0.25 });
      for (let i = 0; i < 12; i++) parts.push({ geo: new THREE.BoxGeometry(0.02, 0.05, 0.9), color: '#f4f4f4', y: 2.33, ry: i * TAU / 12, x: Math.cos(i * TAU / 12) * 0.7, z: Math.sin(i * TAU / 12) * 0.7 });
      return merge(parts);
    },
    wallBerlino: () => {
      const rr = mulberry32(33), parts = [], cols = ['#d8403a', '#2f8fd0', '#e8c33c', '#7fb043', '#b05ad0', '#f28c28'];
      for (let i = 0; i < 5; i++) {
        const z = -2.4 + i * 1.2;
        parts.push({ geo: new THREE.BoxGeometry(0.22, 3.4, 1.18), color: i % 2 ? '#c9c6c0' : '#d2cfc8', y: 1.7, z });
        parts.push({ geo: new THREE.BoxGeometry(0.8, 0.5, 1.18), color: '#bdbab4', y: 0.25, z });                  // base a L
        parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.2, 1.18, 10).rotateX(Math.PI / 2), color: '#c2bfb8', y: 3.4, z });   // tubo in cima
        for (let k = 0; k < 4; k++) parts.push({ geo: new THREE.BoxGeometry(0.02, 0.3 + rr() * 0.7, 0.3 + rr() * 0.6), color: cols[Math.floor(rr() * cols.length)], x: -0.12, y: 0.9 + rr() * 1.9, z: z + (rr() - 0.5) * 0.6 });
      }
      return merge(parts);
    },
    // auto generica (parcheggiata ai lati): colore della carrozzeria e, se serve, insegna da taxi
    carGeo: (body, sign, stripe) => {
      const parts = [
        { geo: new THREE.BoxGeometry(1.8, 0.5, 4.3), color: body, y: 0.58 },
        { geo: new THREE.BoxGeometry(1.65, 0.55, 2.3), color: body, y: 1.1, z: 0.1 },
        { geo: new THREE.BoxGeometry(1.67, 0.4, 2.1), color: '#1f2a36', y: 1.13, z: 0.1 },
        { geo: new THREE.BoxGeometry(1.82, 0.08, 4.2), color: '#111111', y: 0.84 }
      ];
      if (sign) parts.push({ geo: new THREE.BoxGeometry(0.5, 0.18, 0.18), color: sign, y: 1.46, z: 0.1 });
      if (stripe) parts.push({ geo: new THREE.BoxGeometry(0.02, 0.5, 1.2), color: stripe, x: 0.92, y: 0.95, z: -0.6 }, { geo: new THREE.BoxGeometry(0.02, 0.5, 1.2), color: stripe, x: -0.92, y: 0.95, z: -0.6 });
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12).rotateZ(Math.PI / 2), color: '#17191c', x: sx * 0.82, y: 0.3, z: sz * 1.4 });
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.3, 0.12, 0.04), color: sz < 0 ? '#fff2b0' : '#d8302a', x: sx * 0.58, y: 0.66, z: sz * 2.16 });
      return merge(parts);
    },
    autoNapoli: () => propGeos.carGeo('#e9e6df'),
    autoParigi: () => propGeos.carGeo('#8a9aa8'),
    taxiLondra: () => propGeos.carGeo('#17191c', '#f4f4f4'),
    taxiMadrid: () => propGeos.carGeo('#f4f4f4', '#f4f4f4', '#d8302a'),
    tramZagabria: () => tramGeo({ body: '#2a6bc8', top: '#2a6bc8', roof: '#d8dde2', len: 11 }),                            // ZET blu
    taxiNY: () => {
      const parts = [
        { geo: new THREE.BoxGeometry(1.85, 0.55, 4.7), color: '#f2c230', y: 0.6 },
        { geo: new THREE.BoxGeometry(1.7, 0.6, 2.5), color: '#f2c230', y: 1.17, z: 0.1 },
        { geo: new THREE.BoxGeometry(1.72, 0.45, 2.3), color: '#1f2a36', y: 1.2, z: 0.1 },                           // vetri
        { geo: new THREE.BoxGeometry(0.5, 0.18, 0.18), color: '#f4f4f4', y: 1.56, z: 0.1 },                           // insegna sul tetto
        { geo: new THREE.BoxGeometry(1.86, 0.1, 4.6), color: '#111111', y: 0.9 }
      ];
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12).rotateZ(Math.PI / 2), color: '#17191c', x: sx * 0.85, y: 0.32, z: sz * 1.5 });
      for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) parts.push({ geo: new THREE.BoxGeometry(0.02, 0.16, 0.3), color: i % 2 ? '#111111' : '#f4f4f4', x: sx * 0.93, y: 0.78, z: -1.9 + i * 0.55 });   // scacchiera
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.3, 0.14, 0.04), color: sz < 0 ? '#fff2b0' : '#d8302a', x: sx * 0.6, y: 0.7, z: sz * 2.36 });
      return merge(parts);
    }
  };

  // --- la scheda di ogni città: ostacoli, bonus, rampa, porte, paletti, palazzi, strada, luce ---
  // Le schede delle città stanno in citta/<nome>.js (A-10): ognuna è una funzione che riceve questo catalogo di modelli
  // condivisi e restituisce la scheda. L'ordine è quello dei tag <script> in index.html (è anche l'ordine del menu).
  const K = { GEO, lowGeos, markerGeos, foodGeos, streetTrees, genTree, genLamp, morrisColumn, paveTexture, asphaltTexture, slabTexture, calcadaTexture, stoneTexture, sampietriniTexture };
  const CITY_CFG = {};
  for (const name in PN.citta.schede) CITY_CFG[name] = PN.citta.schede[name](K);
  for (const k in CITY_CFG) GROUND_MAKE[k] = CITY_CFG[k].ground;
  const CITY_ASSETS = {};
  function assetsFor(name) {
    let a = CITY_ASSETS[name];
    if (!a) {
      const C = CITY_CFG[name];
      a = CITY_ASSETS[name] = {
        tall: C.tall(), low: C.low(), fa: C.faG(), fb: C.fbG(),
        ramp: rampCity(C.ramp[0], C.ramp[1], C.ramp[2]),
        gates: [gateGeo(C.gate[0]), gateGeo(C.gate[1])],
        marker: C.marker(),
        props: (C.props || []).map(([name, len]) => ({ geo: propGeos[name](), len })),
        sideTree: C.street && C.street.trees ? C.street.trees.geo() : null
      };
    }
    return a;
  }

  // facciate: una texture per colore e per stile di città
  function facadeMat(col, style, seed) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const rr = mulberry32(seed);
    g.scale(2, 2);
    g.fillStyle = col; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 140; i++) { g.fillStyle = rr() < 0.6 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'; g.fillRect(rr() * 128, rr() * 128, 1 + rr() * 3, 1 + rr() * 3); }
    const win = (x, y, w, h, frame, glass) => { g.fillStyle = frame; g.fillRect(x - 3, y - 3, w + 6, h + 6); g.fillStyle = glass; g.fillRect(x, y, w, h); };
    if (style === 'roma') {
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 118, 128, 2);
      g.fillStyle = '#eee4cf'; g.fillRect(0, 114, 128, 4);
      g.fillStyle = '#efe6d3'; g.fillRect(40, 24, 48, 74);
      g.beginPath(); g.moveTo(36, 22); g.lineTo(64, 10); g.lineTo(92, 22); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(36, 22, 56, 2);
      g.fillStyle = '#2e2a28'; g.fillRect(46, 30, 36, 62);
      g.fillStyle = '#6d4a2e'; g.fillRect(30, 30, 15, 62); g.fillRect(83, 30, 15, 62);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 34; y < 92; y += 5) { g.fillRect(32, y, 11, 1.5); g.fillRect(85, y, 11, 1.5); }
      g.fillStyle = '#e8dfcc'; g.fillRect(38, 96, 52, 5);
    } else if (style === 'napoli') {
      g.fillStyle = '#2b2f36'; g.fillRect(44, 26, 40, 66);
      g.fillStyle = '#3f6f4c'; g.fillRect(26, 26, 17, 66); g.fillRect(85, 26, 17, 66);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 30; y < 92; y += 6) { g.fillRect(28, y, 13, 2); g.fillRect(87, y, 13, 2); }
      g.fillStyle = '#e9e4da'; g.fillRect(40, 22, 48, 4);
      g.fillStyle = '#26282c'; g.fillRect(36, 94, 56, 4);
      for (let x = 38; x < 92; x += 6) g.fillRect(x, 98, 2, 14);
      g.fillRect(36, 110, 56, 3);
    } else if (style === 'haussmann') {
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 116, 128, 2);
      g.fillStyle = '#efe9da'; g.fillRect(0, 112, 128, 4);
      for (const x of [22, 74]) {
        win(x, 26, 32, 60, '#efe9da', '#2e3138');
        g.fillStyle = '#3a3d42'; g.fillRect(x - 5, 84, 42, 3);
        for (let vx = x - 4; vx < x + 36; vx += 4) g.fillRect(vx, 78, 1.5, 7);
      }
    } else if (style === 'brick' || style === 'brickfe') {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < 128; y += 7) g.fillRect(0, y, 128, 1.4);
      for (let y = 0; y < 128; y += 7) for (let x = (y / 7) % 2 ? 0 : 7; x < 128; x += 14) g.fillRect(x, y, 1.2, 7);
      win(28, 28, 26, 42, '#e8e2d2', '#2e3138');
      win(76, 28, 26, 42, '#e8e2d2', '#2e3138');
      g.fillStyle = '#d8d2c2'; g.fillRect(24, 72, 34, 4); g.fillRect(72, 72, 34, 4);
      if (style === 'brickfe') {
        g.strokeStyle = 'rgba(16,18,22,0.85)'; g.lineWidth = 2.4;
        g.strokeRect(66, 16, 50, 96);
        g.beginPath();
        for (let y = 16; y < 104; y += 24) { g.moveTo(68, y + 2); g.lineTo(114, y + 22); }
        g.stroke();
        g.fillStyle = 'rgba(16,18,22,0.85)'; for (let y = 40; y < 114; y += 24) g.fillRect(66, y, 50, 2.2);
      }
    } else if (style === 'fachwerk') {
      g.fillStyle = '#5a4030';
      g.fillRect(0, 0, 128, 7); g.fillRect(0, 121, 128, 7); g.fillRect(0, 0, 7, 128); g.fillRect(121, 0, 7, 128);
      g.fillRect(0, 60, 128, 6);
      const beam = (x1, y1, x2, y2) => { const a = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1); g.save(); g.translate(x1, y1); g.rotate(a); g.fillRect(0, -3, L, 6); g.restore(); };
      beam(7, 66, 60, 121); beam(60, 66, 7, 121); beam(68, 121, 121, 66); beam(121, 121, 68, 66);
      g.fillRect(60, 60, 8, 68);
      win(42, 22, 20, 26, '#5a4030', '#2e3138');
      win(76, 22, 20, 26, '#5a4030', '#2e3138');
    } else if (style === 'azulejos') {
      for (let y = 0; y < 128; y += 11) for (let x = 0; x < 128; x += 11) {
        g.fillStyle = (x + y) % 22 ? '#ffffff' : '#9fc2dc';
        g.fillRect(x + 0.7, y + 0.7, 9.6, 9.6);
        if ((x + y) % 22) { g.fillStyle = '#b8d2e4'; g.fillRect(x + 3.7, y + 3.7, 3.6, 3.6); }
      }
      win(32, 30, 26, 46, '#ffffff', '#2e3138');
      win(76, 30, 26, 46, '#ffffff', '#2e3138');
      g.fillStyle = '#d8d2c2'; g.fillRect(28, 80, 34, 4); g.fillRect(72, 80, 34, 4);
    } else {   // altbau
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 8, 128, 3);
      g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 102; y < 128; y += 7) g.fillRect(0, y, 128, 1.5);
      win(26, 24, 24, 56, '#f0ece2', '#33383f');
      win(78, 24, 24, 56, '#f0ece2', '#33383f');
      g.fillStyle = '#f0ece2'; g.fillRect(22, 84, 32, 3); g.fillRect(74, 84, 32, 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, ANISO);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  }
  const facadeMats = {}, roofMatsC = {};
  const facadesFor = name => facadeMats[name] || (facadeMats[name] = CITY_CFG[name].walls.map((c, i) => facadeMat(c, (i % 2 && CITY_CFG[name].style2) || CITY_CFG[name].style, i + 1)));
  const roofFor = name => roofMatsC[name] || (roofMatsC[name] = new THREE.MeshStandardMaterial({ color: lin(CITY_CFG[name].roof), roughness: 0.95 }));
  function buildingGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2 - 3, 0);
    const uv = g.attributes.uv;
    // facce: +x, -x, +y, -y, +z, -z (4 vertici ciascuna); una finestra ogni 3,4 m
    const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(size[f][0] / 3.4)), uv.getY(i) * Math.max(1, Math.round(size[f][1] / 3.4)));
    }
    return g;
  }
  GEO.gateRed = gateGeo('#d8302a');
  GEO.gateBlue = gateGeo('#2766c6');
  const gemGeo = new THREE.OctahedronGeometry(0.3, 0);
  const gemMat = new THREE.MeshStandardMaterial({ color: lin('#7cc8ff'), emissive: lin('#2a7fe0'), emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, flatShading: true });

  function textTexture(text, w, h, bg, fg, font) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function finishLine(z, raceLen) {   // traguardo a z, con la lunghezza della gara scritta sullo striscione
    const grp = new THREE.Group();
    const c = center(z);
    const postMat = new THREE.MeshStandardMaterial({ color: lin('#13233a'), roughness: 0.6 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
      post.position.set(c + s * 18, hgt(c + s * 18, z) + 3.5, z);
      post.castShadow = true;
      grp.add(post);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(36, 2, 0.2),
      [postMat, postMat, postMat, postMat,
       new THREE.MeshBasicMaterial({ map: textTexture(tr('finishBanner') + ' · ' + fmtLen(raceLen), 1024, 64, '#ff5a1f', '#ffffff', '700 44px "Barlow Condensed", Arial, sans-serif') }),
       new THREE.MeshBasicMaterial({ map: textTexture('C-Y-F GAMING', 1024, 64, '#13233a', '#ffffff', '700 44px "Barlow Condensed", Arial, sans-serif') })]
    );
    banner.position.set(c, Math.max(hgt(c - 18, z), hgt(c + 18, z)) + 6.2, z);
    banner.castShadow = true;
    grp.add(banner);
    // striscia a scacchi bianchi e neri sulla pista
    const ck = document.createElement('canvas'); ck.width = 512; ck.height = 32;
    const cg = ck.getContext('2d');
    for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { cg.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cg.fillRect(i * 16, j * 16, 16, 16); }
    const ckTex = new THREE.CanvasTexture(ck); ckTex.encoding = THREE.sRGBEncoding; ckTex.anisotropy = ANISO;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(36, 2.2), new THREE.MeshBasicMaterial({ map: ckTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(c, hgt(c, z) + 0.06, z);
    grp.add(line);
    // bandierine ai lati
    const flagMat = new THREE.MeshBasicMaterial({ map: ckTex, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), flagMat);
      f.position.set(c + s * 18 - s * 0.9, hgt(c + s * 18, z) + 7.4, z);
      grp.add(f);
    }
    world.add(grp);
    return grp;
  }


  return { CITY_CFG, assetsFor, facadesFor, roofFor, buildingGeo, gemGeo, gemMat, textTexture, finishLine, rampCity, propGeos };
};
