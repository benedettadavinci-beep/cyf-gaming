// modulo: aerei
// dipende da: base, geometria
// R-543 (dalla 0.35.0): nelle città con un aeroporto entro 20 km qualche aereo attraversa il cielo lontano, come
// succede davvero (a Roma per Fiumicino e Ciampino, a Francoforte per il Rhein-Main…). L'aeroporto è nella scheda
// della città (citta/<nome>.js, campo `aeroporto`: nome, km dal centro, colore della coda, quanti aerei). Gli aerei
// seguono la telecamera come il cielo e gli uccelli: stanno sempre a ~600-750 m e a 150-300 m di quota, attraversano
// la vista in 12-20 s, salgono piano (sono appena decollati) e ripartono dopo una pausa. Niente nebbia sugli aerei.
// Fermi e nascosti con ?cielo=fermo e con "riduci il movimento" (le foto delle prove). Si crea con
// PN.aerei({ scene, telefono }) una volta sola; applica(nome, aeroporto | null) a ogni cambio di scenario,
// aggiorna(dt, camera) a ogni fotogramma. Costo: 1-3 oggetti da ~150 triangoli, una sola geometria per coda.
window.PN = window.PN || {};
PN.aerei = ({ scene, telefono }) => {
  const { reduceMotion } = PN.base;
  const { merge } = PN.geometria;
  const fermo = reduceMotion || new URLSearchParams(location.search).get('cielo') === 'fermo';   // come il cielo e gli uccelli
  const MAX = telefono ? 2 : 3;
  const forme = {};
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
  // aereo di linea lungo ~38 m, muso verso -z, coda del colore della città
  function forma(coda) {
    if (forme[coda]) return forme[coda];
    const C = THREE.CylinderGeometry, B = THREE.BoxGeometry, K = THREE.ConeGeometry;
    const g = merge([
      { geo: new C(1.9, 1.7, 30, 12), color: '#f2f4f7' },                                  // fusoliera (lungo y)
      { geo: new K(1.9, 5, 12), color: '#e6e9ee', y: 17.5 },                               // muso
      { geo: new K(1.7, 6, 12), color: '#e6e9ee', y: -18, sx: 1, sy: -1, sz: 1 },          // coda della fusoliera
      { geo: new B(34, 5, 0.5), color: '#d5dae1', y: 1.5 },                                // ali
      { geo: new B(12, 3, 0.4), color: '#d5dae1', y: -17 },                                // piani di coda
      { geo: new B(0.5, 5, 7), color: coda, y: -17, z: 4 },                                // deriva, colore della città
      { geo: new C(1.1, 1.1, 5, 10), color: '#9aa3ad', x: -7.5, y: 3, z: -1.6 },           // motori
      { geo: new C(1.1, 1.1, 5, 10), color: '#9aa3ad', x: 7.5, y: 3, z: -1.6 }
    ]);
    g.rotateX(-Math.PI / 2);   // da lungo y a lungo -z (muso avanti), +z del pezzo diventa l'alto
    return (forme[coda] = g);
  }
  const aerei = [];
  let cfg = null;
  function nuovo(a, subito) {
    // una traiettoria dritta che attraversa la vista davanti alla telecamera, con una pausa prima (o subito)
    a.attesa = subito ? Math.random() * 4 : 6 + Math.random() * 14;
    a.dist = 600 + Math.random() * 150;
    a.dove = (Math.random() - 0.5) * 1.6;                // dove attraversa: angolo rispetto a davanti (-z)
    a.verso = Math.random() < 0.5 ? 1 : -1;              // da sinistra a destra o viceversa
    a.quota = 150 + Math.random() * 150;
    a.sale = 2 + Math.random() * 4;                      // m/s: appena decollato
    a.v = 65 + Math.random() * 20;                       // m/s, ~250-300 km/h
    a.t = -450; a.mesh.visible = false;
  }
  function applica(nome, aeroporto) {
    cfg = aeroporto || null;
    for (const a of aerei) { scene.remove(a.mesh); }
    aerei.length = 0;
    if (!cfg || fermo) return;
    const n = Math.min(MAX, cfg.aerei || 2);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(forma(cfg.coda || '#2753b8'), mat);
      mesh.name = 'aereo'; mesh.renderOrder = -1; mesh.visible = false;
      scene.add(mesh);
      const a = { mesh };
      nuovo(a, i === 0);
      aerei.push(a);
    }
  }
  const tmp = new THREE.Vector3();
  function aggiorna(dt, camera) {
    for (const a of aerei) {
      if (a.attesa > 0) { a.attesa -= dt; a.mesh.visible = false; continue; }
      a.t += a.v * dt;
      if (a.t > 450) { nuovo(a, false); continue; }
      // centro della traiettoria davanti alla telecamera, direzione di volo di traverso (perpendicolare alla vista)
      const cx = Math.sin(a.dove) * a.dist, cz = -Math.cos(a.dove) * a.dist;
      const dx = Math.cos(a.dove) * a.verso, dz = Math.sin(a.dove) * a.verso;
      tmp.set(camera.position.x + cx + dx * a.t, camera.position.y + a.quota + (a.t + 450) / a.v * a.sale, camera.position.z + cz + dz * a.t);
      a.mesh.position.copy(tmp);
      a.mesh.rotation.set(0, Math.atan2(-dx, -dz), 0);
      a.mesh.rotateX(Math.atan2(a.sale, a.v));   // muso un po' in su: sta salendo
      a.mesh.visible = true;
    }
  }
  return { applica, aggiorna };
};
