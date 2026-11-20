// modulo: scudi
// dipende da: base, lingua, pista
// R-545 (dalla 0.37.0): scudi sulla pista. Tre tipi di bolle colorate con la faccina, che galleggiano sopra la pista:
//   viola  = scudo anti-bananone per 15 s, giallo-verde = scudo anti-banana per 15 s, azzurro = scudo anti-bomba per 20 s.
// Di ogni tipo ce ne sono tante quanti i corridori della gara (allenamento da solo: 1, con gli avversari del computer:
// loro + te). Posti uguali per tutti (dal seme della pista). Chi ne ha uno attivo non ne può prendere un altro finché
// non finisce: gli scudi non si sommano. Quando è attivo il rider è dentro una bolla dello stesso colore e in alto c'è il
// conto alla rovescia. Ogni giocatore raccoglie le sue (come le gemme): prenderne una non la toglie agli altri.
// Si crea con PN.scudi({ world, pista, say, stato }) dal gioco; stato dà P, mode, raceLen e conta() (quanti corridori).
window.PN = window.PN || {};
PN.scudi = ({ world, pista, say, stato }) => {
  const { TAU, lin, mulberry32 } = PN.base;
  const { tr } = PN.lingua;
  const { center, hgt } = pista;
  const TIPI = {
    bananone: { durata: 15, colore: '#9b59ff', icona: '🍌🍌' },
    banana: { durata: 15, colore: '#b8e62e', icona: '🍌' },
    bomb: { durata: 20, colore: '#2ec4ff', icona: '💣' }
  };
  // ---------- forme: bolla trasparente, anello, faccina sorridente, e dentro il disegno di quello da cui protegge ----------
  const bollaGeo = new THREE.SphereGeometry(0.85, 24, 16);
  const anelloGeo = new THREE.TorusGeometry(1.0, 0.07, 8, 32);
  const occhioGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const boccaGeo = new THREE.TorusGeometry(0.22, 0.04, 6, 16, Math.PI);
  const bananaGeo = new THREE.TorusGeometry(0.26, 0.07, 8, 16, 2.0);
  const bombaGeo = new THREE.SphereGeometry(0.22, 14, 10);
  const miccia = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6);
  const nero = new THREE.MeshBasicMaterial({ color: lin('#1b1d22') });
  const giallo = new THREE.MeshBasicMaterial({ color: lin('#f4d03f') });
  const corda = new THREE.MeshBasicMaterial({ color: lin('#c9b48a') });
  const mat = {};
  for (const k in TIPI) {
    const c = lin(TIPI[k].colore);
    mat[k] = {
      bolla: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.42, depthWrite: false }),
      anello: new THREE.MeshBasicMaterial({ color: c }),
      intorno: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
    };
  }
  function crea(kind) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(bollaGeo, mat[kind].bolla); g.add(b);
    const a = new THREE.Mesh(anelloGeo, mat[kind].anello); a.rotation.x = Math.PI / 2; g.add(a);
    // faccina sul davanti (verso chi arriva, +z: si scende verso -z)
    const f = new THREE.Group(); f.position.z = 0.8; g.add(f);
    for (const s of [-1, 1]) { const o = new THREE.Mesh(occhioGeo, nero); o.position.set(s * 0.22, 0.18, 0); f.add(o); }
    const bo = new THREE.Mesh(boccaGeo, nero); bo.rotation.z = Math.PI; bo.position.y = -0.04; f.add(bo);
    // dentro: banana, due banane (bananone) o bomba, con la riga rossa di "vietato" sopra
    const d = new THREE.Group(); d.position.y = -0.05; g.add(d);
    if (kind === 'bomb') {
      d.add(new THREE.Mesh(bombaGeo, nero));
      const m = new THREE.Mesh(miccia, corda); m.position.y = 0.27; d.add(m);
    } else {
      const n = kind === 'bananone' ? 2 : 1;
      for (let i = 0; i < n; i++) { const bn = new THREE.Mesh(bananaGeo, giallo); bn.rotation.z = Math.PI / 2 - 1.0; bn.position.x = (i - (n - 1) / 2) * 0.22; bn.scale.setScalar(kind === 'bananone' ? 1.2 : 1); d.add(bn); }
    }
    const no = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: lin('#e8302a') }));
    no.rotation.z = -0.75; no.position.z = 0.3; d.add(no);
    return g;
  }
  // ---------- bolle sulla pista ----------
  let lista = [], seme = 0, messe = -1;
  function svuota() { for (const s of lista) if (s.mesh) world.remove(s.mesh); lista = []; }
  function nuova(seed) { svuota(); seme = seed >>> 0; messe = -1; attivo = null; mostraBadge(); }
  function metti(n) {
    svuota(); messe = n;
    const rnd = mulberry32((seme ^ 0x5c0d1) >>> 0);
    const kinds = []; for (let i = 0; i < n; i++) kinds.push('bananone', 'banana', 'bomb');
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    const L = Math.max(600, stato.raceLen || 2000), da = 120, a = L - 120, passo = (a - da) / kinds.length;
    kinds.forEach((kind, i) => {
      const z = -(da + (i + 0.2 + rnd() * 0.6) * passo);
      const x = center(z) + (rnd() - 0.5) * 12;
      const mesh = crea(kind);
      mesh.position.set(x, hgt(x, z) + 1.5, z);
      world.add(mesh);
      lista.push({ kind, x, z, mesh, fase: rnd() * TAU });
    });
  }
  // ---------- scudo attivo ----------
  let attivo = null, avvisoT = 0, paratoT = 0, t = 0;
  const intorno = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), mat.banana.intorno);
  intorno.visible = false; world.add(intorno);
  let badge = null;
  function mostraBadge() {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'scudoBadge';
      badge.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;padding:6px 14px;border-radius:20px;'
        + 'font:700 16px system-ui,sans-serif;color:#fff;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.25);display:none';
      document.body.appendChild(badge);
    }
    const gioca = stato.mode === 'race' || stato.mode === 'solo';
    if (!attivo || !gioca) { badge.style.display = 'none'; return; }
    const s = Math.max(0, Math.ceil((attivo.fine - performance.now()) / 1000));
    badge.style.display = 'block';
    badge.style.background = TIPI[attivo.kind].colore;
    badge.textContent = '🛡️ ' + TIPI[attivo.kind].icona + '  ' + s + ' s';
  }
  const protegge = kind => !!(attivo && attivo.kind === kind && performance.now() < attivo.fine);
  // chiamato quando uno scudo para un colpo: messaggio (al massimo uno al secondo)
  function parato(kind) {
    if (t - paratoT < 1) return;
    paratoT = t;
    say(tr('scudoParato', { k: tr('scudo_' + kind) }), TIPI[kind].colore);
  }
  function aggiorna(dt) {
    t += dt;
    const { P, mode } = stato;
    const gioca = mode === 'race' || mode === 'solo' || mode === 'countdown';
    if (gioca && P) {
      const n = Math.max(1, stato.conta());
      if (messe < 0 || (n !== messe && P.z > -20)) metti(n);   // all'inizio, o se arrivano gli avversari del computer prima dei 20 m
    }
    if (attivo && performance.now() >= attivo.fine) { attivo = null; say(tr('scudoFinito'), '#13233a'); }
    for (const s of lista) {
      if (!s.mesh) continue;
      s.mesh.rotation.y = Math.sin(t * 1.3 + s.fase) * 0.5;
      s.mesh.position.y = hgt(s.x, s.z) + 1.5 + Math.sin(t * 2.2 + s.fase) * 0.25;
      if (!P || !(mode === 'race' || mode === 'solo') || P.crash > 0) continue;
      const dx = s.x - P.x, dz = s.z - P.z;
      if (Math.abs(dz) > 3 || dx * dx + dz * dz > 1.6 * 1.6 || P.y > 3.5) continue;
      if (attivo) { if (t - avvisoT > 2) { avvisoT = t; say(tr('scudoGia'), '#8a8f98'); } continue; }   // non si sommano
      world.remove(s.mesh); s.mesh = null;
      attivo = { kind: s.kind, fine: performance.now() + TIPI[s.kind].durata * 1000 };
      intorno.material = mat[s.kind].intorno;
      say(tr('scudoPreso', { k: tr('scudo_' + s.kind), s: TIPI[s.kind].durata }), TIPI[s.kind].colore);
    }
    const on = !!attivo && P && (mode === 'race' || mode === 'solo');
    intorno.visible = on;
    if (on) { intorno.position.set(P.x, hgt(P.x, P.z) + P.y + 0.85, P.z); intorno.scale.setScalar(1 + Math.sin(t * 5) * 0.04); }
    mostraBadge();
  }
  return { nuova, aggiorna, protegge, parato, TIPI };
};
