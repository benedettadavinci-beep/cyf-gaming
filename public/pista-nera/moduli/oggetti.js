// modulo: oggetti
// dipende da: base, lingua, geometria, pista, effetti, audio, protocollo
// Banane e bombe (R-113): modelli, lancio e posa, urto con il rider, pulsanti e doppio clic sulla pista.
// Si crea con PN.oggetti({ world, ground, camera, cvs, pista, effetti, audio, net, say, crash, stato }) dal gioco:
// stato dà lo stato del gioco (P, mode, invuln, bonus in lettura e scrittura, myId).
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
    const { P, myId } = stato;
    if (stato.invuln > 0 || P.crash > 0) return;
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
    const { P, mode, myId } = stato;
    if (mode !== 'race' || !net.ws) { if (mode === 'solo') say(tr('itemsRaceOnly'), '#13233a'); return; }
    if (stato.bonus < COST[kind]) { say(tr('needPoints', { p: COST[kind] }), '#d8302a'); return; }
    if (performance.now() - (useItem.last || 0) < 950) return;
    useItem.last = performance.now();
    stato.bonus -= COST[kind];
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

  return { hazards, addHazard, removeHazard, clearHazards, updateHazards, collideHazards, useItem };
};
