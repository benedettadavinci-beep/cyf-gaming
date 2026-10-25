// modulo: rider
// dipende da: base
// Il modello del rider (lo stesso per te e per gli avversari): forme arrotondate, giacca con lo stemma CYF e la maglia
// della città (JERSEYS), tavola da neve o skateboard, posa (pose) che segue curva, salto, grab e switch.
// Solo modello e animazione: niente fisica, niente stato di gioco.
window.PN = window.PN || {};
PN.rider = (() => {
  const { TAU, lin, store } = PN.base;
  // ---------- riders (local and remote share the same model) ----------
  const RM = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.7, metalness: 0 });
  const SHARED = { board: RM('#121c2b'), stripe: RM('#ff5a1f'), pants: RM('#2a3d58'), glove: RM('#141414'), helmet: RM('#eef2f6'), helmetPad: RM('#2b2f36'), helmetIn: Object.assign(RM('#eef2f6'), { side: THREE.DoubleSide }), boot: RM('#1b1b1b'), skin: RM('#dfae8c'), goggle: new THREE.MeshStandardMaterial({ color: lin('#ffb347'), roughness: 0.15, metalness: 0.6 }) };
  const SKATE = { deck: RM('#b9783f'), grip: RM('#1c1c1e'), truck: new THREE.MeshStandardMaterial({ color: lin('#9aa3ad'), roughness: 0.35, metalness: 0.7 }), wheel: RM('#f1e4c4'), wheelGeo: new THREE.CylinderGeometry(0.028, 0.028, 0.032, 14) };
  const UP = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3(), tmpE = new THREE.Vector3(), GRAB_HAND = new THREE.Vector3(0.2, 0.12, -0.08);
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
    // testa a uovo, casco, occhiali avvolgenti con elastico
    head: lathe([[0.001, -0.125], [0.05, -0.12], [0.08, -0.095], [0.098, -0.04], [0.104, 0.02], [0.1, 0.08], [0.074, 0.125], [0.001, 0.142]], 24).scale(1.08, 1, 0.9),
    // casco che copre anche le orecchie, con i paraorecchie e la visiera sul retro
    // calotta intera sopra, e sotto un guscio aperto davanti per il viso (il davanti della testa è +x)
    helmet: new THREE.SphereGeometry(0.146, 28, 10, 0, TAU, 0, Math.PI * 0.36).scale(1.1, 0.98, 1.0),
    helmetSide: new THREE.SphereGeometry(0.146, 28, 12, Math.PI + 0.95, TAU - 1.9, Math.PI * 0.34, Math.PI * 0.3).scale(1.1, 0.98, 1.0),
    earpad: new THREE.SphereGeometry(0.05, 14, 10).scale(1, 1.15, 0.45),
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
    deck: roundedSlab(0.21, 0.56, 0.02, 0.018),
    tail: roundedSlab(0.21, 0.17, 0.1, 0.018),
    grip: roundedSlab(0.2, 0.55, 0.02, 0.004),
    hanger: new THREE.CylinderGeometry(0.012, 0.012, 0.17, 10).rotateZ(Math.PI / 2),
    baseplate: new THREE.CylinderGeometry(0.03, 0.035, 0.03, 12)
  };
  // maglie delle città: solo i colori tradizionali, senza nomi o stemmi delle squadre
  const JERSEYS = {
    napoli: { body: ['#1e8fd6'], sleeves: '#1e8fd6' },
    roma: { body: ['#8e2434'], sleeves: '#e8a21a' },
    'milano-rossonera': { body: ['#c8102e', '#15151a'], sleeves: '#15151a' },
    'milano-nerazzurra': { body: ['#1b3c8c', '#15151a'], sleeves: '#15151a' },
    'torino-granata': { body: ['#7f2231'], sleeves: '#7f2231' },
    'torino-bianconera': { body: ['#f4f4f4', '#15151a'], sleeves: '#f4f4f4' },
    palermo: { body: ['#e7a4bd', '#15151a'], sleeves: '#15151a' },
    bologna: { body: ['#8e2434', '#1b2a6b'], sleeves: '#1b2a6b' }
  };
  const myJersey = () => { const v = store.get('cyf.jersey') || ''; return JERSEYS[v] ? v : ''; };
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
    const J = JERSEYS[jersey];
    const body = J ? J.body : [hex];
    g.fillStyle = body[0]; g.fillRect(0, 0, 1024, 512);
    if (body.length === 2) { g.fillStyle = body[1]; for (let x = 0; x < 1024; x += 256) g.fillRect(x + 128, 0, 128, 512); }   // strisce verticali
    // cuciture e pieghe leggere
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 300, 1024, 6);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 306, 1024, 4);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(250, 0, 5, 512); g.fillRect(762, 0, 5, 512);
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
    jacketDark.color.multiplyScalar(0.7);
    const mesh = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; (parent || body).add(m); return m; };
    const G = RIDER_GEO;
    // snowboard (neve) e skateboard con le rotelle (città senza neve): se ne vede uno alla volta
    const snowG = new THREE.Group(), skateG = new THREE.Group();
    body.add(snowG, skateG);
    mesh(G.snowboard, SHARED.board, snowG).position.y = 0.05;
    mesh(G.stripe, SHARED.stripe, snowG).position.y = 0.067;
    for (const s of [-1, 1]) {
      const bind = mesh(G.binding, SHARED.boot, snowG);
      bind.position.set(-0.01, 0.12, s * 0.26);
      bind.rotation.y = Math.PI;
      const boot = mesh(G.boot, SHARED.boot);
      boot.position.set(0.02, 0.135, s * 0.26);
      mesh(G.toe, SHARED.boot).position.set(0.02, 0.2, s * 0.26);
    }
    mesh(G.deck, SKATE.deck, skateG).position.y = 0.056;
    mesh(G.grip, SKATE.grip, skateG).position.y = 0.068;
    for (const s of [-1, 1]) {
      const tail = mesh(G.tail, SKATE.deck, skateG);
      tail.position.set(0, 0.072, s * 0.34); tail.rotation.x = -s * 0.38;
      mesh(G.baseplate, SKATE.truck, skateG).position.set(0, 0.04, s * 0.2);
      mesh(G.hanger, SKATE.truck, skateG).position.set(0, 0.028, s * 0.2);
      for (const w of [-1, 1]) {
        const wheel = mesh(SKATE.wheelGeo, SKATE.wheel, skateG);
        wheel.position.set(w * 0.095, 0.028, s * 0.2);
        wheel.rotation.z = Math.PI / 2;
      }
    }
    skateG.visible = false;
    function setBoard(kind) { snowG.visible = kind !== 'skate'; skateG.visible = kind === 'skate'; }
    const limb = (r, mat) => mesh(G.limb(r), mat);
    const joint = (r, mat) => mesh(G.joint(r), mat);
    const L = {
      thighL: mesh(G.thigh, SHARED.pants), thighR: mesh(G.thigh, SHARED.pants), shinL: mesh(G.shin, SHARED.pants), shinR: mesh(G.shin, SHARED.pants),
      uarmL: mesh(G.uarm, sleeve), uarmR: mesh(G.uarm, sleeve), farmL: mesh(G.farm, sleeve), farmR: mesh(G.farm, sleeve)
    };
    const JM = {
      kneeL: joint(0.085, SHARED.pants), kneeR: joint(0.085, SHARED.pants), hipL: joint(0.098, SHARED.pants), hipR: joint(0.098, SHARED.pants),
      shL: joint(0.074, sleeve), shR: joint(0.074, sleeve), elL: joint(0.062, sleeve), elR: joint(0.062, sleeve)
    };
    const pelvis = mesh(G.pelvis, SHARED.pants);
    const torso = mesh(G.torso, jacket);
    mesh(G.band, jacketDark, torso);
    mesh(G.collar, jacketDark, torso).position.y = 0.535;
    mesh(G.hood, jacketDark, torso).position.set(-0.1, 0.5, 0);           // cappuccio arrotolato sulla schiena
    mesh(G.zip, SHARED.glove, torso).position.set(0.118, 0.22, 0);        // cerniera davanti
    const headG = new THREE.Group();
    body.add(headG);
    mesh(G.neck, SHARED.skin, headG).position.y = -0.15;
    mesh(G.head, SHARED.skin, headG);
    mesh(G.nose, SHARED.skin, headG).position.set(0.112, -0.005, 0);
    mesh(G.gaiter, jacketDark, headG);
    mesh(G.helmet, SHARED.helmet, headG).position.set(-0.012, 0.0, 0);
    mesh(G.helmetSide, SHARED.helmetIn, headG).position.set(-0.012, 0.0, 0);
    for (const s of [-1, 1]) mesh(G.earpad, SHARED.helmetPad, headG).position.set(-0.02, -0.035, s * 0.14);
    mesh(G.strap, SHARED.glove, headG).position.y = 0.022;
    mesh(G.goggleFrame, SHARED.glove, headG).position.set(0.002, 0.024, 0);
    mesh(G.goggle, SHARED.goggle, headG).position.set(0.006, 0.024, 0);
    const gloveL = mesh(G.glove, SHARED.glove), gloveR = mesh(G.glove, SHARED.glove);
    for (const [gl, s] of [[gloveL, 1], [gloveR, -1]]) {
      const th = mesh(G.thumb, SHARED.glove, gl); th.position.set(0.045, 0.01, -s * 0.02); th.rotation.z = -0.5;
      mesh(G.cuff, SHARED.glove, gl).position.y = -0.055;
    }
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
    const JR = {}; ['ankL', 'ankR', 'kneeL', 'kneeR', 'hipL', 'hipR', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR'].forEach(k => JR[k] = new THREE.Vector3());
    function pose(k, arms, twist, grab = 0, fwd = 0, sw = 0) {
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
      const J = JERSEYS[jersey];
      jacket.map = jacketTexture(hex, J ? jersey : '');
      jacket.needsUpdate = true;
      sleeve.color.copy(lin(J ? J.sleeves : hex));
      jacketDark.color.copy(lin(J ? J.body[0] : hex)).multiplyScalar(0.7);
    }
    pose(0.3, 0.2, 0);
    return { group, body, pose, setColor, setBoard };
  }
  return { JERSEYS, myJersey, jacketTexture, switchOf, bodyTurn, makeRider };
})();
