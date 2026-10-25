// modulo: personaggio
// dipende da: base, rider
// Schermata "Modifica il personaggio" (R-227…R-229): maglia o colore, pantaloni, capelli, casco e tavola, con l'omino
// in 3D che gira (anteprima in città con lo skate o sulla neve con lo snowboard). Ogni scelta si salva subito sul
// dispositivo e si vede subito nell'anteprima; il gioco applica le scelte al proprio rider, le manda agli altri e al
// profilo con cambiato().
// Si crea con PN.personaggio({ colore, inCitta, cambiato }) dal gioco:
//   colore() è il colore assegnato della giacca (quando non si sceglie una maglia); inCitta() dice se lo scenario è una
//   città (l'anteprima parte con lo skate); cambiato() viene chiamata dopo ogni scelta.
// Le scelte stanno in localStorage: cyf.jersey, cyf.hair ("forma:colore"), cyf.pants ("3"), cyf.helmet e cyf.board ("tipo:colore").
window.PN = window.PN || {};
PN.personaggio = ({ colore, inCitta, cambiato }) => {
  const { store, lin } = PN.base;
  const { JERSEYS, myJersey, myHair, myGear, makeRider } = PN.rider;
  const $ = id => document.getElementById(id);
  const box = $('look');
  const sel = {};
  for (const k of ['Jersey', 'HairStyle', 'HairColor', 'Pants', 'Helmet', 'HelmetColor', 'Board', 'BoardColor']) sel[k] = $('sel' + k);
  // "tipo:colore", vuoto se non si è scelto niente
  const pair = (a, b) => (a || b ? a + ':' + b : '');

  // mostra nei menu le scelte salvate
  function mostra() {
    sel.Jersey.value = myJersey();
    const [hs, hc] = myHair().split(':'); sel.HairStyle.value = hs || ''; sel.HairColor.value = hc || '';
    const g = myGear();
    sel.Pants.value = g.p;
    const [et, ec] = g.e.split(':'); sel.Helmet.value = et || ''; sel.HelmetColor.value = ec || '';
    const [bt, bc] = g.s.split(':'); sel.Board.value = bt === 'classico' ? '' : (bt || ''); sel.BoardColor.value = bc || '';
    sel.HelmetColor.disabled = !sel.Helmet.value;
  }
  function salva() {
    store.set('cyf.jersey', JERSEYS[sel.Jersey.value] ? sel.Jersey.value : '');
    store.set('cyf.hair', pair(sel.HairStyle.value, sel.HairColor.value));
    store.set('cyf.pants', sel.Pants.value);
    store.set('cyf.helmet', sel.Helmet.value ? pair(sel.Helmet.value, sel.HelmetColor.value) : '');
    store.set('cyf.board', pair(sel.Board.value, sel.BoardColor.value));
    sel.HelmetColor.disabled = !sel.Helmet.value;
    aggiornaAnteprima();
    cambiato();
  }
  for (const k in sel) sel[k].addEventListener('change', salva);

  // ---------- anteprima 3D: un secondo disegnatore piccolo, acceso solo mentre la schermata è aperta ----------
  let R = null, raf = 0, last = 0;
  function crea() {
    const cvs = $('lookCanvas');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: true }); } catch (e) { cvs.hidden = true; return null; }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(lin('#eef4fb'), lin('#8a96a3'), 0.9));
    const sun = new THREE.DirectionalLight(lin('#fff3e0'), 0.9); sun.position.set(2, 4, 3); scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), new THREE.MeshStandardMaterial({ color: lin('#b9c6d2'), roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    const rider = makeRider(colore());
    rider.pose(0.25, 0.25, 0);
    scene.add(rider.group);
    return { renderer, scene, camera, rider, cvs, angle: -0.6, city: true };
  }
  function aggiornaAnteprima() {
    if (!R) return;
    R.rider.setColor(colore(), myJersey());
    R.rider.setLook(store.get('cyf.id') || '', myHair());
    R.rider.setGear(myGear());
    R.rider.setBoard(R.city ? 'skate' : 'snow');
    $('btnLookCity').setAttribute('aria-pressed', String(R.city));
    $('btnLookSnow').setAttribute('aria-pressed', String(!R.city));
  }
  function disegna(t) {
    if (box.hidden || !R) { raf = 0; return; }   // schermata chiusa (anche da show()): l'anteprima si ferma
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    R.angle += dt * 0.55;
    R.rider.group.rotation.y = R.angle;
    const w = R.cvs.clientWidth, h = R.cvs.clientHeight;
    if (w && h && (R.cvs.width !== Math.round(w * R.renderer.getPixelRatio()) || R.cvs.height !== Math.round(h * R.renderer.getPixelRatio()))) {
      R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    }
    // inquadratura: tutto l'omino con la tavola, un po' dall'alto
    const dist = R.camera.aspect < 1.2 ? 4.4 : 3.6;
    R.camera.position.set(0, 1.25, dist); R.camera.lookAt(0, 0.82, 0);
    R.renderer.render(R.scene, R.camera);
    raf = requestAnimationFrame(disegna);
  }
  function apri() {
    mostra();
    box.hidden = false;
    if (!R) R = crea();
    if (R) { R.city = inCitta(); aggiornaAnteprima(); if (!raf) { last = 0; raf = requestAnimationFrame(disegna); } }
    sel.Jersey.focus({ preventScroll: true });
  }
  function chiudi() { box.hidden = true; }
  $('btnLook').addEventListener('click', apri);
  $('btnRoomLook').addEventListener('click', apri);
  $('btnLookDone').addEventListener('click', chiudi);
  $('btnLookCity').addEventListener('click', () => { if (R) { R.city = true; aggiornaAnteprima(); } });
  $('btnLookSnow').addEventListener('click', () => { if (R) { R.city = false; aggiornaAnteprima(); } });
  box.addEventListener('keydown', e => { if (e.key === 'Escape') chiudi(); e.stopPropagation(); });

  return { apri, chiudi, mostra };
};
