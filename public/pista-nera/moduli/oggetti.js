// modulo: oggetti
// dipende da: base, lingua, geometria, pista, effetti, audio, protocollo
// Banane, bombe e bananoni (R-113, R-231): modelli, lancio e posa, urto con il rider, pulsanti e doppio clic sulla pista.
// Si crea con PN.oggetti({ world, ground, camera, cvs, pista, effetti, audio, net, say, crash, stato }) dal gioco:
// stato dà lo stato del gioco (P, mode, invuln, bonus in lettura e scrittura, myId, remotes, throwAnim()).
window.PN = window.PN || {};
PN.oggetti = ({ world, ground, camera, cvs, pista, effetti, audio, net, say, crash, stato }) => {
  const { TAU, clamp, lin } = PN.base;
  const { tr } = PN.lingua;
  const { merge, vcMat } = PN.geometria;
  const { center, hgt, addMesh } = pista;
  const { spray, sparkle } = effetti;
  const { thump } = audio;
  const $ = id => document.getElementById(id);
  // ---------- banane e bombe: si pagano con i punti della gara e fanno cadere gli altri ----------
  const COST = PN.protocollo.COSTI;   // i costi li conosce anche il server (shared/protocollo.js)
  const STOP = PN.protocollo.FERMO;   // secondi di fermo per chi viene colpito (R-223, R-224)
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
  HAZ_GEO.bananone = HAZ_GEO.banana.clone().scale(3.4, 3.4, 3.4);   // bananone: grande il doppio della banana (R-231)
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
    if (h.chase) {   // banana lanciata a un giocatore (R-224): segue il bersaglio e sparisce quando lo raggiunge
      const tg = h.chase(), k = Math.min(1, h.t / 0.45);
      const x = h.fly.x0 + (tg.x - h.fly.x0) * k, z = h.fly.z0 + (tg.z - h.fly.z0) * k;
      h.mesh.position.set(x, hgt(x, z) + h.fly.y0 * (1 - k) + 0.8 * k + Math.sin(k * Math.PI) * 2.5, z);
      h.mesh.rotation.y += 0.5;
      if (k >= 1) removeHazard(h.hid);
      return;
    }
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
      if (h.fly || h.chase) placeHazard(h);
      if (h.spark) h.spark.visible = Math.floor(h.t * 4) % 2 === 0;
    }
  }
  function collideHazards() {
    const { P, myId } = stato;
    if (stato.invuln > 0 || P.crash > 0) return;
    for (const [hid, h] of hazards) {
      if (!h.armed || h.chase || h.owner === myId) continue;
      const dx = h.x - P.x, dz = h.z - P.z, d2 = dx * dx + dz * dz;
      const hit = h.kind === 'bomb' ? (d2 < 2.4 * 2.4 && P.y < 1.6) : h.kind === 'bananone' ? (d2 < 2.0 * 2.0 && P.y < 1.2) : (d2 < 1.0 && P.y < 0.7);
      if (!hit) continue;
      if (h.kind === 'bomb') { spray(h.x, 0.5, h.z, 90, 7, 8); sparkle(h.x, hgt(h.x, h.z) + 0.6, h.z, 80, true); thump(2); }
      removeHazard(hid);
      net.send({ t: 'hit', hid, owner: h.owner, kind: h.kind });
      crash(tr(h.kind === 'bomb' ? 'crashBomb' : h.kind === 'bananone' ? 'crashBananone' : 'crashBanana'), STOP[h.kind] || STOP.banana);   // bomba e bananone: fermo 4 s, banana: 2 s (R-223, R-231)
      return;
    }
  }
  // il giocatore più vicino davanti (più avanti sulla pista, a qualunque distanza), o null (S-34)
  function aheadOf(P) {
    let best = null, bd = Infinity;
    for (const [id, r] of stato.remotes) {
      if (!r.has || !r.model.group.visible) continue;
      const d = P.z - r.z;   // si scende verso -z: davanti vuol dire z più piccola
      if (d > 2 && d < bd) { bd = d; best = { id, r }; }
    }
    return best;
  }
  const nameOf = id => { const x = net.racers.find(q => q.id === id); return x ? x.name : tr('someone'); };
  // una banana (o un bananone) che vola da chi la lancia (codice o io) a chi la riceve: la vedono tutti (R-224, R-231)
  function showThrow(fromId, toId, hid, kind) {
    const { P, myId } = stato;
    const pos = id => { if (id === myId) return { x: P.x, z: P.z, y: P.y }; const r = stato.remotes.get(id); return r ? { x: r.x, z: r.z, y: r.y } : null; };
    const a = pos(fromId), b = pos(toId);
    if (!a || !b || hazards.has(hid)) return;
    const h = { hid, owner: fromId, kind: kind === 'bananone' ? 'bananone' : 'banana', x: b.x, z: b.z, chase: () => pos(toId) || b };
    addHazard(h, { x: a.x, z: a.z, y: a.y + 1.4 });
  }
  // bomba: si lascia dietro di sé. Banana: si lancia sempre, dal pulsante, dal tasto B o con il doppio tocco (R-224, R-230);
  // bananone: si lancia come la banana, dal pulsante grande o dal tasto G (R-231):
  // al giocatore più vicino davanti se c'è, altrimenti cade sulla pista davanti (nel punto toccato o 30 m più avanti)
  function useItem(kind, target) {
    const { P, mode, myId } = stato;
    if (net.daily) return;   // pista del giorno: si corre da soli (S-40)
    if (mode !== 'race' || !net.ws) { if (mode === 'solo') say(tr('itemsRaceOnly'), '#13233a'); return; }
    if (stato.bonus < COST[kind]) { say(tr('needPoints', { p: COST[kind] }), '#d8302a'); return; }
    if (performance.now() - (useItem.last || 0) < 950) return;
    useItem.last = performance.now();
    stato.bonus -= COST[kind];
    const hid = myId + '-' + net.round + '-' + (++hazN);
    const lancio = PN.protocollo.THROW_KINDS.includes(kind);
    if (lancio) {
      stato.throwAnim();   // gesto del braccio
      if (!target) { const tz = P.z - 30; target = { x: center(tz) + clamp(P.x - center(P.z), -12, 12), z: tz }; }
      const ah = aheadOf(P);
      if (ah) {
        net.send({ t: 'throw', target: ah.id, hid, kind });
        if (stato.colpo) stato.colpo(ah.id, kind);   // il bersaglio è un avversario del software guidato da qui (R-234)
        showThrow(myId, ah.id, hid, kind);
        say(tr(kind === 'bananone' ? 'bananoneThrownAt' : 'bananaThrownAt', { n: nameOf(ah.id) }) + '  −' + COST[kind], '#8a6d3b');
        return;
      }
    }
    let x = P.x - Math.sin(P.ang) * 3, z = P.z + Math.cos(P.ang) * 3;
    if (target) { x = target.x; z = target.z; }
    addHazard({ hid, owner: myId, kind, x, z }, target ? { x: P.x, z: P.z, y: P.y + 1 } : null);
    net.send({ t: 'drop', kind, x: +x.toFixed(2), z: +z.toFixed(2), hid });
    say(tr(kind === 'bomb' ? 'bombDropped' : kind === 'bananone' ? 'bananoneThrown' : (target ? 'bananaThrown' : 'bananaDropped')) + '  −' + COST[kind], '#8a6d3b');
  }
  $('btnBanana').addEventListener('click', () => useItem('banana'));
  $('btnBomb').addEventListener('click', () => useItem('bomb'));
  $('btnBananone').addEventListener('click', () => useItem('bananone'));
  // doppio clic (o doppio tocco) sulla pista: la banana vola nel punto indicato, sempre davanti al rider
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let lastTap = { t: 0, x: 0, y: 0 };
  cvs.addEventListener('pointerdown', e => {
    const now = performance.now();
    const dbl = now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40;
    lastTap = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
    if (!dbl || stato.mode !== 'race') return;
    const { P } = stato;
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

  return { hazards, addHazard, removeHazard, clearHazards, updateHazards, collideHazards, useItem, showThrow };
};
