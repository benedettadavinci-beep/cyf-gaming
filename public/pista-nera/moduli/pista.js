// modulo: pista
// dipende da: base
// La pista: asse della strada per ogni scenario (TRACKS, center), rilievo del terreno (hgt), texture del suolo,
// piano del terreno che segue il rider (updateGround) e le montagne della Neve (ranges).
// Si crea con PN.pista({ scene, world, ANISO, TEX }) una volta sola, dal gioco.
window.PN = window.PN || {};
PN.pista = ({ scene, world, ANISO, TEX }) => {
  const { TAU, clamp, isPhone, lin, mulberry32 } = PN.base;
  // ---------- terrain ----------
  // asse della pista: ogni scenario ha la sua forma (R-312). Onde sovrapposte [ampiezza, lunghezza, fase];
  // nelle città con i rettilinei una "busta" lenta (lo, W, q, k) spiana le curve per lunghi tratti.
  // Tutti i tracciati hanno la stessa pendenza media della Neve (dalla 0.10.0 con le curve più spinte di R-311,
  // fattore di tempo 1,0237; controllo: tools/verifica/piste.py): più curve corte o rettilinei alternati a curve
  // più decise, ma tempi simili. Ostacoli, bonus, rampe e porte restano nella stessa sequenza in ogni città (R-309).
  const TRACKS = {
    neve:        { w: [[27, 230, 0], [12, 105, 0], [4.5, 46, 0]], lo: 1 },                                         // R-311: curve più frequenti e più spinte
    napoli:      { w: [[16.89, 190, 1.1], [9.5, 85, 0.4], [4.75, 38, 2.0]], lo: 1 },  // tornanti continui come la costiera
    roma:        { w: [[34.17, 240, 0.7], [17.08, 100, 1.9], [6.21, 44, 0.3]], lo: 0.4, W: 420, q: 0.5, k: 1.0 },
    milano:      { w: [[34.38, 210, 2.1], [17.19, 90, 0.9], [5.15, 40, 1.4]], lo: 0.35, W: 520, q: 1.3, k: 1.2 },
    parigi:      { w: [[45.91, 300, 0.2], [22.97, 130, 2.4], [5.74, 50, 1.0]], lo: 0.35, W: 480, q: 2.2, k: 1.1 },  // viali lunghi e curvoni
    londra:      { w: [[12.31, 150, 0.9], [8.21, 70, 2.6], [4.1, 33, 0.5]], lo: 1 },
    francoforte: { w: [[30.21, 220, 1.7], [15.11, 95, 0.2], [6.04, 42, 2.9]], lo: 0.45, W: 380, q: 0.9, k: 1.0 },
    madrid:      { w: [[45.94, 280, 2.7], [19.14, 115, 1.2], [5.74, 48, 0.6]], lo: 0.35, W: 560, q: 2.9, k: 1.1 },
    lisbona:     { w: [[9.96, 130, 0.3], [6.97, 62, 1.6], [3.99, 30, 2.2]], lo: 1 },  // la più tortuosa, come il tram 28
    zagabria:    { w: [[18.64, 170, 2.4], [11.99, 78, 0.8], [5.33, 36, 1.7]], lo: 0.55, W: 350, q: 1.8, k: 1 },
    berlino:     { w: [[43.14, 260, 1.4], [19.61, 110, 2.2], [5.89, 46, 0.1]], lo: 0.35, W: 600, q: 0.2, k: 1.2 },  // grandi viali dritti
    zurigo:      { w: [[37.01, 320, 0.5], [20.35, 140, 1.3], [7.4, 52, 2.5]], lo: 0.55, W: 450, q: 2.6, k: 1 },
    newyork:     { w: [[29.36, 200, 0.8], [16.32, 80, 2.9], [4.89, 36, 1.2]], lo: 0.3, W: 640, q: 1.0, k: 1.3 },  // a griglia: i rettilinei più lunghi
  };
  let TRK = TRACKS.neve;
  const center = z => {
    const T = TRK;
    let s = 0;
    for (const w of T.w) s += w[0] * Math.sin(z / w[1] + w[2]);
    if (T.lo < 1) s *= T.lo + (1 - T.lo) * Math.pow(0.5 + 0.5 * Math.sin(z / T.W + T.q), T.k);
    return s;
  };
  function hgt(x, z) {
    const off = Math.abs(x - center(z));
    const rough = 0.32 + clamp((off - 17) / 12, 0, 1) * 1.4;
    const waves = 0.6 * Math.sin(x * 0.13 + z * 0.05) * Math.sin(z * 0.09 - x * 0.03)
                + 0.32 * Math.sin(x * 0.31 + 1.7) * Math.sin(z * 0.23);
    return rough * waves + clamp((off - 19) / 12, 0, 1) * 1.6;
  }
  // texture del terreno: una piastrella di 8 m ripetuta (50 volte sui 400 m del terreno)
  function groundCanvas(draw) {
    const c = document.createElement('canvas'); c.width = c.height = TEX;
    const g = c.getContext('2d');
    g.scale(TEX / 512, TEX / 512);   // si disegna sempre in coordinate 512, la tela è più fine sul PC
    draw(g);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    tex.anisotropy = ANISO;
    return tex;
  }
  const snowTexture = () => groundCanvas(g => {
    const rr = mulberry32(5);
    g.fillStyle = '#e6eef5'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 6) { g.fillStyle = (y / 6) % 2 ? 'rgba(105,140,180,0.12)' : 'rgba(255,255,255,0.45)'; g.fillRect(0, y, 512, 3); }
    for (let i = 0; i < 5200; i++) {
      const r = rr();
      g.fillStyle = r < 0.45 ? 'rgba(80,120,170,0.13)' : 'rgba(255,255,255,0.85)';
      const s = r > 0.97 ? 1.6 : 0.8;
      g.fillRect(rr() * 512, rr() * 512, s, s);
    }
  });
  // basoli di pietra lavica (scenario Napoli)
  const stoneTexture = () => groundCanvas(g => {
    const rr = mulberry32(99);
    g.fillStyle = '#2a2725'; g.fillRect(0, 0, 512, 512);
    const H = 32;
    for (let row = 0; row < 512 / H; row++) {
      let x = row % 2 ? -rr() * 40 : -rr() * 20;
      while (x < 512) {
        const w = 44 + rr() * 34;
        const v = 74 + Math.floor(rr() * 26);
        g.fillStyle = 'rgb(' + v + ',' + (v - 3) + ',' + (v - 6) + ')';
        g.fillRect(x + 1.5, row * H + 1.5, w - 2.5, H - 2.5);
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 2.5, row * H + 2.5, w - 4.5, 2);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 2.5, row * H + H - 3, w - 4.5, 1.5);
        for (let k = 0; k < 22; k++) { g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)'; g.fillRect(x + 3 + rr() * (w - 6), row * H + 4 + rr() * (H - 8), 1.2, 1.2); }
        x += w;
      }
    }
  });
  // sampietrini: cubetti di basalto posati a file (scenario Roma)
  const sampietriniTexture = () => groundCanvas(g => {
    const rr = mulberry32(42);
    g.fillStyle = '#3b3633'; g.fillRect(0, 0, 512, 512);
    const S = 12.8;   // 40 cubetti ogni 8 m: circa 20 cm l'uno
    for (let row = 0; row < 512 / S; row++) {
      const shift = row % 2 ? S / 2 : 0;
      for (let x = -S; x < 512 + S; x += S) {
        const v = 92 + Math.floor(rr() * 34), w = (rr() - 0.5) * 6;
        g.fillStyle = 'rgb(' + (v + 4 + w) + ',' + (v + w) + ',' + (v - 5 + w) + ')';
        const x0 = x + shift + 1.2 + rr() * 0.8, y0 = row * S + 1.2 + rr() * 0.8;
        g.fillRect(x0, y0, S - 2.4, S - 2.4);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x0, y0, S - 2.4, 1.4);
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x0, y0 + S - 3.6, S - 2.4, 1.2);
        if (rr() < 0.5) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x0 + rr() * 8, y0 + rr() * 8, 1.6, 1.6); }
      }
    }
  });
  const GS = 400, GSEG = isPhone ? 80 : 110, CELL = GS / GSEG;
  const GROUND_TEX = { neve: snowTexture(), napoli: null, roma: null };
  const GROUND_MAKE = { napoli: stoneTexture, roma: sampietriniTexture };
  const groundTex = GROUND_TEX.neve;
  const groundGeo = new THREE.PlaneGeometry(GS, GS, GSEG, GSEG);
  groundGeo.rotateX(-Math.PI / 2);
  const basePos = groundGeo.attributes.position.array.slice();
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.82, metalness: 0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  world.add(ground);
  let gx0 = NaN, gz0 = NaN;
  function updateGround(x, z) {
    const sx = Math.round(x / CELL) * CELL, sz = Math.round(z / CELL) * CELL;
    if (sx === gx0 && sz === gz0) return;
    gx0 = sx; gz0 = sz;
    const pos = groundGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = hgt(basePos[i] + sx, basePos[i + 2] + sz);
    groundGeo.attributes.position.needsUpdate = true;
    groundGeo.computeVertexNormals();
    groundGeo.computeBoundingSphere();
    ground.position.set(sx, 0, sz);
    groundMat.map.offset.set((sx / 8) % 1, (-sz / 8) % 1);
  }

  const ranges = new THREE.Group();
  scene.add(ranges);
  (function buildRanges() {
    const rr = mulberry32(7);
    const mk = c => new THREE.MeshBasicMaterial({ color: lin(c), fog: false });
    const near = mk('#8faccb'), far = mk('#b4c9dd'), snowN = mk('#eef4fa'), snowF = mk('#e3edf6');
    for (const m of [snowN, snowF]) { m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4; }
    for (let layer = 1; layer >= 0; layer--) {
      const R = layer ? 620 : 470;
      for (let i = 0; i < 30; i++) {
        const ang = -1.5 + i * (3.0 / 29) + (rr() - 0.5) * 0.08;
        const h = (55 + rr() * 65) * (layer ? 1.45 : 1);
        const r = 55 + rr() * 45;
        const seg = 5 + (i % 3);
        const peak = new THREE.Group();
        const base = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), layer ? far : near);
        base.position.y = h / 2;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.42, seg), layer ? snowF : snowN);
        cap.position.y = h - h * 0.21 + 0.4;
        peak.add(base, cap);
        peak.rotation.y = rr() * TAU;
        peak.position.set(Math.sin(ang) * R, -135, -Math.cos(ang) * R);
        ranges.add(peak);
      }
    }
  })();
  // un modello appoggiato sul terreno in (x, z), con scala, rotazione e ombre a scelta
  function addMesh(geo, mat, x, z, opt = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, hgt(x, z) + (opt.y || 0), z);
    if (opt.s) m.scale.setScalar(opt.s);
    if (opt.sy) m.scale.y *= opt.sy;
    if (opt.ry) m.rotation.y = opt.ry;
    if (opt.tilt) { m.rotation.x = opt.tilt[0]; m.rotation.z = opt.tilt[1]; }
    m.castShadow = opt.shadow !== false;
    m.receiveShadow = !!opt.recv;
    world.add(m);
    return m;
  }
  return {
    TRACKS, center, hgt, addMesh, groundCanvas, stoneTexture, sampietriniTexture, GROUND_TEX, GROUND_MAKE, groundMat, ground, updateGround, ranges,
    setTrack(key) { TRK = TRACKS[key] || TRACKS.neve; },   // la forma della strada dello scenario scelto
    resetGround() { gx0 = NaN; }                             // obbliga updateGround a ridisegnare il terreno
  };
};
