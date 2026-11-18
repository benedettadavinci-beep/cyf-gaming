// modulo: modello
// dipende da: base
// R-534 (dalla 0.32.0): il rider come personaggio 3D vero, con lo scheletro, al posto delle forme geometriche.
// Modelli: Quaternius "Universal Base Characters" (CC0, uso commerciale libero), preparati da tools/modelli/prepara_rider.py
// in modelli/rider-m.glb e rider-f.glb: corpo diviso in pezzi (testa, giacca, braccia, avambracci, mani, pantaloni,
// piedi), giacca e pantaloni imbottiti, capelli e sopracciglia legati all'osso della testa.
// Questo modulo carica i file una volta (solo quando servono, uno per sesso), crea un personaggio per rider e lo mette
// nella stessa posa del vecchio modello: rider.js gli passa i punti della posa (caviglie, ginocchia, anche, spalle,
// gomiti, mani) e le rotazioni di bacino, busto e testa; qui le gambe e le braccia si piegano con l'IK a due ossa.
// Se il file non si carica resta il rider di prima. Con ?rider=vecchio nell'indirizzo si rivede il rider di prima.
window.PN = window.PN || {};
PN.modello = (() => {
  const { lin } = PN.base;
  const DOVE = (() => { try { return new URL('../modelli/', document.currentScript.src).href; } catch (e) { return '/pista-nera/modelli/'; } })();
  const ACCESO = true;   // 0.32.1: acceso per tutti dopo le foto della notte del 19/11
  const SPENTO = (() => { try {
    if (typeof THREE.GLTFLoader !== 'function' || typeof THREE.SkeletonUtils !== 'object') return true;
    const q = location.search;
    return /[?&]rider=vecchio\b/.test(q) || !(ACCESO || /[?&]rider=nuovo\b/.test(q));
  } catch (e) { return true; } })();
  // misure: il modello è alto ~1,8 m; con 0,92 le gambe sono lunghe come quelle del vecchio rider
  const SCALA = 0.92;
  const sessi = {};   // 'm' | 'f' → { stato: 'carica' | 'pronto' | 'errore', attesa: [cb], modello }
  function quando(sesso, cb) {
    if (SPENTO) return;
    let S = sessi[sesso];
    if (!S) {
      S = sessi[sesso] = { stato: 'carica', attesa: [] };
      new THREE.GLTFLoader().load(DOVE + 'rider-' + sesso + '.glb', gltf => {
        try { S.modello = prepara(gltf.scene); S.stato = 'pronto'; } catch (e) { S.stato = 'errore'; console.warn('modello rider', e); }
        const a = S.attesa; S.attesa = [];
        if (S.stato === 'pronto') for (const f of a) { try { f(); } catch (e) { console.warn('modello rider', e); } }
      }, undefined, e => { S.stato = 'errore'; S.attesa = []; console.warn('modello rider non caricato', e); });
    }
    // sempre dopo: chi chiama (makeRider) finisce di costruire il rider prima che arrivi il personaggio
    if (S.stato === 'pronto') Promise.resolve().then(cb); else if (S.stato === 'carica') S.attesa.push(cb);
  }
  const pronto = sesso => !!(sessi[sesso] && sessi[sesso].stato === 'pronto');

  // ---------- materiali propri del modello (con skinning, condivisi da tutti i rider) ----------
  const SK = (c, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: lin(c), roughness: 0.75, metalness: 0, skinning: true }, extra || {}));
  let MAT = null;
  const matCapelli = {};
  function materiali(scene) {
    const tex = {};
    scene.traverse(o => { if (o.isMesh && o.material.map) tex[o.name.startsWith('capelli_') ? 'capelli' : o.name] = o.material.map; });
    return tex;
  }
  // capelli e sopracciglia: texture grigia colorata con il colore scelto (HAIR_COLORS di rider.js)
  function capelliMat(T, hex) {
    const k = T.id + hex;
    if (!matCapelli[k]) matCapelli[k] = SK(hex, { map: T.tex.capelli, roughness: 0.85, side: THREE.DoubleSide });
    return matCapelli[k];
  }
  function sopraccigliaMat(hex) {
    const k = 'sop' + hex;
    if (!matCapelli[k]) { matCapelli[k] = SK(hex, { roughness: 0.9, side: THREE.DoubleSide }); matCapelli[k].color.multiplyScalar(0.75); }
    return matCapelli[k];
  }

  // ---------- preparazione di un file caricato (una volta per sesso) ----------
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  let nextId = 1;
  function prepara(scene) {
    if (!MAT) MAT = { guanto: SK('#141414'), scarpone: SK('#1b1b1b'), scarpa: SK('#2b2f36') };
    const tex = materiali(scene);
    scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material; m.skinning = true; m.roughness = 0.75; m.metalness = 0;
      if (m.map) m.map.encoding = THREE.sRGBEncoding;
    });
    // pose di riposo di ogni osso, nello spazio del modello (radice senza rotazione e scala)
    const g = new THREE.Group(); g.add(scene); g.updateMatrixWorld(true);
    const riposo = {};
    scene.traverse(o => {
      if (!o.isBone) return;
      riposo[o.name] = { q: o.getWorldQuaternion(new THREE.Quaternion()), p: o.getWorldPosition(new THREE.Vector3()), ql: o.quaternion.clone(), pl: o.position.clone() };
    });
    // cornice della testa: dove stanno, attorno all'osso della testa, i caschi, la maschera e lo scaldacollo del vecchio
    // rider (pensati per una testa a uovo con il davanti +x, la cima a y = 0,142, larga ±0,09 e profonda ±0,108)
    const testa = scene.getObjectByName('testa');
    const sk = testa.skeleton, iTesta = sk.bones.findIndex(b => b.name === 'Head');
    const P = testa.geometry.attributes.position, JI = testa.geometry.attributes.skinIndex, WE = testa.geometry.attributes.skinWeight;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = min.clone().negate();
    const yCollo = riposo.Head.p.y - 0.02;
    for (let i = 0; i < P.count; i++) {
      let w = 0, tot = 0;
      for (let k = 0; k < 4; k++) { const wk = WE.getComponent ? WE.getComponent(i, k) : [WE.getX(i), WE.getY(i), WE.getZ(i), WE.getW(i)][k]; tot += wk; if ([JI.getX(i), JI.getY(i), JI.getZ(i), JI.getW(i)][k] === iTesta) w += wk; }
      if (w < tot * 0.5) continue;
      tmpV.fromBufferAttribute(P, i);
      if (tmpV.y < yCollo) continue;
      min.min(tmpV); max.max(tmpV);
    }
    const centro = min.clone().add(max).multiplyScalar(0.5), mezzo = max.clone().sub(min).multiplyScalar(0.5);
    // vecchia testa: centro (0, 0,012, 0), mezze misure (davanti 0,108, alto 0,13, lato 0,09). Nel modello il davanti
    // è +z e il lato è x: davanti-dietro = mezzo.z, lato = mezzo.x
    const sc = new THREE.Vector3(mezzo.z / 0.108, (max.y - min.y) / 0.26, mezzo.x / 0.09);
    const testaModello = new THREE.Matrix4().compose(centro, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2), sc)
      .multiply(new THREE.Matrix4().makeTranslation(0, -0.012, 0));
    const cornice = new THREE.Matrix4().copy(sk.boneInverses[iTesta]).multiply(testaModello);   // dallo spazio della testa vecchia a quello dell'osso
    g.remove(scene);
    // lunghezza delle ossa delle gambe e delle braccia (metri del modello)
    const dist = (a, b) => riposo[a].p.distanceTo(riposo[b].p);
    const anche = riposo.thigh_l.p.clone().add(riposo.thigh_r.p).multiplyScalar(0.5);
    return { id: nextId++, scene, riposo, cornice, tex, anche,
      lung: { coscia: dist('thigh_l', 'calf_l'), stinco: dist('calf_l', 'foot_l'), braccio: dist('upperarm_l', 'lowerarm_l'), avambraccio: dist('lowerarm_l', 'hand_l') } };
  }

  // ---------- un personaggio (uno per rider) ----------
  // mat: materiali del rider { giacca, manica, pantaloni } (rider.js), che cambiano con setColor e setGear
  const RAD_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);   // il davanti del modello (+z) verso il petto del rider (+x)
  function crea(sesso, mat) {
    const T = sessi[sesso].modello;
    const scene = THREE.SkeletonUtils.clone(T.scene);
    const radice = new THREE.Group();
    radice.quaternion.copy(RAD_Q); radice.scale.setScalar(SCALA);
    radice.add(scene);
    for (const m of [mat.giacca, mat.manica, mat.pantaloni]) if (!m.skinning) { m.skinning = true; m.needsUpdate = true; }
    const pezzi = {}, ossa = {};
    scene.traverse(o => {
      if (o.isBone) ossa[o.name] = o;
      if (o.isMesh) { pezzi[o.name] = o; o.castShadow = true; o.frustumCulled = false; }
    });
    pezzi.giacca.material = mat.giacca; pezzi.braccia.material = mat.manica; pezzi.pantaloni.material = mat.pantaloni;
    const pelle = pezzi.testa.material;
    // pugni chiusi: le dita piegate una volta per tutte (guanti sulla neve, mani in città)
    for (const n in ossa) {
      const m = /^(index|middle|ring|pinky)_0([123])_/.exec(n);
      if (m) ossa[n].quaternion.multiply(tmpQ.setFromAxisAngle(tmpV.set(1, 0, 0), m[2] === '1' ? 0.6 : 0.9));
      else if (/^thumb_0[23]_/.test(n)) ossa[n].quaternion.multiply(tmpQ.setFromAxisAngle(tmpV.set(1, 0, 0), 0.4));
    }
    for (const n in ossa) T.riposo[n] && (ossa[n].userData.ql = ossa[n].quaternion.clone());
    // accessori della vecchia testa (caschi, maschera, elastico, scaldacollo): un gruppo legato all'osso della testa
    const accessori = new THREE.Group();
    accessori.matrixAutoUpdate = false; accessori.matrix.copy(T.cornice);
    ossa.Head.add(accessori);
    const capelli = Object.keys(pezzi).filter(n => n.startsWith('capelli_'));
    let citta = false;
    function setCitta(c) {
      citta = c;
      pezzi.mani.material = c ? pelle : MAT.guanto;
      pezzi.avambracci.material = c ? pelle : mat.manica;
      pezzi.piedi.material = c ? MAT.scarpa : MAT.scarpone;
    }
    setCitta(false);
    // stile: nome del primitivo dei capelli (o più, separati da +), colore; casco: i capelli lunghi restano fuori
    function setCapelli(stile, hex, casco) {
      const vis = new Set(stile.split('+'));
      for (const n of capelli) {
        const lungo = n === 'capelli_long' || n === 'capelli_buns' || n === 'capelli_beard';
        pezzi[n].visible = vis.has(n) && (!casco || lungo);
        if (pezzi[n].visible) pezzi[n].material = capelliMat(T, hex);
      }
      pezzi.sopracciglia.material = sopraccigliaMat(hex);
    }
    return { radice, scena: scene, pezzi, ossa, accessori, sesso, T, setCitta, setCapelli, citta: () => citta,
      lascia() { radice.parent && radice.parent.remove(radice); } };
  }

  // ---------- la posa ----------
  // P: { fig (gruppo del rider che contiene il modello), J (punti della posa nel gruppo, come in rider.js),
  //      bacino, busto, testa (Euler), sw } — L nel vecchio rider è il lato +z, che nel modello è il lato destro (_r)
  const qF = new THREE.Quaternion(), qRad = new THREE.Quaternion(), qE = new THREE.Quaternion(), qE2 = new THREE.Quaternion(), qW = new THREE.Quaternion(), qP = new THREE.Quaternion();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vT = new THREE.Vector3(), vPol = new THREE.Vector3(), vK = new THREE.Vector3(), vD = new THREE.Vector3();
  const scala = new THREE.Vector3(), posW = new THREE.Vector3();
  function aggiorna(b) { b.updateMatrix(); b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix); }
  const qMondo = b => b.userData.qw || (b.userData.qw = new THREE.Quaternion());   // quaternione nel mondo, aggiornato in posa()
  // orienta l'osso b nel mondo come qDes, e ricalcola la sua matrice
  function orienta(b, qDes) {
    const qp = qMondo(b.parent);
    b.quaternion.copy(qp).invert().multiply(qDes);
    qMondo(b).copy(qDes);
    aggiorna(b);
  }
  // l'osso resta come a riposo rispetto al padre
  function riposa(b) {
    b.quaternion.copy(b.userData.ql);
    qMondo(b).copy(qMondo(b.parent)).multiply(b.quaternion);
    aggiorna(b);
  }
  // gira l'osso b (già aggiornato) in modo che il figlio c punti verso la direzione d (nel mondo)
  function punta(b, c, d) {
    vA.copy(c.position).normalize().applyQuaternion(qMondo(b));
    qW.setFromUnitVectors(vA, vD.copy(d).normalize()).multiply(qMondo(b));
    orienta(b, qW);
  }
  // IK a due ossa: a (radice), b (gomito/ginocchio), c (fine); bersaglio t e polo pol nel mondo
  function dueOssa(a, b, c, t, pol, l1, l2) {
    riposa(a);
    const A = vB.setFromMatrixPosition(a.matrixWorld);
    vT.subVectors(t, A);
    let d = vT.length(); const dMax = (l1 + l2) * 0.999, dMin = Math.abs(l1 - l2) * 1.01 + 1e-4;
    d = Math.min(dMax, Math.max(dMin, d));
    vT.normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    vPol.subVectors(pol, A); vPol.addScaledVector(vT, -vPol.dot(vT));
    if (vPol.lengthSq() < 1e-8) vPol.set(1, 0, 0).addScaledVector(vT, -vT.x);
    vPol.normalize();
    vK.copy(A).addScaledVector(vT, x).addScaledVector(vPol, h);   // ginocchio / gomito
    vC.subVectors(vK, A); punta(a, b, vC);
    riposa(b);
    const tt = vC.copy(A).addScaledVector(vT, d);
    vC.subVectors(tt, vK); punta(b, c, vC);
  }
  const vFig = new THREE.Vector3();
  const aMondo = (fig, p) => posW.copy(p).applyMatrix4(fig.matrixWorld);
  function posa(M, P) {
    const { ossa: O, T, radice } = M, fig = P.fig, R = T.riposo, s = SCALA;
    radice.updateWorldMatrix(true, false);
    fig.matrixWorld.decompose(vFig, qF, scala);
    const fs = scala.x * s;   // metri del modello → mondo
    qRad.copy(qF).multiply(radice.quaternion);
    qMondo(radice).copy(qRad);
    // dal file caricato all'osso radice: fermi
    aggiorna(M.scena); qMondo(M.scena).copy(qRad).multiply(M.scena.quaternion);
    const arm = O.root.parent;
    aggiorna(arm); qMondo(arm).copy(qRad).multiply(arm.quaternion);
    aggiorna(O.root); qMondo(O.root).copy(qMondo(arm)).multiply(O.root.quaternion);
    // orientamento voluto di un osso: rotazione della posa (nel gruppo del rider) per la sua posa di riposo
    const voluto = (e, nome) => qW.copy(qF).multiply(e).multiply(radice.quaternion).multiply(R[nome].q);
    // bacino: le anche del modello dove il vecchio rider ha le anche
    qE.setFromEuler(P.bacino);
    vA.copy(R.pelvis.p).sub(T.anche).multiplyScalar(s).applyQuaternion(radice.quaternion).applyQuaternion(qE);
    vB.copy(P.J.hipL).add(P.J.hipR).multiplyScalar(0.5).add(vA);
    aMondo(fig, vB);
    O.pelvis.position.copy(O.root.worldToLocal(posW));
    orienta(O.pelvis, voluto(qE, 'pelvis'));
    // schiena: dal bacino al busto, un po' per vertebra
    qE2.setFromEuler(P.busto);
    const sp = ['spine_01', 'spine_02', 'spine_03'];
    for (let i = 0; i < 3; i++) { qP.copy(qE).slerp(qE2, (i + 1) / 3); orienta(O[sp[i]], voluto(qP, sp[i])); }
    // collo e testa
    qE.setFromEuler(P.testa);
    qP.copy(qE2).slerp(qE, 0.5); orienta(O.neck_01, voluto(qP, 'neck_01'));
    orienta(O.Head, voluto(qE, 'Head'));
    for (const n of ['clavicle_l', 'clavicle_r']) riposa(O[n]);
    // gambe: caviglia sul punto della vecchia caviglia (un po' indietro: l'osso del piede è al tallone), ginocchio
    // verso il vecchio ginocchio
    const L = T.lung;
    for (const [lato, k] of [['r', 'L'], ['l', 'R']]) {
      vC.copy(P.J['ank' + k]); vC.x -= 0.03; vC.y -= 0.005;
      const t = aMondo(fig, vC).clone();
      vC.copy(P.J['knee' + k]); vC.x += 0.25;
      const pol = aMondo(fig, vC).clone();
      dueOssa(O['thigh_' + lato], O['calf_' + lato], O['foot_' + lato], t, pol, L.coscia * fs, L.stinco * fs);
      orienta(O['foot_' + lato], voluto(qE.identity(), 'foot_' + lato));   // piede piatto sulla tavola, punta verso il petto
    }
    // braccia: la mano rispetto alla spalla come nel vecchio rider
    for (const [lato, k] of [['r', 'L'], ['l', 'R']]) {
      const up = O['upperarm_' + lato];
      riposa(up);
      const A = vB.setFromMatrixPosition(up.matrixWorld).clone();
      vC.copy(P.J['ha' + k]).sub(P.J['sh' + k]).applyQuaternion(qF).multiplyScalar(scala.x);
      const t = A.clone().add(vC);
      vC.copy(P.J['el' + k]).sub(P.J['sh' + k]); vC.x -= 0.15; vC.applyQuaternion(qF).multiplyScalar(scala.x);
      const pol = A.clone().add(vC);
      dueOssa(up, O['lowerarm_' + lato], O['hand_' + lato], t, pol, L.braccio * fs, L.avambraccio * fs);
    }
  }
  return { quando, pronto, crea, posa, SPENTO, SCALA };
})();
