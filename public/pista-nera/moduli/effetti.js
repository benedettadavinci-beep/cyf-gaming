// modulo: effetti
// dipende da: base
// Effetti visivi: scia della tavola (trail), spruzzi di neve o polvere (spray), scintille delle acrobazie (sparkle)
// e particelle in aria (fiocchi, foglie, pioggia: flakes). Solo grafica, niente stato di gioco.
// Si crea con PN.effetti({ world, hgt }) una volta sola, dal gioco.
window.PN = window.PN || {};
PN.effetti = ({ world, hgt }) => {
  const { isPhone, lin, rand, reduceMotion } = PN.base;
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
  // trailPts: gli ultimi punti della scia, dal più vecchio al più recente ({ x, y, z, a, on })
  function updateTrail(trailPts) {
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
  const SPRAY_N = 500;
  const pPos = new Float32Array(SPRAY_N * 3), pVel = new Float32Array(SPRAY_N * 3), pLife = new Float32Array(SPRAY_N), pFloor = new Float32Array(SPRAY_N);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const sprayPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: lin('#ffffff'), size: 0.18, map: dotTex, transparent: true, opacity: 0.9, depthWrite: false }));
  sprayPts.frustumCulled = false;
  world.add(sprayPts);
  let pNext = 0;
  for (let i = 0; i < SPRAY_N; i++) pPos[i * 3 + 1] = -999;
  function spray(x, y, z, n, power, up = 3, dirX = 0) {
    if (reduceMotion) n = Math.ceil(n / 3);
    const floor = hgt(x, z);
    for (let k = 0; k < n; k++) {
      const i = pNext; pNext = (pNext + 1) % SPRAY_N;
      pPos[i * 3] = x + rand(-0.35, 0.35); pPos[i * 3 + 1] = floor + y + 0.1; pPos[i * 3 + 2] = z + rand(-0.35, 0.35);
      pVel[i * 3] = rand(-1, 1) * power + dirX; pVel[i * 3 + 1] = rand(0.4, 1) * up; pVel[i * 3 + 2] = rand(-0.4, 1) * power;
      pLife[i] = rand(0.4, 0.9); pFloor[i] = floor;
    }
  }
  function updateSpray(dt) {
    for (let i = 0; i < SPRAY_N; i++) {
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
  // PART: particelle dello scenario ({ fall, sway, … }) o null; t: tempo di gioco in secondi
  function updateFlakes(dt, px, pz, speed, PART, t) {
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

  return { TRAIL_N, trailMesh, sprayPts, flakes, spray, updateSpray, sparkle, updateSparks, updateTrail, updateFlakes };
};
