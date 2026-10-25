// Pista Nera — C-Y-F Gaming
// Snowboard 3D con modalità allenamento (da solo) e sfida online (stanza con codice, stessa pista per tutti).
(() => {
  const $ = id => document.getElementById(id);
  // registro eventi e pannello di debug (diagnosi.js): se manca, il gioco funziona lo stesso
  const diag = window.CYFDiag || { log() {}, tapToOpen() {}, report() {} };
  const stage = $('stage');
  const cvs = $('game');

  if (!window.THREE) { $('glErr').hidden = false; return; }

  const TAU = Math.PI * 2;
  const SLOPE_DEG = 16;
  const SLOPE = SLOPE_DEG * Math.PI / 180;
  const START_ALT = 2950;
  const HORIZON = '#d6e7f3';
  const PALETTE = ['#ff5a1f', '#2f7fd0', '#1f8a4c', '#e2b007', '#9b4dca', '#e2352b', '#00a3a3', '#f06292'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = window.matchMedia('(pointer: coarse)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = n => Math.round(n).toLocaleString('it-IT');
  const fmtTime = ms => {
    if (ms == null) return '—';
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = Math.floor((ms % 1000) / 10);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
  };
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  // ---------- lingua (italiano, inglese, francese, spagnolo): testi in i18n.js ----------
  const DICT = window.CYF_I18N || { it: {} };
  const LANGS = ['it', 'en', 'fr', 'es'];
  let lang = (() => {
    // ?lang= dall'indirizzo (arriva dalla home), poi la lingua salvata, poi quelle del dispositivo
    let asked = null;
    try { asked = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (LANGS.includes(asked)) return asked;
    const saved = store.get('cyf.lang');
    if (LANGS.includes(saved)) return saved;
    const navs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'it'];
    for (const n of navs) { const c = String(n).slice(0, 2).toLowerCase(); if (LANGS.includes(c)) return c; }
    return 'it';
  })();
  function tr(k, v) {
    let s = (DICT[lang] && DICT[lang][k]) ?? (DICT.it && DICT.it[k]) ?? k;
    if (v) for (const n in v) s = s.split('{' + n + '}').join(v[n]);
    return s;
  }
  // posizione in classifica nella lingua scelta: 1° · 1st · 1er · 1.º
  const enOrd = (typeof Intl !== 'undefined' && Intl.PluralRules) ? new Intl.PluralRules('en', { type: 'ordinal' }) : null;
  const ord = n => {
    if (lang === 'en') return n + ({ one: 'st', two: 'nd', few: 'rd' }[enOrd ? enOrd.select(n) : 'other'] || 'th');
    if (lang === 'fr') return n === 1 ? '1er' : n + 'e';
    if (lang === 'es') return n + '.º';
    return n + '°';
  };
  const fmtLen = m => m >= 1000 ? (Math.round(m / 100) / 10).toLocaleString(lang) + ' km' : Math.round(m) + ' m';
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- renderer & scene ----------
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true }); }
  catch (e) { $('glErr').hidden = false; return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const TEX = isPhone ? 512 : 1024;   // risoluzione delle texture del terreno

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(lin(HORIZON), 60, 200);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);

  const world = new THREE.Group();
  world.rotation.x = -SLOPE;
  scene.add(world);
  world.updateMatrixWorld(true);

  const SUN_OFFSET = new THREE.Vector3(-26, 30, -34);
  const sunDir = SUN_OFFSET.clone().normalize();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#3f7fc4') }, mid: { value: new THREE.Color('#9cc5e6') },
        horizon: { value: new THREE.Color(HORIZON) }, sunDir: { value: sunDir }, sunCol: { value: new THREE.Color('#fff4dc') }
      },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vW;',
        'void main(){',
        '  vec3 d = normalize(vW - cameraPosition);',
        '  float h = d.y;',
        '  vec3 c = h > 0.0 ? mix(mix(horizon, mid, smoothstep(0.0, 0.18, h)), top, smoothstep(0.15, 0.75, h)) : horizon;',
        '  float s = max(dot(d, normalize(sunDir)), 0.0);',
        '  c += sunCol * (pow(s, 900.0) * 2.0 + pow(s, 40.0) * 0.18 + pow(s, 6.0) * 0.08);',
        '  gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);',
        '}'
      ].join('\n')
    })
  );
  sky.renderOrder = -2;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(lin('#cfe4f7'), lin('#aebfd0'), 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(lin('#fff0d6'), 0.9);
  sun.castShadow = true;
  const sm = isPhone ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

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

  // ---------- shared geometry ----------
  function merge(parts) {
    const pos = [], nor = [], col = [];
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (p.sx) g.scale(p.sx, p.sy, p.sz);
      if (p.ry) g.rotateY(p.ry);
      g.translate(p.x || 0, p.y || 0, p.z || 0);
      const pa = g.attributes.position.array, na = g.attributes.normal.array;
      const c = lin(p.color);
      for (let i = 0; i < pa.length; i += 3) { pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]); col.push(c.r, c.g, c.b); }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }
  function lumpy(g, amt, rr) {
    const p = g.attributes.position;
    const seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
      if (!seen.has(key)) seen.set(key, 1 + (rr() * 2 - 1) * amt);
      const k = seen.get(key);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }
  // illuminazione calcolata per pixel (più morbida della vecchia per vertice)
  const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  function spruce(slim) {
    const parts = [{ geo: new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), color: '#4a3020', y: 0.7 }];
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const r = (1.75 - f * 1.35) * (slim ? 0.78 : 1), h = 1.5 - f * 0.55, y = 1.3 + f * 4.2;
      const green = ['#142f24', '#17372a', '#1a3e2f', '#1d4533', '#204c38', '#22533c'][i];
      parts.push({ geo: new THREE.ConeGeometry(r, h, 11), color: green, y: y + h / 2, ry: i * 0.6 });
      parts.push({ geo: new THREE.ConeGeometry(r * 0.78, h * 0.32, 11), color: '#f1f6fa', y: y + h * 0.62, ry: i * 0.6 + 0.3 });
    }
    parts.push({ geo: new THREE.ConeGeometry(0.22, 0.6, 6), color: '#f1f6fa', y: 6.2 });
    parts.push({ geo: new THREE.SphereGeometry(1.1, 8, 4, 0, TAU, 0, Math.PI / 2), color: '#e9f1f7', sx: 1, sy: 0.25, sz: 1, y: -0.05 });
    return merge(parts);
  }
  const geoRng = mulberry32(11);
  const GEO = {
    trees: [spruce(false), spruce(true)],
    rock: merge([
      { geo: lumpy(new THREE.IcosahedronGeometry(1, 1), 0.18, geoRng), color: '#5f6b7a', sx: 1.2, sy: 0.7, sz: 1.0, y: 0.3 },
      { geo: lumpy(new THREE.IcosahedronGeometry(0.85, 1), 0.12, geoRng), color: '#f2f6fa', sx: 1.15, sy: 0.3, sz: 0.9, y: 0.78, x: -0.12 }
    ]),
    // in città le rocce non hanno la neve sopra
    rockCity: merge([
      { geo: lumpy(new THREE.IcosahedronGeometry(1, 2), 0.16, mulberry32(12)), color: '#7d766d', sx: 1.2, sy: 0.75, sz: 1.0, y: 0.3 },
      { geo: lumpy(new THREE.IcosahedronGeometry(0.55, 1), 0.2, mulberry32(13)), color: '#8e877c', sx: 1.0, sy: 0.7, sz: 0.9, y: 0.5, x: 0.55, z: 0.2 }
    ]),
    marker: merge([
      { geo: new THREE.CylinderGeometry(0.045, 0.045, 1.6, 6), color: '#0f1824', y: 0.8 },
      { geo: new THREE.CylinderGeometry(0.055, 0.055, 0.3, 6), color: '#ff5a1f', y: 1.5 },
      { geo: new THREE.CylinderGeometry(0.2, 0.28, 0.12, 8), color: '#e9f1f7', y: 0.02 }
    ]),
    ramp: (() => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.6, 0); shape.lineTo(4, 0); shape.lineTo(4, 1.1); shape.quadraticCurveTo(1.6, 0.55, -0.6, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2, curveSegments: 6 });
      g.translate(-2, 0, -1.5);
      g.rotateY(Math.PI / 2);
      return merge([{ geo: g, color: '#dfeaf3' }, { geo: new THREE.BoxGeometry(3.3, 0.06, 0.12), color: '#2f7fd0', y: 1.18, z: -2 }]);
    })()
  };
  // bandierina di un colore solo, oppure a scacchi (due colori: Zagabria)
  function gateGeo(color) {
    const parts = [];
    for (const s of [-1, 1]) {
      const px = s * 2.4;
      parts.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), color: '#f4f6f8', x: px, y: 0.95 });
      if (Array.isArray(color)) {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) parts.push({ geo: new THREE.BoxGeometry(0.2125, 0.2, 0.02), color: color[(i + j) % 2], x: px - s * 0.45 - 0.31875 + i * 0.2125, y: 1.65 - j * 0.2, z: 0 });
      } else parts.push({ geo: new THREE.BoxGeometry(0.85, 0.6, 0.02), color, x: px - s * 0.45, y: 1.45 });
    }
    return merge(parts);
  }
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
    const ST = CITY_CFG[theme].street;
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
    const ST = CITY_CFG[theme].street;
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
    const E = CITY_CFG[theme].edge;
    if (!E) return;
    const mat = edgeMats[E] || (edgeMats[E] = EDGE_MATS[E]());
    for (const s of [-1, 1]) {
      if (E === 'lines') { for (const d of [20.25, 20.75]) objs.push({ type: 'edge', x: center(z) + s * d, z: z - len / 2, mesh: edgeStrip(z, len, s * d, 0.3, mat, 0.1) }); }
      else objs.push({ type: 'edge', x: center(z) + s * 23.3, z: z - len / 2, mesh: edgeStrip(z, len, s * 23.3, 3.2, mat, 0.25) });
    }
  }

  // --- la scheda di ogni città: ostacoli, bonus, rampa, porte, paletti, palazzi, strada, luce ---
  const CITY_CFG = {
    napoli: {
      tall: () => GEO.palms[0], low: () => GEO.rockCity,
      fa: 'pizza', faG: () => GEO.pizza, fb: 'coffee', fbG: () => GEO.coffee,
      ramp: ['#b07a45', '#f2c230'], gate: ['#d8302a', '#2766c6'], marker: () => GEO.bollard,
      tallCrash: 'crashTree', lowCrash: 'crashRock', markerCrash: 'crashBollard',
      walls: ['#e7b65c', '#dd8a5c', '#c9573f', '#f1d999', '#e9a98a', '#d8c7a6', '#b85a43', '#f3e6cf'],
      street: { L: 'bldg', R: 'sea', trees: { geo: streetTrees.palma, every: 26, off: 22.6, sides: [-1] } }, props: [['autoNapoli', 4.3]],   // via Partenope: mare a destra, palazzi e palme a sinistra
      style: 'napoli', roof: '#a89a88', bldH: [10, 14], ground: stoneTexture,
      theme: { sky: ['#2a7fd6', '#86c2ee', '#e6edf1'], fog: '#e1e8ec', hemi: ['#f6ecdc', '#b3a493'], sun: '#fff0cf', spray: '#c7beb3', sprayOp: 0.55, trail: '#262321', trailOp: 0.2, rough: 0.9 }
    },
    roma: {
      tall: () => GEO.pines[0], low: lowGeos.columnDrum,
      fa: 'carbonara', faG: () => GEO.carbonara, fb: 'artichoke', fbG: () => GEO.carciofo,
      ramp: ['#ddd2bc', '#c9a227'], gate: ['#8e2434', '#d4a017'], marker: markerGeos.nasone,
      tallCrash: 'crashTree', lowCrash: 'crashColumn', markerCrash: 'crashFountain',
      walls: ['#d9a35a', '#c8703f', '#b24f33', '#e6c184', '#edd7a8', '#cf8e5c', '#a9503c', '#e9c99a'],
      street: { L: 'ruins', R: 'ruins', trees: { geo: streetTrees.pino, every: 24, off: 23 } },   // via dei Fori Imperiali: pini e ruderi su entrambi i lati
      style: 'roma', roof: '#a9583b', bldH: [10, 14], ground: sampietriniTexture,
      theme: { sky: ['#2f7cc8', '#92c1e6', '#efe5d6'], fog: '#e8e0d2', hemi: ['#f7ead8', '#b49b82'], sun: '#fff0cc', spray: '#c9bfb2', sprayOp: 0.5, trail: '#2a2623', trailOp: 0.18, rough: 0.92 }
    },
    milano: {
      tall: () => genLamp({ pole: '#2a2c30', lamp: '#f5e3a0', kind: 'gas' }), low: lowGeos.panettone,
      fa: 'cotoletta', faG: foodGeos.cotoletta, fb: 'risotto', fbG: foodGeos.risotto,
      ramp: ['#8a9299', '#c4372b'], gate: ['#e8e8e8', '#c4372b'], marker: markerGeos.ghisa,
      tallCrash: 'crashLamp', lowCrash: 'crashBollard', markerCrash: 'crashBollard',
      walls: ['#e8dcc8', '#d8c8ac', '#e2d0b4', '#cfc0a8', '#e8e2d2', '#d2bfa0'],
      street: { L: 'bldg', R: 'bldg' }, setback: 1.2,   // corso Vittorio Emanuele II: pedonale, palazzi con vetrine, niente tram
      style: 'altbau', roof: '#7d8287', bldH: [12, 16], ground: () => paveTexture({ seed: 41, size: 14, joint: '#2e2c2a', tones: [[96, 90, 86], [108, 100, 94], [88, 84, 82]], rails: true }),
      theme: { sky: ['#5a84b0', '#9fb6cc', '#e0e3e4'], fog: '#dcdfe0', fogN: 40, fogF: 150, hemi: ['#e8ecf0', '#a8adb4'], sun: '#f2ead8', spray: '#b8bcc0', sprayOp: 0.5, trail: '#2a2a2c', trailOp: 0.18, rough: 0.9 }
    },
    parigi: {
      tall: morrisColumn, low: lowGeos.planterStone,
      fa: 'croissant', faG: foodGeos.croissant, fb: 'macaron', fbG: foodGeos.macaron,
      ramp: ['#3f5a42', '#5a7a5e'], gate: ['#2753b8', '#d8352a'], marker: markerGeos.potelet,
      tallCrash: 'crashColumn', lowCrash: 'crashPlanter', markerCrash: 'crashBollard',
      walls: ['#ddd2bc', '#e2d8c4', '#d8cbb2', '#e8dfcc', '#d2c6ae', '#e5dcc8'],
      street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.platano, every: 16 } }, props: [['autoParigi', 4.3]], setback: 2.6,   // Champs-Élysées: platani davanti ai palazzi, qualche auto
      style: 'haussmann', roof: '#6a7078', bldH: [13, 10], ground: () => paveTexture({ seed: 43, size: 18, joint: '#3a3835', tones: [[128, 122, 114], [142, 136, 126], [118, 114, 108]] }),
      theme: { sky: ['#4a7dbd', '#a4c2dd', '#e8e4da'], fog: '#e4e1d8', hemi: ['#f2ecdc', '#aaa298'], sun: '#fff0d0', spray: '#c2b8a8', sprayOp: 0.5, trail: '#2a2623', trailOp: 0.18, rough: 0.9, part: { col: '#c08a3c', size: 0.15, fall: 0.5, sway: 1.5, op: 0.9 } }
    },
    londra: {
      tall: () => genTree({ trunk: '#8a7a5a', trunk2: '#a89a78', cols: ['#4a7a3a', '#5a8a46', '#3f6b32'], r: 1.5, seed: 5 }), low: lowGeos.planterBrick,
      fa: 'tea', faG: foodGeos.tea, fb: 'fishchips', fbG: foodGeos.fishchips,
      ramp: ['#b07a45', '#c4372b'], gate: ['#d8352a', '#2753b8'], marker: markerGeos.ukBollard,
      tallCrash: 'crashTree', lowCrash: 'crashPlanter', markerCrash: 'crashBollard',
      walls: ['#9a6a4e', '#8a5a40', '#b08060', '#7a4a34', '#a06a4a', '#8f5f44'],
      props: [['phoneBox', 1], ['taxiLondra', 4.3], ['busLondra', 10.5], ['taxiLondra', 4.3]], setback: 2.6, edge: 'lines', street: { L: 'bldg', R: 'bldg' },   // Oxford Street: bus rossi e taxi neri
      style: 'brick', roof: '#55585c', bldH: [9, 10], ground: () => asphaltTexture({ seed: 47, base: '#3a3d40', wet: true }),
      theme: { sky: ['#6a7585', '#9aa4ae', '#d4d7d9'], fog: '#d2d5d8', hemi: ['#dde2e8', '#9aa0a8'], sun: '#e8e8e4', spray: '#bcd4e2', sprayOp: 0.65, trail: '#3a4248', trailOp: 0.3, rough: 0.6, part: { col: '#a8c2d4', size: 0.05, fall: 9, sway: 0, op: 0.45 } }
    },
    francoforte: {
      tall: () => genTree({ trunk: '#8a7a5a', trunk2: '#a89a78', cols: ['#4a7a3a', '#55843c', '#3f6b32'], r: 1.45, seed: 11 }), low: lowGeos.barrel,
      fa: 'bembel', faG: foodGeos.bembel, fb: 'brezel', fbG: foodGeos.brezel,
      ramp: ['#b07a45', '#c4372b'], gate: ['#d8352a', '#e8e8e8'], marker: markerGeos.fwPole,
      tallCrash: 'crashTree', lowCrash: 'crashBarrel', markerCrash: 'crashPole',
      walls: ['#efe8da', '#e8dcc8', '#f2ece0', '#e2d4ba', '#efe4ce', '#e8dcc2'],
      street: { L: 'bldg', R: 'bldg' },   // Römerberg: case a graticcio su entrambi i lati
      style: 'fachwerk', roof: '#6a4a3a', bldH: [8, 8], ground: () => paveTexture({ seed: 53, size: 16, joint: '#38342e', tones: [[122, 112, 100], [136, 126, 112], [110, 102, 92]] }),
      theme: { sky: ['#56759c', '#9db0c2', '#dfe1e2'], fog: '#dcdee0', hemi: ['#e8eaec', '#a4a8ac'], sun: '#f2eedd', spray: '#b8bcc0', sprayOp: 0.5, trail: '#2a2a2c', trailOp: 0.18, rough: 0.9 }
    },
    madrid: {
      tall: () => genTree({ trunk: '#7a4a34', cols: ['#3f6b35', '#4a7a3e', '#35602c'], r: 1.3, h: 3.7, dots: '#d8403a', seed: 9 }), low: lowGeos.geraniumPot,
      fa: 'churro', faG: foodGeos.churro, fb: 'bocadillo', fbG: foodGeos.bocadillo,
      ramp: ['#a86a3a', ['#d8352a', '#e8c026']], gate: ['#d8352a', '#e8c026'], marker: markerGeos.bolard,
      tallCrash: 'crashTree', lowCrash: 'crashPot', markerCrash: 'crashBollard',
      walls: ['#c87f5a', '#d8a878', '#b86a48', '#e2c8a4', '#c08a5c', '#d2b490'],
      street: { L: 'bldg', R: 'bldg' }, props: [['taxiMadrid', 4.3]], setback: 2.6,   // Gran Vía: palazzi monumentali, taxi bianchi con la riga rossa
      style: 'haussmann', roof: '#8a5a3c', bldH: [16, 14], ground: () => slabTexture({ seed: 59, v0: 142 }),
      theme: { sky: ['#1f6fd0', '#7fb4e8', '#f0e8d8'], fog: '#ece4d4', hemi: ['#f8f0dc', '#b8a890'], sun: '#fff2c8', spray: '#c8b088', sprayOp: 0.5, trail: '#2a2623', trailOp: 0.18, rough: 0.92 }
    },
    lisbona: {
      tall: () => genTree({ trunk: '#6a5a4a', cols: ['#8a6ab8', '#9a7ac8', '#7a5aa8'], r: 1.45, dots: '#b89ad8', seed: 13 }), low: lowGeos.crate,
      fa: 'nata', faG: foodGeos.nata, fb: 'sardina', fbG: foodGeos.sardina,
      ramp: ['#b07a45', '#e8c33c'], gate: ['#3f7a3a', '#d8352a'], marker: markerGeos.stonePill,
      tallCrash: 'crashTree', lowCrash: 'crashCrate', markerCrash: 'crashBollard',
      walls: ['#d8e2e4', '#c2d4dc', '#e8d2b4', '#efe4ce', '#b8d0d8', '#e2c0a4'],
      props: [['tramLisbona', 8.5]], setback: 2.6, street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.jacaranda, every: 15 } },   // Avenida da Liberdade: file di alberi
      style: 'azulejos', style2: 'altbau', roof: '#b4603f', bldH: [9, 10], ground: calcadaTexture,
      theme: { sky: ['#2f86d8', '#8fc4ea', '#eef0ea'], fog: '#eaece6', hemi: ['#f6f0e2', '#aab0ac'], sun: '#fff4d4', spray: '#c8c4b8', sprayOp: 0.5, trail: '#2a2a28', trailOp: 0.18, rough: 0.9 }
    },
    zagabria: {
      tall: () => genLamp({ pole: '#3a3d42', lamp: '#f5e3a0', kind: 'gas' }), low: lowGeos.crateStack,
      fa: 'licitar', faG: foodGeos.licitar, fb: 'strukli', fbG: foodGeos.strukli,
      ramp: ['#b07a45', ['#d8352a', '#f4f4f4']], gate: [['#d8352a', '#f4f4f4'], ['#f4f4f4', '#d8352a']], marker: markerGeos.ghisa,
      tallCrash: 'crashLamp', lowCrash: 'crashCrate', markerCrash: 'crashBollard',
      walls: ['#e8dcc8', '#e2d0b4', '#d8c8ac', '#e8e0d0', '#dfd4bc', '#e5d8c0'],
      props: [['umbrellaDolac', 2.8], ['tramZagabria', 11], ['umbrellaDolac', 2.8]], setback: 2.6, street: { L: 'bldg', R: 'bldg' },   // Ilica: il tram blu
      style: 'altbau', roof: '#8a4a3a', bldH: [10, 12], ground: () => paveTexture({ seed: 61, size: 13, joint: '#3a3632', tones: [[118, 110, 100], [132, 122, 110], [106, 100, 92]] }),
      theme: { sky: ['#5b83b8', '#a2bcd4', '#e6e8e6'], fog: '#e2e4e2', hemi: ['#eef0ec', '#a8aca4'], sun: '#f6f0dc', spray: '#bcb8b0', sprayOp: 0.5, trail: '#2a2a28', trailOp: 0.18, rough: 0.9 }
    },
    berlino: {
      tall: () => genTree({ trunk: '#6a5a46', cols: ['#5a8a3e', '#6a9a48', '#4f7a36'], r: 1.5, seed: 17 }), low: lowGeos.graffitiBlock,
      fa: 'currywurst', faG: foodGeos.currywurst, fb: 'berliner', fbG: foodGeos.berliner,
      ramp: ['#9aa0a6', '#b05ad0', true], gate: ['#d8352a', '#d4a017'], marker: markerGeos.ampel,
      tallCrash: 'crashTree', lowCrash: 'crashBlock', markerCrash: 'crashLight',
      walls: ['#c8c2b4', '#b8ac9c', '#cfc8ba', '#a8a096', '#bfb8a8', '#c2bcae'],
      props: [['wallBerlino', 6]], setback: 2.6, edge: 'walk', street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.tiglio, every: 12 } },   // Unter den Linden: file fitte di tigli
      style: 'altbau', roof: '#6d7276', bldH: [13, 12], ground: () => asphaltTexture({ seed: 67, base: '#4a4d50' }),
      theme: { sky: ['#5d7792', '#9fb0bf', '#dfe2e4'], fog: '#dcdfe1', hemi: ['#e6e9ec', '#9ea4a8'], sun: '#eeeee6', spray: '#b4b8bc', sprayOp: 0.5, trail: '#2c2e30', trailOp: 0.18, rough: 0.9 }
    },
    zurigo: {
      tall: () => genTree({ trunk: '#5f4a38', cols: ['#2f5a28', '#3a6a30', '#285022'], r: 1.5, dots: '#f0e8d0', seed: 19 }), low: lowGeos.cheese,
      fa: 'cioccolato', faG: foodGeos.cioccolato, fb: 'luxemburgerli', fbG: foodGeos.luxemburgerli,
      ramp: ['#b07a45', '#5aa0d8'], gate: ['#e8e8e8', '#5aa0d8'], marker: markerGeos.zhPole,
      tallCrash: 'crashTree', lowCrash: 'crashCheese', markerCrash: 'crashPole',
      walls: ['#e2d8c4', '#d8c8b0', '#e8e0d0', '#cfc0a8', '#e5dcc8', '#d2c4ac'],
      props: [['tramZurigo', 12]], setback: 2.6, street: { L: 'bldg', R: 'bldg', trees: { geo: streetTrees.tiglio, every: 20 } },   // Bahnhofstrasse: tram e tigli, niente auto
      style: 'napoli', roof: '#7a4a3a', bldH: [9, 10], ground: () => paveTexture({ seed: 71, size: 15, joint: '#3a3835', tones: [[130, 124, 116], [144, 138, 128], [120, 116, 108]], rails: true }),
      theme: { sky: ['#2e7ac8', '#93c0e6', '#ecf2f6'], fog: '#e8eef2', hemi: ['#f2f6fa', '#a8b2b8'], sun: '#fcf6e4', spray: '#c4c8cc', sprayOp: 0.5, trail: '#2a2c2e', trailOp: 0.18, rough: 0.9 }
    },
    newyork: {
      tall: () => genLamp({ pole: '#2e3034', lamp: '#f5e3a0', kind: 'ny' }), low: lowGeos.trashBags,
      fa: 'hotdog', faG: foodGeos.hotdog, fb: 'bagel', fbG: foodGeos.bagel,
      ramp: ['#8a9299', '#e8c33c'], gate: ['#e8842a', '#2753b8'], marker: markerGeos.hydrant,
      tallCrash: 'crashLamp', lowCrash: 'crashTrash', markerCrash: 'crashHydrant',
      walls: ['#7a4a34', '#8a5a40', '#6a3f2c', '#9a6a4e', '#5f3a2a', '#845640'],
      props: [['taxiNY', 4.7], ['taxiNY', 4.7]], setback: 2.6, street: { L: 'bldg', R: 'bldg' },   // Broadway: grattacieli e taxi gialli
      style: 'brickfe', roof: '#4a4d52', bldH: [28, 32], ground: () => asphaltTexture({ seed: 73, base: '#3f4144', lines: '#d8b02c', manholes: true }),
      theme: { sky: ['#4a7bb8', '#95b4d0', '#e2e3de'], fog: '#dedfda', hemi: ['#eceee8', '#a0a4a0'], sun: '#f6eeda', spray: '#b0b4b8', sprayOp: 0.5, trail: '#28292b', trailOp: 0.18, rough: 0.9 }
    }
  };
  for (const k in CITY_CFG) GROUND_MAKE[k] = CITY_CFG[k].ground;
  const CITY_ASSETS = {};
  function assets() {
    let a = CITY_ASSETS[theme];
    if (!a) {
      const C = CITY_CFG[theme];
      a = CITY_ASSETS[theme] = {
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
  function finishLine(z) {
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
  const me = makeRider(PALETTE[0]);
  world.add(me.group);
  const rider = me.group, body = me.body;

  // ---------- board trail ----------
  const TRAIL_N = 260;
  const trailPos = new Float32Array(TRAIL_N * 2 * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const idx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  trailGeo.setIndex(idx);
  const trailMesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: lin('#9db4ca'), transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  trailMesh.frustumCulled = false;
  world.add(trailMesh);
  let trailPts = [];
  function updateTrail() {
    const n = trailPts.length;
    for (let i = 0; i < TRAIL_N; i++) {
      const j = n - 1 - i, p = j >= 0 ? trailPts[j] : null, o = i * 6;
      if (!p) { trailPos.fill(0, o, o + 6); continue; }
      const half = p.on ? 0.13 : 0;
      const nx = Math.cos(p.a) * half, nz = Math.sin(p.a) * half;
      trailPos[o] = p.x - nx; trailPos[o + 1] = p.y + 0.03; trailPos[o + 2] = p.z - nz;
      trailPos[o + 3] = p.x + nx; trailPos[o + 4] = p.y + 0.03; trailPos[o + 5] = p.z + nz;
    }
    trailGeo.attributes.position.needsUpdate = true;
  }

  // ---------- snow particles ----------
  const dotTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const PN = 500;
  const pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pFloor = new Float32Array(PN);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const sprayPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: lin('#ffffff'), size: 0.18, map: dotTex, transparent: true, opacity: 0.9, depthWrite: false }));
  sprayPts.frustumCulled = false;
  world.add(sprayPts);
  let pNext = 0;
  for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -999;
  function spray(x, y, z, n, power, up = 3, dirX = 0) {
    if (reduceMotion) n = Math.ceil(n / 3);
    const floor = hgt(x, z);
    for (let k = 0; k < n; k++) {
      const i = pNext; pNext = (pNext + 1) % PN;
      pPos[i * 3] = x + rand(-0.35, 0.35); pPos[i * 3 + 1] = floor + y + 0.1; pPos[i * 3 + 2] = z + rand(-0.35, 0.35);
      pVel[i * 3] = rand(-1, 1) * power + dirX; pVel[i * 3 + 1] = rand(0.4, 1) * up; pVel[i * 3 + 2] = rand(-0.4, 1) * power;
      pLife[i] = rand(0.4, 0.9); pFloor[i] = floor;
    }
  }
  function updateSpray(dt) {
    for (let i = 0; i < PN; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
      pVel[i * 3 + 1] -= 9 * dt; pVel[i * 3] *= 0.97; pVel[i * 3 + 2] *= 0.97;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] = Math.max(pFloor[i] + 0.03, pPos[i * 3 + 1] + pVel[i * 3 + 1] * dt); pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    }
    pGeo.attributes.position.needsUpdate = true;
  }
  // scintille colorate durante le acrobazie
  const SN = 260;
  const sPos = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3), sVel = new Float32Array(SN * 3), sLife = new Float32Array(SN);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.16, map: dotTex, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  world.add(sparks);
  const SPARK_COLS = ['#ff7a3d', '#ffd23f', '#6cc4ff', '#ffffff'].map(c => new THREE.Color(c));
  let sNext = 0;
  for (let i = 0; i < SN; i++) sPos[i * 3 + 1] = -999;
  function sparkle(x, y, z, n, burst) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const i = sNext; sNext = (sNext + 1) % SN;
      sPos[i * 3] = x + rand(-0.4, 0.4); sPos[i * 3 + 1] = y + rand(0, 0.5); sPos[i * 3 + 2] = z + rand(-0.4, 0.4);
      const sp = burst ? 4 : 0.6;
      sVel[i * 3] = rand(-1, 1) * sp; sVel[i * 3 + 1] = rand(0.2, 1) * (burst ? 4 : 0.8); sVel[i * 3 + 2] = rand(-1, 1) * sp;
      const c = SPARK_COLS[Math.floor(Math.random() * SPARK_COLS.length)];
      sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
      sLife[i] = rand(0.35, burst ? 1.0 : 0.6);
    }
  }
  function updateSparks(dt) {
    for (let i = 0; i < SN; i++) {
      if (sLife[i] <= 0) continue;
      sLife[i] -= dt;
      if (sLife[i] <= 0) { sPos[i * 3 + 1] = -999; continue; }
      sVel[i * 3 + 1] -= 5 * dt;
      sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
    }
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.color.needsUpdate = true;
  }
  const FN = isPhone ? 700 : 1400;
  const fRel = new Float32Array(FN * 3), fPos = new Float32Array(FN * 3);
  for (let i = 0; i < FN; i++) { fRel[i * 3] = rand(-35, 35); fRel[i * 3 + 1] = rand(0, 22); fRel[i * 3 + 2] = rand(-70, 8); }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  const flakes = new THREE.Points(fGeo, new THREE.PointsMaterial({ color: lin('#ffffff'), size: 0.09, map: dotTex, transparent: true, opacity: 0.8, depthWrite: false }));
  flakes.frustumCulled = false;
  if (!reduceMotion) world.add(flakes);
  function updateFlakes(dt, px, pz, speed) {
    if (reduceMotion || !PART) return;
    const base = hgt(px, pz);
    for (let i = 0; i < FN; i++) {
      const o = i * 3;
      fRel[o + 1] -= PART.fall * (1 + (i % 5) * 0.12) * dt;
      fRel[o] += Math.sin(t * 0.7 + i) * PART.sway * dt;
      fRel[o + 2] += speed * dt * 0.02;
      if (fRel[o + 1] < 0) fRel[o + 1] += 22;
      fPos[o] = px + fRel[o]; fPos[o + 1] = base + fRel[o + 1]; fPos[o + 2] = pz + fRel[o + 2];
    }
    fGeo.attributes.position.needsUpdate = true;
  }

  // ---------- sound ----------
  let audio = null, muted = store.get('pistaNera.muted') === '1';
  function initAudio() {
    if (audio) { if (audio.ac.state === 'suspended') audio.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
      const windF = ac.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 480;
      const windG = ac.createGain(); windG.gain.value = 0;
      const carveF = ac.createBiquadFilter(); carveF.type = 'bandpass'; carveF.frequency.value = 2600; carveF.Q.value = 0.7;
      const carveG = ac.createGain(); carveG.gain.value = 0;
      src.connect(windF); windF.connect(windG); windG.connect(master);
      src.connect(carveF); carveF.connect(carveG); carveG.connect(master);
      src.start();
      if (THEMES[theme] && THEMES[theme].city) carveF.frequency.value = 900;
      audio = { ac, master, windG, carveG, windF, carveF };
    } catch (e) { audio = null; }
  }
  function tone(type, f0, f1, dur, vol) {
    if (!audio || muted) return;
    const { ac, master } = audio;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, ac.currentTime); o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur * 0.7);
    g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.05);
  }
  const thump = v => tone('sine', 110, 45, 0.25, 0.35 * v);
  const chime = () => tone('triangle', 1320, 1760, 0.22, 0.12);
  const beep = hi => tone('square', hi ? 1046 : 523, hi ? 1046 : 523, hi ? 0.5 : 0.18, 0.08);
  function soundLevels(speed, carve, onSnow) {
    if (!audio) return;
    const now = audio.ac.currentTime, active = mode === 'solo' || mode === 'race';
    audio.windG.gain.setTargetAtTime(active ? Math.min(0.32, (speed / 45) * 0.3) : 0.03, now, 0.15);
    audio.windF.frequency.setTargetAtTime(300 + speed * 18, now, 0.2);
    audio.carveG.gain.setTargetAtTime(active && onSnow ? Math.min(0.22, carve * (speed / 45) * 0.4 + 0.02) : 0, now, 0.06);
  }
  function setMuted(m) {
    muted = m;
    store.set('pistaNera.muted', m ? '1' : '0');
    $('btnSound').setAttribute('aria-pressed', String(!m));
    $('btnSound').textContent = m ? tr('audioOff') : tr('audioOn');
    if (audio) audio.master.gain.setTargetAtTime(m ? 0 : 0.9, audio.ac.currentTime, 0.05);
  }

  // ---------- scenari ----------
  const THEMES = {
    neve: { sky: ['#3f7fc4', '#9cc5e6', '#d6e7f3'], fog: '#d6e7f3', hemi: ['#cfe4f7', '#aebfd0'], sun: '#fff0d6', spray: '#ffffff', sprayOp: 0.9, trail: '#9db4ca', trailOp: 0.42, rough: 0.82, part: { col: '#ffffff', size: 0.09, fall: 1.1, sway: 0.25, op: 0.8 } }
  };
  for (const k in CITY_CFG) THEMES[k] = Object.assign({ city: true }, CITY_CFG[k].theme);
  const isCity = () => !!THEMES[theme].city;   // città: niente neve, si va in skateboard
  let PART = null;
  const urlScena = new URLSearchParams(location.search).get('scena');
  let theme = THEMES[urlScena] ? urlScena : (THEMES[store.get('cyf.scena')] ? store.get('cyf.scena') : 'neve');
  // temp: città della gara scelta da chi organizza (R-118): si usa per la gara senza toccare la scelta salvata nel menu
  function applyTheme(name, temp) {
    theme = THEMES[name] ? name : 'neve';
    if (!temp) store.set('cyf.scena', theme);
    TRK = TRACKS[theme] || TRACKS.neve;
    const T = THEMES[theme];
    const u = sky.material.uniforms;
    u.top.value.set(T.sky[0]); u.mid.value.set(T.sky[1]); u.horizon.value.set(T.sky[2]);
    scene.fog.color.copy(lin(T.fog));
    scene.fog.near = T.fogN || 60;
    scene.fog.far = T.fogF || 200;
    hemi.color.copy(lin(T.hemi[0])); hemi.groundColor.copy(lin(T.hemi[1]));
    sun.color.copy(lin(T.sun));
    if (!GROUND_TEX[theme]) GROUND_TEX[theme] = GROUND_MAKE[theme]();
    groundMat.map = GROUND_TEX[theme];
    groundMat.roughness = T.rough || 0.9;
    groundMat.needsUpdate = true;
    gx0 = NaN;
    ranges.visible = theme === 'neve';
    for (const k in builtSky) builtSky[k].visible = false;
    const sg = skylineFor(theme);
    if (sg) sg.visible = true;
    PART = T.part || null;
    flakes.visible = !!PART && !reduceMotion;
    if (PART) { flakes.material.color.copy(lin(PART.col)); flakes.material.size = PART.size; flakes.material.opacity = PART.op; }
    sprayPts.material.color.copy(lin(T.spray)); sprayPts.material.opacity = T.sprayOp;
    trailMesh.material.color.copy(lin(T.trail)); trailMesh.material.opacity = T.trailOp;
    const board = T.city ? 'skate' : 'snow';
    me.setBoard(board);
    for (const [, r] of remotes) r.model.setBoard(board);
    if (audio) audio.carveF.frequency.value = T.city ? 900 : 2600;
    stage.style.background = T.fog;
    if (!temp) selScena.value = theme;
  }
  const selScena = $('selScena');
  selScena.addEventListener('change', () => {
    if (!THEMES[selScena.value] || racing()) return;
    store.set('cyf.scena', selScena.value);
    // in sfida la città la sceglie chi organizza: la propria scelta si manda al server
    if (net.ws) net.send({ t: 'scena', scena: selScena.value });
    if (selScena.value === theme) return;
    applyTheme(selScena.value);
    reset((Math.random() * 2 ** 31) | 0, null, false);
  });

  // ---------- game state ----------
  // mode: menu | solo | pause | over | lobby | countdown | race | finished | results
  let mode = 'menu';
  let best = parseInt(store.get('pistaNera.best') || '0', 10) || 0;
  let wallT = 0, tricksN = 0, near500 = false, P, objs = [], bonus, lives, invuln, combo, trailT, shake, maxSpeed, bestSpin, overTimer, overReason, t = 0, rowZ, forestZ, markerZ, camYaw, lean, camY, squash, armsUp;
  let rowRng = Math.random, forestRng = Math.random, buildRng = Math.random, propRng = Math.random, buildZ = 0, propZ = 0, finishObj = null, raceLen = 2000;
  const racing = () => mode === 'countdown' || mode === 'race' || mode === 'finished';
  const distM = () => Math.max(0, -P.z);
  const score = () => Math.floor(distM()) + bonus;
  const kmh = v => v * 3.6;

  let bigZones = [];   // spazio libero attorno ai trampolini giganti
  // Altezza della superficie della rampa (sopra la sua base) nel punto z della pista. Ricalca il modello: profilo
  // quadratico da (-0,6; 0) a (4; 1,1) più lo spessore del bordo arrotondato (0,25 sulla neve, 0,2 in città),
  // scalato ×2 per il trampolino gigante. La rampa inizia RAMP_FOOT·k metri prima del suo centro (il rider ci sale 0,9 m prima, quando ci arriva
  // la punta della tavola) e stacca a 2·k dopo.
  const RAMP_FOOT = 2.85;
  function rampTop(r, z) {
    const k = r.big ? 2 : 1, bev = isCity() ? 0.2 : 0.25;
    const xo = 2 - (z - r.z) / k;                      // coordinata lungo il profilo del modello
    if (xo < -0.6) return Math.max(0, xo + 0.6 + bev) * k;   // bordo arrotondato all'ingresso
    const c = 4 - Math.min(xo, 4);
    const u = (4.8 - Math.sqrt(Math.max(0, 23.04 - 0.8 * c))) / 0.4;   // parametro della curva quadratica
    return (1.1 * (1 - u) + bev) * k;
  }
  function clearWorld() {
    for (const o of objs) removeObj(o);
    objs = [];
    if (finishObj) { world.remove(finishObj); finishObj = null; }
  }
  let lastSeed = 0;
  function reset(seed, x0, withFinish) {
    lastSeed = seed;
    diag.log('pista', 'seed ' + seed + ' · ' + theme + (withFinish ? ' · con traguardo' : ''));
    clearWorld();
    rowRng = mulberry32(seed);
    forestRng = mulberry32(seed ^ 0x5bd1e995);
    buildRng = mulberry32(seed ^ 0x2c1b3c6d);
    propRng = mulberry32(seed ^ 0x6a09e667);
    buildZ = 30; propZ = 10; sideZ = 20; treeZ = 14; sideRng = mulberry32(seed ^ 0x1b873593);
    bigZones = [];
    P = { x: x0 != null ? x0 : center(0), y: 0, z: 0, prevZ: 0, ang: 0, speed: 9, vy: 0, spin: 0, flip: 0, grab: 0, grabT: 0, idleAir: 0, airT: 0, air: false, crash: 0, ramp: false, onRamp: null };
    trailPts = [];
    bonus = 0; lives = 3; invuln = 0; combo = 0; trailT = 0; shake = 0;
    maxSpeed = 0; bestSpin = 0; overTimer = 0; overReason = ''; tricksN = 0; near500 = false;
    clearHazards();
    rowZ = -28; forestZ = 22; markerZ = 10; camYaw = 0; lean = 0; camY = NaN; squash = 0; armsUp = 0;
    renderLives();
    gx0 = NaN;
    updateGround(P.x, P.z);
    if (withFinish) finishObj = finishLine(-raceLen);
    ensureSpawned();
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
  function spawnRow(z, ghost) {
    const r = rowRng, rr = (a, b) => a + r() * (b - a);
    const d = -z, c = center(z);
    const n = r() < Math.min(0.8, 0.4 + d / 3500) ? 2 : 1;
    const xs = [];
    for (let i = 0; i < n; i++) {
      let x = c + rr(-15.5, 15.5);
      const kind = r();
      if (xs.some(v => Math.abs(v - x) < 4.5) || inBigZone(x, z, 1.3)) continue;
      xs.push(x);
      // R-310 (0.10.0): ostacoli −35%. Prima: alberi fino a 0,38 e rocce fino a 0,58; ora 0,247 e 0,377, e fino a 0,58 non si mette nulla
      if (kind < 0.247) { const t = addTree(r, x, z, rr(0.75, 1.05), true, ghost); if (t) objs.push(t); }
      else if (kind < 0.377) { const s = rr(0.8, 1.25), ry = r() * TAU; if (!ghost) objs.push({ type: 'rock', x, z, s, mesh: addMesh(isCity() ? assets().low : GEO.rock, vcMat, x, z, { s, ry }) }); }
      else if (kind < 0.58) { /* posto lasciato libero */ }
      else if (kind < 0.71) {
        const k = 3 + Math.floor(r() * 3);
        if (!ghost) for (let j = 0; j < k; j++) {
          const gz = z - j * 2.2, gx = x + (center(gz) - c) + Math.sin(j * 0.9) * 0.8;   // la fila di bonus segue la curva della strada: uguale in ogni città (R-309)
          if (inBigZone(gx, gz, 0.5)) continue;
          const alt = (Math.round(z) + j) % 2;
          const CC = CITY_CFG[theme];
          const food = CC ? (alt ? assets().fa : assets().fb) : null;
          objs.push({ type: 'gem', x: gx, z: gz, mesh: food ? addMesh(food, vcMat, gx, gz, { y: 0.9 }) : addMesh(gemGeo, gemMat, gx, gz, { y: 0.9 }), phase: j, food: CC ? (alt ? CC.fa : CC.fb) : null });
        }
      }
      else if (kind < 0.83) {
        // circa una rampa su sette (15%) è un trampolino gigante: grande il doppio, fa saltare molto più in alto (R-214)
        const big = r() < 0.15;
        if (big) x = clamp(x, c - 13.5, c + 13.5);   // largo 6 m: resta tutto dentro la strada
        if (big) {
          const zone = { x, z0: z + 5, z1: z - 5.5, hw: 3.6 };
          bigZones.push(zone);
          // via quello che il trampolino coprirebbe (anche dalla fila prima): stessa scelta su ogni dispositivo
          objs = objs.filter(o => {
            if (o.type === 'tree' || o.type === 'rock' || o.type === 'gem' || o.type === 'ramp' || o.type === 'gate') {
              const hw = zone.hw + (o.type === 'gate' ? o.half + 0.3 : o.type === 'gem' ? 0.5 : 1.3);
              if (o.z <= zone.z0 && o.z >= zone.z1 && Math.abs(o.x - x) < hw) { removeObj(o); return false; }
            }
            return true;
          });
        }
        if (!ghost) objs.push({ type: 'ramp', x, z, used: false, big, mesh: addMesh(isCity() ? assets().ramp : GEO.ramp, vcMat, x, z, big ? { recv: true, s: 2 } : { recv: true }) });
      }
      else {
        const gx = c + rr(-9, 9), gi = r() < 0.5 ? 0 : 1;
        const CG = CITY_CFG[theme];
        if (!ghost && !inBigZone(gx, z, 2.7)) objs.push({ type: 'gate', x: gx, z, half: 2.4, done: false, mesh: addMesh(CG ? assets().gates[gi] : (gi ? GEO.gateBlue : GEO.gateRed), vcMat, gx, z), col: CG ? CG.gate[gi] : (gi ? '#2766c6' : '#d8302a') });
      }
    }
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
    const ST = CITY_CFG[theme].street;
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
    const horizon = P.z - 200;
    const bLine = P.z + 16;   // quello che è già alle spalle non va costruito: solo "consumato"
    const soloWorld = mode === 'solo' || mode === 'over' || mode === 'pause';
    while (rowZ > horizon) {
      // in gara niente ostacoli negli ultimi 25 m prima del traguardo
      if (soloWorld || (racing() && -rowZ < raceLen - 25)) spawnRow(rowZ, rowZ > bLine);
      rowZ -= (6 + rowRng() * 4) * Math.max(0.5, 1 - (-rowZ) / 3200);
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
    if (isCity() && CITY_CFG[theme].street) {
      while (sideZ > horizon) { spawnStreetSide(sideZ, 22, sideZ > bLine); sideZ -= 22; }
      while (treeZ > horizon) treeZ -= spawnSideTrees(treeZ, treeZ > bLine);
    }
    const behind = P.z + 16;
    if (bigZones.length && bigZones[0].z1 > behind) bigZones = bigZones.filter(b => b.z1 <= behind);
    if (objs.length && objs.some(o => o.z > behind)) objs = objs.filter(o => { if (o.z > behind) { removeObj(o); return false; } return true; });
  }

  // ---------- input ----------
  const keys = { left: false, right: false, up: false, down: false };
  // rotellina sul telefono: x da -1 (sinistra) a 1 (destra), y da -1 (su = accelera) a 1 (giù = frena)
  const stick = { x: 0, y: 0, on: false };
  const inSteer = () => clamp((keys.right ? 1 : 0) - (keys.left ? 1 : 0) + stick.x, -1, 1);
  const inFast = () => (keys.down && !keys.up) || stick.y < -0.35;   // posizione raccolta, più veloce
  const inSlow = () => keys.up || stick.y > 0.35;                    // peso in avanti, frena
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter' && inCode.value.trim()) joinFromMenu(); return; }
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
    else if (k === ' ') { if (mode === 'solo' || mode === 'race') e.preventDefault(); if (!e.repeat) jump(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      // a terra frena (peso in avanti); in aria salto mortale in avanti
      if (mode === 'solo' || mode === 'race') e.preventDefault();
      keys.up = true;
    }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); keys.down = true; }
    else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
    else if (k === 'm' || k === 'M') setMuted(!muted);
    else if (k === 'v' || k === 'V') { if (!e.repeat) voiceButton(); }
    else if (k === 'b' || k === 'B') { if (!e.repeat) useItem('banana'); }
    else if (k === 'n' || k === 'N') { if (!e.repeat) useItem('bomb'); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = false;
    if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = keys.up = keys.down = false; stick.x = stick.y = 0; if (mode === 'solo') togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'solo') togglePause(); });
  function holdButton(el, key) {
    const on = e => { e.preventDefault(); keys[key] = true; el.classList.add('on'); };
    const off = () => { keys[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, off));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  // sul telefono: Salta a terra salta, tenuto premuto in aria fa il salto mortale all'indietro
  const tJump = $('tJump');
  tJump.addEventListener('pointerdown', e => { e.preventDefault(); tJump.classList.add('on'); if (P && P.air) keys.down = true; else jump(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => tJump.addEventListener(ev, () => { keys.down = false; tJump.classList.remove('on'); }));
  tJump.addEventListener('contextmenu', e => e.preventDefault());
  // rotellina: compare dove si appoggia il dito; spostandolo a destra/sinistra si curva (più lo sposti, più curvi),
  // in su si accelera, in giù si frena; in aria destra/sinistra = avvitamento, su/giù = salto mortale
  const stickEl = $('stick'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
  const STICK_R = 54;
  let stickId = null, stickCx = 0, stickCy = 0;
  function stickRest() {
    const r = stickEl.getBoundingClientRect();
    stickBase.style.left = (r.width * 0.56) + 'px'; stickBase.style.top = (r.height * 0.58) + 'px';
    stickKnob.style.transform = '';
  }
  function stickMove(e) {
    const dx = e.clientX - stickCx, dy = e.clientY - stickCy;
    const d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
    const kx = dx * k, ky = dy * k;
    stickKnob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
    const dead = (v) => Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86;
    stick.x = dead(kx / STICK_R); stick.y = dead(ky / STICK_R);
  }
  stickEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (stickId !== null) return;
    stickId = e.pointerId;
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) {}
    const r = stickEl.getBoundingClientRect();
    // il centro della rotellina va sotto il dito, senza uscire dalla zona
    const cx = clamp(e.clientX - r.left, 66, r.width - 66), cy = clamp(e.clientY - r.top, 66, r.height - 66);
    stickCx = r.left + cx; stickCy = r.top + cy;
    stickBase.style.left = cx + 'px'; stickBase.style.top = cy + 'px';
    stick.on = true; stickEl.classList.add('on');
    stickMove(e);
    initAudio();
  });
  stickEl.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = e => {
    if (e.pointerId !== stickId) return;
    stickId = null; stick.x = stick.y = 0; stick.on = false;
    stickEl.classList.remove('on'); stickRest();
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => stickEl.addEventListener(ev, stickEnd));
  stickEl.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('resize', stickRest);
  stickRest();

  // ---------- overlays & HUD ----------
  const OVERLAYS = ['menu', 'lobby', 'raceResults', 'over', 'pause'];
  function show(id) { for (const o of OVERLAYS) $(o).hidden = o !== id; diag.log('schermata', id || 'gioco'); }
  const banner = $('banner');
  function setBanner(text) { banner.hidden = !text; banner.textContent = text || ''; if (!text) banner.classList.remove('wait'); }

  function hudLabels() {
    const race = racing();
    $('k1').textContent = race ? tr('hudTime') : tr('hudPoints');
    $('k2').textContent = race ? tr('hudPlace') : tr('hudDistance');
    $('kSpeed').textContent = tr('hudSpeed');
    $('k4').textContent = race ? tr('hudLeft') : tr('hudAltitude');
    $('k5').textContent = tr('hudPoints');
    $('hLives').hidden = race;
    $('sPts').hidden = !race;
    $('live').hidden = !race;
    $('items').hidden = !race;
  }

  const toasts = $('toasts');
  function say(text, color) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = text; el.style.color = color || '#13233a';
    toasts.appendChild(el);
    setTimeout(() => el.remove(), 1150);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }

  // ---------- solo ----------
  function startSolo() {
    initAudio();
    net.close();
    mode = 'solo';
    me.setColor(PALETTE[0], myJersey());
    reset((Math.random() * 2 ** 31) | 0, null, false);
    hudLabels();
    show(null); setBanner('');
  }
  function togglePause() {
    if (mode === 'solo') { mode = 'pause'; show('pause'); keys.left = keys.right = false; soundLevels(0, 0, false); }
    else if (mode === 'pause') { mode = 'solo'; show(null); last = performance.now(); }
  }
  $('btnSolo').addEventListener('click', startSolo);
  $('btnRetry').addEventListener('click', startSolo);
  $('btnResume').addEventListener('click', togglePause);
  $('btnMenu').addEventListener('click', toMenu);
  $('btnSound').addEventListener('click', () => { initAudio(); setMuted(!muted); });
  setMuted(muted);

  function jump() {
    if ((mode !== 'solo' && mode !== 'race') || P.air || P.crash > 0) return;
    P.air = true; P.vy = 6.4; P.ramp = false; squash = 0.6; startAir();
    spray(P.x, 0, P.z, 12, 2.5);
  }

  function crash(reason) {
    if (invuln > 0 || P.crash > 0 || (mode === 'solo' && lives <= 0)) return;
    if (mode === 'solo') { lives--; renderLives(); }
    P.crash = 0.85; invuln = 2.3; P.speed *= 0.3; P.air = false; P.y = 0; P.vy = 0; P.spin = 0; P.flip = 0; P.grab = 0; P.onRamp = null;
    combo = 0; shake = reduceMotion ? 0 : 0.45;
    spray(P.x, 0.2, P.z, 60, 4, 5);
    thump(1.4);
    say(reason, '#d8302a');
    trailPts.push({ x: P.x, y: hgt(P.x, P.z), z: P.z, a: P.ang, on: false });
    if (mode === 'solo' && lives <= 0) { overTimer = 1.0; overReason = reason; }
  }
  function startAir() { P.flip = 0; P.grab = 0; P.grabT = 0; P.idleAir = 0; P.airT = 0; }
  const nearest = (v, step) => Math.round(v / step) * step;
  function land() {
    const impact = Math.min(1, Math.abs(P.vy) / 14);
    P.y = 0; P.vy = 0; P.air = false; squash = 0.5 + impact * 0.5;
    const errSpin = Math.abs(P.spin - nearest(P.spin, Math.PI));
    const errFlip = Math.abs(P.flip - nearest(P.flip, TAU));
    const halfTurns = Math.round(Math.abs(P.spin) / Math.PI);
    const flips = Math.round(Math.abs(P.flip) / TAU), back = P.flip > 0;
    const grabbed = P.grabT > 0.3;
    spray(P.x, 0, P.z, 22, 3.2, 3);
    thump(0.5 + impact);
    P.grab = 0;
    // atterraggio: oltre ~57° di rotazione o ~63° di salto mortale si cade; poco storto = solo rallentamento
    if (errSpin > 1.0 || errFlip > 1.1) { P.spin = 0; P.flip = 0; crash(tr('crashLanding')); return; }
    const sloppy = errSpin > 0.45 || errFlip > 0.5;
    if (sloppy) P.speed *= 0.75;
    const names = [];
    let pts = 0;
    if (flips >= 1) { names.push((flips > 1 ? flips + 'x ' : '') + (back ? 'Backflip' : 'Frontflip')); pts += 150 * flips; }
    if (halfTurns >= 1) { names.push(halfTurns * 180 + '°'); pts += 60 * halfTurns; bestSpin = Math.max(bestSpin, halfTurns * 180); }
    if (grabbed) { names.push('Grab'); pts += 30 + Math.min(60, Math.round(P.grabT * 40)); }
    if (names.length) {
      tricksN += names.length;
      if (P.ramp) pts *= 2;
      if (names.length > 1) pts = Math.round(pts * 1.5);
      if (sloppy) pts = Math.round(pts / 2);
      bonus += pts;
      say(names.join(' + ') + '  +' + pts, sloppy ? '#8a6d3b' : '#ff5a1f');
      if (!sloppy) { sparkle(P.x, hgt(P.x, P.z) + 0.6, P.z, names.length > 1 ? 70 : 40, true); tone('triangle', 880, 1320, 0.3, 0.1); }
    } else if (sloppy) say(tr('sloppyLanding'), '#8a6d3b');
    P.spin = halfTurns % 2 ? Math.PI : 0;
    P.flip = 0;
  }

  // ---------- update ----------
  function update(dt, auto) {
    t += dt;
    let steer = inSteer();
    if (auto) steer = clamp((center(P.z - 14) - P.x) * 0.25 + Math.sin(t * 0.8) * 0.9, -1, 1);
    const frozen = mode === 'countdown';
    const braking = mode === 'finished';
    if (braking) steer = clamp((center(P.z - 10) - P.x) * 0.15, -0.5, 0.5);
    const d = distM();
    const vmax = 18 + Math.min(26, d * 0.00975);   // +30%: si arriva prima alla velocità massima
    if (invuln > 0) invuln -= dt;
    if (shake > 0) shake = Math.max(0, shake - 1.2 * dt);
    squash = Math.max(0, squash - 2.5 * dt);

    if (frozen) {
      P.speed = 0;
    } else if (P.crash > 0) {
      P.crash -= dt;
      P.speed = Math.max(2, P.speed - 14 * dt);
    } else if (!P.air) {
      P.ang += steer * 2.4 * dt;
      if (!steer) P.ang -= P.ang * Math.min(1, 1.5 * dt);
      P.ang = clamp(P.ang, -1.25, 1.25);
      const ax = P.x + Math.sin(P.ang) * 2, az = P.z - Math.cos(P.ang) * 2;
      const drop = hgt(P.x, P.z) - hgt(ax, az);
      let target = (auto ? 15 : vmax) * Math.pow(Math.cos(P.ang), 1.6) * (1 + clamp(drop * 0.35, -0.2, 0.2));
      // freccia giù: posizione raccolta, più veloce; freccia su: peso in avanti, frena
      const tuck = !auto && !braking && inFast() && !inSlow(), brake = !auto && !braking && inSlow();
      if (tuck) target *= 1.12;
      if (brake) target *= 0.5;
      if (braking) target = 0;
      P.speed += (target - P.speed) * (target > P.speed ? (tuck ? 0.85 : 0.65) : (braking ? 0.9 : (brake ? 2.0 : 1.3))) * dt;
      if (Math.abs(P.ang) > 0.6 && Math.random() < 0.8) spray(P.x, 0, P.z, 2, 1.6, 2.4, Math.cos(P.ang) * Math.sign(P.ang) * 3);
    } else {
      const flipIn = (keys.down || stick.y < -0.35 ? 1 : 0) - (keys.up || stick.y > 0.35 ? 1 : 0);
      P.airT += dt;
      P.spin += steer * 9 * dt;
      P.flip += flipIn * 8.5 * dt;
      // presa automatica della tavola se in aria non si tocca nulla
      P.idleAir = steer || flipIn ? 0 : P.idleAir + dt;
      const wantGrab = !auto && P.airT > 0.18 && P.idleAir > 0.12 && P.vy > -9;
      P.grab += ((wantGrab ? 1 : 0) - P.grab) * Math.min(1, 9 * dt);
      if (P.grab > 0.8) P.grabT += dt;
      if (!auto && (Math.abs(steer) || flipIn || P.grab > 0.8)) sparkle(P.x, hgt(P.x, P.z) + P.y + 0.4, P.z, 1, false);
      P.vy -= 20 * dt;
      P.y += P.vy * dt;
      // atterraggio assistito: poco prima di toccare terra il rider si raddrizza da solo
      const tg = (P.vy + Math.sqrt(Math.max(0, P.vy * P.vy + 40 * Math.max(0, P.y)))) / 20;
      if (P.vy < 0 && tg < 0.4) {
        const k = tg < 0.18 ? 1 : (steer ? 0.35 : 1);
        const kf = tg < 0.18 ? 1 : (flipIn ? 0.35 : 1);
        const ts = nearest(P.spin, Math.PI), tf = nearest(P.flip, TAU);
        P.spin += clamp(ts - P.spin, -7 * dt * k, 7 * dt * k);
        P.flip += clamp(tf - P.flip, -9 * dt * kf, 9 * dt * kf);
      }
      if (P.y <= 0 && !P.onRamp) land();
    }

    const g0 = hgt(P.x, P.z);
    P.prevZ = P.z;
    P.x += Math.sin(P.ang) * P.speed * dt;
    P.z -= Math.cos(P.ang) * P.speed * dt;
    const g1 = hgt(P.x, P.z);
    if (!P.air && !P.onRamp && P.crash <= 0) {
      if ((g0 - g1) / Math.max(dt, 1e-4) > 3.2 && P.speed > 16) { P.air = true; P.vy = 0; P.y = g0 - g1; P.ramp = false; startAir(); }
    } else if (P.air) P.y += g0 - g1;
    // in città la strada è chiusa dai palazzi: chi va contro il muro rimbalza verso il centro e rallenta
    if (wallT > 0) wallT -= dt;
    if (isCity()) {
      const c = center(P.z), off = P.x - c, lim = 21.6;
      if (Math.abs(off) > lim) {
        P.x = c + Math.sign(off) * lim;
        if (Math.sign(P.ang) === Math.sign(off)) P.ang = -P.ang * 0.4;
        if (wallT <= 0 && !auto) {
          wallT = 0.6;
          P.speed *= 0.55; combo = 0;
          shake = reduceMotion ? 0 : 0.25;
          thump(0.9);
          spray(P.x, 0.3, P.z, 18, 2.5, 2);
          say(tr('wall'), '#d8302a');
        }
      }
    }
    maxSpeed = Math.max(maxSpeed, P.speed);

    if (P.onRamp && !P.air) {
      // sulla rampa il rider segue la superficie vera del modello (R-214): niente piedi dentro, anche sul trampolino gigante
      const r = P.onRamp, k = r.big ? 2 : 1;
      P.y = rampTop(r, P.z) + hgt(r.x, r.z) - hgt(P.x, P.z);
      if (Math.abs(P.x - r.x) > 1.7 * k) { P.onRamp = null; P.air = true; P.vy = 0; }
      else if (P.z <= r.z - 2 * k) {
        // trampolino gigante: stacco da 2,2 m e spinta 13,5 m/s → circa 6,8 m d'altezza e 1,5 s in aria (normale: 3 m e 1 s)
        P.onRamp = null; P.air = true; P.vy = r.big ? 13.5 : 8.6; P.spin = P.spin % TAU; P.ramp = true; startAir();
        P.speed = Math.min(P.speed * 1.06, 46);
        say(tr(r.big ? (isPhone ? 'bigRampPhone' : 'bigRampKeys') : (isPhone ? 'rampPhone' : 'rampKeys')), r.big ? '#ff5a1f' : '#2f7fd0');
      }
    }

    trailT += dt;
    const onSnow = !P.air && P.crash <= 0 && !P.onRamp && P.speed > 0.5;
    if (trailT > 0.03) {
      trailT = 0;
      const lastP = trailPts[trailPts.length - 1];
      if (onSnow || (lastP && lastP.on)) trailPts.push({ x: P.x, y: hgt(P.x, P.z), z: P.z, a: P.ang, on: onSnow });
      if (trailPts.length > TRAIL_N + 20) trailPts.splice(0, trailPts.length - TRAIL_N);
    }

    updateGround(P.x, P.z);
    ensureSpawned();
    if (!auto && !frozen && !braking) collide();
    if (mode === 'race') collideHazards();
    updateHazards(dt);
    for (const o of objs) if (o.type === 'gem') { if (!o.food) o.mesh.rotation.y += dt * 2.5; o.mesh.position.y = hgt(o.x, o.z) + 0.9 + Math.sin(t * 3 + o.phase) * 0.15; }
    updateSpray(dt);
    updateSparks(dt);
    updateFlakes(dt, P.x, P.z, P.speed);
    soundLevels(P.speed, Math.abs(P.ang) + Math.abs(steer) * 0.5, onSnow);
    if (overTimer > 0) { overTimer -= dt; if (overTimer <= 0) soloOver(); }
  }

  function collide() {
    if (mode === 'solo' && lives <= 0) return;
    let taken = false;
    for (const o of objs) {
      const dz = o.z - P.z;
      if (dz < -7 || dz > 6) continue;   // -7: il trampolino gigante si tocca già 6,6 m prima del suo centro
      const dx = o.x - P.x, d2 = dx * dx + dz * dz;
      const CC = CITY_CFG[theme];
      if (o.type === 'tree') { if (P.y < 5.5 * o.s && d2 < (0.8 * o.s) ** 2) crash(tr(CC ? CC.tallCrash : 'crashTree')); }
      else if (o.type === 'rock') { if (P.y < 0.75 * o.s && d2 < (1.1 * o.s) ** 2) crash(tr(CC ? CC.lowCrash : 'crashRock')); }
      else if (o.type === 'marker') { if (P.y < 1.5 && d2 < 0.35 * 0.35) crash(tr(CC ? CC.markerCrash : 'crashPole')); }
      else if (o.type === 'ramp') {
        const k = o.big ? 2 : 1;
        if (!o.used && !P.air && P.crash <= 0 && Math.abs(dx) < 1.5 * k && P.z < o.z + RAMP_FOOT * k + 0.9 && P.z > o.z - 1.2 * k) { o.used = true; P.onRamp = o; P.y = Math.max(P.y, rampTop(o, P.z) + hgt(o.x, o.z) - hgt(P.x, P.z)); }
      } else if (o.type === 'gem') {
        if (P.y < 2.2 && d2 < 0.95 * 0.95) { o.taken = true; taken = true; bonus += 10; spray(o.x, 0.9, o.z, 8, 1.5, 2); world.remove(o.mesh); chime(); if (o.food && Math.random() < 0.35) say(tr('food_' + o.food) + '!  +10', '#c4361f'); }
      } else if (o.type === 'gate') {
        const left = o.x - o.half, right = o.x + o.half;
        if (P.y < 1.7 && Math.abs(dz) < 0.25 && (Math.abs(P.x - left) < 0.2 || Math.abs(P.x - right) < 0.2)) crash(tr('crashGate'));
        if (!o.done && P.prevZ > o.z && P.z <= o.z) {
          o.done = true;
          if (P.x > left && P.x < right) {
            combo++;
            const pts = 50 * combo;
            bonus += pts; chime();
            say(combo > 1 ? tr('gate') + ' x' + combo + '  +' + pts : tr('gate') + '  +50', o.col || '#d8302a');
          } else combo = 0;
        }
      }
    }
    if (taken) objs = objs.filter(o => !o.taken);
  }

  function soloOver() {
    mode = 'over';
    soundLevels(0, 0, false);
    const s = score(), isBest = s > best;
    if (isBest) { best = s; store.set('pistaNera.best', String(best)); }
    $('overReason').textContent = tr('lastCrash', { r: overReason.replace('!', '') });
    $('rScore').textContent = fmt(s);
    $('rDist').textContent = fmt(Math.floor(distM())) + ' m';
    $('rSpeed').textContent = Math.round(kmh(maxSpeed)) + ' km/h';
    $('rSpin').textContent = bestSpin ? bestSpin + '°' : '—';
    $('rBest').textContent = isBest ? tr('newRecord') : tr('yourRecord', { p: fmt(best) });
    show('over');
    $('btnRetry').focus();
  }

  // ---------- online ----------
  const myId = store.get('cyf.id') || (() => { const v = 'p' + Math.random().toString(36).slice(2, 12); store.set('cyf.id', v); return v; })();
  const inName = $('inName'), inCode = $('inCode');
  inName.value = store.get('cyf.name') || '';
  const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');

  const net = {
    ws: null, code: null, hostId: null, players: [], offset: 0, phase: 'lobby', racers: [], results: [], finished: new Map(),
    seed: 0, startAt: 0, round: 0, retries: 0, want: false, pingTimer: null, posTimer: null, myColor: 0,
    pub: false, minutes: 5, autoAt: 0, awards: null, ping: 0, pingAt: 0, msgs: 0,
    close() {
      this.want = false;
      if (typeof stopVoice === 'function' && voice.recording) stopVoice(true);
      clearInterval(this.pingTimer); clearInterval(this.posTimer);
      if (this.ws) { try { this.ws.close(1000); } catch (e) {} }
      this.ws = null; this.code = null;
      clearRemotes();
    },
    send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  };
  const serverNow = () => Date.now() + net.offset;

  function menuError(text) { $('menuErr').hidden = !text; $('menuErr').textContent = text || ''; }
  function needName() {
    const n = inName.value.trim();
    if (!n) { menuError(tr('errName')); inName.focus(); return null; }
    store.set('cyf.name', n);
    menuError('');
    return n;
  }
  $('btnCreate').addEventListener('click', () => { if (needName()) connect(newCode()); });
  function joinFromMenu() {
    if (!needName()) return;
    const c = inCode.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) { menuError(tr('errCode')); inCode.focus(); return; }
    connect(c);
  }
  $('btnJoin').addEventListener('click', joinFromMenu);
  // modalità online: il server indica una sala pubblica; si aspetta lì che arrivino altri giocatori
  $('btnOnline').addEventListener('click', async () => {
    if (!needName()) return;
    const b = $('btnOnline');
    b.disabled = true;
    try {
      const res = await fetch('/api/quick', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok || !d.code) throw new Error();
      connect(d.code, true);
    } catch (e) { menuError(tr('errOnline')); }
    b.disabled = false;
  });

  function connect(code, pub) {
    initAudio();
    net.close();
    net.want = true; net.code = code; net.retries = 0; net.phase = 'lobby'; net.results = []; net.finished = new Map();
    net.pub = !!pub || /^ONLINE\d+$/.test(code); net.autoAt = 0; net.awards = null;
    history.replaceState(null, '', location.pathname + (net.pub ? '' : '?sfida=' + code));
    mode = 'lobby';
    renderLobby();
    show('lobby');
    open();
  }
  function open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws;
    diag.log('rete', 'collegamento a ' + net.code + (net.retries ? ' (tentativo ' + (net.retries + 1) + ')' : ''));
    try { ws = new WebSocket(proto + '://' + location.host + '/api/room/' + net.code); }
    catch (e) { diag.log('rete', 'WebSocket non creato: ' + e.message); setBanner(tr('errServer')); return; }
    net.ws = ws;
    ws.onopen = () => {
      net.retries = 0; setBanner('');
      ws.send(JSON.stringify({ t: 'hello', id: myId, name: inName.value.trim() || 'Rider', j: myJersey(), sc: selScena.value }));
      clearInterval(net.pingTimer);
      net.pingAt = Date.now(); ws.send('ping');
      net.pingTimer = setInterval(() => { if (ws.readyState === 1) { net.pingAt = Date.now(); ws.send('ping'); } }, 20000);
      diag.log('rete', 'aperta');
    };
    ws.onmessage = ev => {
      if (ev.data === 'pong') { net.ping = Date.now() - net.pingAt; return; }
      let m; try { m = JSON.parse(ev.data); } catch (e) { diag.log('rete', 'messaggio non leggibile'); return; }
      net.msgs++;
      if (m.t !== 'pos' && m.t !== 'state') diag.log('rete', '← ' + m.t + (m.phase ? ' ' + m.phase : ''));
      onMsg(m);
    };
    ws.onclose = ev => {
      if (net.ws !== ws) return;
      diag.log('rete', 'chiusa, codice ' + ev.code + (ev.reason ? ' ' + ev.reason : ''));
      clearInterval(net.pingTimer);
      if (!net.want) return;
      if (ev.code === 1008) {
        // sala pubblica piena: se ne cerca un'altra
        if (net.pub) { net.want = false; $('btnOnline').click(); return; }
        net.want = false; toMenu(); menuError(tr('errFull')); return;
      }
      if (ev.code === 4000) { net.want = false; toMenu(); menuError(tr('errOtherTab')); return; }
      if (net.retries < 6) {
        net.retries++;
        setBanner(tr('reconnecting'));
        setTimeout(() => { if (net.want) open(); }, 1000 * net.retries);
      } else { setBanner(tr('cantConnect', { code: net.code })); }
    };
  }

  function amIn(list) { return list.some(r => r.id === myId); }
  function onMsg(m) {
    if (m.t === 'welcome') {
      net.offset = m.now - Date.now();
      voice.next = m.voiceNext || 0;
      net.phase = m.phase; net.seed = m.seed; net.startAt = m.startAt; net.racers = m.racers || []; net.results = m.results || [];
      net.gatherUntil = m.gatherUntil || 0; net.loaded = m.loaded || [];
      net.pub = !!m.pub; net.minutes = m.minutes || 5; net.awards = m.awards || null; net.scena = m.scena || 'neve';
      raceLen = m.length || raceLen;
      if ((m.phase === 'countdown' || m.phase === 'racing') && amIn(net.racers) && !racing()) beginRace(true);
      renderLobby();
    } else if (m.t === 'lobby') {
      if (m.now) net.offset = m.now - Date.now();
      net.players = m.players; net.hostId = m.hostId; net.phase = m.phase;
      net.pub = !!m.pub; net.minutes = m.minutes || 5; net.autoAt = m.autoAt || 0;
      if (!racing()) raceLen = m.length || raceLen;
      // in attesa si vede già la città (e la pista) della prossima gara
      net.roomScena = m.scena || 'neve';
      if ((mode === 'lobby' || mode === 'results') && net.roomScena !== theme) { applyTheme(net.roomScena, true); reset((Math.random() * 2 ** 31) | 0, null, false); }
      const mine = m.players.find(p => p.id === myId);
      if (mine) { net.myColor = mine.color; if (!racing()) me.setColor(PALETTE[mine.color % PALETTE.length], myJersey()); }
      renderLobby();
      if (mode === 'results') renderResults();
    } else if (m.t === 'countdown') {
      net.offset = m.now - Date.now();
      net.phase = 'countdown'; net.seed = m.seed; net.startAt = m.startAt; net.racers = m.racers; net.round = m.round; net.results = []; net.finished = new Map(); net.scena = m.scena || 'neve';
      net.gatherUntil = m.gatherUntil || 0; net.loaded = m.loaded || [];
      raceLen = m.length || raceLen;
      if (amIn(net.racers)) beginRace(false);
      else renderLobby();
    } else if (m.t === 'racers') {
      // un nuovo concorrente entrato a gara avviata: compare in pista e in classifica
      net.racers = m.racers || net.racers;
      if (racing()) { const slot = Math.max(0, net.racers.findIndex(r => r.id === myId)); for (const r of net.racers) if (r.id !== myId) remoteFor(r.id, r, slot); }
    } else if (m.t === 'gather') {
      net.loaded = m.loaded || []; net.gatherUntil = m.gatherUntil || net.gatherUntil;
    } else if (m.t === 'go') {
      // tutti dentro (o 40 s passati): parte il conto alla rovescia di 5 s
      net.offset = m.now - Date.now();
      net.startAt = m.startAt; net.loaded = m.loaded || net.loaded; net.gatherUntil = 0;
      setBanner('');
    } else if (m.t === 'pos') {
      remoteUpdate(m);
    } else if (m.t === 'finished') {
      net.finished.set(m.id, m.ms);
      const who = (net.racers.find(r => r.id === m.id) || {}).name || tr('someone');
      if (m.id === myId) {
        say(m.ms != null ? tr('arrived', { t: fmtTime(m.ms) }) : tr('invalidTime'), '#1f8a4c');
      } else if (racing()) {
        say(m.ms != null ? tr('otherArrivedTime', { n: who, t: fmtTime(m.ms) }) : tr('otherArrived', { n: who }), '#13233a');
      }
    } else if (m.t === 'results') {
      net.results = m.results; net.phase = 'results'; net.awards = m.awards || null;
      const mine = m.results.find(r => r.id === myId);
      if (mine && mine.total != null) { myTotal = mine.total; renderMyPts(); }
      endRaceView();
    } else if (m.t === 'left') {
      removeRemote(m.id);
    } else if (m.t === 'full') {
      menuError(tr('errFull'));
    } else if (m.t === 'voice') {
      playVoice(m);
    } else if (m.t === 'voiceOk') {
      voice.next = m.next;
      say(tr('voiceSent'), '#1f8a4c');
    } else if (m.t === 'voiceWait') {
      voice.next = m.next;
      say(tr('voiceWait', { t: fmtWait(m.next - m.now) }), '#13233a');
    } else if (m.t === 'reported') {
      say(tr('reportedToast'), '#1f8a4c');
    } else if (m.t === 'voiceBlocked') {
      say(tr('voiceBlocked'), '#d8302a');
    } else if (m.t === 'drop') {
      // anche se questo dispositivo è ancora al conto alla rovescia (telefoni lenti): la gara è già partita sul server
      if (racing()) addHazard({ hid: m.hid, owner: m.id, kind: m.kind, x: m.x, z: m.z });
    } else if (m.t === 'hit') {
      removeHazard(m.hid);
      if (m.owner === myId) say(tr(m.kind === 'bomb' ? 'hitYourBomb' : 'hitYourBanana', { n: m.name || tr('someone') }), '#ff5a1f');
    }
  }

  function renderLobby() {
    const pub = net.pub;
    $('lobbyShare').hidden = pub;
    $('lobbyPublic').hidden = !pub;
    $('lobbyBrand').textContent = pub ? tr('onlineBrand') : tr('lobbyBrand');
    $('lobbyCode').textContent = net.code || '—';
    const link = location.origin + location.pathname + '?sfida=' + (net.code || '');
    $('linkText').textContent = link;
    $('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent(tr('shareMsg', { code: net.code || '', link }));
    $('shareTg').href = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(tr('shareMsg2', { code: net.code || '' }));
    const ul = $('lobbyPlayers');
    ul.innerHTML = '';
    for (const p of net.players) {
      const li = document.createElement('li');
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[p.color % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = p.name + (p.id === myId ? tr('you') : '');
      li.append(dot, nm);
      if (!pub && p.id === net.hostId) { const h = document.createElement('span'); h.className = 'pill host'; h.textContent = tr('host'); li.append(h); }
      const r = document.createElement('span'); r.className = 'pill' + (p.ready ? ' ok' : ''); r.textContent = p.ready ? tr('ready') : tr('waiting');
      li.append(r);
      ul.append(li);
    }
    const isHost = !pub && net.hostId === myId;
    // durata della gara: la sceglie chi organizza (nelle sale pubbliche è sempre 5 minuti)
    $('durBox').hidden = pub;
    document.querySelectorAll('[data-min]').forEach(b => {
      b.setAttribute('aria-pressed', String(+b.dataset.min === net.minutes));
      b.disabled = !isHost;
    });
    $('durLabel').textContent = tr('durationLabel') + (isHost ? '' : ' · ' + tr('durationHost'));
    // città della gara: la sceglie chi organizza; gli altri la vedono e basta
    const rc = $('selRoomCity');
    if (rc.options.length !== selScena.options.length) rc.innerHTML = selScena.innerHTML;
    for (let i = 0; i < rc.options.length; i++) rc.options[i].textContent = selScena.options[i].textContent;
    rc.value = net.roomScena || selScena.value;
    rc.disabled = !isHost;
    const rj = $('selRoomJersey');
    if (rj.options.length !== selJersey.options.length) rj.innerHTML = selJersey.innerHTML;
    for (let i = 0; i < rj.options.length; i++) rj.options[i].textContent = selJersey.options[i].textContent;
    rj.value = myJersey();
    $('cityLabel').textContent = tr('raceCity') + (isHost ? '' : ' · ' + tr(pub ? 'raceCityPub' : 'raceCityHost'));
    const mine = net.players.find(p => p.id === myId);
    $('btnReady').textContent = mine && mine.ready ? tr('notReady') : tr('imReady');
    $('btnGo').hidden = !isHost;
    const busy = net.phase === 'countdown' || net.phase === 'racing';
    $('btnGo').disabled = busy;
    $('btnLeave').textContent = pub ? tr('leaveOnline') : tr('leaveChallenge');
    renderLobbyStatus();
  }
  function renderLobbyStatus() {
    const n = net.players.length, ready = net.players.filter(p => p.ready).length;
    const busy = net.phase === 'countdown' || net.phase === 'racing';
    const isHost = !net.pub && net.hostId === myId;
    let status;
    if (!net.ws || net.ws.readyState !== 1) status = tr('connecting');
    else if (busy && !amIn(net.racers)) status = tr('raceRunning');
    else if (net.pub) {
      const left = net.autoAt ? Math.max(0, Math.ceil((net.autoAt - serverNow()) / 1000)) : 0;
      status = n < 2 ? tr('pubWaiting') : (left ? tr('pubStartsIn', { n, s: left }) : tr('pubStarting', { n }));
    }
    else if (n < 2) status = tr('shareLink');
    else status = tr('lobbyCount', { n, r: ready }) + ' ' + (isHost ? tr('pressGo') : tr('waitHost'));
    $('lobbyStatus').textContent = status;
  }
  // il conto alla rovescia delle sale pubbliche si aggiorna da solo
  setInterval(() => {
    if (!net.pub) return;
    if (mode === 'lobby') renderLobbyStatus();
    else if (mode === 'results') renderResultsStatus();
  }, 500);
  document.querySelectorAll('[data-min]').forEach(b => b.addEventListener('click', () => net.send({ t: 'settings', minutes: +b.dataset.min })));
  // maglia: la sceglie ognuno anche dentro la stanza (chi arriva dal link non passa dal menu)
  $('selRoomJersey').addEventListener('change', () => {
    selJersey.value = $('selRoomJersey').value;
    selJersey.dispatchEvent(new Event('change'));
    net.send({ t: 'jersey', j: myJersey() });
  });
  $('selRoomCity').addEventListener('change', () => {
    selScena.value = $('selRoomCity').value;
    selScena.dispatchEvent(new Event('change'));
  });
  $('btnReady').addEventListener('click', () => {
    const mine = net.players.find(p => p.id === myId);
    net.send({ t: 'ready', ready: !(mine && mine.ready) });
  });
  $('btnGo').addEventListener('click', () => net.send({ t: 'start' }));
  $('btnRematch').addEventListener('click', () => net.send({ t: 'start' }));
  $('btnCopy').addEventListener('click', async () => {
    const link = $('linkText').textContent;
    try { await navigator.clipboard.writeText(link); $('btnCopy').textContent = tr('linkCopied'); setTimeout(() => ($('btnCopy').textContent = tr('copyLink')), 1800); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('linkText')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('btnCopy').textContent = tr('copyManual'); }
  });
  $('btnLeave').addEventListener('click', toMenu);
  $('btnResLeave').addEventListener('click', toMenu);
  const CITY_LABEL = { neve: 'snow', napoli: 'naples', roma: 'rome', milano: 'milan', parigi: 'paris', londra: 'london', francoforte: 'frankfurt', madrid: 'madrid', lisbona: 'lisbon', zagabria: 'zagreb', berlino: 'berlin', zurigo: 'zurich', newyork: 'newyorkCity' };
  $('btnShareRes').addEventListener('click', async () => {
    const i = net.results.findIndex(r => r.id === myId);
    const mine = i >= 0 ? net.results[i] : null;
    const link = location.origin + location.pathname;
    // sulla neve non c'è una città: "arrivato 1° a Neve" non ha senso
    const txt = tr(theme === 'neve' ? 'shareResultSnow' : 'shareResult', {
      p: mine && mine.ms != null ? ord(i + 1) : '…',
      city: tr(CITY_LABEL[theme] || 'snow'),
      t: mine && mine.ms != null ? fmtTime(mine.ms) : '—',
      link
    });
    try { if (navigator.share) { await navigator.share({ text: txt }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  });

  function toMenu() {
    net.close();
    history.replaceState(null, '', location.pathname);
    mode = 'menu';
    me.setColor(PALETTE[0], myJersey());
    if (theme !== selScena.value) applyTheme(selScena.value);   // dopo una sfida in un'altra città si torna alla propria
    reset((Math.random() * 2 ** 31) | 0, null, false);
    hudLabels();
    setBanner('');
    show('menu');
    loadBoard();
    loadMe();
  }

  function beginRace(late) {
    initAudio();
    applyTheme(net.scena || 'neve', true);   // la città della gara, uguale per tutti: prima di center(0), che dipende dalla pista
    const slot = Math.max(0, net.racers.findIndex(r => r.id === myId));
    const n = net.racers.length;
    const x0 = center(0) + (slot - (n - 1) / 2) * 2.6;
    mode = 'countdown';
    me.setColor(PALETTE[net.myColor % PALETTE.length], myJersey());
    reset(net.seed, x0, true);
    hudLabels();
    show(null);
    setBanner('');
    for (const r of net.racers) if (r.id !== myId) remoteFor(r.id, r, slot);
    lastCount = -1;
    // pronto: lo si dice al server dopo due fotogrammi disegnati (il telefono ha davvero caricato la pista)
    requestAnimationFrame(() => requestAnimationFrame(() => net.send({ t: 'loaded' })));
    if (net.startAt) say(tr('lateStart'), '#d8302a');   // gli altri hanno già il conto alla rovescia o sono partiti: si parte svantaggiati
    if (late && net.startAt && serverNow() > net.startAt) {
      // rientro durante la gara: si riparte dal via, il tempo corre già
      mode = 'race';
    }
    say(tr('raceLength', { m: net.minutes || 5, d: fmtLen(raceLen) }), '#13233a');
    clearInterval(net.posTimer);
    net.posTimer = setInterval(() => {
      if (!racing()) return;
      net.send({ t: 'pos', x: +P.x.toFixed(2), z: +P.z.toFixed(2), y: +P.y.toFixed(2), a: +P.ang.toFixed(3), s: +P.spin.toFixed(2), f: +P.flip.toFixed(2), g: P.grab > 0.5 ? 1 : 0, v: +P.speed.toFixed(2), c: P.crash > 0 ? 1 : 0, k: +(tuckS - brakeS).toFixed(2), ...myStats() });
    }, 100);
  }
  const myStats = () => ({ top: +maxSpeed.toFixed(1), tk: tricksN, p: Math.max(0, Math.round(bonus)) });
  let lastCount = -1;
  function raceClock() {
    const cnt = $('count');
    if (mode === 'countdown' && !net.startAt) {
      // attesa prima del via (R-119). Sfida: sempre 40 s, così chi ha l'invito fa in tempo a entrare.
      // Sala online: il conto alla rovescia parte quando tutti hanno caricato la gara, al massimo dopo 40 s.
      const s = Math.max(0, Math.ceil((net.gatherUntil - serverNow()) / 1000));
      const txt = net.pub ? tr('gatherWait', { n: net.loaded.length, t: net.racers.length, s }) : tr('gatherFixed', { t: net.racers.length, s });
      if (net.gatherTxt !== txt) { net.gatherTxt = txt; setBanner(txt); banner.classList.add('wait'); }
      cnt.hidden = true;
    } else if (mode === 'countdown') {
      if (net.gatherTxt) { net.gatherTxt = ''; setBanner(''); banner.classList.remove('wait'); }
      const left = net.startAt - serverNow();
      if (left <= 0) {
        mode = 'race';
        cnt.hidden = false; cnt.innerHTML = '<span>' + tr('go') + '</span>';
        beep(true);
        setTimeout(() => { if (mode !== 'countdown') cnt.hidden = true; }, 800);
      } else {
        const n = Math.ceil(left / 1000);
        if (n !== lastCount) { lastCount = n; cnt.hidden = false; cnt.innerHTML = '<span>' + n + '</span>'; if (n <= 3) beep(false); }
      }
    }
    if (mode === 'race' && !near500 && raceLen - distM() < 500) { near500 = true; say(tr('finishNear'), '#1f8a4c'); }
    if (mode === 'race' && -P.z >= raceLen) {
      mode = 'finished';
      net.send({ t: 'finish', ...myStats() });
      say(tr('finishLine'), '#1f8a4c');
      setBanner(tr('waitOthers'));
    }
  }
  function endRaceView() {
    clearInterval(net.posTimer);
    $('count').hidden = true;
    setBanner('');
    mode = 'results';
    hideRemotes();
    clearHazards();
    hudLabels();
    renderResults();
    show('raceResults');
  }
  function renderResults() {
    $('resRound').textContent = (net.pub ? tr('onlineBrand') : tr('challenge') + ' ' + (net.code || '')) + ' · ' + tr('raceN', { n: net.round || 1 }) + ' · ' + (net.minutes || 5) + ' min';
    const ul = $('resList');
    ul.innerHTML = '';
    net.results.forEach((r, i) => {
      const li = document.createElement('li');
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = r.ms != null ? (i === 0 ? '🏆' : ord(i + 1)) : '–';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[(r.color || 0) % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = r.name + (r.id === myId ? tr('you') : '');
      const tm = document.createElement('span'); tm.className = r.ms != null ? 'time' : 'time dnf'; tm.textContent = r.ms != null ? fmtTime(r.ms) : tr('dnf');
      li.append(pos, dot, nm, tm);
      if (r.earned != null) { const e = document.createElement('span'); e.className = 'earned'; e.textContent = '+' + fmt(r.earned); li.append(e); }
      ul.append(li);
    });
    // premi: chi ha toccato la velocità più alta e chi ha fatto più acrobazie
    const aw = $('awards');
    aw.innerHTML = '';
    const award = (label, a, value) => {
      if (!a) return;
      const d = document.createElement('div');
      const k = document.createElement('span'); k.className = 'k'; k.textContent = label;
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[(a.color || 0) % PALETTE.length];
      const n = document.createElement('span'); n.textContent = a.name + (a.id === myId ? tr('you') : '');
      const v = document.createElement('b'); v.textContent = value; v.style.marginLeft = 'auto';
      d.append(k, dot, n, v);
      aw.append(d);
    };
    const A = net.awards || {};
    if (A.fastest && A.fastest.top > 0) award('⚡ ' + tr('awardSpeed'), A.fastest, Math.round(kmh(A.fastest.top)) + ' km/h');
    if (A.tricks && A.tricks.tk > 0) award('🤸 ' + tr('awardTricks'), A.tricks, String(A.tricks.tk));
    aw.hidden = !aw.children.length;
    const mine = net.results.find(r => r.id === myId);
    $('resMine').hidden = !mine || mine.earned == null;
    if (mine && mine.earned != null) $('resMine').innerHTML = tr('earnedLine', { e: '<span>' + fmt(mine.earned) + '</span>', t: fmt(mine.total ?? myTotal) });
    const isHost = !net.pub && net.hostId === myId;
    $('btnRematch').hidden = !isHost;
    renderResultsStatus();
  }
  function renderResultsStatus() {
    let txt;
    if (net.pub) {
      const left = net.autoAt ? Math.max(0, Math.ceil((net.autoAt - serverNow()) / 1000)) : 0;
      txt = net.players.length < 2 ? tr('pubWaiting') : (left ? tr('nextRaceIn', { s: left }) : tr('pubStarting', { n: net.players.length }));
    } else {
      const isHost = net.hostId === myId;
      const host = net.players.find(p => p.id === net.hostId);
      txt = isHost ? tr('rematchHint') : tr('waitRematch', { n: host ? host.name : tr('hostName') });
    }
    $('resStatus').textContent = txt;
  }

  // ---------- punti collezionati (li tiene il server, legati a questo dispositivo) ----------
  let myTotal = +(store.get('cyf.points') || 0);
  function renderMyPts() {
    store.set('cyf.points', String(myTotal));
    const el = $('myPts');
    el.hidden = false;
    el.innerHTML = tr('myPoints', { p: '<span>' + fmt(myTotal) + '</span>' });
  }
  async function loadMe() {
    try {
      const res = await fetch('/api/me?id=' + encodeURIComponent(myId), { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const d = await res.json();
      myTotal = d.points || 0;
    } catch (e) {}
    renderMyPts();
  }

  // ---------- messaggi vocali (solo in sfida, uno ogni 3 minuti: il limite lo controlla il server) ----------
  const VOICE_MAX_S = 8;
  const voice = { stream: null, nodes: null, chunks: [], recording: false, startT: 0, timer: null, next: 0, rate: 0, ownAc: null };
  const btnVoice = $('btnVoice'), voiceNow = $('voiceNow'), voiceLbl = $('voiceLbl');
  const online = () => !!(net.ws && net.ws.readyState === 1) && (mode === 'lobby' || mode === 'results' || racing());
  const fmtWait = ms => { const s2 = Math.ceil(ms / 1000); return Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0'); };
  function updateVoiceBtn() {
    const on = online();
    // si vede sempre mentre si gioca; in allenamento è spento e spiega che i vocali sono per le sfide
    const solo = !on && (mode === 'solo' || mode === 'pause');
    btnVoice.hidden = !on && !solo;
    btnVoice.classList.toggle('solo', solo);
    if (solo) { btnVoice.disabled = false; voiceLbl.textContent = tr('voiceTalk'); return; }
    if (!on) return;
    const wait = voice.next - serverNow();
    btnVoice.classList.toggle('rec', voice.recording);
    if (voice.recording) {
      voiceLbl.textContent = tr('voiceSend') + ' ' + Math.max(0, Math.ceil(VOICE_MAX_S - (performance.now() - voice.startT) / 1000));
      btnVoice.disabled = false;
    } else if (wait > 0) {
      voiceLbl.textContent = fmtWait(wait);
      btnVoice.disabled = true;
    } else {
      voiceLbl.textContent = isPhone ? tr('voiceTalk') : tr('voiceTalk') + ' (V)';
      btnVoice.disabled = false;
    }
  }
  setInterval(updateVoiceBtn, 250);
  btnVoice.addEventListener('click', () => voiceButton());
  $('btnMute').addEventListener('click', () => {
    if (!voiceFrom) return;
    mutedIds.add(voiceFrom.id);
    store.set('cyf.muted', JSON.stringify([...mutedIds].slice(-50)));
    stopPlaying();
    say(tr('mutedToast', { n: voiceFrom.name }), '#13233a');
  });
  $('btnReport').addEventListener('click', () => {
    if (!voiceFrom) return;
    net.send({ t: 'reportVoice', id: voiceFrom.id });
  });
  // Registrazione con Web Audio invece di MediaRecorder: funziona su tutti i telefoni (anche dove MediaRecorder manca,
  // come in certe app con browser interno, o registra in un formato che gli altri telefoni non sanno riprodurre).
  // I campioni del microfono vengono ridotti a un quarto della frequenza (11-12 kHz, più che sufficiente per la voce)
  // e inviati come WAV, che ogni browser sa decodificare.
  function voiceContext() {
    initAudio();
    if (audio && audio.ac) return audio.ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { voice.ownAc = voice.ownAc || new AC(); } catch (e) { return null; }
    return voice.ownAc;
  }
  async function voiceButton() {
    if (!online()) { if (mode === 'solo' || mode === 'pause') say(tr('voiceOnlyChallenge'), '#13233a'); return; }
    if (voice.recording) { stopVoice(); return; }
    const wait = voice.next - serverNow();
    if (wait > 0) { say(tr('voiceWait', { t: fmtWait(wait) }), '#13233a'); return; }
    const md = navigator.mediaDevices;
    const ac = voiceContext();
    if (!md || !md.getUserMedia || !ac || !ac.createScriptProcessor) { say(tr('voiceNoRec'), '#d8302a'); return; }
    let stream;
    try { stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { say(tr('voiceNoMic'), '#d8302a'); return; }
    if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) {} }
    let nodes;
    try {
      const src = ac.createMediaStreamSource(stream);
      const proc = ac.createScriptProcessor(4096, 1, 1);
      const sink = ac.createGain(); sink.gain.value = 0;   // il processore deve stare collegato all'uscita, ma non si deve sentire
      proc.onaudioprocess = e => { if (voice.recording) voice.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(sink); sink.connect(ac.destination);
      nodes = { src, proc, sink };
    } catch (e) { stream.getTracks().forEach(t => t.stop()); say(tr('voiceNoRec'), '#d8302a'); return; }
    voice.stream = stream; voice.nodes = nodes; voice.chunks = []; voice.rate = ac.sampleRate;
    voice.recording = true;
    voice.startT = performance.now();
    voice.timer = setTimeout(stopVoice, VOICE_MAX_S * 1000);
    updateVoiceBtn();
  }
  function stopVoice(cancel) {
    clearTimeout(voice.timer);
    const was = voice.recording;
    voice.recording = false;
    if (voice.nodes) { for (const n of Object.values(voice.nodes)) { try { n.disconnect(); } catch (e) {} } voice.nodes = null; }
    if (voice.stream) voice.stream.getTracks().forEach(t => t.stop());
    voice.stream = null;
    if (was && !cancel) sendVoice();
    voice.chunks = [];
    updateVoiceBtn();
  }
  // WAV mono a 16 bit; ogni campione in uscita è la media di 4 campioni del microfono (filtro semplice contro l'aliasing)
  function wavFromChunks(chunks, rate) {
    const n = chunks.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(n); let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.length; }
    const DEC = 4, outRate = Math.round(rate / DEC), len = Math.floor(n / DEC);
    const buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf);
    const str = (p, t) => { for (let i = 0; i < t.length; i++) v.setUint8(p + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) {
      let x = 0;
      for (let k = 0; k < DEC; k++) x += all[i * DEC + k];
      x = Math.max(-1, Math.min(1, x / DEC));
      v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true);
    }
    return { buf, dur: len / outRate };
  }
  function sendVoice() {
    const { buf, dur } = wavFromChunks(voice.chunks, voice.rate || 48000);
    if (dur < 0.5) return;
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    const data = btoa(bin);
    if (data.length > 300000) { say(tr('voiceTooLong'), '#d8302a'); return; }
    net.send({ t: 'voice', mime: 'audio/wav', data, dur: Math.round(dur * 10) / 10 });
  }
  let voicePlaying = null, voiceFrom = null;
  function stopPlaying() { if (voicePlaying) { try { voicePlaying.stop(); } catch (e) {} voicePlaying = null; } voiceNow.hidden = true; }
  // giocatori silenziati su questo dispositivo (resta anche dopo la chiusura)
  const mutedIds = new Set((() => { try { return JSON.parse(store.get('cyf.muted') || '[]'); } catch (e) { return []; } })());
  function playVoice(m) {
    const who = m.name || tr('someone');
    if (mutedIds.has(m.id)) return;
    voiceFrom = { id: m.id, name: who };
    if (muted) { say(tr('voiceMuted', { n: who }), '#13233a'); return; }
    let bytes;
    try { const bin = atob(m.data); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); }
    catch (e) { return; }
    const show = () => { voiceNow.hidden = false; voiceNow.querySelector('b').textContent = who; voiceNow.querySelector('i').style.background = PALETTE[(m.color || 0) % PALETTE.length]; };
    const hide = () => { voiceNow.hidden = true; voicePlaying = null; };
    const bad = () => { hide(); say(tr('voiceBadFormat', { n: who }), '#d8302a'); };
    stopPlaying();
    // 2) elemento audio classico: ripiego se il contesto audio non è disponibile o non decodifica il formato
    const viaAudioTag = () => {
      let url;
      try { url = URL.createObjectURL(new Blob([bytes], { type: m.mime || 'audio/wav' })); } catch (e) { bad(); return; }
      const a = new Audio(url); a.volume = 1;
      const me2 = { stop() { try { a.pause(); } catch (e) {} URL.revokeObjectURL(url); } };
      a.onended = () => { URL.revokeObjectURL(url); if (voicePlaying === me2) hide(); };
      a.onerror = () => { URL.revokeObjectURL(url); if (voicePlaying === me2) bad(); };
      voicePlaying = me2; show();
      a.play().catch(() => { if (voicePlaying === me2) bad(); });
    };
    // 1) Web Audio: suona anche senza un tocco recente (il contesto è già sbloccato dal gioco) e decodifica il WAV su ogni telefono
    const ac = voiceContext();
    if (ac && ac.state === 'running' && ac.decodeAudioData) {
      try {
        const dec = ac.decodeAudioData(bytes.buffer.slice(0), buffer => {
          const srcN = ac.createBufferSource(); srcN.buffer = buffer;
          srcN.connect(ac.destination);
          const me2 = { stop() { try { srcN.stop(); } catch (e) {} } };
          srcN.onended = () => { if (voicePlaying === me2) hide(); };
          voicePlaying = me2; show();
          srcN.start();
        }, () => viaAudioTag());
        // decodeAudioData restituisce anche una promessa: se il formato non si decodifica va a vuoto senza "errore non gestito" sul telefono
        if (dec && dec.catch) dec.catch(() => {});
      } catch (e) { viaAudioTag(); }
    } else viaAudioTag();
  }

  // ---------- donazioni ----------
  const DONATE_URL = (window.CYF && window.CYF.donateUrl) || '';
  document.querySelectorAll('[data-donate]').forEach(a => { if (DONATE_URL) { a.href = DONATE_URL; a.hidden = false; } });

  // ---------- banane e bombe: si pagano con i punti della gara e fanno cadere gli altri ----------
  const COST = { banana: 50, bomb: 150 };
  const HAZ_GEO = {
    // buccia di banana: arco giallo con le punte scure, appoggiato sulla pista
    banana: merge([
      { geo: new THREE.TorusGeometry(0.34, 0.085, 10, 18, 2.0).rotateZ(Math.PI / 2 - 1.0).rotateX(Math.PI / 2), color: '#f4d03f', y: 0.09 },
      { geo: new THREE.TorusGeometry(0.34, 0.06, 8, 18, 2.0).rotateZ(Math.PI / 2 - 1.0).rotateX(Math.PI / 2), color: '#e5b822', y: 0.15 },
      { geo: new THREE.SphereGeometry(0.06, 8, 6), color: '#5a3d1e', x: 0.34 * Math.cos(Math.PI / 2 - 1.0), y: 0.1, z: -0.34 * Math.sin(Math.PI / 2 - 1.0) },
      { geo: new THREE.CylinderGeometry(0.03, 0.04, 0.16, 6), color: '#6b4a24', x: 0.34 * Math.cos(Math.PI / 2 + 1.0), y: 0.12, z: -0.34 * Math.sin(Math.PI / 2 + 1.0) }
    ]),
    bomb: merge([
      { geo: new THREE.SphereGeometry(0.42, 20, 14), color: '#1d1f24', y: 0.42 },
      { geo: new THREE.CylinderGeometry(0.13, 0.15, 0.14, 12), color: '#3a3d44', y: 0.86 },
      { geo: new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), color: '#c9b48a', y: 1.05, x: 0.04 }
    ])
  };
  HAZ_GEO.banana.scale(1.7, 1.7, 1.7);
  const sparkMat = new THREE.MeshBasicMaterial({ color: lin('#ff3b1f') });
  const sparkGeo = new THREE.SphereGeometry(0.08, 8, 6);
  const hazards = new Map();
  let hazN = 0;
  function addHazard(h, from) {
    if (hazards.has(h.hid)) return;
    const mesh = addMesh(HAZ_GEO[h.kind], vcMat, h.x, h.z, { ry: Math.random() * TAU });
    if (h.kind === 'bomb') { const sp = new THREE.Mesh(sparkGeo, sparkMat); sp.position.set(0.04, 1.2, 0); mesh.add(sp); h.spark = sp; }
    h.mesh = mesh;
    h.t = 0;
    // lancio: vola dal rider al punto scelto
    if (from) { h.fly = { x0: from.x, z0: from.z, y0: from.y, dur: 0.55 }; h.armed = false; }
    else h.armed = true;
    hazards.set(h.hid, h);
    placeHazard(h);
  }
  function placeHazard(h) {
    if (h.fly && h.t < h.fly.dur) {
      const k = h.t / h.fly.dur;
      const x = h.fly.x0 + (h.x - h.fly.x0) * k, z = h.fly.z0 + (h.z - h.fly.z0) * k;
      h.mesh.position.set(x, hgt(x, z) + h.fly.y0 * (1 - k) + Math.sin(k * Math.PI) * 4, z);
      h.mesh.rotation.y += 0.4;
    } else {
      h.mesh.position.set(h.x, hgt(h.x, h.z), h.z);
      h.armed = true;
    }
  }
  function removeHazard(hid) {
    const h = hazards.get(hid);
    if (!h) return;
    world.remove(h.mesh);
    hazards.delete(hid);
  }
  function clearHazards() { for (const hid of [...hazards.keys()]) removeHazard(hid); }
  function updateHazards(dt) {
    for (const [, h] of hazards) {
      h.t += dt;
      if (h.fly) placeHazard(h);
      if (h.spark) h.spark.visible = Math.floor(h.t * 4) % 2 === 0;
    }
  }
  function collideHazards() {
    if (invuln > 0 || P.crash > 0) return;
    for (const [hid, h] of hazards) {
      if (!h.armed || h.owner === myId) continue;
      const dx = h.x - P.x, dz = h.z - P.z, d2 = dx * dx + dz * dz;
      const hit = h.kind === 'bomb' ? (d2 < 2.4 * 2.4 && P.y < 1.6) : (d2 < 1.0 && P.y < 0.7);
      if (!hit) continue;
      if (h.kind === 'bomb') { spray(h.x, 0.5, h.z, 90, 7, 8); sparkle(h.x, hgt(h.x, h.z) + 0.6, h.z, 80, true); thump(2); }
      removeHazard(hid);
      net.send({ t: 'hit', hid, owner: h.owner, kind: h.kind });
      crash(tr(h.kind === 'bomb' ? 'crashBomb' : 'crashBanana'));
      return;
    }
  }
  // lascia l'oggetto dietro di sé, oppure lo lancia nel punto indicato (solo banane)
  function useItem(kind, target) {
    if (mode !== 'race' || !net.ws) { if (mode === 'solo') say(tr('itemsRaceOnly'), '#13233a'); return; }
    if (bonus < COST[kind]) { say(tr('needPoints', { p: COST[kind] }), '#d8302a'); return; }
    if (performance.now() - (useItem.last || 0) < 950) return;
    useItem.last = performance.now();
    bonus -= COST[kind];
    const hid = myId + '-' + net.round + '-' + (++hazN);
    let x = P.x - Math.sin(P.ang) * 3, z = P.z + Math.cos(P.ang) * 3;
    if (target) { x = target.x; z = target.z; }
    addHazard({ hid, owner: myId, kind, x, z }, target ? { x: P.x, z: P.z, y: P.y + 1 } : null);
    net.send({ t: 'drop', kind, x: +x.toFixed(2), z: +z.toFixed(2), hid });
    say(tr(kind === 'bomb' ? 'bombDropped' : (target ? 'bananaThrown' : 'bananaDropped')) + '  −' + COST[kind], '#8a6d3b');
  }
  $('btnBanana').addEventListener('click', () => useItem('banana'));
  $('btnBomb').addEventListener('click', () => useItem('bomb'));
  // doppio clic (o doppio tocco) sulla pista: la banana vola nel punto indicato, sempre davanti al rider
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let lastTap = { t: 0, x: 0, y: 0 };
  cvs.addEventListener('pointerdown', e => {
    const now = performance.now();
    const dbl = now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40;
    lastTap = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
    if (!dbl || mode !== 'race') return;
    const r = cvs.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(ground)[0];
    let x, z;
    if (hit) { const p = world.worldToLocal(hit.point.clone()); x = p.x; z = p.z; }
    else { z = P.z - 45; x = P.x + ndc.x * 14; }
    z = clamp(z, P.z - 70, P.z - 8);
    const c = center(z);
    x = clamp(x, c - 19, c + 19);
    useItem('banana', { x, z });
  });

  // ---------- remote riders ----------
  const remotes = new Map();
  function nameSprite(text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '700 36px "Barlow Condensed", Arial, sans-serif';
    const w = Math.min(250, g.measureText(text).width + 52);
    const x0 = (256 - w) / 2;
    g.fillStyle = 'rgba(12,24,40,0.72)';
    g.beginPath();
    if (g.roundRect) g.roundRect(x0, 8, w, 48, 12); else g.rect(x0, 8, w, 48);
    g.fill();
    g.fillStyle = color; g.beginPath(); g.arc(x0 + 20, 32, 7, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.fillText(text, x0 + 36, 34);
    const t2 = new THREE.CanvasTexture(c); t2.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t2, depthWrite: false, transparent: true }));
    sp.scale.set(2.4, 0.6, 1);
    return sp;
  }
  function remoteFor(id, info, mySlot) {
    let r = remotes.get(id);
    if (!r) {
      const color = PALETTE[(info.color || 0) % PALETTE.length];
      const model = makeRider(color);
      model.setColor(color, JERSEYS[info.j] ? info.j : '');
      model.setBoard(isCity() ? 'skate' : 'snow');
      const label = nameSprite(info.name || 'Rider', color);
      label.position.y = 2.3;
      model.group.add(label);
      world.add(model.group);
      r = { model, x: 0, z: 0, y: 0, a: 0, s: 0, tx: 0, tz: 0, ty: 0, ta: 0, v: 0, c: 0, last: 0, has: false };
      remotes.set(id, r);
    }
    const slot = net.racers.findIndex(x => x.id === id), n = net.racers.length;
    r.tx = r.x = center(0) + (slot - (n - 1) / 2) * 2.6; r.tz = r.z = 0; r.y = r.ty = 0; r.a = r.ta = 0; r.v = 0; r.has = true;
    r.model.group.visible = true;
    return r;
  }
  function remoteUpdate(m) {
    if (!racing()) return;
    const info = net.racers.find(x => x.id === m.id);
    if (!info) return;
    const r = remotes.get(m.id) || remoteFor(m.id, info);
    r.tx = m.x; r.tz = m.z; r.ty = m.y; r.ta = m.a; r.s = m.s; r.f = m.f || 0; r.g = m.g ? 1 : 0; r.v = m.v; r.c = m.c; r.k = m.k || 0; r.last = performance.now(); r.has = true;
  }
  function updateRemotes(dt) {
    const now = performance.now();
    for (const [, r] of remotes) {
      if (!r.has || !r.model.group.visible) continue;
      const age = Math.min(0.35, (now - r.last) / 1000);
      const px = r.tx + Math.sin(r.ta) * r.v * age, pz = r.tz - Math.cos(r.ta) * r.v * age;
      const k = Math.min(1, 10 * dt);
      r.x += (px - r.x) * k; r.z += (pz - r.z) * k; r.y += (r.ty - r.y) * k; r.a += (r.ta - r.a) * k;
      const g = r.model.group;
      g.position.set(r.x, hgt(r.x, r.z) + r.y, r.z);
      g.rotation.y = -r.a;
      r.gs = (r.gs || 0) + ((r.g || 0) - (r.gs || 0)) * Math.min(1, 9 * dt);
      bodyTurn(r.model.body, r.c ? (now / 120) % TAU : (r.f || 0), r.s, 0);
      r.ks = (r.ks || 0) + ((r.y > 0.3 ? 0 : (r.k || 0)) - (r.ks || 0)) * Math.min(1, 8 * dt);
      r.model.pose(Math.min(1, 0.35 + r.gs * 0.45 + Math.max(0, r.ks) * 0.55), r.y > 0.3 ? 1 : 0.3, 0, r.gs, Math.max(0, -r.ks), switchOf(r.s || 0));
    }
  }
  function hideRemotes() { for (const [, r] of remotes) r.model.group.visible = false; }
  function removeRemote(id) { const r = remotes.get(id); if (r) { world.remove(r.model.group); remotes.delete(id); } }
  function clearRemotes() { for (const id of [...remotes.keys()]) removeRemote(id); }

  function standings() {
    const list = net.racers.map(r => {
      const rm = r.id === myId ? null : remotes.get(r.id);
      return { id: r.id, name: r.name, color: r.id === myId ? net.myColor : r.color, d: r.id === myId ? -P.z : (rm ? -rm.tz : 0), ms: net.finished.get(r.id) };
    });
    list.sort((a, b) => {
      const fa = a.ms != null, fb = b.ms != null;
      if (fa && fb) return a.ms - b.ms;
      if (fa !== fb) return fa ? -1 : 1;
      return b.d - a.d;
    });
    return list;
  }
  function racePlace() {
    const list = standings();
    return { place: list.findIndex(x => x.id === myId) + 1, of: list.length, list };
  }
  // classifica dal vivo in alto a destra: posizione, nome e distacco dal primo (o il tempo, per chi è arrivato)
  function renderLive(list) {
    const ol = $('liveList');
    ol.innerHTML = '';
    const lead = list.find(x => x.ms == null);
    const leadD = list.length ? (list[0].ms != null ? raceLen : list[0].d) : 0;
    list.slice(0, 8).forEach((r, i) => {
      const li = document.createElement('li');
      if (r.id === myId) li.className = 'me';
      const pos = document.createElement('span'); pos.textContent = ord(i + 1);
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[(r.color || 0) % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name + (r.id === myId ? tr('you') : '');
      const gap = document.createElement('span'); gap.className = 'gap';
      gap.textContent = r.ms != null ? fmtTime(r.ms) : (i === 0 ? fmtLen(Math.max(0, raceLen - r.d)) : '−' + fmtLen(Math.max(0, leadD - r.d)));
      li.append(pos, dot, nm, gap);
      ol.append(li);
    });
    $('liveTitle').textContent = tr('liveTitle');
    void lead;
  }

  // ---------- render ----------
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const vignette = $('vignette');
  let airCam = 0, tuckS = 0, brakeS = 0;
  function place(dt) {
    const steer = inSteer();
    const autoLean = mode === 'menu' || mode === 'lobby' || mode === 'results';
    lean += ((P.air || P.crash > 0 || mode === 'countdown' ? 0 : (autoLean ? Math.sin(t * 0.8) * 0.8 : steer)) - lean) * Math.min(1, 7 * dt);
    armsUp += ((P.air ? 1 : Math.abs(lean) * 0.5) - armsUp) * Math.min(1, 6 * dt);
    const crouch = clamp(0.28 + Math.abs(lean) * 0.35 + squash * 0.5 + (P.air ? 0.25 : 0), 0, 1);
    const onGround = !P.air && P.crash <= 0 && (mode === 'solo' || mode === 'race');
    tuckS += ((onGround && inFast() && !inSlow() ? 1 : 0) - tuckS) * Math.min(1, 8 * dt);
    brakeS += ((onGround && inSlow() ? 1 : 0) - brakeS) * Math.min(1, 8 * dt);
    me.pose(Math.min(1, crouch + P.grab * 0.45 + tuckS * 0.55), armsUp * (1 - tuckS * 0.6), P.air ? Math.sin(P.spin) * 0.3 : lean * 0.3, P.grab, brakeS, switchOf(P.spin));

    const gH = hgt(P.x, P.z);
    rider.position.set(P.x, gH + P.y, P.z);
    rider.rotation.y = -P.ang;
    const fx = Math.sin(P.ang), fz = -Math.cos(P.ang);
    const hF = hgt(P.x + fx * 0.8, P.z + fz * 0.8), hB = hgt(P.x - fx * 0.8, P.z - fz * 0.8);
    const hR = hgt(P.x + Math.cos(P.ang) * 0.3, P.z + Math.sin(P.ang) * 0.3), hL = hgt(P.x - Math.cos(P.ang) * 0.3, P.z - Math.sin(P.ang) * 0.3);
    const rr = !P.air && P.onRamp;   // sulla rampa la tavola si inclina come la sua superficie
    rider.rotation.x = P.air ? rider.rotation.x * 0.9 : rr ? Math.atan2(rampTop(rr, P.z + fz * 0.8) - rampTop(rr, P.z - fz * 0.8), 1.6) : Math.atan2(hF - hB, 1.6);
    rider.rotation.z = P.air ? 0 : -Math.atan2(hR - hL, 0.6) * 0.6;
    bodyTurn(body, P.crash > 0 ? (0.85 - P.crash) * 8 : P.flip, P.spin, -lean * 0.42);
    rider.visible = !(invuln > 0 && P.crash <= 0 && Math.floor(invuln * 10) % 2 === 0);

    camYaw += (P.ang * 0.5 - camYaw) * Math.min(1, 3 * dt);
    airCam += ((P.air && P.y > 0.6 ? 1 : 0) - airCam) * Math.min(1, 3 * dt);
    const back = 6.6 + airCam * 1.6;
    let cx = P.x - Math.sin(camYaw) * back;
    const cz = P.z + Math.cos(camYaw) * back;
    if (isCity()) { const cc = center(cz); cx = clamp(cx, cc - 22.4, cc + 22.4); }   // la telecamera non entra nei palazzi
    // gli alberi troppo vicini alla telecamera spariscono, così non si finisce dentro le chiome
    const hideR = theme === 'neve' ? 2.5 : 0.9;
    for (const o of objs) {
      if (o.type !== 'tree') continue;
      const dx = o.x - cx, dz = o.z - cz, r = hideR * o.s + 0.3;
      o.mesh.visible = dx * dx + dz * dz > r * r;
    }
    const targetY = Math.max(hgt(cx, cz), gH) + 2.3 + P.y * 0.45;
    camY = isNaN(camY) ? targetY : camY + (targetY - camY) * Math.min(1, 6 * dt);
    v1.set(cx, camY - squash * 0.25, cz);
    world.localToWorld(v1);
    if (shake > 0) v1.add(v3.set(rand(-shake, shake), rand(-shake, shake), 0));
    camera.position.copy(v1);
    v2.set(P.x + Math.sin(camYaw) * 16, gH + 0.8 + P.y * 0.3, P.z - Math.cos(camYaw) * 16);
    world.localToWorld(v2);
    camera.lookAt(v2);
    camera.rotateZ(-lean * 0.035);
    const fov = 58 + Math.min(16, P.speed * 0.33);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, 3 * dt); camera.updateProjectionMatrix(); }
    vignette.style.opacity = String(clamp((P.speed - 18) / 30, 0, 0.85));

    v3.set(P.x, gH, P.z); world.localToWorld(v3);
    sun.target.position.copy(v3);
    sun.position.copy(v3).add(SUN_OFFSET);
    sky.position.copy(camera.position);
    ranges.position.copy(camera.position);
    const skyG = builtSky[theme];
    if (skyG) skyG.position.copy(camera.position);
    updateTrail();
  }

  // ---------- HUD ----------
  let hudT = 0, liveT = 1;
  function hud(dt) {
    hudT += dt;
    if (hudT < 0.08) return;
    hudT = 0;
    $('vSpeed').textContent = Math.round(kmh(P.speed)) + ' km/h';
    if (racing()) {
      const el = mode === 'countdown' ? 0 : (net.finished.get(myId) ?? Math.max(0, serverNow() - net.startAt));
      $('v1').textContent = fmtTime(el);
      const pl = racePlace();
      $('v2').textContent = tr('placeOf', { p: ord(pl.place), n: pl.of });
      $('v4').textContent = fmtLen(Math.max(0, raceLen - distM()));
      $('v5').textContent = fmt(bonus);
      $('btnBanana').disabled = mode !== 'race' || bonus < COST.banana;
      $('btnBomb').disabled = mode !== 'race' || bonus < COST.bomb;
      liveT += 0.08;
      if (liveT > 0.25) { liveT = 0; renderLive(pl.list); }
    } else {
      $('v1').textContent = fmt(score());
      $('v2').textContent = fmt(Math.floor(distM())) + ' m';
      $('v4').textContent = fmt(Math.max(0, START_ALT - distM() * Math.sin(SLOPE))) + ' m';
    }
  }
  function renderLives() {
    const box = $('hLives');
    box.innerHTML = '';
    for (let i = 0; i < 3; i++) { const s = document.createElement('span'); s.className = 'life' + (i >= lives ? ' lost' : ''); box.appendChild(s); }
  }

  async function loadBoard() {
    try {
      const res = await fetch('/api/leaderboard?min=5', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const rows = await res.json();
      const ol = $('board');
      ol.innerHTML = '';
      for (const r of rows.slice(0, 10)) {
        const li = document.createElement('li');
        li.textContent = r.name;
        const s = document.createElement('span'); s.textContent = fmtTime(r.ms);
        li.append(s);
        ol.append(li);
      }
      $('boardBox').hidden = rows.length === 0;
    } catch (e) { $('boardBox').hidden = true; }
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

  let last = performance.now(), wasPlaying = null;
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (mode === 'solo') { update(dt, false); hud(dt); }
    else if (racing()) { raceClock(); update(dt, false); updateRemotes(dt); hud(dt); }
    else if (mode === 'menu' || mode === 'lobby' || mode === 'results') update(dt, true);
    else if (mode === 'over') { updateSpray(dt); updateFlakes(dt, P.x, P.z, 0); }
    const playing = mode === 'solo' || racing();
    if (playing !== wasPlaying) { wasPlaying = playing; stage.classList.toggle('playing', playing); stick.x = stick.y = 0; stickRest(); diag.log('gioco', 'modo ' + mode); }
    place(mode === 'pause' ? 0 : dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // testi della pagina: data-i18n (testo), data-i18n-html (con grassetti), data-i18n-ph (segnaposto), data-i18n-title, data-i18n-aria
  function applyLang(l) {
    lang = LANGS.includes(l) ? l : 'it';
    store.set('cyf.lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = tr(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = tr(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = tr(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', tr(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.title = tr('pageTitle');
    hudLabels();
    setMuted(muted);
    renderMyPts();
    if (mode === 'lobby') renderLobby();
    if (mode === 'results') renderResults();
    updateVoiceBtn();
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));
  const selJersey = $('selJersey');
  selJersey.value = myJersey();
  selJersey.addEventListener('change', () => {
    store.set('cyf.jersey', JERSEYS[selJersey.value] ? selJersey.value : '');
    me.setColor(PALETTE[(net.myColor || 0) % PALETTE.length], myJersey());
  });
  resize();
  applyTheme(theme);
  applyLang(lang);
  // ?lang= serve solo all'arrivo: lo togliamo dall'indirizzo, così una scelta fatta nel menu vale anche dopo un ricaricamento
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('lang')) { q.delete('lang'); const r = q.toString(); history.replaceState(null, '', location.pathname + (r ? '?' + r : '') + location.hash); }
  } catch (e) {}
  me.setColor(PALETTE[0], myJersey());
  loadMe();
  reset((Math.random() * 2 ** 31) | 0, null, false);
  hudLabels();
  loadBoard();
  const invite = new URLSearchParams(location.search).get('sfida');
  if (invite) {
    inCode.value = invite.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (inName.value.trim()) connect(inCode.value);
    else { menuError(''); inName.focus(); $('btnJoin').textContent = tr('joinChallenge'); }
  }
  // stato del gioco per il pannello di debug e per gli errori inviati al server (niente nomi né dati personali)
  let glName = '';
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); glName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) {}
  diag.state = () => ({
    modo: mode, scena: theme, seed: lastSeed, vel: P.speed, dist: distM(), gara: raceLen,
    rete: net.ws ? ['apertura', 'aperta', 'chiusura', 'chiusa'][net.ws.readyState] : 'no', stanza: net.code || '-', fase: net.phase,
    ping: net.ping, msg: net.msgs, giocatori: net.players.length, avversari: remotes.size, lingua: lang, tel: isPhone ? 1 : 0, gl: glName
  });
  const verLabel = $('verLabel');
  if (verLabel) { verLabel.textContent = 'v' + ((window.CYF && window.CYF.version) || '?'); diag.tapToOpen(verLabel); }
  diag.log('gioco', 'pronto · ' + theme + ' · ' + lang);
  requestAnimationFrame(frame);
})();
