// modulo: generazione
// dipende da: base, geometria, pista, citta, tracciato, fisica
// La pista si costruisce man mano che il rider scende, con il seme della gara: stessi numeri casuali su ogni dispositivo,
// quindi stessa pista per tutti (R-103). Qui stanno le file di ostacoli, bonus, rampe e porte (uguali in ogni città,
// R-309), i trampolini giganti con lo spazio libero attorno (R-214), gli alberi della neve, i palazzi, gli oggetti e i
// lati della strada vera delle città (R-307), i bordi e le paline. L'elenco degli oggetti in pista è "objs".
// Si crea con PN.generazione({ world, ANISO, pista, citta, stato }) dal gioco: stato dà P, mode, racing(), raceLen, theme, isCity().
window.PN = window.PN || {};
PN.generazione = ({ world, ANISO, pista, citta: CITTA, stato }) => {
  const { TAU, lin, mulberry32 } = PN.base;
  const { GEO, vcMat } = PN.geometria;
  const { center, hgt, addMesh } = pista;
  const { CITY_CFG, facadesFor, roofFor, buildingGeo, gemGeo, gemMat } = CITTA;
  const assets = () => CITTA.assetsFor(stato.theme);
  const isCity = () => stato.isCity();
  let objs = [];
  let bigZones = [];   // spazio libero attorno ai trampolini giganti
  let rowRng = Math.random, forestRng = Math.random, buildRng = Math.random, propRng = Math.random, buildZ = 0, propZ = 0, rowZ = 0, forestZ = 0, markerZ = 0;
  // --- bordi della strada (riga "Fondo stradale"): doppia linea gialla al marciapiede (Londra), marciapiede a mosaico (Berlino) ---
  function mosaicTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d'); const rr = mulberry32(52);
    g.fillStyle = '#8d8a84'; g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 64; x += 8) { const v = 150 + Math.floor(rr() * 50); g.fillStyle = 'rgb(' + v + ',' + (v - 3) + ',' + (v - 8) + ')'; g.fillRect(x + 1, y + 1, 6.4, 6.4); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, ANISO);
    return t;
  }
  const EDGE_MATS = {
    lines: () => new THREE.MeshBasicMaterial({ color: lin('#e8c026'), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
    walk: () => new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
  };
  const edgeMats = {};
  // striscia che segue la curva della strada da z a z-len, a "off" metri dal centro, larga w
  function edgeStrip(z0, len, off, w, mat, uvScale) {
    const n = Math.round(len), pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 - i, c = center(z);
      for (const k of [-1, 1]) { const x = c + off + k * w / 2; pos.push(x, hgt(x, z) + 0.04, z); uv.push(k > 0 ? 1 : 0, i * uvScale); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }   // facce rivolte in alto
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; world.add(m);
    return m;
  }
  // --- lati della strada vera (R-307, sezione 12 dei requisiti): mare, fori, file di alberi; numeri casuali propri, la pista non cambia ---
  const SIDE_MATS = {
    sea: () => new THREE.MeshStandardMaterial({ color: lin('#2f78b4'), roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }),
    wall: () => new THREE.MeshStandardMaterial({ color: lin('#d9d2c0'), roughness: 0.9 }),
    ruin: () => new THREE.MeshStandardMaterial({ color: lin('#c9bba0'), roughness: 0.95 }),
    grass: () => new THREE.MeshStandardMaterial({ color: lin('#6f8a4a'), roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })
  };
  const sideMats = {};
  const sideMat = k => sideMats[k] || (sideMats[k] = SIDE_MATS[k]());
  // muretto che segue la curva (parapetto del lungomare, muri bassi dei fori): facce verticali e cima
  function wallStrip(z0, len, off, w, h, mat) {
    const n = Math.round(len / 2), pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 - i * 2, c = center(z), y0 = hgt(c + off, z) - 0.2;
      for (const [dx, dy] of [[-w / 2, 0], [-w / 2, h], [w / 2, h], [w / 2, 0]]) pos.push(c + off + dx, y0 + dy, z);
      if (i) { const a = (i - 1) * 4, b = i * 4; for (let k = 0; k < 3; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; world.add(m);
    return m;
  }
  let sideRng = Math.random, sideZ = 0, treeZ = 0;
  const STREET_SIDE = {
    // Napoli, via Partenope: il mare con il parapetto di pietra
    sea(z, len, s) {
      objs.push({ type: 'side', x: center(z) + s * 60, z: z - len / 2, mesh: edgeStrip(z, len, s * 60, 76, sideMat('sea'), 0.05) });
      objs.push({ type: 'side', x: center(z) + s * 22.4, z: z - len / 2, mesh: wallStrip(z, len, s * 22.4, 0.5, 1.0, sideMat('wall')) });
    },
    // Roma, via dei Fori Imperiali: prato, muri bassi di tufo e colonne spezzate
    ruins(z, len, s) {
      const r = sideRng;
      objs.push({ type: 'side', x: center(z) + s * 40, z: z - len / 2, mesh: edgeStrip(z, len, s * 40, 36, sideMat('grass'), 0.05) });
      for (let d = 2; d < len - 2; d += 4 + r() * 7) {
        const zz = z - d, off = 24 + r() * 14, x = center(zz) + s * off;
        if (r() < 0.55) {
          const h = 1.5 + r() * 5, col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, h, 10), sideMat('ruin'));
          col.position.set(x, hgt(x, zz) + h / 2 - 0.2, zz); col.castShadow = true; world.add(col);
          objs.push({ type: 'side', x, z: zz, mesh: col });
        } else {
          const w = 3 + r() * 6, h = 0.8 + r() * 1.6, wl = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), sideMat('ruin'));
          wl.position.set(x, hgt(x, zz) + h / 2 - 0.2, zz); wl.rotation.y = r() * 0.6; wl.castShadow = true; world.add(wl);
          objs.push({ type: 'side', x, z: zz, mesh: wl });
        }
      }
    }
  };
  function spawnStreetSide(z, len, ghost) {
    const ST = CITY_CFG[stato.theme].street;
    if (!ST) return;
    for (const s of [-1, 1]) {
      const kind = s < 0 ? ST.L : ST.R;
      const fn = STREET_SIDE[kind];
      if (!fn) continue;
      if (ghost) { if (kind === 'ruins') for (let d = 2; d < len - 2; d += 4 + sideRng() * 7) { sideRng(); sideRng(); sideRng(); sideRng(); } continue; }
      fn(z, len, s);
    }
  }
  // file di alberi ai lati (platani, tigli, jacaranda, pini): ogni "every" metri, a 22 m dal centro
  function spawnSideTrees(z, ghost) {
    const ST = CITY_CFG[stato.theme].street;
    if (!ST || !ST.trees) return 18;
    const geo = assets().sideTree, r = sideRng;
    for (const s of ST.trees.sides || [-1, 1]) {
      const jitter = (r() - 0.5) * 2, sc = 0.9 + r() * 0.3, ry = r() * TAU;
      if (ghost) continue;
      const x = center(z) + s * (ST.trees.off || 22.3) + jitter * 0.3;
      objs.push({ type: 'sidetree', x, z, mesh: addMesh(geo, vcMat, x, z, { s: sc, ry, shadow: true }) });
    }
    return ST.trees.every;
  }

  function spawnEdge(z, len) {
    const E = CITY_CFG[stato.theme].edge;
    if (!E) return;
    const mat = edgeMats[E] || (edgeMats[E] = EDGE_MATS[E]());
    for (const s of [-1, 1]) {
      if (E === 'lines') { for (const d of [20.25, 20.75]) objs.push({ type: 'edge', x: center(z) + s * d, z: z - len / 2, mesh: edgeStrip(z, len, s * d, 0.3, mat, 0.1) }); }
      else objs.push({ type: 'edge', x: center(z) + s * 23.3, z: z - len / 2, mesh: edgeStrip(z, len, s * 23.3, 3.2, mat, 0.25) });
    }
  }

  // ---------- spawning (seeded: everybody in a race gets the same course) ----------
  function addTree(rng, x, z, s, shadow, ghost) {
    const tilt = [(rng() - 0.5) * 0.1, (rng() - 0.5) * 0.1];
    const geo = GEO.trees[rng() < 0.3 ? 1 : 0];
    const sy = 0.9 + rng() * 0.25, ry = rng() * TAU;   // stessi numeri casuali in ogni scenario: la pista resta identica
    if (ghost) return null;
    if (isCity()) return { type: 'tree', x, z, s, mesh: addMesh(assets().tall, vcMat, x, z, { s: s * 1.05, sy, ry, tilt, shadow }) };
    return { type: 'tree', x, z, s, mesh: addMesh(geo, vcMat, x, z, { s, sy, ry, tilt, shadow }) };
  }
  // una fila di ostacoli, bonus, rampe e porte: dove vanno lo decide il tracciato (moduli/tracciato.js, uguale per
  // tutti e anche per gli avversari del software, R-234); qui si costruiscono i modelli. ghost: fila già alle spalle,
  // si consumano solo i numeri casuali
  function spawnRow(z, ghost) {
    PN.tracciato.riga(z, {
      r: rowRng, center, inBigZone,
      zona: zone => {
        bigZones.push(zone);
        // via quello che il trampolino coprirebbe (anche dalla fila prima): stessa scelta su ogni dispositivo
        objs = objs.filter(o => { if (PN.tracciato.coperto(o, zone)) { removeObj(o); return false; } return true; });
      },
      metti: o => { if (!ghost) objs.push(costruisci(o)); }
    });
  }
  // scritta CYF sul trampolino gigante (R-240): un foglio che segue la curva vera della salita (la stessa rampTop della
  // fisica), con i colori dello stemma; si legge arrivando. Dalla 0.25.2 (baco B-03) anche due cartelli CYF alti ai lati
  // dello stacco, rivolti verso chi arriva: la salita è inclinata solo ~13°, quindi la scritta per terra si leggeva solo
  // nell'ultimo secondo e mezzo, mezza coperta dal rider; i cartelli si vedono da lontano, come sui trampolini veri.
  // Texture, materiali e geometrie dei cartelli: uno solo per tutti i trampolini
  let cyfTex = null, cyfMat = null, cyfCartello = null;
  function texturaCYF() {
    if (cyfTex) return cyfTex;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const box = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    box(10, 18, 492, 220, 46); g.fillStyle = '#13233a'; g.fill();
    g.lineWidth = 12; g.strokeStyle = '#ffffff'; g.stroke();
    g.font = '900 200px "Barlow Condensed", "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#ffffff'; g.strokeText('CYF', 256, 136);
    g.fillStyle = '#ff5a1f'; g.fillText('CYF', 256, 136);
    cyfTex = new THREE.CanvasTexture(c); cyfTex.encoding = THREE.sRGBEncoding; cyfTex.anisotropy = Math.min(8, ANISO);
    return cyfTex;
  }
  function materialeCYF() {
    if (!cyfMat) cyfMat = new THREE.MeshStandardMaterial({ map: texturaCYF(), transparent: true, roughness: 0.7, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    return cyfMat;
  }
  // cartello: pannello 1,8 × 0,9 m che non prende luce (si legge anche controsole, come un'insegna) su un palo bianco
  function cartelloCYF() {
    if (!cyfCartello) cyfCartello = {
      pannello: new THREE.PlaneGeometry(1.8, 0.9),
      palo: new THREE.CylinderGeometry(0.06, 0.06, 4.6, 8),
      matPannello: new THREE.MeshBasicMaterial({ map: texturaCYF(), transparent: true, side: THREE.DoubleSide }),
      matPalo: new THREE.MeshStandardMaterial({ color: lin('#e8edf2'), roughness: 0.5 })
    };
    return cyfCartello;
  }
  function scrittaCYF(r) {
    const k = 2, city = isCity(), base = hgt(r.x, r.z), NX = 4, NZ = 14, W = 5.2;
    const z0 = r.z + 1.6 * k, z1 = r.z - 1.7 * k;   // dal piede della salita fino quasi al bordo di stacco
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NZ; i++) {
      const z = z0 + (z1 - z0) * i / NZ, y = base + PN.fisica.rampTop(r, z, city) + 0.03;
      for (let j = 0; j <= NX; j++) { pos.push(r.x + (j / NX - 0.5) * W, y, z); uv.push(j / NX, i / NZ); }
      if (i) for (let j = 0; j < NX; j++) { const a = (i - 1) * (NX + 1) + j, b = a + NX + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, materialeCYF()); m.receiveShadow = true;
    m.userData.proprio = true;   // geometria solo di questo trampolino: si libera quando il trampolino esce di scena
    const gruppo = new THREE.Group();
    gruppo.add(m);
    // i due cartelli: fuori dal corpo della rampa (largo 3,5 m per lato con il bordo), vicino allo stacco, con il pannello
    // più alto dello stacco (2,7 m), così chi passa a fianco della rampa ci passa sotto
    const C = cartelloCYF(), zc = r.z - 2 * k + 0.4;
    for (const lato of [-1, 1]) {
      const x = r.x + lato * 3.75;
      const palo = new THREE.Mesh(C.palo, C.matPalo); palo.position.set(x, base + 2.3, zc);
      const pannello = new THREE.Mesh(C.pannello, C.matPannello); pannello.position.set(x, base + 4.0, zc);
      gruppo.add(palo, pannello);
    }
    world.add(gruppo);
    return gruppo;
  }
  function costruisci(o) {
    const { x, z } = o;
    if (o.type === 'tree') {
      if (isCity()) return { type: 'tree', x, z, s: o.s, mesh: addMesh(assets().tall, vcMat, x, z, { s: o.s * 1.05, sy: o.sy, ry: o.ry, tilt: o.tilt, shadow: true }) };
      return { type: 'tree', x, z, s: o.s, mesh: addMesh(GEO.trees[o.gi], vcMat, x, z, { s: o.s, sy: o.sy, ry: o.ry, tilt: o.tilt, shadow: true }) };
    }
    if (o.type === 'rock') return { type: 'rock', x, z, s: o.s, mesh: addMesh(isCity() ? assets().low : GEO.rock, vcMat, x, z, { s: o.s, ry: o.ry }) };
    const CC = CITY_CFG[stato.theme];
    if (o.type === 'gem') {
      const food = CC ? (o.alt ? assets().fa : assets().fb) : null;
      return { type: 'gem', x, z, mesh: food ? addMesh(food, vcMat, x, z, { y: 0.9 }) : addMesh(gemGeo, gemMat, x, z, { y: 0.9 }), phase: o.phase, food: CC ? (o.alt ? CC.fa : CC.fb) : null };
    }
    if (o.type === 'ramp') {
      const r = { type: 'ramp', x, z, used: false, big: o.big, mesh: addMesh(isCity() ? assets().ramp : GEO.ramp, vcMat, x, z, o.big ? { recv: true, s: 2 } : { recv: true }) };
      if (o.big) r.deco = scrittaCYF(r);   // sul trampolino gigante la scritta CYF (R-240)
      return r;
    }
    const gi = o.gi;
    return { type: 'gate', x, z, half: 2.4, done: false, mesh: addMesh(CC ? assets().gates[gi] : (gi ? GEO.gateBlue : GEO.gateRed), vcMat, x, z), col: CC ? CC.gate[gi] : (gi ? '#2766c6' : '#d8302a') };
  }
  function inBigZone(x, z, pad) {
    for (const b of bigZones) if (z <= b.z0 && z >= b.z1 && Math.abs(x - b.x) < b.hw + pad) return true;
    return false;
  }
  // palazzi ai lati della strada (solo estetica: non cambiano la pista)
  function spawnBuildings(ghost) {
    const r = buildRng;
    const z = buildZ, c = center(z);
    let len = 0;
    const theme = stato.theme;
    const ST = CITY_CFG[theme].street || {};
    for (const side of [-1, 1]) {
      if ((side < 0 ? ST.L : ST.R) && (side < 0 ? ST.L : ST.R) !== 'bldg') continue;   // R-307: niente palazzi dove la strada vera ha il mare o i fori
      const bh = CITY_CFG[theme].bldH;
      const w = 9 + r() * 6, d = 9 + r() * 5, h = bh[0] + r() * bh[1];
      const x = c + side * (23.5 + (CITY_CFG[theme].setback || 0) + d / 2 + r() * 2);
      const matI = Math.floor(r() * 8);
      const rot = (r() - 0.5) * 0.06;
      if (!ghost) {
        const mats = facadesFor(theme), roof = roofFor(theme);
        const mat = mats[matI % mats.length];
        const m = new THREE.Mesh(buildingGeo(d, h, w), [mat, mat, roof, roof, mat, mat]);
        m.receiveShadow = true;
        m.position.set(x, hgt(x, z), z);
        m.rotation.y = rot;
        world.add(m);
        objs.push({ type: 'bldg', x, z, mesh: m });
      }
      len = Math.max(len, w);
    }
    buildZ -= len + 0.6 + r() * 1.2;
  }
  // un oggetto sul marciapiede (tram, cabina, bus, taxi, ombrellone, Muro), allineato alla strada
  function spawnProp(z, ghost) {
    const r = propRng, list = assets().props;
    let side = r() < 0.5 ? -1 : 1;
    const pick = list[Math.floor(r() * list.length)], jitter = r();
    if (!pick) return 0;
    const ST = CITY_CFG[stato.theme].street;
    if (ST && (side < 0 ? ST.L : ST.R) !== 'bldg') side = -side;   // niente auto sul mare o sui fori
    if (!ghost) {
      const c = center(z), x = c + side * (23.8 + jitter * 0.4);
      const ry = -(center(z - 1) - center(z)) + (side < 0 ? Math.PI : 0);
      objs.push({ type: 'prop', x, z, mesh: addMesh(pick.geo, vcMat, x, z, { ry }) });
    }
    return pick.len;
  }
  function removeObj(o) {
    world.remove(o.mesh);
    if (o.deco) { world.remove(o.deco); o.deco.traverse(m => { if (m.userData.proprio) m.geometry.dispose(); }); }
    if (o.type === 'bldg' || o.type === 'edge' || o.type === 'side') o.mesh.geometry.dispose();
  }
  function spawnForest(z, ghost) {
    const r = forestRng, c = center(z);
    for (const side of [-1, 1]) {
      const k = r() < 0.65 ? 2 : 1;
      for (let i = 0; i < k; i++) {
        const x = c + side * (22 + r() * 26), tz = z + (r() - 0.5) * 3;
        const t = addTree(r, x, tz, 0.85 + r() * 0.55, Math.abs(x - c) < 32, ghost);
        if (t) objs.push(t);
      }
    }
  }
  function ensureSpawned() {
    const { P, mode, raceLen } = stato;
    const horizon = P.z - 200;
    const bLine = P.z + 16;   // quello che è già alle spalle non va costruito: solo "consumato"
    const soloWorld = mode === 'solo' || mode === 'over' || mode === 'pause';
    while (rowZ > horizon) {
      // in gara niente ostacoli negli ultimi 25 m prima del traguardo
      if (soloWorld || (stato.racing() && -rowZ < raceLen - 25)) spawnRow(rowZ, rowZ > bLine);
      rowZ -= PN.tracciato.passo(rowRng, rowZ);
    }
    if (isCity()) {
      while (buildZ > horizon) spawnBuildings(buildZ > bLine);
      if (assets().props.length) while (propZ > horizon) { const len = propRng() < 0.6 ? spawnProp(propZ, propZ > bLine) : 0; propZ -= 14 + len + propRng() * 30; }
    } else {
      while (forestZ > horizon) { spawnForest(forestZ, forestZ > bLine); forestZ -= 2.4 + forestRng() * 1.6; }
    }
    while (markerZ > horizon) {
      const c = center(markerZ);
      if (markerZ <= bLine) {
        for (const s of [-1, 1]) objs.push({ type: 'marker', x: c + s * 19.5, z: markerZ, mesh: addMesh(isCity() ? assets().marker : GEO.marker, vcMat, c + s * 19.5, markerZ) });
        if (isCity()) spawnEdge(markerZ, 22);
      }
      markerZ -= 22;
    }
    if (isCity() && CITY_CFG[stato.theme].street) {
      while (sideZ > horizon) { spawnStreetSide(sideZ, 22, sideZ > bLine); sideZ -= 22; }
      while (treeZ > horizon) treeZ -= spawnSideTrees(treeZ, treeZ > bLine);
    }
    const behind = P.z + 16;
    if (bigZones.length && bigZones[0].z1 > behind) bigZones = bigZones.filter(b => b.z1 <= behind);
    if (objs.length && objs.some(o => o.z > behind)) objs = objs.filter(o => { if (o.z > behind) { removeObj(o); return false; } return true; });
  }
  // si chiama a ogni nuova pista (reset del gioco): numeri casuali dal seme, contatori all'inizio, pista vuota
  function riparti(seed) {
    svuota();
    rowRng = mulberry32(seed);
    forestRng = mulberry32(seed ^ 0x5bd1e995);
    buildRng = mulberry32(seed ^ 0x2c1b3c6d);
    propRng = mulberry32(seed ^ 0x6a09e667);
    buildZ = 30; propZ = 10; sideZ = 20; treeZ = 14; sideRng = mulberry32(seed ^ 0x1b873593);
    bigZones = [];
    rowZ = -28; forestZ = 22; markerZ = 10;
  }
  function svuota() {
    for (const o of objs) removeObj(o);
    objs = [];
  }
  return {
    get objs() { return objs; }, set objs(v) { objs = v; }, get bigZones() { return bigZones; },
    riparti, svuota, ensureSpawned, removeObj
  };
};
