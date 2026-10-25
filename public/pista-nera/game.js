// Pista Nera — C-Y-F Gaming
// Snowboard 3D con modalità allenamento (da solo) e sfida online (stanza con codice, stessa pista per tutti).
(() => {
  const $ = id => document.getElementById(id);
  // registro eventi e pannello di debug (diagnosi.js): se manca, il gioco funziona lo stesso
  const diag = window.CYFDiag || { log() {}, tapToOpen() {}, report() {} };
  const stage = $('stage');
  const cvs = $('game');

  if (!window.THREE) { $('glErr').hidden = false; return; }

  const { TAU, SLOPE_DEG, SLOPE, START_ALT, HORIZON, PALETTE, reduceMotion, isPhone, rand, clamp, fmt, fmtTime, lin, store, mulberry32 } = PN.base;
  const L = PN.lingua;
  const { DICT, LANGS, tr, ord, fmtLen } = L;
  let lang = L.lang;

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

  const PISTA = PN.pista({ scene, world, ANISO, TEX });
  const { TRACKS, center, hgt, groundCanvas, stoneTexture, sampietriniTexture, GROUND_TEX, GROUND_MAKE, groundMat, ground, updateGround, ranges } = PISTA;

  const { builtSky, skylineFor } = PN.sfondi({ scene, ANISO });
  const { merge, lumpy, vcMat, GEO, gateGeo } = PN.geometria;
  const CITTA = PN.citta({ world, ANISO, pista: PISTA });
  const { CITY_CFG, facadesFor, roofFor, buildingGeo, gemGeo, gemMat, textTexture, finishLine, rampCity, propGeos } = CITTA;
  const assets = () => CITTA.assetsFor(theme);
  const { addMesh } = PISTA;
  const { JERSEYS, myJersey, jacketTexture, switchOf, bodyTurn, makeRider } = PN.rider;
  const me = makeRider(PALETTE[0]);
  world.add(me.group);
  const rider = me.group, body = me.body;

  const EFF = PN.effetti({ world, hgt });
  const { TRAIL_N, trailMesh, sprayPts, flakes, spray, updateSpray, sparkle, updateSparks } = EFF;
  let trailPts = [];
  const updateTrail = () => EFF.updateTrail(trailPts);
  const updateFlakes = (dt, px, pz, speed) => EFF.updateFlakes(dt, px, pz, speed, PART, t);
  const AUDIO = PN.audio({ btnSound: $('btnSound'), isCity: () => !!THEMES[theme].city, isActive: () => mode === 'solo' || mode === 'race' });
  const { initAudio, tone, thump, chime, beep, soundLevels } = AUDIO;
  const setMuted = m => AUDIO.setMuted(m);
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
    PISTA.setTrack(theme);
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
    PISTA.resetGround();
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
    if (AUDIO.audio) AUDIO.audio.carveF.frequency.value = T.city ? 900 : 2600;
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
  let wallT = 0, tricksN = 0, near500 = false, P, bonus, lives, invuln, combo, trailT, shake, maxSpeed, bestSpin, overTimer, overReason, t = 0, camYaw, lean, camY, squash, armsUp;
  let finishObj = null, raceLen = 2000;
  const racing = () => mode === 'countdown' || mode === 'race' || mode === 'finished';
  const distM = () => Math.max(0, -P.z);
  const score = () => Math.floor(distM()) + bonus;
  const kmh = v => v * 3.6;
  // Lo stato del gioco visto dai moduli (oggetti, avversari, …): leggono qui invece di tenere copie proprie.
  // Solo "bonus" si può anche scrivere (banane e bombe si pagano con i punti della gara).
  const stato = {
    get P() { return P; }, get mode() { return mode; }, get invuln() { return invuln; }, get raceLen() { return raceLen; },
    get bonus() { return bonus; }, set bonus(v) { bonus = v; },
    get myId() { return myId; }, get theme() { return theme; }, racing, isCity,
    // per le schermate (si leggono solo dopo l'avvio, quando tutto è già definito)
    get net() { return net; }, serverNow: () => serverNow(), get lives() { return lives; }, get myTotal() { return myTotal; },
    distM: () => distM(), score: () => score(), racePlace: () => racePlace(), renderLive: l => renderLive(l), amIn: l => amIn(l), toMenu: () => toMenu()
  };

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
    GEN.svuota();
    if (finishObj) { world.remove(finishObj); finishObj = null; }
  }
  let lastSeed = 0;
  function reset(seed, x0, withFinish) {
    lastSeed = seed;
    diag.log('pista', 'seed ' + seed + ' · ' + theme + (withFinish ? ' · con traguardo' : ''));
    clearWorld();
    GEN.riparti(seed);
    P = { x: x0 != null ? x0 : center(0), y: 0, z: 0, prevZ: 0, ang: 0, speed: 9, vy: 0, spin: 0, flip: 0, grab: 0, grabT: 0, idleAir: 0, airT: 0, air: false, crash: 0, ramp: false, onRamp: null };
    trailPts = [];
    bonus = 0; lives = 3; invuln = 0; combo = 0; trailT = 0; shake = 0;
    maxSpeed = 0; bestSpin = 0; overTimer = 0; overReason = ''; tricksN = 0; near500 = false;
    clearHazards();
    camYaw = 0; lean = 0; camY = NaN; squash = 0; armsUp = 0;
    renderLives();
    PISTA.resetGround();
    updateGround(P.x, P.z);
    if (withFinish) finishObj = finishLine(-raceLen, raceLen);
    ensureSpawned();
  }

  const GEN = PN.generazione({ world, ANISO, pista: PISTA, citta: CITTA, stato });
  const { ensureSpawned, removeObj } = GEN;

  const COMANDI = PN.comandi({ audio: AUDIO, stato, azioni: {
    jump: () => jump(), togglePause: () => togglePause(), setMuted, voiceButton: () => voiceButton(), useItem: (...a) => useItem(...a),
    enterInInput: () => { if (inCode.value.trim()) joinFromMenu(); }
  } });
  const { keys, stick, inSteer, inFast, inSlow, stickRest } = COMANDI;
  const SCHERMATE = PN.schermate({ diag, stato });
  const { show, banner, setBanner, hudLabels, say, renderLobby, renderLobbyStatus, renderResults, renderResultsStatus, hud, renderLives, loadBoard } = SCHERMATE;
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
  $('btnSound').addEventListener('click', () => { initAudio(); setMuted(!AUDIO.muted); });
  setMuted(AUDIO.muted);

  function jump() {
    if ((mode !== 'solo' && mode !== 'race') || P.air || P.crash > 0) return;
    // salto premuto mentre si sale sulla rampa: si stacca dalla rampa da dov'è il rider (R-219). Prima il rider restava
    // "sulla rampa" anche in aria e l'atterraggio non scattava mai: sprofondava sotto terra all'infinito
    P.onRamp = null;
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
      // in aria non si è mai sulla rampa: se succede lo stesso (stato incoerente), si atterra comunque (R-219)
      if (P.y <= 0) { P.onRamp = null; land(); }
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
    for (const o of GEN.objs) if (o.type === 'gem') { if (!o.food) o.mesh.rotation.y += dt * 2.5; o.mesh.position.y = hgt(o.x, o.z) + 0.9 + Math.sin(t * 3 + o.phase) * 0.15; }
    updateSpray(dt);
    updateSparks(dt);
    updateFlakes(dt, P.x, P.z, P.speed);
    soundLevels(P.speed, Math.abs(P.ang) + Math.abs(steer) * 0.5, onSnow);
    if (overTimer > 0) { overTimer -= dt; if (overTimer <= 0) soloOver(); }
  }

  function collide() {
    if (mode === 'solo' && lives <= 0) return;
    let taken = false;
    const objs = GEN.objs;
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
    if (taken) GEN.objs = objs.filter(o => !o.taken);
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
  me.setLook(myId);   // capelli a caso ma sempre uguali per questo giocatore (R-220)
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
      ws.send(JSON.stringify({ t: 'hello', v: PN.protocollo.VERSIONE, id: myId, name: inName.value.trim() || 'Rider', j: myJersey(), sc: selScena.value }));
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
      if (ev.code === 4001) { net.want = false; toMenu(); menuError(tr('errAggiorna')); return; }   // versione del protocollo diversa
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
    } else if (m.t === 'aggiorna') {
      // il server parla una versione nuova del protocollo: questa pagina è vecchia (la chiusura 4001 porta al menu)
      say(tr('errAggiorna'), '#d8302a');
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

  const VOCALI = PN.vocali({ net, audio: AUDIO, say, isOnline: () => !!(net.ws && net.ws.readyState === 1) && (mode === 'lobby' || mode === 'results' || racing()), isTraining: () => mode === 'solo' || mode === 'pause', serverNow });
  const { voice, fmtWait, updateVoiceBtn, voiceButton, stopVoice, playVoice, mutedIds } = VOCALI;
  // ---------- donazioni ----------
  const DONATE_URL = (window.CYF && window.CYF.donateUrl) || '';
  document.querySelectorAll('[data-donate]').forEach(a => { if (DONATE_URL) { a.href = DONATE_URL; a.hidden = false; } });

  const OGG = PN.oggetti({ world, ground, camera, cvs, pista: PISTA, effetti: EFF, audio: AUDIO, net, say, crash, stato });
  const { hazards, addHazard, removeHazard, clearHazards, updateHazards, collideHazards, useItem } = OGG;
  const AVV = PN.avversari({ world, pista: PISTA, net, stato });
  const { remotes, nameSprite, remoteFor, remoteUpdate, updateRemotes, hideRemotes, removeRemote, clearRemotes, standings, racePlace, renderLive } = AVV;

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
    for (const o of GEN.objs) {
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
    lang = L.setLang(l);
    store.set('cyf.lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = tr(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = tr(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = tr(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', tr(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-label]').forEach(el => { el.label = tr(el.dataset.i18nLabel); });   // gruppi dei menu
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.title = tr('pageTitle');
    hudLabels();
    setMuted(AUDIO.muted);
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
