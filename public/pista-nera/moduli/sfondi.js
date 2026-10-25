// modulo: sfondi
// dipende da: base, geometria
// Sfondi lontani delle città: golfo di Napoli con il Vesuvio, Roma con il Colosseo e, per le altre, lo skyline
// costruito la prima volta che serve (SKY_BUILDERS). Seguono la telecamera come il cielo: non si attraversano mai.
// Si crea con PN.sfondi({ scene, ANISO }) una volta sola, dal gioco.
window.PN = window.PN || {};
PN.sfondi = ({ scene, ANISO }) => {
  const { TAU, lin, mulberry32 } = PN.base;
  const { lumpy } = PN.geometria;
  // Gli sfondi delle città seguono la telecamera come il cielo e le montagne: sono sempre lontani
  // e il rider non ci passa mai attraverso (prima, dopo ~400 m la telecamera entrava nelle case
  // o finiva sotto il piano del mare, e lo schermo diventava di un solo colore).
  // sfondo di Napoli: mare, Vesuvio, costiera e città sul golfo
  const bay = new THREE.Group();
  bay.visible = false;
  scene.add(bay);
  (function buildBay() {
    const rr = mulberry32(81);
    const mk = (c, extra) => Object.assign(new THREE.MeshBasicMaterial({ color: lin(c), fog: false }), extra || {});
    const sea = new THREE.Mesh(new THREE.CircleGeometry(1100, 64), mk('#2f78b4'));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -150;
    bay.add(sea);
    const glare = new THREE.Mesh(new THREE.RingGeometry(380, 1100, 64, 1, -0.5, 1.0), mk('#5b9bd0', { transparent: true, opacity: 0.55 }));
    glare.rotation.x = -Math.PI / 2; glare.rotation.z = Math.PI / 2 - 0.25;
    glare.position.y = -149.5;
    bay.add(glare);
    // Vesuvio: cono principale tronco + monte Somma accanto
    const ves = new THREE.Group();
    // Vesuvio con luce e ombra (non più a tinta unita) e un po' di foschia nel colore
    const haze = c => new THREE.MeshLambertMaterial({ color: lin(c), emissive: lin('#4a4f5c'), fog: false });
    const vMat = haze('#8a8590'), vTop = haze('#6c6570'), sMat = haze('#96939e');
    const cone = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(34, 250, 205, 40, 4, true), 0.035, mulberry32(3)), vMat);
    cone.position.y = 102;
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(22, 34, 10, 28), vTop);
    crater.position.y = 200;
    const somma = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(60, 230, 160, 32, 4, true), 0.04, mulberry32(4)), sMat);
    somma.position.set(-175, 80, 60);
    ves.add(somma, cone, crater);
    ves.position.set(Math.sin(0.04) * 660, -150, -Math.cos(0.04) * 660);   // R-308: il Vesuvio dritto in fondo a via Partenope
    bay.add(ves);
    // penisola sorrentina e Capri, più chiare per la distanza
    const coast = mk('#9fb0c4');
    for (let i = 0; i < 9; i++) {
      const ang = 0.78 + i * 0.07, R = 760 + i * 18;
      const h = 70 + rr() * 60 - i * 4, r = 70 + rr() * 50;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), coast);
      m.position.set(Math.sin(ang) * R, -150 + h / 2, -Math.cos(ang) * R);
      bay.add(m);
    }
    const capri = new THREE.Mesh(new THREE.ConeGeometry(70, 75, 6), mk('#adbccd'));
    capri.position.set(Math.sin(-0.05) * 900, -150 + 37, -Math.cos(-0.05) * 900);
    bay.add(capri);
    // la città lungo il golfo, a sinistra
    const houses = ['#e8c07a', '#e0a07c', '#f0dcae', '#d98f6b', '#f4efe6', '#c97c5d'].map(c => mk(c));
    for (let i = 0; i < 70; i++) {
      const ang = -1.35 + rr() * 1.5, R = 400 + rr() * 90;
      const w = 10 + rr() * 16, h = 8 + rr() * 26;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), houses[i % houses.length]);
      b.position.set(Math.sin(ang) * R, -150 + h / 2, -Math.cos(ang) * R);
      b.rotation.y = rr();
      bay.add(b);
    }
  })();

  // sfondo di Roma: tetti in coppi, cupole, pini, colli e il Colosseo davanti, in fondo alla discesa
  const rome = new THREE.Group();
  rome.visible = false;
  scene.add(rome);
  function colosseoTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const rr = mulberry32(17);
    g.fillStyle = '#d6c29c'; g.fillRect(0, 0, 1024, 512);
    // quattro ordini: attico (in alto) e tre piani di arcate
    const levels = [[0, 140, 'attic'], [140, 262, 'arch'], [262, 386, 'arch'], [386, 512, 'arch']];
    for (const [y0, y1, kind] of levels) {
      const h = y1 - y0;
      for (let b = 0; b < 4; b++) {
        const x0 = b * 256;
        // semicolonna tra le arcate
        g.fillStyle = '#e4d3b0'; g.fillRect(x0 - 14, y0 + 12, 28, h - 12);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0 + 10, y0 + 12, 6, h - 12);
        if (kind === 'arch') {
          const w = 150, ah = h * 0.74, cx = x0 + 128, top = y1 - ah;
          const gr = g.createLinearGradient(0, top, 0, y1);
          gr.addColorStop(0, '#3b2f27'); gr.addColorStop(1, '#6b5845');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(cx - w / 2, y1);
          g.lineTo(cx - w / 2, top + w / 2);
          g.arc(cx, top + w / 2, w / 2, Math.PI, 0);
          g.lineTo(cx + w / 2, y1);
          g.closePath(); g.fill();
          g.strokeStyle = '#ecdcba'; g.lineWidth = 8; g.stroke();
        } else if (b % 2 === 0) {
          g.fillStyle = '#4a3c30'; g.fillRect(x0 + 98, y0 + 54, 60, 42);
        }
      }
      // cornicione sopra ogni piano
      g.fillStyle = '#efe2c4'; g.fillRect(0, y0, 1024, 12);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y0 + 12, 1024, 5);
    }
    // macchie e colature del tempo
    for (let i = 0; i < 900; i++) { g.fillStyle = rr() < 0.6 ? 'rgba(70,55,40,0.10)' : 'rgba(255,250,235,0.10)'; g.fillRect(rr() * 1024, rr() * 512, 2 + rr() * 5, 2 + rr() * 5); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,48,36,0.07)'; g.fillRect(rr() * 1024, rr() * 300, 3 + rr() * 6, 60 + rr() * 200); }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = ANISO;
    return tex;
  }
  (function buildRome() {
    const rr = mulberry32(64);
    const mk = c => new THREE.MeshBasicMaterial({ color: lin(c), fog: false });
    const BASE = -150;
    const plain = new THREE.Mesh(new THREE.CircleGeometry(1150, 64), mk('#bba58c'));
    plain.rotation.x = -Math.PI / 2;
    plain.position.y = BASE;
    rome.add(plain);
    // il Colosseo, leggermente a destra della discesa
    const CA = 0.0, CR = 560, RX = 150, RZ = 124, H = 80;   // R-308: il Colosseo in fondo a via dei Fori Imperiali
    const col = new THREE.Group();
    const base = colosseoTexture();
    const lit = { fog: false, side: THREE.DoubleSide };
    function ring(t0, len, frac, r) {
      const tex = base.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.round(80 * len / TAU) / 4, frac);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, frac, 72, 1, true, t0, len),
        new THREE.MeshLambertMaterial(Object.assign({ map: tex, emissive: lin('#3a3226') }, lit)));
      m.position.y = frac / 2;
      col.add(m);
    }
    // anello esterno intero sul lato verso chi guarda, crollato sul lato destro (si vede l'anello interno più basso)
    const t0 = -0.95 * Math.PI;
    ring(t0, 1.28 * Math.PI, 1, 1);
    ring(t0 + 1.28 * Math.PI, 0.08 * Math.PI, 0.86, 0.985);
    ring(t0 + 1.36 * Math.PI, 0.64 * Math.PI, 0.727, 0.965);
    // gradinate e arena
    const seats = document.createElement('canvas'); seats.width = 16; seats.height = 128;
    const sg = seats.getContext('2d');
    for (let y = 0; y < 128; y += 8) { sg.fillStyle = '#bda783'; sg.fillRect(0, y, 16, 5); sg.fillStyle = '#8c7658'; sg.fillRect(0, y + 5, 16, 3); }
    const seatTex = new THREE.CanvasTexture(seats); seatTex.encoding = THREE.sRGBEncoding;
    const cavea = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.5, 0.62, 72, 1, true), new THREE.MeshLambertMaterial(Object.assign({ map: seatTex }, lit)));
    cavea.position.y = 0.36;
    const arena = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshLambertMaterial({ color: lin('#c7a877'), fog: false }));
    arena.rotation.x = -Math.PI / 2; arena.position.y = 0.06;
    col.add(cavea, arena);
    col.scale.set(RX, H, RZ);
    col.rotation.y = -CA * 0.6;
    col.position.set(Math.sin(CA) * CR, BASE, -Math.cos(CA) * CR);
    rome.add(col);
    // città: palazzi con i tetti in coppi
    const walls = ['#e2b878', '#d49660', '#c97a4f', '#ecd3a4', '#d8a878', '#b9674a', '#efe0bf'].map(mk);
    const roofs = ['#b5603f', '#a8553a', '#c06d48', '#9c4f36'].map(mk);
    for (let i = 0; i < 190; i++) {
      const ang = -1.5 + rr() * 3.0, R = 300 + rr() * 560;
      const nearCol = Math.abs(ang - CA) < 0.34 && R > 330 && R < 760;
      if (nearCol && R > 440) continue;   // la piazza davanti e intorno al Colosseo resta libera
      const w = 14 + rr() * 22, d = 14 + rr() * 22, h = (nearCol ? 6 : 10) + rr() * (nearCol ? 10 : 24);
      const wall = walls[i % walls.length], roof = roofs[i % roofs.length];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, roof, roof, wall, wall]);
      b.position.set(Math.sin(ang) * R, BASE + h / 2, -Math.cos(ang) * R);
      b.rotation.y = rr() * 1.2;
      rome.add(b);
    }
    // cupole: San Pietro a sinistra, più piccole sparse
    function dome(ang, R, s, color) {
      const g = new THREE.Group();
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.9, 24), mk('#e3d5b8'));
      drum.position.y = 0.45;
      const cup = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2), mk(color));
      cup.scale.y = 1.25; cup.position.y = 0.9;
      const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 10), mk('#e8dcc4'));
      lan.position.y = 2.38;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 10), mk(color));
      tip.position.y = 2.82;
      g.add(drum, cup, lan, tip);
      g.scale.setScalar(s);
      g.position.set(Math.sin(ang) * R, BASE + s * 0.6, -Math.cos(ang) * R);
      rome.add(g);
    }
    dome(-0.72, 820, 30, '#93a7b2');
    for (const [a, R, s] of [[-0.35, 520, 11], [0.55, 470, 9], [-1.05, 600, 10], [0.9, 640, 12], [-0.15, 700, 9]]) dome(a, R, s, '#a2b0b5');
    // pini a ombrello
    const pineM = mk('#405c37'), pineD = mk('#2f4a2b'), trunkM = mk('#6b5544');
    for (let i = 0; i < 46; i++) {
      const ang = -1.45 + rr() * 2.9, R = 280 + rr() * 520, s = 0.8 + rr() * 0.6;
      if (Math.abs(ang - CA) < 0.2 && R > 420 && R < 720) continue;
      const x = Math.sin(ang) * R, z = -Math.cos(ang) * R;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 1.2 * s, 22 * s, 6), trunkM);
      tr.position.set(x, BASE + 11 * s, z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(13 * s, 12, 8), i % 2 ? pineM : pineD);
      cap.scale.y = 0.34; cap.position.set(x, BASE + 24 * s, z);
      rome.add(tr, cap);
    }
    // colli lontani nella foschia
    for (let i = 0; i < 14; i++) {
      const ang = -1.55 + i * 0.24 + rr() * 0.1, R = 980 + rr() * 80;
      const h = 40 + rr() * 70, r = 160 + rr() * 120;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2), mk(i % 2 ? '#a9b2a6' : '#b3bab0'));
      m.scale.y = h / r;
      m.position.set(Math.sin(ang) * R, BASE, -Math.cos(ang) * R);
      rome.add(m);
    }
  })();


  // --- sfondi lontani delle nuove città: costruiti solo la prima volta che servono ---
  function skyBase(fn) {
    const g = new THREE.Group();
    const mk = c => new THREE.MeshBasicMaterial({ color: lin(c), fog: false });
    const rr = mulberry32(31);
    const B = -150;
    const H = {
      plain(col, r = 1150) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mk(col)); m.rotation.x = -Math.PI / 2; m.position.y = B; g.add(m); return m; },
      ring(cfg) {
        const walls = cfg.walls.map(mk), roofs = (cfg.roofs || cfg.walls).map(mk);
        for (let i = 0; i < cfg.n; i++) {
          const ang = (cfg.a0 ?? -1.55) + rr() * (cfg.span ?? 3.1), R = cfg.r0 + rr() * cfg.rs;
          if (cfg.avoid && Math.abs(ang - cfg.avoid[0]) < cfg.avoid[1] && R > (cfg.avoid[2] || 0)) continue;
          const w = 13 + rr() * 20, d = 13 + rr() * 20, h = cfg.h0 + rr() * cfg.hs;
          const wall = walls[i % walls.length], roof = roofs[i % roofs.length];
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, roof, roof, wall, wall]);
          b.position.set(Math.sin(ang) * R, B + h / 2, -Math.cos(ang) * R);
          b.rotation.y = rr() * 1.2;
          g.add(b);
        }
      },
      hills(cols, r0 = 980, snow) {
        for (let i = 0; i < 13; i++) {
          const ang = -1.55 + i * 0.26 + rr() * 0.1, R = r0 + rr() * 90;
          const h = 46 + rr() * 72, r = 160 + rr() * 120;
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2), mk(cols[i % cols.length]));
          m.scale.y = h / r;
          m.position.set(Math.sin(ang) * R, B, -Math.cos(ang) * R);
          g.add(m);
          if (snow) { const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 12, 6, 0, TAU, 0, Math.PI / 2), mk('#eef4fa')); cap.scale.y = h * 0.5 / (r * 0.45); cap.position.set(m.position.x, B + h * 0.52, m.position.z); g.add(cap); }
        }
      },
      at(ang, R, obj, s = 1) { obj.position.set(Math.sin(ang) * R, B, -Math.cos(ang) * R); if (s !== 1) obj.scale.multiplyScalar(s); obj.rotation.y = -ang * 0.5; g.add(obj); return obj; },
      grp() { return new THREE.Group(); },
      box(gr, w, h, d, col, x = 0, y0 = 0, z = 0, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mk(col)); m.position.set(x, y0 + h / 2, z); m.rotation.y = ry; gr.add(m); return m; },
      cyl(gr, r1, r2, h, col, x = 0, y0 = 0, z = 0, seg = 14) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mk(col)); m.position.set(x, y0 + h / 2, z); gr.add(m); return m; },
      cone(gr, r, h, col, x = 0, y0 = 0, z = 0, seg = 10) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mk(col)); m.position.set(x, y0 + h / 2, z); gr.add(m); return m; },
      sph(gr, r, col, x = 0, y = 0, z = 0, half = false) { const m = new THREE.Mesh(half ? new THREE.SphereGeometry(r, 16, 9, 0, TAU, 0, Math.PI / 2) : new THREE.SphereGeometry(r, 16, 10), mk(col)); m.position.set(x, y, z); gr.add(m); return m; },
      // fascia piatta (un fiume) tra i raggi r0 e r1, dall'angolo a0 per "span" radianti
      band(r0, r1, a0, span, col) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48, 1, Math.PI / 2 - a0 - span, span), mk(col)); m.rotation.x = -Math.PI / 2; m.position.y = B + 0.4; g.add(m); return m; },
      mk, rr
    };
    fn(g, H, B, rr);
    return g;
  }
  const SKY_BUILDERS = {
    milano: () => skyBase((g, H) => {
      H.plain('#b2aca0');
      H.hills(['#c2ccd6', '#ccd6de'], 1010, true);   // Alpi lontane
      H.ring({ n: 130, r0: 330, rs: 480, h0: 12, hs: 24, walls: ['#ddd2bc', '#d2c0a2', '#c8b89e', '#e2d8c4'], roofs: ['#7d8287'], avoid: [0.0, 0.3, 380] });
      const duomo = H.grp();
      H.box(duomo, 92, 36, 60, '#e8e2d2');
      H.box(duomo, 60, 14, 58, '#e8e2d2', 0, 36);
      for (let i = -4; i <= 4; i++) { H.cone(duomo, 2.2, 16, '#f0ead8', i * 10, 36 + (Math.abs(i) < 2 ? 14 : 4), 29); H.cone(duomo, 2.2, 16, '#f0ead8', i * 10, 36 + (Math.abs(i) < 2 ? 14 : 4), -29); }
      H.cone(duomo, 3, 24, '#f0ead8', 0, 50);
      H.sph(duomo, 2, '#e8c33c', 0, 77);
      H.at(0.0, 560, duomo);   // R-308: il Duomo in fondo a corso Vittorio Emanuele
      const tw = H.grp();   // grattacieli di Porta Nuova e CityLife
      H.box(tw, 26, 150, 26, '#7a93a8', 0);
      for (let i = 0; i < 6; i++) H.box(tw, 24 - i * 1.5, 22, 24 - i * 1.5, '#8aa2b4', 55, i * 22, 10, i * 0.14);   // torre "storta"
      H.box(tw, 22, 115, 22, '#90a8ba', -55, 0, 20);
      H.box(tw, 18, 92, 18, '#6a8296', 100, 0, 30);
      H.cyl(tw, 1, 1, 36, '#9aa4ae', 0, 150);
      H.at(-0.55, 720, tw);
    }),
    parigi: () => skyBase((g, H) => {
      H.plain('#b0a48e');
      H.ring({ n: 150, r0: 320, rs: 520, h0: 13, hs: 15, walls: ['#ddd2bc', '#d8cbb2', '#d2c6ae', '#e2d8c4'], roofs: ['#6a7078'], avoid: [0.0, 0.3, 380] });
      const eiffel = H.grp();
      H.cyl(eiffel, 16, 40, 52, '#5a4636', 0, 0, 0, 4);
      H.box(eiffel, 44, 5, 44, '#5a4636', 0, 50);
      H.cyl(eiffel, 7, 15, 50, '#5a4636', 0, 55, 0, 4);
      H.box(eiffel, 20, 4, 20, '#5a4636', 0, 103);
      H.cyl(eiffel, 1.6, 6.5, 62, '#5a4636', 0, 107, 0, 4);
      H.box(eiffel, 7, 4, 7, '#5a4636', 0, 167);
      H.cyl(eiffel, 0.7, 0.7, 16, '#5a4636', 0, 171);
      H.at(0.0, 640, eiffel);   // R-308: la Tour Eiffel in fondo
      const sacre = H.grp();   // Sacré-Cœur sulla collina
      H.sph(sacre, 36, '#8a9478', 0, 0, 0, true);
      H.cyl(sacre, 9, 10, 20, '#f0ece0', 0, 30);
      H.sph(sacre, 10, '#e8e4d8', 0, 55, 0, true);
      for (const dx of [-15, 15]) { H.cyl(sacre, 4.5, 5, 14, '#f0ece0', dx, 28, 2); H.sph(sacre, 5, '#e8e4d8', dx, 44, 2, true); }
      H.box(sacre, 7, 26, 7, '#f0ece0', 24, 26, -4);
      H.at(0.6, 700, sacre);
      const arc = H.grp();
      H.box(arc, 9, 22, 10, '#d8cdb8', -9.5);
      H.box(arc, 9, 22, 10, '#d8cdb8', 9.5);
      H.box(arc, 28, 7, 10, '#d8cdb8', 0, 22);
      H.box(arc, 24, 3, 8, '#cfc3aa', 0, 29);
      H.at(-0.38, 470, arc);
    }),
    londra: () => skyBase((g, H) => {
      H.plain('#58707e');   // il Tamigi
      H.ring({ n: 130, r0: 350, rs: 500, h0: 11, hs: 16, walls: ['#9a6a4e', '#8a5a40', '#b08060', '#a89a88'], roofs: ['#55585c'], avoid: [0.0, 0.42, 340] });
      const ben = H.grp();
      H.box(ben, 70, 20, 26, '#c8b488', -52, 0);
      H.box(ben, 13, 78, 13, '#c8b488');
      H.box(ben, 15, 12, 15, '#b8a478', 0, 78);
      for (const [dx, dz] of [[0, 7.6], [0, -7.6], [7.6, 0], [-7.6, 0]]) H.cyl(ben, 4.2, 4.2, 1.5, '#f4f0e2', dx, 83, dz, 16).rotation.x = dz ? Math.PI / 2 : 0, H.mk;
      H.cone(ben, 9, 18, '#55585c', 0, 90, 0, 4);
      H.at(0.0, 620, ben);   // R-308: il Big Ben in fondo a Oxford Street
      const eye = H.grp();
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(40, 2.2, 8, 36), H.mk('#d8dde2'));
      wheel.position.y = 48; eye.add(wheel);
      for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 78, 1.2), H.mk('#c2c8ce')); sp.position.y = 48; sp.rotation.z = i * Math.PI / 8; eye.add(sp); }
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; H.sph(eye, 2.6, '#8a9aa6', Math.cos(a) * 40, 48 + Math.sin(a) * 40, 0); }
      H.cone(eye, 2.5, 46, '#9aa4ae', 8, 0, 1, 4);
      H.cone(eye, 2.5, 46, '#9aa4ae', -8, 0, 1, 4);
      H.at(0.3, 680, eye);
      const bridge = H.grp();
      for (const dx of [-42, 42]) { H.box(bridge, 15, 50, 13, '#d8d2c2', dx); H.cone(bridge, 9, 13, '#55789a', dx, 50, 0, 4); }
      H.box(bridge, 130, 5, 10, '#55789a', 0, 16);
      H.box(bridge, 68, 3.5, 8, '#d8d2c2', 0, 42);
      H.at(-0.48, 760, bridge);
      const shard = H.grp();
      H.cone(shard, 15, 112, '#9fb6c6', 0, 0, 0, 4);
      H.at(0.62, 820, shard);
    }),
    francoforte: () => skyBase((g, H) => {
      H.plain('#9aa08e');
      H.band(270, 318, -1.1, 2.2, '#5b7f98');   // il Meno, con le rive
      H.band(262, 270, -1.1, 2.2, '#b9b4a4'); H.band(318, 326, -1.1, 2.2, '#b9b4a4');
      H.ring({ n: 110, r0: 330, rs: 420, h0: 9, hs: 10, walls: ['#efe8da', '#e8dcc8', '#e2d4ba'], roofs: ['#6a4a3a'], avoid: [0.05, 0.35, 360] });
      const sky = H.grp();   // lo skyline dei grattacieli
      const tints = ['#6a8296', '#7a93a8', '#90a8ba', '#86a0b2'];
      for (let i = 0; i < 9; i++) H.box(sky, 16 + (i % 3) * 5, 62 + (i * 37) % 92, 16 + (i % 2) * 6, tints[i % 4], -90 + i * 23, 0, (i % 3) * 18 - 12);
      H.box(sky, 20, 148, 20, '#5f7a90', 10, 0, 6);
      H.cyl(sky, 0.8, 0.8, 42, '#9aa4ae', 10, 148, 6);
      H.at(0.22, 660, sky);
      const romer = H.grp();   // R-308: il Römer, le tre case a gradoni, dritto in fondo al Römerberg
      for (const [dx, w, h] of [[-16, 14, 22], [0, 16, 26], [16, 14, 22]]) {
        H.box(romer, w, h * 0.62, 12, '#e8dcc8', dx);
        for (let i = 0; i < 5; i++) H.box(romer, w - i * (w / 5), h * 0.08, 12.2, '#9a6a4e', dx, h * 0.62 + i * h * 0.076);
      }
      H.at(0.0, 470, romer);
      const dom = H.grp();   // la torre del Kaiserdom
      H.box(dom, 15, 56, 15, '#9a4a34');
      H.cyl(dom, 7.5, 9.5, 12, '#8a3f2c', 0, 56, 0, 8);
      H.cone(dom, 7, 20, '#7a3426', 0, 68, 0, 8);
      H.at(-0.45, 520, dom);
    }),
    madrid: () => skyBase((g, H) => {
      H.plain('#c0a878');
      H.hills(['#8a9aa8', '#9aacb8'], 1000, true);   // la sierra
      H.ring({ n: 120, r0: 330, rs: 460, h0: 12, hs: 18, walls: ['#d8a878', '#c08a5c', '#e2c8a4', '#d2b490'], roofs: ['#8a5a3c'], avoid: [0.0, 0.3, 360] });
      const pal = H.grp();   // Palazzo Reale
      H.box(pal, 110, 26, 36, '#ddd6c6');
      H.box(pal, 114, 3, 40, '#cfc8b6', 0, 26);
      for (let i = -5; i <= 5; i++) H.box(pal, 2.2, 22, 2, '#c8c0ac', i * 9, 2, 19);
      H.sph(pal, 7, '#8a9496', 0, 32, 0, true);
      H.at(-0.6, 560, pal);
      const puerta = H.grp();
      H.box(puerta, 46, 20, 9, '#d8cdb4');
      for (const dx of [-15, -5, 5, 15]) H.cyl(puerta, 1.6, 1.6, 18, '#c8bda2', dx, 1, 5);
      H.box(puerta, 20, 6, 8, '#d8cdb4', 0, 20);
      H.at(0.0, 480, puerta);   // R-308: la Puerta de Alcalá in fondo
      const torres = H.grp();
      for (let i = 0; i < 4; i++) H.box(torres, 15, 115 + (i % 2) * 28, 15, ['#7a93a8', '#90a8ba', '#86a0b2', '#9fb6c6'][i], i * 24 - 36, 0, (i % 2) * 14);
      H.at(0.55, 840, torres);
    }),
    lisbona: () => skyBase((g, H) => {
      H.plain('#4a7a9a');   // il Tago
      H.ring({ n: 120, r0: 330, rs: 420, h0: 10, hs: 14, walls: ['#efe4ce', '#e8d2b4', '#e2c0a4', '#d8e2e4'], roofs: ['#b4603f'], avoid: [0.0, 0.4, 420] });
      H.hills(['#a8a090', '#b0a898'], 990);
      const ponte = H.grp();   // il ponte 25 de Abril
      for (const dx of [-80, 80]) {
        H.box(ponte, 4, 86, 4, '#b43a2a', dx, 0, 5);
        H.box(ponte, 4, 86, 4, '#b43a2a', dx, 0, -5);
        H.box(ponte, 12, 4, 12, '#b43a2a', dx, 40);
        H.box(ponte, 12, 4, 12, '#b43a2a', dx, 80);
      }
      H.box(ponte, 300, 4.5, 14, '#a83626', 0, 42);
      for (const s of [-1, 1]) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(76, 1.6, 1.6), H.mk('#8a9296'));
        cab.position.set(s * 118, 68, 5); cab.rotation.z = s * -0.32; ponte.add(cab);
        const cab2 = cab.clone(); cab2.position.z = -5; ponte.add(cab2);
        const mid = new THREE.Mesh(new THREE.BoxGeometry(82, 1.6, 1.6), H.mk('#8a9296'));
        mid.position.set(s * 40, 74, 5); mid.rotation.z = s * 0.18; ponte.add(mid);
        const mid2 = mid.clone(); mid2.position.z = -5; ponte.add(mid2);
      }
      H.at(0.4, 780, ponte);
      const belem = H.grp();   // R-308: la Torre di Belém, dritta in fondo all'Avenida
      H.box(belem, 30, 10, 22, '#e2dccc');
      H.box(belem, 16, 36, 16, '#ece6d6', 0, 0, -3);
      for (const [dx, dz] of [[-8, -11], [8, -11], [-8, 5], [8, 5]]) { H.cyl(belem, 2.2, 2.2, 40, '#e8e2d2', dx, 0, dz, 10); H.sph(belem, 2.6, '#d8d2c2', dx, 40, dz, true); }
      H.box(belem, 14, 3, 14, '#d8d2c2', 0, 36, -3);
      H.at(0.0, 520, belem);

      const cristo = H.grp();
      H.box(cristo, 9, 46, 9, '#d8d2c4');
      H.box(cristo, 5, 14, 4, '#e8e2d4', 0, 46);
      H.box(cristo, 17, 2.6, 3, '#e8e2d4', 0, 54);
      H.sph(cristo, 1.8, '#e8e2d4', 0, 62);
      H.at(0.55, 700, cristo);
      const castle = H.grp();
      H.sph(castle, 40, '#8a9478', 0, 0, 0, true);
      for (let i = 0; i < 5; i++) H.box(castle, 7, 10, 7, '#c8bda4', -16 + i * 8, 26 + (i % 2) * 2);
      H.at(-0.55, 560, castle);
    }),
    zagabria: () => skyBase((g, H) => {
      H.plain('#aab2a0');
      H.hills(['#7a8a6a', '#8a9a78'], 940);   // la Medvednica
      H.ring({ n: 110, r0: 320, rs: 430, h0: 11, hs: 15, walls: ['#e8dcc8', '#e2d0b4', '#d8c8ac', '#e8e0d0'], roofs: ['#8a4a3a'], avoid: [0.0, 0.3, 340] });
      const cat = H.grp();   // la cattedrale con le due guglie
      H.box(cat, 30, 26, 40, '#e8e2d2', 0, 0, -6);
      for (const dx of [-9, 9]) { H.box(cat, 9, 56, 9, '#efe8da', dx, 0, 12); H.cone(cat, 6, 26, '#d8d2c2', dx, 56, 12, 8); }
      H.at(0.0, 540, cat);
      const marco = H.grp();   // San Marco con il tetto a scacchi colorati
      H.box(marco, 30, 13, 20, '#e8e2d4');
      const c = document.createElement('canvas'); c.width = 64; c.height = 32;
      const mg = c.getContext('2d');
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { mg.fillStyle = (x + y) % 2 ? '#b43a2a' : '#e8e2d4'; mg.fillRect(x * 8, y * 8, 8, 8); }
      mg.fillStyle = '#3a5fa8'; mg.fillRect(24, 4, 16, 22);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 14, 10, 4, 1), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
      roof.position.y = 18; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.72; marco.add(roof);
      H.box(marco, 6, 24, 6, '#efe8da', 20, 0, -2);
      H.cone(marco, 4, 12, '#4a7a5a', 20, 24, -2, 8);
      H.at(-0.42, 440, marco);
    }),
    berlino: () => skyBase((g, H) => {
      H.plain('#9aa0a0');
      H.ring({ n: 120, r0: 330, rs: 480, h0: 13, hs: 17, walls: ['#c8c2b4', '#b8ac9c', '#cfc8ba', '#a8a096'], roofs: ['#6d7276'], avoid: [0.0, 0.3, 360] });
      const tor = H.grp();   // la Porta di Brandeburgo
      H.box(tor, 52, 4, 14, '#cfc7b4');
      for (let i = 0; i < 6; i++) H.cyl(tor, 2.1, 2.3, 20, '#c8bda2', -21 + i * 8.4, 4);
      H.box(tor, 54, 7, 15, '#cfc7b4', 0, 24);
      H.box(tor, 30, 5, 12, '#c8bda2', 0, 31);
      H.box(tor, 12, 4.5, 5, '#3f6b4a', 0, 36);
      H.at(0.0, 500, tor);   // R-308: la Porta di Brandeburgo dove finisce Unter den Linden
      const tv = H.grp();   // il Fernsehturm
      H.cyl(tv, 2.6, 5, 150, '#c8ccd2');
      H.sph(tv, 13, '#b8c2cc', 0, 155);
      H.cyl(tv, 0.9, 0.9, 40, '#c4372b', 0, 166);
      H.at(0.35, 700, tv);
      const reich = H.grp();
      H.box(reich, 58, 22, 38, '#b8b2a4');
      for (const [dx, dz] of [[-26, 16], [26, 16], [-26, -16], [26, -16]]) H.box(reich, 8, 27, 8, '#aca698', dx, 0, dz);
      H.sph(reich, 11, '#9fc2d8', 0, 22, 0, true);
      H.at(-0.32, 620, reich);
      for (let i = 0; i < 6; i++) {   // tratti del Muro dipinti
        const m = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 1.2), H.mk(['#d8403a', '#2f8fd0', '#e8c33c', '#7fb043', '#b05ad0', '#e8e8e8'][i]));
        H.at(-0.75 + i * 0.05, 390 + i * 8, (() => { const gr = H.grp(); gr.add(m); m.position.y = 3; return gr; })());
      }
    }),
    zurigo: () => skyBase((g, H) => {
      H.plain('#3f7a9a');   // il lago
      H.hills(['#b8c6d2', '#c6d2dc'], 960, true);   // Alpi innevate
      H.ring({ n: 110, r0: 330, rs: 400, h0: 10, hs: 13, walls: ['#e2d8c4', '#d8c8b0', '#e8e0d0', '#cfc0a8'], roofs: ['#7a4a3a'], avoid: [0.0, 0.3, 360] });
      const gm = H.grp();   // il Grossmünster
      H.box(gm, 26, 20, 34, '#d2c8b4', 0, 0, -4);
      for (const dx of [-8, 8]) {
        H.box(gm, 9, 42, 9, '#c8beac', dx, 0, 8);
        H.cyl(gm, 5.5, 6.5, 6, '#b8ae9a', dx, 42, 8, 8);
        H.sph(gm, 5, '#7a8a96', dx, 51, 8, true);
        H.cone(gm, 1, 6, '#5f6b76', dx, 54, 8, 6);
      }
      H.at(0.0, 500, gm);   // R-308: il Grossmünster in fondo alla Bahnhofstrasse
      const fm = H.grp();
      H.box(fm, 12, 26, 12, '#e2d8c4');
      H.cone(fm, 7, 30, '#4a8a7a', 0, 26, 0, 8);
      H.at(-0.25, 460, fm);
    }),
    newyork: () => skyBase((g, H) => {
      H.plain('#4a6a80');
      const sky = H.grp();   // Manhattan
      const tints = ['#6a7686', '#7a8696', '#5f6b7a', '#8692a0', '#737f8e'];
      for (let i = 0; i < 16; i++) H.box(sky, 15 + (i % 4) * 5, 55 + (i * 43) % 130, 15 + (i % 3) * 6, tints[i % 5], -140 + i * 19, 0, ((i * 7) % 40) - 20);
      H.box(sky, 26, 120, 26, '#7a8696', 24, 0, 8);   // Empire State a gradoni
      H.box(sky, 19, 36, 19, '#8692a0', 24, 120, 8);
      H.box(sky, 11, 22, 11, '#9aa4b0', 24, 156, 8);
      H.cyl(sky, 0.9, 2, 30, '#b8c2cc', 24, 178, 8);
      H.box(sky, 20, 112, 20, '#8a96a4', -52, 0, -14);   // il grattacielo con la corona
      for (let i = 0; i < 4; i++) H.cyl(sky, 9 - i * 2, 10 - i * 2.2, 9, '#b8c2cc', -52, 112 + i * 8, -14, 12);
      H.cyl(sky, 0.7, 0.7, 22, '#b8c2cc', -52, 146, -14);
      H.at(0.42, 760, sky);
      const lib = H.grp();   // la Statua della Libertà
      H.cyl(lib, 16, 18, 8, '#8a9478', 0, 0);
      H.box(lib, 13, 20, 13, '#b8a890', 0, 8);
      H.cyl(lib, 4.5, 6, 24, '#5f9a84', 0, 28, 0, 10);
      H.sph(lib, 3.2, '#5f9a84', 0, 55);
      H.cone(lib, 4.5, 4, '#4f8a74', 0, 58, 0, 7);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 16, 8), H.mk('#5f9a84'));
      arm.position.set(5.5, 58, 0); arm.rotation.z = -0.5; lib.add(arm);
      H.sph(lib, 2, '#e8c33c', 9.5, 67);
      H.at(0.0, 600, lib);   // R-308: la Statua della Libertà in fondo a Broadway
      const bb = H.grp();   // il ponte di Brooklyn
      for (const dx of [-55, 55]) { H.box(bb, 14, 56, 9, '#b0a896', dx); H.cone(bb, 5, 10, '#a09884', dx, 56, 0, 4); }
      H.box(bb, 210, 4, 11, '#8a8478', 0, 24);
      for (const s of [-1, 1]) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(110, 1.4, 1.4), H.mk('#d8d2c2'));
        cab.position.set(s * 100, 44, 0); cab.rotation.z = s * -0.3; bb.add(cab);
        const mid = new THREE.Mesh(new THREE.BoxGeometry(60, 1.4, 1.4), H.mk('#d8d2c2'));
        mid.position.set(s * 28, 48, 0); mid.rotation.z = s * 0.2; bb.add(mid);
      }
      H.at(0.62, 820, bb);
    })
  };
  const builtSky = { napoli: bay, roma: rome };
  function skylineFor(name) {
    if (!builtSky[name]) {
      if (!SKY_BUILDERS[name]) return null;
      const g = SKY_BUILDERS[name]();
      g.visible = false;
      scene.add(g);
      builtSky[name] = g;
    }
    return builtSky[name];
  }

  return { builtSky, skylineFor };
};
