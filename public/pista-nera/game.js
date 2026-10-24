// Pista Nera — C-Y-F Gaming
// Snowboard 3D con modalità allenamento (da solo) e sfida online (stanza con codice, stessa pista per tutti).
(() => {
  const $ = id => document.getElementById(id);
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
  renderer.setPixelRatio(Math.min(isPhone ? 1.75 : 2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  const center = z => 14 * Math.sin(z / 170) + 7 * Math.sin(z / 61);
  function hgt(x, z) {
    const off = Math.abs(x - center(z));
    const rough = 0.32 + clamp((off - 17) / 12, 0, 1) * 1.4;
    const waves = 0.6 * Math.sin(x * 0.13 + z * 0.05) * Math.sin(z * 0.09 - x * 0.03)
                + 0.32 * Math.sin(x * 0.31 + 1.7) * Math.sin(z * 0.23);
    return rough * waves + clamp((off - 19) / 12, 0, 1) * 1.6;
  }
  function snowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#e6eef5'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 6) { g.fillStyle = (y / 6) % 2 ? 'rgba(105,140,180,0.12)' : 'rgba(255,255,255,0.45)'; g.fillRect(0, y, 512, 3); }
    for (let i = 0; i < 2600; i++) {
      const r = Math.random();
      g.fillStyle = r < 0.45 ? 'rgba(80,120,170,0.14)' : 'rgba(255,255,255,0.85)';
      g.fillRect(Math.random() * 512, Math.random() * 512, r > 0.97 ? 2 : 1.4, r > 0.97 ? 2 : 1.4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }
  // basoli di pietra lavica (scenario Napoli)
  function stoneTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    const rr = mulberry32(99);
    g.fillStyle = '#2a2725'; g.fillRect(0, 0, 512, 512);
    const H = 32;
    for (let row = 0; row < 512 / H; row++) {
      let x = row % 2 ? -rr() * 40 : -rr() * 20;
      while (x < 512) {
        const w = 44 + rr() * 34;
        const v = 74 + Math.floor(rr() * 26);
        g.fillStyle = 'rgb(' + v + ',' + (v - 3) + ',' + (v - 6) + ')';
        g.fillRect(x + 2, row * H + 2, w - 3, H - 3);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 3, row * H + 3, w - 5, 3);
        for (let k = 0; k < 14; k++) { g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)'; g.fillRect(x + 3 + rr() * (w - 6), row * H + 4 + rr() * (H - 8), 2, 2); }
        x += w;
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }
  const GS = 400, GSEG = isPhone ? 80 : 110, CELL = GS / GSEG;
  const groundTex = snowTexture();
  let stoneTex = null;
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
    const vMat = mk('#6f6a73'), vTop = mk('#5c5560'), sMat = mk('#7f7c86');
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(34, 250, 205, 28, 1, true), vMat);
    cone.position.y = 102;
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(22, 34, 10, 28), vTop);
    crater.position.y = 200;
    const somma = new THREE.Mesh(new THREE.CylinderGeometry(60, 230, 160, 24, 1, true), sMat);
    somma.position.set(-175, 80, 60);
    ves.add(somma, cone, crater);
    ves.position.set(Math.sin(0.42) * 640, -150, -Math.cos(0.42) * 640);
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
  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  function spruce(slim) {
    const parts = [{ geo: new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), color: '#4a3020', y: 0.7 }];
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const r = (1.75 - f * 1.35) * (slim ? 0.78 : 1), h = 1.5 - f * 0.55, y = 1.3 + f * 4.2;
      const green = ['#142f24', '#17372a', '#1a3e2f', '#1d4533', '#204c38', '#22533c'][i];
      parts.push({ geo: new THREE.ConeGeometry(r, h, 8), color: green, y: y + h / 2, ry: i * 0.6 });
      parts.push({ geo: new THREE.ConeGeometry(r * 0.78, h * 0.32, 8), color: '#f1f6fa', y: y + h * 0.62, ry: i * 0.6 + 0.3 });
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
  function gateGeo(color) {
    const parts = [];
    for (const s of [-1, 1]) {
      const px = s * 2.4;
      parts.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), color: '#f4f6f8', x: px, y: 0.95 });
      parts.push({ geo: new THREE.BoxGeometry(0.85, 0.6, 0.02), color, x: px - s * 0.45, y: 1.45 });
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
  // facciate: una texture per colore, finestre con persiane verdi e balconcini
  const FACADES = ['#e7b65c', '#dd8a5c', '#c9573f', '#f1d999', '#e9a98a', '#d8c7a6', '#b85a43', '#f3e6cf'];
  const facadeMats = FACADES.map(col => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
    g.fillStyle = '#2b2f36'; g.fillRect(44, 26, 40, 66);
    g.fillStyle = '#3f6f4c'; g.fillRect(26, 26, 17, 66); g.fillRect(85, 26, 17, 66);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 30; y < 92; y += 6) { g.fillRect(28, y, 13, 2); g.fillRect(87, y, 13, 2); }
    g.fillStyle = '#e9e4da'; g.fillRect(40, 22, 48, 4);
    g.fillStyle = '#26282c'; g.fillRect(36, 94, 56, 4);
    for (let x = 38; x < 92; x += 6) g.fillRect(x, 98, 2, 14);
    g.fillRect(36, 110, 56, 3);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: lin('#a89a88') });
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
       new THREE.MeshBasicMaterial({ map: textTexture('ARRIVO · 2.000 m', 1024, 64, '#ff5a1f', '#ffffff', '700 44px "Barlow Condensed", Arial, sans-serif') }),
       new THREE.MeshBasicMaterial({ map: textTexture('C-Y-F GAMING', 1024, 64, '#13233a', '#ffffff', '700 44px "Barlow Condensed", Arial, sans-serif') })]
    );
    banner.position.set(c, Math.max(hgt(c - 18, z), hgt(c + 18, z)) + 6.2, z);
    banner.castShadow = true;
    grp.add(banner);
    // linea rossa sulla neve
    const line = new THREE.Mesh(new THREE.PlaneGeometry(36, 0.6), new THREE.MeshBasicMaterial({ color: lin('#d8302a'), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(c, hgt(c, z) + 0.05, z);
    grp.add(line);
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
  const SHARED = { board: RM('#121c2b'), stripe: RM('#ff5a1f'), pants: RM('#2a3d58'), glove: RM('#141414'), helmet: RM('#eef2f6'), boot: RM('#1b1b1b'), goggle: new THREE.MeshStandardMaterial({ color: lin('#ffb347'), roughness: 0.15, metalness: 0.6 }) };
  const UP = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3(), tmpE = new THREE.Vector3(), GRAB_HAND = new THREE.Vector3(0.2, 0.12, -0.08);
  const PIVOT = new THREE.Vector3();
  // ruota il corpo attorno al baricentro (circa 0,6 m sopra la tavola), non attorno ai piedi
  function bodyTurn(b, rx, ry, rz) {
    b.rotation.set(rx, ry, rz);
    PIVOT.set(0, 0.6, 0).applyEuler(b.rotation);
    b.position.set(-PIVOT.x, 0.6 - PIVOT.y, -PIVOT.z);
  }
  // ali stampate sulla schiena della giacca (stesso disegno per tutti i rider)
  const WINGS = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.lineJoin = 'round';
    for (const s of [-1, 1]) {
      g.save();
      g.translate(256, 96);
      g.scale(s, 1);
      // piume: dalla più lunga (in alto) alla più corta (in basso)
      for (let i = 4; i >= 0; i--) {
        const len = 205 - i * 30, y = i * 24, tilt = 0.10 + i * 0.07;
        g.save();
        g.translate(18, y);
        g.rotate(tilt);
        g.beginPath();
        g.moveTo(0, -14);
        g.quadraticCurveTo(len * 0.55, -34, len, -8);
        g.quadraticCurveTo(len * 0.6, 26, 0, 16);
        g.closePath();
        g.fillStyle = '#ffffff'; g.fill();
        g.lineWidth = 7; g.strokeStyle = '#13233a'; g.stroke();
        g.restore();
      }
      g.restore();
    }
    g.beginPath(); g.arc(256, 120, 26, 0, TAU);
    g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#13233a'; g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return {
      geo: new THREE.PlaneGeometry(0.42, 0.21),
      mat: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })
    };
  })();
  function makeRider(jacketHex) {
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    const body = new THREE.Group();
    group.add(body);
    const jacket = RM(jacketHex), jacketDark = RM(jacketHex);
    jacketDark.color.multiplyScalar(0.7);
    const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; body.add(m); return m; };
    mesh(new THREE.BoxGeometry(0.3, 0.035, 1.3), SHARED.board).position.y = 0.05;
    for (const s of [-1, 1]) {
      const tip = mesh(new THREE.BoxGeometry(0.3, 0.035, 0.22), SHARED.board);
      tip.position.set(0, 0.08, s * 0.74); tip.rotation.x = s * 0.35;
      mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), SHARED.boot).position.set(0.02, 0.13, s * 0.26);
    }
    mesh(new THREE.BoxGeometry(0.06, 0.038, 1.1), SHARED.stripe).position.y = 0.055;
    const limb = (r, mat) => mesh(new THREE.CylinderGeometry(r, r * 0.9, 1, 7), mat);
    const L = {
      thighL: limb(0.085, SHARED.pants), thighR: limb(0.085, SHARED.pants), shinL: limb(0.07, SHARED.pants), shinR: limb(0.07, SHARED.pants),
      uarmL: limb(0.06, jacket), uarmR: limb(0.06, jacket), farmL: limb(0.05, jacket), farmR: limb(0.05, jacket)
    };
    const torso = mesh(new THREE.BoxGeometry(0.28, 0.55, 0.42), jacket);
    // il rider scende di lato: la telecamera alle spalle vede soprattutto il lato +z del busto,
    // quindi le ali sono stampate lì e anche sulla schiena (lato -x), visibile agli avversari
    const wingsBack = new THREE.Mesh(WINGS.geo, WINGS.mat);
    wingsBack.position.set(-0.142, 0.08, 0);
    wingsBack.rotation.y = -Math.PI / 2;
    const wingsCam = new THREE.Mesh(WINGS.geo, WINGS.mat);
    wingsCam.position.set(0, 0.1, 0.212);
    wingsCam.scale.setScalar(0.66);
    torso.add(wingsBack, wingsCam);
    const band = mesh(new THREE.BoxGeometry(0.29, 0.1, 0.43), jacketDark);
    const head = mesh(new THREE.SphereGeometry(0.15, 14, 10), SHARED.helmet);
    const goggle = mesh(new THREE.BoxGeometry(0.06, 0.08, 0.22), SHARED.goggle);
    const gloveL = mesh(new THREE.SphereGeometry(0.06, 8, 6), SHARED.glove);
    const gloveR = mesh(new THREE.SphereGeometry(0.06, 8, 6), SHARED.glove);
    const J = {}; ['ankL', 'ankR', 'kneeL', 'kneeR', 'hipL', 'hipR', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR'].forEach(k => J[k] = new THREE.Vector3());
    function setLimb(m, a, b) {
      tmpV.subVectors(b, a);
      const len = tmpV.length();
      m.position.copy(a).addScaledVector(tmpV, 0.5);
      m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(UP, tmpV.normalize());
    }
    function pose(k, arms, twist, grab = 0) {
      J.ankL.set(0.02, 0.17, 0.26); J.ankR.set(0.02, 0.17, -0.26);
      const kneeX = 0.1 + k * 0.17, kneeY = 0.55 - k * 0.13;
      J.kneeL.set(kneeX, kneeY, 0.24); J.kneeR.set(kneeX, kneeY, -0.24);
      const hipX = -0.04 - k * 0.12, hipY = 0.93 - k * 0.25;
      J.hipL.set(hipX, hipY, 0.13); J.hipR.set(hipX, hipY, -0.13);
      setLimb(L.shinL, J.ankL, J.kneeL); setLimb(L.shinR, J.ankR, J.kneeR);
      setLimb(L.thighL, J.kneeL, J.hipL); setLimb(L.thighR, J.kneeR, J.hipR);
      const lean = 0.25 + k * 0.35;
      torso.position.set(hipX + Math.sin(lean) * 0.27, hipY + Math.cos(lean) * 0.27, 0);
      torso.rotation.set(twist * 0.4, 0, -lean);
      band.position.set(hipX + Math.sin(lean) * 0.06, hipY + Math.cos(lean) * 0.06, 0);
      band.rotation.copy(torso.rotation);
      const shX = hipX + Math.sin(lean) * 0.5, shY = hipY + Math.cos(lean) * 0.5;
      head.position.set(shX + 0.08, shY + 0.2, 0);
      goggle.position.set(shX + 0.2, shY + 0.21, 0);
      J.shL.set(shX, shY, 0.2); J.shR.set(shX, shY, -0.2);
      const spread = 0.25 + arms * 0.35;
      J.elL.set(shX + 0.12, shY - 0.2 + arms * 0.12, 0.2 + spread); J.elR.set(shX + 0.12, shY - 0.2 + arms * 0.12, -0.2 - spread);
      J.haL.set(shX + 0.28, shY - 0.38 + arms * 0.25, 0.3 + spread * 1.4); J.haR.set(shX + 0.28, shY - 0.38 + arms * 0.25, -0.3 - spread * 1.4);
      if (grab > 0) {   // presa della tavola: mano dietro sulla lamina, gomito piegato
        J.haR.lerp(GRAB_HAND, grab);
        J.elR.lerp(tmpE.set(shX + 0.16, shY - 0.3, -0.24), grab);
      }
      setLimb(L.uarmL, J.shL, J.elL); setLimb(L.uarmR, J.shR, J.elR);
      setLimb(L.farmL, J.elL, J.haL); setLimb(L.farmR, J.elR, J.haR);
      gloveL.position.copy(J.haL); gloveR.position.copy(J.haR);
    }
    function setColor(hex) { jacket.color.copy(lin(hex)); jacketDark.color.copy(lin(hex)).multiplyScalar(0.7); }
    pose(0.3, 0.2, 0);
    return { group, body, pose, setColor };
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
    if (reduceMotion) return;
    const base = hgt(px, pz);
    for (let i = 0; i < FN; i++) {
      const o = i * 3;
      fRel[o + 1] -= (1.1 + (i % 5) * 0.12) * dt;
      fRel[o] += Math.sin(t * 0.7 + i) * 0.25 * dt;
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
      audio = { ac, master, windG, carveG, windF };
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
    $('btnSound').textContent = m ? 'Audio: no' : 'Audio: sì';
    if (audio) audio.master.gain.setTargetAtTime(m ? 0 : 0.9, audio.ac.currentTime, 0.05);
  }

  // ---------- scenari ----------
  const THEMES = {
    neve: { sky: ['#3f7fc4', '#9cc5e6', '#d6e7f3'], fog: '#d6e7f3', hemi: ['#cfe4f7', '#aebfd0'], sun: '#fff0d6', spray: '#ffffff', sprayOp: 0.9, trail: '#9db4ca', trailOp: 0.42, alt: 'Quota' },
    napoli: { sky: ['#2a7fd6', '#86c2ee', '#e6edf1'], fog: '#e1e8ec', hemi: ['#f6ecdc', '#b3a493'], sun: '#fff0cf', spray: '#c7beb3', sprayOp: 0.55, trail: '#262321', trailOp: 0.22, alt: 'Quota' }
  };
  const urlScena = new URLSearchParams(location.search).get('scena');
  let theme = urlScena === 'napoli' || urlScena === 'neve' ? urlScena : (store.get('cyf.scena') === 'napoli' ? 'napoli' : 'neve');
  function applyTheme(name) {
    theme = THEMES[name] ? name : 'neve';
    store.set('cyf.scena', theme);
    const T = THEMES[theme];
    const u = sky.material.uniforms;
    u.top.value.set(T.sky[0]); u.mid.value.set(T.sky[1]); u.horizon.value.set(T.sky[2]);
    scene.fog.color.copy(lin(T.fog));
    hemi.color.copy(lin(T.hemi[0])); hemi.groundColor.copy(lin(T.hemi[1]));
    sun.color.copy(lin(T.sun));
    if (theme === 'napoli' && !stoneTex) stoneTex = stoneTexture();
    groundMat.map = theme === 'napoli' ? stoneTex : groundTex;
    groundMat.roughness = theme === 'napoli' ? 0.9 : 0.82;
    groundMat.needsUpdate = true;
    gx0 = NaN;
    ranges.visible = theme === 'neve';
    bay.visible = theme === 'napoli';
    flakes.visible = theme === 'neve';
    sprayPts.material.color.copy(lin(T.spray)); sprayPts.material.opacity = T.sprayOp;
    trailMesh.material.color.copy(lin(T.trail)); trailMesh.material.opacity = T.trailOp;
    stage.style.background = T.fog;
    document.querySelectorAll('[data-scena]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scena === theme)));
  }
  document.querySelectorAll('[data-scena]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.scena === theme) return;
    applyTheme(b.dataset.scena);
    if (!racing()) { reset((Math.random() * 2 ** 31) | 0, null, false); }
  }));

  // ---------- game state ----------
  // mode: menu | solo | pause | over | lobby | countdown | race | finished | results
  let mode = 'menu';
  let best = parseInt(store.get('pistaNera.best') || '0', 10) || 0;
  let P, objs = [], bonus, lives, invuln, combo, trailT, shake, maxSpeed, bestSpin, overTimer, overReason, t = 0, rowZ, forestZ, markerZ, camYaw, lean, camY, squash, armsUp;
  let rowRng = Math.random, forestRng = Math.random, buildRng = Math.random, buildZ = 0, finishObj = null, raceLen = 2000;
  const racing = () => mode === 'countdown' || mode === 'race' || mode === 'finished';
  const distM = () => Math.max(0, -P.z);
  const score = () => Math.floor(distM()) + bonus;
  const kmh = v => v * 3.6;

  function clearWorld() {
    for (const o of objs) removeObj(o);
    objs = [];
    if (finishObj) { world.remove(finishObj); finishObj = null; }
  }
  function reset(seed, x0, withFinish) {
    clearWorld();
    rowRng = mulberry32(seed);
    forestRng = mulberry32(seed ^ 0x5bd1e995);
    buildRng = mulberry32(seed ^ 0x2c1b3c6d);
    buildZ = 30;
    P = { x: x0 != null ? x0 : center(0), y: 0, z: 0, prevZ: 0, ang: 0, speed: 9, vy: 0, spin: 0, flip: 0, grab: 0, grabT: 0, idleAir: 0, airT: 0, air: false, crash: 0, ramp: false, onRamp: null };
    trailPts = [];
    bonus = 0; lives = 3; invuln = 0; combo = 0; trailT = 0; shake = 0;
    maxSpeed = 0; bestSpin = 0; overTimer = 0; overReason = '';
    rowZ = -28; forestZ = 22; markerZ = 10; camYaw = 0; lean = 0; camY = NaN; squash = 0; armsUp = 0;
    renderLives();
    gx0 = NaN;
    updateGround(P.x, P.z);
    if (withFinish) finishObj = finishLine(-raceLen);
    ensureSpawned();
  }

  // ---------- spawning (seeded: everybody in a race gets the same course) ----------
  function addTree(rng, x, z, s, shadow) {
    const tilt = [(rng() - 0.5) * 0.1, (rng() - 0.5) * 0.1];
    const geo = GEO.trees[rng() < 0.3 ? 1 : 0];
    const sy = 0.9 + rng() * 0.25, ry = rng() * TAU;   // stessi numeri casuali in ogni scenario: la pista resta identica
    if (theme === 'napoli') return { type: 'tree', x, z, s, mesh: addMesh(GEO.palms[0], vcMat, x, z, { s: s * 1.05, sy, ry, tilt, shadow }) };
    return { type: 'tree', x, z, s, mesh: addMesh(geo, vcMat, x, z, { s, sy, ry, tilt, shadow }) };
  }
  function spawnRow(z) {
    const r = rowRng, rr = (a, b) => a + r() * (b - a);
    const d = -z, c = center(z);
    const n = r() < Math.min(0.8, 0.4 + d / 3500) ? 2 : 1;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const x = c + rr(-15.5, 15.5);
      const kind = r();
      if (xs.some(v => Math.abs(v - x) < 4.5)) continue;
      xs.push(x);
      if (kind < 0.38) objs.push(addTree(r, x, z, rr(0.75, 1.05), true));
      else if (kind < 0.58) { const s = rr(0.8, 1.25); objs.push({ type: 'rock', x, z, s, mesh: addMesh(GEO.rock, vcMat, x, z, { s, ry: r() * TAU }) }); }
      else if (kind < 0.71) {
        const k = 3 + Math.floor(r() * 3);
        for (let j = 0; j < k; j++) {
          const gx = x + Math.sin(j * 0.9) * 0.8, gz = z - j * 2.2;
          const food = theme === 'napoli' ? ((Math.round(z) + j) % 2 ? GEO.pizza : GEO.coffee) : null;
          objs.push({ type: 'gem', x: gx, z: gz, mesh: food ? addMesh(food, vcMat, gx, gz, { y: 0.9 }) : addMesh(gemGeo, gemMat, gx, gz, { y: 0.9 }), phase: j, food: food === GEO.pizza ? 'Pizza' : food ? 'Caffè' : null });
        }
      }
      else if (kind < 0.83) objs.push({ type: 'ramp', x, z, used: false, mesh: addMesh(theme === 'napoli' ? GEO.rampWood : GEO.ramp, vcMat, x, z, { recv: true }) });
      else {
        const gx = c + rr(-9, 9), red = r() < 0.5;
        objs.push({ type: 'gate', x: gx, z, half: 2.4, done: false, mesh: addMesh(red ? GEO.gateRed : GEO.gateBlue, vcMat, gx, z), name: red ? 'rossa' : 'blu' });
      }
    }
  }
  // palazzi ai lati della strada (solo estetica: non cambiano la pista)
  function spawnBuildings() {
    const r = buildRng;
    const z = buildZ, c = center(z);
    let len = 0;
    for (const side of [-1, 1]) {
      const w = 9 + r() * 6, d = 9 + r() * 5, h = 10 + r() * 14;
      const x = c + side * (23.5 + d / 2 + r() * 2);
      const mat = facadeMats[Math.floor(r() * facadeMats.length)];
      const m = new THREE.Mesh(buildingGeo(d, h, w), [mat, mat, roofMat, roofMat, mat, mat]);
      m.position.set(x, hgt(x, z), z);
      m.rotation.y = (r() - 0.5) * 0.06;
      world.add(m);
      objs.push({ type: 'bldg', x, z, mesh: m });
      len = Math.max(len, w);
    }
    buildZ -= len + 0.6 + r() * 1.2;
  }
  function removeObj(o) {
    world.remove(o.mesh);
    if (o.type === 'bldg') o.mesh.geometry.dispose();
  }
  function spawnForest(z) {
    const r = forestRng, c = center(z);
    for (const side of [-1, 1]) {
      const k = r() < 0.65 ? 2 : 1;
      for (let i = 0; i < k; i++) {
        const x = c + side * (22 + r() * 26), tz = z + (r() - 0.5) * 3;
        objs.push(addTree(r, x, tz, 0.85 + r() * 0.55, Math.abs(x - c) < 32));
      }
    }
  }
  function ensureSpawned() {
    const horizon = P.z - 200;
    const soloWorld = mode === 'solo' || mode === 'over' || mode === 'pause';
    while (rowZ > horizon) {
      // in gara niente ostacoli negli ultimi 25 m prima del traguardo
      if (soloWorld || (racing() && -rowZ < raceLen - 25)) spawnRow(rowZ);
      rowZ -= (6 + rowRng() * 4) * Math.max(0.5, 1 - (-rowZ) / 3200);
    }
    if (theme === 'napoli') {
      while (buildZ > horizon) spawnBuildings();
    } else {
      while (forestZ > horizon) { spawnForest(forestZ); forestZ -= 2.4 + forestRng() * 1.6; }
    }
    while (markerZ > horizon) {
      const c = center(markerZ);
      for (const s of [-1, 1]) objs.push({ type: 'marker', x: c + s * 19.5, z: markerZ, mesh: addMesh(theme === 'napoli' ? GEO.bollard : GEO.marker, vcMat, c + s * 19.5, markerZ) });
      markerZ -= 22;
    }
    const behind = P.z + 16;
    if (objs.length && objs.some(o => o.z > behind)) objs = objs.filter(o => { if (o.z > behind) { removeObj(o); return false; } return true; });
  }

  // ---------- input ----------
  const keys = { left: false, right: false, up: false, down: false };
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter' && inCode.value.trim()) joinFromMenu(); return; }
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
    else if (k === ' ') { if (mode === 'solo' || mode === 'race') e.preventDefault(); if (!e.repeat) jump(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      // a terra salta; in aria salto mortale in avanti
      if (mode === 'solo' || mode === 'race') e.preventDefault();
      if (P && P.air) keys.up = true; else if (!e.repeat) jump();
    }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); keys.down = true; }
    else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
    else if (k === 'm' || k === 'M') setMuted(!muted);
    else if (k === 'v' || k === 'V') { if (!e.repeat) voiceButton(); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = false;
    if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = keys.up = keys.down = false; if (mode === 'solo') togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'solo') togglePause(); });
  function holdButton(el, key) {
    const on = e => { e.preventDefault(); keys[key] = true; el.classList.add('on'); };
    const off = () => { keys[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, off));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  holdButton($('tLeft'), 'left');
  holdButton($('tRight'), 'right');
  // sul telefono: Salta a terra salta, tenuto premuto in aria fa il salto mortale all'indietro
  $('tJump').addEventListener('pointerdown', e => { e.preventDefault(); if (P && P.air) keys.down = true; else jump(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('tJump').addEventListener(ev, () => { keys.down = false; }));

  // ---------- overlays & HUD ----------
  const OVERLAYS = ['menu', 'lobby', 'raceResults', 'over', 'pause'];
  function show(id) { for (const o of OVERLAYS) $(o).hidden = o !== id; }
  const banner = $('banner');
  function setBanner(text) { banner.hidden = !text; banner.textContent = text || ''; }

  function hudLabels() {
    const race = racing();
    $('k1').textContent = race ? 'Tempo' : 'Punti';
    $('k2').textContent = race ? 'Posizione' : 'Distanza';
    $('k4').textContent = race ? 'Mancano' : 'Quota';
    $('hLives').hidden = race;
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
    me.setColor(PALETTE[0]);
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
    if (errSpin > 1.0 || errFlip > 1.1) { P.spin = 0; P.flip = 0; crash('Atterraggio storto'); return; }
    const sloppy = errSpin > 0.45 || errFlip > 0.5;
    if (sloppy) P.speed *= 0.75;
    const names = [];
    let pts = 0;
    if (flips >= 1) { names.push((flips > 1 ? flips + 'x ' : '') + (back ? 'Backflip' : 'Frontflip')); pts += 150 * flips; }
    if (halfTurns >= 1) { names.push(halfTurns * 180 + '°'); pts += 60 * halfTurns; bestSpin = Math.max(bestSpin, halfTurns * 180); }
    if (grabbed) { names.push('Grab'); pts += 30 + Math.min(60, Math.round(P.grabT * 40)); }
    if (names.length) {
      if (P.ramp) pts *= 2;
      if (names.length > 1) pts = Math.round(pts * 1.5);
      if (sloppy) pts = Math.round(pts / 2);
      bonus += pts;
      say(names.join(' + ') + '  +' + pts, sloppy ? '#8a6d3b' : '#ff5a1f');
      if (!sloppy) { sparkle(P.x, hgt(P.x, P.z) + 0.6, P.z, names.length > 1 ? 70 : 40, true); tone('triangle', 880, 1320, 0.3, 0.1); }
    } else if (sloppy) say('Atterraggio sporco', '#8a6d3b');
    P.spin = halfTurns % 2 ? Math.PI : 0;
    P.flip = 0;
  }

  // ---------- update ----------
  function update(dt, auto) {
    t += dt;
    let steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (auto) steer = clamp((center(P.z - 14) - P.x) * 0.25 + Math.sin(t * 0.8) * 0.9, -1, 1);
    const frozen = mode === 'countdown';
    const braking = mode === 'finished';
    if (braking) steer = clamp((center(P.z - 10) - P.x) * 0.15, -0.5, 0.5);
    const d = distM();
    const vmax = 18 + Math.min(26, d * 0.0075);
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
      if (braking) target = 0;
      P.speed += (target - P.speed) * (target > P.speed ? 0.5 : (braking ? 0.9 : 1.3)) * dt;
      if (Math.abs(P.ang) > 0.6 && Math.random() < 0.8) spray(P.x, 0, P.z, 2, 1.6, 2.4, Math.cos(P.ang) * Math.sign(P.ang) * 3);
    } else {
      const flipIn = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
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
    maxSpeed = Math.max(maxSpeed, P.speed);

    if (P.onRamp && !P.air) {
      const r = P.onRamp;
      const along = clamp((r.z + 2 - P.z) / 4, 0, 1);
      P.y = along * 1.12;
      if (Math.abs(P.x - r.x) > 1.7) { P.onRamp = null; P.air = true; P.vy = 0; }
      else if (along >= 1) {
        P.onRamp = null; P.air = true; P.vy = 8.6; P.spin = P.spin % TAU; P.ramp = true; startAir();
        P.speed = Math.min(P.speed * 1.06, 46);
        say(isPhone ? 'Rampa! ◀ ▶ ruota, tieni Salta per il backflip' : 'Rampa! ← → ruota, ↑ ↓ salto mortale', '#2f7fd0');
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
      if (dz < -6 || dz > 6) continue;
      const dx = o.x - P.x, d2 = dx * dx + dz * dz;
      if (o.type === 'tree') { if (P.y < 5.5 * o.s && d2 < (0.8 * o.s) ** 2) crash('Abete!'); }
      else if (o.type === 'rock') { if (P.y < 0.75 * o.s && d2 < (1.1 * o.s) ** 2) crash('Roccia!'); }
      else if (o.type === 'marker') { if (P.y < 1.5 && d2 < 0.35 * 0.35) crash('Palina!'); }
      else if (o.type === 'ramp') {
        if (!o.used && !P.air && P.crash <= 0 && Math.abs(dx) < 1.5 && P.z < o.z + 2 && P.z > o.z - 1.2) { o.used = true; P.onRamp = o; }
      } else if (o.type === 'gem') {
        if (P.y < 2.2 && d2 < 0.95 * 0.95) { o.taken = true; taken = true; bonus += 10; spray(o.x, 0.9, o.z, 8, 1.5, 2); world.remove(o.mesh); chime(); if (o.food && Math.random() < 0.35) say(o.food + '!  +10', '#c4361f'); }
      } else if (o.type === 'gate') {
        const left = o.x - o.half, right = o.x + o.half;
        if (P.y < 1.7 && Math.abs(dz) < 0.25 && (Math.abs(P.x - left) < 0.2 || Math.abs(P.x - right) < 0.2)) crash('Paletto!');
        if (!o.done && P.prevZ > o.z && P.z <= o.z) {
          o.done = true;
          if (P.x > left && P.x < right) {
            combo++;
            const pts = 50 * combo;
            bonus += pts; chime();
            say(combo > 1 ? 'Porta x' + combo + '  +' + pts : 'Porta  +50', o.name === 'rossa' ? '#d8302a' : '#2766c6');
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
    $('overReason').textContent = 'Ultima caduta: ' + overReason.replace('!', '');
    $('rScore').textContent = fmt(s);
    $('rDist').textContent = fmt(Math.floor(distM())) + ' m';
    $('rSpeed').textContent = Math.round(kmh(maxSpeed)) + ' km/h';
    $('rSpin').textContent = bestSpin ? bestSpin + '°' : '—';
    $('rBest').textContent = isBest ? 'Nuovo record personale!' : 'Il tuo record: ' + fmt(best);
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
    if (!n) { menuError('Scrivi il tuo nome per sfidare gli altri.'); inName.focus(); return null; }
    store.set('cyf.name', n);
    menuError('');
    return n;
  }
  $('btnCreate').addEventListener('click', () => { if (needName()) connect(newCode()); });
  function joinFromMenu() {
    if (!needName()) return;
    const c = inCode.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) { menuError('Il codice ha 5 caratteri, per esempio K7QXM.'); inCode.focus(); return; }
    connect(c);
  }
  $('btnJoin').addEventListener('click', joinFromMenu);

  function connect(code) {
    initAudio();
    net.close();
    net.want = true; net.code = code; net.retries = 0; net.phase = 'lobby'; net.results = []; net.finished = new Map();
    history.replaceState(null, '', location.pathname + '?sfida=' + code);
    mode = 'lobby';
    renderLobby();
    show('lobby');
    open();
  }
  function open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws;
    try { ws = new WebSocket(proto + '://' + location.host + '/api/room/' + net.code); }
    catch (e) { setBanner('Impossibile collegarsi al server.'); return; }
    net.ws = ws;
    ws.onopen = () => {
      net.retries = 0; setBanner('');
      ws.send(JSON.stringify({ t: 'hello', id: myId, name: inName.value.trim() || 'Rider' }));
      clearInterval(net.pingTimer);
      net.pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 20000);
    };
    ws.onmessage = ev => { if (ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = ev => {
      if (net.ws !== ws) return;
      clearInterval(net.pingTimer);
      if (!net.want) return;
      if (ev.code === 1008) { net.want = false; toMenu(); menuError('La sfida è piena (massimo 8 giocatori).'); return; }
      if (ev.code === 4000) { net.want = false; toMenu(); menuError('Sei entrato in questa sfida da un\'altra scheda.'); return; }
      if (net.retries < 6) {
        net.retries++;
        setBanner('Connessione persa: riprovo…');
        setTimeout(() => { if (net.want) open(); }, 1000 * net.retries);
      } else { setBanner('Non riesco a collegarmi. Controlla la connessione e rientra con il codice ' + net.code + '.'); }
    };
  }

  function amIn(list) { return list.some(r => r.id === myId); }
  function onMsg(m) {
    if (m.t === 'welcome') {
      net.offset = m.now - Date.now();
      voice.next = m.voiceNext || 0;
      net.phase = m.phase; net.seed = m.seed; net.startAt = m.startAt; net.racers = m.racers || []; net.results = m.results || [];
      raceLen = m.length || 2000;
      if ((m.phase === 'countdown' || m.phase === 'racing') && amIn(net.racers) && !racing()) beginRace(true);
      renderLobby();
    } else if (m.t === 'lobby') {
      net.players = m.players; net.hostId = m.hostId; net.phase = m.phase;
      const mine = m.players.find(p => p.id === myId);
      if (mine) { net.myColor = mine.color; if (!racing()) me.setColor(PALETTE[mine.color % PALETTE.length]); }
      renderLobby();
      if (mode === 'results') renderResults();
    } else if (m.t === 'countdown') {
      net.offset = m.now - Date.now();
      net.phase = 'countdown'; net.seed = m.seed; net.startAt = m.startAt; net.racers = m.racers; net.round = m.round; net.results = []; net.finished = new Map();
      raceLen = m.length || 2000;
      if (amIn(net.racers)) beginRace(false);
      else renderLobby();
    } else if (m.t === 'pos') {
      remoteUpdate(m);
    } else if (m.t === 'finished') {
      net.finished.set(m.id, m.ms);
      const who = (net.racers.find(r => r.id === m.id) || {}).name || 'Qualcuno';
      if (m.id === myId) {
        say(m.ms != null ? 'Arrivo! ' + fmtTime(m.ms) : 'Tempo non valido', '#1f8a4c');
      } else if (racing()) {
        say(who + ' è arrivato' + (m.ms != null ? ': ' + fmtTime(m.ms) : ''), '#13233a');
      }
    } else if (m.t === 'results') {
      net.results = m.results; net.phase = 'results';
      endRaceView();
    } else if (m.t === 'left') {
      removeRemote(m.id);
    } else if (m.t === 'full') {
      menuError('La sfida è piena (massimo 8 giocatori).');
    } else if (m.t === 'voice') {
      playVoice(m);
    } else if (m.t === 'voiceOk') {
      voice.next = m.next;
      say('Vocale inviato', '#1f8a4c');
    } else if (m.t === 'voiceWait') {
      voice.next = m.next;
      say('Prossimo vocale tra ' + fmtWait(m.next - m.now), '#13233a');
    }
  }

  function renderLobby() {
    $('lobbyCode').textContent = net.code || '—';
    const link = location.origin + location.pathname + '?sfida=' + (net.code || '');
    $('linkText').textContent = link;
    const ul = $('lobbyPlayers');
    ul.innerHTML = '';
    for (const p of net.players) {
      const li = document.createElement('li');
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[p.color % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = p.name + (p.id === myId ? ' (tu)' : '');
      li.append(dot, nm);
      if (p.id === net.hostId) { const h = document.createElement('span'); h.className = 'pill host'; h.textContent = 'Organizza'; li.append(h); }
      const r = document.createElement('span'); r.className = 'pill' + (p.ready ? ' ok' : ''); r.textContent = p.ready ? 'Pronto' : 'In attesa';
      li.append(r);
      ul.append(li);
    }
    const isHost = net.hostId === myId;
    const mine = net.players.find(p => p.id === myId);
    $('btnReady').textContent = mine && mine.ready ? 'Non sono pronto' : 'Sono pronto';
    $('btnGo').hidden = !isHost;
    const busy = net.phase === 'countdown' || net.phase === 'racing';
    $('btnGo').disabled = busy;
    const n = net.players.length, ready = net.players.filter(p => p.ready).length;
    let status;
    if (!net.ws || net.ws.readyState !== 1) status = 'Collegamento al server…';
    else if (busy && !amIn(net.racers)) status = 'C\'è una gara in corso: entri nella prossima.';
    else if (n < 2) status = 'Condividi il link: la gara si può fare anche da soli, ma è meglio in compagnia.';
    else status = n + ' giocatori · ' + ready + ' pronti. ' + (isHost ? 'Quando volete, premi Parti.' : 'Parte quando l\'organizzatore preme Parti.');
    $('lobbyStatus').textContent = status;
  }
  $('btnReady').addEventListener('click', () => {
    const mine = net.players.find(p => p.id === myId);
    net.send({ t: 'ready', ready: !(mine && mine.ready) });
  });
  $('btnGo').addEventListener('click', () => net.send({ t: 'start' }));
  $('btnRematch').addEventListener('click', () => net.send({ t: 'start' }));
  $('btnCopy').addEventListener('click', async () => {
    const link = $('linkText').textContent;
    try { await navigator.clipboard.writeText(link); $('btnCopy').textContent = 'Link copiato'; setTimeout(() => ($('btnCopy').textContent = 'Copia il link'), 1800); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('linkText')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('btnCopy').textContent = 'Seleziona e copia il link qui sotto'; }
  });
  $('btnLeave').addEventListener('click', toMenu);
  $('btnResLeave').addEventListener('click', toMenu);

  function toMenu() {
    net.close();
    history.replaceState(null, '', location.pathname);
    mode = 'menu';
    me.setColor(PALETTE[0]);
    reset((Math.random() * 2 ** 31) | 0, null, false);
    hudLabels();
    setBanner('');
    show('menu');
    loadBoard();
  }

  function beginRace(late) {
    initAudio();
    const slot = Math.max(0, net.racers.findIndex(r => r.id === myId));
    const n = net.racers.length;
    const x0 = center(0) + (slot - (n - 1) / 2) * 2.6;
    mode = 'countdown';
    me.setColor(PALETTE[net.myColor % PALETTE.length]);
    reset(net.seed, x0, true);
    hudLabels();
    show(null);
    setBanner('');
    for (const r of net.racers) if (r.id !== myId) remoteFor(r.id, r, slot);
    lastCount = -1;
    if (late && serverNow() > net.startAt) {
      // rientro durante la gara: si riparte dal via, il tempo corre già
      mode = 'race';
    }
    clearInterval(net.posTimer);
    net.posTimer = setInterval(() => {
      if (!racing()) return;
      net.send({ t: 'pos', x: +P.x.toFixed(2), z: +P.z.toFixed(2), y: +P.y.toFixed(2), a: +P.ang.toFixed(3), s: +P.spin.toFixed(2), f: +P.flip.toFixed(2), g: P.grab > 0.5 ? 1 : 0, v: +P.speed.toFixed(2), c: P.crash > 0 ? 1 : 0 });
    }, 100);
  }
  let lastCount = -1;
  function raceClock() {
    const cnt = $('count');
    if (mode === 'countdown') {
      const left = net.startAt - serverNow();
      if (left <= 0) {
        mode = 'race';
        cnt.hidden = false; cnt.innerHTML = '<span>VIA!</span>';
        beep(true);
        setTimeout(() => { if (mode !== 'countdown') cnt.hidden = true; }, 800);
      } else {
        const n = Math.ceil(left / 1000);
        if (n !== lastCount) { lastCount = n; cnt.hidden = false; cnt.innerHTML = '<span>' + n + '</span>'; if (n <= 3) beep(false); }
      }
    }
    if (mode === 'race' && -P.z >= raceLen) {
      mode = 'finished';
      net.send({ t: 'finish' });
      say('Traguardo!', '#1f8a4c');
      setBanner('Sei arrivato. In attesa degli altri…');
    }
  }
  function endRaceView() {
    clearInterval(net.posTimer);
    $('count').hidden = true;
    setBanner('');
    mode = 'results';
    hideRemotes();
    hudLabels();
    renderResults();
    show('raceResults');
  }
  function renderResults() {
    $('resRound').textContent = 'Sfida ' + (net.code || '') + ' · gara ' + (net.round || 1);
    const ul = $('resList');
    ul.innerHTML = '';
    net.results.forEach((r, i) => {
      const li = document.createElement('li');
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = r.ms != null ? (i + 1) + '°' : '–';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[(r.color || 0) % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = r.name + (r.id === myId ? ' (tu)' : '');
      const tm = document.createElement('span'); tm.className = 'time'; tm.textContent = r.ms != null ? fmtTime(r.ms) : 'Non arrivato';
      li.append(pos, dot, nm, tm);
      ul.append(li);
    });
    const isHost = net.hostId === myId;
    $('btnRematch').hidden = !isHost;
    const host = net.players.find(p => p.id === net.hostId);
    $('resStatus').textContent = isHost ? 'Premi Rivincita per una nuova pista con gli stessi giocatori.' : 'In attesa che ' + (host ? host.name : 'l\'organizzatore') + ' lanci la rivincita.';
  }

  // ---------- messaggi vocali (solo in sfida, uno ogni 3 minuti: il limite lo controlla il server) ----------
  const VOICE_MAX_S = 8;
  const voice = { rec: null, stream: null, chunks: [], recording: false, startT: 0, timer: null, next: 0, mime: '' };
  const btnVoice = $('btnVoice'), voiceNow = $('voiceNow');
  const online = () => !!(net.ws && net.ws.readyState === 1) && (mode === 'lobby' || mode === 'results' || racing());
  const fmtWait = ms => { const s2 = Math.ceil(ms / 1000); return Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0'); };
  function updateVoiceBtn() {
    const on = online();
    btnVoice.hidden = !on;
    if (!on) return;
    const wait = voice.next - serverNow();
    btnVoice.classList.toggle('rec', voice.recording);
    if (voice.recording) {
      btnVoice.textContent = 'Invia · ' + Math.max(0, Math.ceil(VOICE_MAX_S - (performance.now() - voice.startT) / 1000)) + ' s';
      btnVoice.disabled = false;
    } else if (wait > 0) {
      btnVoice.textContent = 'Vocale tra ' + fmtWait(wait);
      btnVoice.disabled = true;
    } else {
      btnVoice.textContent = isPhone ? 'Parla' : 'Parla (V)';
      btnVoice.disabled = false;
    }
  }
  setInterval(updateVoiceBtn, 250);
  btnVoice.addEventListener('click', () => voiceButton());
  function pickMime() {
    if (!window.MediaRecorder) return '';
    return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  }
  function normMime(m) {
    m = (m || '').toLowerCase();
    if (m.startsWith('audio/mp4')) return 'audio/mp4';
    if (m.startsWith('audio/ogg')) return 'audio/ogg;codecs=opus';
    if (m.startsWith('audio/webm')) return m.includes('opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    return '';
  }
  async function voiceButton() {
    if (!online()) return;
    if (voice.recording) { stopVoice(); return; }
    const wait = voice.next - serverNow();
    if (wait > 0) { say('Prossimo vocale tra ' + fmtWait(wait), '#13233a'); return; }
    const mime = pickMime();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !mime) { say('Questo browser non registra audio', '#d8302a'); return; }
    try {
      voice.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { say('Microfono non disponibile', '#d8302a'); return; }
    voice.chunks = [];
    voice.mime = mime;
    try { voice.rec = new MediaRecorder(voice.stream, { mimeType: mime, audioBitsPerSecond: 24000 }); }
    catch (e) { voice.rec = new MediaRecorder(voice.stream); }
    voice.rec.ondataavailable = e => { if (e.data && e.data.size) voice.chunks.push(e.data); };
    voice.rec.onstop = sendVoice;
    voice.rec.start();
    voice.recording = true;
    voice.startT = performance.now();
    voice.timer = setTimeout(stopVoice, VOICE_MAX_S * 1000);
    updateVoiceBtn();
  }
  function stopVoice(cancel) {
    clearTimeout(voice.timer);
    if (voice.rec && voice.rec.state !== 'inactive') { if (cancel) voice.rec.onstop = null; voice.rec.stop(); }
    if (voice.stream) voice.stream.getTracks().forEach(tr => tr.stop());
    voice.stream = null;
    voice.recording = false;
    updateVoiceBtn();
  }
  function sendVoice() {
    const dur = (performance.now() - voice.startT) / 1000;
    const type = normMime((voice.rec && voice.rec.mimeType) || voice.mime);
    const blob = new Blob(voice.chunks, { type: type || voice.mime });
    voice.chunks = [];
    if (dur < 0.5 || !blob.size || !type) return;
    const fr = new FileReader();
    fr.onload = () => {
      const data = String(fr.result).split(',')[1] || '';
      if (data.length > 200000) { say('Vocale troppo lungo', '#d8302a'); return; }
      net.send({ t: 'voice', mime: type, data, dur: Math.round(dur * 10) / 10 });
    };
    fr.readAsDataURL(blob);
  }
  let voicePlaying = null;
  function playVoice(m) {
    const who = m.name || 'Qualcuno';
    if (muted) { say(who + ' ha mandato un vocale (audio spento)', '#13233a'); return; }
    try {
      const bin = atob(m.data), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: m.mime }));
      const a = new Audio(url);
      a.volume = 1;
      voiceNow.hidden = false;
      voiceNow.querySelector('b').textContent = who;
      voiceNow.querySelector('i').style.background = PALETTE[(m.color || 0) % PALETTE.length];
      const done = () => { URL.revokeObjectURL(url); if (voicePlaying === a) { voiceNow.hidden = true; voicePlaying = null; } };
      a.onended = done; a.onerror = done;
      if (voicePlaying) voicePlaying.pause();
      voicePlaying = a;
      a.play().catch(done);
    } catch (e) { voiceNow.hidden = true; }
  }

  // ---------- donazioni ----------
  const DONATE_URL = (window.CYF && window.CYF.donateUrl) || '';
  document.querySelectorAll('[data-donate]').forEach(a => { if (DONATE_URL) { a.href = DONATE_URL; a.hidden = false; } });

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
    r.tx = m.x; r.tz = m.z; r.ty = m.y; r.ta = m.a; r.s = m.s; r.f = m.f || 0; r.g = m.g ? 1 : 0; r.v = m.v; r.c = m.c; r.last = performance.now(); r.has = true;
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
      r.model.pose(Math.min(1, 0.35 + r.gs * 0.45), r.y > 0.3 ? 1 : 0.3, 0, r.gs);
    }
  }
  function hideRemotes() { for (const [, r] of remotes) r.model.group.visible = false; }
  function removeRemote(id) { const r = remotes.get(id); if (r) { world.remove(r.model.group); remotes.delete(id); } }
  function clearRemotes() { for (const id of [...remotes.keys()]) removeRemote(id); }

  function racePlace() {
    const me0 = { id: myId, d: -P.z, ms: net.finished.get(myId) };
    const list = net.racers.map(r => {
      if (r.id === myId) return me0;
      const rm = remotes.get(r.id);
      return { id: r.id, d: rm ? -rm.tz : 0, ms: net.finished.get(r.id) };
    });
    list.sort((a, b) => {
      const fa = a.ms != null, fb = b.ms != null;
      if (fa && fb) return a.ms - b.ms;
      if (fa !== fb) return fa ? -1 : 1;
      return b.d - a.d;
    });
    return { place: list.findIndex(x => x.id === myId) + 1, of: list.length };
  }

  // ---------- render ----------
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const vignette = $('vignette');
  let airCam = 0;
  function place(dt) {
    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const autoLean = mode === 'menu' || mode === 'lobby' || mode === 'results';
    lean += ((P.air || P.crash > 0 || mode === 'countdown' ? 0 : (autoLean ? Math.sin(t * 0.8) * 0.8 : steer)) - lean) * Math.min(1, 7 * dt);
    armsUp += ((P.air ? 1 : Math.abs(lean) * 0.5) - armsUp) * Math.min(1, 6 * dt);
    const crouch = clamp(0.28 + Math.abs(lean) * 0.35 + squash * 0.5 + (P.air ? 0.25 : 0), 0, 1);
    me.pose(Math.min(1, crouch + P.grab * 0.45), armsUp, P.air ? Math.sin(P.spin) * 0.3 : lean * 0.3, P.grab);

    const gH = hgt(P.x, P.z);
    rider.position.set(P.x, gH + P.y, P.z);
    rider.rotation.y = -P.ang;
    const fx = Math.sin(P.ang), fz = -Math.cos(P.ang);
    const hF = hgt(P.x + fx * 0.8, P.z + fz * 0.8), hB = hgt(P.x - fx * 0.8, P.z - fz * 0.8);
    const hR = hgt(P.x + Math.cos(P.ang) * 0.3, P.z + Math.sin(P.ang) * 0.3), hL = hgt(P.x - Math.cos(P.ang) * 0.3, P.z - Math.sin(P.ang) * 0.3);
    rider.rotation.x = P.air ? rider.rotation.x * 0.9 : Math.atan2(hF - hB, 1.6);
    rider.rotation.z = P.air ? 0 : -Math.atan2(hR - hL, 0.6) * 0.6;
    bodyTurn(body, P.crash > 0 ? (0.85 - P.crash) * 8 : P.flip, P.spin, -lean * 0.42);
    rider.visible = !(invuln > 0 && P.crash <= 0 && Math.floor(invuln * 10) % 2 === 0);

    camYaw += (P.ang * 0.5 - camYaw) * Math.min(1, 3 * dt);
    airCam += ((P.air && P.y > 0.6 ? 1 : 0) - airCam) * Math.min(1, 3 * dt);
    const back = 6.6 + airCam * 1.6;
    const cx = P.x - Math.sin(camYaw) * back, cz = P.z + Math.cos(camYaw) * back;
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
    updateTrail();
  }

  // ---------- HUD ----------
  let hudT = 0;
  function hud(dt) {
    hudT += dt;
    if (hudT < 0.08) return;
    hudT = 0;
    $('vSpeed').textContent = Math.round(kmh(P.speed)) + ' km/h';
    if (racing()) {
      const el = mode === 'countdown' ? 0 : (net.finished.get(myId) ?? Math.max(0, serverNow() - net.startAt));
      $('v1').textContent = fmtTime(el);
      const pl = racePlace();
      $('v2').textContent = pl.place + '° di ' + pl.of;
      $('v4').textContent = fmt(Math.max(0, raceLen - distM())) + ' m';
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
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
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

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (mode === 'solo') { update(dt, false); hud(dt); }
    else if (racing()) { raceClock(); update(dt, false); updateRemotes(dt); hud(dt); }
    else if (mode === 'menu' || mode === 'lobby' || mode === 'results') update(dt, true);
    else if (mode === 'over') { updateSpray(dt); updateFlakes(dt, P.x, P.z, 0); }
    place(mode === 'pause' ? 0 : dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  applyTheme(theme);
  reset((Math.random() * 2 ** 31) | 0, null, false);
  hudLabels();
  loadBoard();
  const invite = new URLSearchParams(location.search).get('sfida');
  if (invite) {
    inCode.value = invite.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (inName.value.trim()) connect(inCode.value);
    else { menuError(''); inName.focus(); $('btnJoin').textContent = 'Entra nella sfida'; }
  }
  requestAnimationFrame(frame);
})();
